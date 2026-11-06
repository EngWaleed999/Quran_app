import {
  NormalizedAyahGeometry,
  SvgViewBoxBounds,
} from '../types/svgMushaf.types';

export interface SvgPoint {
  svgX: number;
  svgY: number;
}

/**
 * خوارزمية شعاع التقاطع (Ray-Casting Algorithm)
 * تفحص ما إذا كانت النقطة تقع هندسياً داخل المضلع
 */
export function isPointInPolygon(
  point: [number, number],
  vertices: [number, number][]
): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i][0];
    const yi = vertices[i][1];
    const xj = vertices[j][0];
    const yj = vertices[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * معادلة الإسقاط الرياضي العكسي:
 * تحويل إحداثيات لمس الشاشة (Touch Coordinates) إلى نظام إحداثيات الـ SVG (ViewBox Space)
 * بمراعاة نسبة العرض للارتفاع القياسية (preserveAspectRatio="xMidYMid meet")
 * ومراعاة إزاحات وهوامش الشاشات المختلفة (Letterboxing / Pillarboxing)
 */
export function mapTouchToSvgCoordinates(
  touchX: number,
  touchY: number,
  containerWidth: number,
  containerHeight: number,
  viewBox: SvgViewBoxBounds
): SvgPoint {
  if (containerWidth <= 0 || containerHeight <= 0 || viewBox.width <= 0 || viewBox.height <= 0) {
    return { svgX: touchX, svgY: touchY };
  }

  // حساب معامل القياس الموحد لأصغر بعد لتفادي تشويه الرسم
  const scale = Math.min(
    containerWidth / viewBox.width,
    containerHeight / viewBox.height
  );

  // حساب الهامش الفارغ المتمركز أفقياً ورأسياً
  const offsetX = (containerWidth - viewBox.width * scale) / 2;
  const offsetY = (containerHeight - viewBox.height * scale) / 2;

  // تحويل نقطة اللمس مع إضافة إزاحة بداية الـ viewBox (مهم لصفحة 1 و 2 ذات القيم السالبة)
  const svgX = viewBox.minX + (touchX - offsetX) / scale;
  const svgY = viewBox.minY + (touchY - offsetY) / scale;

  return { svgX, svgY };
}

/**
 * فحص الآية تحت نقطة اللمس (Hit-Testing)
 * يرجع كائن الآية إذا وقعت النقطة داخل أي من أسطر/مضلعات الآية
 */
export function findAyahAtSvgCoordinates(
  svgPoint: SvgPoint,
  ayahs: NormalizedAyahGeometry[]
): NormalizedAyahGeometry | null {
  const pt: [number, number] = [svgPoint.svgX, svgPoint.svgY];

  for (const ayah of ayahs) {
    for (const polygon of ayah.subPolygons) {
      if (isPointInPolygon(pt, polygon)) {
        return ayah;
      }
    }
  }

  return null;
}
