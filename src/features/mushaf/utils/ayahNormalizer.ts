import {
  RawAyahJsonEntry,
  NormalizedAyahGeometry,
  NormalizedPageData,
  SvgViewBoxBounds,
} from '../types/svgMushaf.types';

/**
 * تحليل وتفكيك سلسلة الـ viewBox إلى أبعاد رقمية صريحة.
 * يدعم القيم السالبة (Negative ViewBox) والإزاحات النسبية بدقة.
 */
export function parseViewBox(viewBoxStr: string): SvgViewBoxBounds {
  if (!viewBoxStr || typeof viewBoxStr !== 'string') {
    return {
      minX: 0,
      minY: 0,
      width: 345,
      height: 550,
      raw: '0 0 345 550',
    };
  }

  const parts = viewBoxStr
    .trim()
    .split(/\s+/)
    .map(Number);

  if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
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
 * مع التحقق التام من صلاحية الإحداثيات ورفض القيم غير المعرفة
 */
export function convertPointsToSvgPath(pointsStr: string): {
  pathD: string;
  points: [number, number][];
} {
  if (!pointsStr || typeof pointsStr !== 'string') {
    return { pathD: '', points: [] };
  }

  const points: [number, number][] = pointsStr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const coords = pair.split(',').map(Number);
      return [coords[0], coords[1]] as [number, number];
    })
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

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
 * محلل مسار SVG متطور (SVG Path Tokenizer & State Machine Interpreter)
 * يفكك مسارات SVG المركبة (Compound Paths) ويدعم أوامر:
 * M, m, L, l, H, h, V, v, Z, z مع رفض أي قيم NaN أو Infinity
 * واستخراج مضلعات صلبة ومستقلة لاختبار اللمس (Hit Testing).
 */
export function extractSubPolygonsFromSvgPath(pathD: string): [number, number][][] {
  if (!pathD || typeof pathD !== 'string') return [];

  const tokens = pathD.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens || tokens.length === 0) return [];

  const polygons: [number, number][][] = [];
  let currentPolygon: [number, number][] = [];
  let currX = 0;
  let currY = 0;
  let subStartX = 0;
  let subStartY = 0;

  let i = 0;
  function isNextNumber(): boolean {
    if (i >= tokens!.length) return false;
    const t = tokens![i];
    return !/^[a-zA-Z]$/.test(t);
  }

  function nextNumber(): number {
    if (i >= tokens!.length) return NaN;
    const n = parseFloat(tokens![i++]);
    return Number.isFinite(n) ? n : NaN;
  }

  function commitSubPolygon(): void {
    if (currentPolygon.length >= 3) {
      polygons.push(currentPolygon);
    }
    currentPolygon = [];
  }

  function addPoint(x: number, y: number): void {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      // تفادي تكرار نفس النقطة المتتالية لضمان نظافة المضلع
      const len = currentPolygon.length;
      if (len === 0 || currentPolygon[len - 1][0] !== x || currentPolygon[len - 1][1] !== y) {
        currentPolygon.push([x, y]);
      }
    }
  }

  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M': {
        commitSubPolygon();
        const x = nextNumber();
        const y = nextNumber();
        if (Number.isFinite(x) && Number.isFinite(y)) {
          currX = x;
          currY = y;
          subStartX = x;
          subStartY = y;
          addPoint(currX, currY);
        }
        while (isNextNumber()) {
          const lx = nextNumber();
          const ly = nextNumber();
          if (Number.isFinite(lx) && Number.isFinite(ly)) {
            currX = lx;
            currY = ly;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'm': {
        commitSubPolygon();
        const dx = nextNumber();
        const dy = nextNumber();
        if (Number.isFinite(dx) && Number.isFinite(dy)) {
          currX += dx;
          currY += dy;
          subStartX = currX;
          subStartY = currY;
          addPoint(currX, currY);
        }
        while (isNextNumber()) {
          const ldx = nextNumber();
          const ldy = nextNumber();
          if (Number.isFinite(ldx) && Number.isFinite(ldy)) {
            currX += ldx;
            currY += ldy;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'L': {
        while (isNextNumber()) {
          const x = nextNumber();
          const y = nextNumber();
          if (Number.isFinite(x) && Number.isFinite(y)) {
            currX = x;
            currY = y;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'l': {
        while (isNextNumber()) {
          const dx = nextNumber();
          const dy = nextNumber();
          if (Number.isFinite(dx) && Number.isFinite(dy)) {
            currX += dx;
            currY += dy;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'H': {
        while (isNextNumber()) {
          const x = nextNumber();
          if (Number.isFinite(x)) {
            currX = x;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'h': {
        while (isNextNumber()) {
          const dx = nextNumber();
          if (Number.isFinite(dx)) {
            currX += dx;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'V': {
        while (isNextNumber()) {
          const y = nextNumber();
          if (Number.isFinite(y)) {
            currY = y;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'v': {
        while (isNextNumber()) {
          const dy = nextNumber();
          if (Number.isFinite(dy)) {
            currY += dy;
            addPoint(currX, currY);
          }
        }
        break;
      }
      case 'Z':
      case 'z': {
        currX = subStartX;
        currY = subStartY;
        commitSubPolygon();
        break;
      }
      default:
        break;
    }
  }

  commitSubPolygon();
  return polygons;
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
      console.warn(`[Normalizer] Page ${pageNumber}: Ayah ${surah}:${ayah} produced no valid polygons.`);
      continue;
    }

    const markerX = Number(item.x ?? 0);
    const markerY = Number(item.y ?? 0);

    normalizedAyahs.push({
      surah,
      ayah,
      verseKey: `${surah}:${ayah}`,
      pathD,
      subPolygons,
      marker: {
        x: Number.isFinite(markerX) ? markerX : 0,
        y: Number.isFinite(markerY) ? markerY : 0,
      },
    });
  }

  return {
    page: pageNumber,
    viewBox,
    ayahs: normalizedAyahs,
  };
}
