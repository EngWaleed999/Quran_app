import sqlite3
import os

quran_db_path = 'assets/data/quran.db'
tafsir_db_path = 'assets/data/tafsir.db'

print("Merging tafsir into quran.db...")
conn = sqlite3.connect(quran_db_path)
c = conn.cursor()

c.execute("PRAGMA journal_mode = WAL")
c.execute("PRAGMA synchronous = NORMAL")

# Create table
c.execute("""
CREATE TABLE IF NOT EXISTS ayah_tafsir (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sura_no INTEGER NOT NULL,
    aya_no INTEGER NOT NULL,
    tafsir_type TEXT NOT NULL,
    text TEXT NOT NULL
);
""")

c.execute("DELETE FROM ayah_tafsir")

# Read from tafsir.db
tconn = sqlite3.connect(tafsir_db_path)
tc = tconn.cursor()
tc.execute("SELECT sura_no, aya_no, tafsir_type, text FROM ayah_tafsir")
rows = tc.fetchall()
tconn.close()

print(f"Read {len(rows)} rows from tafsir.db. Inserting into quran.db...")
c.executemany("INSERT INTO ayah_tafsir (sura_no, aya_no, tafsir_type, text) VALUES (?, ?, ?, ?)", rows)
c.execute("CREATE INDEX IF NOT EXISTS idx_tafsir_lookup ON ayah_tafsir (sura_no, aya_no, tafsir_type)")
conn.commit()

c.execute("SELECT count(*) FROM ayah_tafsir")
cnt = c.fetchone()[0]
print(f"Total rows in quran.db ayah_tafsir: {cnt}")

print("Running VACUUM on quran.db...")
c.execute("VACUUM")
conn.close()

size_mb = os.path.getsize(quran_db_path) / (1024 * 1024)
print(f"SUCCESS: quran.db now contains ayah_tafsir! Total size: {size_mb:.2f} MB")
