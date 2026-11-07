import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  I18nManager,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SQLiteDatabase } from 'expo-sqlite';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';
import { QuranRepository } from '../../../core/database/quranRepository';
import { Surah } from '../types/surah.types';
import { Bookmark } from '../../bookmarks/types/bookmark.types';

interface SurahDrawerModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenSearch?: () => void;
  onSelectPage: (page: number) => void;
  db: SQLiteDatabase;
  currentPage: number;
  activeBookmark?: Bookmark | null;
}

type NavRouteTab = 'surahs' | 'khatma' | 'bookmarks' | 'notes';

export const SurahDrawerModal: React.FC<SurahDrawerModalProps> = ({
  visible,
  onClose,
  onOpenSearch,
  onSelectPage,
  db,
  currentPage,
  activeBookmark,
}) => {
  const [activeTab, setActiveTab] = useState<NavRouteTab>('surahs');
  const flatListRef = useRef<FlatList<Surah>>(null);

  const allSurahs = useMemo(() => QuranRepository.getAllSurahsSync(db), [db]);

  const currentSurahIndex = useMemo(() => {
    return allSurahs.findIndex(
      (s) => currentPage >= s.page_start && currentPage <= s.page_end
    );
  }, [allSurahs, currentPage]);

  // متطلب 4: إعادة تعيين التبويب دائماً إلى "السور" عند فتح الفهرس دون حفظ التبويب السابق
  // متطلب 3: التمرير التلقائي والتحديد على السورة التي يقرأها المستخدم حالياً (مثل سورة القارعة)
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
    const isCurrent = currentPage >= item.page_start && currentPage <= item.page_end;

    return (
      <TouchableOpacity
        style={[styles.surahRow, isCurrent && styles.currentSurahRow]}
        onPress={() => handleSelectSurah(item.page_start)}
        activeOpacity={0.7}
      >
        {/* Right side in RTL: Surah Number */}
        <View style={[styles.surahNumberBadge, isCurrent && styles.currentSurahNumberBadge]}>
          <Text style={[styles.surahNumberText, isCurrent && styles.currentSurahNumberText]}>
            {toArabicNumerals(item.sura_no)}
          </Text>
        </View>

        {/* Center: Surah Info */}
        <View style={styles.surahDetails}>
          <View style={styles.surahTitleRow}>
            <Text style={[styles.surahName, isCurrent && styles.currentSurahName]}>
              سُورَةُ {item.sura_name_ar}
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
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>تقرأ الآن</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.surahMeta}>
            الجزء {toArabicNumerals(item.jozz_start)} • الحزب {toArabicNumerals(Math.ceil(item.jozz_start * 2))} • {toArabicNumerals(item.ayahs_count)} آية
          </Text>
        </View>

        {/* Left: Starting Page */}
        <View style={styles.pageIndicatorWrapper}>
          <Text style={styles.pageLabel}>صفحة</Text>
          <Text style={styles.pageNumberVal}>{toArabicNumerals(item.page_start)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="إغلاق الفهرس">
            <MaterialCommunityIcons name="arrow-right" size={24} color={QuranColors.emerald} />
          </TouchableOpacity>

          <View style={styles.titleWrapper}>
            <Text style={styles.headerTitle}>فهرس القرآن الكريم</Text>
            <Text style={styles.headerSubtitle}>١١٤ سُورَة • ٣٠ جُزءاً</Text>
          </View>

          {/* متطلب 1: زر البحث الذكي المدمج في رأس الفهرس لتوحيد ميزة البحث ومنع التكرار */}
          <TouchableOpacity
            style={styles.searchHeaderBtn}
            onPress={() => {
              onClose();
              onOpenSearch?.();
            }}
            accessibilityLabel="فتح البحث الذكي"
          >
            <MaterialCommunityIcons name="magnify" size={24} color={QuranColors.emerald} />
          </TouchableOpacity>
        </View>

        {/* Content based on Active Tab */}
        {activeTab === 'surahs' ? (
          <View style={styles.tabContent}>
            <FlatList
              ref={flatListRef}
              data={allSurahs}
              keyExtractor={(item) => 'surah-' + item.sura_no}
              renderItem={renderSurahItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: false,
                    viewPosition: 0.15,
                  });
                }, 100);
              }}
            />
          </View>
        ) : activeTab === 'khatma' ? (
          <View style={styles.placeholderContainer}>
            <MaterialCommunityIcons name="calendar-check-outline" size={60} color={QuranColors.gold} />
            <Text style={styles.placeholderTitle}>ختمتي</Text>
            <Text style={styles.placeholderSubtitle}>
              ميزة جدولة ومتابعة الختمات القرآنية وتقسيم الأوراد اليومية (قريباً في التحديث القادم).
            </Text>
          </View>
        ) : activeTab === 'bookmarks' ? (
          activeBookmark ? (
            <View style={styles.bookmarkContainer}>
              <View style={styles.bookmarkCard}>
                <View style={styles.bookmarkHeader}>
                  <View style={styles.bookmarkBadge}>
                    <MaterialCommunityIcons name="bookmark-check" size={16} color="#FFFFFF" />
                    <Text style={styles.bookmarkBadgeText}>الفاصل النشط</Text>
                  </View>
                  <Text style={styles.bookmarkPageText}>
                    صفحة {toArabicNumerals(activeBookmark.page)}
                  </Text>
                </View>

                <Text style={styles.bookmarkSurahText}>
                  سُورَةُ {activeBookmark.suraName} • الآية {toArabicNumerals(activeBookmark.ayaNo)}
                </Text>

                {activeBookmark.ayahText ? (
                  <Text style={styles.bookmarkAyahText} numberOfLines={3}>
                    {activeBookmark.ayahText}
                  </Text>
                ) : null}

                <TouchableOpacity
                  style={styles.jumpBookmarkBtn}
                  onPress={() => handleSelectSurah(activeBookmark.page)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.jumpBookmarkBtnText}>الانتقال إلى موضع الفاصل</Text>
                  <MaterialCommunityIcons name="arrow-left" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <MaterialCommunityIcons name="bookmark-multiple-outline" size={60} color={QuranColors.gold} />
              <Text style={styles.placeholderTitle}>الفواصل والعلامات</Text>
              <Text style={styles.placeholderSubtitle}>
                لا يوجد فاصل محفوظ حالياً. يمكنك الضغط مطولاً على أي آية أثناء القراءة واختيار "وضع فاصل".
              </Text>
            </View>
          )
        ) : (
          <View style={styles.placeholderContainer}>
            <MaterialCommunityIcons name="note-text-outline" size={60} color={QuranColors.gold} />
            <Text style={styles.placeholderTitle}>الملاحظات والتأملات</Text>
            <Text style={styles.placeholderSubtitle}>
              تدوين الفوائد والخواطر القرآنية حول الآيات (قريباً في التحديث القادم).
            </Text>
          </View>
        )}

        {/* Bottom Route Navigation Bar (`route nav`) */}
        <View style={styles.bottomNavContainer}>
          <TouchableOpacity
            style={[styles.navTab, activeTab === 'surahs' && styles.activeNavTab]}
            onPress={() => setActiveTab('surahs')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={activeTab === 'surahs' ? 'book-open-page-variant' : 'book-open-page-variant-outline'}
              size={22}
              color={activeTab === 'surahs' ? QuranColors.emerald : QuranColors.textMuted}
            />
            <Text style={[styles.navTabText, activeTab === 'surahs' && styles.activeNavTabText]}>
              السور
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, activeTab === 'khatma' && styles.activeNavTab]}
            onPress={() => setActiveTab('khatma')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="calendar-check-outline"
              size={22}
              color={activeTab === 'khatma' ? QuranColors.emerald : QuranColors.textMuted}
            />
            <Text style={[styles.navTabText, activeTab === 'khatma' && styles.activeNavTabText]}>
              ختمتي
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, activeTab === 'bookmarks' && styles.activeNavTab]}
            onPress={() => setActiveTab('bookmarks')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={activeTab === 'bookmarks' ? 'bookmark-multiple' : 'bookmark-multiple-outline'}
              size={22}
              color={activeTab === 'bookmarks' ? QuranColors.emerald : QuranColors.textMuted}
            />
            <Text style={[styles.navTabText, activeTab === 'bookmarks' && styles.activeNavTabText]}>
              الفواصل
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, activeTab === 'notes' && styles.activeNavTab]}
            onPress={() => setActiveTab('notes')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={activeTab === 'notes' ? 'note-text' : 'note-text-outline'}
              size={22}
              color={activeTab === 'notes' ? QuranColors.emerald : QuranColors.textMuted}
            />
            <Text style={[styles.navTabText, activeTab === 'notes' && styles.activeNavTabText]}>
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
    backgroundColor: QuranColors.parchment,
  },
  header: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: QuranColors.parchmentBorder,
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
    backgroundColor: 'rgba(31, 81, 63, 0.08)',
  },
  titleWrapper: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: QuranColors.textMuted,
    marginTop: 2,
  },
  tabContent: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80, // Space for bottom route nav
    gap: 8,
  },
  surahRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: QuranColors.parchmentBorder,
    gap: 12,
  },
  currentSurahRow: {
    borderColor: QuranColors.emerald,
    backgroundColor: 'rgba(31, 81, 63, 0.06)',
    borderWidth: 1.8,
  },
  surahNumberBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(197, 155, 39, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: QuranColors.gold,
  },
  currentSurahNumberBadge: {
    backgroundColor: QuranColors.emerald,
    borderColor: QuranColors.emeraldDark,
  },
  surahNumberText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
  },
  currentSurahNumberText: {
    color: '#FFFFFF',
  },
  surahDetails: {
    flex: 1,
    gap: 3,
  },
  surahTitleRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  surahName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentSurahName: {
    color: QuranColors.emeraldDark,
    fontWeight: 'bold',
    textAlign: 'right',
    writingDirection: 'rtl',
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
    backgroundColor: QuranColors.emerald,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  surahMeta: {
    fontSize: 12,
    color: QuranColors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  pageIndicatorWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  pageLabel: {
    fontSize: 10,
    color: QuranColors.textMuted,
  },
  pageNumberVal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: QuranColors.emerald,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
    textAlign: 'center',
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: QuranColors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  bookmarkContainer: {
    flex: 1,
    padding: 16,
  },
  bookmarkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: QuranColors.emerald,
    gap: 12,
    elevation: 2,
    shadowColor: QuranColors.emeraldDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  bookmarkHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookmarkBadge: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    backgroundColor: QuranColors.emerald,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  bookmarkBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bookmarkPageText: {
    fontSize: 13,
    color: QuranColors.textMuted,
    fontWeight: '600',
  },
  bookmarkSurahText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
    textAlign: 'right',
  },
  bookmarkAyahText: {
    fontSize: 15,
    color: QuranColors.textDark,
    textAlign: 'right',
    lineHeight: 24,
    fontFamily: 'UthmanicHafs',
  },
  jumpBookmarkBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: QuranColors.emerald,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 4,
  },
  jumpBookmarkBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bottomNavContainer: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: QuranColors.parchmentBorder,
    paddingVertical: 6,
    paddingBottom: 10,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  activeNavTab: {},
  navTabText: {
    fontSize: 11,
    color: QuranColors.textMuted,
  },
  activeNavTabText: {
    color: QuranColors.emerald,
    fontWeight: 'bold',
  },
});
