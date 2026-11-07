import test from 'node:test';
import assert from 'node:assert/strict';
import { KhatmahService } from '../src/features/khatmah/services/khatmahService.ts';
import { createQuranTestDatabase } from './helpers/quranTestDatabase.mjs';

const DAY_MS = 86_400_000;
const RealDate = globalThis.Date;

function useControlledDate(startTime) {
  let currentTime = startTime;
  class ControlledDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(currentTime);
      } else {
        super(...args);
      }
    }
    static now() {
      return currentTime;
    }
  }
  globalThis.Date = ControlledDate;
  return {
    setTime(value) {
      currentTime = value;
    },
    restore() {
      globalThis.Date = RealDate;
    },
  };
}

test('daily plan is stored, completed once, and history is persisted', async (t) => {
  const clock = useControlledDate(RealDate.parse('2026-11-07T12:00:00.000Z'));
  const db = await createQuranTestDatabase();
  t.after(() => {
    clock.restore();
    db.close();
  });

  const plan = await KhatmahService.createPlan(db, {
    khatmahCount: 1,
    durationDays: 3,
    startGlobalAyah: 1,
  });

  const firstWird = await KhatmahService.getDailyWird(db);
  assert.ok(firstWird);
  assert.equal(firstWird.status, 'pending');
  assert.equal(firstWird.dayIndex, 0);
  assert.equal(firstWird.startOffset, 0);
  assert.equal(firstWird.dailyTargetAyahs, 2079);

  const afterCompletion = await KhatmahService.completeDailyWird(db);
  assert.ok(afterCompletion);
  assert.equal(afterCompletion.status, 'completed');
  assert.equal(afterCompletion.completedInPlan, 2079);
  assert.equal(afterCompletion.canComplete, false);

  await assert.rejects(
    () => KhatmahService.completeDailyWird(db),
    /تم تسجيل ورد هذا اليوم بالفعل/
  );

  const history = await KhatmahService.getCompletionHistory(db, plan.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].dayNumber, 1);
  assert.equal(history[0].source, 'manual');

  const stored = await db.getFirstAsync(
    'SELECT completed_ayahs FROM khatmah_plans WHERE id = ?',
    [plan.id]
  );
  assert.equal(stored.completed_ayahs, 2079);
});

test('missed days are offered in order and can be caught up without skipping', async (t) => {
  const clock = useControlledDate(RealDate.parse('2026-11-07T12:00:00.000Z'));
  const db = await createQuranTestDatabase();
  t.after(() => {
    clock.restore();
    db.close();
  });

  await KhatmahService.createPlan(db, {
    khatmahCount: 1,
    durationDays: 4,
    startGlobalAyah: 6200,
  });

  clock.setTime(RealDate.parse('2026-11-10T12:00:00.000Z'));
  let wird = await KhatmahService.getDailyWird(db);
  assert.equal(wird?.status, 'overdue');
  assert.equal(wird?.dayIndex, 0);

  wird = await KhatmahService.completeDailyWird(db);
  assert.equal(wird?.status, 'overdue');
  assert.equal(wird?.dayIndex, 1);

  wird = await KhatmahService.completeDailyWird(db);
  assert.equal(wird?.status, 'overdue');
  assert.equal(wird?.dayIndex, 2);

  wird = await KhatmahService.completeDailyWird(db);
  assert.equal(wird?.status, 'pending');
  assert.equal(wird?.dayIndex, 3);
  assert.equal(wird?.completedInPlan, 3 * 1559);
});

test('legacy partial progress resumes at the exact next ayah after schema migration', async (t) => {
  const clock = useControlledDate(RealDate.parse('2026-11-07T12:00:00.000Z'));
  const db = await createQuranTestDatabase();
  t.after(() => {
    clock.restore();
    db.close();
  });

  await db.execAsync(`
    CREATE TABLE legacy_khatmah_plan_seed (
      id TEXT PRIMARY KEY,
      khatmah_count INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      start_global_ayah INTEGER NOT NULL,
      total_ayahs INTEGER NOT NULL,
      completed_ayahs INTEGER NOT NULL,
      is_active INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );
    DROP TABLE khatmah_plans;
    DROP TABLE app_schema_migrations;
    CREATE TABLE khatmah_plans (
      id TEXT PRIMARY KEY NOT NULL,
      khatmah_count INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      start_global_ayah INTEGER NOT NULL,
      total_ayahs INTEGER NOT NULL,
      completed_ayahs INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `);

  const createdAt = RealDate.parse('2026-11-01T12:00:00.000Z');
  await db.runAsync(
    `INSERT INTO khatmah_plans (
      id, khatmah_count, duration_days, start_global_ayah,
      total_ayahs, completed_ayahs, is_active, created_at, updated_at, completed_at
    ) VALUES ('legacy-plan', 1, 30, 1, 6236, 1200, 1, ?, ?, NULL)`,
    [createdAt, createdAt]
  );

  await initializeExistingAppSchema(db);

  const wird = await KhatmahService.getDailyWird(db);
  assert.ok(wird);
  assert.equal(wird.status, 'overdue');
  assert.equal(wird.dayIndex, 5);
  assert.equal(wird.startOffset, 1200);
  assert.equal(wird.endOffset, 1248);
  assert.equal(wird.dailyTargetAyahs, 48);
  assert.equal(wird.completedInPlan, 1200);

  const migratedRows = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM khatmah_daily_completions WHERE plan_id = ?',
    ['legacy-plan']
  );
  assert.equal(migratedRows.count, 5);

  const resumed = await KhatmahService.completeDailyWird(db);
  assert.equal(resumed?.completedInPlan, 1248);
  assert.equal(resumed?.dayIndex, 6);
});

async function initializeExistingAppSchema(db) {
  const { initializeAppSchema } = await import('../src/core/database/appSchema.ts');
  await initializeAppSchema(db);
}
