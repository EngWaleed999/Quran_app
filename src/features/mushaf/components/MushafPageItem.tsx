import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  GestureResponderEvent,
} from 'react-native';
import { SQLiteDatabase } from 'expo-sqlite';
import { SurahBanner } from './SurahBanner';
import { QuranColors } from '../../../core/theme/theme';
import { QcfFontManager } from '../../../core/fonts/qcfFontManager';
import {
  QcfPageRepository,
  QcfPageRow,
  QcfPageToken,
} from '../../../core/database/qcfPageRepository';

// ==========================================
// 🎨 إعدادات العرض والأبعاد والخط الافتراضي (Layout Config)
// ==========================================
export const MUSHAF_LAYOUT_CONFIG = {
  // هوامش جوانب الصفحة (يمين ويسار)
  paddingHorizontal: 2,
  // الهامش العلوي (أسفل الهيدر)
  paddingTop: 0,
  // الهامش السفلي
  paddingBottom: 4,
  // حدود حجم الخط التلقائي المتجاوب
  minFontSize: 16.5,
  maxFontSize: 23.5,
  fontScaleDivisor: 23, // حساب الخط المتجاوب لشاشات الهواتف
};

interface MushafPageItemProps {
  page: number;
  db: SQLiteDatabase;
  isNear: boolean;
  onToggleControls?: () => void;
  selectedVerseKey?: string | null;
  bookmarkedVerseKey?: string | null;
  searchHighlightVerseKey?: string | null;
  onAyahLongPress?: (verseKey: string, page: number) => void;
}

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

/**
 * نمط عرض خطوط المصحف:
 * 'qpc-hafs': اعتماد خط الرسم العثماني الموحّد (UthmanicHafs) لجميع سور وصفحات المصحف (1-604).
 *             يقضي تماماً على بهتان الكلمات والحركات، ويمنح وضوحاً فائقاً وأداء تصفح فوري (Zero Lag).
 * 'qcf-v2': النمط التجريبي للخطوط المنفصلة (p1.ttf - p604.ttf).
 */
export type MushafFontRenderMode = 'qpc-hafs' | 'qcf-v2';
export const MUSHAF_FONT_RENDER_MODE = 'qpc-hafs' as MushafFontRenderMode;

