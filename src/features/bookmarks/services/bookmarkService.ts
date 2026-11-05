import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bookmark } from '../types/bookmark.types';

const BOOKMARK_STORAGE_KEY = '@quran_active_bookmark';

export class BookmarkService {
  private static cachedBookmark: Bookmark | null = null;
  private static isInitialized = false;

  /**
   * جلب الفاصل النشط حالياً من الذاكرة أو التخزين المحلي
   */
  static async getActiveBookmark(): Promise<Bookmark | null> {
    if (BookmarkService.isInitialized) {
      return BookmarkService.cachedBookmark;
    }

    try {
      const data = await AsyncStorage.getItem(BOOKMARK_STORAGE_KEY);
      if (data) {
        BookmarkService.cachedBookmark = JSON.parse(data) as Bookmark;
      } else {
        BookmarkService.cachedBookmark = null;
      }
      BookmarkService.isInitialized = true;
      return BookmarkService.cachedBookmark;
    } catch (err) {
      console.warn('[BookmarkService] Failed to load bookmark:', err);
      return null;
    }
  }

  /**
   * حفظ فاصل جديد
   */
  static async saveBookmark(bookmark: Bookmark): Promise<void> {
    try {
      BookmarkService.cachedBookmark = bookmark;
      BookmarkService.isInitialized = true;
      await AsyncStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmark));
    } catch (err) {
      console.warn('[BookmarkService] Failed to save bookmark:', err);
    }
  }

  /**
   * إزالة الفاصل الحالي
   */
  static async removeBookmark(): Promise<void> {
    try {
      BookmarkService.cachedBookmark = null;
      BookmarkService.isInitialized = true;
      await AsyncStorage.removeItem(BOOKMARK_STORAGE_KEY);
    } catch (err) {
      console.warn('[BookmarkService] Failed to remove bookmark:', err);
    }
  }

  /**
   * فحص متزامن سريع إن كانت الآية محددة كفاصل
   */
  static isVerseBookmarked(verseKey: string): boolean {
    return BookmarkService.cachedBookmark?.verseKey === verseKey;
  }
}
