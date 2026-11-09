import type { SQLiteDatabase } from 'expo-sqlite';

export const APP_SCHEMA_VERSION = 4;

interface Migration {
  version: number;
  name: string;
  up: (transaction: SQLiteDatabase) => Promise<void>;
}

interface LegacyKhatmahPlanRow {
  id: string;
  duration_days: number;
  total_ayahs: number;
  completed_ayahs: number;
  created_at: number;
  updated_at: number;
  start_date_local: string | null;
}

interface TableColumnRow {
  name: string;
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

async function hasColumn(
  db: SQLiteDatabase,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const columns = await db.getAllAsync<TableColumnRow>(
    `PRAGMA table_info(${tableName})`
  );
  return columns.some((column) => column.name === columnName);
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'create-local-notes-and-khatmah-plans',
    up: async (transaction) => {
      // These tables are app-owned. Quran reference tables are never altered.
      await transaction.execAsync(`
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
          completed_at INTEGER
        );
      `);
    },
  },
  {
    version: 2,
    name: 'add-calendar-based-khatmah-completions',
    up: async (transaction) => {
      if (!(await hasColumn(transaction, 'khatmah_plans', 'start_date_local'))) {
        await transaction.execAsync(
          'ALTER TABLE khatmah_plans ADD COLUMN start_date_local TEXT'
        );
      }

      await transaction.execAsync(`
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

      if (!(await hasColumn(transaction, 'khatmah_daily_completions', 'completion_source'))) {
        await transaction.execAsync(
          "ALTER TABLE khatmah_daily_completions ADD COLUMN completion_source TEXT NOT NULL DEFAULT 'manual'"
        );
      }
    },
  },
  {
    version: 3,
    name: 'backfill-legacy-khatmah-progress-and-enforce-single-active-plan',
    up: async (transaction) => {
      const plans = await transaction.getAllAsync<LegacyKhatmahPlanRow>(
        `SELECT id, duration_days, total_ayahs, completed_ayahs,
                created_at, updated_at, start_date_local
         FROM khatmah_plans`
      );

      for (const plan of plans) {
        const startDate =
          plan.start_date_local || toLocalDateKey(new Date(plan.created_at));

        if (!plan.start_date_local) {
          await transaction.runAsync(
            'UPDATE khatmah_plans SET start_date_local = ? WHERE id = ? AND start_date_local IS NULL',
            [startDate, plan.id]
          );
        }

        const existingCompletions = await transaction.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM khatmah_daily_completions WHERE plan_id = ?',
          [plan.id]
        );

        // Older app versions kept only a cumulative completed_ayahs counter.
        // Create records for fully completed daily chunks. Any partial chunk is
        // intentionally left in completed_ayahs; KhatmahService resumes from
        // that exact offset rather than pretending the entire day was read.
        if ((existingCompletions?.count ?? 0) === 0 && plan.completed_ayahs > 0) {
          const legacyDailyTarget = Math.ceil(plan.total_ayahs / plan.duration_days);
          const completedDays = Math.min(
            plan.duration_days,
            Math.floor(plan.completed_ayahs / legacyDailyTarget)
          );

          for (let dayIndex = 0; dayIndex < completedDays; dayIndex += 1) {
            const startOffset = dayIndex * legacyDailyTarget;
            const endOffset = Math.min(
              plan.total_ayahs,
              (dayIndex + 1) * legacyDailyTarget
            );
            if (endOffset <= startOffset) continue;

            await transaction.runAsync(
              `INSERT OR IGNORE INTO khatmah_daily_completions
                (plan_id, day_index, planned_date, start_offset, end_offset,
                 completed_at, completion_source)
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

      // Repair accidental duplicate active plans before applying the invariant.
      await transaction.execAsync(`
        UPDATE khatmah_plans
        SET is_active = 0
        WHERE is_active = 1
          AND id <> (
            SELECT id
            FROM khatmah_plans
            WHERE is_active = 1
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_khatmah_single_active_plan
          ON khatmah_plans(is_active)
          WHERE is_active = 1;

        CREATE INDEX IF NOT EXISTS idx_khatmah_plans_active
          ON khatmah_plans(is_active, created_at DESC);
      `);
    },
  },
  {
    version: 4,
    name: 'add-page-based-khatmah-scheduling',
    up: async (transaction) => {
      if (
        !(await hasColumn(
          transaction,
          'khatmah_plans',
          'schedule_mode'
        ))
      ) {
        await transaction.execAsync("ALTER TABLE khatmah_plans ADD COLUMN schedule_mode TEXT NOT NULL DEFAULT 'ayah' CHECK(schedule_mode IN('ayah', 'page'));");
      }
    },
  },
];

/**
 * Applies only app-owned schema migrations.
 *
 * This function does not recreate, replace, delete, or alter the canonical
 * Quran tables (surahs, ayahs, mushaf_svg_pages, ayah_tafsir).
 * Each migration and its ledger entry are committed atomically.
 */
export async function initializeAppSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const applied = await transaction.getAllAsync<{ version: number }>(
      'SELECT version FROM app_schema_migrations ORDER BY version ASC'
    );
    const appliedVersions = new Set(applied.map((row) => row.version));

    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) continue;

      await migration.up(transaction);
      await transaction.runAsync(
        'INSERT INTO app_schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [migration.version, migration.name, Date.now()]
      );
    }
  });
}
