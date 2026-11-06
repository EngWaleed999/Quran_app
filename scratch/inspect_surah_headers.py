import sqlite3
import re

conn = sqlite3.connect('assets/data/quran.db')
c = conn.cursor()

# Find pages where surahs start
c.execute("SELECT sura_no, sura_name_ar, page_start FROM surahs ORDER BY sura_no ASC")
surah_starts = c.fetchall()

# Check some pages: 1, 2, 77 (Surah 3 Al-Imran starts on 50 or 77?), let's print page_starts
print("Sample surah starts:")
for s in surah_starts[:15]:
    print(f"Surah {s[0]} ({s[1]}): starts on page {s[2]}")

# Let's inspect page 77 where Ali 'Imran starts (or 50?)
# Let's see what surahs start on page 50, 77, 106, 187, etc.
surah_dict = {s[0]: s for s in surah_starts}

# Let's check SVG content of page 50, 77, 604 for any surah header elements
for p in [1, 2, 50, 77, 106, 604]:
    c.execute("SELECT svg_xml FROM mushaf_svg_pages WHERE page = ?", (p,))
    row = c.fetchone()
    if row:
        svg = row[0]
        # Look for text tags or g tags
        texts = re.findall(r'<text[^>]*>.*?</text>', svg, re.DOTALL)
        print(f"Page {p}: text count = {len(texts)}")
        # Look for anything with 'sura' or 'surah' or transform
        transforms = re.findall(r'transform="translate\([^)]+\)"', svg)
        print(f"Page {p}: transform count = {len(transforms)}, sample = {transforms[:3]}")
