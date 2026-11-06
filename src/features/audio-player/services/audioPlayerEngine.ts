import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import { AudioDownloader } from './audioDownloader';
import { PlaybackStatus, RepeatConfig } from '../types/audio.types';

export interface AudioEngineCallbacks {
  onStatusChange: (status: PlaybackStatus) => void;
  onActiveAyahChange: (suraNo: number, ayaNo: number) => void;
  onRepeatCountdown?: (secondsRemaining: number) => void;
  onError: (errorMessage: string) => void;
}

/**
 * Modern Audio Player Engine powered by Expo SDK 58 `expo-audio`.
 * Manages native lifecycle, status subscriptions, repeat delays,
 * and seamless sequential ayah-by-ayah playback.
 */
export class AudioPlayerEngine {
  private player: AudioPlayer | null = null;
  private statusSubscription: { remove: () => void } | null = null;
  private isEngineRunning: boolean = false;
  private currentSuraNo: number = 0;
  private currentAyahNo: number = 0;
  private endAyahNo: number = 0;
  private currentAyahRepeatCount: number = 0;
  private repeatConfig: RepeatConfig = { repeatCount: 1, pauseDelaySeconds: 0 };
  private reciterFolder: string = '';
  private callbacks: AudioEngineCallbacks | null = null;
  private delayTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.configureAudioMode();
  }

  /**
   * Configures global native audio mode for uninterrupted playback and background audio support.
   */
  private async configureAudioMode() {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
        allowsRecording: false,
      });
    } catch (e) {
      console.warn('[AudioEngine] Could not set audio mode:', e);
    }
  }

  setCallbacks(callbacks: AudioEngineCallbacks) {
    this.callbacks = callbacks;
  }

  async startPlayback(
    reciterFolder: string,
    suraNo: number,
    startAyah: number,
    endAyah: number,
    repeatConfig: RepeatConfig
  ) {
    await this.stop();

    this.reciterFolder = reciterFolder;
    this.currentSuraNo = suraNo;
    this.currentAyahNo = startAyah;
    this.endAyahNo = endAyah;
    this.repeatConfig = repeatConfig;
    this.currentAyahRepeatCount = 0;
    this.isEngineRunning = true;

    await this.playCurrentAyah();
  }

  private async playCurrentAyah() {
    if (!this.isEngineRunning) return;

    this.callbacks?.onActiveAyahChange(this.currentSuraNo, this.currentAyahNo);
    this.callbacks?.onStatusChange('playing');

    const localUri = AudioDownloader.getLocalAyahUri(
      this.reciterFolder,
      this.currentSuraNo,
      this.currentAyahNo
    );

    try {
      // Clean up previous native player instance to prevent memory leaks
      if (this.player) {
        this.statusSubscription?.remove();
        this.statusSubscription = null;
        try {
          this.player.remove();
        } catch {
          // Ignore release errors
        }
        this.player = null;
      }

      const player = createAudioPlayer({ uri: localUri });
      this.player = player;

      this.statusSubscription = player.addListener(
        'playbackStatusUpdate',
        this.onPlaybackStatusUpdate
      );

      player.play();
    } catch (error) {
      console.error('[AudioEngine] Error playing local audio file with expo-audio:', error);
      this.callbacks?.onError('تعذر تشغيل الملف الصوتي المحلي للآية.');
      await this.stop();
    }
  }

  private onPlaybackStatusUpdate = async (status: AudioStatus) => {
    if (status.error) {
      console.error('[AudioEngine] Playback error from expo-audio:', status.error);
      this.callbacks?.onError('حدث خطأ أثناء التلاوة.');
      await this.stop();
      return;
    }

    if (status.didJustFinish) {
      await this.handleAyahFinished();
    }
  };

  private async handleAyahFinished() {
    if (!this.isEngineRunning) return;

    this.currentAyahRepeatCount++;

    // Check if we need more repeats for the current Ayah
    if (this.currentAyahRepeatCount < this.repeatConfig.repeatCount) {
      if (this.repeatConfig.pauseDelaySeconds > 0) {
        await this.startUserRepeatDelay();
      } else {
        await this.playCurrentAyah();
      }
      return;
    }

    // Finished all repeats for current Ayah; reset counter and advance
    this.currentAyahRepeatCount = 0;

    if (this.currentAyahNo < this.endAyahNo) {
      this.currentAyahNo++;
      await this.playCurrentAyah();
    } else {
      // Reached the end of the requested range
      this.callbacks?.onStatusChange('completed');
      await this.stop();
    }
  }

  private async startUserRepeatDelay() {
    this.callbacks?.onStatusChange('waiting_user_repeat');
    let remaining = this.repeatConfig.pauseDelaySeconds;
    this.callbacks?.onRepeatCountdown?.(remaining);

    const interval = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        this.callbacks?.onRepeatCountdown?.(remaining);
      } else {
        clearInterval(interval);
      }
    }, 1000);

    this.delayTimer = setTimeout(async () => {
      clearInterval(interval);
      if (this.isEngineRunning) {
        await this.playCurrentAyah();
      }
    }, this.repeatConfig.pauseDelaySeconds * 1000);
  }

  async pause() {
    if (this.player) {
      this.player.pause();
      this.callbacks?.onStatusChange('paused');
    }
  }

  async resume() {
    if (this.player) {
      this.player.play();
      this.callbacks?.onStatusChange('playing');
    }
  }

  async stop() {
    this.isEngineRunning = false;
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.player) {
      try {
        this.player.pause();
        this.statusSubscription?.remove();
        this.statusSubscription = null;
        this.player.remove();
      } catch (e) {
        // ignore unload/release errors if already released
      }
      this.player = null;
    }
    this.callbacks?.onStatusChange('idle');
  }
}

// Singleton audio engine instance
export const audioEngine = new AudioPlayerEngine();
