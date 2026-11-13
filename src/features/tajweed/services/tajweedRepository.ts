import { File, Paths } from 'expo-file-system';
import { createDownloadResumable, DownloadResumable } from 'expo-file-system/legacy';

import {
  TajweedAyahData,
  TajweedDatasetSummary,
  TajweedDownloadProgress,
  TajweedOccurrence,
  TajweedRuleGroup,
} from '../type/tajweed.types';
import { getTajweedRuleInfo } from '../data/tajweedDefinitions';

const EXPECTED_AYAH_COUNT = 6236;

const DATA_FILE_NAME = 'tajweed.hafs.uthmani-pause-sajdah.json';
const EDITION_FILE_NAME = 'quran-uthmani.txt';

const RELEASE_BASE_URL =
  'https://github.com/EngWaleed999/Quran_app/releases/download/quran-db-v1';

const DATA_URL = `${RELEASE_BASE_URL}/${DATA_FILE_NAME}`;
const EDITION_URL = `${RELEASE_BASE_URL}/${EDITION_FILE_NAME}`;

export const EDITION_EXPECTED_BYTES = 1_376_504;
export const DATA_EXPECTED_BYTES = 5_578_730;
export const TOTAL_EXPECTED_BYTES = EDITION_EXPECTED_BYTES + DATA_EXPECTED_BYTES; // ~6.96 MB

const EDITION_MIN_BYTES = 1_000_000;
const DATA_MIN_BYTES = 4_000_000;

type RawAnnotation = {
  rule: string;
  start: number;
  end: number;
};

type RawVerse = {
  surah?: number;
  ayah?: number;
  surahNumber?: number;
  surah_no?: number;
  ayaNo?: number;
  aya_no?: number;
  annotations: RawAnnotation[];
};

const RULE_LABELS: Record<string, string> = {
  ghunnah: 'الغُنّة',
  hamzat_wasl: 'همزة الوصل',
  idghaam_ghunnah: 'الإدغام بغنة',
  idghaam_no_ghunnah: 'الإدغام بغير غنة',
  idghaam_mutajanisayn: 'إدغام المتجانسين',
  idghaam_mutaqaribayn: 'إدغام المتقاربين',
  idghaam_shafawi: 'الإدغام الشفوي',
  ikhfa: 'الإخفاء',
  ikhfa_shafawi: 'الإخفاء الشفوي',
  iqlab: 'الإقلاب',
  lam_shamsiyyah: 'اللام الشمسية',
  madd_2: 'المد الطبيعي',
  madd_246: 'المد العارض للسكون واللين',
  madd_6: 'المد اللازم',
  madd_munfasil: 'المد الجائز المنفصل',
  madd_muttasil: 'المد الواجب المتصل',
  qalqalah: 'القلقلة',
  silent: 'الحروف التي لا تُنطق',
};

function getRuleTitle(rule: string): string {
  if (/[\u0600-\u06FF]/u.test(rule)) {
    return rule;
  }
  return RULE_LABELS[rule] ?? `حكم تجويدي: ${rule}`;
}

