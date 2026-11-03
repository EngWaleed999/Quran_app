export interface Reciter {
  id: string;
  name: string;
  subname: string;
  folder: string;
}

export type PlaybackStatus = 
  | 'idle' 
  | 'checking_files' 
  | 'downloading' 
  | 'playing' 
  | 'waiting_user_repeat' 
  | 'paused' 
  | 'completed';

export interface RepeatConfig {
  repeatCount: number;       // How many times to repeat each Ayah (1, 2, 3, 5)
  pauseDelaySeconds: number; // Waiting seconds between repeats for user recitation (0 = continuous)
}

export interface PlaybackTarget {
  suraNo: number;
  suraName: string;
  startAyah: number;
  endAyah: number;
}

export interface DownloadProgress {
  current: number;
  total: number;
  percentage: number;
  currentAyahName: string;
}

