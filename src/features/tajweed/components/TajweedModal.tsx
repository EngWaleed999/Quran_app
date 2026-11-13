import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ProgressBar, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AppText as Text } from '../../../core/theme/components/AppText';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';
import { SelectedAyahInfo } from '../../mushaf/components/AyahActionModal';
import { getFriendlyAudioErrorMessage } from '../../audio-player/services/audioSourceAdapter';

import {
  TajweedRepository,
  TOTAL_EXPECTED_BYTES,
} from '../services/tajweedRepository';
import {
  TajweedAyahData,
  TajweedDownloadProgress,
} from '../type/tajweed.types';

interface TajweedModalProps {
  visible: boolean;
  ayah: SelectedAyahInfo | null;
  onClose: () => void;
}

export const TajweedModal: React.FC<TajweedModalProps> = ({
  visible,
  ayah,
  onClose,
}) => {
  const theme = useTheme();

  const [data, setData] = useState<TajweedAyahData | null>(null);
  const [isDownloaded, setIsDownloaded] = useState<boolean>(() =>
    TajweedRepository.isDatasetDownloaded()
  );
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] =
    useState<TajweedDownloadProgress | null>(null);
  const [isLoadingAyah, setIsLoadingAyah] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const latestRequestRef = useRef(0);

  const loadAyahRules = useCallback(async () => {
    if (!ayah) return;

    const requestId = ++latestRequestRef.current;
    setIsLoadingAyah(true);
    setErrorMessage(null);

    try {
      const result = await TajweedRepository.getAyah(ayah.suraNo, ayah.ayaNo);
      if (latestRequestRef.current === requestId) {
        if (!result) {
          throw new Error('لم يتم العثور على سجل التجويد لهذه الآية.');
        }
        setData(result);
      }
    } catch (error) {
      if (latestRequestRef.current === requestId) {
        setErrorMessage(getFriendlyAudioErrorMessage(error));
      }
    } finally {
      if (latestRequestRef.current === requestId) {
        setIsLoadingAyah(false);
      }
    }
  }, [ayah]);

  // التحقق من حالة التنزيل وتحميل الآية إذا كانت الحزمة موجودة مسبقاً
  useEffect(() => {
    if (!visible || !ayah) {
      latestRequestRef.current += 1;
      return;
    }

    const downloaded = TajweedRepository.isDatasetDownloaded();
    setIsDownloaded(downloaded);
    setErrorMessage(null);

    if (downloaded) {
      void loadAyahRules();
    } else {
      setData(null);
    }

    return () => {
      latestRequestRef.current += 1;
    };
  }, [visible, ayah?.verseKey, loadAyahRules]);

  // بدء تنزيل حزمة التجويد
  const handleStartDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setErrorMessage(null);
    setDownloadProgress({
      stage: 'downloading_edition',
      progress: 0,
      percentage: 0,
      bytesWritten: 0,
      totalBytes: TOTAL_EXPECTED_BYTES,
      message: 'جارٍ بدء تنزيل حزمة التجويد...',
    });

    try {
      await TajweedRepository.downloadDataset((progress) => {
        setDownloadProgress(progress);
      });

      setIsDownloaded(true);
      setIsDownloading(false);
      await loadAyahRules();
    } catch (error) {
      setIsDownloading(false);
      setErrorMessage(getFriendlyAudioErrorMessage(error));
    }
  };

  // إلغاء التنزيل الجاري
  const handleCancelDownload = () => {
    TajweedRepository.cancelDownload();
    setIsDownloading(false);
    setDownloadProgress(null);
    setErrorMessage('تم إلغاء التنزيل بناءً على طلبك.');
  };

  const handleModalClose = () => {
    if (isDownloading) {
      TajweedRepository.cancelDownload();
      setIsDownloading(false);
    }
    onClose();
  };

  if (!ayah) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleModalClose}
    >
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: theme.dark
              ? 'rgba(0,0,0,0.72)'
              : 'rgba(0,0,0,0.45)',
          },
        ]}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: theme.colors.outline },
            ]}
          >
            <TouchableOpacity
              onPress={handleModalClose}
              style={[
                styles.closeButton,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              hitSlop={10}
            >
              <MaterialCommunityIcons
                name="close"
                size={21}
                color={theme.colors.onSurface}
              />
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <Text
                style={[
                  styles.headerTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                أحكام التجويد
              </Text>

              <Text
                style={[
                  styles.headerSubtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                سورة {ayah.suraName} • الآية {toArabicNumerals(ayah.ayaNo)}
              </Text>
            </View>

            <MaterialCommunityIcons
              name="book-open-variant"
              size={25}
              color={theme.colors.primary}
            />
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. حالة تحميل الآية من الذاكرة */}
            {isLoadingAyah ? (
              <View style={styles.centerState}>
                <ActivityIndicator
                  size="large"
                  color={theme.colors.primary}
                />
                <Text
                  style={[
                    styles.stateText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  جارٍ تجهيز أحكام الآية...
                </Text>
              </View>
            ) : isDownloading ? (
              /* 2. بوكس التحميل الجاري - مطابق تماماً لتصميم AudioPickerModal */
              <View style={styles.downloadContainer}>
                <View
                  style={[
                    styles.progressSection,
                    {
                      backgroundColor: theme.dark
                        ? theme.colors.surfaceVariant
                        : QuranColors.parchment,
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
                      {downloadProgress?.stage === 'indexing'
                        ? 'جارٍ تجهيز الفهرس'
                        : 'جارٍ تنزيل بيانات التجويد'}
                    </Text>
                  </View>

                  <ProgressBar
                    progress={downloadProgress?.progress || 0}
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
                      (
                        (downloadProgress?.bytesWritten || 0) /
                        (1024 * 1024)
                      ).toFixed(1)
                    )}{' '}
                    ميجابايت /{' '}
                    {toArabicNumerals(
                      (
                        (downloadProgress?.totalBytes || TOTAL_EXPECTED_BYTES) /
                        (1024 * 1024)
                      ).toFixed(1)
                    )}{' '}
                    ميجابايت
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelDownload}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>إلغاء التنزيل</Text>
                </TouchableOpacity>
              </View>
            ) : !isDownloaded ? (
              /* 3. حالة عدم التحميل: كارت توضيحي + زر تحميل التجويد */
              <View style={styles.notDownloadedContainer}>
                <View
                  style={[
                    styles.downloadCard,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.outline,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="book-open-page-variant"
                    size={46}
                    color={theme.colors.primary}
                    style={styles.downloadCardIcon}
                  />

                  <Text
                    style={[
                      styles.downloadCardTitle,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    تحميل حزمة أحكام التجويد
                  </Text>

                  <Text
                    style={[
                      styles.downloadCardDescription,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    تحتوي هذه الحزمة على أحكام التجويد المفصلة (المدود، الغنن،
                    القلقلة، الإدغام، الإخفاء، وغيرها) لكامل سور القرآن الكريم (6,236
                    آية) مع النص العثماني المرجعي. يتم التنزيل لمرة واحدة فقط لتعمل
                    الميزة مباشرة دون اتصال.
                  </Text>

                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.infoBadge,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.outline,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="download"
                        size={15}
                        color={theme.colors.primary}
                      />
                      <Text
                        style={[
                          styles.infoBadgeText,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        الحجم: ~ 6.9 ميجابايت
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.infoBadge,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.outline,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="cloud-check"
                        size={15}
                        color={QuranColors.emerald}
                      />
                      <Text
                        style={[
                          styles.infoBadgeText,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        تعمل دون إنترنت (Offline)
                      </Text>
                    </View>
                  </View>
                </View>

                {errorMessage ? (
                  <View style={styles.errorBox}>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={20}
                      color={theme.colors.error}
                    />
                    <Text
                      style={[styles.errorText, { color: theme.colors.error }]}
                    >
                      {errorMessage}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.startButton,
                    {
                      backgroundColor: theme.dark
                        ? theme.colors.primary
                        : QuranColors.emerald,
                    },
                  ]}
                  onPress={handleStartDownload}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="download-circle-outline"
                    size={22}
                    color="#FFFFFF"
                  />
                  <Text style={styles.startButtonText}>
                    {errorMessage ? 'إعادة محاولة التنزيل' : 'تحميل حزمة التجويد'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : data ? (
              /* 4. حالة جاهزية البيانات: عرض الآية والأحكام التجويدية */
              <>
                {/* Quran Ayah Card */}
                <View
                  style={[
                    styles.ayahCard,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.outline,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.ayahText,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    ﴿ {data.ayahText} ﴾
                  </Text>
                </View>

                {/* Rules Section Header */}
                <View style={styles.sectionHeader}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    الأحكام التجويدية في هذه الآية
                  </Text>

                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <Text style={styles.countBadgeText}>
                      {toArabicNumerals(data.rules.length)}
                    </Text>
                  </View>
                </View>

                {data.rules.length === 0 ? (
                  <View
                    style={[
                      styles.emptyCard,
                      {
                        backgroundColor: theme.colors.surfaceVariant,
                        borderColor: theme.colors.outline,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={24}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.emptyText,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      لم تُسجّل أحكام تجويدية خاصة لهذه الآية في مصدر البيانات.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.rulesList}>
                    {data.rules.map((rule) => (
                      <View
                        key={rule.rule}
                        style={[
                          styles.ruleCard,
                          {
                            backgroundColor: theme.colors.surfaceVariant,
                            borderColor: theme.colors.outline,
                          },
                        ]}
                      >
                        <View style={styles.ruleHeader}>
                          <Text
                            style={[
                              styles.ruleTitle,
                              { color: theme.colors.primary },
                            ]}
                          >
                            {rule.title}
                          </Text>

                          <Text
                            style={[
                              styles.occurrenceCount,
                              { color: theme.colors.onSurfaceVariant },
                            ]}
                          >
                            {toArabicNumerals(rule.occurrences.length)} موضع
                          </Text>
                        </View>

                        {/* تعريف وشرح الحكم العلمي */}
                        {rule.definition ? (
                          <View
                            style={[
                              styles.definitionBox,
                              {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.outline,
                              },
                            ]}
                          >
                            <View style={styles.definitionHeaderRow}>
                              <MaterialCommunityIcons
                                name="lightbulb-outline"
                                size={16}
                                color={theme.colors.primary}
                                style={styles.definitionIcon}
                              />
                              <Text
                                style={[
                                  styles.definitionText,
                                  { color: theme.colors.onSurfaceVariant },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.definitionLabel,
                                    { color: theme.colors.primary },
                                  ]}
                                >
                                  تعريف الحكم:{' '}
                                </Text>
                                {rule.definition}
                              </Text>
                            </View>
                          </View>
                        ) : null}

                        {/* عنوان قسم المواضع */}
                        <View style={styles.occurrenceSectionTitleRow}>
                          <MaterialCommunityIcons
                            name="bookmark-outline"
                            size={14}
                            color={theme.colors.onSurfaceVariant}
                          />
                          <Text
                            style={[
                              styles.occurrenceSectionTitle,
                              { color: theme.colors.onSurfaceVariant },
                            ]}
                          >
                            المواضع الواردة في هذه الآية:
                          </Text>
                        </View>

                        <View style={styles.occurrencesContainer}>
                          {rule.occurrences.map((occurrence) => (
                            <View
                              key={`${occurrence.start}-${occurrence.end}`}
                              style={[
                                styles.occurrenceChip,
                                {
                                  backgroundColor: theme.colors.surface,
                                  borderColor: theme.colors.outline,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.occurrenceText,
                                  { color: theme.colors.onSurface },
                                ]}
                              >
                                ﴿ {occurrence.text} ﴾
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <Text
                  style={[
                    styles.sourceNote,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  المواضع مستخرجة من مصدر بيانات التجويد المرتبط بالنص العثماني
                  المرجعي. ويظل التلقي والمشافهة أساس تعلم التلاوة.
                </Text>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  sheet: {
    height: '86%',
    width: '100%',
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    borderTopWidth: 1,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 17,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },

  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: 'bold',
  },

  headerSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },

  closeButton: {
    width: 35,
    height: 35,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollArea: {
    flex: 1,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 35,
  },

  // كارت التعريف وحالة ما قبل التنزيل
  notDownloadedContainer: {
    gap: 16,
    paddingTop: 8,
  },

  downloadCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },

  downloadCardIcon: {
    marginBottom: 4,
  },

  downloadCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  downloadCardDescription: {
    fontSize: 13,
    lineHeight: 24,
    textAlign: 'center',
  },

  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },

  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },

  infoBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // بوكس التنزيل الجاري مطابق لـ AudioPickerModal
  downloadContainer: {
    paddingTop: 8,
    gap: 12,
  },

  progressSection: {
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  progressPercent: {
    fontSize: 15,
    fontWeight: 'bold',
  },

  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(197,155,39,0.2)',
  },

  helperText: {
    fontSize: 11,
    textAlign: 'start',
    writingDirection: 'rtl',
  },

  cancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    fontSize: 13,
    color: '#8A2D2D',
    fontWeight: '600',
  },

  // أزرار التحميل
  startButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  startButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // رسائل الخطأ
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(178, 58, 58, 0.08)',
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    textAlign: 'start',
    writingDirection: 'rtl',
    lineHeight: 18,
  },

  // كارت الآية والأحكام التجويدية
  ayahCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 20,
    marginBottom: 22,
  },

  ayahText: {
    fontSize:20,
    lineHeight: 49,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },

  countBadge: {
    width: 27,
    height: 27,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  rulesList: {
    gap: 12,
  },

  ruleCard: {
    borderRadius: 15,
    borderWidth: 1,
    padding: 14,
  },

  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  ruleTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },

  occurrenceCount: {
    fontSize: 11,
  },

  definitionBox: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },

  definitionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },

  definitionIcon: {
    marginTop: 3,
  },

  definitionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
  },

  definitionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'start',
    writingDirection: 'rtl',
  },

//   definitiText: {
//     flex: 1,
//     fontSize: 13,
//     lineHeight: 22,
//     textAlign: 'right',
//     writingDirection: 'rtl',
//     //paddingHorizontal: 1,
//   },

  occurrenceSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },

  occurrenceSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
  },

  occurrencesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  occurrenceChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },

  occurrenceText: {
    fontSize: 19,
    lineHeight: 34,
    textAlign: 'center',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },

  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },

  emptyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 24,
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 55,
    paddingHorizontal: 25,
    gap: 13,
  },

  stateText: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  sourceNote: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 21,
    marginTop: 22,
  },
});
