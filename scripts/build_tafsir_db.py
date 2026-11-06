import os
import sqlite3
import json
import time

def build_tafsir_database():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    tafsir_dir = os.path.join(base_dir, 'tafsir')
    saddi_path = os.path.join(tafsir_dir, 'ar.saddi.json')
    muyassar_path = os.path.join(tafsir_dir, 'ar.muyassar.json')
    output_dir = os.path.join(base_dir, 'assets', 'data')
    os.makedirs(output_dir, exist_ok=True)
    
    final_db_path = os.path.join(output_dir, 'tafsir.db')
    temp_db_path = os.path.join(output_dir, 'tafsir.db.tmp')

    print(f"[BuildTafsir] Base directory: {base_dir}")
    print(f"[BuildTafsir] Target database: {final_db_path}")

    if not os.path.exists(saddi_path):
        raise FileNotFoundError(f"Missing Saadi tafsir JSON at: {saddi_path}")
    if not os.path.exists(muyassar_path):
        raise FileNotFoundError(f"Missing Muyassar tafsir JSON at: {muyassar_path}")

    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)

    conn = sqlite3.connect(temp_db_path)
    cursor = conn.cursor()

    # Database configuration & performance pragmas
    cursor.execute("PRAGMA page_size = 4096")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA synchronous = NORMAL")

    # Create schema
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

    # 1. Load Saadi Tafsir
    print("[BuildTafsir] Loading ar.saddi.json...")
    with open(saddi_path, 'r', encoding='utf-8') as f:
        saddi_data = json.load(f)

    rows = []
    saadi_count = 0
    for s_idx, sura in enumerate(saddi_data['tafsir']):
        sura_no = s_idx + 1
        for a_idx, text in enumerate(sura):
            aya_no = a_idx + 1
            clean_text = text.strip()
            rows.append((sura_no, aya_no, 'saadi', clean_text))
            saadi_count += 1

    print(f"[BuildTafsir] Loaded {saadi_count} Saadi entries.")

    # 2. Load Muyassar Tafsir
    print("[BuildTafsir] Loading ar.muyassar.json...")
    with open(muyassar_path, 'r', encoding='utf-8') as f:
        muyassar_data = json.load(f)

    muyassar_count = 0
    for s_idx, sura in enumerate(muyassar_data['tafsir']):
        sura_no = s_idx + 1
        for a_idx, text in enumerate(sura):
            aya_no = a_idx + 1
            clean_text = text.strip()
            rows.append((sura_no, aya_no, 'muyassar', clean_text))
            muyassar_count += 1

    print(f"[BuildTafsir] Loaded {muyassar_count} Muyassar entries.")
    total_entries = len(rows)
    print(f"[BuildTafsir] Total entries to insert: {total_entries}")

    cursor.executemany(
        "INSERT INTO ayah_tafsir (sura_no, aya_no, tafsir_type, text) VALUES (?, ?, ?, ?)",
        rows
    )
    conn.commit()

    # Set user_version pragma for robust schema tracking
    cursor.execute("PRAGMA user_version = 1")
    conn.commit()

    # Run integrity check
    cursor.execute("PRAGMA integrity_check")
    integrity_result = cursor.fetchone()[0]
    if integrity_result != 'ok':
        conn.close()
        os.remove(temp_db_path)
        raise RuntimeError(f"Database integrity check failed: {integrity_result}")
    print("[BuildTafsir] PRAGMA integrity_check: OK")

    # Validate sample queries
    cursor.execute("SELECT count(*) FROM ayah_tafsir WHERE tafsir_type = 'saadi'")
    assert cursor.fetchone()[0] == 6236, "Saadi count mismatch!"
    cursor.execute("SELECT count(*) FROM ayah_tafsir WHERE tafsir_type = 'muyassar'")
    assert cursor.fetchone()[0] == 6236, "Muyassar count mismatch!"

    cursor.execute("SELECT text FROM ayah_tafsir WHERE sura_no = 1 AND aya_no = 1 AND tafsir_type = 'saadi'")
    sample_saadi = cursor.fetchone()
    assert sample_saadi and len(sample_saadi[0]) > 10, "Failed to fetch sample Saadi tafsir!"

    cursor.execute("SELECT text FROM ayah_tafsir WHERE sura_no = 1 AND aya_no = 1 AND tafsir_type = 'muyassar'")
    sample_muyassar = cursor.fetchone()
    assert sample_muyassar and len(sample_muyassar[0]) > 10, "Failed to fetch sample Muyassar tafsir!"

    print(f"[BuildTafsir] Sample Al-Fatihah 1 Saadi: {sample_saadi[0][:60]}...")
    print(f"[BuildTafsir] Sample Al-Fatihah 1 Muyassar: {sample_muyassar[0][:60]}...")

    # Compact database
    print("[BuildTafsir] Compacting with VACUUM...")
    cursor.execute("VACUUM")
    conn.close()

    # Atomically replace final file
    if os.path.exists(final_db_path):
        os.remove(final_db_path)
    os.replace(temp_db_path, final_db_path)

    final_size_mb = os.path.getsize(final_db_path) / (1024 * 1024)
    print(f"[BuildTafsir] SUCCESS: Created {final_db_path} ({final_size_mb:.2f} MB) with {total_entries} entries.")

if __name__ == '__main__':
    build_tafsir_database()
