import sqlite3
import re

conn = sqlite3.connect('assets/data/quran.db')
c = conn.cursor()
c.execute("PRAGMA table_info(mushaf_svg_pages)")
print("Columns:", [col[1] for col in c.fetchall()])

c.execute("SELECT page, view_box, length(svg_xml), length(raw_json) FROM mushaf_svg_pages WHERE page IN (1, 2, 3, 76, 77, 580, 590, 604)")
for row in c.fetchall():
    print(f"Page {row[0]}: view_box={row[1]}, svg_len={row[2]}, json_len={row[3]}")
