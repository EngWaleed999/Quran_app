import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as SQLite from 'expo-sqlite';

let tafsirDbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Initializes and opens the offline Tafsir SQLite database.
 * Copies the pre-built `tafsir.db` asset into Expo's document directory if not already present.
 */
export async function getTafsirDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (tafsirDbInstance) {
    return tafsirDbInstance;
  }

  const dbDir = `${FileSystem.documentDirectory}SQLite`;
  const dbPath = `${dbDir}/tafsir.db`;

  try {
    const dirInfo = await FileSystem.getInfoAsync(dbDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
    }

    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    if (!fileInfo.exists) {
      console.log('[TafsirDatabase] Installing tafsir.db asset...');
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
      console.log('[TafsirDatabase] tafsir.db successfully installed to:', dbPath);
    }

    tafsirDbInstance = await SQLite.openDatabaseAsync('tafsir.db');
    return tafsirDbInstance;
  } catch (error) {
    console.error('[TafsirDatabase] Error initializing Tafsir database:', error);
    throw error;
  }
}
