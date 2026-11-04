import * as Font from 'expo-font';
import { QCF_FONTS_MAP } from './qcfFontsMap';

export class QcfFontManager {
  private static loadingPromises = new Map<number, Promise<void>>();
  private static loadedPages = new Set<number>();

  /**
   * Returns standard font family name registered in React Native for a specific page.
   * Format: QCF_P1, QCF_P2, ... QCF_P604
   */
  static getFontFamilyName(page: number): string {
    return `QCF_P${page}`;
  }

  /**
   * Synchronously checks if the font for the given page is already loaded and ready in memory.
   */
  static isPageFontLoaded(page: number): boolean {
    if (QcfFontManager.loadedPages.has(page)) {
      return true;
    }
    const fontName = QcfFontManager.getFontFamilyName(page);
    const loaded = Font.isLoaded(fontName);
    if (loaded) {
      QcfFontManager.loadedPages.add(page);
    }
    return loaded;
  }

  /**
   * Asynchronously loads the QCF font for a specific page.
   * Deduplicates concurrent requests to guarantee the same font is never loaded twice.
   */
  static async loadPageFont(page: number): Promise<void> {
    if (page < 1 || page > 604) return;

    if (QcfFontManager.isPageFontLoaded(page)) {
      return;
    }

    // If an existing loading promise is in flight, await it
    if (QcfFontManager.loadingPromises.has(page)) {
      return QcfFontManager.loadingPromises.get(page);
    }

    const fontAsset = QCF_FONTS_MAP[page];
    if (!fontAsset) {
      console.warn(`[QcfFontManager] No font asset found for page ${page}`);
      return;
    }

    const fontName = QcfFontManager.getFontFamilyName(page);

    const promise = (async () => {
      try {
        await Font.loadAsync({
          [fontName]: fontAsset,
        });
        QcfFontManager.loadedPages.add(page);
      } catch (err) {
        console.error(`[QcfFontManager] Failed to load font for page ${page}:`, err);
      } finally {
        QcfFontManager.loadingPromises.delete(page);
      }
    })();

    QcfFontManager.loadingPromises.set(page, promise);
    return promise;
  }

  /**
   * Proactively preloads surrounding page fonts in the background.
   * Keeps target page ± radius (default 2) loaded for instant 0-latency swiping.
   */
  static preloadSurroundingPageFonts(targetPage: number, radius = 2): void {
    const minPage = Math.max(1, targetPage - radius);
    const maxPage = Math.min(604, targetPage + radius);

    for (let p = minPage; p <= maxPage; p++) {
      if (!QcfFontManager.isPageFontLoaded(p)) {
        QcfFontManager.loadPageFont(p).catch(() => {});
      }
    }
  }
}