const MushafPageItemComponent: React.FC<MushafPageItemProps> = ({
  page,
  db,
  isNear,
  onToggleControls,
  selectedVerseKey,
  bookmarkedVerseKey,
  searchHighlightVerseKey,
  onAyahLongPress,
}) => {
  const { width: windowWidth } = useWindowDimensions();

  const fontName = useMemo(
    () => QcfFontManager.getFontFamilyName(page),
    [page]
  );

  const [isFontReady, setIsFontReady] = useState(() =>
    QcfFontManager.isPageFontLoaded(page)
  );
  const [fontLoadError, setFontLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!isNear || isFontReady || MUSHAF_FONT_RENDER_MODE === 'qpc-hafs') {
      return () => {
        isMounted = false;
      };
    }

    setFontLoadError(null);

    QcfFontManager.loadPageFont(page)
      .then(() => {
        if (isMounted) {
          setIsFontReady(true);
          setFontLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        const message =
          error instanceof Error ? error.message : String(error);
        setFontLoadError(message);
        console.error(
          '[MushafPageItem] QCF font failed for page ' + page + '. Unicode fallback is active.',
          error
        );
      });

    return () => {
      isMounted = false;
    };
  }, [isNear, isFontReady, page]);

  const pageRows: QcfPageRow[] = useMemo(
    () => QcfPageRepository.getPageRows(db, page),
    [db, page]
  );

  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
  } | null>(null);

  const handleTouchStart = (event: GestureResponderEvent) => {
    touchStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    if (!touchStartRef.current) return;

    const deltaX = Math.abs(event.nativeEvent.pageX - touchStartRef.current.x);
    const deltaY = Math.abs(event.nativeEvent.pageY - touchStartRef.current.y);
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    if (deltaX < 10 && deltaY < 10 && elapsed < 300) {
      onToggleControls?.();
    }
  };

  // معادلة الخط الافتراضي واستجابته لعرض الشاشة بدون حواف ضائعة
  const baseFontSize = useMemo(
    () =>
      Math.min(
        MUSHAF_LAYOUT_CONFIG.maxFontSize,
        Math.max(
          MUSHAF_LAYOUT_CONFIG.minFontSize,
          windowWidth / MUSHAF_LAYOUT_CONFIG.fontScaleDivisor
        )
      ),
    [windowWidth]
  );

  const renderToken = (token: QcfPageToken, index: number) => {
    const useQcfGlyph =
      MUSHAF_FONT_RENDER_MODE === 'qcf-v2' &&
      token.renderMode === 'qcf' &&
      isFontReady;
    const text =
      useQcfGlyph
        ? token.text
        : (token.fallbackText || token.text);

    const fontFamily = useQcfGlyph ? fontName : 'UthmanicHafs';

    const isSelected = selectedVerseKey === token.verseKey;
    const isBookmarked = bookmarkedVerseKey === token.verseKey;
    const isSearchHighlighted = searchHighlightVerseKey === token.verseKey;

    let highlightBg = 'transparent';
    if (isSelected) {
      highlightBg = 'rgba(197, 155, 39, 0.28)'; // Golden highlight when selected
    } else if (isBookmarked) {
      highlightBg = 'rgba(31, 81, 63, 0.20)'; // Subtle emerald highlight for persistent bookmark
    } else if (isSearchHighlighted) {
      highlightBg = 'rgba(197, 155, 39, 0.24)'; // Gentle gold highlight for search target
    }

    return (
      <Text
        key={
          token.verseKey + ':' + token.position + ':' + token.charTypeName + ':' + index
        }
        onLongPress={() => onAyahLongPress?.(token.verseKey, page)}
        style={[
          { fontFamily },
          highlightBg !== 'transparent' && {
            backgroundColor: highlightBg,
            borderRadius: 3,
          },
        ]}
      >
        {index > 0 ? ' ' : null}
        {text}
      </Text>
    );
  };

  if (!isNear) {
    return <View style={styles.placeholder} />;
  }

  return (
    <View
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={styles.pageContainer}
    >
      <View style={styles.contentArea}>
        {pageRows.map((row, index) => {
          if (row.type === 'surah') {
            return (
              <View key={'surah-' + index} style={styles.physicalRow}>
                <SurahBanner
                  surahName={row.suraName}
                  suraNo={row.suraNo}
                />
              </View>
            );
          }

          if (row.type === 'basmala') {
            return (
              <View key={'basmala-' + index} style={styles.physicalRow}>
                <Text
                  style={[
                    styles.basmalaText,
                    { fontSize: Math.min(21, baseFontSize) },
                  ]}
                  allowFontScaling={false}
                  numberOfLines={1}
                >
                  {BASMALA}
                </Text>
              </View>
            );
          }

          if (row.type === 'blank') {
            return (
              <View
                key={'blank-' + index}
                style={styles.physicalRow}
              />
            );
          }

          return (
            <View key={'line-' + index} style={styles.physicalRow}>
              <Text
                style={[
                  styles.lineText,
                  { fontSize: baseFontSize },
                ]}
                numberOfLines={1}
                ellipsizeMode="clip"
                allowFontScaling={false}
              >
                {row.tokens.map(renderToken)}
              </Text>
            </View>
          );
        })}
      </View>

      {fontLoadError && MUSHAF_FONT_RENDER_MODE === 'qcf-v2' ? (
        <View style={styles.fontFallbackBadge}>
          <Text style={styles.fontFallbackText}>عرض احتياطي للنص</Text>
        </View>
      ) : null}
    </View>
  );
};

export const MushafPageItem = React.memo(
  MushafPageItemComponent,
  (previous, next) =>
    previous.page === next.page &&
    previous.isNear === next.isNear &&
    previous.selectedVerseKey === next.selectedVerseKey &&
    previous.bookmarkedVerseKey === next.bookmarkedVerseKey &&
    previous.searchHighlightVerseKey === next.searchHighlightVerseKey
);

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: QuranColors.parchment,
  },
  pageContainer: {
    flex: 1,
    backgroundColor: QuranColors.parchment,
    paddingHorizontal: MUSHAF_LAYOUT_CONFIG.paddingHorizontal,
    paddingTop: MUSHAF_LAYOUT_CONFIG.paddingTop,
    paddingBottom: MUSHAF_LAYOUT_CONFIG.paddingBottom,
  },
  contentArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
  },
  physicalRow: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineText: {
    width: '100%',
    color: '#000000',
    textAlign: 'center',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  basmalaText: {
    maxWidth: '100%',
    color: QuranColors.textDark,
    textAlign: 'center',
    writingDirection: 'rtl',
    includeFontPadding: false,
    fontFamily: 'UthmanicHafs',
  },
  fontFallbackBadge: {
    position: 'absolute',
    top: 4,
    right: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(197, 155, 39, 0.12)',
  },
  fontFallbackText: {
    color: QuranColors.textMuted,
    fontSize: 9,
  },
});
