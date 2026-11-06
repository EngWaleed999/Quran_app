import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'tafsir.db';
const EXPECTED_USER_VERSION = 2;
const EXPECTED_ROWS_PER_TAFSIR = 6236;
const REQUIRED_COLUMNS = ['id', 'sura_no', 'aya_no', 'tafsir_type', 'text'];

let tafsirDbInstance: SQLite.SQLiteDatabase | null = null;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

interface DatabaseValidation {
  valid: boolean;
  reason?: string;
}

async function validateDatabase(database: SQLite.SQLiteDatabase): Promise<DatabaseValidation> {
  try {
    const table = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ayah_tafsir' LIMIT 1"
    );

    if (!table) {
      return { valid: false, reason: 'Missing table ayah_tafsir' };
    }

    const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(ayah_tafsir)');
    const columnNames = new Set(columns.map((column) => column.name));

    for (const requiredColumn of REQUIRED_COLUMNS) {
      if (!columnNames.has(requiredColumn)) {
        return { valid: false, reason: 'Missing column: ' + requiredColumn };
      }
    }

    const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (!version || version.user_version !== EXPECTED_USER_VERSION) {
      return {
        valid: false,
        reason: 'Unsupported database version: ' + String(version?.user_version ?? 0),
      };
    }

    const counts = await database.getAllAsync<{ tafsir_type: string; total: number }>(
      'SELECT tafsir_type, COUNT(*) AS total FROM ayah_tafsir GROUP BY tafsir_type'
    );

    const countByType = new Map(counts.map((row) => [row.tafsir_type, row.total]));
    if (countByType.get('saadi') !== EXPECTED_ROWS_PER_TAFSIR) {
      return { valid: false, reason: 'Saadi dataset is incomplete' };
    }
    if (countByType.get('muyassar') !== EXPECTED_ROWS_PER_TAFSIR) {
      return { valid: false, reason: 'Muyassar dataset is incomplete' };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : 'Unknown SQLite validation error',
    };
  }
}

async function validateInstalledDatabase(databaseName: string): Promise<DatabaseValidation> {
  let database: SQLite.SQLiteDatabase | null = null;

  try {
    database = await SQLite.openDatabaseAsync(databaseName);
    return await validateDatabase(database);
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : 'Could not open installed database',
    };
  } finally {
    if (database) {
      try {
        await database.closeAsync();
      } catch {
        // The handle may already have been closed by SQLite.
      }
    }
  }
}

async function deleteDatabaseFiles(databasePath: string): Promise<void> {
  const files = [databasePath, databasePath + '-wal', databasePath + '-shm'];

  for (const file of files) {
    await FileSystem.deleteAsync(file, { idempotent: true }).catch(() => undefined);
  }
}

async function installBundledDatabase(databasePath: string): Promise<void> {
  const asset = Asset.fromModule(require('../../../assets/data/tafsir.db'));
  await asset.downloadAsync();

  const sourceUri = asset.localUri || asset.uri;
  if (!sourceUri) {
    throw new Error('The bundled tafsir.db asset has no readable URI.');
  }

  await deleteDatabaseFiles(databasePath);
  await FileSystem.copyAsync({ from: sourceUri, to: databasePath });

  const validation = await validateInstalledDatabase(DATABASE_NAME);
  if (!validation.valid) {
    await deleteDatabaseFiles(databasePath);
    throw new Error(
      'The bundled tafsir.db is invalid (' + validation.reason +
      '). Run "pnpm run tafsir:build" and restart Metro.'
    );
  }
}

/**
 * Opens the offline Tafsir database.
 *
 * The installed database is validated by schema version and exact row counts.
 * A stale or incomplete database is replaced atomically from the bundled asset.
 * A single shared promise prevents simultaneous Modal opens from racing the installer.
 */
export function getTafsirDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (tafsirDbInstance) {
    return Promise.resolve(tafsirDbInstance);
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const directory = FileSystem.documentDirectory + 'SQLite';
    const databasePath = directory + '/' + DATABASE_NAME;

    try {
      const directoryInfo = await FileSystem.getInfoAsync(directory);
      if (!directoryInfo.exists) {
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      }

      const fileInfo = await FileSystem.getInfoAsync(databasePath);
      let shouldInstall = !fileInfo.exists;

      if (fileInfo.exists) {
        const installedValidation = await validateInstalledDatabase(DATABASE_NAME);
        if (!installedValidation.valid) {
          console.warn(
            '[TafsirDatabase] Replacing stale database: ' + installedValidation.reason
          );
          shouldInstall = true;
        }
      }

      if (shouldInstall) {
        await installBundledDatabase(databasePath);
      }

      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      const finalValidation = await validateDatabase(database);

      if (!finalValidation.valid) {
        await database.closeAsync();
        throw new Error(
          'Tafsir database validation failed: ' + finalValidation.reason
        );
      }

      tafsirDbInstance = database;
      return database;
    } catch (error) {
      tafsirDbInstance = null;
      console.error('[TafsirDatabase] Initialization failed:', error);
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

export async function resetTafsirDatabase(): Promise<void> {
  if (tafsirDbInstance) {
    try {
      await tafsirDbInstance.closeAsync();
    } catch {
      // Ignore close failures while resetting a stale native handle.
    }
    tafsirDbInstance = null;
  }

  initializationPromise = null;
}
