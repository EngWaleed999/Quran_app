import type { SQLiteDatabase } from 'expo-sqlite';
import { QuranRepository } from '../../../core/database/quranRepository.ts';
import type { DailyWird, KhatmahPlan, DailyWirdStatus, KhatmahCompletion } from '../types/khatmah.types';
import { addDaysToDateKey, countPageVisits, daysBetweenDateKeys, getDailyAyahRange, localDateKey, TOTAL_MADINAH_PAGES, TOTAL_QURAN_AYAHS } from './khatmahRules.ts';

export { TOTAL_QURAN_AYAHS, TOTAL_MADINAH_PAGES } from './khatmahRules.ts';

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

function getDailyTargetAyahs(plan: KhatmahPlan): number {
  return Math.max(1, Math.ceil(plan.totalAyahs / plan.durationDays));
}

function getDailyRange(
  db: SQLiteDatabase,
  plan: KhatmahPlan,
  dayIndex: number,
  startOffsetOverride?: number
): DailyRange {
  const range = getDailyAyahRange(
    plan.startGlobalAyah,
    plan.totalAyahs,
    plan.durationDays,
    dayIndex,
    startOffsetOverride
  );
  const startAyah = QuranRepository.getAyahByGlobalNumberSync(db, range.startGlobalAyah);
  const endAyah = QuranRepository.getAyahByGlobalNumberSync(db, range.endGlobalAyah);
  if (!startAyah || !endAyah) {
    throw new Error('تعذر تحديد صفحات ورد الختمة من قاعدة بيانات المصحف.');
  }

  return {
    ...range,
    dailyTargetPages: countPageVisits(
      range.dailyTargetAyahs,
      startAyah.page,
      endAyah.page,
      range.wrapsAroundEnd
    ),
  };
}

async function getWirdForPlan(
  db: SQLiteDatabase,
  plan: KhatmahPlan,
  now: Date
): Promise<DailyWird> {
  const today = localDateKey(now);
  const todayIndex = Math.max(
    0,
    Math.min(
      daysBetweenDateKeys(plan.startDateLocal, today),
      plan.durationDays - 1
    )
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

  const scheduledStartOffset = dayIndex * getDailyTargetAyahs(plan);
  const scheduledEndOffset = Math.min(
    plan.totalAyahs,
    (dayIndex + 1) * getDailyTargetAyahs(plan)
  );
  const legacyPartialOffset =
    (status === 'pending' || status === 'overdue') &&
    plan.completedAyahs > scheduledStartOffset &&
    plan.completedAyahs < scheduledEndOffset
      ? plan.completedAyahs
      : undefined;
  const range = getDailyRange(db, plan, dayIndex, legacyPartialOffset);
  return {
    plan,
    dayNumber: dayIndex + 1,
    dayIndex,
    totalDays: plan.durationDays,
    scheduledDate: addDaysToDateKey(plan.startDateLocal, dayIndex),
    status,
    canComplete: status === 'pending' || status === 'overdue',
    completedAt,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
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
          current.startOffset,
          current.endOffset,
          now,
        ]
      );

      const totals = await txn.getFirstAsync<{ completed_days: number }>(
        'SELECT COUNT(*) AS completed_days FROM khatmah_daily_completions WHERE plan_id = ?',
        [plan.id]
      );

      // Day records are inserted sequentially, so endOffset is the authoritative
      // cumulative progress. This also preserves an old installation's partial
      // ayah progress when the first day is resumed after migration.
      const completedAyahs = current.endOffset;
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

  static async getCompletionHistory(
    db: SQLiteDatabase,
    planId: string,
    limit = 20
  ): Promise<KhatmahCompletion[]> {
    const planRow = await db.getFirstAsync<KhatmahPlanRow>(
      'SELECT * FROM khatmah_plans WHERE id = ? LIMIT 1',
      [planId]
    );
    if (!planRow) return [];

    const plan = mapPlan(planRow);
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = await db.getAllAsync<{
      day_index: number;
      planned_date: string;
      start_offset: number;
      end_offset: number;
      completed_at: number;
      completion_source: 'manual' | 'legacy_migration';
    }>(
      `SELECT day_index, planned_date, start_offset, end_offset, completed_at, completion_source
       FROM khatmah_daily_completions
       WHERE plan_id = ?
       ORDER BY day_index DESC
       LIMIT ?`,
      [planId, safeLimit]
    );

    return rows.flatMap((row) => {
      const startGlobalAyah = modulo(
        plan.startGlobalAyah - 1 + row.start_offset,
        TOTAL_QURAN_AYAHS
      ) + 1;
      const endGlobalAyah = modulo(
        plan.startGlobalAyah - 1 + row.end_offset - 1,
        TOTAL_QURAN_AYAHS
      ) + 1;
      const startAyah = QuranRepository.getAyahByGlobalNumberSync(db, startGlobalAyah);
      const endAyah = QuranRepository.getAyahByGlobalNumberSync(db, endGlobalAyah);

      if (!startAyah || !endAyah) return [];

      return [{
        dayNumber: row.day_index + 1,
        scheduledDate: row.planned_date,
        startSuraName: startAyah.sura_name_ar ?? '',
        startAyahNo: startAyah.aya_no,
        endSuraName: endAyah.sura_name_ar ?? '',
        endAyahNo: endAyah.aya_no,
        completedAt: row.completed_at,
        source: row.completion_source,
      }];
    });
  }

  static async deleteActivePlan(db: SQLiteDatabase): Promise<void> {
    await db.runAsync(
      'UPDATE khatmah_plans SET is_active = 0, updated_at = ? WHERE is_active = 1',
      [Date.now()]
    );
  }
}
