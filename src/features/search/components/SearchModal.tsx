import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Keyboard,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from '../../../core/theme/components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SQLiteDatabase } from 'expo-sqlite';
import { QuranColors } from '../../../core/theme/theme';
import { useTheme } from 'react-native-paper';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';
import { SearchService } from '../services/searchService';
import { SurahSearchResult, AyahSearchResult, PageSearchResult } from '../types/search.types';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPage: (page: number, verseKey?: string) => void;
  db: SQLiteDatabase;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  visible,
  onClose,
  onSelectPage,
  db,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pageResult, setPageResult] = useState<PageSearchResult | null>(null);
  const [matchedSurahs, setMatchedSurahs] = useState<SurahSearchResult[]>([]);
  const [matchedAyahs, setMatchedAyahs] = useState<AyahSearchResult[]>([]);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setPageResult(null);
      setMatchedSurahs([]);
      setMatchedAyahs([]);
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  useEffect(() => {
    if (!query.trim()) {
      setPageResult(null);
      setMatchedSurahs([]);
      setMatchedAyahs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const handler = setTimeout(async () => {
      try {
        const results = await SearchService.searchQuran(db, query, 50);
        setPageResult(results.pageResult ?? null);
        setMatchedSurahs(results.surahs);
        setMatchedAyahs(results.ayahs);
      } catch (err) {
        console.warn('[SearchModal] Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [query, db]);

  const handleSelectPage = useCallback(
    (page: number, verseKey?: string) => {
      Keyboard.dismiss();
      onClose();
      onSelectPage(page, verseKey);
    },
    [onClose, onSelectPage]
  );

  const cardDynamicStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.outline,
  };

  const renderSurahCard = ({ item }: { item: SurahSearchResult }) => (
    <TouchableOpacity
      style={[styles.surahCard, cardDynamicStyle]}
      onPress={() => handleSelectPage(item.page_start)}
      activeOpacity={0.7}
    >
      <View style={[styles.surahNumberCircle, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.primary }]}>
        <Text style={[styles.surahNumberText, { color: theme.colors.primary }]}>
          {toArabicNumerals(item.sura_no)}
        </Text>
      </View>

      <View style={styles.surahInfo}>
        <View style={styles.surahTitleRow}>
          <Text style={[styles.surahNameText, { color: theme.colors.onSurface }]}>
            سُورَةُ {item.sura_name_ar}
          </Text>
          <View
            style={[
              styles.revelationBadge,
              item.revelation_place === 'مدنية' ? styles.madaniBadge : styles.makkiBadge,
            ]}
          >
            <Text style={styles.revelationText}>{item.revelation_place}</Text>
          </View>
        </View>

        <Text style={[styles.surahMetaText, { color: theme.colors.onSurfaceVariant }]}>
          {toArabicNumerals(item.ayahs_count)} آية • تبدأ من صفحة {toArabicNumerals(item.page_start)}
        </Text>
      </View>

      <MaterialCommunityIcons name="chevron-left" size={20} color={theme.colors.onSurfaceVariant} />
    </TouchableOpacity>
  );

  const renderAyahItem = ({ item }: { item: AyahSearchResult }) => {
    const verseKey = `${item.sura_no}:${item.aya_no}`;
    return (
      <TouchableOpacity
        style={[styles.ayahCard, cardDynamicStyle]}
        onPress={() => handleSelectPage(item.page, verseKey)}
        activeOpacity={0.7}
      >
        <View style={styles.ayahCardHeader}>
          <View style={[styles.ayahMetaTag, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.ayahMetaTagText, { color: theme.colors.primary }]}>
              سورة {item.sura_name_ar}
            </Text>
          </View>
          <Text style={[styles.ayahSubMeta, { color: theme.colors.onSurfaceVariant }]}>
            الآية {toArabicNumerals(item.aya_no)} • صفحة {toArabicNumerals(item.page)}
          </Text>
        </View>

        <Text style={[styles.ayahSnippetText, { color: theme.colors.onSurface }]} numberOfLines={3}>
          {item.aya_text_emlaey}
        </Text>
      </TouchableOpacity>
    );
  };

  const hasResults = Boolean(pageResult) || matchedSurahs.length > 0 || matchedAyahs.length > 0;
  const isQueryActive = query.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Top Search Input Bar */}
        <View
          style={[
            styles.headerBar,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.outline,
              paddingTop: Math.max(insets.top + 6, 16),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityLabel="إغلاق البحث"
          >
            <MaterialCommunityIcons name="arrow-right" size={24} color={theme.colors.primary} />
          </TouchableOpacity>

          <View
            style={[
              styles.searchFieldWrapper,
              {
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: theme.colors.outline,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={21}
              color={theme.colors.primary}
            />
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: theme.colors.onSurface }]}
              placeholder="ابحث عن سورة، أو برقم الصفحة (1-604)، أو بآية..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color={theme.colors.onSurfaceVariant}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Content Area */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
              جاري البحث في المصحف الشريف...
            </Text>
          </View>
        ) : !isQueryActive ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="book-search-outline"
              size={56}
              color={theme.colors.secondary}
            />
            <Text style={[styles.emptyTitle, { color: theme.colors.primary }]}>
              البحث الذكي في القرآن الكريم
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
              يمكنك كتابة اسم السورة (مثل: الكهف)، أو رقم الصفحة (مثل: 50)، أو أي كلمة من آيات المصحف (مثل: اهدنا).
            </Text>

            <View style={styles.chipsContainer}>
              {['الفَاتِحة', 'البَقَرَة', 'الكَهف', 'يس', 'الملك'].map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.outline,
                    },
                  ]}
                  onPress={() => setQuery(suggestion)}
                >
                  <Text style={[styles.chipText, { color: theme.colors.primary }]}>
                    {suggestion}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : !hasResults ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="text-search"
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
              لا توجد نتائج مطابقة لـ "{query}"
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
              تأكد من صحة الكلمة أو رقم الصفحة (1 إلى 604)، أو جرّب البحث بجزء من الآية دون تشكيل.
            </Text>
          </View>
        ) : (
          <FlatList
            data={matchedAyahs}
            keyExtractor={(item) => 'ayah-' + item.id}
            renderItem={renderAyahItem}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              Boolean(pageResult) || matchedSurahs.length > 0 ? (
                <View style={styles.headerSectionContainer}>
                  {pageResult ? (
                    <View style={styles.pageCardSection}>
                      <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                        الانتقال السريع إلى الصفحة
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.pageCard,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.primary,
                          },
                        ]}
                        onPress={() => handleSelectPage(pageResult.page)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.pageNumberCircle,
                            {
                              backgroundColor: theme.colors.surfaceVariant,
                              borderColor: theme.colors.primary,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pageNumberCircleText,
                              { color: theme.colors.primary },
                            ]}
                          >
                            {toArabicNumerals(pageResult.page)}
                          </Text>
                        </View>

                        <View style={styles.pageCardInfo}>
                          <Text style={[styles.pageCardTitle, { color: theme.colors.onSurface }]}>
                            الانتقال إلى صَفْحَة {toArabicNumerals(pageResult.page)}
                          </Text>
                          <Text
                            style={[
                              styles.pageCardSubtitle,
                              { color: theme.colors.onSurfaceVariant },
                            ]}
                          >
                            سُورَةُ {pageResult.surah_name_ar} • الجزء {toArabicNumerals(pageResult.jozz)}
                          </Text>
                        </View>

                        <View style={[styles.jumpBtnBadge, { backgroundColor: theme.colors.primary }]}>
                          <Text style={styles.jumpBtnBadgeText}>انتقال</Text>
                          <MaterialCommunityIcons name="arrow-left" size={16} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {matchedSurahs.length > 0 ? (
                    <View style={styles.surahsSection}>
                      <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                        السور المطابقة ({toArabicNumerals(matchedSurahs.length)})
                      </Text>
                      {matchedSurahs.map((surah) => (
                        <React.Fragment key={'surah-' + surah.sura_no}>
                          {renderSurahCard({ item: surah })}
                        </React.Fragment>
                      ))}
                    </View>
                  ) : null}

                  {matchedAyahs.length > 0 ? (
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: theme.colors.onSurfaceVariant, marginTop: 12 },
                      ]}
                    >
                      الآيات المطابقة ({toArabicNumerals(matchedAyahs.length)})
                    </Text>
                  ) : null}
                </View>
              ) : undefined
            }
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    gap: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  searchFieldWrapper: {
    flex: 1,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    textAlign: 'auto',
    writingDirection: 'rtl',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  chipsContainer: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultsList: {
    padding: 16,
    gap: 10,
  },
  headerSectionContainer: {
    marginBottom: 6,
  },
  pageCardSection: {
    marginBottom: 16,
  },
  pageCard: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1.5,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: 12,
  },
  pageNumberCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  pageNumberCircleText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  pageCardInfo: {
    flex: 1,
    gap: 3,
  },
  pageCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  pageCardSubtitle: {
    fontSize: 12,
    textAlign: 'auto'
,
    writingDirection: 'rtl',
  },
  jumpBtnBadge: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  jumpBtnBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  surahsSection: {
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'auto'
,
    writingDirection: 'rtl',
    marginBottom: 8,
  },
  surahCard: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    gap: 12,
  },
  surahNumberCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  surahNumberText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  surahInfo: {
    flex: 1,
    gap: 2,
  },
  surahTitleRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  surahNameText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  revelationBadge: {
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
  revelationText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
  },
  surahMetaText: {
    fontSize: 12,
    textAlign: 'auto'
,
    writingDirection: 'rtl',
  },
  ayahCard: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  ayahCardHeader: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ayahMetaTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ayahMetaTagText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  ayahSubMeta: {
    fontSize: 12,
  },
  ayahSnippetText: {
    fontSize: 15,
    textAlign: 'auto'
,
    writingDirection: 'rtl',
    lineHeight: 24,
    fontFamily: 'UthmanicHafs',
  },
});
