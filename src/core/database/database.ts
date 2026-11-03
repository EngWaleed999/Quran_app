import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Initializes and opens the offline SQLite database.
 * Copies the pre-built `quran.db` asset into Expo's document directory if not already present.
 */
export async function getQuranDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbDir = `${FileSystem.documentDirectory}SQLite`;
  const dbPath = `${dbDir}/quran.db`;

  try {
    const dirInfo = await FileSystem.getInfoAsync(dbDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
    }

    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    if (!fileInfo.exists) {
      console.log('[Database] Bundled quran.db not found in storage. Copying from asset...');
      const dbAsset = Asset.fromModule(require('../../../assets/data/quran.db'));
      await dbAsset.downloadAsync();
      
      const sourceUri = dbAsset.localUri || dbAsset.uri;
      if (!sourceUri) {
        throw new Error('Failed to resolve asset URI for quran.db');
      }

      await FileSystem.copyAsync({
        from: sourceUri,
        to: dbPath,
      });
      console.log('[Database] quran.db successfully installed to:', dbPath);
    }

    dbInstance = await SQLite.openDatabaseAsync('quran.db');
    return dbInstance;
  } catch (error) {
    console.error('[Database] Error initializing Quran database:', error);
    throw error;
  }
}
