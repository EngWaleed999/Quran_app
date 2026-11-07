export interface PlaybackAdvance {
  nextIndex: number | null;
  startsNewCycle: boolean;
}

/** Do not allow previous-track navigation to cross the user's chosen start ayah. */
export function getPreviousAyahIndex(currentIndex: number, startIndex: number): number {
  if (!Number.isInteger(currentIndex) || !Number.isInteger(startIndex)) {
    throw new Error('Audio track indices must be integers');
  }
  if (startIndex < 0 || currentIndex < startIndex) {
    throw new Error('Audio track index is outside the selected playback range');
  }
  return Math.max(startIndex, currentIndex - 1);
}

/** Compute the next track or the start of the next selected-surah pass. */
export function getPlaybackAdvance(
  currentIndex: number,
  startIndex: number,
  lastIndex: number,
  completedPasses: number,
  passLimit: number | null
): PlaybackAdvance {
  if (
    !Number.isInteger(currentIndex) ||
    !Number.isInteger(startIndex) ||
    !Number.isInteger(lastIndex) ||
    startIndex < 0 ||
    currentIndex < startIndex ||
    lastIndex < currentIndex
  ) {
    throw new Error('Invalid audio playback range');
  }
  if (!Number.isInteger(completedPasses) || completedPasses < 1) {
    throw new Error('completedPasses must be a positive integer');
  }
  if (passLimit !== null && (!Number.isInteger(passLimit) || passLimit < 1)) {
    throw new Error('passLimit must be a positive integer or null');
  }

  if (currentIndex < lastIndex) {
    return { nextIndex: currentIndex + 1, startsNewCycle: false };
  }

  if (passLimit === null || completedPasses < passLimit) {
    return { nextIndex: 0, startsNewCycle: true };
  }

  return { nextIndex: null, startsNewCycle: false };
}

export function shouldRepeatCurrentAyah(
  completedRepetitions: number,
  totalRepetitions: number
): boolean {
  if (!Number.isInteger(completedRepetitions) || completedRepetitions < 0) {
    throw new Error('completedRepetitions must be a non-negative integer');
  }
  if (!Number.isInteger(totalRepetitions) || totalRepetitions < 1) {
    throw new Error('totalRepetitions must be a positive integer');
  }
  return completedRepetitions < totalRepetitions;
}

export type PlaybackDelayKind = 'ayah-repeat' | 'verse-gap' | null;

/**
 * Resolve manual Previous semantics against the verse currently shown to the
 * user. During a verse gap, currentIndex already points at the upcoming verse,
 * while the player/UI still refer to the verse that just finished.
 */
export function getManualPreviousIndex(
  currentIndex: number,
  startIndex: number,
  playheadSeconds: number,
  delayKind: PlaybackDelayKind
): number {
  if (
    !Number.isInteger(currentIndex) ||
    !Number.isInteger(startIndex) ||
    startIndex < 0 ||
    currentIndex < startIndex ||
    !Number.isFinite(playheadSeconds) ||
    playheadSeconds < 0
  ) {
    throw new Error('Invalid playback position');
  }

  if (delayKind === 'verse-gap') {
    return Math.max(startIndex, currentIndex - 1);
  }
  if (delayKind === 'ayah-repeat' || playheadSeconds > 3 || currentIndex <= startIndex) {
    return currentIndex;
  }
  return Math.max(startIndex, currentIndex - 1);
}

/** During a verse gap, the pending index is already the next verse. */
export function getManualNextIndex(
  currentIndex: number,
  lastIndex: number,
  delayKind: PlaybackDelayKind
): number | null {
  if (
    !Number.isInteger(currentIndex) ||
    !Number.isInteger(lastIndex) ||
    currentIndex < 0 ||
    lastIndex < currentIndex
  ) {
    throw new Error('Invalid playback range');
  }

  if (delayKind === 'verse-gap') return currentIndex;
  return currentIndex < lastIndex ? currentIndex + 1 : null;
}
