import * as Font from 'expo-font';
import { QCF_FONTS_MAP } from './qcfFontsMap';

export class QcfFontManager {
  private static loadingPromises = new Map<number, Promise<void>>();
  private static loadedPages = new Set<number>();

  static getFontFamilyName(page: number): string {
    return 'QCF_P' + page;
  }

  static isPageFontLoaded(page: number): boolean {
    if (QcfFontManager.loadedPages.has(page)) return true;

    const fontName = QcfFontManager.getFontFamilyName(page);
    const loaded = Font.isLoaded(fontName);

    if (loaded) {
      QcfFontManager.loadedPages.add(page);
    }

    return loaded;
  }

  /**
   * Loads exactly one page font. Concurrent requests share the same promise.
   * A failed load rejects so the caller can deliberately use Unicode fallback.
   */
  static async loadPageFont(page: number): Promise<void> {
    if (!Number.isInteger(page) || page < 1 || page > 604) {
      throw new RangeError('Invalid QCF page number: ' + page);
    }

    if (QcfFontManager.isPageFontLoaded(page)) return;

    const pending = QcfFontManager.loadingPromises.get(page);
    if (pending) return pending;

    const fontAsset = QCF_FONTS_MAP[page];
    if (!fontAsset) {
      throw new Error('[QcfFontManager] Missing bundled font asset for page ' + page);
    }

    const fontName = QcfFontManager.getFontFamilyName(page);
    const promise = Font.loadAsync({ [fontName]: fontAsset })
      .then(() => {
        if (!Font.isLoaded(fontName)) {
          throw new Error('Expo Font did not register ' + fontName + ' after loading.');
        }
        QcfFontManager.loadedPages.add(page);
      })
      .finally(() => {
        QcfFontManager.loadingPromises.delete(page);
      });

    QcfFontManager.loadingPromises.set(page, promise);
    return promise;
  }

  static preloadSurroundingPageFonts(targetPage: number, radius = 2): void {
    const minPage = Math.max(1, targetPage - radius);
    const maxPage = Math.min(604, targetPage + radius);

    for (let page = minPage; page <= maxPage; page += 1) {
      if (!QcfFontManager.isPageFontLoaded(page)) {
        QcfFontManager.loadPageFont(page).catch((error) => {
          console.warn('[QcfFontManager] Background preload failed for page ' + page, error);
        });
      }
    }
  }
}
