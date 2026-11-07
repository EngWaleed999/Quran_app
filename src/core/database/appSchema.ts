import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Application-owned tables live beside the bundled Quran reference data.
 * The Quran tables are read-only from feature code; only these tables are mutated.
 */
export async function initializeAppSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ayah_notes (
      verse_key TEXT PRIMARY KEY NOT NULL,
      sura_no INTEGER NOT NULL CHECK (sura_no BETWEEN 1 AND 114),
      aya_no INTEGER NOT NULL CHECK (aya_no > 0),
      page INTEGER NOT NULL CHECK (page BETWEEN 1 AND 604),
      sura_name TEXT NOT NULL DEFAULT '',
      ayah_text TEXT NOT NULL DEFAULT '',
      note_text TEXT NOT NULL CHECK (length(trim(note_text)) > 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ayah_notes_updated_at
      ON ayah_notes(updated_at DESC);

    CREATE TABLE IF NOT EXISTS khatmah_plans (
      id TEXT PRIMARY KEY NOT NULL,
      khatmah_count INTEGER NOT NULL CHECK (khatmah_count BETWEEN 1 AND 20),
      duration_days INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 3660),
      start_global_ayah INTEGER NOT NULL CHECK (start_global_ayah BETWEEN 1 AND 6236),
      total_ayahs INTEGER NOT NULL CHECK (total_ayahs > 0),
      completed_ayahs INTEGER NOT NULL DEFAULT 0
        CHECK (completed_ayahs >= 0 AND completed_ayahs <= total_ayahs),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_khatmah_plans_active
      ON khatmah_plans(is_active, created_at DESC);
  `);
}
