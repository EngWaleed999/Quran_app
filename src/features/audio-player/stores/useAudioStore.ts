import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DownloadProgress,
  PlaybackStatus,
  PlaybackTarget,
  PlaybackVerse,
  Reciter,
  RepeatConfig,
  AudioActionMode,
} from '../types/audio.types';
import { RECITERS } from '../services/recitersCatalog';
import { audioEngine } from '../services/audioPlayerEngine';
import { AudioDownloader } from '../services/audioDownloader';
import { getFriendlyAudioErrorMessage } from '../services/audioSourceAdapter';
import type { PlaybackDelayKind } from '../services/audioPlaybackRules';

interface AudioState {
  selectedReciter: Reciter;
  tilawahConfig: RepeatConfig;
  repeatModeConfig: RepeatConfig;
  repeatConfig: RepeatConfig;
  status: PlaybackStatus;
  activeMode: AudioActionMode;
  activeAyah: { suraNo: number; ayaNo: number } | null;
  target: PlaybackTarget | null;
  countdown: number;
  pendingDelayKind: PlaybackDelayKind;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  downloadMissingAyahs: PlaybackVerse[] | null;
  positionSeconds: number;
  durationSeconds: number;
  lastError: string | null;

  setSelectedReciter: (reciter: Reciter) => void;
  setRepeatConfig: (config: RepeatConfig, targetMode?: AudioActionMode) => void;
  setTilawahConfig: (config: RepeatConfig) => void;
  setRepeatModeConfig: (config: RepeatConfig) => void;
  requestPlayback: (target: PlaybackTarget, mode: AudioActionMode) => Promise<{
    needsDownload: boolean;
    missingAyahs: PlaybackVerse[];
  }>;
  startDownloadAndPlay: (
    target: PlaybackTarget,
    ayahsToDownload: PlaybackVerse[],
    mode: AudioActionMode
  ) => Promise<void>;
  cancelDownload: () => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlayback: () => Promise<void>;
  nextAyah: () => Promise<void>;
  previousAyah: () => Promise<void>;
  stop: () => Promise<void>;
}

