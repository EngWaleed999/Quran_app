import os
import sqlite3
import json
import argparse
from pathlib import Path

EXPECTED_AYAH_COUNT = 6236
EXPECTED_SURAH_COUNT = 114
DATABASE_VERSION = 1

def validate_source(path: Path, label: str):
    if not path.is_file():
        raise FileNotFoundError(f"Missing {label} source file at: {path}")

    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    surahs = payload.get("tafsir")
    if not isinstance(surahs, list) or len(surahs) != EXPECTED_SURAH_COUNT:
        raise ValueError(f"{label} JSON must contain 'tafsir' array with 114 surahs.")

    rows = []
    for surah_idx, ayahs in enumerate(surahs, start=1):
        if not isinstance(ayahs, list):
            raise ValueError(f"{label}: surah {surah_idx} is not an ayah array.")

        for ayah_idx, text in enumerate(ayahs, start=1):
            if not isinstance(text, str):
                raise ValueError(f"{label}: text at {surah_idx}:{ayah_idx} is not a string.")
            rows.append((surah_idx, ayah_idx, label, text.strip()))

    if len(rows) != EXPECTED_AYAH_COUNT:
        raise ValueError(f"{label} has {len(rows)} ayahs; expected {EXPECTED_AYAH_COUNT}.")

    return rows

def build_tafsir_database(force: bool = False, verify_only: bool = False):
    project_dir = Path(__file__).resolve().parent.parent
    tafsir_dir = project_dir / "tafsir"
    saadi_path = tafsir_dir / "ar.saddi.json"
    muyassar_path = tafsir_dir / "ar.muyassar.json"
    output_dir = project_dir / "assets" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    final_path = output_dir / "tafsir.db"
    temp_path = output_dir / "tafsir.db.tmp"

    if verify_only:
        if not final_path.is_file():
            raise FileNotFoundError(f"Missing tafsir.db at: {final_path}")
        conn = sqlite3.connect(str(final_path))
        c = conn.cursor()
        c.execute("PRAGMA integrity_check")
        integ = c.fetchone()[0]
        c.execute("PRAGMA user_version")
        ver = c.fetchone()[0]
        c.execute("SELECT count(*) FROM ayah_tafsir WHERE tafsir_type = 'saadi'")
        s_cnt = c.fetchone()[0]
        c.execute("SELECT count(*) FROM ayah_tafsir WHERE tafsir_type = 'muyassar'")
        m_cnt = c.fetchone()[0]
        conn.close()
        print(f"[BuildTafsir] Verification OK: version={ver}, integrity={integ}, saadi={s_cnt}, muyassar={m_cnt}")
        return

    print(f"[BuildTafsir] Loading and validating sources...")
    saadi_rows = validate_source(saadi_path, "saadi")
    muyassar_rows = validate_source(muyassar_path, "muyassar")
    all_rows = saadi_rows + muyassar_rows
    print(f"[BuildTafsir] Loaded {len(saadi_rows)} Saadi + {len(muyassar_rows)} Muyassar = {len(all_rows)} total rows.")

    if temp_path.exists():
        temp_path.unlink()

    conn = sqlite3.connect(str(temp_path))
    cursor = conn.cursor()

    cursor.execute("PRAGMA page_size = 4096")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA synchronous = NORMAL")

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS ayah_tafsir (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sura_no INTEGER NOT NULL,
            aya_no INTEGER NOT NULL,
            tafsir_type TEXT NOT NULL,
            text TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tafsir_lookup
        ON ayah_tafsir (sura_no, aya_no, tafsir_type);
    """)

    cursor.executemany(
        "INSERT INTO ayah_tafsir (sura_no, aya_no, tafsir_type, text) VALUES (?, ?, ?, ?)",
        all_rows
    )
    cursor.execute(f"PRAGMA user_version = {DATABASE_VERSION}")
    conn.commit()

    # Integrity check
    cursor.execute("PRAGMA integrity_check")
    integ = cursor.fetchone()[0]
    if integ != 'ok':
        conn.close()
        temp_path.unlink()
        raise RuntimeError(f"Database integrity check failed: {integ}")

    print("[BuildTafsir] PRAGMA integrity_check: ok")

    # Sample query checks
    cursor.execute("SELECT text FROM ayah_tafsir WHERE sura_no = 1 AND aya_no = 1 AND tafsir_type = 'saadi'")
    sample_saadi = cursor.fetchone()[0]
    cursor.execute("SELECT text FROM ayah_tafsir WHERE sura_no = 1 AND aya_no = 1 AND tafsir_type = 'muyassar'")
    sample_muyassar = cursor.fetchone()[0]
    print(f"[BuildTafsir] Sample Saadi 1:1: {sample_saadi[:45]}...")
    print(f"[BuildTafsir] Sample Muyassar 1:1: {sample_muyassar[:45]}...")

    print("[BuildTafsir] Running VACUUM...")
    cursor.execute("VACUUM")
    conn.close()

    # Atomically replace final file
    if final_path.exists():
        final_path.unlink()
    temp_path.rename(final_path)

    final_size_mb = os.path.getsize(str(final_path)) / (1024 * 1024)
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
        print("[BuildTafsir] Unified quran.db successfully synchronized!")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Build offline tafsir SQLite database.")
    parser.add_argument("--force", action="store_true", help="Force rebuild")
    parser.add_argument("--verify-only", action="store_true", help="Verify existing database only")
    args = parser.parse_args()
    build_tafsir_database(force=args.force, verify_only=args.verify_only)
