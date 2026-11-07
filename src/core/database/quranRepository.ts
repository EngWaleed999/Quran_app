import { SQLiteDatabase } from 'expo-sqlite';
import { Ayah } from '../../features/mushaf/types/mushaf.types';
import { Surah, JuzItem, AyahSearchResult } from '../../features/surah-list/types/surah.types';

export class QuranRepository {
  private static pageCache = new Map<number, Ayah[]>();
  private static surahAyahCache = new Map<number, Ayah[]>();
  private static surahAyahCounts = new Map<number, number>();
  private static surahPageMap = new Map<number, number>();
  private static surahGlobalOffsets = new Map<number, number>();
  private static surahCatalogCache: Surah[] | null = null;
  private static isWarmedUp = false;

  static getSurahStartPage(db: SQLiteDatabase, suraNo: number): number {
    if (QuranRepository.surahPageMap.has(suraNo)) {
      return QuranRepository.surahPageMap.get(suraNo)!;
    }
    try {
      const row = db.getFirstSync<{ page_start: number }>(
        'SELECT page_start FROM surahs WHERE sura_no = ?',
        [suraNo]
      );
      const page = row?.page_start ?? 1;
      QuranRepository.surahPageMap.set(suraNo, page);
      return page;
    } catch {
      return 1;
    }
  }

  static getAllSurahsSync(db: SQLiteDatabase): Surah[] {
    if (QuranRepository.surahCatalogCache) {
      return QuranRepository.surahCatalogCache;
    }
    try {
      const rows = db.getAllSync<Surah>('SELECT * FROM surahs ORDER BY sura_no ASC');
      QuranRepository.surahCatalogCache = rows;
      rows.forEach((surah) => QuranRepository.surahPageMap.set(surah.sura_no, surah.page_start));
      return rows;
    } catch {
      return [];
    }
  }

  static getSurahsStartingOnPage(db: SQLiteDatabase, page: number): Surah[] {
    return QuranRepository.getAllSurahsSync(db).filter((surah) => surah.page_start === page);
  }

  static getSurahStartingOnPage(db: SQLiteDatabase, page: number): Surah | null {
    return QuranRepository.getSurahStartingOnPageCompat(db, page);
  }

  private static getSurahStartingOnPageCompat(db: SQLiteDatabase, page: number): Surah | null {
    const surahs = QuranRepository.getAllSurahsSync(db);
    return surahs.find((surah) => surah.page_start === page) || null;
  }

  static getPageSurahNamesSync(db: SQLiteDatabase, page: number): string[] {
    const ayahs = QuranRepository.getPageAyahsSync(db, page);
    if (!ayahs.length) return [];

    const names: string[] = [];
    const seen = new Set<string>();

    for (const ayah of ayahs) {
      const name = ayah.sura_name_ar?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }

    return names;
  }

