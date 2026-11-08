import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, Modal, I18nManager } from 'react-native';
import { AppText as Text } from '../../../core/theme/components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SQLiteDatabase } from 'expo-sqlite';
import { QuranColors } from '../../../core/theme/theme';
import { useTheme } from 'react-native-paper';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';
import { QuranRepository } from '../../../core/database/quranRepository';
import { Surah } from '../types/surah.types';
import { Bookmark } from '../../bookmarks/types/bookmark.types';
import { KhatmahModal } from '../../khatmah/components/KhatmahModal';
import { BookmarksModal } from '../../bookmarks/components/BookmarksModal';
import { NotesModal } from '../../notes/components/NotesModal';
import { DailyWird } from '../../khatmah/types/khatmah.types';
import { useAudioStore } from '../../audio-player/stores/useAudioStore';

interface SurahDrawerModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenSearch?: () => void;
  onSelectPage: (page: number, verseKey?: string) => void;
  db: SQLiteDatabase;
  currentPage: number;
  currentSurahNames?: string[];
  activeBookmark?: Bookmark | null;
  bookmarks?: Bookmark[];
  onRemoveBookmark?: (id: string) => void;
  onWirdChange?: (wird: DailyWird | null) => void;
}

type NavRouteTab = 'surahs' | 'khatma' | 'bookmarks' | 'notes';

