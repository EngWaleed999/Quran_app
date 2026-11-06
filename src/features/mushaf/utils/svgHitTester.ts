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
 * تفحص ما إذا كانت النقطة تقع هندسياً داخل المضلع.
 * محصنة ضد الحالات الحدية (Coincident Vertices, Horizontal Edges).
 */
export function isPointInPolygon(
  point: [number, number],
  vertices: [number, number][]
): boolean {
  if (!vertices || vertices.length < 3) {
    return false;
  }

  const [x, y] = point;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  let inside = false;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i][0];
    const yi = vertices[i][1];
    const xj = vertices[j][0];
    const yj = vertices[j][1];

    if (!Number.isFinite(xi) || !Number.isFinite(yi) || !Number.isFinite(xj) || !Number.isFinite(yj)) {
      continue;
    }

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
 * ومراعاة إزاحات وهوامش الشاشات المختلفة (Letterboxing / Pillarboxing).
 *
 * عند النقر خارج مساحة الصفحة الفعلية (Letterbox margin)، تُرجع الدالة قيم NaN
 * لمنع تفعيل أي آية بالخطأ.
 */
export function mapTouchToSvgCoordinates(
  touchX: number,
  touchY: number,
  containerWidth: number,
  containerHeight: number,
  viewBox: SvgViewBoxBounds
): SvgPoint {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    viewBox.width <= 0 ||
    viewBox.height <= 0 ||
    !Number.isFinite(touchX) ||
    !Number.isFinite(touchY)
  ) {
    return { svgX: NaN, svgY: NaN };
  }

  // حساب معامل القياس الموحد لأصغر بعد لتفادي تشويه الرسم
  const scale = Math.min(
    containerWidth / viewBox.width,
    containerHeight / viewBox.height
  );

  if (scale <= 0 || !Number.isFinite(scale)) {
    return { svgX: NaN, svgY: NaN };
  }

  // حساب الهامش الفارغ المتمركز أفقياً ورأسياً (Letterbox / Pillarbox)
  const contentWidth = viewBox.width * scale;
  const contentHeight = viewBox.height * scale;
  const offsetX = (containerWidth - contentWidth) / 2;
  const offsetY = (containerHeight - contentHeight) / 2;

  // التحقق مما إذا كانت نقطة اللمس خارج مساحة رسم الصفحة الفعلية
  const tolerance = 2; // هامش تسامح طفيف بكسلين
  if (
    touchX < offsetX - tolerance ||
    touchX > offsetX + contentWidth + tolerance ||
    touchY < offsetY - tolerance ||
    touchY > offsetY + contentHeight + tolerance
  ) {
    return { svgX: NaN, svgY: NaN };
  }

  // تحويل نقطة اللمس مع إضافة إزاحة بداية الـ viewBox (Negative ViewBox Support)
  const svgX = viewBox.minX + (touchX - offsetX) / scale;
  const svgY = viewBox.minY + (touchY - offsetY) / scale;

  return { svgX, svgY };
}

/**
 * فحص الآية تحت نقطة اللمس (Hit-Testing)
 * يرجع كائن الآية إذا وقعت النقطة داخل أي من أسطر/مضلعات الآية.
 * يرفض فوراً أي نقاط غير صالحة ناتجة عن النقر خارج مساحة الصفحة.
 */
export function findAyahAtSvgCoordinates(
  svgPoint: SvgPoint,
  ayahs: NormalizedAyahGeometry[]
): NormalizedAyahGeometry | null {
  if (!Number.isFinite(svgPoint.svgX) || !Number.isFinite(svgPoint.svgY) || !ayahs) {
    return null;
  }

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
