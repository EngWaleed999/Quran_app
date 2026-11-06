import sqlite3
import json
import math
import os
import re

print("====================================================================")
print("     COMPREHENSIVE VERIFICATION & TEST SUITE (problem_fixes.md)     ")
print("====================================================================")

quran_db_path = 'assets/data/quran.db'
tafsir_db_path = 'assets/data/tafsir.db'

all_passed = True

def report(test_name, passed, detail=""):
    global all_passed
    status = "PASS" if passed else "FAIL"
    if not passed:
        all_passed = False
    print(f"[{status}] {test_name} {detail}")

# -------------------------------------------------------------
# 1. TAFSIR DATABASE VERIFICATION
# -------------------------------------------------------------
print("\n--- 1. TAFSIR DATABASE INTEGRITY & SCHEMA ---")
if not os.path.exists(tafsir_db_path):
    report("Tafsir DB File Exists", False, f"Not found at {tafsir_db_path}")
else:
    db_size = os.path.getsize(tafsir_db_path) / (1024 * 1024)
    report("Tafsir DB File Exists", True, f"Size: {db_size:.2f} MB")

    tconn = sqlite3.connect(tafsir_db_path)
    tc = tconn.cursor()

    # Integrity check
    tc.execute("PRAGMA integrity_check")
    integ = tc.fetchone()[0]
    report("Tafsir PRAGMA integrity_check", integ == 'ok', f"Result: {integ}")

    # User version
    tc.execute("PRAGMA user_version")
    uver = tc.fetchone()[0]
    report("Tafsir PRAGMA user_version", uver == 1, f"Version: {uver}")

    # Table and index existence
    tc.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='ayah_tafsir'")
    tbl_cnt = tc.fetchone()[0]
    report("Table ayah_tafsir Exists", tbl_cnt == 1)

    tc.execute("SELECT count(*) FROM sqlite_master WHERE type='index' AND name='idx_tafsir_lookup'")
    idx_cnt = tc.fetchone()[0]
    report("Index idx_tafsir_lookup Exists", idx_cnt == 1)

    # Counts
    tc.execute("SELECT count(*) FROM ayah_tafsir WHERE tafsir_type = 'saadi'")
    saadi_cnt = tc.fetchone()[0]
    report("Saadi Record Count", saadi_cnt == 6236, f"Count: {saadi_cnt}/6236")

    tc.execute("SELECT count(*) FROM ayah_tafsir WHERE tafsir_type = 'muyassar'")
    muyassar_cnt = tc.fetchone()[0]
    report("Muyassar Record Count", muyassar_cnt == 6236, f"Count: {muyassar_cnt}/6236")

    # Sample queries
    tc.execute("SELECT text FROM ayah_tafsir WHERE sura_no = 1 AND aya_no = 1 AND tafsir_type = 'saadi'")
    row = tc.fetchone()
    report("Sample Query Saadi (1:1)", row is not None and len(row[0]) > 10, f"Snippet: {row[0][:45]}...")

    tc.execute("SELECT text FROM ayah_tafsir WHERE sura_no = 1 AND aya_no = 1 AND tafsir_type = 'muyassar'")
    row = tc.fetchone()
    report("Sample Query Muyassar (1:1)", row is not None and len(row[0]) > 10, f"Snippet: {row[0][:45]}...")

    tc.execute("SELECT text FROM ayah_tafsir WHERE sura_no = 2 AND aya_no = 255 AND tafsir_type = 'saadi'")
    row = tc.fetchone()
    report("Ayat Al-Kursi Saadi (2:255)", row is not None and len(row[0]) > 50)

    tconn.close()

# -------------------------------------------------------------
# 2. QURAN DATABASE & SVG PAGES VERIFICATION
# -------------------------------------------------------------
print("\n--- 2. QURAN DATABASE & SVG REPOSITORY (604 PAGES) ---")
qconn = sqlite3.connect(quran_db_path)
qc = qconn.cursor()

qc.execute("PRAGMA integrity_check")
qinteg = qc.fetchone()[0]
report("Quran DB PRAGMA integrity_check", qinteg == 'ok')

qc.execute("SELECT count(*) FROM mushaf_svg_pages")
page_cnt = qc.fetchone()[0]
report("Total Mushaf SVG Pages", page_cnt == 604, f"Count: {page_cnt}/604")

# Check pages 1 and 2 for duplicate unboxed titles
qc.execute("SELECT svg_xml FROM mushaf_svg_pages WHERE page = 1")
p1_svg = qc.fetchone()[0]
report("Page 1 Stripped Unboxed Title", 'translate(197.29 406.52)' not in p1_svg, "Verified: translate(197.29 406.52) absent")

qc.execute("SELECT svg_xml FROM mushaf_svg_pages WHERE page = 2")
p2_svg = qc.fetchone()[0]
report("Page 2 Stripped Unboxed Title", 'translate(191.3 407.03)' not in p2_svg, "Verified: translate(191.3 407.03) absent")

