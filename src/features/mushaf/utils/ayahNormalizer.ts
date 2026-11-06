import {
  RawAyahJsonEntry,
  NormalizedAyahGeometry,
  NormalizedPageData,
  SvgViewBoxBounds,
} from '../types/svgMushaf.types';

/**
 * تحليل وتفكيك سلسلة الـ viewBox إلى أبعاد رقمية صريحة
 */
export function parseViewBox(viewBoxStr: string): SvgViewBoxBounds {
  const parts = viewBoxStr.trim().split(/\s+/).map(Number);
  if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
    return {
      minX: parts[0],
      minY: parts[1],
      width: parts[2],
      height: parts[3],
      raw: viewBoxStr.trim(),
    };
  }

  // أبعاد افتراضية متوافقة مع مصحف المدينة
  return {
    minX: 0,
    minY: 0,
    width: 345,
    height: 550,
    raw: '0 0 345 550',
  };
}

/**
 * تحويل سلسلة نقاط مضلع عادية إلى مسار SVG صالح (M ... L ... Z)
 */
export function convertPointsToSvgPath(pointsStr: string): {
  pathD: string;
  points: [number, number][];
} {
  const points: [number, number][] = pointsStr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const coords = pair.split(',').map(Number);
      return [coords[0], coords[1]] as [number, number];
    })
    .filter(([x, y]) => !isNaN(x) && !isNaN(y));

  if (points.length < 3) {
    return { pathD: '', points: [] };
  }

  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0]} ${points[i][1]}`;
  }
  d += ' Z';

  return { pathD: d, points };
}

/**
 * تفكيك مسار SVG مركب (Compound Path) واستخراج مصفوفات النقاط لكل سطر/مضلع فرعي
 */
export function extractSubPolygonsFromSvgPath(pathD: string): [number, number][][] {
  const subpathStrings = pathD
    .trim()
    .split(/Z/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const subPolygons: [number, number][][] = [];

  for (const subStr of subpathStrings) {
    const rawNumbers = subStr
      .replace(/[ML]/gi, ' ')
      .trim()
      .split(/\s+/)
      .map(Number);

    const pts: [number, number][] = [];
    for (let i = 0; i < rawNumbers.length; i += 2) {
      const x = rawNumbers[i];
      const y = rawNumbers[i + 1];
      if (!isNaN(x) && !isNaN(y)) {
        pts.push([x, y]);
      }
    }

    if (pts.length >= 3) {
      subPolygons.push(pts);
    }
  }

  return subPolygons;
}

/**
 * معالج توحيد بيانات الآيات (Ayah Data Normalizer)
 * يوحد تضارب الصيغ بين الصفحات (نقاط بسيطة vs مسارات مركبة)
 * وينتج كائناً صلباً وموحداً لطبقة الرسوميات وطبقة فحص اللمس
 */
export function normalizePageAyahData(
  rawEntries: RawAyahJsonEntry[],
  pageNumber: number,
  viewBoxStr: string
): NormalizedPageData {
  const viewBox = parseViewBox(viewBoxStr);
  const normalizedAyahs: NormalizedAyahGeometry[] = [];

  for (const item of rawEntries) {
    const surah = Number(item.surahNumber ?? item.sura_number ?? item.surah ?? 0);
    const ayah = Number(item.ayahNumber ?? item.ayah_number ?? item.ayah ?? 0);

    if (surah <= 0 || ayah <= 0 || !item.polygon) {
      continue;
    }

    const trimmedPoly = item.polygon.trim();
    const isSvgPath = trimmedPoly.startsWith('M') || trimmedPoly.startsWith('m');

    let pathD = '';
    let subPolygons: [number, number][][] = [];

    if (isSvgPath) {
      pathD = trimmedPoly;
      subPolygons = extractSubPolygonsFromSvgPath(trimmedPoly);
    } else {
      const converted = convertPointsToSvgPath(trimmedPoly);
      pathD = converted.pathD;
      if (converted.points.length >= 3) {
        subPolygons = [converted.points];
      }
    }

    if (!pathD || subPolygons.length === 0) {
      continue;
    }

    normalizedAyahs.push({
      surah,
      ayah,
      verseKey: `${surah}:${ayah}`,
      pathD,
      subPolygons,
      marker: {
        x: Number(item.x ?? 0),
        y: Number(item.y ?? 0),
      },
    });
  }

  return {
    page: pageNumber,
    viewBox,
    ayahs: normalizedAyahs,
  };
}
