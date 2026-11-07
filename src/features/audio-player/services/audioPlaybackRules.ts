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
    return { nextIndex: startIndex, startsNewCycle: true };
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
