import { SQLiteDatabase } from 'expo-sqlite';
import { QuranRepository } from '../../../core/database/quranRepository';
import { SearchResults, SurahSearchResult, AyahSearchResult } from '../types/search.types';

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
   * بحث شامل فوري في السور والآيات
   */
  static async searchQuran(
    db: SQLiteDatabase,
    rawQuery: string,
    ayahsLimit: number = 50
  ): Promise<SearchResults> {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      return { surahs: [], ayahs: [] };
    }

    const normQuery = normalizeArabicText(trimmed);
    if (!normQuery) {
      return { surahs: [], ayahs: [] };
    }

    // 1. البحث في السور (بالاسم أو برقم السورة 1-114)
    const allSurahs = QuranRepository.getAllSurahsSync(db);
    const matchedSurahs: SurahSearchResult[] = allSurahs.filter((surah) => {
      const normSurahName = normalizeArabicText(surah.sura_name_ar);
      const isNumberMatch = String(surah.sura_no) === normQuery;
      const isNameMatch = normSurahName.includes(normQuery);
      return isNumberMatch || isNameMatch;
    });

    // 2. البحث في نصوص الآيات (إذا كان طول الاستعلام حرفين أو أكثر)
    let matchedAyahs: AyahSearchResult[] = [];
    if (normQuery.length >= 2) {
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
      surahs: matchedSurahs,
      ayahs: matchedAyahs,
    };
  }
}
