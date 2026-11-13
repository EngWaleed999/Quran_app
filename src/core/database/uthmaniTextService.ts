import { File, Paths } from 'expo-file-system';
import { Asset } from 'expo-asset';

/**
 * خدمة استرجاع النص القرآني العثماني المشكل القياسي الموحد
 * تعتمد على نص Tanzil العثماني القياسي بترميز Unicode الكامل
 * لضمان ظهور التشكيل بدقة، وعدم ظهور أي حروف مشوهة أو صينية عند المشاركة أو العرض.
 */
export class UthmaniTextService {
  private static cache = new Map<string, string>();
  private static isLoaded = false;
  private static loadPromise: Promise<void> | null = null;

  /**
   * تحليل وتخزين أسطر ملف Tanzil العثماني المرجعي
   */
  static parseContent(content: string): void {
    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('|');
      if (parts.length === 3) {
        const surah = Number(parts[0]);
        const ayah = Number(parts[1]);
        if (Number.isInteger(surah) && Number.isInteger(ayah)) {
          this.cache.set(`${surah}:${ayah}`, parts[2].trim());
        }
      }
    }
    if (this.cache.size >= 6236) {
      this.isLoaded = true;
    }
  }

  /**
   * تحميل النص من التخزين الدائم أو الأصول المدمجة مع التطبيق
   */
  static async load(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        // 1. فحص وجود الملف في التخزين الدائم (الذي ينزله التجويد)
        const docFile = new File(Paths.document, 'quran-uthmani.txt');
        if (docFile.exists && (docFile.size ?? 0) > 500_000) {
          const content = await docFile.text();
          this.parseContent(content);
          if (this.isLoaded) return;
        }

        // 2. فحص الأصول المدمجة مع التطبيق في assets/data
        try {
          const asset = Asset.fromModule(
            require('../../../assets/data/quran-uthmani.txt')
          );
          await asset.downloadAsync();
          if (asset.localUri) {
            const assetFile = new File(asset.localUri);
            if (assetFile.exists) {
              const content = await assetFile.text();
              this.parseContent(content);
              if (this.isLoaded) return;
            }
          }
        } catch {
          // لم يتم العثور على الأصل المدمج
        }
      } catch (error) {
        console.warn('[UthmaniTextService] Could not load Uthmani text:', error);
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * الحصول على نص الآية العثماني المشكل مباشرة من الذاكرة إذا كان جاهزاً
   */
  static getAyahTextSync(surah: number, ayah: number): string | null {
    return this.cache.get(`${surah}:${ayah}`) ?? null;
  }

  /**
   * الحصول على نص الآية العثماني المشكل (مع ضمان التحميل)
   */
  static async getAyahText(surah: number, ayah: number): Promise<string | null> {
    const cached = this.getAyahTextSync(surah, ayah);
    if (cached) return cached;

    await this.load();
    return this.getAyahTextSync(surah, ayah);
  }
}
