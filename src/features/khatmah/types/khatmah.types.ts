export interface KhatmahPlan {
  id: string;
  khatmahCount: number;
  durationDays: number;
  startGlobalAyah: number;
  totalAyahs: number;
  completedAyahs: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface DailyWird {
  plan: KhatmahPlan;
  dayNumber: number;
  totalDays: number;
  dailyTargetAyahs: number;
  dailyTargetPages: number;
  completedInPlan: number;
  progressPercent: number;
  startGlobalAyah: number;
  endGlobalAyah: number;
  wrapsAroundEnd: boolean;
  remainingAyahsToday: number;
}
