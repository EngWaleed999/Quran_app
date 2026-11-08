import { Reciter } from '../types/audio.types';

export interface IAudioSourceAdapter {
  readonly id: string;
  readonly name: string;
  getRemoteAyahUrl(
    reciter: Reciter,
    globalAyahNo: number,
    suraNo?: number,
    ayaNo?: number
  ): string;
}

export class IslamicNetworkAudioAdapter implements IAudioSourceAdapter {
  readonly id = 'islamic-network';
  readonly name = 'Islamic Network Audio CDN';
  private readonly baseUrl = 'https://cdn.islamic.network/quran/audio';

  getRemoteAyahUrl(reciter: Reciter, globalAyahNo: number): string {
    if (!Number.isInteger(globalAyahNo) || globalAyahNo < 1 || globalAyahNo > 6236) {
      throw new Error('Invalid global ayah number: ' + globalAyahNo);
    }

    return (
      this.baseUrl +
      '/' +
      reciter.bitrate +
      '/' +
      reciter.edition +
      '/' +
      globalAyahNo +
      '.mp3'
    );
  }
}

export class EveryAyahAudioAdapter implements IAudioSourceAdapter {
  readonly id = 'everyayah';
  readonly name = 'EveryAyah Audio CDN';
  private readonly baseUrl = 'https://everyayah.com/data';

  getRemoteAyahUrl(
    reciter: Reciter,
    _globalAyahNo: number,
    suraNo?: number,
    ayaNo?: number
  ): string {
    if (!suraNo || !ayaNo) {
      throw new Error('EveryAyah requires surah and ayah numbers');
    }
    const s3 = String(suraNo).padStart(3, '0');
    const a3 = String(ayaNo).padStart(3, '0');
    return `${this.baseUrl}/${reciter.edition}/${s3}${a3}.mp3`;
  }
}

export class AudioSourceAdapterRegistry {
  private static everyAyah = new EveryAyahAudioAdapter();
  private static adapters = new Map<string, IAudioSourceAdapter>([
    ['everyayah', AudioSourceAdapterRegistry.everyAyah],
    ['islamic-network', new IslamicNetworkAudioAdapter()],
  ]);
  private static defaultAdapter: IAudioSourceAdapter = AudioSourceAdapterRegistry.everyAyah;

  static getAdapter(id?: string): IAudioSourceAdapter {
    if (!id) return this.defaultAdapter;
    return this.adapters.get(id) ?? this.defaultAdapter;
  }

  static registerAdapter(adapter: IAudioSourceAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }
}

/**
 * دالة مساعدة لتطبيع أخطاء الاتصال بالشبكة وعرض رسالة مهذبة باللغة العربية
 * بدلاً من إظهار أخطاء النظام التقنية مثل "Unable to resolve host" للمستخدم.
 */
export function getFriendlyAudioErrorMessage(error: unknown): string {
  if (!error) return 'تعذر إتمام العملية، يرجى المحاولة مرة أخرى.';
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('unable to resolve host') ||
    lower.includes('unknownhostexception') ||
    lower.includes('network request failed') ||
    lower.includes('enotfound') ||
    lower.includes('timeout') ||
    lower.includes('failed to connect') ||
    lower.includes('network') ||
    lower.includes('connection refused')
  ) {
    return 'تعذر الاتصال بالإنترنت، يرجى التحقق من اتصالك والمحاولة مرة أخرى لاحقاً.';
  }

  return message;
}
