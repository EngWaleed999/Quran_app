import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens the persistent application database.
 *
 * SQLiteProvider seeds this database from the bundled full Quran asset only
 * when it is first installed. Never replace an existing file based on size:
 * it may already contain user notes and Khatmah progress.
 */
export function getQuranDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (initializationPromise) return initializationPromise;

  initializationPromise = SQLite.openDatabaseAsync('quran.db')
    .then((db) => {
      dbInstance = db;
      return db;
    })
    .finally(() => {
      initializationPromise = null;
    });

  return initializationPromise;
}

export async function closeQuranDatabase(): Promise<void> {
  const db = dbInstance;
  dbInstance = null;
  if (!db) return;
  await db.closeAsync();
}