let cancellationToken: { isCancelled: boolean } | null = null;

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => {
      audioEngine.setCallbacks({
        onStatusChange: (status) => set({ status }),
        onActiveAyahChange: (suraNo, ayaNo) =>
          set({ activeAyah: { suraNo, ayaNo }, positionSeconds: 0, durationSeconds: 0 }),
        onPositionUpdate: (positionSeconds, durationSeconds) =>
          set({ positionSeconds, durationSeconds }),
        onRepeatCountdown: (countdown) => set({ countdown }),
        onDelayKindChange: (pendingDelayKind) => set({ pendingDelayKind }),
        onError: (message) => {
          console.error('[AudioStore] Engine error:', message);
          set({ status: 'error', lastError: getFriendlyAudioErrorMessage(message) });
        },
      });

      return {
        selectedReciter: RECITERS[0],
        tilawahConfig: { repeatCount: 1, pauseDelaySeconds: 0, verseGapDelaySeconds: 0, surahRepeatCount: 1 },
        repeatModeConfig: { repeatCount: 3, pauseDelaySeconds: 2, verseGapDelaySeconds: 0, surahRepeatCount: 1 },
        repeatConfig: { repeatCount: 1, pauseDelaySeconds: 0, verseGapDelaySeconds: 0, surahRepeatCount: 1 },
        status: 'idle',
        activeMode: 'tilawah',
        activeAyah: null,
        target: null,
        countdown: 0,
        pendingDelayKind: null,
        isDownloading: false,
        downloadProgress: null,
        downloadMissingAyahs: null,
        positionSeconds: 0,
        durationSeconds: 0,
        lastError: null,

        setSelectedReciter: (reciter) => set({ selectedReciter: reciter }),
        setRepeatConfig: (config, targetMode) => {
          const mode = targetMode ?? get().activeMode;
          const normalized: RepeatConfig = {
            repeatCount: Math.max(1, Math.floor(config.repeatCount)),
            pauseDelaySeconds: Math.max(0, config.pauseDelaySeconds),
            verseGapDelaySeconds: Math.max(0, config.verseGapDelaySeconds ?? 0),
            surahRepeatCount:
              config.surahRepeatCount === null
                ? null
                : Math.max(1, Math.floor(config.surahRepeatCount ?? 1)),
          };

          if (mode === 'repeat') {
            set({ repeatModeConfig: normalized, repeatConfig: normalized });
            if (get().activeMode === 'repeat') {
              audioEngine.updateRepeatConfig(normalized);
            }
          } else {
            const tilawahNormalized: RepeatConfig = {
              ...normalized,
              repeatCount: 1,
              pauseDelaySeconds: 0,
            };
            set({ tilawahConfig: tilawahNormalized, repeatConfig: tilawahNormalized });
            if (get().activeMode === 'tilawah') {
              audioEngine.updateRepeatConfig(tilawahNormalized);
            }
          }
        },
        setTilawahConfig: (config) => get().setRepeatConfig(config, 'tilawah'),
        setRepeatModeConfig: (config) => get().setRepeatConfig(config, 'repeat'),

        requestPlayback: async (target, mode) => {
          const { selectedReciter, tilawahConfig, repeatModeConfig } = get();
          const effectiveConfig = mode === 'repeat' ? repeatModeConfig : tilawahConfig;
          set({
            activeMode: mode,
            repeatConfig: effectiveConfig,
            target,
            status: 'checking_files',
            pendingDelayKind: null,
            lastError: null,
            downloadProgress: null,
            isDownloading: false,
          });

          try {
            const { allDownloaded, missingAyahs } =
              await AudioDownloader.checkAyahsDownloaded(selectedReciter, target.verses);

            if (allDownloaded) {
              set({ downloadMissingAyahs: null });
              await audioEngine.startPlayback(
                selectedReciter,
                target,
                effectiveConfig
              );
              return { needsDownload: false, missingAyahs: [] };
            }

            set({
              status: 'idle',
              downloadMissingAyahs: missingAyahs,
            });

            return { needsDownload: true, missingAyahs };
          } catch (error) {
            const message = getFriendlyAudioErrorMessage(error);
            set({ status: 'error', lastError: message });
            return { needsDownload: true, missingAyahs: target.verses };
          }
        },

        startDownloadAndPlay: async (target, ayahsToDownload, mode) => {
          const { selectedReciter, tilawahConfig, repeatModeConfig } = get();
          const effectiveConfig = mode === 'repeat' ? repeatModeConfig : tilawahConfig;
          set({ activeMode: mode, repeatConfig: effectiveConfig });
          const activeToken = { isCancelled: false };
          cancellationToken = activeToken;

          set({
            target,
            isDownloading: true,
            status: 'downloading',
            pendingDelayKind: null,
            lastError: null,
            downloadProgress: {
              current: 0,
              total: ayahsToDownload.length,
              percentage: ayahsToDownload.length === 0 ? 100 : 0,
              currentAyahName: 'بدء تنزيل السورة...',
            },
          });

          try {
            const success = await AudioDownloader.downloadAyahs(
              selectedReciter,
              target.suraNo,
              target.suraName,
              ayahsToDownload,
              (progress) => set({ downloadProgress: progress }),
              activeToken
            );

            if (!success || activeToken.isCancelled) {
              set({
                isDownloading: false,
                status: 'idle',
                downloadProgress: null,
              });
              return;
            }

            set({
              isDownloading: false,
              downloadMissingAyahs: null,
              downloadProgress: {
                current: ayahsToDownload.length,
                total: ayahsToDownload.length,
                percentage: 100,
                currentAyahName: 'اكتمل تنزيل المقاطع الصوتية',
              },
            });

            await audioEngine.startPlayback(
              selectedReciter,
              target,
              effectiveConfig
            );
          } catch (error) {
            const message = getFriendlyAudioErrorMessage(error);
            console.error('[AudioStore] Download error:', error);
            set({
              isDownloading: false,
              status: 'error',
              lastError: message,
            });
          } finally {
            if (cancellationToken === activeToken) {
              cancellationToken = null;
            }
          }
        },

        cancelDownload: () => {
          if (cancellationToken) cancellationToken.isCancelled = true;
          set({
            isDownloading: false,
            status: 'idle',
            downloadProgress: null,
          });
        },

        pause: async () => {
          await audioEngine.pause();
        },

        resume: async () => {
          await audioEngine.resume();
        },

        togglePlayback: async () => {
          const status = get().status;
          if (status === 'playing' || status === 'waiting_user_repeat') {
            await audioEngine.pause();
          } else if (status === 'paused') {
            await audioEngine.resume();
          }
        },

        nextAyah: async () => {
          await audioEngine.nextAyah();
        },

        previousAyah: async () => {
          await audioEngine.previousAyah();
        },

        stop: async () => {
          if (cancellationToken) cancellationToken.isCancelled = true;
          await audioEngine.stop();
          set({
            activeAyah: null,
            status: 'idle',
            activeMode: 'tilawah',
            target: null,
            countdown: 0,
            pendingDelayKind: null,
            isDownloading: false,
            downloadProgress: null,
            downloadMissingAyahs: null,
            positionSeconds: 0,
            durationSeconds: 0,
          });
        },
      };
    },
    {
      name: 'quran-audio-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persistedState: any) => {
        const previousReciterId = persistedState?.selectedReciter?.id;
        const legacyReciterMap: Record<string, string> = {
          'ar.alafasy': 'everyayah_Alafasy_64kbps',
          'ar.husary': 'everyayah_Husary_64kbps',
          'ar.minshawi': 'everyayah_Minshawy_Murattal_128kbps',
          'ar.abdulbasit': 'everyayah_Abdul_Basit_Murattal_64kbps',
          'ar.hudhaify': 'everyayah_Hudhaify_64kbps',
          'ar.shuraim': 'everyayah_Saood_ash-Shuraym_64kbps',
          Alafasy_128kbps: 'everyayah_Alafasy_64kbps',
          Husary_128kbps: 'everyayah_Husary_64kbps',
          Minshawy_Murattal_128kbps: 'everyayah_Minshawy_Murattal_128kbps',
          Abdul_Basit_Murattal_192kbps: 'everyayah_Abdul_Basit_Murattal_64kbps',
          Hudhaify_128kbps: 'everyayah_Hudhaify_64kbps',
        };
        const candidateId = legacyReciterMap[previousReciterId] || previousReciterId;
        const selectedReciter =
          RECITERS.find((reciter) => reciter.id === candidateId) || RECITERS[0];

        const rawRepeat = persistedState?.repeatConfig;
        const tilawahConfig: RepeatConfig = persistedState?.tilawahConfig ?? {
          repeatCount: 1,
          pauseDelaySeconds: 0,
          verseGapDelaySeconds: Math.max(0, Number(rawRepeat?.verseGapDelaySeconds) || 0),
          surahRepeatCount:
            rawRepeat?.surahRepeatCount === null
              ? null
              : Math.max(1, Number(rawRepeat?.surahRepeatCount) || 1),
        };

        const repeatModeConfig: RepeatConfig = persistedState?.repeatModeConfig ?? {
          repeatCount: Math.max(1, Number(rawRepeat?.repeatCount) || 3),
          pauseDelaySeconds: Math.max(0, Number(rawRepeat?.pauseDelaySeconds) || 2),
          verseGapDelaySeconds: Math.max(0, Number(rawRepeat?.verseGapDelaySeconds) || 0),
          surahRepeatCount:
            rawRepeat?.surahRepeatCount === null
              ? null
              : Math.max(1, Number(rawRepeat?.surahRepeatCount) || 1),
        };

        return {
          ...persistedState,
          selectedReciter,
          tilawahConfig,
          repeatModeConfig,
          repeatConfig: persistedState?.activeMode === 'repeat' ? repeatModeConfig : tilawahConfig,
        };
      },
      partialize: (state) => ({
        selectedReciter: state.selectedReciter,
        tilawahConfig: state.tilawahConfig,
        repeatModeConfig: state.repeatModeConfig,
        repeatConfig: state.repeatConfig,
      }),
    }
  )
);
