export interface Reciter {
  id: string;
  name: string;
  subname: string;
  edition: string;
  bitrate: 64 | 128 | 192;
}

export type PlaybackStatus =
  | 'idle'
  | 'checking_files'
  | 'downloading'
  | 'playing'
  | 'waiting_user_repeat'
  | 'paused'
  | 'completed'
  | 'error';

export type AudioActionMode = 'tilawah' | 'repeat';

export interface RepeatConfig {
  /** Total number of plays for each ayah, including the first play. */
  repeatCount: number;
  /** Delay in seconds between repetitions of the same ayah. */
  pauseDelaySeconds: number;
}

export interface PlaybackVerse {
  suraNo: number;
  ayaNo: number;
  /** Global Quran ayah number used by the Al Quran Cloud ayah CDN (1-6236). */
  globalAyahNo: number;
}

export interface PlaybackTarget {
  suraNo: number;
  suraName: string;
  startAyah: number;
  endAyah: number;
  /** Complete surah track list. Playback starts at startAyah. */
  verses: PlaybackVerse[];
}

export interface DownloadProgress {
  current: number;
  total: number;
  percentage: number;
  currentAyahName: string;
}

export interface SurahDownloadSummary {
  total: number;
  downloaded: number;
  missing: PlaybackVerse[];
  bytes: number;
  allDownloaded: boolean;
}
