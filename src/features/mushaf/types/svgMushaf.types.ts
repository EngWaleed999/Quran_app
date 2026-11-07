/**
 * عقود ونماذج بيانات محرك عرض المصحف بالرسوميات المتجهية (SVG + JSON)
 */

export interface RawAyahJsonEntry {
  surahNumber?: number;
  sura_number?: number;
  surah?: number;
  ayahNumber?: number;
  ayah_number?: number;
  ayah?: number;
  x?: number;
  y?: number;
  polygon: string;
}

export interface NormalizedAyahGeometry {
  surah: number;
  ayah: number;
  verseKey: string; // صيغة قياسية موحدة مثل "1:1" أو "2:255"
  pathD: string; // صيغة مسار SVG صالح للرسم (M ... L ... Z)
  subPolygons: [number, number][][]; // مصفوفة المضلعات الفرعية لكشف اللمس (Hit-Testing)
  marker: {
    x: number;
    y: number;
  };
}

export interface SvgViewBoxBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
  raw: string;
}

export interface NormalizedPageData {
  page: number;
  viewBox: SvgViewBoxBounds;
  ayahs: NormalizedAyahGeometry[];
}

export interface SvgPilotPageAsset {
  page: number;
  svgXml: string;
  viewBox: string;
  rawJson: RawAyahJsonEntry[];
}
