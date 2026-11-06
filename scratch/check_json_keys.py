import sqlite3
import json

conn = sqlite3.connect('assets/data/quran.db')
c = conn.cursor()
c.execute("SELECT page, raw_json FROM mushaf_svg_pages WHERE page IN (1, 3, 50, 76, 77)")
for row in c.fetchall():
    data = json.loads(row[1])
    print(f"Page {row[0]}: keys = {list(data[0].keys())}")
    print(f"  sample: {data[0]}")
