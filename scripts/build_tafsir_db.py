import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path

EXPECTED_AYAH_COUNT = 6236
EXPECTED_SURAH_COUNT = 114
DATABASE_VERSION = 2


def validate_source(path: Path, label: str):
    if not path.is_file():
        raise FileNotFoundError(
            f"Missing {label} source: {path}\n"
            "Make sure the tafsir JSON files are present in the repository's tafsir directory."
        )

    with path.open("r", encoding="utf-8") as source_file:
        payload = json.load(source_file)

    surahs = payload.get("tafsir")
    if not isinstance(surahs, list) or len(surahs) != EXPECTED_SURAH_COUNT:
        raise ValueError(f"{label} JSON must contain a 'tafsir' array with 114 surahs.")

    rows = []
    for surah_index, ayahs in enumerate(surahs, start=1):
        if not isinstance(ayahs, list):
            raise ValueError(f"{label}: surah {surah_index} is not an ayah array.")

        for ayah_index, text in enumerate(ayahs, start=1):
            if not isinstance(text, str) or not text.strip():
                raise ValueError(
                    f"{label}: missing or empty text at {surah_index}:{ayah_index}."
                )
            rows.append((surah_index, ayah_index, label, text.strip()))

    if len(rows) != EXPECTED_AYAH_COUNT:
        raise ValueError(
            f"{label} has {len(rows)} ayah entries; expected {EXPECTED_AYAH_COUNT}."
        )

    return rows


def is_valid_database(database_path: Path):
    if not database_path.is_file():
        return False

    try:
        connection = sqlite3.connect(str(database_path))
        cursor = connection.cursor()

        cursor.execute("PRAGMA user_version")
        version = cursor.fetchone()[0]
        if version != DATABASE_VERSION:
            connection.close()
            return False

        cursor.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type = 'table' AND name = 'ayah_tafsir'"
        )
        if cursor.fetchone() is None:
            connection.close()
            return False

        for tafsir_type in ("saadi", "muyassar"):
            cursor.execute(
                "SELECT COUNT(*) FROM ayah_tafsir WHERE tafsir_type = ?",
                (tafsir_type,),
            )
            if cursor.fetchone()[0] != EXPECTED_AYAH_COUNT:
                connection.close()
                return False

        cursor.execute("PRAGMA integrity_check")
        integrity = cursor.fetchone()[0]
        connection.close()
        return integrity == "ok"
    except sqlite3.Error:
        return False


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
        if not is_valid_database(final_path):
            raise RuntimeError(
                f"{final_path} is missing, incomplete, or has an unsupported schema version."
            )
        print(f"[BuildTafsir] VALID: {final_path}")
        return

    if not force and is_valid_database(final_path):
        source_paths = [saadi_path, muyassar_path]
        sources_exist = all(path.is_file() for path in source_paths)
        if not sources_exist:
            print("[BuildTafsir] Existing version-2 database is valid; source JSON files are not required.")
            return

        newest_source_time = max(path.stat().st_mtime for path in source_paths)
        if final_path.stat().st_mtime >= newest_source_time:
            print("[BuildTafsir] Existing version-2 database is valid and up to date.")
            return

    print(f"[BuildTafsir] Building {final_path}")
    saadi_rows = validate_source(saadi_path, "saadi")
    muyassar_rows = validate_source(muyassar_path, "muyassar")
    all_rows = saadi_rows + muyassar_rows

    if len(all_rows) != EXPECTED_AYAH_COUNT * 2:
        raise ValueError("Combined tafsir dataset does not contain exactly 12,472 entries.")

    if temp_path.exists():
        temp_path.unlink()

    connection = sqlite3.connect(str(temp_path))
    try:
        cursor = connection.cursor()
        cursor.execute("PRAGMA page_size = 4096")
        cursor.execute("PRAGMA journal_mode = DELETE")
        cursor.execute("PRAGMA synchronous = FULL")

        cursor.executescript(
            """
            CREATE TABLE ayah_tafsir (
                id INTEGER PRIMARY KEY,
                sura_no INTEGER NOT NULL CHECK (sura_no BETWEEN 1 AND 114),
                aya_no INTEGER NOT NULL CHECK (aya_no >= 1),
                tafsir_type TEXT NOT NULL CHECK (tafsir_type IN ('saadi', 'muyassar')),
                text TEXT NOT NULL CHECK (length(trim(text)) > 0),
                UNIQUE (tafsir_type, sura_no, aya_no)
            );

            CREATE INDEX idx_tafsir_lookup
            ON ayah_tafsir (sura_no, aya_no, tafsir_type);
            """
        )

        cursor.executemany(
            """
            INSERT INTO ayah_tafsir (sura_no, aya_no, tafsir_type, text)
            VALUES (?, ?, ?, ?)
            """,
            all_rows,
        )

        cursor.execute("PRAGMA user_version = " + str(DATABASE_VERSION))
        connection.commit()

        for tafsir_type in ("saadi", "muyassar"):
            cursor.execute(
                "SELECT COUNT(*) FROM ayah_tafsir WHERE tafsir_type = ?",
                (tafsir_type,),
            )
            count = cursor.fetchone()[0]
            if count != EXPECTED_AYAH_COUNT:
                raise RuntimeError(
                    f"{tafsir_type} row count is {count}; expected {EXPECTED_AYAH_COUNT}."
                )

        cursor.execute(
            """
            SELECT text FROM ayah_tafsir
            WHERE sura_no = 1 AND aya_no = 1 AND tafsir_type = 'saadi'
            """
        )
        if not cursor.fetchone():
            raise RuntimeError("Could not read the Saadi Al-Fatihah sample.")

        cursor.execute(
            """
            SELECT text FROM ayah_tafsir
            WHERE sura_no = 1 AND aya_no = 1 AND tafsir_type = 'muyassar'
            """
        )
        if not cursor.fetchone():
            raise RuntimeError("Could not read the Muyassar Al-Fatihah sample.")

        cursor.execute("PRAGMA integrity_check")
        integrity = cursor.fetchone()[0]
        if integrity != "ok":
            raise RuntimeError("SQLite integrity_check failed: " + str(integrity))

        cursor.execute("VACUUM")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    os.replace(temp_path, final_path)

    if not is_valid_database(final_path):
        raise RuntimeError("The final tafsir.db failed post-build verification.")

    size_mb = final_path.stat().st_size / (1024 * 1024)
    print(
        f"[BuildTafsir] SUCCESS: {size_mb:.2f} MB, "
        f"{EXPECTED_AYAH_COUNT} entries per tafsir, schema version {DATABASE_VERSION}."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild the database even if the existing database is valid.",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Verify assets/data/tafsir.db without rebuilding it.",
    )
    args = parser.parse_args()

    try:
        build_tafsir_database(force=args.force, verify_only=args.verify_only)
    except Exception as error:
        print("[BuildTafsir] ERROR: " + str(error), file=sys.stderr)
        sys.exit(1)
