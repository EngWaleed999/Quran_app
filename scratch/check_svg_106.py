import sqlite3
import re

conn = sqlite3.connect('assets/data/quran.db')
c = conn.cursor()

c.execute("SELECT svg_xml FROM mushaf_svg_pages WHERE page = 106")
svg_106 = c.fetchone()[0]

# Check for paths with fill="#231f20" or other colors
# What fills exist in page 106?
fills = set(re.findall(r'fill="([^"]+)"', svg_106))
print("Fills in page 106:", fills)

# Does page 106 have surah banner graphics?
# Let's count paths
paths = re.findall(r'<path[^>]+>', svg_106)
print(f"Page 106 has {len(paths)} paths.")
