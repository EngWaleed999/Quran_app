import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToDateKey,
  countPageVisits,
  daysBetweenDateKeys,
  getDailyAyahRange,
  localDateKey,
  getDailyPageRange,
  getPageScheduleSummary,
  getPageVisitStartOffsets,
} from '../src/features/khatmah/services/khatmahRules.ts';

test('localDateKey uses the local calendar fields, not UTC date', () => {
  const date = new Date(2026, 10, 7, 23, 30);
  assert.equal(localDateKey(date), '2026-11-07');
});

test('calendar date arithmetic crosses month and year boundaries', () => {
  assert.equal(addDaysToDateKey('2026-01-31', 1), '2026-02-01');
  assert.equal(addDaysToDateKey('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysToDateKey('2024-02-28', 1), '2024-02-29');
  assert.equal(addDaysToDateKey('2024-02-29', 1), '2024-03-01');
});

test('date differences are calendar-day based and ignore DST hour lengths', () => {
  assert.equal(daysBetweenDateKeys('2026-03-07', '2026-03-09'), 2);
  assert.equal(daysBetweenDateKeys('2026-11-07', '2026-11-07'), 0);
  assert.equal(daysBetweenDateKeys('2026-11-08', '2026-11-07'), -1);
});

test('daily ayah ranges partition the whole plan without gaps or overlap', () => {
  const ranges = Array.from({ length: 3 }, (_, day) =>
    getDailyAyahRange(1, 6236, 3, day)
  );
  assert.deepEqual(ranges.map((range) => range.dailyTargetAyahs), [2079, 2079, 2078]);
  assert.equal(ranges[0].startOffset, 0);
  assert.equal(ranges[0].endOffset, ranges[1].startOffset);
  assert.equal(ranges[1].endOffset, ranges[2].startOffset);
  assert.equal(ranges[2].endOffset, 6236);
});

test('daily ayah ranges wrap from the end of the Mushaf to the beginning', () => {
  const range = getDailyAyahRange(6200, 100, 2, 0);
  assert.equal(range.startGlobalAyah, 6200);
  assert.equal(range.endGlobalAyah, 6249 - 6236);
  assert.equal(range.wrapsAroundEnd, true);
  assert.equal(range.dailyTargetAyahs, 50);
});

test('the last day contains the exact remainder when totals do not divide evenly', () => {
  const lastDay = getDailyAyahRange(100, 10, 3, 2);
  assert.equal(lastDay.startOffset, 8);
  assert.equal(lastDay.endOffset, 10);
  assert.equal(lastDay.dailyTargetAyahs, 2);
});

test('a legacy partial day resumes at its exact saved offset', () => {
  const resumed = getDailyAyahRange(1, 6236, 30, 5, 1200);
  assert.equal(resumed.startOffset, 1200);
  assert.equal(resumed.endOffset, 1248);
  assert.equal(resumed.dailyTargetAyahs, 48);
  assert.throws(() => getDailyAyahRange(1, 6236, 30, 5, 1248));
});

test('page visit counts include an entire cycle and exact partial range', () => {
  assert.equal(countPageVisits(6236, 1, 604, false), 604);
  assert.equal(countPageVisits(6236 + 20, 600, 2, true), 611);
  assert.equal(countPageVisits(0, 1, 1, false), 0);
});

test('invalid daily range inputs fail fast', () => {
  assert.throws(() => getDailyAyahRange(0, 6236, 30, 0));
  assert.throws(() => getDailyAyahRange(1, 6236, 30, 30));
  assert.throws(() => countPageVisits(-1, 1, 1, false));
});

const TEST_PAGE_STARTS = Array.from(
  { length: 604 },
  (_, index) => Math.ceil((index * 6236) / 604) + 1
);

test('30-day page schedule distributes 604 pages as 21 and 20', () => {
  const summary = getPageScheduleSummary(
    1,
    6236,
    30,
    TEST_PAGE_STARTS
  );

  assert.equal(summary.totalPageVisits, 604);
  assert.equal(summary.minPagesPerDay, 20);
  assert.equal(summary.maxPagesPerDay, 21);
  assert.equal(summary.daysWithExtraPage, 4);

  const ranges = Array.from({ length: 30 }, (_, dayIndex) =>
    getDailyPageRange(
      1,
      6236,
      30,
      dayIndex,
      TEST_PAGE_STARTS
    )
  );

  assert.deepEqual(
    ranges.map(range => range.dailyTargetPages),
    Array.from(
      { length: 30 },
      (_, index) => index < 4 ? 21 : 20
    )
  );

  assert.equal(ranges[0].startOffset, 0);
  assert.equal(ranges[29].endOffset, 6236);

  for (let index = 0; index < ranges.length - 1; index += 1) {
    assert.equal(
      ranges[index].endOffset,
      ranges[index + 1].startOffset
    );
  }

  assert.equal(
    ranges.reduce(
      (sum, range) => sum + range.dailyTargetAyahs,
      0
    ),
    6236
  );
});

test('starting at an actual page boundary keeps 604 page visits', () => {
  const startGlobalAyah = TEST_PAGE_STARTS[100];

  const offsets = getPageVisitStartOffsets(
    startGlobalAyah,
    6236,
    TEST_PAGE_STARTS
  );

  assert.equal(offsets.length, 604);
});

test('starting inside a page counts the split starting page correctly', () => {
  const startGlobalAyah = TEST_PAGE_STARTS[100] + 1;

  const summary = getPageScheduleSummary(
    startGlobalAyah,
    6236,
    30,
    TEST_PAGE_STARTS
  );

  assert.equal(summary.totalPageVisits, 605);
  assert.equal(summary.daysWithExtraPage, 5);

  const firstWird = getDailyPageRange(
    startGlobalAyah,
    6236,
    30,
    0,
    TEST_PAGE_STARTS
  );

  assert.equal(firstWird.startGlobalAyah, startGlobalAyah);
});