# -------------------------------------------------------------
# 3. MULTI-SURAH PAGEHEADER LOGIC
# -------------------------------------------------------------
print("\n--- 3. MULTI-SURAH DETECTION & PAGEHEADER LOGIC ---")
def get_page_surah_names(cursor, page):
    cursor.execute("""
        SELECT DISTINCT s.sura_name_ar, MIN(a.id) as first_id
        FROM ayahs a
        JOIN surahs s ON a.sura_no = s.sura_no
        WHERE a.page = ?
        GROUP BY s.sura_no, s.sura_name_ar
        ORDER BY first_id ASC
    """, (page,))
    return [r[0] for r in cursor.fetchall()]

# Test Page 1 (Single Surah: Al-Fatihah)
p1_surahs = get_page_surah_names(qc, 1)
report("Page 1 Single Surah Detection", p1_surahs == ['الفَاتِحة'], f"Result: {p1_surahs}")

# Test Page 76 (Transition: Ali 'Imran ends on 76)
p76_surahs = get_page_surah_names(qc, 76)
report("Page 76 Surah Detection", len(p76_surahs) >= 1, f"Result: {p76_surahs}")

# Test Page 77 (An-Nisa begins on 77)
p77_surahs = get_page_surah_names(qc, 77)
report("Page 77 Surah Detection", p77_surahs == ['النِّسَاء'], f"Result: {p77_surahs}")

# Test Page 106 (Transition: An-Nisa ayah 176 + Al-Ma'idah ayahs 1-2)
p106_surahs = get_page_surah_names(qc, 106)
report("Page 106 Two-Surah Page Detection", p106_surahs == ['النِّسَاء', 'المَائدة'], f"Result: {p106_surahs}")

# Test Page 604 (Multi-Surah: Al-Ikhlas, Al-Falaq, An-Nas)
p604_surahs = get_page_surah_names(qc, 604)
report("Page 604 Three-Surah Page Detection", len(p604_surahs) == 3 and 'الفَلَق' in p604_surahs and 'النَّاس' in p604_surahs, f"Result: {p604_surahs}")

# -------------------------------------------------------------
# 4. NORMALIZER LOGIC VERIFICATION ON TEST PAGES (1 to 5)
# -------------------------------------------------------------
print("\n--- 4. AYAH NORMALIZER TEST CASES (Pages 1 to 5) ---")
expected_ayah_counts = {
    1: 7,
    2: 5,
    3: 11,
    4: 8,
    5: 5
}

for p, expected_count in expected_ayah_counts.items():
    qc.execute("SELECT raw_json, view_box FROM mushaf_svg_pages WHERE page = ?", (p,))
    row = qc.fetchone()
    raw_data = json.loads(row[0])
    actual_count = len(raw_data)
    report(f"Page {p:03d} Ayah Count in JSON", actual_count == expected_count, f"Got: {actual_count}, Expected: {expected_count}")

# -------------------------------------------------------------
# 5. TOUCH COORDINATES & HIT-TESTING MATH VERIFICATION
# -------------------------------------------------------------
print("\n--- 5. SVG HIT-TESTING & VIEWBOX MATH ---")

def map_touch_to_svg(touch_x, touch_y, container_w, container_h, vb_min_x, vb_min_y, vb_w, vb_h):
    scale = min(container_w / vb_w, container_h / vb_h)
    content_w = vb_w * scale
    content_h = vb_h * scale
    offset_x = (container_w - content_w) / 2
    offset_y = (container_h - content_h) / 2
    
    # Check bounds
    if touch_x < offset_x - 2 or touch_x > offset_x + content_w + 2 or \
       touch_y < offset_y - 2 or touch_y > offset_y + content_h + 2:
        return (float('nan'), float('nan'))
    
    svg_x = vb_min_x + (touch_x - offset_x) / scale
    svg_y = vb_min_y + (touch_y - offset_y) / scale
    return (svg_x, svg_y)

def point_in_poly(x, y, vertices):
    inside = False
    n = len(vertices)
    for i in range(n):
        j = (i - 1) % n
        xi, yi = vertices[i]
        xj, yj = vertices[j]
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
        if intersect:
            inside = not inside
    return inside

# Test negative viewBox mapping (Page 1: -10, 8, 258, 220)
# Container 375x600
pt = map_touch_to_svg(187.5, 300.0, 375, 600, -10, 8, 258, 220)
report("Negative ViewBox Touch Mapping", not math.isnan(pt[0]) and not math.isnan(pt[1]), f"Point: ({pt[0]:.2f}, {pt[1]:.2f})")

# Test Letterbox tap outside page
pt_outside = map_touch_to_svg(10, 10, 375, 600, -10, 8, 258, 220)
report("Letterbox Tap Rejection", math.isnan(pt_outside[0]), f"Result: {pt_outside}")

# Test point in polygon
poly = [[10, 10], [50, 10], [50, 50], [10, 50]]
report("Point Inside Polygon (Ray-Casting)", point_in_poly(30, 30, poly) is True)
report("Point Outside Polygon (Ray-Casting)", point_in_poly(5, 5, poly) is False)

qconn.close()

print("\n====================================================================")
if all_passed:
    print(" >>> ALL VERIFICATION SUITES PASSED WITH 100% SUCCESS <<<")
else:
    print(" >>> WARNING: SOME SUITES FAILED <<<")
print("====================================================================")
