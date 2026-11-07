import { SQLiteDatabase } from 'expo-sqlite';
import { SvgPilotPageAsset, RawAyahJsonEntry } from '../../features/mushaf/types/svgMushaf.types';

export class SvgMushafRepository {
  private static pageMemoryCache = new Map<number, SvgPilotPageAsset>();
  private static readonly MAX_CACHE_SIZE = 15;

  /**
   * Retrieves SVG and coordinate metadata for a given page synchronously.
   * Utilizes an in-memory LRU cache to maintain 60fps performance during swipes.
   */
  static getPageAssetSync(db: SQLiteDatabase, page: number): SvgPilotPageAsset | null {
    if (this.pageMemoryCache.has(page)) {
      return this.pageMemoryCache.get(page)!;
    }

    try {
      const row = db.getFirstSync<{ view_box: string; svg_xml: string; raw_json: string }>(
        'SELECT view_box, svg_xml, raw_json FROM mushaf_svg_pages WHERE page = ?',
        [page]
      );

      if (!row) return null;

      const rawJsonParsed = JSON.parse(row.raw_json);
      // Handles both array format and object dictionary format ({ "0": {...}, "1": {...} })
      const rawJsonArray: RawAyahJsonEntry[] = Array.isArray(rawJsonParsed)
        ? rawJsonParsed
        : Object.keys(rawJsonParsed)
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => rawJsonParsed[k]);

      const asset: SvgPilotPageAsset = {
        page,
        viewBox: row.view_box,
        svgXml: row.svg_xml,
        rawJson: rawJsonArray,
      };

      // Evict oldest entry when cache limit reached (LRU)
      if (this.pageMemoryCache.size >= this.MAX_CACHE_SIZE) {
        const oldestKey = this.pageMemoryCache.keys().next().value;
        if (oldestKey !== undefined) {
          this.pageMemoryCache.delete(oldestKey);
        }
      }

      this.pageMemoryCache.set(page, asset);
      return asset;
    } catch (error) {
      console.error(`[SvgMushafRepository] Failed to load SVG page ${page}:`, error);
      return null;
    }
  }

  /**
   * Prewarms adjacent pages around the current page to ensure instantaneous zero-lag swipes.
   */
  static prewarmSurroundingPages(db: SQLiteDatabase, currentPage: number, radius = 2): void {
    for (let p = Math.max(1, currentPage - radius); p <= Math.min(604, currentPage + radius); p++) {
      if (!this.pageMemoryCache.has(p)) {
        this.getPageAssetSync(db, p);
      }
    }
  }
}
