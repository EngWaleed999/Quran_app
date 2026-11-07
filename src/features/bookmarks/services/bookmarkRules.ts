import type { Bookmark, BookmarkType } from '../types/bookmark.types';

const VALID_TYPES: BookmarkType[] = ['tracking', 'reading', 'memorization'];
const TYPE_ORDER: Record<BookmarkType, number> = {
  tracking: 0,
  reading: 1,
  memorization: 2,
};

export function createBookmarkId(type: BookmarkType, verseKey: string): string {
  return `${type}:${verseKey}`;
}

export function isBookmarkType(value: unknown): value is BookmarkType {
  return typeof value === 'string' && VALID_TYPES.includes(value as BookmarkType);
}

export function isBookmark(value: unknown): value is Bookmark {
  if (!value || typeof value !== 'object') return false;

  const item = value as Partial<Bookmark>;
  return (
    typeof item.verseKey === 'string' &&
    /^\d{1,3}:\d{1,3}$/.test(item.verseKey) &&
    typeof item.suraNo === 'number' &&
    Number.isInteger(item.suraNo) &&
    item.suraNo >= 1 &&
    item.suraNo <= 114 &&
    typeof item.ayaNo === 'number' &&
    Number.isInteger(item.ayaNo) &&
    item.ayaNo > 0 &&
    typeof item.page === 'number' &&
    Number.isInteger(item.page) &&
    item.page >= 1 &&
    item.page <= 604 &&
    typeof item.suraName === 'string' &&
    typeof item.ayahText === 'string' &&
    typeof item.createdAt === 'number' &&
    Number.isFinite(item.createdAt) &&
    isBookmarkType(item.type)
  );
}

export function normalizeBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) return [];

  const byId = new Map<string, Bookmark>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue;
    const item = candidate as Partial<Bookmark>;
    if (!isBookmark(item)) continue;

    const id = createBookmarkId(item.type, item.verseKey);
    const normalized: Bookmark = { ...item, id };
    const existing = byId.get(id);

    // Keep the latest record if legacy storage contains duplicate markers.
    if (!existing || normalized.createdAt >= existing.createdAt) {
      byId.set(id, normalized);
    }
  }

  return sortBookmarks([...byId.values()]);
}

export function sortBookmarks(bookmarks: Bookmark[]): Bookmark[] {
  return [...bookmarks].sort((left, right) => {
    const typeOrder = TYPE_ORDER[left.type] - TYPE_ORDER[right.type];
    if (typeOrder !== 0) return typeOrder;
    return right.createdAt - left.createdAt;
  });
}

export function upsertBookmark(
  current: Bookmark[],
  input: Omit<Bookmark, 'id'> & { id?: string }
): Bookmark[] {
  const id = createBookmarkId(input.type, input.verseKey);
  const existing = current.find((item) => item.id === id);
  const nextBookmark: Bookmark = {
    ...input,
    id,
    createdAt: existing?.createdAt ?? input.createdAt,
  };

  return sortBookmarks([
    ...current.filter((item) => item.id !== id),
    nextBookmark,
  ]);
}

export function removeBookmarkById(
  current: Bookmark[],
  bookmarkId: string
): Bookmark[] {
  return current.filter((item) => item.id !== bookmarkId);
}

export function removeBookmarksByType(
  current: Bookmark[],
  type: BookmarkType
): Bookmark[] {
  return current.filter((item) => item.type !== type);
}
