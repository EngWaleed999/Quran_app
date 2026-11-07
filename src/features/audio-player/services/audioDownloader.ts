import * as FileSystem from 'expo-file-system/legacy';
import {
  DownloadProgress,
  PlaybackVerse,
  Reciter,
  SurahDownloadSummary,
} from '../types/audio.types';
import { AudioSourceAdapterRegistry } from './audioSourceAdapter';

const DOWNLOAD_CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;

export class AudioDownloader {
  static format3Digits(value: number): string {
    return String(value).padStart(3, '0');
  }

  /**
   * Permanent user-owned download path. It deliberately uses documentDirectory,
   * not cacheDirectory, so Android/iOS cache cleanup cannot silently remove it.
   */
  static getLocalAyahUri(reciterId: string, suraNo: number, ayaNo: number): string {
    return (
      FileSystem.documentDirectory +
      'audio/' +
      reciterId +
      '/' +
      this.format3Digits(suraNo) +
      '/' +
      this.format3Digits(ayaNo) +
      '.mp3'
    );
  }

  /**
   * Delegates to the registered adapter for this reciter (Adapter Pattern).
   * Supports multiple reciters, multiple CDNs and audio APIs transparently.
   */
  static getRemoteAyahUrl(
    reciter: Reciter,
    globalAyahNo: number,
    suraNo?: number,
    ayaNo?: number
  ): string {
    const adapter = AudioSourceAdapterRegistry.getAdapter(reciter.adapterId);
    return adapter.getRemoteAyahUrl(reciter, globalAyahNo, suraNo, ayaNo);
  }

  static async getSurahDownloadSummary(
    reciter: Reciter,
    verses: PlaybackVerse[]
  ): Promise<SurahDownloadSummary> {
    const missing: PlaybackVerse[] = [];
    let downloaded = 0;
    let bytes = 0;

    for (const verse of verses) {
      const uri = this.getLocalAyahUri(reciter.id, verse.suraNo, verse.ayaNo);
      const info = await FileSystem.getInfoAsync(uri);

      if (info.exists && 'size' in info && typeof info.size === 'number' && info.size > 0) {
        downloaded += 1;
        bytes += info.size;
      } else {
        missing.push(verse);
        if (info.exists) {
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
        }
      }
    }

    return {
      total: verses.length,
      downloaded,
      missing,
      bytes,
      allDownloaded: verses.length > 0 && missing.length === 0,
    };
  }

  static async checkAyahsDownloaded(
    reciter: Reciter,
    verses: PlaybackVerse[]
  ): Promise<{ allDownloaded: boolean; missingAyahs: PlaybackVerse[] }> {
    const summary = await this.getSurahDownloadSummary(reciter, verses);
    return {
      allDownloaded: summary.allDownloaded,
      missingAyahs: summary.missing,
    };
  }

  /**
   * Downloads missing ayah clips with bounded concurrency and retries.
   * Each completed file is moved from a temporary suffix to its final name,
   * so interrupted downloads are never mistaken for complete MP3 files.
   */
  static async downloadAyahs(
    reciter: Reciter,
    suraNo: number,
    suraName: string,
    versesToDownload: PlaybackVerse[],
    onProgress: (progress: DownloadProgress) => void,
    cancellationToken?: { isCancelled: boolean }
  ): Promise<boolean> {
    if (versesToDownload.length === 0) return true;

    const directory =
      FileSystem.documentDirectory + 'audio/' + reciter.id + '/' + this.format3Digits(suraNo);
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

    const total = versesToDownload.length;
    let completed = 0;
    let nextIndex = 0;
    let firstError: Error | null = null;

    const worker = async (): Promise<void> => {
      while (true) {
        if (cancellationToken?.isCancelled || firstError) return;

        const index = nextIndex;
        nextIndex += 1;
        if (index >= total) return;

        const verse = versesToDownload[index];
        const finalUri = this.getLocalAyahUri(reciter.id, verse.suraNo, verse.ayaNo);
        const temporaryUri = finalUri + '.part';

        let downloaded = false;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !downloaded; attempt += 1) {
          if (cancellationToken?.isCancelled) return;

          try {
            await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);

            const response = await FileSystem.downloadAsync(
              this.getRemoteAyahUrl(reciter, verse.globalAyahNo, verse.suraNo, verse.ayaNo),
              temporaryUri
            );

            const temporaryInfo = await FileSystem.getInfoAsync(temporaryUri);
            const hasBytes =
              temporaryInfo.exists &&
              'size' in temporaryInfo &&
              typeof temporaryInfo.size === 'number' &&
              temporaryInfo.size > 0;

            if (response.status !== 200 || !hasBytes) {
              throw new Error(
                'CDN returned HTTP ' + response.status +
                ' or an empty audio file for ayah ' + verse.suraNo + ':' + verse.ayaNo
              );
            }

            await FileSystem.deleteAsync(finalUri, { idempotent: true }).catch(() => undefined);
            await FileSystem.moveAsync({ from: temporaryUri, to: finalUri });
            downloaded = true;
          } catch (error) {
            await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);

            if (attempt === MAX_ATTEMPTS) {
              firstError =
                error instanceof Error
                  ? error
                  : new Error('Audio download failed for ayah ' + verse.suraNo + ':' + verse.ayaNo);
            } else {
              await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
            }
          }
        }

        if (downloaded) {
          completed += 1;
          onProgress({
            current: completed,
            total,
            percentage: Math.floor((completed / total) * 100),
            currentAyahName:
              'الآية ' + verse.ayaNo + ' من سورة ' + suraName,
          });
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(DOWNLOAD_CONCURRENCY, total) },
      () => worker()
    );

    await Promise.all(workers);

    if (cancellationToken?.isCancelled) return false;
    if (firstError) throw firstError;

    return completed === total;
  }

  static async deleteSurahDownloads(reciterId: string, suraNo: number): Promise<void> {
    const directory =
      FileSystem.documentDirectory + 'audio/' + reciterId + '/' + this.format3Digits(suraNo);
    await FileSystem.deleteAsync(directory, { idempotent: true });
  }

  static async getTotalDownloadedBytes(): Promise<number> {
    const root = FileSystem.documentDirectory + 'audio';
    const rootInfo = await FileSystem.getInfoAsync(root);
    if (!rootInfo.exists) return 0;

    const calculateDirectorySize = async (directory: string): Promise<number> => {
      let total = 0;
      const entries = await FileSystem.readDirectoryAsync(directory);

      for (const entry of entries) {
        const uri = directory + '/' + entry;
        const info = await FileSystem.getInfoAsync(uri);

        if (!info.exists) continue;
        if (info.isDirectory) {
          total += await calculateDirectorySize(uri);
        } else if ('size' in info && typeof info.size === 'number') {
          total += info.size;
        }
      }

      return total;
    };

    return calculateDirectorySize(root);
  }
}
