export interface KhatmahPlan {
  id: string;
  khatmahCount: number;
  durationDays: number;
  startGlobalAyah: number;
  totalAyahs: number;
  completedAyahs: number;
  isActive: boolean;
  startDateLocal: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export type DailyWirdStatus = 'pending' | 'overdue' | 'completed' | 'finished';

export interface DailyWird {
  plan: KhatmahPlan;
  dayNumber: number;
  dayIndex: number;
  totalDays: number;
  scheduledDate: string;
  status: DailyWirdStatus;
  canComplete: boolean;
  completedAt: number | null;
  dailyTargetAyahs: number;
  dailyTargetPages: number;
  completedInPlan: number;
  progressPercent: number;
  startGlobalAyah: number;
  endGlobalAyah: number;
  wrapsAroundEnd: boolean;
  remainingAyahsToday: number;
}
