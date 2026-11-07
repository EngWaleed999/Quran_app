import {
  clearAllPreloadedSources,
  clearPreloadedSource,
  createAudioPlayer,
  preload,
  setAudioModeAsync,
  AudioPlayer,
  AudioStatus,
} from 'expo-audio';
import { AudioDownloader } from './audioDownloader';
import {
  PlaybackStatus,
  PlaybackTarget,
  Reciter,
  RepeatConfig,
} from '../types/audio.types';

export interface AudioEngineCallbacks {
  onStatusChange: (status: PlaybackStatus) => void;
  onActiveAyahChange: (suraNo: number, ayaNo: number) => void;
  onPositionUpdate?: (currentSeconds: number, durationSeconds: number) => void;
  onRepeatCountdown?: (secondsRemaining: number) => void;
  onError: (errorMessage: string) => void;
}

/**
 * Keeps one native player alive and preloads at most one following ayah.
 * This bounds Expo Audio's in-memory preload cache instead of accumulating
 * every clip in a long surah on Android.
 */
export class AudioPlayerEngine {
  private player: AudioPlayer | null = null;
  private statusSubscription: { remove: () => void } | null = null;
  private isEngineRunning = false;
  private target: PlaybackTarget | null = null;
  private reciter: Reciter | null = null;
  private tracks: PlaybackTarget['verses'] = [];
  private currentIndex = 0;
  private startIndex = 0;
  private completedSurahPlays = 1;
  private currentAyahRepeatCount = 0;
  private repeatConfig: RepeatConfig = { repeatCount: 1, pauseDelaySeconds: 0, surahRepeatCount: 1 };
  private callbacks: AudioEngineCallbacks | null = null;
  private delayTimer: ReturnType<typeof setTimeout> | null = null;
  private delayInterval: ReturnType<typeof setInterval> | null = null;
  private delayEndsAt = 0;
  private remainingDelayMs = 0;
  private handlingFinishedEvent = false;
  private audioModePromise: Promise<void>;
  private preloadedUri: string | null = null;
  private activePreloadedUri: string | null = null;

