import * as SQLite from 'expo-sqlite';

let tafsirDbInstance: SQLite.SQLiteDatabase | null = null;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Ensures the Tafsir SQLite database is available and valid.
 * High-resiliency design:
 * Uses the unified `quran.db` which contains `ayah_tafsir`.
 * Uses a singleton promise to eliminate race conditions.
 */
export function getTafsirDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (tafsirDbInstance) {
    return Promise.resolve(tafsirDbInstance);
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const quranDb = await SQLite.openDatabaseAsync('quran.db');
      tafsirDbInstance = quranDb;
      return quranDb;
    } catch (error) {
      console.error('[TafsirDatabase] Initialization error:', error);
      tafsirDbInstance = null;
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Resets cached instance.
 */
export async function resetTafsirDatabase(): Promise<void> {
  if (tafsirDbInstance) {
    try {
      await tafsirDbInstance.closeAsync();
    } catch {
      // ignore
    }
    tafsirDbInstance = null;
  }
  initializationPromise = null;
}
