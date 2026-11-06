import os
import sqlite3
import json
import time

saddi_path = 'D:/Quran_App/tafsir/ar.saddi.json'
muyassar_path = 'D:/Quran_App/tafsir/ar.muyassar.json'
output_db_path = 'D:/Quran_App/assets/data/tafsir.db'

print(f"Building Tafsir SQLite database: {output_db_path}")

if os.path.exists(output_db_path):
    os.remove(output_db_path)

conn = sqlite3.connect(output_db_path)
cursor = conn.cursor()

cursor.execute("PRAGMA journal_mode = WAL")
cursor.execute("PRAGMA synchronous = NORMAL")
cursor.execute("PRAGMA page_size = 4096")

cursor.execute("""
CREATE TABLE IF NOT EXISTS ayah_tafsir (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sura_no INTEGER NOT NULL,
    aya_no INTEGER NOT NULL,
    tafsir_type TEXT NOT NULL,
    text TEXT NOT NULL
);
""")

cursor.execute("CREATE INDEX IF NOT EXISTS idx_tafsir_lookup ON ayah_tafsir (sura_no, aya_no, tafsir_type);")

# 1. Load Saadi
print("Loading ar.saddi.json...")
with open(saddi_path, 'r', encoding='utf-8') as f:
    saddi_data = json.load(f)

rows = []
for s_idx, sura in enumerate(saddi_data['tafsir']):
    sura_no = s_idx + 1
    for a_idx, text in enumerate(sura):
        aya_no = a_idx + 1
        rows.append((sura_no, aya_no, 'saadi', text.strip()))

print(f"Loaded {len(rows)} Saadi entries.")

# 2. Load Muyassar
print("Loading ar.muyassar.json...")
with open(muyassar_path, 'r', encoding='utf-8') as f:
    muyassar_data = json.load(f)

for s_idx, sura in enumerate(muyassar_data['tafsir']):
    sura_no = s_idx + 1
    for a_idx, text in enumerate(sura):
        aya_no = a_idx + 1
        rows.append((sura_no, aya_no, 'muyassar', text.strip()))

print(f"Total entries to insert: {len(rows)}")
cursor.executemany("INSERT INTO ayah_tafsir (sura_no, aya_no, tafsir_type, text) VALUES (?, ?, ?, ?)", rows)
conn.commit()

print("Running VACUUM...")
cursor.execute("VACUUM")
conn.close()

db_size_mb = os.path.getsize(output_db_path) / (1024 * 1024)
print(f"SUCCESS: Created {output_db_path} ({db_size_mb:.2f} MB) with {len(rows)} entries.")
