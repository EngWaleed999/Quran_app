import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildDhikrId,
  parseRawAdhkar,
  sortAdhkarWithFavorites,
  filterAdhkar,
  extractCategories,
  shouldResetCounter,
  computeNextCounter,
} from '../src/features/adhkar/services/adhkarRules.ts';

const rawDataPath = path.resolve('adhkar_filtered.json');
const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));

test('parseRawAdhkar parses all 159 items and builds unique IDs', () => {
  const items = parseRawAdhkar(rawData);
  assert.equal(items.length, 159);

  // Check unique IDs
  const idSet = new Set(items.map((i) => i.id));
  assert.equal(idSet.size, 159, 'All 159 dhikr items must have globally unique IDs');

  // Verify first and last items
  assert.equal(items[0].id, '1_1');
  assert.equal(items[0].categoryTitle, 'أذكار الصباح والمساء');
  assert.equal(items[0].count, 1);
});

test('sortAdhkarWithFavorites puts favorited items first while preserving relative order', () => {
  const items = [
    { id: '1_1', rawId: 1, categoryId: 1, categoryTitle: 'A', text: 'First', count: 1 },
    { id: '1_2', rawId: 2, categoryId: 1, categoryTitle: 'A', text: 'Second', count: 1 },
    { id: '1_3', rawId: 3, categoryId: 1, categoryTitle: 'A', text: 'Third', count: 1 },
    { id: '1_4', rawId: 4, categoryId: 1, categoryTitle: 'A', text: 'Fourth', count: 1 },
  ];

  // Favorite 1_3 and 1_4
  const favSet = new Set(['1_3', '1_4']);
  const sorted = sortAdhkarWithFavorites(items, favSet);

  assert.equal(sorted[0].id, '1_3');
  assert.equal(sorted[0].isFavorite, true);
  assert.equal(sorted[1].id, '1_4');
  assert.equal(sorted[1].isFavorite, true);
  assert.equal(sorted[2].id, '1_1');
  assert.equal(sorted[2].isFavorite, false);
  assert.equal(sorted[3].id, '1_2');
  assert.equal(sorted[3].isFavorite, false);
});

test('filterAdhkar filters by favorites tab', () => {
  const items = [
    { id: '1_1', rawId: 1, categoryId: 1, categoryTitle: 'A', text: 'First', count: 1, isFavorite: false },
    { id: '1_2', rawId: 2, categoryId: 1, categoryTitle: 'A', text: 'Second', count: 1, isFavorite: true },
    { id: '1_3', rawId: 3, categoryId: 1, categoryTitle: 'B', text: 'Third', count: 1, isFavorite: true },
  ];

  const favoritesOnly = filterAdhkar(items, 'favorites');
  assert.equal(favoritesOnly.length, 2);
  assert.deepEqual(favoritesOnly.map((i) => i.id), ['1_2', '1_3']);
});

test('filterAdhkar filters by category title', () => {
  const items = [
    { id: '1_1', rawId: 1, categoryId: 1, categoryTitle: 'أذكار الصباح', text: 'Morning', count: 1, isFavorite: false },
    { id: '2_1', rawId: 1, categoryId: 2, categoryTitle: 'أذكار المساء', text: 'Evening', count: 1, isFavorite: false },
  ];

  const morning = filterAdhkar(items, 'أذكار الصباح');
  assert.equal(morning.length, 1);
  assert.equal(morning[0].id, '1_1');
});

test('filterAdhkar searches text correctly', () => {
  const items = [
    { id: '1_1', rawId: 1, categoryId: 1, categoryTitle: 'A', text: 'اللهم بك أصبحنا', count: 1, isFavorite: false },
    { id: '1_2', rawId: 2, categoryId: 1, categoryTitle: 'A', text: 'سبحان الله وبحمده', count: 1, isFavorite: true },
  ];

  const result = filterAdhkar(items, 'all', 'أصبحنا');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1_1');
});

test('extractCategories merges duplicate category names and prepends all & favorites', () => {
  const items = parseRawAdhkar(rawData);
  const categories = extractCategories(items, 5);

  assert.equal(categories[0].id, 'all');
  assert.equal(categories[0].count, 159);

  assert.equal(categories[1].id, 'favorites');
  assert.equal(categories[1].count, 5);

  // In raw data, category 26 and 27 are both 'دعاء تفريج الهم والقلق' with 1 item each
  const hamCategory = categories.find((c) => c.title === 'دعاء تفريج الهم والقلق');
  assert.ok(hamCategory, 'Should have merged category');
  assert.equal(hamCategory.count, 2, 'Merged duplicate category should have 2 items');
});

test('shouldResetCounter handles 90-minute TTL and day changes', () => {
  const now = new Date('2026-11-13T12:00:00Z').getTime();

  // Completed 10 minutes ago -> should NOT reset
  const recent = { count: 33, completedAt: now - 10 * 60 * 1000, lastUpdatedAt: now - 10 * 60 * 1000 };
  assert.equal(shouldResetCounter(recent, now), false);

  // Completed 95 minutes ago -> SHOULD reset
  const expired = { count: 33, completedAt: now - 95 * 60 * 1000, lastUpdatedAt: now - 95 * 60 * 1000 };
  assert.equal(shouldResetCounter(expired, now), true);

  // Completed yesterday -> SHOULD reset
  const yesterday = new Date('2026-11-12T20:00:00Z').getTime();
  const pastDay = { count: 33, completedAt: yesterday, lastUpdatedAt: yesterday };
  assert.equal(shouldResetCounter(pastDay, now), true);
});

test('computeNextCounter increments and starts a new round when re-tapping completed item', () => {
  const now = 1000;
  const initial = { count: 0, completedAt: null, lastUpdatedAt: 0 };

  // 1st tap (max = 3)
  const step1 = computeNextCounter(initial, 3, now);
  assert.equal(step1.state.count, 1);
  assert.equal(step1.isJustCompleted, false);

  // 2nd tap
  const step2 = computeNextCounter(step1.state, 3, now + 100);
  assert.equal(step2.state.count, 2);
  assert.equal(step2.isJustCompleted, false);

  // 3rd tap (completed)
  const step3 = computeNextCounter(step2.state, 3, now + 200);
  assert.equal(step3.state.count, 3);
  assert.equal(step3.isJustCompleted, true);
  assert.equal(step3.state.completedAt, now + 200);

  // 4th tap (Re-tap on completed: begins fresh round 1)
  const step4 = computeNextCounter(step3.state, 3, now + 300);
  assert.equal(step4.state.count, 1);
  assert.equal(step4.isNewRound, true);
  assert.equal(step4.state.completedAt, null);
});

