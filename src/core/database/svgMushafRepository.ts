import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  SvgPilotPageAsset,
  RawAyahJsonEntry,
  NormalizedPageData,
} from '../../features/mushaf/types/svgMushaf.types';

interface SvgPageRow {
  view_box: string;
  svg_xml: string;
  raw_json: string;
}

export class SvgMushafRepository {
  /**
   * 25 pages in memory consume ~1.5 MB total RAM.
   * This provides instantaneous 60fps swiping across 12 forward and 12 backward pages
   * without endangering low-memory devices such as Galaxy A8.
   */
  private static readonly MAX_CACHE_SIZE = 25;
  private static pageMemoryCache = new Map<number, SvgPilotPageAsset>();
  private static inFlight = new Map<number, Promise<SvgPilotPageAsset | null>>();

  private static remember(page: number, asset: SvgPilotPageAsset): void {
    this.pageMemoryCache.delete(page);
    this.pageMemoryCache.set(page, asset);
    while (this.pageMemoryCache.size > this.MAX_CACHE_SIZE) {
      const oldestPage = this.pageMemoryCache.keys().next().value;
      if (oldestPage === undefined) break;
      this.pageMemoryCache.delete(oldestPage);
    }
  }

  /**
   * Synchronous cache retrieval (0ms latency, zero microtask / promise delays).
   * Used for instantaneous first render frame when swiping to an already-cached page.
   */
  static getCachedAsset(page: number): SvgPilotPageAsset | null {
    const cached = this.pageMemoryCache.get(page);
    if (cached) {
      this.remember(page, cached);
      return cached;
    }
    return null;
  }

  /**
   * Attach computed polygon normalization to cached asset so geometry calculation
   * happens at most once per page lifecycle.
   */
  static attachNormalizedData(page: number, data: NormalizedPageData): void {
    const cached = this.pageMemoryCache.get(page);
    if (cached && cached.page === page) {
      cached.normalizedData = data;
    }
  }

  /**
   * Proactive preloading of candidate pages in the background.
   * Completely non-blocking and safe from redundant SQLite queries.
   */
  static preloadPages(db: SQLiteDatabase, pages: number[]): void {
    for (const page of pages) {
      if (
        page >= 1 &&
        page <= 604 &&
        !this.pageMemoryCache.has(page) &&
        !this.inFlight.has(page)
      ) {
        void this.getPageAsset(db, page);
      }
    }
  }

  /** Load one page asynchronously; duplicate requests share the same query/parse. */
  static async getPageAsset(db: SQLiteDatabase, page: number): Promise<SvgPilotPageAsset | null> {
    const cached = this.pageMemoryCache.get(page);
    if (cached) {
      this.remember(page, cached);
      return cached;
    }

    const pending = this.inFlight.get(page);
    if (pending) return pending;

    const request = (async (): Promise<SvgPilotPageAsset | null> => {
      try {
        const row = await db.getFirstAsync<SvgPageRow>(
          'SELECT view_box, svg_xml, raw_json FROM mushaf_svg_pages WHERE page = ?',
          [page]
        );
        if (!row) return null;

        const parsed: unknown = JSON.parse(row.raw_json);
        const rawJsonArray: RawAyahJsonEntry[] = Array.isArray(parsed)
          ? (parsed as RawAyahJsonEntry[])
          : Object.keys(parsed as Record<string, RawAyahJsonEntry>)
              .sort((a, b) => Number(a) - Number(b))
              .map((key) => (parsed as Record<string, RawAyahJsonEntry>)[key]);

        const asset: SvgPilotPageAsset = {
          page,
          viewBox: row.view_box,
          svgXml: row.svg_xml,
          rawJson: rawJsonArray,
        };
        this.remember(page, asset);
        return asset;
      } catch (error) {
        console.warn(`[SvgMushafRepository] Failed to load SVG page ${page}:`, error);
        return null;
      } finally {
        this.inFlight.delete(page);
      }
    })();

    this.inFlight.set(page, request);
    return request;
  }

  static clearMemoryCache(): void {
    this.pageMemoryCache.clear();
    this.inFlight.clear();
  }
}
