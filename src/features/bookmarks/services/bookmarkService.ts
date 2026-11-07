import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bookmark, BookmarkType } from '../types/bookmark.types';

const BOOKMARKS_STORAGE_KEY = '@quran_bookmarks_v2';
const LEGACY_BOOKMARK_STORAGE_KEY = '@quran_active_bookmark';

const VALID_TYPES: BookmarkType[] = ['tracking', 'reading', 'memorization'];

function isBookmark(value: unknown): value is Bookmark {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Bookmark>;
  return (
    typeof item.verseKey === 'string' &&
    typeof item.suraNo === 'number' &&
    typeof item.ayaNo === 'number' &&
    typeof item.page === 'number' &&
    typeof item.suraName === 'string' &&
    typeof item.ayahText === 'string' &&
    typeof item.createdAt === 'number' &&
    VALID_TYPES.includes(item.type as BookmarkType)
  );
}

export class BookmarkService {
  private static cachedBookmarks: Bookmark[] | null = null;
  private static pendingLoad: Promise<Bookmark[]> | null = null;

  static async getBookmarks(): Promise<Bookmark[]> {
    if (this.cachedBookmarks) return [...this.cachedBookmarks];
    if (this.pendingLoad) return this.pendingLoad;

    this.pendingLoad = (async () => {
      try {
        const stored = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          this.cachedBookmarks = Array.isArray(parsed) ? parsed.filter(isBookmark) : [];
        } else {
          // Migrate the original single reading bookmark without losing user data.
          const legacy = await AsyncStorage.getItem(LEGACY_BOOKMARK_STORAGE_KEY);
          if (legacy) {
            const parsed: unknown = JSON.parse(legacy);
            if (parsed && typeof parsed === 'object') {
              const bookmark = { ...(parsed as object), type: 'reading' as const };
              this.cachedBookmarks = isBookmark(bookmark) ? [bookmark] : [];
              await AsyncStorage.setItem(
                BOOKMARKS_STORAGE_KEY,
                JSON.stringify(this.cachedBookmarks)
              );
            } else {
              this.cachedBookmarks = [];
            }
          } else {
            this.cachedBookmarks = [];
          }
        }
        return [...this.cachedBookmarks];
      } catch (error) {
        console.warn('[BookmarkService] Could not load bookmarks:', error);
        this.cachedBookmarks = [];
        return [];
      } finally {
        this.pendingLoad = null;
      }
    })();

    return this.pendingLoad;
  }

  static async saveBookmark(
    bookmark: Omit<Bookmark, 'type'> & { type?: BookmarkType },
    type: BookmarkType = bookmark.type ?? 'reading'
  ): Promise<Bookmark[]> {
    const current = await this.getBookmarks();
    const nextBookmark: Bookmark = { ...bookmark, type };
    const next = [
      ...current.filter((item) => item.type !== type),
      nextBookmark,
    ].sort((a, b) => VALID_TYPES.indexOf(a.type) - VALID_TYPES.indexOf(b.type));

    await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
    this.cachedBookmarks = next;
    return [...next];
  }

  static async removeBookmark(type: BookmarkType = 'reading'): Promise<Bookmark[]> {
    const current = await this.getBookmarks();
    const next = current.filter((item) => item.type !== type);
    await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
    this.cachedBookmarks = next;
    return [...next];
  }

  static async getActiveBookmark(): Promise<Bookmark | null> {
    const bookmarks = await this.getBookmarks();
    return bookmarks.find((item) => item.type === 'reading') ?? bookmarks[0] ?? null;
  }

  static isVerseBookmarked(verseKey: string): boolean {
    return this.cachedBookmarks?.some((item) => item.verseKey === verseKey) ?? false;
  }
}
