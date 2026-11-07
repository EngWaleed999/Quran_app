import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bookmark, BookmarkType } from '../types/bookmark.types';
import {
  createBookmarkId,
  normalizeBookmarks,
  removeBookmarkById,
  removeBookmarksByType,
  upsertBookmark,
} from './bookmarkRules';

const BOOKMARKS_STORAGE_KEY = '@quran_bookmarks_v3';
const PREVIOUS_BOOKMARKS_STORAGE_KEY = '@quran_bookmarks_v2';
const LEGACY_BOOKMARK_STORAGE_KEY = '@quran_active_bookmark';

export class BookmarkService {
  private static cachedBookmarks: Bookmark[] | null = null;
  private static pendingLoad: Promise<Bookmark[]> | null = null;
  private static mutationQueue: Promise<void> = Promise.resolve();

  private static enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  static async getBookmarks(): Promise<Bookmark[]> {
    if (this.cachedBookmarks) return [...this.cachedBookmarks];
    if (this.pendingLoad) return this.pendingLoad;

    this.pendingLoad = (async () => {
      try {
        const current = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
        if (current !== null) {
          this.cachedBookmarks = normalizeBookmarks(JSON.parse(current));
          return [...this.cachedBookmarks];
        }

        const previous = await AsyncStorage.getItem(PREVIOUS_BOOKMARKS_STORAGE_KEY);
        if (previous !== null) {
          const migrated = normalizeBookmarks(JSON.parse(previous));
          await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(migrated));
          this.cachedBookmarks = migrated;
          return [...migrated];
        }

        const legacy = await AsyncStorage.getItem(LEGACY_BOOKMARK_STORAGE_KEY);
        if (legacy !== null) {
          const parsed: unknown = JSON.parse(legacy);
          const migrated = normalizeBookmarks(
            parsed && typeof parsed === 'object'
              ? [{ ...(parsed as Record<string, unknown>), type: 'reading' }]
              : []
          );
          await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(migrated));
          this.cachedBookmarks = migrated;
          return [...migrated];
        }

        this.cachedBookmarks = [];
        return [];
      } catch (error) {
        // Do not overwrite corrupt or unreadable storage with an empty array.
        // Keep the cache unset so a later read can retry after transient errors.
        console.warn('[BookmarkService] Could not load bookmarks:', error);
        throw error;
      } finally {
        this.pendingLoad = null;
      }
    })();

    return this.pendingLoad;
  }

  static async saveBookmark(
    bookmark: Omit<Bookmark, 'id'> & { id?: string },
    type: BookmarkType = bookmark.type
  ): Promise<Bookmark[]> {
    return this.enqueueMutation(async () => {
      const current = await this.getBookmarks();
      const next = upsertBookmark(current, { ...bookmark, type });
      await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
      this.cachedBookmarks = next;
      return [...next];
    });
  }

  /** Remove exactly one saved marker; other bookmarks in the same category remain. */
  static async removeBookmark(bookmarkId: string): Promise<Bookmark[]> {
    return this.enqueueMutation(async () => {
      const current = await this.getBookmarks();
      const next = removeBookmarkById(current, bookmarkId);
      if (next.length === current.length) return current;

      await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
      this.cachedBookmarks = next;
      return [...next];
    });
  }

  static async removeBookmarksOfType(type: BookmarkType): Promise<Bookmark[]> {
    return this.enqueueMutation(async () => {
      const current = await this.getBookmarks();
      const next = removeBookmarksByType(current, type);
      await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
      this.cachedBookmarks = next;
      return [...next];
    });
  }

  static async getActiveBookmark(): Promise<Bookmark | null> {
    const bookmarks = await this.getBookmarks();
    return (
      bookmarks.find((item) => item.type === 'reading') ??
      bookmarks[0] ??
      null
    );
  }

  static isVerseBookmarked(verseKey: string): boolean {
    return this.cachedBookmarks?.some((item) => item.verseKey === verseKey) ?? false;
  }

  /** Used by tests/debug screens only; never call while the app is in use. */
  static resetMemoryCacheForTests(): void {
    this.cachedBookmarks = null;
    this.pendingLoad = null;
    this.mutationQueue = Promise.resolve();
  }

  static getBookmarkId(type: BookmarkType, verseKey: string): string {
    return createBookmarkId(type, verseKey);
  }
}
