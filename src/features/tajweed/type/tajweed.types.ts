export interface TajweedOccurrence {
  start: number;
  end: number;
  text: string;
}

export interface TajweedRuleGroup {
  rule: string;
  title: string;
  definition?: string;
  occurrences: TajweedOccurrence[];
}

export interface TajweedAyahData {
  surah: number;
  ayah: number;

  // النص من نفس النسخة المرجعية التي حُسبت عليها الإحداثيات
  ayahText: string;

  rules: TajweedRuleGroup[];
}

export type TajweedDownloadStage =
  | 'idle'
  | 'downloading_edition'
  | 'downloading_data'
  | 'indexing'
  | 'completed';

export interface TajweedDownloadProgress {
  stage: TajweedDownloadStage;
  progress: number; // 0.0 to 1.0
  percentage: number; // 0 to 100
  bytesWritten: number;
  totalBytes: number;
  message: string;
}

export interface TajweedDatasetSummary {
  isDownloaded: boolean;
  totalBytes: number;
}
