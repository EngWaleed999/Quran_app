import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBookmarkId,
  normalizeBookmarks,
  removeBookmarkById,
  removeBookmarksByType,
  upsertBookmark,
} from '../src/features/bookmarks/services/bookmarkRules.ts';

function bookmark(type, verseKey, createdAt = 100) {
  const [suraNo, ayaNo] = verseKey.split(':').map(Number);
  return {
    id: createBookmarkId(type, verseKey),
    type,
    verseKey,
    suraNo,
    ayaNo,
    page: 1,
    suraName: 'الفاتحة',
    ayahText: 'بسم الله',
    createdAt,
  };
}

test('allows multiple bookmarks of the same type on different verses', () => {
  const first = bookmark('reading', '1:1');
  const second = bookmark('reading', '1:2');
  const result = upsertBookmark([first], second);

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.verseKey).sort(), ['1:1', '1:2']);
});

test('upserts a category and verse pair without duplicates', () => {
  const first = bookmark('tracking', '2:3', 100);
  const updated = bookmark('tracking', '2:3', 200);
  const result = upsertBookmark([first], updated);

  assert.equal(result.length, 1);
  assert.equal(result[0].createdAt, 100);
  assert.equal(result[0].id, 'tracking:2:3');
});

test('deletes only the selected bookmark id', () => {
  const first = bookmark('memorization', '2:1');
  const second = bookmark('memorization', '2:2');
  const result = removeBookmarkById([first, second], first.id);

  assert.deepEqual(result.map((item) => item.id), [second.id]);
});

test('category-wide removal is explicit and does not affect other categories', () => {
  const items = [
    bookmark('tracking', '1:1'),
    bookmark('reading', '1:2'),
    bookmark('memorization', '1:3'),
  ];
  const result = removeBookmarksByType(items, 'reading');

  assert.deepEqual(result.map((item) => item.type), ['tracking', 'memorization']);
});

test('legacy records without ids migrate to stable ids and preserve duplicates safely', () => {
  const old = [
    { ...bookmark('reading', '3:4', 100), id: undefined },
    { ...bookmark('reading', '3:4', 200), id: undefined },
    { ...bookmark('reading', '3:5', 150), id: undefined },
  ];
  const result = normalizeBookmarks(old);

  assert.equal(result.length, 2);
  assert.equal(result.find((item) => item.verseKey === '3:4')?.createdAt, 200);
  assert.equal(result.find((item) => item.verseKey === '3:4')?.id, 'reading:3:4');
});
