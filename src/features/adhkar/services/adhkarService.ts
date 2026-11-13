import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { createDownloadResumable, DownloadResumable } from 'expo-file-system/legacy';
import bundledAdhkarData from '../data/adhkar_filtered.json';
import {
  DhikrItem,
  DhikrItemWithState,
  AdhkarCategoryInfo,
  RawAdhkarCategory,
} from '../types/adhkar.types';
import {
  parseRawAdhkar,
  sortAdhkarWithFavorites,
  filterAdhkar,
  extractCategories,
  shouldResetCounter,
  computeNextCounter,
  CounterState,
} from './adhkarRules';

const FAVORITES_STORAGE_KEY = '@quran_adhkar_favorites_v1';
const COUNTERS_STORAGE_KEY = '@quran_adhkar_counters_v1';
const DATASET_FILE_NAME = 'adhkar_filtered.json';

// رابط الإصدار في GitHub Releases (يمكن تخصيصه أو استبداله)
export const ADHKAR_RELEASE_URL =
  'https://github.com/EngWaleed999/Quran_app/releases/download/quran-db-v1/adhkar_filtered.json';

export const ADHKAR_EXPECTED_BYTES = 75_103; // ~73.3 KB

export interface AdhkarDownloadProgress {
  bytesWritten: number;
  totalBytes: number;
  percentage: number;
  message?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AdhkarService {
  private static favoritesSet = new Set<string>();
  private static countersMap = new Map<string, CounterState>();
  private static isInitialized = false;
  private static cachedItems: DhikrItem[] | null = null;
  private static activeDownload: DownloadResumable | null = null;
  private static isDownloadCancelled = false;

  /**
   * استرجاع ملف البيانات المحفوظ محلياً (Downloaded Asset)
   */
  private static getDatasetFile(): File {
    return new File(Paths.document, DATASET_FILE_NAME);
  }

  /**
   * فحص ما إذا تم تنزيل حزمة الأذكار مسبقاً وتخزينها في مسار المستندات
   */
  static async isDatasetDownloaded(): Promise<boolean> {
    try {
      const file = this.getDatasetFile();
      return file.exists;
    } catch {
      return false;
    }
  }

  /**
   * تحميل البيانات سواء من الملف المنزّل محلياً أو من الحزمة المدمجة (Bundled Fallback)
   */
  private static getParsedItems(): DhikrItem[] {
    if (!this.cachedItems) {
      this.cachedItems = parseRawAdhkar(
        bundledAdhkarData as unknown as RawAdhkarCategory[]
      );
    }
    return this.cachedItems;
  }

  /**
   * تهيئة المفضلة والعدادات وتطبيق فحص الصلاحية التلقائي (TTL Auto-Reset)
   */
  static async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 1. فحص وجود نسخة منزّلة مسبقاً وتحديث الكاش
      const file = this.getDatasetFile();
      if (file.exists) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cachedItems = parseRawAdhkar(parsed as RawAdhkarCategory[]);
          }
        } catch (error) {
          console.warn('[AdhkarService] Failed reading downloaded dataset, falling back to bundled asset:', error);
        }
      }

      // 2. تحميل المفضلة
      const storedFavs = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      if (storedFavs) {
        const parsed: string[] = JSON.parse(storedFavs);
        if (Array.isArray(parsed)) {
          this.favoritesSet = new Set(parsed);
        }
      }

      // 3. تحميل العدادات وتصفير المنتهي تلقائياً (Auto-reset TTL & Day change)
      const storedCounters = await AsyncStorage.getItem(COUNTERS_STORAGE_KEY);
      if (storedCounters) {
        const parsedObj: Record<string, CounterState> = JSON.parse(storedCounters);
        const now = Date.now();
        let hasChanges = false;

        for (const [id, state] of Object.entries(parsedObj)) {
          if (shouldResetCounter(state, now)) {
            this.countersMap.set(id, {
              count: 0,
              completedAt: null,
              lastUpdatedAt: now,
            });
            hasChanges = true;
          } else {
            this.countersMap.set(id, state);
          }
        }

        if (hasChanges) {
          void this.persistCounters();
        }
      }

      this.isInitialized = true;
    } catch (error) {
      console.warn('[AdhkarService] Initialization error:', error);
      this.isInitialized = true;
    }
  }

  /**
   * حفظ حالة العدادات محلياً
   */
  private static async persistCounters(): Promise<void> {
    try {
      const obj: Record<string, CounterState> = {};
      for (const [k, v] of this.countersMap.entries()) {
        if (v.count > 0 || v.completedAt !== null) {
          obj[k] = v;
        }
      }
      await AsyncStorage.setItem(COUNTERS_STORAGE_KEY, JSON.stringify(obj));
    } catch (error) {
      console.warn('[AdhkarService] Failed to persist counters:', error);
    }
  }

  /**
   * التحقق مما إذا كان الذكر مفضلاً
   */
  static isFavorite(id: string): boolean {
    return this.favoritesSet.has(id);
  }

  /**
   * عدد العناصر المفضلة حالياً
   */
  static getFavoritesCount(): number {
    return this.favoritesSet.size;
  }

  /**
   * تبديل حالة المفضلة وحفظها محلياً
   */
  static async toggleFavorite(id: string): Promise<boolean> {
    await this.init();
    let nextState = false;

    if (this.favoritesSet.has(id)) {
      this.favoritesSet.delete(id);
      nextState = false;
    } else {
      this.favoritesSet.add(id);
      nextState = true;
    }

    try {
      await AsyncStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(Array.from(this.favoritesSet))
      );
    } catch (error) {
      console.warn('[AdhkarService] Failed to persist favorites:', error);
    }

    return nextState;
  }

  /**
   * استرجاع حالة عداد لذكر معين مع فحص انتهاء الصلاحية الحي
   */
  static getCounterState(id: string): CounterState {
    const current = this.countersMap.get(id);
    if (!current) {
      return { count: 0, completedAt: null, lastUpdatedAt: Date.now() };
    }

    if (shouldResetCounter(current, Date.now())) {
      const resetState: CounterState = {
        count: 0,
        completedAt: null,
        lastUpdatedAt: Date.now(),
      };
      this.countersMap.set(id, resetState);
      void this.persistCounters();
      return resetState;
    }

    return current;
  }

  /**
   * زيادة العداد مع دعم استئناف جولة جديدة عند النقر على ذكر مكتمل
   */
  static async incrementCounter(
    id: string,
    maxCount: number
  ): Promise<{ state: CounterState; isNewRound: boolean; isJustCompleted: boolean }> {
    await this.init();
    const current = this.getCounterState(id);
    const result = computeNextCounter(current, maxCount, Date.now());

    this.countersMap.set(id, result.state);
    void this.persistCounters();

    return result;
  }

  /**
   * تصفير عداد ذكر معين
   */
  static async resetCounter(id: string): Promise<void> {
    await this.init();
    this.countersMap.set(id, {
      count: 0,
      completedAt: null,
      lastUpdatedAt: Date.now(),
    });
    await this.persistCounters();
  }

  /**
   * تصفير جميع عدادات قسم معين (مثلاً تصفير جميع أذكار بعد الصلاة بعد الفراغ منها)
   */
  static async resetCategoryCounters(categoryTitle: string): Promise<void> {
    await this.init();
    const items = this.getParsedItems().filter(
      (item) => item.categoryTitle === categoryTitle
    );

    const now = Date.now();
    for (const item of items) {
      this.countersMap.set(item.id, {
        count: 0,
        completedAt: null,
        lastUpdatedAt: now,
      });
    }

    await this.persistCounters();
  }

  /**
   * استرجاع قائمة الأذكار مع تطبيق التصفية والبحث
   */
  static async getAdhkar(
    selectedCategory = 'all',
    searchQuery = ''
  ): Promise<DhikrItemWithState[]> {
    await this.init();
    const allItems = this.getParsedItems();
    const sorted = sortAdhkarWithFavorites(allItems, this.favoritesSet);
    return filterAdhkar(sorted, selectedCategory, searchQuery);
  }

  /**
   * استرجاع أقسام الأذكار
   */
  static async getCategories(): Promise<AdhkarCategoryInfo[]> {
    await this.init();
    const allItems = this.getParsedItems();
    return extractCategories(allItems, this.favoritesSet.size);
  }

  /**
   * تنزيل حزمة الأذكار من GitHub Release مع دعم التراجع الأسي (Exponential Backoff)
   * والتحقق من صحة الملف قبل اعتماده، وإلغاء العملية بسلاسة.
   */
  static async downloadDataset(
    remoteUrl: string = ADHKAR_RELEASE_URL,
    onProgress?: (progress: AdhkarDownloadProgress) => void
  ): Promise<void> {
    this.isDownloadCancelled = false;
    const temporaryFile = new File(Paths.cache, `temp_${Date.now()}_adhkar.json`);
    const destinationFile = this.getDatasetFile();

    const maxRetries = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.isDownloadCancelled) {
        throw new Error('تم إلغاء عملية التنزيل من قبل المستخدم.');
      }

      try {
        if (temporaryFile.exists) {
          try { temporaryFile.delete(); } catch { /* ignore */ }
        }

        const resumable = createDownloadResumable(
          remoteUrl,
          temporaryFile.uri,
          {},
          (downloadProgress) => {
            if (this.isDownloadCancelled) return;
            const written = downloadProgress.totalBytesWritten;
            const total = downloadProgress.totalBytesExpectedToWrite > 0
              ? downloadProgress.totalBytesExpectedToWrite
              : ADHKAR_EXPECTED_BYTES;
            const percentage = Math.min(100, Math.round((written / total) * 100));

            onProgress?.({
              bytesWritten: written,
              totalBytes: total,
              percentage,
              message: `جارٍ تنزيل بيانات الأذكار (${percentage}٪)...`,
            });
          }
        );

        this.activeDownload = resumable;
        const result = await resumable.downloadAsync();
        this.activeDownload = null;

        if (this.isDownloadCancelled) {
          try { if (temporaryFile.exists) temporaryFile.delete(); } catch { /* ignore */ }
          throw new Error('تم إلغاء عملية التنزيل من قبل المستخدم.');
        }

        if (!result || !temporaryFile.exists) {
          throw new Error('لم يكتمل تحميل الملف من الخادم.');
        }

        // فحص صحة الملف المنزّل قبل استبدال الملف الدائم
        const downloadedText = await temporaryFile.text();
        const parsed = JSON.parse(downloadedText);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('الملف المنزّل غير صالح أو لا يحتوي على بنية الأذكار الصحيحة.');
        }

        // نقل الملف بنجاح للتخزين الدائم
        if (destinationFile.exists) {
          try { destinationFile.delete(); } catch { /* ignore */ }
        }
        temporaryFile.copy(destinationFile);
        try { temporaryFile.delete(); } catch { /* ignore */ }

        // تفريغ الذاكرة المؤقتة ليقرأ التطبيق النسخة الجديدة فوراً
        this.cachedItems = null;
        this.getParsedItems();

        return;
      } catch (error) {
        this.activeDownload = null;
        lastError = error;

        if (this.isDownloadCancelled) {
          try { if (temporaryFile.exists) temporaryFile.delete(); } catch { /* ignore */ }
          throw new Error('تم إلغاء عملية التنزيل من قبل المستخدم.');
        }

        if (attempt < maxRetries) {
          onProgress?.({
            bytesWritten: 0,
            totalBytes: ADHKAR_EXPECTED_BYTES,
            percentage: 0,
            message: `تعذر الاتصال، جارٍ إعادة المحاولة (${attempt}/${maxRetries})...`,
          });
          await sleep(Math.pow(2, attempt) * 1000); // 2s, 4s
        }
      }
    }

    throw lastError ?? new Error('فشل تنزيل ملف بيانات الأذكار بعد عدة محاولات.');
  }

  /**
   * إلغاء التنزيل الجاري
   */
  static cancelDownload(): void {
    this.isDownloadCancelled = true;
    try {
      this.activeDownload?.cancelAsync().catch(() => {});
    } catch {
      // Ignore
    }
    this.activeDownload = null;
  }
}
