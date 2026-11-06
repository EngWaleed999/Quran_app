import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as SQLite from 'expo-sqlite';

let tafsirDbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const EXPECTED_USER_VERSION = 1;
const MIN_EXPECTED_SIZE_BYTES = 10 * 1024 * 1024; // ~10MB minimum for ~29MB DB

/**
 * Validates whether an installed SQLite database file contains the valid schema
 * and user_version required for Tafsir queries.
 */
async function validateInstalledTafsirDb(dbName: string): Promise<boolean> {
  let tempDb: SQLite.SQLiteDatabase | null = null;
  try {
    tempDb = await SQLite.openDatabaseAsync(dbName);
    
    // Check if table exists
    const tableRow = await tempDb.getFirstAsync<{ count: number }>(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='ayah_tafsir'"
    );
    if (!tableRow || tableRow.count === 0) {
      console.warn('[TafsirDatabase] Table ayah_tafsir does not exist in installed DB.');
      await tempDb.closeAsync();
      return false;
    }

    // Check user_version
    const versionRow = await tempDb.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version'
    );
    if (!versionRow || versionRow.user_version < EXPECTED_USER_VERSION) {
      console.warn(`[TafsirDatabase] Version mismatch: expected >= ${EXPECTED_USER_VERSION}, got ${versionRow?.user_version}`);
      await tempDb.closeAsync();
      return false;
    }

    // Check that table has data
    const countRow = await tempDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM ayah_tafsir'
    );
    if (!countRow || countRow.count < 1000) {
      console.warn(`[TafsirDatabase] Insufficient rows in ayah_tafsir: ${countRow?.count}`);
      await tempDb.closeAsync();
      return false;
    }

    await tempDb.closeAsync();
    return true;
  } catch (err) {
    console.warn('[TafsirDatabase] Error validating installed tafsir db:', err);
    if (tempDb) {
      try {
        await tempDb.closeAsync();
      } catch {
        // Ignore close error on corrupted DB
      }
    }
    return false;
  }
}

/**
 * Ensures the Tafsir SQLite database is properly copied from bundled assets
 * into Expo's document directory and returns an open SQLiteDatabase instance.
 * Thread-safe: utilizes a singleton promise to eliminate concurrency race conditions.
 */
export function getTafsirDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (tafsirDbInstance) {
    return Promise.resolve(tafsirDbInstance);
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const dbDir = `${FileSystem.documentDirectory}SQLite`;
    const dbName = 'tafsir.db';
    const dbPath = `${dbDir}/${dbName}`;

    try {
      const dirInfo = await FileSystem.getInfoAsync(dbDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
      }

      const fileInfo = await FileSystem.getInfoAsync(dbPath);
      let needsCopy = !fileInfo.exists;

      if (fileInfo.exists) {
        // Check size
        if ('size' in fileInfo && (fileInfo.size ?? 0) < MIN_EXPECTED_SIZE_BYTES) {
          console.warn(`[TafsirDatabase] Existing DB file is undersized (${fileInfo.size} bytes). Scheduling re-copy.`);
          needsCopy = true;
        } else {
          // Validate schema
          const isValid = await validateInstalledTafsirDb(dbName);
          if (!isValid) {
            console.warn('[TafsirDatabase] Existing DB validation failed. Reinstalling from asset...');
            needsCopy = true;
          }
        }
      }

      if (needsCopy) {
        console.log('[TafsirDatabase] Copying fresh tafsir.db asset...');
        if (fileInfo.exists) {
          try {
            await FileSystem.deleteAsync(dbPath, { idempotent: true });
          } catch (delErr) {
            console.warn('[TafsirDatabase] Could not delete old DB file:', delErr);
          }
        }

        const dbAsset = Asset.fromModule(require('../../../assets/data/tafsir.db'));
        await dbAsset.downloadAsync();

        const sourceUri = dbAsset.localUri || dbAsset.uri;
        if (!sourceUri) {
          throw new Error('Failed to resolve asset URI for tafsir.db');
        }

        await FileSystem.copyAsync({
          from: sourceUri,
          to: dbPath,
        });
        console.log('[TafsirDatabase] tafsir.db successfully copied to:', dbPath);
      }

      tafsirDbInstance = await SQLite.openDatabaseAsync(dbName);
      return tafsirDbInstance;
    } catch (error) {
      console.error('[TafsirDatabase] Failed to initialize Tafsir database:', error);
      tafsirDbInstance = null;
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Resets the Tafsir database connection and forces re-validation on next access.
 */
export async function resetTafsirDatabase(): Promise<void> {
  if (tafsirDbInstance) {
    try {
      await tafsirDbInstance.closeAsync();
    } catch {
      // Ignore
    }
    tafsirDbInstance = null;
  }
  initPromise = null;
}
