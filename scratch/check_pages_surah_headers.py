import sqlite3
import json

conn = sqlite3.connect('assets/data/quran.db')
c = conn.cursor()

# Check raw_json of page 1, 2, 50, 76, 77, 106, 604
# Where do ayahs start vertically (y coordinates)?
for p in [1, 2, 50, 76, 77, 106, 604]:
    c.execute("SELECT raw_json FROM mushaf_svg_pages WHERE page = ?", (p,))
    row = c.fetchone()
    if row:
        data = json.loads(row[0])
        print(f"Page {p} has {len(data)} ayahs in JSON.")
        if len(data) > 0:
            first_ayah = data[0]
            print(f"  First ayah: surah={first_ayah.get('sura_number') or first_ayah.get('surah')}, ayah={first_ayah.get('ayah_number') or first_ayah.get('ayah')}")
