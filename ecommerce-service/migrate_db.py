import os
import sqlite3
import psycopg2
import json
from dotenv import load_dotenv

load_dotenv()

# Source DB (SQLite)
SQLITE_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "products.db")

# Target DB (Supabase / Postgres)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fallback to local DB configuration from facebook_group/init_db.py
    DATABASE_URL = "postgresql://admin:localpassword@localhost:5432/facebook_qa_db"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def migrate():
    print(f"Connecting to source SQLite DB at {SQLITE_DB_PATH}...")
    if not os.path.exists(SQLITE_DB_PATH):
        print("Source SQLite DB not found. Nothing to migrate.")
        return

    sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    
    try:
        sqlite_cursor.execute("SELECT * FROM products")
        rows = sqlite_cursor.fetchall()
        print(f"Found {len(rows)} products in SQLite.")
    except Exception as e:
        print(f"Failed to read from SQLite: {e}")
        return
        
    print("Connecting to target Postgres DB...")
    try:
        pg_conn = psycopg2.connect(DATABASE_URL)
        pg_cursor = pg_conn.cursor()
    except Exception as e:
        print(f"Failed to connect to Postgres: {e}")
        return
        
    print("Ensuring target table exists in Postgres...")
    pg_cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            product_id TEXT PRIMARY KEY,
            raw_data TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    pg_conn.commit()
    
    print("Migrating records...")
    inserted = 0
    for row in rows:
        product_id = row["product_id"]
        raw_data = row["raw_data"]
        updated_at = row["updated_at"]
        
        try:
            pg_cursor.execute("""
                INSERT INTO products (product_id, raw_data, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT(product_id) DO UPDATE SET
                    raw_data = EXCLUDED.raw_data,
                    updated_at = EXCLUDED.updated_at
            """, (product_id, raw_data, updated_at))
            inserted += 1
        except Exception as e:
            print(f"Error inserting product {product_id}: {e}")
            
    pg_conn.commit()
    
    print(f"Migration complete! {inserted} products migrated successfully to Postgres.")
    
    sqlite_conn.close()
    pg_conn.close()

if __name__ == "__main__":
    migrate()
