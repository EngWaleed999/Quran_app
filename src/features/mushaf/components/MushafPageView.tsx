import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSQLiteContext } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PageHeader } from './PageHeader';
import { PageBottomBar } from './PageBottomBar';
import { MushafSvgPageItem } from './MushafSvgPageItem';
import { SearchModal } from '../../search/components/SearchModal';
import { SurahDrawerModal } from '../../surah-list/components/SurahDrawerModal';
import { SettingsModal } from '../../settings/components/SettingsModal';
import { AyahActionModal, SelectedAyahInfo } from './AyahActionModal';
import { TafsirModal } from './TafsirModal';
import { QuranColors } from '../../../core/theme/theme';
import { QuranRepository } from '../../../core/database/quranRepository';
import { SvgMushafRepository } from '../../../core/database/svgMushafRepository';
import { QcfFontManager } from '../../../core/fonts/qcfFontManager';
import { BookmarkService } from '../../bookmarks/services/bookmarkService';
import { Bookmark } from '../../bookmarks/types/bookmark.types';
import { useAudioStore } from '../../audio-player/stores/useAudioStore';

const TOTAL_PAGES = 604;
const LAST_PAGE_KEY = '@quran_last_page_read';
const ALL_PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

export const MushafPageView: React.FC = () => {
  const db = useSQLiteContext();
  const pagerRef = useRef<PagerView>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isReady, setIsReady] = useState<boolean>(false);

  // Modals Visibility State (Floating Overlays)
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSurahListOpen, setIsSurahListOpen] = useState<boolean>(false);

  // Bookmark & Ayah Selection States
  const [activeBookmark, setActiveBookmark] = useState<Bookmark | null>(null);
  const [selectedAyah, setSelectedAyah] = useState<SelectedAyahInfo | null>(null);
  const [tafsirAyah, setTafsirAyah] = useState<SelectedAyahInfo | null>(null);

  // Search Ephemeral Highlight State
  const [searchHighlightVerseKey, setSearchHighlightVerseKey] = useState<string | null>(null);
  const searchHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Full Screen Immersion Mode: Automatically hides interactive controls after 2 seconds
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const controlsAnim = useRef(new Animated.Value(1)).current;

  // Audio Playback Store Integration: Highlighting currently recited ayah
  const { status: audioStatus, activeAyah } = useAudioStore();
  const playingVerseKey = useMemo(() => {
    if ((audioStatus === 'playing' || audioStatus === 'paused') && activeAyah) {
      return `${activeAyah.suraNo}:${activeAyah.ayaNo}`;
    }
    return null;
  }, [audioStatus, activeAyah]);

  // Metadata for current header (Surah names and Juz)
  const [pageMetadata, setPageMetadata] = useState<{ surahNames: string[]; jozz: number }>({
    surahNames: ['الفَاتِحة'],
    jozz: 1,
  });

  // Load persistent bookmark on mount
  useEffect(() => {
    BookmarkService.getActiveBookmark().then((bm) => {
      setActiveBookmark(bm);
    });
  }, []);

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
        QcfFontManager.preloadSurroundingPageFonts(target, 2);
        const ayahs = QuranRepository.getPageAyahsSync(db, target);
        const surahs = QuranRepository.getPageSurahNamesSync(db, target);

        if (isMounted) {
          if (ayahs.length > 0) {
            setPageMetadata({
              surahNames: surahs.length > 0 ? surahs : [ayahs[0].sura_name_ar || ''],
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
    QcfFontManager.preloadSurroundingPageFonts(pageNum, 2);
    SvgMushafRepository.prewarmSurroundingPages(db, pageNum, 2);

    // Update header metadata synchronously from in-memory cache
    const data = QuranRepository.getPageAyahsSync(db, pageNum);
    const surahs = QuranRepository.getPageSurahNamesSync(db, pageNum);
    if (data.length > 0) {
      setPageMetadata({
        surahNames: surahs.length > 0 ? surahs : [data[0].sura_name_ar || ''],
        jozz: data[0].jozz,
      });
    }
  }, [db]);

  const handleNavigateToPage = useCallback((targetPage: number, targetVerseKey?: string) => {
    if (targetPage >= 1 && targetPage <= TOTAL_PAGES) {
      if (pagerRef.current) {
        pagerRef.current.setPage(targetPage - 1);
      }
      setCurrentPage(targetPage);
      AsyncStorage.setItem(LAST_PAGE_KEY, targetPage.toString()).catch(() => {});

      // Preload adjacent pages and font glyphs
      QuranRepository.preloadPages(db, targetPage, 5);
      QcfFontManager.preloadSurroundingPageFonts(targetPage, 2);

      const data = QuranRepository.getPageAyahsSync(db, targetPage);
      const surahs = QuranRepository.getPageSurahNamesSync(db, targetPage);
      if (data.length > 0) {
        setPageMetadata({
          surahNames: surahs.length > 0 ? surahs : [data[0].sura_name_ar || ''],
          jozz: data[0].jozz,
        });
      }

      // Activate ephemeral highlight for target ayah if provided
      if (targetVerseKey) {
        setSearchHighlightVerseKey(targetVerseKey);
        if (searchHighlightTimerRef.current) {
          clearTimeout(searchHighlightTimerRef.current);
        }
        searchHighlightTimerRef.current = setTimeout(() => {
          setSearchHighlightVerseKey(null);
        }, 3500);
      }
    }
  }, [db]);

  // Ayah Long-Press Handler: Highlights the full Ayah and opens the half-screen bottom sheet
  const handleAyahLongPress = useCallback(
    (verseKey: string, pageNum: number) => {
      const parts = verseKey.split(':');
      if (parts.length !== 2) return;
      const suraNo = parseInt(parts[0], 10);
      const ayaNo = parseInt(parts[1], 10);

      const pageAyahs = QuranRepository.getPageAyahsSync(db, pageNum);
      const matchingAyah = pageAyahs.find(
        (a) => a.sura_no === suraNo && a.aya_no === ayaNo
      );

      const suraName = matchingAyah?.sura_name_ar || (pageMetadata.surahNames[0] || '');
      const jozz = matchingAyah?.jozz || pageMetadata.jozz;
      const ayahText = matchingAyah?.aya_text_emlaey || '';

      setSelectedAyah({
        verseKey,
        suraNo,
        ayaNo,
        page: pageNum,
        suraName,
        jozz,
        ayahText,
      });
    },
    [db, pageMetadata]
  );

  // Toggle Bookmark: Sets or removes the persistent bookmark
  const handleToggleBookmark = useCallback(
    async (ayah: SelectedAyahInfo) => {
      if (activeBookmark?.verseKey === ayah.verseKey) {
        await BookmarkService.removeBookmark();
        setActiveBookmark(null);
      } else {
        const newBookmark: Bookmark = {
          verseKey: ayah.verseKey,
          suraNo: ayah.suraNo,
          ayaNo: ayah.ayaNo,
          page: ayah.page,
          suraName: ayah.suraName,
          ayahText: ayah.ayahText || '',
          createdAt: Date.now(),
        };
        await BookmarkService.saveBookmark(newBookmark);
        setActiveBookmark(newBookmark);
      }
      setSelectedAyah(null);
    },
    [activeBookmark]
  );

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

  if (!isReady) {
    return <View style={styles.blankContainer} />;
  }

  return (
    <View style={styles.container}>
      {/* Top Header: Always clearly shows Surah name, Juz, and Page number with animated side actions */}
      <PageHeader
        surahNames={pageMetadata.surahNames}
        jozzNumber={pageMetadata.jozz}
        pageNumber={currentPage}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSurahList={() => setIsSurahListOpen(true)}
        controlsAnim={controlsAnim}
        isControlsVisible={isControlsVisible}
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
                <MushafSvgPageItem
                  page={pageNum}
                  db={db}
                  isNear={isNear}
                  onToggleControls={toggleControls}
                  selectedVerseKey={selectedAyah?.verseKey}
                  bookmarkedVerseKey={activeBookmark?.verseKey}
                  searchHighlightVerseKey={searchHighlightVerseKey}
                  playingVerseKey={playingVerseKey}
                  onAyahLongPress={handleAyahLongPress}
                />
              </View>
            );
          })}
        </PagerView>
      </View>

      {/* Bottom Bar: Smooth animated slide and fade (التالية / السابقة) */}
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
        />
      </Animated.View>

      {/* Floating Modals (Zero Layout Shifts on Reader View) */}
      <SearchModal
        visible={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectPage={handleNavigateToPage}
        db={db}
      />

      <SurahDrawerModal
        visible={isSurahListOpen}
        onClose={() => setIsSurahListOpen(false)}
        onOpenSearch={() => {
          setIsSurahListOpen(false);
          setIsSearchOpen(true);
        }}
        onSelectPage={handleNavigateToPage}
        db={db}
        currentPage={currentPage}
        activeBookmark={activeBookmark}
      />

      <SettingsModal
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Ayah Action Bottom Sheet (Half-screen floating modal) */}
      <AyahActionModal
        visible={selectedAyah !== null}
        ayah={selectedAyah}
        isBookmarked={activeBookmark?.verseKey === selectedAyah?.verseKey}
        onClose={() => setSelectedAyah(null)}
        onToggleBookmark={handleToggleBookmark}
        onOpenTafsir={(ayah) => setTafsirAyah(ayah)}
      />

      {/* Tafsir Bottom Sheet Modal (Multi-Tafsir: Saadi & Muyassar) */}
      <TafsirModal
        visible={tafsirAyah !== null}
        ayah={tafsirAyah}
        onClose={() => setTafsirAyah(null)}
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
