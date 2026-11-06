import sqlite3
import time
import json

print("=== RUNNING FINAL VERIFICATION ===")

# 1. Verify Mushaf SVG in quran.db
conn_quran = sqlite3.connect('D:/Quran_App/assets/data/quran.db')
cur_q = conn_quran.cursor()

cur_q.execute("SELECT count(*) FROM mushaf_svg_pages")
page_count = cur_q.fetchone()[0]
assert page_count == 604, f"Expected 604 pages, got {page_count}"
print(f"✔ mushaf_svg_pages: Exactly {page_count}/604 pages present.")

# Check Page 1 and 2 optimizations
cur_q.execute("SELECT view_box FROM mushaf_svg_pages WHERE page = 1")
assert cur_q.fetchone()[0] == "-10 8 258 220"
cur_q.execute("SELECT view_box FROM mushaf_svg_pages WHERE page = 2")
assert cur_q.fetchone()[0] == "-10 32 258 200"
print("✔ Pages 1 & 2 viewBoxes: Optimal tight viewboxes preserved.")

# Benchmark page loading
t0 = time.perf_counter()
cur_q.execute("SELECT view_box, svg_xml, raw_json FROM mushaf_svg_pages WHERE page = 255")
row = cur_q.fetchone()
t1 = time.perf_counter()
dur_page = (t1 - t0) * 1000
print(f"✔ Page 255 load time: {dur_page:.3f} ms (SVG len: {len(row[1])})")

conn_quran.close()

# 2. Verify Tafsir in tafsir.db
conn_tafsir = sqlite3.connect('D:/Quran_App/assets/data/tafsir.db')
cur_t = conn_tafsir.cursor()

cur_t.execute("SELECT count(*) FROM ayah_tafsir WHERE tafsir_type = 'saadi'")
saadi_count = cur_t.fetchone()[0]
assert saadi_count == 6236, f"Expected 6236 Saadi entries, got {saadi_count}"
print(f"✔ Tafsir Saadi: Exactly {saadi_count}/6236 ayahs present.")

cur_t.execute("SELECT count(*) FROM ayah_tafsir WHERE tafsir_type = 'muyassar'")
muyassar_count = cur_t.fetchone()[0]
assert muyassar_count == 6236, f"Expected 6236 Muyassar entries, got {muyassar_count}"
print(f"✔ Tafsir Muyassar: Exactly {muyassar_count}/6236 ayahs present.")

# Benchmark Tafsir query for Ayat Al-Kursi (2:255)
t0 = time.perf_counter()
cur_t.execute("SELECT text FROM ayah_tafsir WHERE sura_no = 2 AND aya_no = 255 AND tafsir_type = 'saadi'")
txt_saadi = cur_t.fetchone()[0]
t1 = time.perf_counter()
dur_tafsir = (t1 - t0) * 1000
print(f"✔ Tafsir query time: {dur_tafsir:.3f} ms")
print(f"   Sample text: {txt_saadi[:60]}...")

conn_tafsir.close()
print("\n=== ALL VERIFICATIONS PASSED (100%) ===")
