import sys
import psycopg2

try:
    # 1. Connect to the database using the credentials from your docker-compose file
    conn = psycopg2.connect(
        host="localhost",
        database="facebook_qa_db",
        user="admin",
        password="localpassword",
        port="5432"
    )
    cursor = conn.cursor()
    
    # 2. Activate the pgvector extension inside PostgreSQL
    print("Activating pgvector extension...")
    cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    
    # 3. Create the table schema
    print("Creating facebook_posts table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS facebook_posts (
            id SERIAL PRIMARY KEY,
            fb_post_id VARCHAR(255) UNIQUE,
            post_url TEXT NOT NULL,
            content TEXT NOT NULL,
            text_embedding vector(384)
        );
    """)

    print("Creating facebook_comments table...")
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
    
    # Commit changes and clean up
    conn.commit()
    cursor.close()
    conn.close()
    print("Database initialization complete! You are ready to store embeddings.")

except Exception as e:
    print(f"An error occurred while setting up the database: {e}")
    sys.exit(1)