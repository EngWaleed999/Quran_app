import os
import sqlite3
import json
import re

svg_dir = 'D:/Quran_App/quran_svg_1/svg'
json_dir = 'D:/Quran_App/quran_svg_1/json'
db_path = 'D:/Quran_App/assets/data/quran.db'

print(f"Connecting to database: {db_path}")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Set fast pragmas for batch insertion
cursor.execute("PRAGMA journal_mode = WAL")
cursor.execute("PRAGMA synchronous = NORMAL")

# Create table
cursor.execute("""
CREATE TABLE IF NOT EXISTS mushaf_svg_pages (
    page INTEGER PRIMARY KEY,
    view_box TEXT NOT NULL,
    svg_xml TEXT NOT NULL,
    raw_json TEXT NOT NULL
);
""")

# Delete existing rows if any to ensure clean fresh state
cursor.execute("DELETE FROM mushaf_svg_pages")

rows = []
for p in range(1, 605):
    fname = f'{p:03d}'
    svg_file = os.path.join(svg_dir, f'{fname}.svg')
    json_file = os.path.join(json_dir, f'{fname}.json')

    if not os.path.exists(svg_file) or not os.path.exists(json_file):
        raise FileNotFoundError(f"Missing page {p} SVG or JSON file!")

    with open(svg_file, 'r', encoding='utf-8') as f:
        svg_content = f.read()
    with open(json_file, 'r', encoding='utf-8') as f:
        json_content = f.read()

    # Apply viewBox & title optimizations for Pages 1 and 2
    if p == 1:
        view_box = "-10 8 258 220"
        # remove the unboxed title
        svg_content = re.sub(
            r'<g><path fill="#231f20" fill-rule="evenodd" d="[^"]+" transform="translate\(197\.29 406\.52\)"\/><\/g>',
            '',
            svg_content
        )
        svg_content = re.sub(r'viewBox="[^"]+"', f'viewBox="{view_box}"', svg_content)
    elif p == 2:
        view_box = "-10 32 258 200"
        # remove the unboxed title
        svg_content = re.sub(
            r'<g><path fill="#231f20" fill-rule="evenodd" d="[^"]+" transform="translate\(191\.3 407\.03\)"\/><\/g>',
            '',
            svg_content
        )
        svg_content = re.sub(r'viewBox="[^"]+"', f'viewBox="{view_box}"', svg_content)
    else:
        vb_match = re.search(r'viewBox="([^"]+)"', svg_content)
        view_box = vb_match.group(1) if vb_match else "0 0 345 550"

    rows.append((p, view_box, svg_content, json_content))

print(f"Prepared {len(rows)} pages. Inserting into mushaf_svg_pages...")
cursor.executemany(
    "INSERT INTO mushaf_svg_pages (page, view_box, svg_xml, raw_json) VALUES (?, ?, ?, ?)",
    rows
)
conn.commit()

# VACUUM to ensure contiguous pages and minimal size
print("Running VACUUM...")
cursor.execute("VACUUM")
conn.close()

final_size_mb = os.path.getsize(db_path) / (1024 * 1024)
print(f"SUCCESS: {len(rows)} pages inserted into {db_path}. Total size: {final_size_mb:.2f} MB")
