export const TOTAL_QURAN_AYAHS = 6236;
export const TOTAL_MADINAH_PAGES = 604;

export interface DailyAyahRange {
  dayIndex: number;
  startOffset: number;
  endOffset: number;
  startGlobalAyah: number;
  endGlobalAyah: number;
  dailyTargetAyahs: number;
  wrapsAroundEnd: boolean;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Calendar arithmetic is performed in UTC after reading local date fields. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error('days must be an integer');

  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function daysBetweenDateKeys(startDate: string, endDate: string): number {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.floor((endUtc - startUtc) / 86_400_000);
}

export function getDailyAyahRange(
  startGlobalAyah: number,
  totalAyahs: number,
  durationDays: number,
  dayIndex: number
): DailyAyahRange {
  if (!Number.isInteger(startGlobalAyah) || startGlobalAyah < 1 || startGlobalAyah > TOTAL_QURAN_AYAHS) {
    throw new Error('startGlobalAyah must be between 1 and 6236');
  }
  if (!Number.isInteger(totalAyahs) || totalAyahs < 1) {
    throw new Error('totalAyahs must be a positive integer');
  }
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error('durationDays must be a positive integer');
  }
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= durationDays) {
    throw new Error('dayIndex is outside the plan duration');
  }

  const dailyTarget = Math.max(1, Math.ceil(totalAyahs / durationDays));
  const startOffset = dayIndex * dailyTarget;
  const endOffset = Math.min(totalAyahs, (dayIndex + 1) * dailyTarget);
  if (endOffset <= startOffset) {
    throw new Error('The requested day has no remaining ayahs');
  }

  const dailyTargetAyahs = endOffset - startOffset;
  const startGlobal = ((startGlobalAyah - 1 + startOffset) % TOTAL_QURAN_AYAHS) + 1;
  const endGlobal = ((startGlobalAyah - 1 + endOffset - 1) % TOTAL_QURAN_AYAHS) + 1;

  return {
    dayIndex,
    startOffset,
    endOffset,
    startGlobalAyah: startGlobal,
    endGlobalAyah: endGlobal,
    dailyTargetAyahs,
    wrapsAroundEnd: dailyTargetAyahs < TOTAL_QURAN_AYAHS && endGlobal < startGlobal,
  };
}

/**
 * Exact page visits for a consecutive global-ayah range.
 * Page boundaries are provided by the canonical Quran SQLite data.
 */
export function countPageVisits(
  ayahCount: number,
  startPage: number,
  endPage: number,
  wrapsAroundEnd: boolean
): number {
  if (!Number.isInteger(ayahCount) || ayahCount < 0) {
    throw new Error('ayahCount must be a non-negative integer');
  }
  if (
    !Number.isInteger(startPage) ||
    !Number.isInteger(endPage) ||
    startPage < 1 ||
    startPage > TOTAL_MADINAH_PAGES ||
    endPage < 1 ||
    endPage > TOTAL_MADINAH_PAGES
  ) {
    throw new Error('Page numbers must be between 1 and 604');
  }
  if (ayahCount === 0) return 0;

  const completeCycles = Math.floor(ayahCount / TOTAL_QURAN_AYAHS);
  const remainder = ayahCount % TOTAL_QURAN_AYAHS;
  const completeCyclePages = completeCycles * TOTAL_MADINAH_PAGES;
  if (remainder === 0) return completeCyclePages;

  const partialPages = wrapsAroundEnd
    ? TOTAL_MADINAH_PAGES - startPage + 1 + endPage
    : endPage - startPage + 1;

  if (partialPages < 1) {
    throw new Error('The page range does not match the supplied ayah range');
  }
  return completeCyclePages + partialPages;
}
