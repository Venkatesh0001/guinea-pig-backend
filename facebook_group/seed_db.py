import os
import json
import re
import sys
import psycopg2
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

# Load environment variables from local .env file
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(script_dir, ".env"))

# Load dataset path
JSON_FILE_PATH = r"E:\Guinea_Pig_UI\facebook_group\dataset_facebook-groups-scraper_2026-06-19_03-58-19-432 (1).json"

def extract_legacy_id(url):
    if not url:
        return None
    # Match permalink format
    m = re.search(r'/permalink/(\d+)', url)
    if m:
        return m.group(1)
    # Match set=gm. format
    m = re.search(r'set=gm\.(\d+)', url)
    if m:
        return m.group(1)
    return None

def seed_database():
    # 1. Fetch connection string from Environment Variables
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("CRITICAL ERROR: The 'DATABASE_URL' environment variable is not set.", file=sys.stderr)
        print("Please ensure your local .env file contains a valid 'DATABASE_URL' configuration.", file=sys.stderr)
        sys.exit(1)

    # Convert legacy scheme prefix if present
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    # 2. Load the NLP embedding model
    print("Loading SentenceTransformer model 'all-MiniLM-L6-v2'...")
    try:
        model = SentenceTransformer("all-MiniLM-L6-v2")
        print("Model loaded successfully.")
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to load SentenceTransformer model: {e}", file=sys.stderr)
        sys.exit(1)

    # 3. Read the comments JSON file
    if not os.path.exists(JSON_FILE_PATH):
        print(f"CRITICAL ERROR: JSON dataset file not found at: {JSON_FILE_PATH}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
            comments = json.load(f)
        print(f"Loaded {len(comments)} comments from JSON file.")
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to parse JSON dataset: {e}", file=sys.stderr)
        sys.exit(1)

    # 4. Connect to Supabase / PostgreSQL database
    try:
        print("Attempting to connect to PostgreSQL database...")
        # psycopg2 natively supports URI connection strings (including port 6543 pooling connections)
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        print("Successfully connected to Supabase database.")
    except Exception as e:
        print(f"CRITICAL ERROR: Database connection failed: {e}", file=sys.stderr)
        sys.exit(1)

    # 5. Initialize Schema & Execute Migrations
    try:
        print("Initializing vector extension and database schema...")
        
        # Enable pgvector extension
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        
        # Create posts table if it does not exist (fallback for empty databases)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS facebook_posts (
                id SERIAL PRIMARY KEY,
                fb_post_id VARCHAR(255) UNIQUE,
                post_url TEXT NOT NULL,
                content TEXT NOT NULL,
                text_embedding vector(384),
                legacy_id VARCHAR(255)
            );
        """)

        # Create comments table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS facebook_comments (
                id SERIAL PRIMARY KEY,
                comment_id VARCHAR(255) UNIQUE,
                parent_post_id VARCHAR(255),
                author_name VARCHAR(255),
                post_url TEXT NOT NULL,
                content TEXT NOT NULL,
                text_embedding vector(384)
            );
        """)
        
        # Verify legacy_id column exists on posts table
        cursor.execute("ALTER TABLE facebook_posts ADD COLUMN IF NOT EXISTS legacy_id VARCHAR(255);")
        
        # Populate legacy_id for existing posts if any exist
        cursor.execute("SELECT id, post_url FROM facebook_posts WHERE legacy_id IS NULL;")
        posts_to_update = cursor.fetchall()
        for post_id, post_url in posts_to_update:
            legacy_id = extract_legacy_id(post_url)
            if legacy_id:
                cursor.execute("UPDATE facebook_posts SET legacy_id = %s WHERE id = %s;", (legacy_id, post_id))
                
        conn.commit()
        print("Database schema migration and validation complete.")
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to run database migrations: {e}", file=sys.stderr)
        conn.rollback()
        cursor.close()
        conn.close()
        sys.exit(1)

    # 6. Process and Insert comments data
    inserted_count = 0
    skipped_count = 0

    print("Generating embeddings and seeding comments to database...")
    for idx, comment in enumerate(comments):
        text = comment.get("text", "").strip()
        if not text:
            skipped_count += 1
            continue

        comment_id = comment.get("commentId") or comment.get("id")
        parent_post_id = comment.get("legacyId")
        author_name = comment.get("user", {}).get("name", "Anonymous")
        post_url = comment.get("url") or comment.get("facebookUrl", "https://www.facebook.com/groups/484638885565090")

        try:
            # Generate 384-dimensional vector embedding
            embedding = model.encode(text).tolist()
            
            # Insert record using standard parameter binding
            cursor.execute("""
                INSERT INTO facebook_comments (comment_id, parent_post_id, author_name, post_url, content, text_embedding)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (comment_id) DO NOTHING;
            """, (comment_id, parent_post_id, author_name, post_url, text, embedding))
            
            inserted_count += 1
        except psycopg2.Error as db_err:
            # Print strict database execution errors (e.g. constraints, type mismatch, dimensions)
            print(f"\n[ROW ERROR] Failed to insert comment {idx} (ID: {comment_id}):", file=sys.stderr)
            print(f"  PostgreSQL Error Code: {db_err.pgcode}", file=sys.stderr)
            print(f"  PostgreSQL Message: {db_err.pgerror}", file=sys.stderr)
            conn.rollback()
            continue
        except Exception as e:
            print(f"\n[GENERAL ERROR] Row {idx} failed: {e}", file=sys.stderr)
            conn.rollback()
            continue

        if (idx + 1) % 10 == 0 or (idx + 1) == len(comments):
            print(f"Processed {idx + 1}/{len(comments)} comments...")

    # Commit changes and close connection
    try:
        conn.commit()
        cursor.close()
        conn.close()
        print("\n--- Seeding Summary ---")
        print(f"Total processed comments: {len(comments)}")
        print(f"Successfully inserted/verified: {inserted_count}")
        print(f"Skipped (empty content): {skipped_count}")
        print("Database seeding completed successfully.")
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to commit database transactions: {e}", file=sys.stderr)

if __name__ == "__main__":
    seed_database()
