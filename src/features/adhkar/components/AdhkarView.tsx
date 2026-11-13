import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Platform,
  Vibration,
  TextInput,
  Share,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProgressBar, useTheme } from 'react-native-paper';
import { AppText as Text } from '../../../core/theme/components/AppText';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';
import {
  DhikrItemWithState,
  AdhkarCategoryInfo,
} from '../types/adhkar.types';
import {
  AdhkarService,
  AdhkarDownloadProgress,
  ADHKAR_EXPECTED_BYTES,
} from '../services/adhkarService';
import { CounterState } from '../services/adhkarRules';
import { getFriendlyAudioErrorMessage } from '../../audio-player/services/audioSourceAdapter';

interface AdhkarViewProps {
  visible?: boolean;
  embedded?: boolean;
  selectedCategory?: string | null;
  onSelectCategory?: (category: string | null) => void;
  onClose: () => void;
}

function formatDhikrCount(count: number): string {
  if (count === 1) return 'ذكر واحد';
  if (count === 2) return 'ذكران';
  if (count >= 3 && count <= 10) return `${toArabicNumerals(count)} أذكار`;
  return `${toArabicNumerals(count)} ذكراً`;
}

export const AdhkarView: React.FC<AdhkarViewProps> = ({
  visible = true,
  embedded = false,
  selectedCategory: propCategory,
  onSelectCategory: propOnSelectCategory,
  onClose,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // دعم النمط الموجه (Controlled) من الخارج أو الحالة المحلية (Uncontrolled)
  const [internalCategory, setInternalCategory] = useState<string | null>(null);
  const activeCategory =
    propCategory !== undefined ? propCategory : internalCategory;

  const setActiveCategory = useCallback(
    (cat: string | null) => {
      setInternalCategory(cat);
      propOnSelectCategory?.(cat);
    },
    [propOnSelectCategory]
  );

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categories, setCategories] = useState<AdhkarCategoryInfo[]>([]);
  const [detailItems, setDetailItems] = useState<DhikrItemWithState[]>([]);
  const [allMatchingCount, setAllMatchingCount] = useState<number>(0);
  const [counters, setCounters] = useState<Record<string, CounterState>>({});
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [roundNotification, setRoundNotification] = useState<string | null>(null);

  // حالات تنزيل حزمة الأذكار من GitHub Release
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] =
    useState<AdhkarDownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // تحميل الأقسام
  const loadCategories = useCallback(async () => {
    const cats = await AdhkarService.getCategories();
    setCategories(cats);
    setFavoritesCount(AdhkarService.getFavoritesCount());
  }, []);

  // تحميل تفاصيل الأذكار وتحديث عداداتها الحية
  const loadDetailItems = useCallback(async () => {
    if (!activeCategory) return;
    const items = await AdhkarService.getAdhkar(activeCategory, searchQuery);
    setDetailItems(items);

    // تحديث كاش العدادات المحلية
    const updatedCounters: Record<string, CounterState> = {};
    for (const it of items) {
      updatedCounters[it.id] = AdhkarService.getCounterState(it.id);
    }
    setCounters((prev) => ({ ...prev, ...updatedCounters }));
  }, [activeCategory, searchQuery]);

  // فحص نتائج البحث الشامل في جميع النصوص عند الكتابة في شاشة الفهرس
  const checkGlobalSearchMatches = useCallback(async (query: string) => {
    if (!query.trim()) {
      setAllMatchingCount(0);
      return;
    }
    const matches = await AdhkarService.getAdhkar('all', query);
    setAllMatchingCount(matches.length);
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (activeCategory) {
      void loadDetailItems();
    }
  }, [activeCategory, loadDetailItems]);

  useEffect(() => {
    if (!activeCategory) {
      void checkGlobalSearchMatches(searchQuery);
    }
  }, [activeCategory, searchQuery, checkGlobalSearchMatches]);

  // دعم زر الرجوع الفعلي في أندرويد
  useEffect(() => {
    if (!activeCategory) return;
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setActiveCategory(null);
        setSearchQuery('');
        return true;
      }
    );
    return () => backHandler.remove();
  }, [activeCategory, setActiveCategory]);

  // تبديل حالة المفضلة
  const handleToggleFavorite = async (id: string) => {
    await AdhkarService.toggleFavorite(id);
    await Promise.all([loadCategories(), loadDetailItems()]);
  };

  // زيادة عداد التسبيح الذكي: يدعم بدء جولة جديدة وتصفير الـ 90 دقيقة تلقائياً
  const handleIncrement = async (id: string, maxCount: number) => {
    const result = await AdhkarService.incrementCounter(id, maxCount);
    setCounters((prev) => ({ ...prev, [id]: result.state }));

    // تنبيه لمسي واهتزاز متناسق
    try {
      if (result.isNewRound) {
        // اهتزاز مزدوج لإشعار البدء بجولة جديدة
        if (Platform.OS === 'android') {
          Vibration.vibrate([0, 30, 60, 30]);
        } else {
          Vibration.vibrate([0, 30]);
        }
        setRoundNotification('بدأت جولة تسبيح جديدة');
        setTimeout(() => setRoundNotification(null), 2500);
      } else if (result.isJustCompleted) {
        // اهتزاز تأكيد الاكتمال
        if (Platform.OS === 'android') {
          Vibration.vibrate(50);
        } else {
          Vibration.vibrate([0, 50]);
        }
      } else {
        // اهتزاز تسبيحة عادية
        if (Platform.OS === 'android') {
          Vibration.vibrate(30);
        } else {
          Vibration.vibrate([0, 30]);
        }
      }
    } catch {
      // Fallback
    }
  };

  // تصفير عداد ذكر معين
  const handleReset = async (id: string) => {
    await AdhkarService.resetCounter(id);
    setCounters((prev) => ({
      ...prev,
      [id]: { count: 0, completedAt: null, lastUpdatedAt: Date.now() },
    }));
  };

  // تصفير جميع عدادات القسم الحالي (لإعادة قراءة الورد من جديد)
  const handleResetCurrentCategory = async () => {
    if (!activeCategory || activeCategory === 'favorites' || activeCategory === 'all') return;
    await AdhkarService.resetCategoryCounters(activeCategory);
    await loadDetailItems();
    setRoundNotification('تم تصفير عدادات هذا القسم');
    setTimeout(() => setRoundNotification(null), 2500);
  };

  // مشاركة نص الذكر
  const handleShare = async (item: DhikrItemWithState) => {
    try {
      const message = `${item.text}\n\n[${item.categoryTitle}] (تكرار: ${item.count} مرة)\n— تطبيق القرآن الكريم`;
      await Share.share({
        message,
        title: item.categoryTitle,
      });
    } catch (error) {
      console.warn('[AdhkarView] Share failed:', error);
    }
  };

  // تنزيل أو تحديث ملف الأذكار من GitHub Release مع التراجع الأسي
  const handleStartDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await AdhkarService.downloadDataset(undefined, (progress) => {
        setDownloadProgress(progress);
      });
      setIsDownloading(false);
      setDownloadProgress(null);
      await Promise.all([loadCategories(), loadDetailItems()]);
      setRoundNotification('تم تحديث حزمة الأذكار بنجاح');
      setTimeout(() => setRoundNotification(null), 3000);
    } catch (error) {
      setIsDownloading(false);
      setDownloadProgress(null);
      setDownloadError(getFriendlyAudioErrorMessage(error));
    }
  };

  const handleCancelDownload = () => {
    AdhkarService.cancelDownload();
    setIsDownloading(false);
    setDownloadProgress(null);
    setDownloadError('تم إلغاء التنزيل بناءً على طلبك.');
  };

  // تصفية الأقسام حسب البحث
  const filteredCategories = useMemo(() => {
    const rawList = categories.filter(
      (c) => c.id !== 'all' && c.id !== 'favorites'
    );
    if (!searchQuery.trim()) return rawList;
    const q = searchQuery.trim().toLowerCase();
    return rawList.filter((c) => c.title.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  // ==========================================
  // رندر بطاقة الذكر في الواجهة التفصيلية
  // ==========================================
  const renderDhikrCard = ({ item }: { item: DhikrItemWithState }) => {
    const counterState = counters[item.id] ?? {
      count: 0,
      completedAt: null,
      lastUpdatedAt: 0,
    };
    const currentCount = counterState.count;
    const isCompleted = currentCount >= item.count;

    return (
      <View
        style={[
          styles.dhikrCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: item.isFavorite
              ? QuranColors.gold
              : theme.colors.outline,
          },
        ]}
      >
        {/* Header Row: Category Badge + Actions (All 'row' in RTL) */}
        <View style={styles.cardHeader}>
          {/* Right Side: Category Name & Favorite Star */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <Text
                style={[
                  styles.categoryBadgeText,
                  { color: theme.colors.primary },
                ]}
              >
                {item.categoryTitle}
              </Text>
            </View>

            {item.isFavorite ? (
              <View style={styles.favoriteBadge}>
                <MaterialCommunityIcons name="star" size={13} color="#FFFFFF" />
                <Text style={styles.favoriteBadgeText}>مفضلة</Text>
              </View>
            ) : null}
          </View>

          {/* Left Side: Share & Heart Toggle */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleShare(item)}
              hitSlop={8}
              accessibilityLabel="مشاركة الذكر"
            >
              <MaterialCommunityIcons
                name="share-variant-outline"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleToggleFavorite(item.id)}
              hitSlop={8}
              accessibilityLabel={
                item.isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'
              }
            >
              <MaterialCommunityIcons
                name={item.isFavorite ? 'heart' : 'heart-outline'}
                size={22}
                color={item.isFavorite ? '#E53935' : theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Vocalized Text with Generous Line Height for Diacritics (No clipping) */}
        <Text
          style={[styles.dhikrText, { color: theme.colors.onSurface }]}
          selectable
        >
          {item.text}
        </Text>

        {/* Tasbeeh Counter Row */}
        <View style={styles.counterRow}>
          <TouchableOpacity
            style={[
              styles.counterButton,
              isCompleted
                ? { backgroundColor: QuranColors.emerald }
                : { backgroundColor: theme.colors.primary },
            ]}
            onPress={() => handleIncrement(item.id, item.count)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              isCompleted
                ? `اكتمل. اضغط لبدء جولة جديدة (${item.count})`
                : `تسبيح: ${currentCount} من ${item.count}`
            }
          >
            <MaterialCommunityIcons
              name={isCompleted ? 'check-decagram' : 'fingerprint'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.counterText}>
              {isCompleted
                ? `اكتمل (${toArabicNumerals(item.count)}) • انقر لجولة جديدة`
                : `${toArabicNumerals(currentCount)} / ${toArabicNumerals(
                    item.count
                  )}`}
            </Text>
          </TouchableOpacity>

          {currentCount > 0 ? (
            <TouchableOpacity
              style={[
                styles.resetBtn,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              onPress={() => handleReset(item.id)}
              hitSlop={8}
              accessibilityLabel="إعادة ضبط العداد"
            >
              <MaterialCommunityIcons
                name="refresh"
                size={18}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  // ==========================================
  // واجهة تفاصيل القسم المحدد
  // ==========================================
  const renderDetailView = () => {
    const isFavoritesView = activeCategory === 'favorites';
    const isAllSearchView = activeCategory === 'all';
    const title = isFavoritesView
      ? 'الأذكار المفضلة'
      : isAllSearchView
        ? 'نتائج البحث في الأذكار'
        : activeCategory;

    return (
      <View style={styles.detailContainer}>
        {/* Detail Sub-Header with Back Button & Reset All */}
        <View
          style={[
            styles.detailSubHeader,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.outline,
            },
          ]}
        >
          {/* Right Side: Back to Categories Button */}
          <TouchableOpacity
            style={[
              styles.backButton,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
            onPress={() => {
              setActiveCategory(null);
              setSearchQuery('');
            }}
            accessibilityLabel="رجوع إلى قائمة الأقسام"
          >
            <MaterialCommunityIcons
              name="arrow-right"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>
              الأقسام
            </Text>
          </TouchableOpacity>

          {/* Center Title */}
          <View style={styles.detailTitleWrapper}>
            <Text
              style={[styles.detailTitle, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.detailSubtitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {formatDhikrCount(detailItems.length)}
            </Text>
          </View>

          {/* Left Side: Reset Category Counters */}
          {!isFavoritesView && !isAllSearchView ? (
            <TouchableOpacity
              style={[
                styles.resetCategoryBtn,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              onPress={handleResetCurrentCategory}
              hitSlop={8}
              accessibilityLabel="تصفير عدادات القسم"
            >
              <MaterialCommunityIcons
                name="refresh"
                size={18}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        {/* Temporary Round Notification Banner */}
        {roundNotification ? (
          <View style={styles.roundNotificationBanner}>
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color={QuranColors.emerald}
            />
            <Text style={styles.roundNotificationText}>
              {roundNotification}
            </Text>
          </View>
        ) : null}

        {/* Dhikr Items FlatList */}
        <FlatList
          data={detailItems}
          keyExtractor={(item) => item.id}
          renderItem={renderDhikrCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name={
                  isFavoritesView
                    ? 'heart-outline'
                    : 'text-box-search-outline'
                }
                size={54}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.emptyText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {isFavoritesView
                  ? 'لم تقم بإضافة أي أذكار إلى المفضلة بعد.\nاضغط على أيقونة القلب في أي ذكر لحفظه هنا والوصول إليه بسرعة.'
                  : searchQuery.trim().length > 0
                    ? 'لم يتم العثور على أذكار تطابق بحثك.'
                    : 'لا توجد أذكار مسجلة في هذا القسم حالياً.'}
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  // ==========================================
  // واجهة قائمة الأقسام الرئيسية (Master Categories)
  // ==========================================
  const renderMasterView = () => (
    <View style={styles.masterContainer}>
      {/* Search Input Bar */}
      <View
        style={[
          styles.searchBarWrapper,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <View
          style={[
            styles.searchInputContainer,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.outline,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.onSurface }]}
            placeholder="ابحث في أسماء الأقسام أو نصوص الأذكار..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            textAlign="start"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={8}
              accessibilityLabel="مسح البحث"
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Global Text Search Hint Card */}
      {searchQuery.trim().length > 0 && allMatchingCount > 0 ? (
        <TouchableOpacity
          style={[
            styles.searchMatchBanner,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.primary,
            },
          ]}
          onPress={() => setActiveCategory('all')}
          activeOpacity={0.8}
        >
          <View style={styles.bannerIconBadge}>
            <MaterialCommunityIcons
              name="book-search"
              size={22}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.bannerTextWrapper}>
            <Text
              style={[
                styles.bannerTitle,
                { color: theme.colors.onSurface },
              ]}
            >
              بحث في نصوص الأذكار
            </Text>
            <Text
              style={[
                styles.bannerSubtitle,
                { color: theme.colors.primary },
              ]}
            >
              تم العثور على {formatDhikrCount(allMatchingCount)} تطابق «{searchQuery}» • اضغط للعرض
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
      ) : null}

      {/* بوكس تحميل وتحديث حزمة الأذكار من GitHub Release (إذا كان جارياً) */}
      {isDownloading ? (
        <View style={styles.downloadContainer}>
          <View
            style={[
              styles.progressSection,
              {
                backgroundColor: theme.dark
                  ? theme.colors.surfaceVariant
                  : QuranColors.parchment,
                borderColor: theme.colors.outline,
              },
            ]}
          >
            <View style={styles.progressHeader}>
              <Text
                style={[
                  styles.progressPercent,
                  {
                    color: theme.dark
                      ? theme.colors.primary
                      : QuranColors.emerald,
                  },
                ]}
              >
                {toArabicNumerals(downloadProgress?.percentage || 0)}٪
              </Text>
              <Text
                style={[
                  styles.progressLabel,
                  {
                    color: theme.dark
                      ? theme.colors.onSurface
                      : QuranColors.textDark,
                  },
                ]}
              >
                جارٍ تنزيل بيانات الأذكار
              </Text>
            </View>

            <ProgressBar
              progress={(downloadProgress?.percentage || 0) / 100}
              color={QuranColors.gold}
              style={styles.progressBar}
            />

            <Text
              style={[
                styles.helperText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {downloadProgress?.message || 'جارٍ الاتصال بالخادم...'}
            </Text>

            <Text
              style={[
                styles.helperText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {toArabicNumerals(
                Math.round((downloadProgress?.bytesWritten || 0) / 1024)
              )}{' '}
              ك.ب /{' '}
              {toArabicNumerals(
                Math.round(
                  (downloadProgress?.totalBytes || ADHKAR_EXPECTED_BYTES) / 1024
                )
              )}{' '}
              ك.ب
            </Text>

            <TouchableOpacity
              style={styles.cancelDownloadBtn}
              onPress={handleCancelDownload}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelDownloadBtnText}>إلغاء التنزيل</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : downloadError ? (
        <View style={styles.errorContainer}>
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: 'rgba(229, 57, 53, 0.08)',
                borderColor: 'rgba(229, 57, 53, 0.3)',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={24}
              color="#E53935"
            />
            <Text style={styles.errorText}>{downloadError}</Text>
            <TouchableOpacity
              style={[
                styles.retryDownloadBtn,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={handleStartDownload}
            >
              <Text style={styles.retryDownloadBtnText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Categories List */}
      <FlatList
        data={filteredCategories}
        keyExtractor={(cat) => cat.id}
        contentContainerStyle={styles.categoryListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          !searchQuery.trim() ? (
            <View>
              {/* البطاقة المميزة للمفضلة في أول القائمة دائماً */}
              <TouchableOpacity
                style={[
                  styles.favoriteHeroCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: QuranColors.gold,
                  },
                ]}
                onPress={() => setActiveCategory('favorites')}
                activeOpacity={0.75}
              >
                <View style={styles.categoryMainRow}>
                  <View style={styles.favoriteIconBadge}>
                    <MaterialCommunityIcons
                      name="heart"
                      size={24}
                      color="#E53935"
                    />
                  </View>
                  <View style={styles.categoryTextWrapper}>
                    <Text
                      style={[
                        styles.categoryTitle,
                        { color: theme.colors.onSurface, fontWeight: 'bold' },
                      ]}
                    >
                      الأذكار المفضلة
                    </Text>
                    <Text
                      style={[
                        styles.categorySubtitle,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {favoritesCount > 0
                        ? `${toArabicNumerals(favoritesCount)} أذكار محفوظة في قائمتك`
                        : 'اضغط لحفظ أذكارك المعتادة والوصول إليها بسرعة'}
                    </Text>
                  </View>
                </View>
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={22}
                  color={QuranColors.gold}
                />
              </TouchableOpacity>

              {/* شريط معلومات التحديث من GitHub Release */}
              {!isDownloading ? (
                <View style={styles.syncRowWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.syncBadge,
                      {
                        backgroundColor: theme.colors.surfaceVariant,
                        borderColor: theme.colors.outline,
                      },
                    ]}
                    onPress={handleStartDownload}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="cloud-sync-outline"
                      size={16}
                      color={theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.syncBadgeText,
                        { color: theme.colors.primary },
                      ]}
                    >
                      تحديث الأذكار من الإصدار
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : undefined
        }
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[
              styles.categoryCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
              },
            ]}
            onPress={() => setActiveCategory(cat.title)}
            activeOpacity={0.7}
          >
            <View style={styles.categoryMainRow}>
              <View
                style={[
                  styles.categoryIconBadge,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <MaterialCommunityIcons
                  name={cat.icon as any}
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.categoryTextWrapper}>
                <Text
                  style={[
                    styles.categoryTitle,
                    { color: theme.colors.onSurface },
                  ]}
                  numberOfLines={2}
                >
                  {cat.title}
                </Text>
                <Text
                  style={[
                    styles.categorySubtitle,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {formatDhikrCount(cat.count)}
                </Text>
              </View>
            </View>

            <MaterialCommunityIcons
              name="chevron-left"
              size={22}
              color={theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="folder-search-outline"
              size={50}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              لم يتم العثور على قسم يطابق «{searchQuery}».
            </Text>
          </View>
        }
      />
    </View>
  );

  const mainContent = (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {activeCategory ? renderDetailView() : renderMasterView()}
    </View>
  );

  if (embedded) {
    return mainContent;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.modalWrapper, { paddingTop: insets.top }]}>
        <View
          style={[
            styles.modalHeader,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.outline,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              if (activeCategory) {
                setActiveCategory(null);
                return;
              }
              onClose();
            }}
            accessibilityLabel={activeCategory ? 'الرجوع إلى الأقسام' : 'إغلاق'}
          >
            <MaterialCommunityIcons
              name="arrow-right"
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
          <Text
            style={[styles.modalHeaderTitle, { color: theme.colors.onSurface }]}
          >
            {activeCategory ? activeCategory : 'الأذكار والأدعية'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        {mainContent}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalWrapper: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  masterContainer: {
    flex: 1,
  },
  detailContainer: {
    flex: 1,
  },
  detailSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  detailTitleWrapper: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  detailSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  resetCategoryBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundNotificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(31, 81, 63, 0.1)',
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  roundNotificationText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
  },
  searchBarWrapper: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    writingDirection: 'rtl',
    textAlign: 'start',
  },
  searchMatchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    gap: 10,
  },
  bannerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTextWrapper: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
    writingDirection: 'rtl',
    textAlign: 'start',
  },
  bannerSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
    writingDirection: 'rtl',
    textAlign: 'start',
  },
  downloadContainer: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  progressSection: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  helperText: {
    fontSize: 11.5,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  cancelDownloadBtn: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cancelDownloadBtnText: {
    color: '#E53935',
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorContainer: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  errorCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 20,
    color: '#E53935',
  },
  retryDownloadBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryListContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 10,
  },
  favoriteHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 4,
    gap: 10,
  },
  favoriteIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(229, 57, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncRowWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 10,
    marginTop: 2,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  syncBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'start'
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    gap: 10,
  },
  categoryMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  categoryIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTextWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  categoryTitle: {
    fontSize: 14.5,
    fontWeight: 'bold',
    writingDirection: 'rtl',
    textAlign: 'start',
    lineHeight: 22,
  },
  categorySubtitle: {
    fontSize: 11.5,
    marginTop: 2,
    writingDirection: 'rtl',
    textAlign: 'start',
  },
  listContent: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },
  dhikrCard: {
    borderRadius: 16,
    borderWidth: 1.2,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  favoriteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: QuranColors.gold,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  favoriteBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    padding: 4,
  },
  dhikrText: {
    fontSize: 17.5,
    lineHeight: 33,
    textAlign: 'start',
    writingDirection: 'rtl',
    paddingHorizontal: 2,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  counterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resetBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
    gap: 14,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 24,
  },
});
