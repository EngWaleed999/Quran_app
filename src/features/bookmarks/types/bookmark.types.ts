export interface Bookmark {
  verseKey: string;     // e.g. "2:255"
  suraNo: number;       // e.g. 2
  ayaNo: number;        // e.g. 255
  page: number;         // e.g. 42
  suraName: string;     // e.g. "البَقَرَة"
  ayahText: string;     // text snippet
  createdAt: number;    // timestamp
}
