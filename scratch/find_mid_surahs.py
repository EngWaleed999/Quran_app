import sqlite3
import json

conn = sqlite3.connect('assets/data/quran.db')
c = conn.cursor()

c.execute("SELECT page, raw_json FROM mushaf_svg_pages ORDER BY page ASC")
mid_page_surahs = []
for p, raw_json in c.fetchall():
    data = json.loads(raw_json)
    surahs_in_page = []
    for item in data:
        s_no = item.get('surahNumber') or item.get('sura_number')
        a_no = item.get('ayahNumber') or item.get('ayah_number')
        if a_no == 1:
            surahs_in_page.append((s_no, a_no))
    if len(surahs_in_page) > 0:
        # Check if ayah 1 is the first entry or not
        first_entry = data[0]
        first_a = first_entry.get('ayahNumber') or first_entry.get('ayah_number')
        if first_a != 1 or len(surahs_in_page) > 1:
            mid_page_surahs.append((p, [s[0] for s in surahs_in_page], first_a))

print(f"Total pages with surahs starting mid-page or multiple surahs: {len(mid_page_surahs)}")
for p, s_list, first_a in mid_page_surahs[:15]:
    print(f"Page {p}: Surahs starting = {s_list}, first ayah on page is ayah {first_a}")
