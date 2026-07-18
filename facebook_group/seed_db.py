import os
import sys
import glob
import json
import psycopg2
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

# Load database URL
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(script_dir, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Try loading from the ecommerce-service .env if root is empty
    load_dotenv(os.path.join(script_dir, "..", "ecommerce-service", ".env"))
    DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Direct fallback using the credentials provided by the user
    DATABASE_URL = "postgresql://postgres.sjszlthjiltfmxwrmmbs:o9iXCHPMSroAUh0d@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Default to the new dataset path
JSON_FILE_PATH = os.path.join(script_dir, "..", "diagnostics-service", "dataset_facebook-groups-scraper_2026-07-18_07-52-31-758.json")

def seed_database():
    print(f"Connecting to database...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        print("Connected to Supabase database successfully.")
    except Exception as e:
        print(f"Failed to connect to database: {e}", file=sys.stderr)
        return

    # Ensure tables exist
    cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
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
    conn.commit()

    print("Loading SentenceTransformer model...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("Model loaded successfully.")

    json_file_path = JSON_FILE_PATH
    print(f"Opening dataset file: {json_file_path}")
    if not os.path.exists(json_file_path):
        # Fallback to look inside facebook_group if not in diagnostics-service
        matches = glob.glob(os.path.join(script_dir, "dataset_facebook-groups-scraper_*.json"))
        if matches:
            json_file_path = matches[0]
            print(f"Dataset not found at primary path. Falling back to: {json_file_path}")
        else:
            print("CRITICAL ERROR: No dataset file found.", file=sys.stderr)
            return

    with open(json_file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Found {len(data)} items in dataset. Starting seed...")

    posts_inserted = 0
    comments_inserted = 0
    skipped_comments = 0

    # Check if the dataset is flat comments or nested posts
    is_nested_posts = len(data) > 0 and "topComments" in data[0]

    if is_nested_posts:
        print("Detected nested posts dataset. Seeding both posts and comments...")
        for idx, post in enumerate(data):
            post_id = post.get("id")
            post_url = post.get("facebookUrl") or post.get("url") or ""
            content = (post.get("text") or "").strip()
            legacy_id = post.get("legacyId")

            if not content or not legacy_id:
                continue

            # 1. Insert parent post (Skip embedding computation since it's not used in search)
            try:
                cursor.execute("""
                    INSERT INTO facebook_posts (fb_post_id, post_url, content, legacy_id)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (fb_post_id) DO NOTHING;
                """, (post_id, post_url, content, legacy_id))
                if cursor.rowcount > 0:
                    posts_inserted += 1
            except Exception as e:
                print(f"Error inserting post {post_id}: {e}")
                conn.rollback()
                continue

            # 2. Insert topComments nested under this post
            comments_list = post.get("topComments", [])
            for comment in comments_list:
                comment_text = (comment.get("text") or "").strip()
                if not comment_text:
                    skipped_comments += 1
                    continue

                comment_id = comment.get("commentId") or comment.get("id")
                author_name = (comment.get("user") or {}).get("name", "Anonymous")
                comment_url = comment.get("commentUrl") or comment.get("url") or post_url

                try:
                    # Generate embedding for comment
                    embedding = model.encode(comment_text).tolist()

                    cursor.execute("""
                        INSERT INTO facebook_comments (comment_id, parent_post_id, author_name, post_url, content, text_embedding)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (comment_id) DO NOTHING;
                    """, (comment_id, legacy_id, author_name, comment_url, comment_text, embedding))
                    if cursor.rowcount > 0:
                        comments_inserted += 1
                except Exception as e:
                    print(f"Error inserting comment {comment_id}: {e}")
                    conn.rollback()
                    continue

            # Commit per post
            conn.commit()

            if (idx + 1) % 50 == 0 or (idx + 1) == len(data):
                print(f"Processed {idx + 1}/{len(data)} posts. Posts inserted: {posts_inserted}, Comments inserted: {comments_inserted}")
    else:
        print("Detected flat comments dataset. Seeding comments only...")
        for idx, comment in enumerate(data):
            comment_text = (comment.get("text") or "").strip()
            if not comment_text:
                skipped_comments += 1
                continue

            comment_id = comment.get("commentId") or comment.get("id")
            parent_post_id = comment.get("legacyId")
            author_name = (comment.get("user") or {}).get("name", "Anonymous")
            comment_url = comment.get("commentUrl") or comment.get("url") or ""

            try:
                # Generate embedding for comment
                embedding = model.encode(comment_text).tolist()

                cursor.execute("""
                    INSERT INTO facebook_comments (comment_id, parent_post_id, author_name, post_url, content, text_embedding)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (comment_id) DO NOTHING;
                """, (comment_id, parent_post_id, author_name, comment_url, comment_text, embedding))
                if cursor.rowcount > 0:
                    comments_inserted += 1
                conn.commit()
            except Exception as e:
                print(f"Error inserting comment {comment_id}: {e}")
                conn.rollback()
                continue

            if (idx + 1) % 50 == 0 or (idx + 1) == len(data):
                print(f"Processed {idx + 1}/{len(data)} comments. Comments inserted: {comments_inserted}")

    cursor.close()
    conn.close()
    print("\n--- Seeding Summary ---")
    print(f"Total items processed: {len(data)}")
    print(f"New posts inserted: {posts_inserted}")
    print(f"New comments inserted (with embeddings): {comments_inserted}")
    print(f"Comments skipped (empty): {skipped_comments}")
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed_database()
