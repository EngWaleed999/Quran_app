import { Audio } from 'expo-av';
import { AudioDownloader } from './audioDownloader';
import { PlaybackStatus, RepeatConfig } from '../types/audio.types';

export interface AudioEngineCallbacks {
  onStatusChange: (status: PlaybackStatus) => void;
  onActiveAyahChange: (suraNo: number, ayaNo: number) => void;
  onRepeatCountdown?: (secondsRemaining: number) => void;
  onError: (errorMessage: string) => void;
}

export class AudioPlayerEngine {
  private sound: Audio.Sound | null = null;
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

  private async configureAudioMode() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
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
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: localUri },
        { shouldPlay: true },
        this.onPlaybackStatusUpdate
      );

      this.sound = sound;
    } catch (error) {
      console.error('[AudioEngine] Error playing local audio file:', error);
      this.callbacks?.onError('تعذر تشغيل الملف الصوتي المحلي للآية.');
      await this.stop();
    }
  }

  private onPlaybackStatusUpdate = async (status: any) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error('[AudioEngine] Playback error:', status.error);
        this.callbacks?.onError('حدث خطأ أثناء التلاوة.');
      }
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
    if (this.sound) {
      await this.sound.pauseAsync();
      this.callbacks?.onStatusChange('paused');
    }
  }

  async resume() {
    if (this.sound) {
      await this.sound.playAsync();
      this.callbacks?.onStatusChange('playing');
    }
  }

  async stop() {
    this.isEngineRunning = false;
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      } catch (e) {
        // ignore unload errors if already released
      }
      this.sound = null;
    }
    this.callbacks?.onStatusChange('idle');
  }
}

// Singleton audio engine instance
export const audioEngine = new AudioPlayerEngine();
