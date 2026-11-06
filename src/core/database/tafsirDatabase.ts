import * as SQLite from 'expo-sqlite';

let tafsirDbInstance: SQLite.SQLiteDatabase | null = null;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Ensures the Tafsir SQLite database is available and valid.
 * High-resiliency design:
 * 1. Checks if the primary `quran.db` already contains `ayah_tafsir` (unified database).
 * 2. If not, falls back to standalone `tafsir.db` using expo-sqlite's native importer.
 * 3. Uses a singleton promise to eliminate race conditions.
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
      // 1. Primary Strategy: Check quran.db (already loaded and managed by SQLiteProvider)
      try {
        const quranDb = await SQLite.openDatabaseAsync('quran.db');
        const hasTable = await quranDb.getFirstAsync<{ count: number }>(
          "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='ayah_tafsir'"
        );
        if (hasTable && hasTable.count > 0) {
          tafsirDbInstance = quranDb;
          return quranDb;
        }
      } catch (err) {
        console.warn('[TafsirDatabase] Primary quran.db lookup warning:', err);
      }

      // 2. Fallback Strategy: Standalone tafsir.db
      try {
        if ('importDatabaseFromAssetAsync' in SQLite) {
          await (SQLite as any).importDatabaseFromAssetAsync('tafsir.db', {
            assetId: require('../../../assets/data/tafsir.db'),
            forceOverwrite: false,
          });
        }
      } catch (importErr) {
        console.warn('[TafsirDatabase] importDatabaseFromAssetAsync warning:', importErr);
      }

      const db = await SQLite.openDatabaseAsync('tafsir.db');
      tafsirDbInstance = db;
      return db;
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
