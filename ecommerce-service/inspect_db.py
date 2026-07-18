import sqlite3
conn = sqlite3.connect("products.db")
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", cursor.fetchall())
cursor.execute("SELECT product_id, json_extract(raw_data, '$.title'), updated_at FROM products")
rows = cursor.fetchall()
print(f"Products ({len(rows)}):")
for r in rows:
    print(f"  {r}")
# Show one full record
if rows:
    cursor.execute("SELECT * FROM products LIMIT 1")
    full = cursor.fetchone()
    cols = [d[0] for d in cursor.description]
    print("\nSample record columns:", cols)
    for c, v in zip(cols, full):
        val_str = str(v)[:200] if v else "None"
        print(f"  {c}: {val_str}")
conn.close()
