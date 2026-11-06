import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { SQLiteDatabase } from 'expo-sqlite';
import { SvgXml } from 'react-native-svg';
import { SvgMushafRepository } from '../../../core/database/svgMushafRepository';
import { normalizePageAyahData } from '../utils/ayahNormalizer';
import {
  mapTouchToSvgCoordinates,
  findAyahAtSvgCoordinates,
} from '../utils/svgHitTester';
import { SvgAyahHighlightOverlay } from './SvgAyahHighlightOverlay';
import { SurahBanner } from './SurahBanner';
import { QuranRepository } from '../../../core/database/quranRepository';
import { QuranColors } from '../../../core/theme/theme';

interface MushafSvgPageItemProps {
  page: number;
  db?: SQLiteDatabase | null;
  isNear: boolean;
  onToggleControls?: () => void;
  selectedVerseKey?: string | null;
  bookmarkedVerseKey?: string | null;
  searchHighlightVerseKey?: string | null;
  onAyahLongPress?: (verseKey: string, page: number) => void;
}

const MushafSvgPageItemComponent: React.FC<MushafSvgPageItemProps> = ({
  page,
  db,
  isNear,
  onToggleControls,
  selectedVerseKey,
  bookmarkedVerseKey,
  searchHighlightVerseKey,
  onAyahLongPress,
}) => {
  const theme = useTheme();
  const isDark = theme.dark;

  // أبعاد الحاوية الفعلية للـ SVG على شاشة الجهاز
  const [layoutDimensions, setLayoutDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  // استخراج أصل صفحة الـ SVG من قاعدة البيانات فائقة السرعة
  const pageAsset = useMemo(() => {
    if (!db) return null;
    return SvgMushafRepository.getPageAssetSync(db, page);
  }, [db, page]);

  // التحقق من وجود سورة تبدأ في هذه الصفحة من قاعدة البيانات
  const surahHeader = useMemo(() => {
    if (!db) return null;
    return QuranRepository.getSurahStartingOnPage(db, page);
  }, [db, page]);

  // تحويل وتطبيع بيانات الإحداثيات والمضلعات
  const normalizedData = useMemo(() => {
    if (!pageAsset) return null;
    return normalizePageAyahData(pageAsset.rawJson, page, pageAsset.viewBox);
  }, [pageAsset, page]);

  // تكييف ألوان الـ SVG مع الوضع الليلي (Dark Mode) بسلاسة تامة
  const processedSvgXml = useMemo(() => {
    if (!pageAsset) return '';
    if (!isDark) return pageAsset.svgXml;

    // استبدال لون حبر الكتابة الداكن بلون الخط الليلي الفاتح
    return pageAsset.svgXml.replace(/fill="#231f20"/gi, `fill="${QuranColors.nightText}"`);
  }, [pageAsset, isDark]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayoutDimensions({ width, height });
  }, []);

  // إدارة الإيماءات واللمس (Gesture Disambiguation: Swipe vs Tap vs Long-Press)
  const touchStartRef = useRef<{
    pageX: number;
    pageY: number;
    locationX: number;
    locationY: number;
    time: number;
  } | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTriggeredLongPressRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    const { pageX, pageY, locationX, locationY } = event.nativeEvent;
    touchStartRef.current = {
      pageX,
      pageY,
      locationX,
      locationY,
      time: Date.now(),
    };
    hasTriggeredLongPressRef.current = false;

    clearLongPressTimer();

    // جدولة فحص الضغط المطول بعد 450 مللي ثانية
    longPressTimerRef.current = setTimeout(() => {
      if (!touchStartRef.current || !normalizedData) return;
      if (layoutDimensions.width <= 0 || layoutDimensions.height <= 0) return;

      // إسقاط نقطة اللمس على إحداثيات الـ SVG نسبة لحاوية الـ SVG المعزولة
      const svgPoint = mapTouchToSvgCoordinates(
        touchStartRef.current.locationX,
        touchStartRef.current.locationY,
        layoutDimensions.width,
        layoutDimensions.height,
        normalizedData.viewBox
      );

      // كشف الآية المحددة بالضغط المطول
      const hitAyah = findAyahAtSvgCoordinates(svgPoint, normalizedData.ayahs);
      if (hitAyah) {
        hasTriggeredLongPressRef.current = true;
        onAyahLongPress?.(hitAyah.verseKey, page);
      }
    }, 450);
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    if (!touchStartRef.current) return;

    const deltaX = Math.abs(event.nativeEvent.pageX - touchStartRef.current.pageX);
    const deltaY = Math.abs(event.nativeEvent.pageY - touchStartRef.current.pageY);

    // إذا تحرك الإصبع أكثر من 10 بكسل، فإن المستخدم يقوم بتمرير/تقليب الصفحة (Swipe)
    if (deltaX > 10 || deltaY > 10) {
      clearLongPressTimer();
    }
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    clearLongPressTimer();

    if (hasTriggeredLongPressRef.current) {
      hasTriggeredLongPressRef.current = false;
      touchStartRef.current = null;
      return;
    }

    if (!touchStartRef.current) return;

    const deltaX = Math.abs(event.nativeEvent.pageX - touchStartRef.current.pageX);
    const deltaY = Math.abs(event.nativeEvent.pageY - touchStartRef.current.pageY);
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // نقر خفيف مستقر دون حركة للتبديل بين وضع ملء الشاشة والأدوات
    if (deltaX < 10 && deltaY < 10 && elapsed < 300) {
      onToggleControls?.();
    }
  };

  const handleTouchCancel = () => {
    clearLongPressTimer();
    hasTriggeredLongPressRef.current = false;
    touchStartRef.current = null;
  };

  if (!isNear || !pageAsset || !normalizedData) {
    return <View style={styles.placeholder} />;
  }

  return (
    <View style={styles.pageContainer}>
      {/* بنر اسم السورة العلوي عند بداية السورة، مدمج مع تجاوب اللمس */}
      {surahHeader && (
        <View style={styles.bannerWrapper} onTouchEnd={onToggleControls}>
          <SurahBanner
            surahName={surahHeader.sura_name_ar}
            suraNo={surahHeader.sura_no}
          />
        </View>
      )}

      {/* منطقة محتوى الـ SVG المعزولة هندسياً لحساب الإحداثيات بدقة 100% */}
      <View
        onLayout={handleLayout}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={styles.svgContentArea}
      >
        {/* طبقة رسم صفحة المصحف المتجهية بـ SVG */}
        <SvgXml
          xml={processedSvgXml}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* طبقة تظليل الآيات المتجهية العائمة */}
        <SvgAyahHighlightOverlay
          viewBox={pageAsset.viewBox}
          ayahs={normalizedData.ayahs}
          selectedVerseKey={selectedVerseKey}
          bookmarkedVerseKey={bookmarkedVerseKey}
          searchHighlightVerseKey={searchHighlightVerseKey}
        />
      </View>
    </View>
  );
};

export const MushafSvgPageItem = React.memo(
  MushafSvgPageItemComponent,
  (prev, next) =>
    prev.page === next.page &&
    prev.db === next.db &&
    prev.isNear === next.isNear &&
    prev.selectedVerseKey === next.selectedVerseKey &&
    prev.bookmarkedVerseKey === next.bookmarkedVerseKey &&
    prev.searchHighlightVerseKey === next.searchHighlightVerseKey
);

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  bannerWrapper: {
    width: '100%',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgContentArea: {
    flex: 1,
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
