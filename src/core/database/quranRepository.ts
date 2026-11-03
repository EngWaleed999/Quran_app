import { SQLiteDatabase } from 'expo-sqlite';
import { Ayah } from '../../features/mushaf/types/mushaf.types';
import { Surah, JuzItem, AyahSearchResult } from '../../features/surah-list/types/surah.types';

export class QuranRepository {
  private static pageCache = new Map<number, Ayah[]>();
  private static isWarmedUp = false;

  /**
   * Proactively warm up the cache for ALL 604 pages in a single fast synchronous query (~45ms).
   * Once loaded, any page lookup across the entire app is an instantaneous O(1) in-memory operation.
   */
  static warmupCache(db: SQLiteDatabase): void {
    if (QuranRepository.isWarmedUp) return;
    try {
      const rows = db.getAllSync<Ayah>(
        `SELECT a.*, s.sura_name_ar 
         FROM ayahs a 
         JOIN surahs s ON a.sura_no = s.sura_no 
         ORDER BY a.page ASC, a.id ASC`
      );
      const cache = QuranRepository.pageCache;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let pageAyahs = cache.get(row.page);
        if (!pageAyahs) {
          pageAyahs = [];
          cache.set(row.page, pageAyahs);
        }
        pageAyahs.push(row);
      }
      QuranRepository.isWarmedUp = true;
    } catch (e) {
      console.warn('[QuranRepository] warmupCache error:', e);
    }
  }

  /**
   * Retrieves all Ayahs for a specific Mushaf page (1 to 604) synchronously.
   * Serves directly from memory cache or reads synchronously from SQLite for zero-frame delay.
   */
  static getPageAyahsSync(db: SQLiteDatabase, page: number): Ayah[] {
    const cached = QuranRepository.pageCache.get(page);
    if (cached) {
      return cached;
    }
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
    } catch (e) {
      console.warn(`[QuranRepository] getPageAyahsSync error on page ${page}:`, e);
      return [];
    }
  }

  /**
   * Preloads adjacent pages around centerPage into in-memory cache.
   */
  static preloadPages(db: SQLiteDatabase, centerPage: number, radius: number = 5): void {
    const minPage = Math.max(1, centerPage - radius);
    const maxPage = Math.min(604, centerPage + radius);
    for (let p = minPage; p <= maxPage; p++) {
      if (!QuranRepository.pageCache.has(p)) {
        try {
          const rows = db.getAllSync<Ayah>(
            `SELECT a.*, s.sura_name_ar 
             FROM ayahs a 
             JOIN surahs s ON a.sura_no = s.sura_no 
             WHERE a.page = ? 
             ORDER BY a.id ASC`,
            [p]
          );
          QuranRepository.pageCache.set(p, rows);
        } catch {
          // Ignore background preload errors
        }
      }
    }
  }

  /**
   * Retrieves all Ayahs for a specific Mushaf page (1 to 604).
   */
  static async getPageAyahs(db: SQLiteDatabase, page: number): Promise<Ayah[]> {
    const cached = QuranRepository.pageCache.get(page);
    if (cached) {
      return cached;
    }
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

  /**
   * Retrieves the full catalog of 114 Surahs with metadata.
   */
  static async getAllSurahs(db: SQLiteDatabase): Promise<Surah[]> {
    const rows = await db.getAllAsync<Surah>(
      `SELECT * FROM surahs ORDER BY sura_no ASC`
    );
    return rows;
  }

  /**
   * Retrieves a single Surah by its index (1-114).
   */
  static async getSurah(db: SQLiteDatabase, suraNo: number): Promise<Surah | null> {
    const row = await db.getFirstAsync<Surah>(
      `SELECT * FROM surahs WHERE sura_no = ?`,
      [suraNo]
    );
    return row || null;
  }

  /**
   * Searches the entire Quran by Emlaey text (without complex diacritics).
   */
  static async searchAyahs(db: SQLiteDatabase, query: string, limit: number = 40): Promise<AyahSearchResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    const cleanQuery = `%${query.trim()}%`;
    const rows = await db.getAllAsync<AyahSearchResult>(
      `SELECT a.id, a.sura_no, s.sura_name_ar, a.page, a.aya_no, a.aya_text_emlaey 
       FROM ayahs a 
       JOIN surahs s ON a.sura_no = s.sura_no 
       WHERE a.aya_text_emlaey LIKE ? 
       ORDER BY a.id ASC 
       LIMIT ?`,
      [cleanQuery, limit]
    );
    return rows;
  }

  /**
   * Retrieves starting points for each of the 30 Juz (الأجزاء).
   */
  static async getJuzList(db: SQLiteDatabase): Promise<JuzItem[]> {
    const rows = await db.getAllAsync<JuzItem>(
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
    return rows;
  }

  /**
   * Fetches an ordered range of Ayahs within a Surah for audio playback/download.
   */
  static async getAyahsRange(db: SQLiteDatabase, suraNo: number, startAyah: number, endAyah: number): Promise<Ayah[]> {
    const rows = await db.getAllAsync<Ayah>(
      `SELECT a.*, s.sura_name_ar 
       FROM ayahs a 
       JOIN surahs s ON a.sura_no = s.sura_no 
       WHERE a.sura_no = ? AND a.aya_no >= ? AND a.aya_no <= ? 
       ORDER BY a.aya_no ASC`,
      [suraNo, startAyah, endAyah]
    );
    return rows;
  }
}