function getVerseKey(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let activeResumable: DownloadResumable | null = null;
let isCancelledFlag = false;

/**
 * تنزيل ملف دائم إلى التخزين المحلي مع تتبع التقدم وإمكانية الإلغاء
 */
async function downloadPersistentFile(
  url: string,
  fileName: string,
  expectedBytes: number,
  minimumBytes: number,
  onFileProgress?: (bytesWritten: number, totalExpected: number) => void
): Promise<File> {
  const destination = new File(Paths.document, fileName);

  if (destination.exists && (destination.size ?? 0) >= minimumBytes) {
    onFileProgress?.(destination.size ?? expectedBytes, expectedBytes);
    return destination;
  }

  const temporaryFile = new File(Paths.cache, `${fileName}.download`);
  if (temporaryFile.exists) {
    try {
      temporaryFile.delete();
    } catch {
      // Ignore cleanup error
    }
  }

  const maxRetries = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (isCancelledFlag) {
      throw new Error('تم إلغاء عملية التنزيل من قبل المستخدم.');
    }

    try {
      const resumable = createDownloadResumable(
        url,
        temporaryFile.uri,
        {},
        (downloadProgress) => {
          if (isCancelledFlag) {
            void resumable.cancelAsync().catch(() => undefined);
            return;
          }
          const written = downloadProgress.totalBytesWritten;
          const total =
            downloadProgress.totalBytesExpectedToWrite > 0
              ? downloadProgress.totalBytesExpectedToWrite
              : expectedBytes;
          onFileProgress?.(written, total);
        }
      );

      activeResumable = resumable;
      const result = await resumable.downloadAsync();
      activeResumable = null;

      if (isCancelledFlag) {
        throw new Error('تم إلغاء عملية التنزيل من قبل المستخدم.');
      }

      if (!result || (result.status && result.status !== 200)) {
        throw new Error(`تعذر تنزيل الملف (${result?.status ?? 'Network error'})`);
      }

      if (!temporaryFile.exists || (temporaryFile.size ?? 0) < minimumBytes) {
        throw new Error(`حجم الملف المحمل غير مكتمل: ${fileName}`);
      }

      if (destination.exists) {
        try {
          destination.delete();
        } catch {
          // Ignore
        }
      }

      await temporaryFile.copy(destination);

      try {
        temporaryFile.delete();
      } catch {
        // Ignore
      }

      if (!destination.exists || (destination.size ?? 0) < minimumBytes) {
        throw new Error(`فشل تثبيت الملف في التخزين الدائم: ${fileName}`);
      }

      return destination;
    } catch (error) {
      activeResumable = null;
      lastError = error;

      if (isCancelledFlag) {
        try {
          if (temporaryFile.exists) temporaryFile.delete();
        } catch {
          // Ignore
        }
        throw new Error('تم إلغاء عملية التنزيل من قبل المستخدم.');
      }

      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  throw lastError ?? new Error(`فشل تنزيل ملف: ${fileName}`);
}

/**
 * تحليل ملف Tanzil المرجعي (surah|ayah|text)
 * مع تجاهل الأسطر الفارغة وأسطر التعليقات (#) التي يضعها موقع تنزيل في تذييل الملف
 */
function parseReferenceText(content: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    // تجاهل الأسطر الفارغة وأسطر التعليقات مثل رأس وذيل ترخيص تنزيل
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parts = trimmed.split('|');
    if (parts.length !== 3) {
      continue;
    }

    const surah = Number(parts[0]);
    const ayah = Number(parts[1]);
    const text = parts[2].trim();

    if (
      !Number.isInteger(surah) ||
      surah < 1 ||
      surah > 114 ||
      !Number.isInteger(ayah) ||
      ayah < 1 ||
      !text
    ) {
      continue;
    }

    const key = getVerseKey(surah, ayah);
    result.set(key, text);
  }

  if (result.size !== EXPECTED_AYAH_COUNT) {
    throw new Error(
      `بيانات النص المرجعي غير مكتملة: المتوقع ${EXPECTED_AYAH_COUNT} آية، المستلم ${result.size} آية.`
    );
  }

  return result;
}

/**
 * تحويل مصفوفة JSON والنص المرجعي إلى فهرس جاهز للاستخدام السريع في الذاكرة
 */
function buildIndex(
  rawRecords: unknown,
  referenceText: Map<string, string>
): Map<string, TajweedAyahData> {
  if (!Array.isArray(rawRecords) || rawRecords.length !== EXPECTED_AYAH_COUNT) {
    throw new Error('بنية ملف أحكام التجويد غير صحيحة أو غير مكتملة.');
  }

  const index = new Map<string, TajweedAyahData>();

  for (const item of rawRecords) {
    const record = item as RawVerse;
    const surah = Number(record.surah ?? record.surahNumber ?? record.surah_no);
    const ayah = Number(record.ayah ?? record.ayaNo ?? record.aya_no);

    if (
      !Number.isInteger(surah) ||
      !Number.isInteger(ayah) ||
      surah < 1 ||
      surah > 114 ||
      ayah < 1 ||
      !Array.isArray(record.annotations)
    ) {
      throw new Error(`سجل آية تجويدي غير صالح: ${surah}:${ayah}`);
    }

    const key = getVerseKey(surah, ayah);
    const referenceAyah = referenceText.get(key);

    if (!referenceAyah) {
      throw new Error(`النص المرجعي للآية غير موجود: ${key}`);
    }

    const codePoints = Array.from(referenceAyah);
    const groups = new Map<string, TajweedRuleGroup>();

    for (const annotation of record.annotations) {
      if (
        typeof annotation.rule !== 'string' ||
        !Number.isInteger(annotation.start) ||
        !Number.isInteger(annotation.end) ||
        annotation.start < 0 ||
        annotation.end <= annotation.start ||
        annotation.end > codePoints.length
      ) {
        throw new Error(`نطاق غير صالح للحكم في الآية ${key}.`);
      }

      const matchedText = codePoints.slice(annotation.start, annotation.end).join('');
      if (!matchedText) {
        throw new Error(`نص فارغ للحكم في الآية ${key}.`);
      }

      let group = groups.get(annotation.rule);
      if (!group) {
        const ruleInfo = getTajweedRuleInfo(annotation.rule);
        group = {
          rule: annotation.rule,
          title: ruleInfo.title,
          definition: ruleInfo.definition,
          occurrences: [],
        };
        groups.set(annotation.rule, group);
      }

      group.occurrences.push({
        start: annotation.start,
        end: annotation.end,
        text: matchedText,
      });
    }

    index.set(key, {
      surah,
      ayah,
      ayahText: referenceAyah,
      rules: Array.from(groups.values()),
    });
  }

  if (index.size !== EXPECTED_AYAH_COUNT) {
    throw new Error('فهرس التجويد غير مكتمل.');
  }

  return index;
}

let cachedIndex: Map<string, TajweedAyahData> | null = null;
let loadPromise: Promise<Map<string, TajweedAyahData>> | null = null;

/**
 * قراءة البيانات المخزنة محلياً وبناء الفهرس في الذاكرة دون الحاجة لأي اتصال بالإنترنت
 */
async function loadIndexFromDisk(): Promise<Map<string, TajweedAyahData>> {
  if (cachedIndex) return cachedIndex;

  const dataFile = new File(Paths.document, DATA_FILE_NAME);
  const editionFile = new File(Paths.document, EDITION_FILE_NAME);

  if (
    !dataFile.exists ||
    (dataFile.size ?? 0) < DATA_MIN_BYTES ||
    !editionFile.exists ||
    (editionFile.size ?? 0) < EDITION_MIN_BYTES
  ) {
    throw new Error('ملفات التجويد غير محملة على الجهاز بعد.');
  }

  const [jsonContent, editionContent] = await Promise.all([
    dataFile.text(),
    editionFile.text(),
  ]);

  const rawRecords: unknown = JSON.parse(jsonContent);
  const referenceText = parseReferenceText(editionContent);
  const index = buildIndex(rawRecords, referenceText);
  cachedIndex = index;
  return index;
}

export class TajweedRepository {
  /**
   * فحص ما إذا كانت حزمة التجويد مثبتة محلياً بالفعل
   */
  static isDatasetDownloaded(): boolean {
    try {
      const dataFile = new File(Paths.document, DATA_FILE_NAME);
      const editionFile = new File(Paths.document, EDITION_FILE_NAME);
      return (
        dataFile.exists &&
        (dataFile.size ?? 0) >= DATA_MIN_BYTES &&
        editionFile.exists &&
        (editionFile.size ?? 0) >= EDITION_MIN_BYTES
      );
    } catch {
      return false;
    }
  }

  /**
   * ملخص حالة وحجم الملفات المخزنة محلياً
   */
  static getDatasetSummary(): TajweedDatasetSummary {
    try {
      const dataFile = new File(Paths.document, DATA_FILE_NAME);
      const editionFile = new File(Paths.document, EDITION_FILE_NAME);
      const dataSize = dataFile.exists ? (dataFile.size ?? 0) : 0;
      const editionSize = editionFile.exists ? (editionFile.size ?? 0) : 0;
      const totalBytes = dataSize + editionSize;
      const isDownloaded =
        dataSize >= DATA_MIN_BYTES && editionSize >= EDITION_MIN_BYTES;
      return { isDownloaded, totalBytes };
    } catch {
      return { isDownloaded: false, totalBytes: 0 };
    }
  }

  /**
   * إلغاء التحميل الجاري
   */
  static cancelDownload(): void {
    isCancelledFlag = true;
    if (activeResumable) {
      try {
        void activeResumable.cancelAsync();
      } catch {
        // Ignore
      }
      activeResumable = null;
    }
  }

  /**
   * تنزيل حزمة التجويد مع تتبع نسبة التقدم وعرض الحجم والرسائل التوضيحية
   */
  static async downloadDataset(
    onProgress?: (progress: TajweedDownloadProgress) => void
  ): Promise<void> {
    isCancelledFlag = false;

    // إذا كانت محملة مسبقاً، نحرص فقط على تجهيز الفهرس
    if (this.isDatasetDownloaded()) {
      if (!cachedIndex) {
        onProgress?.({
          stage: 'indexing',
          progress: 0.9,
          percentage: 90,
          bytesWritten: TOTAL_EXPECTED_BYTES,
          totalBytes: TOTAL_EXPECTED_BYTES,
          message: 'جارٍ إعداد وفهرسة أحكام التجويد...',
        });
        await loadIndexFromDisk();
      }
      onProgress?.({
        stage: 'completed',
        progress: 1.0,
        percentage: 100,
        bytesWritten: TOTAL_EXPECTED_BYTES,
        totalBytes: TOTAL_EXPECTED_BYTES,
        message: 'بيانات التجويد جاهزة للاستخدام دون إنترنت.',
      });
      return;
    }

    let editionBytesWritten = 0;
    let dataBytesWritten = 0;

    const reportCombined = (
      stage: TajweedDownloadProgress['stage'],
      message: string
    ) => {
      const currentBytes = Math.min(
        editionBytesWritten + dataBytesWritten,
        TOTAL_EXPECTED_BYTES
      );
      const progressFraction = Math.min(currentBytes / TOTAL_EXPECTED_BYTES, 0.9);
      const percentage = Math.round(progressFraction * 100);
      onProgress?.({
        stage,
        progress: progressFraction,
        percentage,
        bytesWritten: currentBytes,
        totalBytes: TOTAL_EXPECTED_BYTES,
        message,
      });
    };

    // المرحلة 1: تنزيل النص العثماني المرجعي (~1.38 MB)
    reportCombined('downloading_edition', 'جارٍ تنزيل النص القرآني العثماني المرجعي...');
    await downloadPersistentFile(
      EDITION_URL,
      EDITION_FILE_NAME,
      EDITION_EXPECTED_BYTES,
      EDITION_MIN_BYTES,
      (written) => {
        editionBytesWritten = written;
        reportCombined('downloading_edition', 'جارٍ تنزيل النص القرآني العثماني المرجعي...');
      }
    );
    editionBytesWritten = EDITION_EXPECTED_BYTES;

    // المرحلة 2: تنزيل ملف أحكام وقواعد التجويد (~5.58 MB)
    reportCombined('downloading_data', 'جارٍ تنزيل أحكام وقواعد التجويد...');
    await downloadPersistentFile(
      DATA_URL,
      DATA_FILE_NAME,
      DATA_EXPECTED_BYTES,
      DATA_MIN_BYTES,
      (written) => {
        dataBytesWritten = written;
        reportCombined('downloading_data', 'جارٍ تنزيل أحكام وقواعد التجويد...');
      }
    );
    dataBytesWritten = DATA_EXPECTED_BYTES;

    // المرحلة 3: الفهرسة والبناء
    onProgress?.({
      stage: 'indexing',
      progress: 0.95,
      percentage: 95,
      bytesWritten: TOTAL_EXPECTED_BYTES,
      totalBytes: TOTAL_EXPECTED_BYTES,
      message: 'جارٍ إعداد وفهرسة 6,236 آية وأحكامها...',
    });

    await loadIndexFromDisk();

    onProgress?.({
      stage: 'completed',
      progress: 1.0,
      percentage: 100,
      bytesWritten: TOTAL_EXPECTED_BYTES,
      totalBytes: TOTAL_EXPECTED_BYTES,
      message: 'تم اكتمال تنزيل وتثبيت بيانات التجويد بنجاح.',
    });
  }

  /**
   * جلب بيانات وأحكام التجويد لآية محددة
   */
  static async getAyah(
    surah: number,
    ayah: number
  ): Promise<TajweedAyahData | null> {
    if (
      !Number.isInteger(surah) ||
      !Number.isInteger(ayah) ||
      surah < 1 ||
      surah > 114 ||
      ayah < 1
    ) {
      return null;
    }

    if (cachedIndex) {
      return cachedIndex.get(getVerseKey(surah, ayah)) ?? null;
    }

    if (this.isDatasetDownloaded()) {
      if (!loadPromise) {
        loadPromise = loadIndexFromDisk()
          .then((idx) => {
            loadPromise = null;
            return idx;
          })
          .catch((err) => {
            loadPromise = null;
            throw err;
          });
      }
      const index = await loadPromise;
      return index.get(getVerseKey(surah, ayah)) ?? null;
    }

    return null;
  }

  /**
   * حذف حزمة التجويد لتفريغ المساحة إذا رغب المستخدم
   */
  static deleteDataset(): void {
    cachedIndex = null;
    loadPromise = null;
    const dataFile = new File(Paths.document, DATA_FILE_NAME);
    const editionFile = new File(Paths.document, EDITION_FILE_NAME);
    if (dataFile.exists) {
      try {
        dataFile.delete();
      } catch {
        // Ignore
      }
    }
    if (editionFile.exists) {
      try {
        editionFile.delete();
      } catch {
        // Ignore
      }
    }
  }
}
