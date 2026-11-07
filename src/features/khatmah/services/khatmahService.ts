import { SQLiteDatabase } from 'expo-sqlite';
import { QuranRepository } from '../../../core/database/quranRepository';
import { DailyWird, KhatmahPlan, DailyWirdStatus } from '../types/khatmah.types';

export const TOTAL_QURAN_AYAHS = 6236;
export const TOTAL_MADINAH_PAGES = 604;

interface KhatmahPlanRow {
  id: string;
  khatmah_count: number;
  duration_days: number;
  start_global_ayah: number;
  total_ayahs: number;
  completed_ayahs: number;
  is_active: number;
  start_date_local: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

interface CompletionRow {
  day_index: number;
  completed_at: number;
}

interface DailyRange {
  dayIndex: number;
  startOffset: number;
  endOffset: number;
  startGlobalAyah: number;
  endGlobalAyah: number;
  dailyTargetAyahs: number;
  dailyTargetPages: number;
  wrapsAroundEnd: boolean;
}

function mapPlan(row: KhatmahPlanRow): KhatmahPlan {
  return {
    id: row.id,
    khatmahCount: row.khatmah_count,
    durationDays: row.duration_days,
    startGlobalAyah: row.start_global_ayah,
    totalAyahs: row.total_ayahs,
    completedAyahs: row.completed_ayahs,
    isActive: row.is_active === 1,
    startDateLocal: row.start_date_local,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function daysBetweenDateKeys(startDate: string, endDate: string): number {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.max(0, Math.floor((endUtc - startUtc) / 86_400_000));
}

function getDailyTargetAyahs(plan: KhatmahPlan): number {
  return Math.max(1, Math.ceil(plan.totalAyahs / plan.durationDays));
}

function getDailyRange(
  db: SQLiteDatabase,
  plan: KhatmahPlan,
  dayIndex: number
): DailyRange {
  const dailyTarget = getDailyTargetAyahs(plan);
  const startOffset = dayIndex * dailyTarget;
  const endOffset = Math.min(plan.totalAyahs, (dayIndex + 1) * dailyTarget);
  const dailyTargetAyahs = Math.max(0, endOffset - startOffset);
  const startGlobalAyah = modulo(
    plan.startGlobalAyah - 1 + startOffset,
    TOTAL_QURAN_AYAHS
  ) + 1;
  const endGlobalAyah = modulo(
    plan.startGlobalAyah - 1 + endOffset - 1,
    TOTAL_QURAN_AYAHS
  ) + 1;

  const dailyTargetPages = countPagesInRange(
    db,
    startGlobalAyah,
    dailyTargetAyahs
  );

  return {
    dayIndex,
    startOffset,
    endOffset,
    startGlobalAyah,
    endGlobalAyah,
    dailyTargetAyahs,
    dailyTargetPages,
    wrapsAroundEnd:
      dailyTargetAyahs < TOTAL_QURAN_AYAHS && endGlobalAyah < startGlobalAyah,
  };
}

/**
 * Counts actual page visits, including complete Quran cycles. A partial final
 * cycle is calculated from its exact starting and ending ayahs, not an
 * average-ayahs-per-page approximation.
 */
function countPagesInRange(
  db: SQLiteDatabase,
  startGlobalAyah: number,
  ayahCount: number
): number {
  if (ayahCount <= 0) return 0;

  const completeCycles = Math.floor(ayahCount / TOTAL_QURAN_AYAHS);
  const remainder = ayahCount % TOTAL_QURAN_AYAHS;
  let pages = completeCycles * TOTAL_MADINAH_PAGES;

  if (remainder === 0) return pages;

  const endGlobalAyah = modulo(
    startGlobalAyah - 1 + remainder - 1,
    TOTAL_QURAN_AYAHS
  ) + 1;
  const startAyah = QuranRepository.getAyahByGlobalNumberSync(db, startGlobalAyah);
  const endAyah = QuranRepository.getAyahByGlobalNumberSync(db, endGlobalAyah);

  if (!startAyah || !endAyah) {
    // The Quran database is expected to contain all canonical ayahs. Returning
    // zero here would hide a broken data invariant, so fail visibly instead.
    throw new Error('تعذر تحديد صفحات ورد الختمة من قاعدة بيانات المصحف.');
  }

  const partialPages = endGlobalAyah < startGlobalAyah
    ? (TOTAL_MADINAH_PAGES - startAyah.page + 1) + endAyah.page
    : endAyah.page - startAyah.page + 1;

  return pages + partialPages;
}

async function getWirdForPlan(
  db: SQLiteDatabase,
  plan: KhatmahPlan,
  now: Date
): Promise<DailyWird> {
  const today = localDateKey(now);
  const todayIndex = Math.min(
    daysBetweenDateKeys(plan.startDateLocal, today),
    plan.durationDays - 1
  );

  const completionRows = await db.getAllAsync<CompletionRow>(
    'SELECT day_index, completed_at FROM khatmah_daily_completions WHERE plan_id = ? ORDER BY day_index ASC',
    [plan.id]
  );
  const completedByDay = new Map(
    completionRows.map((row) => [row.day_index, row.completed_at])
  );

  let dayIndex = plan.durationDays - 1;
  let status: DailyWirdStatus = 'finished';
  let completedAt: number | null = plan.completedAt;

  if (plan.isActive) {
    let firstPendingDueDay = -1;
    for (let index = 0; index <= todayIndex; index += 1) {
      if (!completedByDay.has(index)) {
        firstPendingDueDay = index;
        break;
      }
    }

    if (firstPendingDueDay >= 0) {
      dayIndex = firstPendingDueDay;
      status = dayIndex < todayIndex ? 'overdue' : 'pending';
      completedAt = null;
    } else {
      // The scheduled work for the current local date is already complete.
      // Keep showing it, but do not let another tap advance progress again.
      dayIndex = todayIndex;
      status = 'completed';
      completedAt = completedByDay.get(dayIndex) ?? null;
    }
  }

  const range = getDailyRange(db, plan, dayIndex);
  return {
    plan,
    dayNumber: dayIndex + 1,
    dayIndex,
    totalDays: plan.durationDays,
    scheduledDate: addDaysToDateKey(plan.startDateLocal, dayIndex),
    status,
    canComplete: status === 'pending' || status === 'overdue',
    completedAt,
    dailyTargetAyahs: range.dailyTargetAyahs,
    dailyTargetPages: range.dailyTargetPages,
    completedInPlan: plan.completedAyahs,
    progressPercent: Math.min(
      100,
      (plan.completedAyahs / plan.totalAyahs) * 100
    ),
    startGlobalAyah: range.startGlobalAyah,
    endGlobalAyah: range.endGlobalAyah,
    wrapsAroundEnd: range.wrapsAroundEnd,
    remainingAyahsToday: status === 'completed' || status === 'finished'
      ? 0
      : range.dailyTargetAyahs,
  };
}

export class KhatmahService {
  static async getActivePlan(db: SQLiteDatabase): Promise<KhatmahPlan | null> {
    const row = await db.getFirstAsync<KhatmahPlanRow>(
      'SELECT * FROM khatmah_plans WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
    );
    return row ? mapPlan(row) : null;
  }

  static async createPlan(
    db: SQLiteDatabase,
    input: {
      khatmahCount: number;
      durationDays: number;
      startGlobalAyah: number;
    }
  ): Promise<KhatmahPlan> {
    const { khatmahCount, durationDays, startGlobalAyah } = input;

    if (!Number.isInteger(khatmahCount) || khatmahCount < 1 || khatmahCount > 20) {
      throw new Error('عدد الختمات يجب أن يكون عدداً صحيحاً بين 1 و20.');
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3660) {
      throw new Error('مدة الخطة يجب أن تكون عدداً صحيحاً بين يوم و10 سنوات.');
    }
    if (
      !Number.isInteger(startGlobalAyah) ||
      startGlobalAyah < 1 ||
      startGlobalAyah > TOTAL_QURAN_AYAHS
    ) {
      throw new Error('موضع بداية القراءة غير صالح.');
    }

    const now = Date.now();
    const startDate = localDateKey(new Date(now));
    const id = `khatmah-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const totalAyahs = TOTAL_QURAN_AYAHS * khatmahCount;

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        'UPDATE khatmah_plans SET is_active = 0, updated_at = ? WHERE is_active = 1',
        [now]
      );
      await txn.runAsync(
        `INSERT INTO khatmah_plans (
          id, khatmah_count, duration_days, start_global_ayah,
          total_ayahs, completed_ayahs, is_active, created_at,
          updated_at, completed_at, start_date_local
        ) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, NULL, ?)`,
        [
          id,
          khatmahCount,
          durationDays,
          startGlobalAyah,
          totalAyahs,
          now,
          now,
          startDate,
        ]
      );
    });

    const plan = await this.getActivePlan(db);
    if (!plan) throw new Error('تعذر إنشاء خطة الختمة.');
    return plan;
  }

  static async getDailyWird(db: SQLiteDatabase): Promise<DailyWird | null> {
    const activePlan = await this.getActivePlan(db);
    if (activePlan) {
      return getWirdForPlan(db, activePlan, new Date());
    }

    // Keep the completed plan visible after the final day so the user can see
    // the completion summary after closing and reopening the modal.
    const latestPlan = await db.getFirstAsync<KhatmahPlanRow>(
      'SELECT * FROM khatmah_plans ORDER BY created_at DESC LIMIT 1'
    );
    if (!latestPlan || latestPlan.completed_at === null) return null;

    return getWirdForPlan(db, mapPlan(latestPlan), new Date());
  }

  static async completeDailyWird(db: SQLiteDatabase): Promise<DailyWird | null> {
    const now = Date.now();

    await db.withExclusiveTransactionAsync(async (txn) => {
      const row = await txn.getFirstAsync<KhatmahPlanRow>(
        'SELECT * FROM khatmah_plans WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
      );
      if (!row) throw new Error('لا توجد خطة ختمة نشطة.');

      const plan = mapPlan(row);
      const current = await getWirdForPlan(txn, plan, new Date(now));
      if (!current.canComplete) {
        throw new Error('تم تسجيل ورد هذا اليوم بالفعل. سيظهر الورد التالي في موعده.');
      }

      await txn.runAsync(
        `INSERT INTO khatmah_daily_completions
          (plan_id, day_index, planned_date, start_offset, end_offset, completed_at, completion_source)
         VALUES (?, ?, ?, ?, ?, ?, 'manual')`,
        [
          plan.id,
          current.dayIndex,
          current.scheduledDate,
          current.dayIndex * getDailyTargetAyahs(plan),
          Math.min(
            plan.totalAyahs,
            (current.dayIndex + 1) * getDailyTargetAyahs(plan)
          ),
          now,
        ]
      );

      const totals = await txn.getFirstAsync<{
        completed_ayahs: number;
        completed_days: number;
      }>(
        `SELECT
           COALESCE(SUM(end_offset - start_offset), 0) AS completed_ayahs,
           COUNT(*) AS completed_days
         FROM khatmah_daily_completions
         WHERE plan_id = ?`,
        [plan.id]
      );

      const completedAyahs = Math.min(plan.totalAyahs, totals?.completed_ayahs ?? 0);
      const isFinished = (totals?.completed_days ?? 0) >= plan.durationDays;

      await txn.runAsync(
        `UPDATE khatmah_plans
         SET completed_ayahs = ?,
             updated_at = ?,
             is_active = ?,
             completed_at = ?
         WHERE id = ? AND is_active = 1`,
        [
          completedAyahs,
          now,
          isFinished ? 0 : 1,
          isFinished ? now : null,
          plan.id,
        ]
      );
    });

    return this.getDailyWird(db);
  }

  static async deleteActivePlan(db: SQLiteDatabase): Promise<void> {
    await db.runAsync(
      'UPDATE khatmah_plans SET is_active = 0, updated_at = ? WHERE is_active = 1',
      [Date.now()]
    );
  }
}
