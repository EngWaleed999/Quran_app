export interface SurahSearchResult {
  sura_no: number;
  sura_name_ar: string;
  sura_name_en: string;
  revelation_place: 'مكية' | 'مدنية';
  ayahs_count: number;
  page_start: number;
  page_end: number;
  jozz_start: number;
}

export interface AyahSearchResult {
  id: number;
  sura_no: number;
  sura_name_ar: string;
  page: number;
  aya_no: number;
  aya_text_emlaey: string;
}

export interface SearchResults {
  surahs: SurahSearchResult[];
  ayahs: AyahSearchResult[];
}
