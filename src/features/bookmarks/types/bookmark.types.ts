export type BookmarkType = 'tracking' | 'reading' | 'memorization';

export const BOOKMARK_TYPE_LABELS: Record<BookmarkType, string> = {
  tracking: 'متابعة',
  reading: 'قراءة',
  memorization: 'حفظ',
};

export const BOOKMARK_TYPE_COLORS: Record<BookmarkType, string> = {
  tracking: '#2F785E',
  reading: '#C59B27',
  memorization: '#6373C5',
};

export interface Bookmark {
  /** Stable identity: one bookmark per category and verse. */
  id: string;
  verseKey: string;
  suraNo: number;
  ayaNo: number;
  page: number;
  suraName: string;
  ayahText: string;
  createdAt: number;
  type: BookmarkType;
}
