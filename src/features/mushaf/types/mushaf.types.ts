export interface Ayah {
  id: number;
  jozz: number;
  sura_no: number;
  page: number;
  line_start: number | null;
  line_end: number | null;
  aya_no: number;
  aya_text: string;
  aya_text_emlaey: string;
  sura_name_ar?: string;
}

export interface PageInfo {
  page: number;
  jozz: number;
  primarySurahName: string;
  ayahs: Ayah[];
}

