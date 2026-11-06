import sqlite3
import xml.etree.ElementTree as ET

conn = sqlite3.connect('assets/data/quran.db')
c = conn.cursor()
c.execute("SELECT svg_xml FROM mushaf_svg_pages WHERE page = 106")
svg_xml = c.fetchone()[0]

root = ET.fromstring(svg_xml)
for i, path in enumerate(root.iter('{http://www.w3.org/2000/svg}path')):
    d = path.attrib.get('d', '')
    transform = path.attrib.get('transform', '')
    print(f"Path {i}: len(d)={len(d)}, transform={transform}, start={d[:60]}")
