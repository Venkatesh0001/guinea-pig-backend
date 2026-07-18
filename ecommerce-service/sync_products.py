import os
import sys
import time
import json
import sqlite3
import logging
import requests
from dotenv import load_dotenv

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Load configuration from environment file
load_dotenv()

PRINTIFY_API_TOKEN = os.getenv("PRINTIFY_API_TOKEN")
PRINTIFY_SHOP_ID = os.getenv("PRINTIFY_SHOP_ID")
DATABASE_PATH = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "products.db"))

class DatabaseManager:
    """Manages database connection and CRUD operations for synchronized catalog."""
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None
        self.init_db()

    def init_db(self):
        try:
            self.conn = sqlite3.connect(self.db_path)
            cursor = self.conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    product_id TEXT PRIMARY KEY,
                    raw_data TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            self.conn.commit()
            logging.info(f"SQLite database initialized successfully at: {self.db_path}")
        except Exception as e:
            logging.critical(f"Failed to initialize SQLite database: {e}")
            raise e

    def product_exists(self, product_id):
        cursor = self.conn.cursor()
        cursor.execute("SELECT 1 FROM products WHERE product_id = ?", (product_id,))
        return cursor.fetchone() is not None

    def upsert_product(self, product_id, raw_data):
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO products (product_id, raw_data, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(product_id) DO UPDATE SET
                    raw_data = excluded.raw_data,
                    updated_at = CURRENT_TIMESTAMP
            """, (product_id, raw_data))
            self.conn.commit()
        except Exception as e:
            logging.error(f"Failed to upsert product {product_id} into database: {e}")
            raise e

    def get_products_count(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(1) FROM products")
        return cursor.fetchone()[0]

    def delete_stale_products(self, fetched_product_ids):
        """Remove local rows for products no longer present in the Printify store."""
        if not fetched_product_ids:
            logging.info("No products fetched; skipping stale row cleanup.")
            return
        try:
            cursor = self.conn.cursor()
            placeholders = ",".join("?" for _ in fetched_product_ids)
            cursor.execute(
                f"DELETE FROM products WHERE product_id NOT IN ({placeholders})",
                list(fetched_product_ids)
            )
            self.conn.commit()
            logging.info(f"Removed {cursor.rowcount} stale product(s) no longer present in Printify.")
        except Exception as e:
            logging.error(f"Failed to delete stale products: {e}")
            raise e

    def close(self):
        if self.conn:
            self.conn.close()
            logging.info("Database connection closed cleanly.")


class PrintifyClient:
    """Robust API Client handling Authentication, Timeouts, and Throttling on 429 status codes."""
    def __init__(self, token):
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "GuineaPig E-Commerce Synchronization Engine"
        }

    def get(self, url, max_retries=5, initial_backoff=2):
        retries = 0
        backoff = initial_backoff
        while retries < max_retries:
            try:
                response = requests.get(url, headers=self.headers, timeout=15)
                # Handle Rate Limiting
                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After")
                    wait_time = int(retry_after) if (retry_after and retry_after.isdigit()) else backoff
                    logging.warning(f"Rate Limit (HTTP 429) hit. Waiting for {wait_time}s before retrying request to: {url}")
                    time.sleep(wait_time)
                    retries += 1
                    backoff *= 2
                    continue
                
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                logging.error(f"Network error on GET request to {url}: {e}")
                if retries == max_retries - 1:
                    raise e
                logging.info(f"Retrying request in {backoff}s...")
                time.sleep(backoff)
                retries += 1
                backoff *= 2
        raise Exception(f"Max retries exceeded on request to: {url}")


def run_synchronization():
    if not PRINTIFY_API_TOKEN or not PRINTIFY_SHOP_ID:
        logging.critical("API credentials missing in environment. Ensure PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID are set in .env")
        sys.exit(1)

    logging.info("Starting synchronization engine run...")
    db = DatabaseManager(DATABASE_PATH)
    client = PrintifyClient(PRINTIFY_API_TOKEN)

    try:
        # 1. Fetch All Shop Products (Printify paginates this endpoint)
        products_url = f"https://api.printify.com/v1/shops/{PRINTIFY_SHOP_ID}/products.json"
        logging.info("Retrieving product catalog from Printify store...")
        products_list = []
        page = 1
        last_page = 1
        while page <= last_page:
            page_data = client.get(f"{products_url}?page={page}")
            page_items = page_data.get("data")
            if not isinstance(page_items, list):
                logging.error(f"Unexpected response shape on page {page}: missing list 'data' key. Aborting sync before any DB mutation.")
                return
            last_page = page_data.get("last_page", page)
            logging.info(f"Fetched page {page}/{last_page} ({len(page_items)} products).")
            products_list.extend(page_items)
            page += 1
        logging.info(f"Retrieved {len(products_list)} active products from store.")

        # 2. Iterate and Synchronize each product
        fetched_product_ids = set()
        for idx, p in enumerate(products_list):
            product_id = p.get("id")
            title = p.get("title", "")

            if not product_id:
                logging.warning(f"Skipping product index {idx} due to missing id.")
                continue

            fetched_product_ids.add(product_id)

            # Establish whether it is a Create or Update operation
            exists_locally = db.product_exists(product_id)
            sync_type = "UPDATE" if exists_locally else "INSERT (NEW)"
            logging.info(f"[{sync_type}] Syncing: '{title}' (ID: {product_id})")

            # Save the exact raw JSON object from Printify directly to the database
            db.upsert_product(
                product_id=product_id,
                raw_data=json.dumps(p)
            )
            logging.info(f"  Product sync completed successfully for: {product_id}")

        # 3. Remove local rows for products no longer present in the store
        db.delete_stale_products(fetched_product_ids)

        total_db_count = db.get_products_count()
        logging.info(f"Synchronization successfully finished! Total database records: {total_db_count}")

    except Exception as e:
        logging.critical(f"Synchronization pipeline aborted with exception: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_synchronization()
