import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions, Animated } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSQLiteContext } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PageHeader } from './PageHeader';
import { PageBottomBar } from './PageBottomBar';
import { MushafPageItem } from './MushafPageItem';
import { QuranColors } from '../../../core/theme/theme';
import { QuranRepository } from '../../../core/database/quranRepository';

const TOTAL_PAGES = 604;
const LAST_PAGE_KEY = '@quran_last_page_read';
const ALL_PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

export const MushafPageView: React.FC = () => {
  const db = useSQLiteContext();
  const pagerRef = useRef<PagerView>(null);

  const { height: screenHeight } = useWindowDimensions();

  // Optimal default font size so all 15 Quran lines fit on mobile screen with ZERO vertical scroll
  const defaultFontSize = useMemo(() => {
    if (screenHeight >= 900) return 20;
    if (screenHeight >= 780) return 18.5;
    return 17;
  }, [screenHeight]);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(defaultFontSize);

  // Full Screen Immersion Mode: Automatically hides interactive controls after 2 seconds
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const controlsAnim = useRef(new Animated.Value(1)).current;

  // Metadata for current header (Surah name and Juz)
  const [pageMetadata, setPageMetadata] = useState<{ surahName: string; jozz: number }>({
    surahName: 'الفَاتِحة',
    jozz: 1,
  });

  // Automatically transition to full-screen mode after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsControlsVisible(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Smooth 60fps hardware-accelerated animated transition for controls
  useEffect(() => {
    Animated.timing(controlsAnim, {
      toValue: isControlsVisible ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [isControlsVisible, controlsAnim]);

  const toggleControls = useCallback(() => {
    setIsControlsVisible((prev) => !prev);
  }, []);

  // Restore last read page directly before mounting pager and warm cache
  useEffect(() => {
    let isMounted = true;
    async function restorePosition() {
      try {
        const saved = await AsyncStorage.getItem(LAST_PAGE_KEY);
        let target = 1;
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (parsed >= 1 && parsed <= TOTAL_PAGES) {
            target = parsed;
          }
        }

        // Preload target and adjacent pages into cache synchronously
        QuranRepository.preloadPages(db, target, 5);
        const ayahs = QuranRepository.getPageAyahsSync(db, target);

        if (isMounted) {
          if (ayahs.length > 0) {
            setPageMetadata({
              surahName: ayahs[0].sura_name_ar || '',
              jozz: ayahs[0].jozz,
            });
          }
          setCurrentPage(target);
          setIsReady(true);
        }
      } catch (err) {
        console.warn('Could not restore last page:', err);
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    restorePosition();
    return () => {
      isMounted = false;
    };
  }, [db]);

  const handlePageSelected = useCallback((position: number) => {
    const pageNum = position + 1;
    setCurrentPage(pageNum);
    AsyncStorage.setItem(LAST_PAGE_KEY, pageNum.toString()).catch(() => {});

    // Proactively preload surrounding pages in the background
    QuranRepository.preloadPages(db, pageNum, 5);

    // Update header metadata synchronously from in-memory cache
    const data = QuranRepository.getPageAyahsSync(db, pageNum);
    if (data.length > 0) {
      setPageMetadata({
        surahName: data[0].sura_name_ar || '',
        jozz: data[0].jozz,
      });
    }
  }, [db]);

  const handleNextPage = useCallback(() => {
    if (currentPage < TOTAL_PAGES && pagerRef.current) {
      pagerRef.current.setPage(currentPage);
    }
  }, [currentPage]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1 && pagerRef.current) {
      pagerRef.current.setPage(currentPage - 2);
    }
  }, [currentPage]);

  const increaseFontSize = () => setFontSize((prev) => Math.min(prev + 2, 26));
  const decreaseFontSize = () => setFontSize((prev) => Math.max(prev - 2, 15));

  if (!isReady) {
    return <View style={styles.blankContainer} />;
  }

  return (
    <View style={styles.container}>
      {/* Top Header: Always clearly shows Surah name, Juz, and Page number even in full screen */}
      <PageHeader
        surahName={pageMetadata.surahName}
        jozzNumber={pageMetadata.jozz}
        pageNumber={currentPage}
      />

      {/* Horizontal Swipe Pager View with native RTL layout */}
      <View style={styles.pagerContainer}>
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={currentPage - 1}
          onPageSelected={(e) => handlePageSelected(e.nativeEvent.position)}
          orientation="horizontal"
          layoutDirection="rtl"
          offscreenPageLimit={3}
        >
          {ALL_PAGES.map((pageNum) => {
            const isNear = Math.abs(pageNum - currentPage) <= 3;

            return (
              <View key={`page-wrapper-${pageNum}`} style={styles.pageWrapper}>
                <MushafPageItem
                  page={pageNum}
                  db={db}
                  fontSize={fontSize}
                  isNear={isNear}
                  isFullScreen={!isControlsVisible}
                  onToggleControls={toggleControls}
                />
              </View>
            );
          })}
        </PagerView>
      </View>

      {/* Bottom Bar: Smooth animated slide and fade (التالية/السابقة، أ+/أ-) */}
      <Animated.View
        style={[
          styles.bottomBarWrapper,
          {
            opacity: controlsAnim,
            transform: [
              {
                translateY: controlsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [90, 0], // Smooth slide-down out of view
                }),
              },
            ],
          },
        ]}
        pointerEvents={isControlsVisible ? 'auto' : 'none'}
      >
        <PageBottomBar
          currentPage={currentPage}
          totalPages={TOTAL_PAGES}
          onNextPage={handleNextPage}
          onPrevPage={handlePrevPage}
          fontSize={fontSize}
          onIncreaseFontSize={increaseFontSize}
          onDecreaseFontSize={decreaseFontSize}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QuranColors.parchment,
  },
  blankContainer: {
    flex: 1,
    backgroundColor: QuranColors.parchment,
  },
  pagerContainer: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  pageWrapper: {
    flex: 1,
  },
  bottomBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
