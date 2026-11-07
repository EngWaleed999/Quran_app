import { SQLiteDatabase } from 'expo-sqlite';
import { DailyWird, KhatmahPlan } from '../types/khatmah.types';

export const TOTAL_QURAN_AYAHS = 6236;
const AYAHS_PER_MADINAH_PAGE = 10.3;

interface KhatmahPlanRow {
  id: string;
  khatmah_count: number;
  duration_days: number;
  start_global_ayah: number;
  total_ayahs: number;
  completed_ayahs: number;
  is_active: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
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
    const khatmahCount = Math.floor(input.khatmahCount);
    const durationDays = Math.floor(input.durationDays);
    const startGlobalAyah = Math.floor(input.startGlobalAyah);

    if (!Number.isInteger(khatmahCount) || khatmahCount < 1 || khatmahCount > 20) {
      throw new Error('عدد الختمات يجب أن يكون بين 1 و20.');
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3660) {
      throw new Error('مدة الخطة يجب أن تكون بين يوم و10 سنوات.');
    }
    if (!Number.isInteger(startGlobalAyah) || startGlobalAyah < 1 || startGlobalAyah > TOTAL_QURAN_AYAHS) {
      throw new Error('موضع بداية القراءة غير صالح.');
    }

    const now = Date.now();
    const id = String(now) + '-' + Math.random().toString(36).slice(2, 8);
    const totalAyahs = TOTAL_QURAN_AYAHS * khatmahCount;

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        'UPDATE khatmah_plans SET is_active = 0, updated_at = ? WHERE is_active = 1',
        [now]
      );
      await txn.runAsync(
        `INSERT INTO khatmah_plans (
          id, khatmah_count, duration_days, start_global_ayah,
          total_ayahs, completed_ayahs, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)`,
        [id, khatmahCount, durationDays, startGlobalAyah, totalAyahs, now, now]
      );
    });

    const plan = await this.getActivePlan(db);
    if (!plan) throw new Error('تعذر إنشاء خطة الختمة.');
    return plan;
  }

  static async getDailyWird(db: SQLiteDatabase): Promise<DailyWird | null> {
    const plan = await this.getActivePlan(db);
    if (!plan || plan.completedAyahs >= plan.totalAyahs) return null;

    const dailyTargetAyahs = Math.max(1, Math.ceil(plan.totalAyahs / plan.durationDays));
    const dayIndex = Math.floor(plan.completedAyahs / dailyTargetAyahs);
    const dayEndOffset = Math.min(
      plan.totalAyahs,
      (dayIndex + 1) * dailyTargetAyahs
    );
    const startOffset = plan.completedAyahs;
    const startGlobalAyah = modulo(
      plan.startGlobalAyah - 1 + startOffset,
      TOTAL_QURAN_AYAHS
    ) + 1;
    const endGlobalAyah = modulo(
      plan.startGlobalAyah - 1 + dayEndOffset - 1,
      TOTAL_QURAN_AYAHS
    ) + 1;

    return {
      plan,
      dayNumber: Math.min(dayIndex + 1, plan.durationDays),
      totalDays: plan.durationDays,
      dailyTargetAyahs: dayEndOffset - startOffset,
      dailyTargetPages: Math.max(1, Math.ceil((dayEndOffset - startOffset) / AYAHS_PER_MADINAH_PAGE)),
      completedInPlan: plan.completedAyahs,
      progressPercent: Math.min(100, (plan.completedAyahs / plan.totalAyahs) * 100),
      startGlobalAyah,
      endGlobalAyah,
      wrapsAroundEnd: endGlobalAyah < startGlobalAyah,
      remainingAyahsToday: dayEndOffset - startOffset,
    };
  }

  static async completeDailyWird(db: SQLiteDatabase): Promise<DailyWird | null> {
    const current = await this.getDailyWird(db);
    if (!current) return null;

    const nextCompleted = Math.min(
      current.plan.totalAyahs,
      current.plan.completedAyahs + current.dailyTargetAyahs
    );
    const now = Date.now();
    await db.runAsync(
      `UPDATE khatmah_plans
       SET completed_ayahs = ?,
           updated_at = ?,
           is_active = CASE WHEN ? >= total_ayahs THEN 0 ELSE 1 END,
           completed_at = CASE WHEN ? >= total_ayahs THEN ? ELSE NULL END
       WHERE id = ? AND is_active = 1`,
      [nextCompleted, now, nextCompleted, nextCompleted, now, current.plan.id]
    );

    return this.getDailyWird(db);
  }

  static async deleteActivePlan(db: SQLiteDatabase): Promise<void> {
    await db.runAsync(
      'UPDATE khatmah_plans SET is_active = 0, updated_at = ? WHERE is_active = 1',
      [Date.now()]
    );
  }
}
