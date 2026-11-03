import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
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

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isReady, setIsReady] = useState<boolean>(false);
  // Default font size 20 allows 15 lines to fit seamlessly on mobile screens without cutting off final ayah
  const [fontSize, setFontSize] = useState<number>(20);

  // Metadata for current header (Surah name and Juz)
  const [pageMetadata, setPageMetadata] = useState<{ surahName: string; jozz: number }>({
    surahName: 'الفَاتِحة',
    jozz: 1,
  });

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
      // In 0-indexed pager, position currentPage is pageNum currentPage + 1
      pagerRef.current.setPage(currentPage);
    }
  }, [currentPage]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1 && pagerRef.current) {
      // In 0-indexed pager, position currentPage - 2 is pageNum currentPage - 1
      pagerRef.current.setPage(currentPage - 2);
    }
  }, [currentPage]);

  const increaseFontSize = () => setFontSize((prev) => Math.min(prev + 2, 25));
  const decreaseFontSize = () => setFontSize((prev) => Math.max(prev - 2, 16));

  if (!isReady) {
    return <View style={styles.blankContainer} />;
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <PageHeader
        surahName={pageMetadata.surahName}
        jozzNumber={pageMetadata.jozz}
      />

      {/* Horizontal Swipe Pager View with RTL layout and native offscreen retention */}
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
          // Render full content for active and adjacent pages (windowing radius 3)
          const isNear = Math.abs(pageNum - currentPage) <= 3;

          return (
            <View key={`page-wrapper-${pageNum}`} style={styles.pageWrapper}>
              <MushafPageItem
                page={pageNum}
                db={db}
                fontSize={fontSize}
                isNear={isNear}
              />
            </View>
          );
        })}
      </PagerView>

      {/* Bottom Bar with progress, touch buttons, and font scaling */}
      <PageBottomBar
        currentPage={currentPage}
        totalPages={TOTAL_PAGES}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
        fontSize={fontSize}
        onIncreaseFontSize={increaseFontSize}
        onDecreaseFontSize={decreaseFontSize}
      />
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
  pager: {
    flex: 1,
  },
  pageWrapper: {
    flex: 1,
  },
});
