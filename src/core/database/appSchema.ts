import type { SQLiteDatabase } from 'expo-sqlite';

interface LegacyKhatmahPlanRow {
  id: string;
  duration_days: number;
  total_ayahs: number;
  completed_ayahs: number;
  created_at: number;
  updated_at: number;
  start_date_local: string | null;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Application-owned tables live beside the bundled Quran reference data.
 * The Quran tables are read-only from feature code; only these tables are mutated.
 */
export async function initializeAppSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ayah_notes (
      verse_key TEXT PRIMARY KEY NOT NULL,
      sura_no INTEGER NOT NULL CHECK (sura_no BETWEEN 1 AND 114),
      aya_no INTEGER NOT NULL CHECK (aya_no > 0),
      page INTEGER NOT NULL CHECK (page BETWEEN 1 AND 604),
      sura_name TEXT NOT NULL DEFAULT '',
      ayah_text TEXT NOT NULL DEFAULT '',
      note_text TEXT NOT NULL CHECK (length(trim(note_text)) > 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ayah_notes_updated_at
      ON ayah_notes(updated_at DESC);

    CREATE TABLE IF NOT EXISTS khatmah_plans (
      id TEXT PRIMARY KEY NOT NULL,
      khatmah_count INTEGER NOT NULL CHECK (khatmah_count BETWEEN 1 AND 20),
      duration_days INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 3660),
      start_global_ayah INTEGER NOT NULL CHECK (start_global_ayah BETWEEN 1 AND 6236),
      total_ayahs INTEGER NOT NULL CHECK (total_ayahs > 0),
      completed_ayahs INTEGER NOT NULL DEFAULT 0
        CHECK (completed_ayahs >= 0 AND completed_ayahs <= total_ayahs),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      start_date_local TEXT
    );

    CREATE TABLE IF NOT EXISTS khatmah_daily_completions (
      plan_id TEXT NOT NULL,
      day_index INTEGER NOT NULL CHECK (day_index >= 0),
      planned_date TEXT NOT NULL,
      start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
      end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
      completed_at INTEGER NOT NULL,
      completion_source TEXT NOT NULL DEFAULT 'manual'
        CHECK (completion_source IN ('manual', 'legacy_migration')),
      PRIMARY KEY (plan_id, day_index)
    );

    CREATE INDEX IF NOT EXISTS idx_khatmah_daily_completions_date
      ON khatmah_daily_completions(planned_date DESC);
  `);

  // Existing installs created khatmah_plans before start_date_local existed.
  const planColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(khatmah_plans)');
  if (!planColumns.some((column) => column.name === 'start_date_local')) {
    await db.execAsync('ALTER TABLE khatmah_plans ADD COLUMN start_date_local TEXT');
  }

  const plans = await db.getAllAsync<LegacyKhatmahPlanRow>(
    'SELECT id, duration_days, total_ayahs, completed_ayahs, created_at, updated_at, start_date_local FROM khatmah_plans'
  );

  for (const plan of plans) {
    const startDate = plan.start_date_local || toLocalDateKey(new Date(plan.created_at));

    if (!plan.start_date_local) {
      await db.runAsync(
        'UPDATE khatmah_plans SET start_date_local = ? WHERE id = ? AND start_date_local IS NULL',
        [startDate, plan.id]
      );
    }

    // Preserve progress created by the previous version. It recorded only a
    // cumulative ayah count, so migrated rows are explicitly marked as legacy.
    const existingCompletions = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM khatmah_daily_completions WHERE plan_id = ?',
      [plan.id]
    );

    if ((existingCompletions?.count ?? 0) === 0 && plan.completed_ayahs > 0) {
      const legacyDailyTarget = Math.ceil(plan.total_ayahs / plan.duration_days);
      const completedDays = Math.min(
        plan.duration_days,
        Math.floor(plan.completed_ayahs / legacyDailyTarget)
      );

      for (let dayIndex = 0; dayIndex < completedDays; dayIndex += 1) {
        const startOffset = dayIndex * legacyDailyTarget;
        const endOffset = Math.min(plan.total_ayahs, (dayIndex + 1) * legacyDailyTarget);
        if (endOffset <= startOffset) continue;

        await db.runAsync(
          `INSERT OR IGNORE INTO khatmah_daily_completions
            (plan_id, day_index, planned_date, start_offset, end_offset, completed_at, completion_source)
           VALUES (?, ?, ?, ?, ?, ?, 'legacy_migration')`,
          [
            plan.id,
            dayIndex,
            addDaysToDateKey(startDate, dayIndex),
            startOffset,
            endOffset,
            plan.updated_at,
          ]
        );
      }
    }
  }

  // Keep the newest active plan if an older installation somehow contains
  // more than one, then let SQLite enforce the single-active-plan invariant.
  await db.execAsync(`
    UPDATE khatmah_plans
    SET is_active = 0
    WHERE is_active = 1
      AND id <> (
        SELECT id FROM khatmah_plans
        WHERE is_active = 1
        ORDER BY created_at DESC
        LIMIT 1
      );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_khatmah_single_active_plan
      ON khatmah_plans(is_active)
      WHERE is_active = 1;

    CREATE INDEX IF NOT EXISTS idx_khatmah_plans_active
      ON khatmah_plans(is_active, created_at DESC);
  `);
}
