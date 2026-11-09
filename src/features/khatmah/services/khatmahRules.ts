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
  dayIndex: number,
  startOffsetOverride?: number
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
  const scheduledStartOffset = dayIndex * dailyTarget;
  const endOffset = Math.min(totalAyahs, (dayIndex + 1) * dailyTarget);
  const startOffset = startOffsetOverride ?? scheduledStartOffset;
  if (startOffset < scheduledStartOffset || startOffset >= endOffset) {
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

//=============================================
export interface DailyPageRange extends DailyAyahRange {
  dailyTargetPages: number;
}

export interface PageScheduleSummary {
  totalPageVisits: number;
  minPagesPerDay: number;
  maxPagesPerDay: number;
  daysWithExtraPage: number;
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
//=============================================================

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function getPageVisitStartOffsets(
  startGlobalAyah: number,
  totalAyahs: number,
  pageStartGlobalAyahs: readonly number[]
): number[] {
  if (
    !Number.isInteger(startGlobalAyah) ||
    startGlobalAyah < 1 ||
    startGlobalAyah > TOTAL_QURAN_AYAHS
  ) {
    throw new Error('Invalid startGlobalAyah');
  }

  if (
    !Number.isInteger(totalAyahs) ||
    totalAyahs < 1 ||
    totalAyahs % TOTAL_QURAN_AYAHS !== 0
  ) {
    throw new Error('totalAyahs must contain complete Quran cycles');
  }

  const invalidPageStarts =
    pageStartGlobalAyahs.length !== TOTAL_MADINAH_PAGES ||
    pageStartGlobalAyahs[0] !== 1 ||
    pageStartGlobalAyahs.some((value, index) =>
      !Number.isInteger(value) ||
      value < 1 ||
      value > TOTAL_QURAN_AYAHS ||
      (
        index > 0 &&
        value <= pageStartGlobalAyahs[index - 1]
      )
    );

  if (invalidPageStarts) {
    throw new Error('Invalid Quran page boundaries');
  }

  const cycles = totalAyahs / TOTAL_QURAN_AYAHS;
  const offsets = [0];

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const pageStart of pageStartGlobalAyahs) {
      const relativeOffset = positiveModulo(
        pageStart - startGlobalAyah,
        TOTAL_QURAN_AYAHS
      );

      const offset =
        cycle * TOTAL_QURAN_AYAHS + relativeOffset;

      if (offset > 0 && offset < totalAyahs) {
        offsets.push(offset);
      }
    }
  }

  offsets.sort((a, b) => a - b);

  if (new Set(offsets).size !== offsets.length) {
    throw new Error('Duplicate page boundaries detected');
  }

  return offsets;
}


export function getPageScheduleSummary(
  startGlobalAyah: number,
  totalAyahs: number,
  durationDays: number,
  pageStartGlobalAyahs: readonly number[]
): PageScheduleSummary {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error('durationDays must be positive');
  }

  const pageOffsets = getPageVisitStartOffsets(
    startGlobalAyah,
    totalAyahs,
    pageStartGlobalAyahs
  );

  const totalPageVisits = pageOffsets.length;

  if (durationDays > totalPageVisits) {
    throw new Error(
      'مدة الخطة أكبر من عدد مقاطع الصفحات المتاحة.'
    );
  }

  const basePages = Math.floor(
    totalPageVisits / durationDays
  );

  const remainder = totalPageVisits % durationDays;

  return {
    totalPageVisits,
    minPagesPerDay: basePages,
    maxPagesPerDay: basePages + (remainder > 0 ? 1 : 0),
    daysWithExtraPage: remainder,
  };
}


export function getDailyPageRange(
  startGlobalAyah: number,
  totalAyahs: number,
  durationDays: number,
  dayIndex: number,
  pageStartGlobalAyahs: readonly number[],
  startOffsetOverride?: number
): DailyPageRange {
  if (
    !Number.isInteger(dayIndex) ||
    dayIndex < 0 ||
    dayIndex >= durationDays
  ) {
    throw new Error('dayIndex is outside the plan duration');
  }

  const pageOffsets = getPageVisitStartOffsets(
    startGlobalAyah,
    totalAyahs,
    pageStartGlobalAyahs
  );

  const totalPageVisits = pageOffsets.length;

  if (
    !Number.isInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > totalPageVisits
  ) {
    throw new Error('Invalid durationDays for page schedule');
  }

  const basePages = Math.floor(
    totalPageVisits / durationDays
  );

  const remainder = totalPageVisits % durationDays;

  const startPageIndex =
    dayIndex * basePages + Math.min(dayIndex, remainder);

  const dailyTargetPages =
    basePages + (dayIndex < remainder ? 1 : 0);

  const endPageIndex =
    startPageIndex + dailyTargetPages;

  const scheduledStartOffset =
    pageOffsets[startPageIndex];

  const scheduledEndOffset =
    pageOffsets[endPageIndex] ?? totalAyahs;

  const startOffset =
    startOffsetOverride ?? scheduledStartOffset;

  if (
    !Number.isInteger(startOffset) ||
    startOffset < scheduledStartOffset ||
    startOffset >= scheduledEndOffset
  ) {
    throw new Error('Invalid partial page schedule offset');
  }

  const endOffset = scheduledEndOffset;
  const dailyTargetAyahs = endOffset - startOffset;

  const startAbsolute =
    startGlobalAyah - 1 + startOffset;

  const endAbsolute =
    startGlobalAyah - 1 + endOffset - 1;

  const startGlobal =
    positiveModulo(startAbsolute, TOTAL_QURAN_AYAHS) + 1;

  const endGlobal =
    positiveModulo(endAbsolute, TOTAL_QURAN_AYAHS) + 1;

  return {
    dayIndex,
    startOffset,
    endOffset,
    startGlobalAyah: startGlobal,
    endGlobalAyah: endGlobal,
    dailyTargetAyahs,
    dailyTargetPages,
    wrapsAroundEnd:
      Math.floor(endAbsolute / TOTAL_QURAN_AYAHS) >
      Math.floor(startAbsolute / TOTAL_QURAN_AYAHS),
  };
}


