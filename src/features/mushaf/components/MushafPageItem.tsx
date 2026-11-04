import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  GestureResponderEvent,
} from 'react-native';
import { SQLiteDatabase } from 'expo-sqlite';
import { SurahBanner } from './SurahBanner';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';
import { QcfFontManager } from '../../../core/fonts/qcfFontManager';
import {
  QcfPageRepository,
  QcfPageRow,
  QcfPageToken,
} from '../../../core/database/qcfPageRepository';

interface MushafPageItemProps {
  page: number;
  db: SQLiteDatabase;
  userFontDelta: number;
  isNear: boolean;
  onToggleControls?: () => void;
}

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

const MushafPageItemComponent: React.FC<MushafPageItemProps> = ({
  page,
  db,
  userFontDelta,
  isNear,
  onToggleControls,
}) => {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const availablePageHeight = Math.max(320, windowHeight - 56);

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

    if (!isNear || isFontReady) {
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

  // A single page-level font size is used for every physical text line.
  // QCF words are never independently shrunk to fit their row.
  const baseFontSize = useMemo(
    () => Math.min(22.5, Math.max(18, windowWidth / 17)),
    [windowWidth]
  );
  const finalFontSize = Math.max(14, baseFontSize + userFontDelta);

  const renderToken = (token: QcfPageToken, index: number) => {
    const useQcfGlyph = token.renderMode === 'qcf' && isFontReady;
    const text =
      useQcfGlyph
        ? token.text
        : (token.fallbackText || token.text);

    const fontFamily = useQcfGlyph ? fontName : 'UthmanicHafs';

    return (
      <React.Fragment key={
        token.verseKey + ':' + token.position + ':' + token.charTypeName + ':' + index
      }>
        {index > 0 ? ' ' : null}
        <Text style={{ fontFamily }}>{text}</Text>
      </React.Fragment>
    );
  };

  if (!isNear) {
    return <View style={styles.placeholder} />;
  }

  return (
    <ScrollView
      style={styles.pageScrollView}
      contentContainerStyle={[
        styles.scrollContainer,
        userFontDelta > 0
          ? { minHeight: availablePageHeight }
          : { height: availablePageHeight },
      ]}
      scrollEnabled={userFontDelta > 0}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={[
          styles.paperFrame,
          userFontDelta > 0
            ? { minHeight: availablePageHeight }
            : { height: availablePageHeight },
        ]}
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
                      { fontSize: Math.min(20, finalFontSize) },
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
                    { fontSize: finalFontSize },
                  ]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {row.tokens.map(renderToken)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.pageNumberBadge}>
          <Text style={styles.pageNumberText}>
            {toArabicNumerals(page)}
          </Text>
        </View>
        {fontLoadError ? (
          <View style={styles.fontFallbackBadge}>
            <Text style={styles.fontFallbackText}>عرض احتياطي للنص</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
};

export const MushafPageItem = React.memo(
  MushafPageItemComponent,
  (previous, next) =>
    previous.page === next.page &&
    previous.userFontDelta === next.userFontDelta &&
    previous.isNear === next.isNear
);

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
    justifyContent: 'space-between',
  },
  physicalRow: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  lineText: {
    width: '100%',
    color: QuranColors.textDark,
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