  static getSurahAyahCount(db: SQLiteDatabase, suraNo: number): number {
    if (QuranRepository.surahAyahCounts.has(suraNo)) {
      return QuranRepository.surahAyahCounts.get(suraNo)!;
    }

    try {
      const rows = db.getAllSync<{ sura_no: number; ayahs_count: number }>(
        'SELECT sura_no, ayahs_count FROM surahs'
      );
      for (const row of rows) {
        QuranRepository.surahAyahCounts.set(row.sura_no, row.ayahs_count);
      }
      return QuranRepository.surahAyahCounts.get(suraNo) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Returns every ayah in a surah in canonical reading order. Used to create
   * the local audio playlist and to download the complete surah for offline use.
   */
  static getSurahAyahsSync(db: SQLiteDatabase, suraNo: number): Ayah[] {
    const cached = QuranRepository.surahAyahCache.get(suraNo);
    if (cached) return cached;

    try {
      const rows = db.getAllSync<Ayah>(
        `SELECT a.*, s.sura_name_ar
         FROM ayahs a
         JOIN surahs s ON a.sura_no = s.sura_no
         WHERE a.sura_no = ?
         ORDER BY a.aya_no ASC`,
        [suraNo]
      );
      QuranRepository.surahAyahCache.set(suraNo, rows);
      return rows;
    } catch (error) {
      console.warn('[QuranRepository] getSurahAyahsSync error:', error);
      return [];
    }
  }

  /**
   * Al Quran Cloud uses one global ayah index (1-6236), not the local number
   * within a surah. Derive it from the surah catalog instead of assuming that
   * a local SQLite primary key happens to match the CDN's numbering.
   */
  /** Resolve a canonical global ayah number (1-6236) to its Mushaf location. */
  static getAyahByGlobalNumberSync(db: SQLiteDatabase, globalAyahNo: number): Ayah | null {
    if (!Number.isInteger(globalAyahNo) || globalAyahNo < 1 || globalAyahNo > 6236) {
      return null;
    }

    try {
      return db.getFirstSync<Ayah>(
        `SELECT a.*, s.sura_name_ar
         FROM ayahs a
         JOIN surahs s ON a.sura_no = s.sura_no
         WHERE (
           SELECT COALESCE(SUM(previous.ayahs_count), 0)
           FROM surahs previous
           WHERE previous.sura_no < a.sura_no
         ) + a.aya_no = ?
         LIMIT 1`,
        [globalAyahNo]
      );
    } catch (error) {
      console.warn('[QuranRepository] getAyahByGlobalNumberSync error:', error);
      return null;
    }
  }

  static getGlobalAyahNumberSync(
    db: SQLiteDatabase,
    suraNo: number,
    ayaNo: number
  ): number {
    let offset = QuranRepository.surahGlobalOffsets.get(suraNo);

    if (offset === undefined) {
      const row = db.getFirstSync<{ offset: number }>(
        'SELECT COALESCE(SUM(ayahs_count), 0) AS offset FROM surahs WHERE sura_no < ?',
        [suraNo]
      );
      offset = row?.offset ?? 0;
      QuranRepository.surahGlobalOffsets.set(suraNo, offset);
    }

    const globalNumber = offset + ayaNo;
    if (!Number.isInteger(globalNumber) || globalNumber < 1 || globalNumber > 6236) {
      throw new Error('Invalid global ayah number for ' + suraNo + ':' + ayaNo);
    }

    return globalNumber;
  }

  /**
   * Returns the Quran page number (1-604) for a given surah and ayah.
   */
  static getAyahPageSync(
    db: SQLiteDatabase,
    suraNo: number,
    ayaNo: number
  ): number | null {
    try {
      const row = db.getFirstSync<{ page: number }>(
        'SELECT page FROM ayahs WHERE sura_no = ? AND aya_no = ? LIMIT 1',
        [suraNo, ayaNo]
      );
      return row?.page ?? null;
    } catch {
      return null;
    }
  }

  static warmupCache(db: SQLiteDatabase): void {
    if (QuranRepository.isWarmedUp) return;
    try {
      const rows = db.getAllSync<Ayah>(
        `SELECT a.*, s.sura_name_ar
         FROM ayahs a
         JOIN surahs s ON a.sura_no = s.sura_no
         ORDER BY a.page ASC, a.id ASC`
      );

      for (const row of rows) {
        let pageAyahs = QuranRepository.pageCache.get(row.page);
        if (!pageAyahs) {
          pageAyahs = [];
          QuranRepository.pageCache.set(row.page, pageAyahs);
        }
        pageAyahs.push(row);
      }
      QuranRepository.isWarmedUp = true;
    } catch (error) {
      console.warn('[QuranRepository] warmupCache error:', error);
    }
  }

  static getPageAyahsSync(db: SQLiteDatabase, page: number): Ayah[] {
    const cached = QuranRepository.pageCache.get(page);
    if (cached) return cached;

    try {
      const rows = db.getAllSync<Ayah>(
        `SELECT a.*, s.sura_name_ar
         FROM ayahs a
         JOIN surahs s ON a.sura_no = s.sura_no
         WHERE a.page = ?
         ORDER BY a.id ASC`,
        [page]
      );
      QuranRepository.pageCache.set(page, rows);
      return rows;
    } catch (error) {
      console.warn('[QuranRepository] getPageAyahsSync error on page ' + page + ':', error);
      return [];
    }
  }

  static preloadPages(db: SQLiteDatabase, centerPage: number, radius = 5): void {
    const minPage = Math.max(1, centerPage - radius);
    const maxPage = Math.min(604, centerPage + radius);

    for (let page = minPage; page <= maxPage; page += 1) {
      if (QuranRepository.pageCache.has(page)) continue;

      try {
        const rows = db.getAllSync<Ayah>(
          `SELECT a.*, s.sura_name_ar
           FROM ayahs a
           JOIN surahs s ON a.sura_no = s.sura_no
           WHERE a.page = ?
           ORDER BY a.id ASC`,
          [page]
        );
        QuranRepository.pageCache.set(page, rows);
      } catch {
        // Background preloading is best-effort.
      }
    }
  }

  static async getPageAyahs(db: SQLiteDatabase, page: number): Promise<Ayah[]> {
    const cached = QuranRepository.pageCache.get(page);
    if (cached) return cached;

    const rows = await db.getAllAsync<Ayah>(
      `SELECT a.*, s.sura_name_ar
       FROM ayahs a
       JOIN surahs s ON a.sura_no = s.sura_no
       WHERE a.page = ?
       ORDER BY a.id ASC`,
      [page]
    );
    QuranRepository.pageCache.set(page, rows);
    return rows;
  }

  static async getAllSurahs(db: SQLiteDatabase): Promise<Surah[]> {
    return db.getAllAsync<Surah>('SELECT * FROM surahs ORDER BY sura_no ASC');
  }

  static async getSurah(db: SQLiteDatabase, suraNo: number): Promise<Surah | null> {
    const row = await db.getFirstAsync<Surah>(
      'SELECT * FROM surahs WHERE sura_no = ?',
      [suraNo]
    );
    return row || null;
  }

  static async searchAyahs(
    db: SQLiteDatabase,
    query: string,
    limit = 40
  ): Promise<AyahSearchResult[]> {
    if (!query || !query.trim()) return [];

    const rows = await db.getAllAsync<AyahSearchResult>(
      `SELECT a.id, a.sura_no, s.sura_name_ar, a.page, a.aya_no, a.aya_text_emlaey
       FROM ayahs a
       JOIN surahs s ON a.sura_no = s.sura_no
       WHERE a.aya_text_emlaey LIKE ?
       ORDER BY a.id ASC
       LIMIT ?`,
      ['%' + query.trim() + '%', limit]
    );
    return rows;
  }

  static async getJuzList(db: SQLiteDatabase): Promise<JuzItem[]> {
    return db.getAllAsync<JuzItem>(
      `SELECT
         a.jozz,
         a.sura_no,
         s.sura_name_ar,
         a.page AS page_start,
         a.aya_no AS ayah_start,
         substr(a.aya_text_emlaey, 1, 60) AS snippet
       FROM ayahs a
       JOIN surahs s ON a.sura_no = s.sura_no
       WHERE a.id IN (SELECT MIN(id) FROM ayahs GROUP BY jozz)
       ORDER BY a.jozz ASC`
    );
  }

  static async getAyahsRange(
    db: SQLiteDatabase,
    suraNo: number,
    startAyah: number,
    endAyah: number
  ): Promise<Ayah[]> {
    return db.getAllAsync<Ayah>(
      `SELECT a.*, s.sura_name_ar
       FROM ayahs a
       JOIN surahs s ON a.sura_no = s.sura_no
       WHERE a.sura_no = ? AND a.aya_no >= ? AND a.aya_no <= ?
       ORDER BY a.aya_no ASC`,
      [suraNo, startAyah, endAyah]
    );
  }
}
