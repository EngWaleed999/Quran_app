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

interface AudioState {
  selectedReciter: Reciter;
  repeatConfig: RepeatConfig;
  status: PlaybackStatus;
  activeMode: AudioActionMode;
  activeAyah: { suraNo: number; ayaNo: number } | null;
  target: PlaybackTarget | null;
  countdown: number;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  downloadMissingAyahs: PlaybackVerse[] | null;
  positionSeconds: number;
  durationSeconds: number;
  lastError: string | null;

  setSelectedReciter: (reciter: Reciter) => void;
  setRepeatConfig: (config: RepeatConfig) => void;
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
        onError: (message) => {
          console.error('[AudioStore] Engine error:', message);
          set({ status: 'error', lastError: message });
        },
      });

      return {
        selectedReciter: RECITERS[0],
        repeatConfig: { repeatCount: 3, pauseDelaySeconds: 2, verseGapDelaySeconds: 0, surahRepeatCount: 1 },
        status: 'idle',
        activeMode: 'tilawah',
        activeAyah: null,
        target: null,
        countdown: 0,
        isDownloading: false,
        downloadProgress: null,
        downloadMissingAyahs: null,
        positionSeconds: 0,
        durationSeconds: 0,
        lastError: null,

        setSelectedReciter: (reciter) => set({ selectedReciter: reciter }),
        setRepeatConfig: (config) => {
          const normalized: RepeatConfig = {
            repeatCount: Math.max(1, Math.floor(config.repeatCount)),
            pauseDelaySeconds: Math.max(0, config.pauseDelaySeconds),
            verseGapDelaySeconds: Math.max(0, config.verseGapDelaySeconds ?? 0),
            surahRepeatCount:
              config.surahRepeatCount === null
                ? null
                : Math.max(1, Math.floor(config.surahRepeatCount ?? 1)),
          };
          set({ repeatConfig: normalized });
          audioEngine.updateRepeatConfig(
            get().activeMode === 'repeat'
              ? normalized
              : { ...normalized, repeatCount: 1 }
          );
        },

        requestPlayback: async (target, mode) => {
          const { selectedReciter } = get();
          set({ activeMode: mode });
          set({
            target,
            status: 'checking_files',
            lastError: null,
            downloadProgress: null,
            isDownloading: false,
          });

          try {
            const { allDownloaded, missingAyahs } =
              await AudioDownloader.checkAyahsDownloaded(selectedReciter, target.verses);

            if (allDownloaded) {
              set({ downloadMissingAyahs: null });
              const savedConfig = get().repeatConfig;
              await audioEngine.startPlayback(
                selectedReciter,
                target,
                mode === 'repeat' ? savedConfig : { ...savedConfig, repeatCount: 1 }
              );
              return { needsDownload: false, missingAyahs: [] };
            }

            set({
              status: 'idle',
              downloadMissingAyahs: missingAyahs,
            });

            return { needsDownload: true, missingAyahs };
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'تعذر فحص الملفات الصوتية.';
            set({ status: 'error', lastError: message });
            return { needsDownload: true, missingAyahs: target.verses };
          }
        },

        startDownloadAndPlay: async (target, ayahsToDownload, mode) => {
          const { selectedReciter, repeatConfig } = get();
          set({ activeMode: mode });
          const activeToken = { isCancelled: false };
          cancellationToken = activeToken;

          set({
            target,
            isDownloading: true,
            status: 'downloading',
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
              mode === 'repeat' ? repeatConfig : { ...repeatConfig, repeatCount: 1 }
            );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'فشل تنزيل الملفات الصوتية.';
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
          Alafasy_128kbps: 'ar.alafasy',
          Husary_128kbps: 'ar.husary',
          Minshawy_Murattal_128kbps: 'ar.minshawi',
          Abdul_Basit_Murattal_192kbps: 'ar.abdulbasit',
          Hudhaify_128kbps: 'ar.hudhaify',
        };
        const migratedId = legacyReciterMap[previousReciterId] || previousReciterId;
        const selectedReciter =
          RECITERS.find((reciter) => reciter.id === migratedId) || RECITERS[0];

        return {
          ...persistedState,
          selectedReciter,
          repeatConfig: {
            repeatCount: Math.max(1, Number(persistedState?.repeatConfig?.repeatCount) || 3),
            pauseDelaySeconds: Math.max(0, Number(persistedState?.repeatConfig?.pauseDelaySeconds) || 0),
            verseGapDelaySeconds: Math.max(0, Number(persistedState?.repeatConfig?.verseGapDelaySeconds) || 0),
            surahRepeatCount:
              persistedState?.repeatConfig?.surahRepeatCount === null
                ? null
                : Math.max(1, Number(persistedState?.repeatConfig?.surahRepeatCount) || 1),
          },
        };
      },
      partialize: (state) => ({
        selectedReciter: state.selectedReciter,
        repeatConfig: state.repeatConfig,
      }),
    }
  )
);
