import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { BookmarkService } from '../../bookmarks/services/bookmarkService';
import { Bookmark } from '../../bookmarks/types/bookmark.types';
import { useAudioStore } from '../../audio-player/stores/useAudioStore';
import { AudioPickerModal } from '../../audio-player/components/AudioPickerModal';
import { AudioPlayerBar } from '../../audio-player/components/AudioPlayerBar';
import { AudioActionMode } from '../../audio-player/types/audio.types';
import { BookmarkType } from '../../bookmarks/types/bookmark.types';
import { BookmarksModal } from '../../bookmarks/components/BookmarksModal';
import { NotesModal } from '../../notes/components/NotesModal';
import { KhatmahModal } from '../../khatmah/components/KhatmahModal';
import { KhatmahService } from '../../khatmah/services/khatmahService';
import { DailyWird } from '../../khatmah/types/khatmah.types';
import { AyahNote } from '../../notes/types/note.types';

const TOTAL_PAGES = 604;
const LAST_PAGE_KEY = '@quran_last_page_read';
const ALL_PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

interface AudioPickerState {
  ayah: SelectedAyahInfo;
  mode: AudioActionMode;
}

export const MushafPageView: React.FC = () => {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const metadataRequestRef = useRef(0);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSurahListOpen, setIsSurahListOpen] = useState<boolean>(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const activeBookmark = bookmarks.find((item) => item.type === 'reading') ?? bookmarks[0] ?? null;
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState<SelectedAyahInfo | null>(null);
  const [isKhatmahOpen, setIsKhatmahOpen] = useState(false);
  const [dailyWird, setDailyWird] = useState<DailyWird | null>(null);
  const [selectedAyah, setSelectedAyah] = useState<SelectedAyahInfo | null>(null);
  const [tafsirAyah, setTafsirAyah] = useState<SelectedAyahInfo | null>(null);
  const [audioPicker, setAudioPicker] = useState<AudioPickerState | null>(null);

  const [searchHighlightVerseKey, setSearchHighlightVerseKey] = useState<string | null>(null);
  const searchHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const controlsAnim = useRef(new Animated.Value(1)).current;

  // Subscribe only to playback fields that affect the Mushaf. Position updates
  // arrive every 100 ms; subscribing to the whole store would rerender all 604
  // PagerView children on every progress tick.
  const audioStatus = useAudioStore((state) => state.status);
  const activeAyah = useAudioStore((state) => state.activeAyah);
  const playingVerseKey = useMemo(() => {
    if (
      (audioStatus === 'playing' ||
        audioStatus === 'paused' ||
        audioStatus === 'waiting_user_repeat') &&
      activeAyah
    ) {
      return activeAyah.suraNo + ':' + activeAyah.ayaNo;
    }
    return null;
  }, [audioStatus, activeAyah]);

  const [pageMetadata, setPageMetadata] = useState<{ surahNames: string[]; jozz: number }>({
    surahNames: ['الفَاتِحة'],
    jozz: 1,
  });

  const loadPageMetadata = useCallback(async (pageNumber: number) => {
    const requestId = ++metadataRequestRef.current;
    try {
      const ayahs = await QuranRepository.getPageAyahs(db, pageNumber);
      if (requestId !== metadataRequestRef.current || ayahs.length === 0) return;

      const names: string[] = [];
      const seen = new Set<string>();
      for (const ayah of ayahs) {
        const name = ayah.sura_name_ar?.trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          names.push(name);
        }
      }

      setPageMetadata({
        surahNames: names.length > 0 ? names : [ayahs[0].sura_name_ar || ''],
        jozz: ayahs[0].jozz,
      });
    } catch (error) {
      console.warn('[MushafPageView] Could not load page metadata:', error);
    }
  }, [db]);

  useEffect(() => {
    let isMounted = true;

    const loadReadingState = async () => {
      const [savedBookmarks, currentWird] = await Promise.all([
        BookmarkService.getBookmarks().catch((error) => {
          console.warn('[MushafPageView] Could not restore bookmarks:', error);
          return [] as Bookmark[];
        }),
        KhatmahService.getDailyWird(db).catch((error) => {
          console.warn('[MushafPageView] Could not restore Khatmah progress:', error);
          return null;
        }),
      ]);

      if (!isMounted) return;
      setBookmarks(savedBookmarks);
      setDailyWird(currentWird);
    };

    void loadReadingState();
    return () => { isMounted = false; };
  }, [db]);

  const bookmarkTypesByVerse = useMemo(() => {
    const result: Record<string, BookmarkType[]> = {};
    for (const bookmark of bookmarks) {
      const types = result[bookmark.verseKey] ?? [];
      if (!types.includes(bookmark.type)) types.push(bookmark.type);
      result[bookmark.verseKey] = types;
    }
    return result;
  }, [bookmarks]);

  useEffect(() => {
    const timer = setTimeout(() => setIsControlsVisible(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    Animated.timing(controlsAnim, {
      toValue: isControlsVisible ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [isControlsVisible, controlsAnim]);

  // إظهار شريط التحكم مؤقتاً عند بدء التلاوة ثم إخفاؤه تلقائياً لوضع ملء الشاشة
  useEffect(() => {
    if (audioStatus === 'playing') {
      setIsControlsVisible(true);
    }
  }, [audioStatus]);

  useEffect(() => {
    if (isControlsVisible && audioStatus === 'playing') {
      const timer = setTimeout(() => {
        setIsControlsVisible(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isControlsVisible, audioStatus]);

  const toggleControls = useCallback(() => {
    setIsControlsVisible((previous) => !previous);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setHidden(!isControlsVisible);
    }
  }, [isControlsVisible]);

  useEffect(() => () => {
    if (Platform.OS === 'android') {
      NavigationBar.setHidden(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function restorePosition() {
      try {
        const saved = await AsyncStorage.getItem(LAST_PAGE_KEY);
        let target = 1;

        if (saved) {
          const parsed = Number.parseInt(saved, 10);
          if (parsed >= 1 && parsed <= TOTAL_PAGES) target = parsed;
        }

        if (!isMounted) return;

        // Do not hold the first Mushaf frame for a second metadata query.
        // The SVG page loads independently after the selected index is rendered.
        setCurrentPage(target);
        setIsReady(true);
        void loadPageMetadata(target);
      } catch (error) {
        console.warn('[MushafPageView] Could not restore last page:', error);
        if (isMounted) setIsReady(true);
      }
    }

    void restorePosition();
    return () => {
      isMounted = false;
      metadataRequestRef.current += 1;
    };
  }, [db, loadPageMetadata]);

  const handlePageSelected = useCallback((position: number) => {
    const pageNum = position + 1;
    setCurrentPage(pageNum);
    AsyncStorage.setItem(LAST_PAGE_KEY, pageNum.toString()).catch(() => undefined);
    void loadPageMetadata(pageNum);
  }, [loadPageMetadata]);

  const handleNavigateToPage = useCallback((targetPage: number, targetVerseKey?: string) => {
    if (targetPage < 1 || targetPage > TOTAL_PAGES) return;

    pagerRef.current?.setPage(targetPage - 1);
    setCurrentPage(targetPage);
    AsyncStorage.setItem(LAST_PAGE_KEY, targetPage.toString()).catch(() => undefined);
    void loadPageMetadata(targetPage);

    if (targetVerseKey) {
      setSearchHighlightVerseKey(targetVerseKey);
      if (searchHighlightTimerRef.current) clearTimeout(searchHighlightTimerRef.current);
      searchHighlightTimerRef.current = setTimeout(() => {
        setSearchHighlightVerseKey(null);
      }, 3500);
    }
  }, [loadPageMetadata]);

  // تقليب صفحات المصحف تلقائياً عند انتقال الشيخ إلى صفحة تالية أثناء التلاوة
  useEffect(() => {
    if (!activeAyah || (audioStatus !== 'playing' && audioStatus !== 'waiting_user_repeat')) {
      return;
    }

    const targetPage = QuranRepository.getAyahPageSync(db, activeAyah.suraNo, activeAyah.ayaNo);
    if (targetPage && targetPage !== currentPage) {
      handleNavigateToPage(targetPage);
    }
  }, [activeAyah, audioStatus, currentPage, db, handleNavigateToPage]);

  const handleAyahLongPress = useCallback(
    async (verseKey: string, pageNum: number) => {
      const parts = verseKey.split(':');
      if (parts.length !== 2) return;

      const suraNo = Number.parseInt(parts[0], 10);
      const ayaNo = Number.parseInt(parts[1], 10);
      if (!Number.isInteger(suraNo) || !Number.isInteger(ayaNo)) return;

      const pageAyahs = await QuranRepository.getPageAyahs(db, pageNum);
      const matchingAyah = pageAyahs.find(
        (item) => item.sura_no === suraNo && item.aya_no === ayaNo
      );

      const suraName = matchingAyah?.sura_name_ar || pageMetadata.surahNames[0] || '';
      const jozz = matchingAyah?.jozz || pageMetadata.jozz;

      setSelectedAyah({
        verseKey,
        suraNo,
        ayaNo,
        page: pageNum,
        suraName,
        jozz,
        ayahText: matchingAyah?.aya_text_emlaey || '',
      });
    },
    [db, pageMetadata]
  );

  const handleToggleBookmark = useCallback(
    async (ayah: SelectedAyahInfo, type: BookmarkType) => {
      const existing = bookmarks.find((item) => item.type === type && item.verseKey === ayah.verseKey);
      if (existing) {
        setBookmarks(await BookmarkService.removeBookmark(existing.id));
      } else {
        const newBookmark: Omit<Bookmark, 'type' | 'id'> = {
          verseKey: ayah.verseKey,
          suraNo: ayah.suraNo,
          ayaNo: ayah.ayaNo,
          page: ayah.page,
          suraName: ayah.suraName,
          ayahText: ayah.ayahText || '',
          createdAt: Date.now(),
        };
        setBookmarks(await BookmarkService.saveBookmark({ ...newBookmark, type }));
      }
      setSelectedAyah(null);
    },
    [bookmarks]
  );

  const handleOpenAudio = useCallback((ayah: SelectedAyahInfo, mode: AudioActionMode) => {
    setAudioPicker({ ayah, mode });
  }, []);

  const handleOpenNote = useCallback((ayah: SelectedAyahInfo) => {
    setNoteDraft(ayah);
    setIsNotesOpen(true);
  }, []);

  const handleNavigateToNote = useCallback((note: AyahNote) => {
    setIsNotesOpen(false);
    handleNavigateToPage(note.page, note.verseKey);
  }, [handleNavigateToPage]);

  const handleNavigateToBookmark = useCallback((bookmark: Bookmark) => {
    setIsBookmarksOpen(false);
    handleNavigateToPage(bookmark.page, bookmark.verseKey);
  }, [handleNavigateToPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < TOTAL_PAGES) pagerRef.current?.setPage(currentPage);
  }, [currentPage]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) pagerRef.current?.setPage(currentPage - 2);
  }, [currentPage]);

  if (!isReady) {
    return <View style={[styles.blankContainer, { backgroundColor: theme.colors.background }]} />;
  }

  const isWirdPending = Boolean(
    dailyWird &&
    dailyWird.status !== 'completed' &&
    dailyWird.status !== 'finished' &&
    dailyWird.canComplete
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar hidden={!isControlsVisible} animated />
      <Animated.View style={[styles.headerDock, { top: insets.top + 2 }]} pointerEvents="box-none">
      <PageHeader
        surahNames={pageMetadata.surahNames}
        jozzNumber={pageMetadata.jozz}
        pageNumber={currentPage}
        onOpenSearch={() => { setIsControlsVisible(true); setIsSearchOpen(true); }}
        onOpenSettings={() => { setIsControlsVisible(true); setIsSettingsOpen(true); }}
        onOpenSurahList={() => { setIsControlsVisible(true); setIsSurahListOpen(true); }}
        controlsAnim={controlsAnim}
        isControlsVisible={isControlsVisible}
      />
      </Animated.View>

      <View style={styles.pagerContainer}>
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={currentPage - 1}
          onPageSelected={(event) => handlePageSelected(event.nativeEvent.position)}
          orientation="horizontal"
          layoutDirection="rtl"
          offscreenPageLimit={1}
        >
          {ALL_PAGES.map((pageNum) => {
            const isNear = Math.abs(pageNum - currentPage) <= 1;
            const isActive = pageNum === currentPage;

            return (
              <View key={'page-wrapper-' + pageNum} style={styles.pageWrapper}>
                <MushafSvgPageItem
                  page={pageNum}
                  db={db}
                  isNear={isNear}
                  isActive={isActive}
                  onToggleControls={toggleControls}
                  selectedVerseKey={selectedAyah?.verseKey}
                  bookmarkTypesByVerse={bookmarkTypesByVerse}
                  khatmahStartGlobalAyah={isWirdPending ? dailyWird?.startGlobalAyah ?? null : null}
                  khatmahEndGlobalAyah={isWirdPending ? dailyWird?.endGlobalAyah ?? null : null}
                  khatmahWrapsAroundEnd={isWirdPending ? dailyWird?.wrapsAroundEnd ?? false : false}
                  khatmahDailyTargetAyahs={isWirdPending ? dailyWird?.dailyTargetAyahs ?? 0 : 0}
                  searchHighlightVerseKey={searchHighlightVerseKey}
                  playingVerseKey={playingVerseKey}
                  onAyahLongPress={handleAyahLongPress}
                />
              </View>
            );
          })}
        </PagerView>
      </View>

      <View style={[styles.bottomDock, { bottom: isControlsVisible ? insets.bottom : 0 }]} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.bottomBarWrapper,
            {
              opacity: controlsAnim,
              transform: [
                {
                  translateY: controlsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [160, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents={isControlsVisible ? 'auto' : 'none'}
        >
          <AudioPlayerBar />
          <PageBottomBar
            currentPage={currentPage}
            totalPages={TOTAL_PAGES}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
          />
        </Animated.View>
      </View>

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
          setIsControlsVisible(true);
          setIsSurahListOpen(false);
          setIsSearchOpen(true);
        }}
        onSelectPage={handleNavigateToPage}
        db={db}
        currentPage={currentPage}
        currentSurahNames={pageMetadata.surahNames}
        activeBookmark={activeBookmark}
        bookmarks={bookmarks}
        onRemoveBookmark={async (bookmarkId) =>
          setBookmarks(await BookmarkService.removeBookmark(bookmarkId))
        }
        onWirdChange={setDailyWird}
      />

      <SettingsModal visible={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <BookmarksModal
        visible={isBookmarksOpen}
        bookmarks={bookmarks}
        onClose={() => setIsBookmarksOpen(false)}
        onNavigate={handleNavigateToBookmark}
        onRemove={async (bookmarkId) => setBookmarks(await BookmarkService.removeBookmark(bookmarkId))}
      />

      <NotesModal
        visible={isNotesOpen}
        db={db}
        draftAyah={noteDraft}
        onClose={() => { setIsNotesOpen(false); setNoteDraft(null); }}
        onNavigate={handleNavigateToNote}
      />

      <KhatmahModal
        visible={isKhatmahOpen}
        db={db}
        currentPage={currentPage}
        onClose={() => setIsKhatmahOpen(false)}
        onNavigateToPage={handleNavigateToPage}
        onWirdChange={setDailyWird}
      />

      <AyahActionModal
        visible={selectedAyah !== null}
        ayah={selectedAyah}
        bookmarks={selectedAyah ? bookmarks.filter((item) => item.verseKey === selectedAyah.verseKey) : []}
        onClose={() => setSelectedAyah(null)}
        onToggleBookmark={handleToggleBookmark}
        onOpenNote={handleOpenNote}
        onOpenTafsir={(ayah) => setTafsirAyah(ayah)}
        onPlayAudio={(ayah) => handleOpenAudio(ayah, 'tilawah')}
        onRepeatAudio={(ayah) => handleOpenAudio(ayah, 'repeat')}
      />

      <AudioPickerModal
        visible={audioPicker !== null}
        ayah={audioPicker?.ayah || null}
        mode={audioPicker?.mode || 'tilawah'}
        db={db}
        onClose={() => setAudioPicker(null)}
      />

      <TafsirModal
        visible={tafsirAyah !== null}
        ayah={tafsirAyah}
        onClose={() => setTafsirAyah(null)}
        db={db}
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
  headerDock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 30,
  },
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  bottomBarWrapper: {},
});
