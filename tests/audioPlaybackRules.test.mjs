import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPlaybackAdvance,
  getPreviousAyahIndex,
  shouldRepeatCurrentAyah,
} from '../src/features/audio-player/services/audioPlaybackRules.ts';

test('previous track never moves before the ayah selected as playback start', () => {
  assert.equal(getPreviousAyahIndex(12, 5), 11);
  assert.equal(getPreviousAyahIndex(6, 5), 5);
  assert.equal(getPreviousAyahIndex(5, 5), 5);
});

test('previous track rejects invalid ranges', () => {
  assert.throws(() => getPreviousAyahIndex(2, 5));
  assert.throws(() => getPreviousAyahIndex(1.5, 0));
});

test('advances within the selected surah before considering a repeat', () => {
  assert.deepEqual(
    getPlaybackAdvance(6, 4, 10, 1, 3),
    { nextIndex: 7, startsNewCycle: false }
  );
});

test('finite surah repeat restarts from the chosen starting ayah', () => {
  assert.deepEqual(
    getPlaybackAdvance(10, 4, 10, 1, 3),
    { nextIndex: 4, startsNewCycle: true }
  );
  assert.deepEqual(
    getPlaybackAdvance(10, 4, 10, 3, 3),
    { nextIndex: null, startsNewCycle: false }
  );
});

test('infinite surah repeat keeps looping from the chosen starting ayah', () => {
  assert.deepEqual(
    getPlaybackAdvance(10, 4, 10, 120, null),
    { nextIndex: 4, startsNewCycle: true }
  );
});

test('repeat count includes the first play', () => {
  assert.equal(shouldRepeatCurrentAyah(0, 1), true);
  assert.equal(shouldRepeatCurrentAyah(1, 1), false);
  assert.equal(shouldRepeatCurrentAyah(2, 3), true);
  assert.equal(shouldRepeatCurrentAyah(3, 3), false);
});