export const SurahDrawerModal: React.FC<SurahDrawerModalProps> = ({
  visible,
  onClose,
  onOpenSearch,
  onSelectPage,
  db,
  currentPage,
  currentSurahNames,
  activeBookmark,
  bookmarks = [],
  onRemoveBookmark,
  onWirdChange,
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<NavRouteTab>('surahs');
  const flatListRef = useRef<FlatList<Surah>>(null);

  const allSurahs = useMemo(() => QuranRepository.getAllSurahsSync(db), [db]);

  const currentSurahIndex = useMemo(() => {
    const activeAyahSura = useAudioStore.getState().activeAyah?.suraNo;
    if (activeAyahSura) {
      const idx = allSurahs.findIndex((s) => s.sura_no === activeAyahSura);
      if (idx >= 0) return idx;
    }

    if (currentSurahNames && currentSurahNames.length > 0) {
      const cleanTarget = currentSurahNames[0].trim();
      const idx = allSurahs.findIndex(
        (s) => s.sura_name_ar.trim() === cleanTarget || cleanTarget.includes(s.sura_name_ar.trim())
      );
      if (idx >= 0) return idx;
    }

    const surahsOnPage = allSurahs.filter(
      (s) => currentPage >= s.page_start && currentPage <= s.page_end
    );
    if (surahsOnPage.length === 1) {
      return allSurahs.findIndex((s) => s.sura_no === surahsOnPage[0].sura_no);
    }
    if (surahsOnPage.length > 1) {
      const startingSurah = surahsOnPage.find((s) => s.page_start === currentPage);
      if (startingSurah) {
        return allSurahs.findIndex((s) => s.sura_no === startingSurah.sura_no);
      }
      return allSurahs.findIndex((s) => s.sura_no === surahsOnPage[0].sura_no);
    }

    return -1;
  }, [allSurahs, currentPage, currentSurahNames]);

  useEffect(() => {
    if (visible) {
      setActiveTab('surahs');

      if (currentSurahIndex >= 0) {
        const timer = setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: currentSurahIndex,
            animated: false,
            viewPosition: 0.15,
          });
        }, 80);
        return () => clearTimeout(timer);
      }
    }
  }, [visible, currentSurahIndex]);

  const handleSelectSurah = (pageStart: number) => {
    onClose();
    onSelectPage(pageStart);
  };

  const renderSurahItem = ({ item }: { item: Surah }) => {
    const isCurrentSurah = currentSurahIndex >= 0 && allSurahs[currentSurahIndex]?.sura_no === item.sura_no;
    const isPageSurah = currentPage >= item.page_start && currentPage <= item.page_end;
    const isCurrent = isCurrentSurah || (currentSurahIndex < 0 && isPageSurah);

    return (
      <TouchableOpacity
        style={[
          styles.surahRow,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline },
          isCurrent && { borderColor: theme.colors.primary, backgroundColor: theme.colors.surfaceVariant, borderWidth: 1.8 },
        ]}
        onPress={() => handleSelectSurah(item.page_start)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.surahNumberBadge,
            { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline },
            isCurrent && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
          ]}
        >
          <Text
            style={[
              styles.surahNumberText,
              { color: isCurrent ? '#FFFFFF' : theme.colors.primary },
            ]}
          >
            {toArabicNumerals(item.sura_no)}
          </Text>
        </View>

        <View style={styles.surahDetails}>
          <View style={styles.surahTitleRow}>
            <Text
              style={[
                styles.surahName,
                { color: theme.colors.onSurface },
                isCurrent && { color: theme.colors.primary, fontWeight: 'bold' },
              ]}
            >
               {item.sura_name_ar}
            </Text>
            <View
              style={[
                styles.typeBadge,
                item.revelation_place === 'مدنية' ? styles.madaniBadge : styles.makkiBadge,
              ]}
            >
              <Text style={styles.typeText}>{item.revelation_place}</Text>
            </View>
            {isCurrent ? (
              <View style={[styles.currentBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.currentBadgeText} numberOfLines={1}>تقرأ الآن</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.surahMeta, { color: theme.colors.onSurfaceVariant }]}>
            الجزء {toArabicNumerals(item.jozz_start)} • الحزب {toArabicNumerals(Math.ceil(item.jozz_start * 2))} • {toArabicNumerals(item.ayahs_count)} آية
          </Text>
        </View>

        <View style={styles.pageIndicatorWrapper}>
          <Text style={[styles.pageLabel, { color: theme.colors.onSurfaceVariant }]}>صفحة</Text>
          <Text style={[styles.pageNumberVal, { color: theme.colors.primary }]}>
            {toArabicNumerals(item.page_start)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'khatma':
        return { title: 'ختمتي', subtitle: 'متابعة الختمة والأوراد المقررة' };
      case 'bookmarks':
        return { title: 'الفواصل المحفوظة', subtitle: 'العلامات المرجعية للقراءة والمتابعة' };
      case 'notes':
        return { title: 'ملاحظاتي', subtitle: 'الفوائد والخواطر القرآنية المحفوظة' };
      default:
        return { title: 'فهرس القرآن الكريم', subtitle: '١١٤ سُورَة • ٣٠ جُزءاً' };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Top Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outline },
          ]}
        >
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="إغلاق الفهرس">
            <MaterialCommunityIcons name="arrow-right" size={24} color={theme.colors.primary} />
          </TouchableOpacity>

          <View style={styles.titleWrapper}>
            <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
              {headerInfo.title}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {headerInfo.subtitle}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.searchHeaderBtn, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={() => {
              onClose();
              onOpenSearch?.();
            }}
            accessibilityLabel="فتح البحث الذكي"
          >
            <MaterialCommunityIcons name="magnify" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Content based on Active Tab */}
        <View style={styles.tabContent}>
          {activeTab === 'surahs' && (
            <FlatList
              ref={flatListRef}
              data={allSurahs}
              keyExtractor={(item) => 'surah-' + item.sura_no}
              renderItem={renderSurahItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={114}
              maxToRenderPerBatch={114}
              windowSize={11}
              // Dynamic layout allows font diacritics and badges without clipping
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: false,
                    viewPosition: 0.15,
                  });
                }, 50);
              }}
            />
          )}

          {activeTab === 'khatma' && (
            <KhatmahModal
              embedded
              visible
              db={db}
              currentPage={currentPage}
              onClose={onClose}
              onNavigateToPage={(page, verseKey) => {
                onClose();
                onSelectPage(page, verseKey);
              }}
              onWirdChange={onWirdChange}
            />
          )}

          {activeTab === 'bookmarks' && (
            <BookmarksModal
              embedded
              visible
              bookmarks={bookmarks}
              onClose={onClose}
              onNavigate={(bm) => {
                onClose();
                onSelectPage(bm.page, bm.verseKey);
              }}
              onRemove={(id) => onRemoveBookmark?.(id)}
            />
          )}

          {activeTab === 'notes' && (
            <NotesModal
              embedded
              visible
              db={db}
              draftAyah={null}
              onClose={onClose}
              onNavigate={(note) => {
                onClose();
                onSelectPage(note.page, note.verseKey);
              }}
            />
          )}
        </View>

        {/* Bottom Route Navigation Bar */}
        <View
          style={[
            styles.bottomNavContainer,
            { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline },
          ]}
        >
          <TouchableOpacity
            style={styles.navTab}
            onPress={() => setActiveTab('surahs')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={activeTab === 'surahs' ? 'book-open-page-variant' : 'book-open-page-variant-outline'}
              size={22}
              color={activeTab === 'surahs' ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.navTabText,
                { color: activeTab === 'surahs' ? theme.colors.primary : theme.colors.onSurfaceVariant },
                activeTab === 'surahs' && styles.activeNavTabText,
              ]}
            >
              السور
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => setActiveTab('khatma')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={activeTab === 'khatma' ? 'calendar-check' : 'calendar-check-outline'}
              size={22}
              color={activeTab === 'khatma' ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.navTabText,
                { color: activeTab === 'khatma' ? theme.colors.primary : theme.colors.onSurfaceVariant },
                activeTab === 'khatma' && styles.activeNavTabText,
              ]}
            >
              ختمتي
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => setActiveTab('bookmarks')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={activeTab === 'bookmarks' ? 'bookmark-multiple' : 'bookmark-multiple-outline'}
              size={22}
              color={activeTab === 'bookmarks' ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.navTabText,
                { color: activeTab === 'bookmarks' ? theme.colors.primary : theme.colors.onSurfaceVariant },
                activeTab === 'bookmarks' && styles.activeNavTabText,
              ]}
            >
              الفواصل
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => setActiveTab('notes')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={activeTab === 'notes' ? 'note-text' : 'note-text-outline'}
              size={22}
              color={activeTab === 'notes' ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.navTabText,
                { color: activeTab === 'notes' ? theme.colors.primary : theme.colors.onSurfaceVariant },
                activeTab === 'notes' && styles.activeNavTabText,
              ]}
            >
              الملاحظات
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    writingDirection: 'rtl'
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  searchHeaderBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  titleWrapper: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: 'bold',

  },
  tabContent: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 24,
    gap: 8,
  },
  surahRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  surahNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  surahNumberText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  surahDetails: {
    flex: 1,
    gap: 3,
  },
  surahTitleRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  surahName: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: 'bold',
    textAlign: 'auto',
    writingDirection: 'rtl',
    flexShrink: 0,
    //paddingVertical: 2,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  makkiBadge: {
    backgroundColor: 'rgba(197, 155, 39, 0.15)',
  },
  madaniBadge: {
    backgroundColor: 'rgba(31, 81, 63, 0.12)',
  },
  typeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 16,
    textAlign: 'auto',
  },
  surahMeta: {
    fontSize: 12,
    textAlign: 'auto',
    writingDirection: 'rtl',
  },
  pageIndicatorWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
  },
  pageLabel: {
    fontSize: 10,
  },
  pageNumberVal: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  bottomNavContainer: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingBottom: 8,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    
  },
  navTabText: {
    fontSize: 11,

  },
  activeNavTabText: {
    fontWeight: 'bold',
  },
});
