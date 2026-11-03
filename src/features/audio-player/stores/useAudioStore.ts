import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Reciter, PlaybackStatus, RepeatConfig, PlaybackTarget, DownloadProgress } from '../types/audio.types';
import { RECITERS } from '../services/recitersCatalog';
import { audioEngine } from '../services/audioPlayerEngine';
import { AudioDownloader } from '../services/audioDownloader';

interface AudioState {
  selectedReciter: Reciter;
  repeatConfig: RepeatConfig;
  status: PlaybackStatus;
  activeAyah: { suraNo: number; ayaNo: number } | null;
  target: PlaybackTarget | null;
  countdown: number;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  downloadMissingAyahs: number[] | null;
  
  // Actions
  setSelectedReciter: (reciter: Reciter) => void;
  setRepeatConfig: (config: RepeatConfig) => void;
  requestPlayback: (target: PlaybackTarget) => Promise<{ needsDownload: boolean; missingAyahs: number[] }>;
  startDownloadAndPlay: (target: PlaybackTarget, ayahsToDownload: number[]) => Promise<void>;
  cancelDownload: () => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
}

let cancellationToken = { isCancelled: false };

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => {
      // Connect audioEngine callbacks to Zustand store
      audioEngine.setCallbacks({
        onStatusChange: (status) => set({ status }),
        onActiveAyahChange: (suraNo, ayaNo) => set({ activeAyah: { suraNo, ayaNo } }),
        onRepeatCountdown: (countdown) => set({ countdown }),
        onError: (err) => {
          console.error('[AudioStore] Engine error:', err);
          set({ status: 'idle', activeAyah: null });
        },
      });

      return {
        selectedReciter: RECITERS[0],
        repeatConfig: { repeatCount: 1, pauseDelaySeconds: 0 },
        status: 'idle',
        activeAyah: null,
        target: null,
        countdown: 0,
        isDownloading: false,
        downloadProgress: null,
        downloadMissingAyahs: null,

        setSelectedReciter: (reciter) => set({ selectedReciter: reciter }),
        
        setRepeatConfig: (config) => set({ repeatConfig: config }),

        requestPlayback: async (target) => {
          set({ target, status: 'checking_files' });
          const { selectedReciter, repeatConfig } = get();

          const { allDownloaded, missingAyahs } = await AudioDownloader.checkAyahsDownloaded(
            selectedReciter.folder,
            target.suraNo,
            target.startAyah,
            target.endAyah
          );

          if (allDownloaded) {
            set({ downloadMissingAyahs: null, isDownloading: false });
            await audioEngine.startPlayback(
              selectedReciter.folder,
              target.suraNo,
              target.startAyah,
              target.endAyah,
              repeatConfig
            );
            return { needsDownload: false, missingAyahs: [] };
          } else {
            set({
              status: 'idle',
              downloadMissingAyahs: missingAyahs,
            });
            return { needsDownload: true, missingAyahs };
          }
        },

        startDownloadAndPlay: async (target, ayahsToDownload) => {
          const { selectedReciter, repeatConfig } = get();
          cancellationToken = { isCancelled: false };

          set({
            isDownloading: true,
            status: 'downloading',
            downloadProgress: {
              current: 0,
              total: ayahsToDownload.length,
              percentage: 0,
              currentAyahName: 'بدء التنزيل...',
            },
          });

          try {
            const success = await AudioDownloader.downloadAyahs(
              selectedReciter.folder,
              target.suraNo,
              target.suraName,
              ayahsToDownload,
              (progress) => set({ downloadProgress: progress }),
              cancellationToken
            );

            if (success) {
              set({ isDownloading: false, downloadMissingAyahs: null });
              await audioEngine.startPlayback(
                selectedReciter.folder,
                target.suraNo,
                target.startAyah,
                target.endAyah,
                repeatConfig
              );
            } else {
              set({ isDownloading: false, status: 'idle' });
            }
          } catch (e) {
            console.error('[AudioStore] Download error:', e);
            set({ isDownloading: false, status: 'idle' });
          }
        },

        cancelDownload: () => {
          cancellationToken.isCancelled = true;
          set({ isDownloading: false, status: 'idle', downloadMissingAyahs: null });
        },

        pause: async () => {
          await audioEngine.pause();
        },

        resume: async () => {
          await audioEngine.resume();
        },

        stop: async () => {
          await audioEngine.stop();
          set({ activeAyah: null, status: 'idle', target: null });
        },
      };
    },
    {
      name: 'quran-audio-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        selectedReciter: state.selectedReciter,
        repeatConfig: state.repeatConfig,
      }),
    }
  )
);

