import { SQLiteDatabase } from 'expo-sqlite';

export type TafsirBookId = 'saadi' | 'muyassar';

export interface TafsirBookInfo {
  id: TafsirBookId;
  name: string;
  author: string;
  description: string;
}

export const AVAILABLE_TAFSIRS: TafsirBookInfo[] = [
  {
    id: 'saadi',
    name: 'تفسير السعدي',
    author: 'الشيخ عبد الرحمن السعدي',
    description: 'تيسير الكريم الرحمن في تفسير كلام المنان',
  },
  {
    id: 'muyassar',
    name: 'التفسير الميسر',
    author: 'نخبة من العلماء',
    description: 'تفسير ميسر صادر عن مجمع الملك فهد',
  },
];

export class TafsirRepository {
  private static cache = new Map<string, string>();

  /**
   * Retrieves the tafsir for an ayah synchronously.
   */
  static getAyahTafsirSync(
    db: SQLiteDatabase,
    suraNo: number,
    ayaNo: number,
    tafsirType: TafsirBookId
  ): string {
    const cacheKey = `${suraNo}:${ayaNo}:${tafsirType}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const row = db.getFirstSync<{ text: string }>(
        'SELECT text FROM ayah_tafsir WHERE sura_no = ? AND aya_no = ? AND tafsir_type = ?',
        [suraNo, ayaNo, tafsirType]
      );

      const text = row?.text?.trim()
        ? row.text.trim()
        : row
        ? 'تفسير هذه الآية متصل بالآيات السابقة في هذا التفسير.'
        : 'لا يوجد تفسير متوفر لهذه الآية.';

      this.cache.set(cacheKey, text);
      return text;
    } catch (error) {
      console.error('[TafsirRepository] Sync query error:', error);
      return 'تعذر تحميل التفسير حالياً.';
    }
  }

  /**
   * Retrieves the tafsir for an ayah asynchronously.
   */
  static async getAyahTafsir(
    db: SQLiteDatabase,
    suraNo: number,
    ayaNo: number,
    tafsirType: TafsirBookId
  ): Promise<string> {
    const cacheKey = `${suraNo}:${ayaNo}:${tafsirType}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const row = await db.getFirstAsync<{ text: string }>(
        'SELECT text FROM ayah_tafsir WHERE sura_no = ? AND aya_no = ? AND tafsir_type = ?',
        [suraNo, ayaNo, tafsirType]
      );

      const text = row?.text?.trim()
        ? row.text.trim()
        : row
        ? 'تفسير هذه الآية متصل بالآيات السابقة في هذا التفسير.'
        : 'لا يوجد تفسير متوفر لهذه الآية.';

      this.cache.set(cacheKey, text);
      return text;
    } catch (error) {
      console.error('[TafsirRepository] Query error:', error);
      return 'تعذر تحميل التفسير حالياً.';
    }
  }
}
