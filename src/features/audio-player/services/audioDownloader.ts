import * as FileSystem from 'expo-file-system/legacy';
import { DownloadProgress } from '../types/audio.types';

export class AudioDownloader {
  private static BASE_URL = 'https://everyayah.com/data';

  /**
   * Helper to format Surah and Ayah numbers to standard 3-digit strings (e.g. 001, 002).
   */
  static format3Digits(num: number): string {
    return String(num).padStart(3, '0');
  }

  /**
   * Resolves the local absolute path for an Ayah audio file.
   */
  static getLocalAyahUri(reciterFolder: string, suraNo: number, ayaNo: number): string {
    const s = this.format3Digits(suraNo);
    const a = this.format3Digits(ayaNo);
    return `${FileSystem.documentDirectory}audio/${reciterFolder}/${s}/${a}.mp3`;
  }

  /**
   * Resolves the remote EveryAyah CDN URL for an Ayah.
   */
  static getRemoteAyahUrl(reciterFolder: string, suraNo: number, ayaNo: number): string {
    const s = this.format3Digits(suraNo);
    const a = this.format3Digits(ayaNo);
    return `${this.BASE_URL}/${reciterFolder}/${s}${a}.mp3`;
  }

  /**
   * Checks whether all Ayahs in a range exist locally in device storage.
   */
  static async checkAyahsDownloaded(
    reciterFolder: string,
    suraNo: number,
    startAyah: number,
    endAyah: number
  ): Promise<{ allDownloaded: boolean; missingAyahs: number[] }> {
    const missingAyahs: number[] = [];

    for (let aya = startAyah; aya <= endAyah; aya++) {
      const localUri = this.getLocalAyahUri(reciterFolder, suraNo, aya);
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        missingAyahs.push(aya);
      }
    }

    return {
      allDownloaded: missingAyahs.length === 0,
      missingAyahs,
    };
  }

  /**
   * Downloads a list of missing Ayahs sequentially and saves them persistently.
   */
  static async downloadAyahs(
    reciterFolder: string,
    suraNo: number,
    suraName: string,
    ayahsToDownload: number[],
    onProgress: (progress: DownloadProgress) => void,
    cancellationToken?: { isCancelled: boolean }
  ): Promise<boolean> {
    const total = ayahsToDownload.length;
    let completed = 0;

    const s = this.format3Digits(suraNo);
    const suraDir = `${FileSystem.documentDirectory}audio/${reciterFolder}/${s}`;
    
    // Ensure destination directory exists
    const dirInfo = await FileSystem.getInfoAsync(suraDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(suraDir, { intermediates: true });
    }

    for (const aya of ayahsToDownload) {
      if (cancellationToken?.isCancelled) {
        console.log('[Downloader] Download cancelled by user.');
        return false;
      }

      const remoteUrl = this.getRemoteAyahUrl(reciterFolder, suraNo, aya);
      const localUri = this.getLocalAyahUri(reciterFolder, suraNo, aya);

      try {
        const downloadRes = await FileSystem.downloadAsync(remoteUrl, localUri);
        if (downloadRes.status !== 200) {
          console.warn(`[Downloader] Non-200 status for Ayah ${aya}:`, downloadRes.status);
        }
      } catch (err) {
        console.error(`[Downloader] Failed to download Ayah ${aya}:`, err);
        throw err;
      }

      completed++;
      onProgress({
        current: completed,
        total,
        percentage: Math.round((completed / total) * 100),
        currentAyahName: `الآية ${aya} من ${suraName}`,
      });
    }

    return true;
  }
}
