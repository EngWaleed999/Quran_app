import re
from pathlib import Path

path = Path('scripts/build_tafsir_db.py')
text = path.read_text(encoding='utf-8')

target = """    final_size_mb = os.path.getsize(str(final_path)) / (1024 * 1024)
    print(f"[BuildTafsir] SUCCESS: Rebuilt {final_path} ({final_size_mb:.2f} MB) with {len(all_rows)} entries.")"""

replacement = """    final_size_mb = os.path.getsize(str(final_path)) / (1024 * 1024)
    print(f"[BuildTafsir] SUCCESS: Rebuilt {final_path} ({final_size_mb:.2f} MB) with {len(all_rows)} entries.")

    quran_db_path = output_dir / "quran.db"
    if quran_db_path.is_file():
        print(f"[BuildTafsir] Synchronizing ayah_tafsir into unified {quran_db_path.name}...")
        qconn = sqlite3.connect(str(quran_db_path))
        qc = qconn.cursor()
        qc.executescript('''
            CREATE TABLE IF NOT EXISTS ayah_tafsir (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sura_no INTEGER NOT NULL,
                aya_no INTEGER NOT NULL,
                tafsir_type TEXT NOT NULL,
                text TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tafsir_lookup
            ON ayah_tafsir (sura_no, aya_no, tafsir_type);
        ''')
        qc.execute("DELETE FROM ayah_tafsir;")
        qc.executemany(
            "INSERT INTO ayah_tafsir (sura_no, aya_no, tafsir_type, text) VALUES (?, ?, ?, ?)",
            all_rows
        )
        qconn.commit()
        qconn.close()
        print("[BuildTafsir] Unified quran.db successfully synchronized!")"""

if target in text:
    text = text.replace(target, replacement, 1)
    path.write_text(text, encoding='utf-8')
    print("Successfully updated scripts/build_tafsir_db.py")
else:
    print("Target not found!")