  constructor() {
    this.audioModePromise = setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      allowsRecording: false,
    }).catch((error) => {
      console.warn('[AudioEngine] Could not configure audio mode:', error);
    });
  }

  setCallbacks(callbacks: AudioEngineCallbacks): void {
    this.callbacks = callbacks;
  }

  updateRepeatConfig(config: RepeatConfig): void {
    this.repeatConfig = {
      repeatCount: Math.max(1, Math.floor(config.repeatCount)),
      pauseDelaySeconds: Math.max(0, config.pauseDelaySeconds),
      verseGapDelaySeconds: Math.max(0, config.verseGapDelaySeconds ?? 0),
      surahRepeatCount: config.surahRepeatCount === null
        ? null
        : Math.max(1, Math.floor(config.surahRepeatCount ?? 1)),
    };
  }

  private ensurePlayer(): AudioPlayer {
    if (this.player) return this.player;

    const player = createAudioPlayer(null, { updateInterval: 100 });
    this.player = player;
    this.statusSubscription = player.addListener(
      'playbackStatusUpdate',
      this.onPlaybackStatusUpdate
    );

    return player;
  }

  async startPlayback(
    reciter: Reciter,
    target: PlaybackTarget,
    repeatConfig: RepeatConfig
  ): Promise<void> {
    await this.stop(false);
    await this.audioModePromise;

    const startIndex = target.verses.findIndex(
      (verse) => verse.ayaNo === target.startAyah && verse.suraNo === target.suraNo
    );

    if (target.verses.length === 0 || startIndex < 0) {
      this.callbacks?.onError('لا توجد آيات صوتية صالحة للتشغيل في هذه السورة.');
      return;
    }

    this.target = target;
    this.reciter = reciter;
    this.tracks = target.verses;
    this.startIndex = startIndex;
    this.currentIndex = startIndex;
    this.completedSurahPlays = 1;
    this.currentAyahRepeatCount = 0;
    this.updateRepeatConfig(repeatConfig);
    this.isEngineRunning = true;

    this.playCurrentAyah();
  }

  private getCurrentTrack() {
    return this.tracks[this.currentIndex] || null;
  }

  private releaseFinishedPreload(): void {
    if (!this.activePreloadedUri) return;

    const finishedUri = this.activePreloadedUri;
    this.activePreloadedUri = null;
    clearPreloadedSource({ uri: finishedUri }).catch(() => undefined);
  }

  private playCurrentAyah(): void {
    if (!this.isEngineRunning || !this.reciter || !this.target) return;

    const track = this.getCurrentTrack();
    if (!track) {
      this.completePlayback();
      return;
    }

    this.handlingFinishedEvent = false;
    this.remainingDelayMs = 0;
    this.callbacks?.onActiveAyahChange(track.suraNo, track.ayaNo);
    this.callbacks?.onPositionUpdate?.(0, 0);

    try {
      const player = this.ensurePlayer();
      const localUri = AudioDownloader.getLocalAyahUri(
        this.reciter.id,
        track.suraNo,
        track.ayaNo
      );

      // A preloaded next ayah has now become the active player source.
      // A stale preload is released in the background without blocking execution.
      if (this.preloadedUri === localUri) {
        this.activePreloadedUri = localUri;
        this.preloadedUri = null;
      } else {
        if (this.preloadedUri) {
          clearPreloadedSource({ uri: this.preloadedUri }).catch(() => undefined);
          this.preloadedUri = null;
        }
        this.activePreloadedUri = null;
      }

      player.replace({ uri: localUri });
      // تفعيل شاشة القفل متاح فقط في حزم الإنتاج المخصصة (Standalone APK) لوجود Foreground Service
      // في Expo Go يتم تخطيه لمنع خطأ Service binding failed
      if (__DEV__ === false) {
        try {
          player.setActiveForLockScreen(true, {
            title: 'سورة ' + this.target.suraName + ' • الآية ' + track.ayaNo,
            artist: this.reciter.name,
            albumTitle: 'القرآن الكريم',
          });
        } catch {
          // تجاهل آمن في بيئات التطوير
        }
      }
      player.play();

      void this.preloadUpcomingAyah();
      this.callbacks?.onStatusChange('playing');
    } catch (error) {
      console.error('[AudioEngine] Could not play ayah:', error);
      this.callbacks?.onError('تعذر تشغيل الملف الصوتي. أعد تنزيل السورة ثم حاول مرة أخرى.');
      void this.stop();
    }
  }

  private async preloadUpcomingAyah(): Promise<void> {
    if (!this.isEngineRunning || !this.reciter || !this.tracks.length) return;

    // Replaying the same local clip does not need a second preload allocation.
    const willRepeatCurrent =
      this.currentAyahRepeatCount + 1 < this.repeatConfig.repeatCount;
    if (willRepeatCurrent) return;

    const scheduledIndex = this.currentIndex;
    const nextTrack = this.tracks[scheduledIndex + 1] ?? (
      scheduledIndex === this.tracks.length - 1 &&
      (this.repeatConfig.surahRepeatCount === null ||
        this.completedSurahPlays < this.repeatConfig.surahRepeatCount)
        ? this.tracks[this.startIndex]
        : undefined
    );
    if (!nextTrack) return;

    const nextUri = AudioDownloader.getLocalAyahUri(
      this.reciter.id,
      nextTrack.suraNo,
      nextTrack.ayaNo
    );

    if (this.preloadedUri === nextUri) return;

    if (this.preloadedUri) {
      await clearPreloadedSource({ uri: this.preloadedUri }).catch(() => undefined);
      this.preloadedUri = null;
    }

    try {
      await preload({ uri: nextUri });

      // Playback may have advanced while the native preload promise was pending.
      if (!this.isEngineRunning || this.currentIndex !== scheduledIndex) {
        await clearPreloadedSource({ uri: nextUri }).catch(() => undefined);
        return;
      }

      this.preloadedUri = nextUri;
    } catch (error) {
      console.warn('[AudioEngine] Preload skipped:', error);
    }
  }

  private onPlaybackStatusUpdate = (status: AudioStatus): void => {
    this.callbacks?.onPositionUpdate?.(
      Number.isFinite(status.currentTime) ? status.currentTime : 0,
      Number.isFinite(status.duration) ? status.duration : 0
    );

    if (status.error) {
      this.callbacks?.onError('حدث خطأ أثناء تشغيل التلاوة.');
      void this.stop();
      return;
    }

    if (status.didJustFinish && !this.handlingFinishedEvent) {
      this.handlingFinishedEvent = true;
      this.handleAyahFinished();
    }
  };

  private handleAyahFinished(): void {
    if (!this.isEngineRunning) return;

    this.releaseFinishedPreload();
    this.currentAyahRepeatCount += 1;

    if (this.currentAyahRepeatCount < this.repeatConfig.repeatCount) {
      if (this.repeatConfig.pauseDelaySeconds > 0) {
        this.beginRepeatDelay(this.repeatConfig.pauseDelaySeconds * 1000);
      } else {
        this.playCurrentAyah();
      }
      return;
    }

    this.currentAyahRepeatCount = 0;
    if (this.currentIndex < this.tracks.length - 1) {
      this.currentIndex += 1;
      const verseGap = this.repeatConfig.verseGapDelaySeconds ?? 0;
      if (verseGap > 0) {
        this.beginRepeatDelay(verseGap * 1000);
      } else {
        this.playCurrentAyah();
      }
    } else {
      const repeatLimit = this.repeatConfig.surahRepeatCount;
      if (repeatLimit === null || this.completedSurahPlays < repeatLimit) {
        this.completedSurahPlays += 1;
        this.currentIndex = this.startIndex;
        this.playCurrentAyah();
      } else {
        this.completePlayback();
      }
    }
  }

  private beginRepeatDelay(durationMs: number): void {
    this.clearDelayTimers();
    this.remainingDelayMs = durationMs;
    this.delayEndsAt = Date.now() + durationMs;
    this.callbacks?.onStatusChange('waiting_user_repeat');
    this.callbacks?.onRepeatCountdown?.(Math.ceil(durationMs / 1000));

    this.delayInterval = setInterval(() => {
      const remaining = Math.max(0, this.delayEndsAt - Date.now());
      this.callbacks?.onRepeatCountdown?.(Math.ceil(remaining / 1000));
    }, 250);

    this.delayTimer = setTimeout(() => {
      this.clearDelayTimers();
      this.remainingDelayMs = 0;
      if (this.isEngineRunning) {
        void this.playCurrentAyah();
      }
    }, durationMs);
  }

  private clearDelayTimers(): void {
    if (this.delayTimer) clearTimeout(this.delayTimer);
    if (this.delayInterval) clearInterval(this.delayInterval);
    this.delayTimer = null;
    this.delayInterval = null;
  }

  async pause(): Promise<void> {
    if (!this.isEngineRunning) return;

    if (this.delayTimer) {
      this.remainingDelayMs = Math.max(0, this.delayEndsAt - Date.now());
      this.clearDelayTimers();
    } else {
      this.player?.pause();
    }

    this.callbacks?.onStatusChange('paused');
  }

  async resume(): Promise<void> {
    if (!this.isEngineRunning) return;

    if (this.remainingDelayMs > 0) {
      this.beginRepeatDelay(this.remainingDelayMs);
    } else {
      this.player?.play();
      this.callbacks?.onStatusChange('playing');
    }
  }

  async nextAyah(): Promise<void> {
    if (!this.isEngineRunning || this.currentIndex >= this.tracks.length - 1) return;
    this.clearDelayTimers();
    this.releaseFinishedPreload();
    this.currentAyahRepeatCount = 0;
    this.currentIndex += 1;
    this.playCurrentAyah();
  }

  async previousAyah(): Promise<void> {
    if (!this.isEngineRunning || this.currentIndex <= this.startIndex) {
      if (this.isEngineRunning && this.currentIndex === this.startIndex) {
        this.playCurrentAyah();
      }
      return;
    }

    const currentTime = this.player?.currentTime ?? 0;
    if (currentTime > 3) {
      this.releaseFinishedPreload();
      this.playCurrentAyah();
      return;
    }

    this.clearDelayTimers();
    this.releaseFinishedPreload();
    this.currentAyahRepeatCount = 0;
    this.currentIndex -= 1;
    this.playCurrentAyah();
  }

  private completePlayback(): void {
    this.isEngineRunning = false;
    this.clearDelayTimers();
    this.player?.pause();
    if (__DEV__ === false) {
      try {
        this.player?.setActiveForLockScreen(false);
      } catch {
        // ignore
      }
    }
    this.callbacks?.onRepeatCountdown?.(0);
    this.callbacks?.onStatusChange('completed');
    this.preloadedUri = null;
    this.activePreloadedUri = null;
    void clearAllPreloadedSources().catch(() => undefined);
  }

  async stop(notify = true): Promise<void> {
    this.isEngineRunning = false;
    this.clearDelayTimers();
    this.remainingDelayMs = 0;
    this.preloadedUri = null;
    this.activePreloadedUri = null;

    if (this.player) {
      try {
        this.player.pause();
        this.player.setActiveForLockScreen(false);
        this.statusSubscription?.remove();
        this.statusSubscription = null;
        this.player.remove();
      } catch {
        // Native player may already have released during an interruption.
      }
      this.player = null;
    }

    await clearAllPreloadedSources().catch(() => undefined);
    this.callbacks?.onRepeatCountdown?.(0);

    if (notify) {
      this.callbacks?.onStatusChange('idle');
    }
  }
}

export const audioEngine = new AudioPlayerEngine();
