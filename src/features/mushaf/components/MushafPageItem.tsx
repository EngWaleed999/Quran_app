import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, GestureResponderEvent } from 'react-native';
import { SQLiteDatabase } from 'expo-sqlite';
import { SurahBanner } from './SurahBanner';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';
import { QcfFontManager } from '../../../core/fonts/qcfFontManager';
import { QcfPageRepository, QcfPageRow } from '../../../core/database/qcfPageRepository';

interface MushafPageItemProps {
  page: number;
  db: SQLiteDatabase;
  userFontDelta: number;
  isNear: boolean;
  onToggleControls?: () => void;
  onPageDataLoaded?: (page: number, surahName: string, jozz: number) => void;
}

const MushafPageItemComponent: React.FC<MushafPageItemProps> = ({
  page,
  db,
  userFontDelta,
  isNear,
  onToggleControls,
}) => {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // Invariant reading height: Frame height is FIXED and never changes when controls toggle.
  // Overlays (Header and BottomBar) float on top without resizing the reading surface (Zero Layout Shift).
  const availablePageHeight = windowHeight - 56;

  // Font family name for this specific QCF V2 page (e.g. QCF_P1, QCF_P2, ... QCF_P604)
  const fontName = useMemo(() => QcfFontManager.getFontFamilyName(page), [page]);

  // Track font loading state for this page
  const [isFontReady, setIsFontReady] = useState<boolean>(() => {
    return QcfFontManager.isPageFontLoaded(page);
  });

  // Load font asynchronously when page is near the active viewport
  useEffect(() => {
    let isMounted = true;
    if (isNear && !isFontReady) {
      QcfFontManager.loadPageFont(page).then(() => {
        if (isMounted) {
          setIsFontReady(true);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isNear, isFontReady, page]);

  // Retrieve the authentic 15-row physical Medina Mushaf layout for this page
  const pageRows: QcfPageRow[] = useMemo(() => {
    return QcfPageRepository.getPageRows(db, page);
  }, [db, page]);

  // Touch gesture disambiguation: distinguish stationary direct taps from horizontal swipe page flips
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: GestureResponderEvent) => {
    touchStartRef.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: GestureResponderEvent) => {
    if (!touchStartRef.current) return;
    const dx = Math.abs(e.nativeEvent.pageX - touchStartRef.current.x);
    const dy = Math.abs(e.nativeEvent.pageY - touchStartRef.current.y);
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Disambiguation threshold: Only stationary direct tap (< 10px move within 300ms) toggles controls.
    // Horizontal swipe gestures to flip pages (> 10px) will NEVER interrupt full screen!
    if (dx < 10 && dy < 10 && dt < 300) {
      onToggleControls?.();
    }
  };

  // Base optimal font size calibrated for phone screens and Medina 15-line grid
  const baseFontSize = useMemo(() => {
    if (page === 1 || page === 2) {
      return Math.min(25, Math.floor(windowWidth / 14.5));
    }
    // Standard 15-line pages: calibrated so glyphs stretch and fill the line row
    return Math.min(22.5, Math.floor(windowWidth / 15.8));
  }, [page, windowWidth]);

  const finalFontSize = baseFontSize + userFontDelta;

  const isSpecialCenterPage = page === 1 || page === 2;

  if (!isNear || !isFontReady) {
    return <View style={styles.placeholder} />;
  }

  return (
    <ScrollView
      style={styles.pageScrollView}
      contentContainerStyle={[
        styles.scrollContainer,
        userFontDelta > 0 ? { minHeight: availablePageHeight } : { height: availablePageHeight },
      ]}
      scrollEnabled={userFontDelta > 0} // Strictly NO scrolling by default; scrolling activates only on user zoom
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={[
          styles.paperFrame,
          userFontDelta > 0 ? { minHeight: availablePageHeight } : { height: availablePageHeight },
        ]}
      >
        {/* Authentic 15-Row Physical Medina Mushaf Layout */}
        <View
          style={[
            styles.contentArea,
            isSpecialCenterPage ? styles.contentAreaSpecial : styles.contentAreaStandard,
          ]}
        >
          {pageRows.map((row, index) => {
            if (row.type === 'banner') {
              return (
                <View key={`banner-${index}`} style={styles.bannerRow}>
                  <SurahBanner surahName={row.suraName || ''} suraNo={row.suraNo || 1} />
                </View>
              );
            }

            return (
              <View key={`line-${index}`} style={styles.lineRow}>
                <Text
                  style={[
                    styles.lineText,
                    {
                      fontFamily: fontName,
                      fontSize: finalFontSize,
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.7}
                  allowFontScaling={false}
                >
                  {row.text}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Bottom page number badge anchored within the authentic Mushaf frame */}
        <View style={styles.pageNumberBadge}>
          <Text style={styles.pageNumberText}>
            {toArabicNumerals(page)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export const MushafPageItem = React.memo(MushafPageItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.page === nextProps.page &&
    prevProps.userFontDelta === nextProps.userFontDelta &&
    prevProps.isNear === nextProps.isNear
  );
});

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: QuranColors.parchment,
  },
  pageScrollView: {
    flex: 1,
    backgroundColor: QuranColors.parchment,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 4,
  },
  paperFrame: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: QuranColors.parchmentBorder,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 2,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contentArea: {
    flex: 1,
    width: '100%',
  },
  contentAreaStandard: {
    justifyContent: 'space-between', // Distributes all 15 rows evenly from top to bottom
  },
  contentAreaSpecial: {
    justifyContent: 'center', // Opening pages 1 & 2 centered within the frame
  },
  bannerRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  lineRow: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  lineText: {
    color: QuranColors.textDark,
    textAlign: 'center',
    writingDirection: 'rtl',
    includeFontPadding: false,
    width: '100%',
  },
  pageNumberBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 2,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(197, 155, 39, 0.25)',
  },
  pageNumberText: {
    fontSize: 12,
    color: QuranColors.textMuted,
    fontFamily: 'System',
    fontWeight: '600',
  },
});
