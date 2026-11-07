import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SQLiteDatabase } from 'expo-sqlite';
import { SelectedAyahInfo } from './AyahActionModal';
import { getTafsirDatabase } from '../../../core/database/tafsirDatabase';
import {
  TafsirRepository,
  TafsirBookId,
  AVAILABLE_TAFSIRS,
} from '../../../core/database/tafsirRepository';
import { QuranColors } from '../../../core/theme/theme';

interface TafsirModalProps {
  visible: boolean;
  ayah: SelectedAyahInfo | null;
  onClose: () => void;
  db?: SQLiteDatabase | null;
}

const toArabicNumerals = (num: number): string => {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().replace(/\d/g, (d) => arabicDigits[parseInt(d, 10)]);
};

export const TafsirModal: React.FC<TafsirModalProps> = ({
  visible,
  ayah,
  onClose,
  db,
}) => {
  const theme = useTheme();
  const isDark = theme.dark;

  const [activeTafsir, setActiveTafsir] = useState<TafsirBookId>('saadi');
  const [tafsirText, setTafsirText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const latestRequestIdRef = React.useRef<number>(0);

  // تقسيم النص إلى جمل تنتهي بنقطة لتسهيل القراءة وتتبع التفسير مع فواصل جمالية
  const sentences = useMemo(() => {
    if (!tafsirText) return [];
    const raw = tafsirText.split(/(?<=\.)\s+/);
    return raw.map((s) => s.trim()).filter((s) => s.length > 0);
  }, [tafsirText]);

  // تحميل التفسير عند تغيير الآية أو التفسير النشط مع منع Race Conditions
  const loadTafsir = useCallback(async () => {
    if (!ayah) return;
    const currentRequestId = ++latestRequestIdRef.current;
    setIsLoading(true);
    setIsError(false);

    try {
      const activeDb = db || (await getTafsirDatabase());
      const text = await TafsirRepository.getAyahTafsir(
        activeDb,
        ayah.suraNo,
        ayah.ayaNo,
        activeTafsir
      );
      // التأكد أن هذه الاستجابة تخص أحدث طلب فقط
      if (latestRequestIdRef.current === currentRequestId) {
        setTafsirText(text);
      }
    } catch (error) {
      console.error('[TafsirModal] Error loading tafsir:', error);
      if (latestRequestIdRef.current === currentRequestId) {
        setIsError(true);
        setTafsirText('تعذر تحميل قاعدة بيانات التفسير. يرجى إعادة المحاولة.');
      }
    } finally {
      if (latestRequestIdRef.current === currentRequestId) {
        setIsLoading(false);
      }
    }
  }, [ayah, activeTafsir, db]);

  useEffect(() => {
    if (visible && ayah) {
      loadTafsir();
    }
  }, [visible, ayah, activeTafsir, loadTafsir]);

  if (!ayah) return null;

  const handleShare = async () => {
    try {
      const activeBook = AVAILABLE_TAFSIRS.find((b) => b.id === activeTafsir);
      const bookName = activeBook ? activeBook.name : 'التفسير';
      const message = `﴿ ${ayah.ayahText || ''} ﴾\n[سورة ${ayah.suraName}: الآية ${toArabicNumerals(ayah.ayaNo)}]\n\n📖 ${bookName}:\n${tafsirText}\n\n— تطبيق القرآن الكريم`;
      await Share.share({ message });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, isDark && styles.modalSheetDark]}>
          {/* Header Bar */}
          <View style={[styles.headerBar, isDark && styles.headerBarDark]}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={isDark ? QuranColors.nightText : QuranColors.textMuted}
              />
            </TouchableOpacity>

            <View style={styles.headerTitleGroup}>
              <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
                تفسير الآية
              </Text>
              <Text style={styles.headerSubtitle}>
                سورة {ayah.suraName} • الآية {toArabicNumerals(ayah.ayaNo)} • تفسير السعدي
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleShare}
              style={styles.shareButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name="share-variant-outline"
                size={20}
                color={QuranColors.gold}
              />
            </TouchableOpacity>
          </View>

          {/* Tafsir Book Tabs (only shown when multiple books exist) */}
          {AVAILABLE_TAFSIRS.length > 1 && (
            <View style={[styles.tabsRow, isDark && styles.tabsRowDark]}>
              {AVAILABLE_TAFSIRS.map((book) => {
                const isSelected = activeTafsir === book.id;
                return (
                  <TouchableOpacity
                    key={book.id}
                    style={[
                      styles.tabButton,
                      isSelected && styles.tabButtonActive,
                      isSelected && isDark && styles.tabButtonActiveDark,
                    ]}
                    onPress={() => setActiveTafsir(book.id)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        isDark && styles.tabTextDark,
                        isSelected && styles.tabTextActive,
                      ]}
                    >
                      {book.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Main Content Area */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Quran Ayah Box */}
            {ayah.ayahText ? (
              <View style={[styles.ayahBox, isDark && styles.ayahBoxDark]}>
                <Text style={[styles.ayahText, isDark && styles.ayahTextDark]}>
                  ﴿ {ayah.ayahText} ﴾
                </Text>
              </View>
            ) : null}

            {/* Tafsir Text Body */}
            {isLoading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="small" color={QuranColors.gold} />
                <Text style={styles.loadingText}>جاري تحميل التفسير...</Text>
              </View>
            ) : isError ? (
              <View style={styles.loaderContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={36} color={QuranColors.gold} />
                <Text style={styles.loadingText}>{tafsirText}</Text>
                <TouchableOpacity
                  style={[styles.tabButton, styles.tabButtonActive, { marginTop: 12, paddingHorizontal: 20 }]}
                  onPress={loadTafsir}
                >
                  <Text style={[styles.tabText, styles.tabTextActive]}>إعادة المحاولة</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.tafsirBodyContainer}>
                {sentences.map((sentence, index) => (
                  <View key={index} style={styles.sentenceWrapper}>
                    {index > 0 && (
                      <View
                        style={[
                          styles.sentenceDivider,
                          isDark && styles.sentenceDividerDark,
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.tafsirBodyText,
                        isDark && styles.tafsirBodyTextDark,
                      ]}
                      selectable
                    >
                      {sentence}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '78%',
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 16,
  },
  modalSheetDark: {
    backgroundColor: QuranColors.nightSurface,
  },
  headerBar: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDEBE6',
  },
  headerBarDark: {
    borderBottomColor: QuranColors.nightBorder,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
  },
  headerTitleDark: {
    color: QuranColors.goldLight,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: QuranColors.textMuted,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#FAF8F5',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECE6',
  },
  tabsRowDark: {
    backgroundColor: '#161917',
    borderBottomColor: QuranColors.nightBorder,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2DED6',
    backgroundColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: QuranColors.emerald,
    borderColor: QuranColors.emerald,
  },
  tabButtonActiveDark: {
    backgroundColor: QuranColors.emeraldLight,
    borderColor: QuranColors.emeraldLight,
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: QuranColors.textDark,
  },
  tabTextDark: {
    color: QuranColors.nightText,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 36,
  },
  ayahBox: {
    backgroundColor: 'rgba(197, 155, 39, 0.08)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(197, 155, 39, 0.3)',
    borderStyle: 'dashed',
  },
  ayahBoxDark: {
    backgroundColor: 'rgba(229, 192, 88, 0.06)',
    borderColor: 'rgba(229, 192, 88, 0.25)',
  },
  ayahText: {
    fontSize: 18,
    lineHeight: 32,
    color: QuranColors.emeraldDark,
    textAlign: 'center',
    writingDirection: 'rtl',
    fontWeight: '600',
  },
  ayahTextDark: {
    color: QuranColors.goldLight,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: QuranColors.textMuted,
  },
  tafsirBodyContainer: {
    paddingVertical: 4,
    width: '100%',
  },
  sentenceWrapper: {
    width: '100%',
  },
  sentenceDivider: {
    height: 1,
    backgroundColor: 'rgba(197, 155, 39, 0.2)',
    marginVertical: 12,
    width: '100%',
  },
  sentenceDividerDark: {
    backgroundColor: 'rgba(229, 192, 88, 0.18)',
  },
  tafsirBodyText: {
    fontSize: 16.5,
    lineHeight: 32,
    color: '#2C2B29',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tafsirBodyTextDark: {
    color: '#D8D5CD',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
