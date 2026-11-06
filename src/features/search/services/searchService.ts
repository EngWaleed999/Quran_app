import { SQLiteDatabase } from 'expo-sqlite';
import { QuranRepository } from '../../../core/database/quranRepository';
import {
  SearchResults,
  SurahSearchResult,
  AyahSearchResult,
  PageSearchResult,
} from '../types/search.types';

/**
 * التطبيع اللغوي للنص العربي لتسهيل البحث الشامل
 * يزيل التشكيل ويوحد أشكال الهمزات والتاء المربوطة والأرقام العربية
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة الحركات والتنوين والمد
    .replace(/[إأآا]/g, 'ا')              // توحيد الألف
    .replace(/ة/g, 'ه')                   // توحيد التاء المربوطة والهاء
    .replace(/ى/g, 'ي')                   // توحيد الياء والألف المقصورة
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))) // تحويل الأرقام المشرقية
    .trim();
}

export class SearchService {
  /**
   * بحث شامل ذكي في السور، الصفحات، والآيات
   */
  static async searchQuran(
    db: SQLiteDatabase,
    rawQuery: string,
    ayahsLimit: number = 50
  ): Promise<SearchResults> {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      return { pageResult: null, surahs: [], ayahs: [] };
    }

    const normQuery = normalizeArabicText(trimmed);
    if (!normQuery) {
      return { pageResult: null, surahs: [], ayahs: [] };
    }

    const allSurahs = QuranRepository.getAllSurahsSync(db);

    // 1. البحث برقم الصفحة (1 - 604) وليس برقم السورة (حسب متطلبات النظام)
    let pageResult: PageSearchResult | null = null;
    const pageNumberMatch = normQuery.match(/^(?:صفحه|ص)?\s*(\d{1,3})$/);
    if (pageNumberMatch) {
      const pageNum = parseInt(pageNumberMatch[1], 10);
      if (pageNum >= 1 && pageNum <= 604) {
        const foundSurah =
          allSurahs.find((s) => pageNum >= s.page_start && pageNum <= s.page_end) ??
          allSurahs[0];

        pageResult = {
          page: pageNum,
          surah_name_ar: foundSurah.sura_name_ar,
          jozz: foundSurah.jozz_start,
        };
      }
    }

    // 2. البحث في أسماء السور حصراً بالاسم (بدون رقم السورة لمنع اللبس مع رقم الصفحة)
    const matchedSurahs: SurahSearchResult[] = allSurahs.filter((surah) => {
      const normSurahName = normalizeArabicText(surah.sura_name_ar);
      return normSurahName.includes(normQuery);
    });

    // 3. البحث في نصوص الآيات (إذا كان طول الاستعلام حرفين أو أكثر ولا يمثل رقماً فقط)
    let matchedAyahs: AyahSearchResult[] = [];
    if (normQuery.length >= 2 && !/^\d+$/.test(normQuery)) {
      try {
        matchedAyahs = await db.getAllAsync<AyahSearchResult>(
          `SELECT a.id, a.sura_no, s.sura_name_ar, a.page, a.aya_no, a.aya_text_emlaey 
           FROM ayahs a 
           JOIN surahs s ON a.sura_no = s.sura_no 
           WHERE REPLACE(REPLACE(REPLACE(REPLACE(a.aya_text_emlaey, 'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ة', 'ه') LIKE ? 
           ORDER BY a.id ASC 
           LIMIT ?`,
          [`%${normQuery}%`, ayahsLimit]
        );
      } catch (error) {
        console.warn('[SearchService] Error searching ayahs:', error);
      }
    }

    return {
      pageResult,
      surahs: matchedSurahs,
      ayahs: matchedAyahs,
    };
  }
}
