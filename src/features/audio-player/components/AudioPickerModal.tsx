import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View, I18nManager } from 'react-native';
import { AppText as Text } from '../../../core/theme/components/AppText';
import { ProgressBar, useTheme } from 'react-native-paper';
import { SQLiteDatabase } from 'expo-sqlite';
import { QuranRepository } from '../../../core/database/quranRepository';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';
import { SelectedAyahInfo } from '../../mushaf/components/AyahActionModal';
import { AudioDownloader } from '../services/audioDownloader';
import { RECITERS } from '../services/recitersCatalog';
import { getFriendlyAudioErrorMessage } from '../services/audioSourceAdapter';
import { useAudioStore } from '../stores/useAudioStore';
import {
  AudioActionMode,
  PlaybackTarget,
  PlaybackVerse,
  SurahDownloadSummary,
} from '../types/audio.types';

interface AudioPickerModalProps {
  visible: boolean;
  ayah: SelectedAyahInfo | null;
  mode: AudioActionMode;
  db: SQLiteDatabase;
  onClose: () => void;
}

function formatStorageSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export const AudioPickerModal: React.FC<AudioPickerModalProps> = ({
  visible,
  ayah,
  mode,
  db,
  onClose,
}) => {
  const theme = useTheme();
  const selectedReciter = useAudioStore((state) => state.selectedReciter);
  const isDownloading = useAudioStore((state) => state.isDownloading);
  const downloadProgress = useAudioStore((state) => state.downloadProgress);
  const lastError = useAudioStore((state) => state.lastError);
  const setSelectedReciter = useAudioStore((state) => state.setSelectedReciter);
  const requestPlayback = useAudioStore((state) => state.requestPlayback);
  const startDownloadAndPlay = useAudioStore((state) => state.startDownloadAndPlay);
  const cancelDownload = useAudioStore((state) => state.cancelDownload);

  const [summary, setSummary] = useState<SurahDownloadSummary | null>(null);
  const [storageBytes, setStorageBytes] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const buildTarget = useCallback((): PlaybackTarget => {
    if (!ayah) throw new Error('لم يتم تحديد آية للتشغيل.');

    const ayahs = QuranRepository.getSurahAyahsSync(db, ayah.suraNo);
    if (ayahs.length === 0) {
      throw new Error('تعذر قراءة آيات السورة من قاعدة بيانات القرآن.');
    }

    const verses: PlaybackVerse[] = ayahs.map((row) => ({
      suraNo: row.sura_no,
      ayaNo: row.aya_no,
      globalAyahNo: QuranRepository.getGlobalAyahNumberSync(db, row.sura_no, row.aya_no),
    }));

    return {
      suraNo: ayah.suraNo,
      suraName: ayah.suraName,
      startAyah: ayah.ayaNo,
      endAyah: verses[verses.length - 1].ayaNo,
      verses,
    };
  }, [ayah, db]);

  const refreshDownloadSummary = useCallback(async () => {
    if (!visible || !ayah) {
      setSummary(null);
      return;
    }

    try {
      const target = buildTarget();
      const [nextSummary, totalBytes] = await Promise.all([
        AudioDownloader.getSurahDownloadSummary(selectedReciter, target.verses),
        AudioDownloader.getTotalDownloadedBytes(),
      ]);
      setSummary(nextSummary);
      setStorageBytes(totalBytes);
    } catch (error) {
      setSummary(null);
      setLocalError(
        getFriendlyAudioErrorMessage(error)
      );
    }
  }, [visible, ayah, selectedReciter, buildTarget]);

  useEffect(() => {
    if (visible) {
      setLocalError(null);
      void refreshDownloadSummary();
    }
  }, [visible, selectedReciter.id, refreshDownloadSummary]);

  const handleStart = async () => {
    if (!ayah || isPreparing || isDownloading) return;

    setIsPreparing(true);
    setLocalError(null);

    try {
      const target = buildTarget();
      const result = await requestPlayback(target, mode);

      if (result.needsDownload) {
        await startDownloadAndPlay(target, result.missingAyahs, mode);
      }

      const finalState = useAudioStore.getState();
      if (finalState.status === 'playing' || finalState.status === 'waiting_user_repeat') {
        onClose();
      } else if (finalState.status === 'error') {
        setLocalError(finalState.lastError || 'تعذر تشغيل التلاوة.');
        await refreshDownloadSummary();
      }
    } catch (error) {
      setLocalError(
        getFriendlyAudioErrorMessage(error)
      );
    } finally {
      setIsPreparing(false);
    }
  };

  const handleDeleteDownloads = () => {
    if (!ayah || isDownloading) return;

    Alert.alert(
      'حذف التنزيل',
      'سيتم حذف كل المقاطع المحفوظة لهذه السورة وهذا القارئ فقط. لن يؤثر ذلك على بقية السور.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            await AudioDownloader.deleteSurahDownloads(selectedReciter.id, ayah.suraNo);
            await refreshDownloadSummary();
          },
        },
      ]
    );
  };

  const progress = downloadProgress
    ? Math.min(1, Math.max(0, downloadProgress.percentage / 100))
    : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={isDownloading ? cancelDownload : onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={isDownloading ? undefined : onClose}
        />

        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.handle} />
          <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
                {mode === 'repeat' ? 'ترديد الآيات' : 'تشغيل التلاوة'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                سورة {ayah?.suraName} • البداية من الآية {toArabicNumerals(ayah?.ayaNo || 1)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={isDownloading ? cancelDownload : onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>{isDownloading ? 'إلغاء' : 'إغلاق'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>اختر القارئ</Text>

            {RECITERS.map((reciter) => {
              const selected = selectedReciter.id === reciter.id;
              return (
                <TouchableOpacity
                  key={reciter.id}
                  style={[styles.reciterRow, selected && styles.reciterRowSelected]}
                  onPress={() => setSelectedReciter(reciter)}
                  disabled={isDownloading || isPreparing}
                  activeOpacity={0.75}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.reciterText}>
                    <Text style={[styles.reciterName, selected && styles.selectedText]}>
                      {reciter.name}
                    </Text>
                    <Text style={styles.reciterSubtitle}>{reciter.subname}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.downloadSummary}>
              <Text style={styles.downloadSummaryText}>
                {summary
                  ? summary.allDownloaded
                    ? 'السورة محفوظة على جهازك دون اتصال'
                    : 'المحفوظ: ' + toArabicNumerals(summary.downloaded) + ' من ' + toArabicNumerals(summary.total) + ' آية'
                  : 'جاري فحص الملفات المحفوظة...'}
              </Text>
              {summary && summary.bytes > 0 ? (
                <Text style={styles.helperText}>
                  حجم هذه السورة والقارئ: {formatStorageSize(summary.bytes)}
                </Text>
              ) : null}
              <Text style={styles.helperText}>
                إجمالي مساحة الصوتيات المحفوظة: {formatStorageSize(storageBytes)}
              </Text>
              {summary && summary.bytes > 0 ? (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteDownloads}
                  disabled={isDownloading || isPreparing}
                >
                  <Text style={styles.deleteButtonText}>حذف ملفات هذه السورة</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {isDownloading ? (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressPercent}>
                    {toArabicNumerals(downloadProgress?.percentage || 0)}٪
                  </Text>
                  <Text style={styles.progressLabel}>جاري تنزيل المقاطع الصوتية</Text>
                </View>
                <ProgressBar progress={progress} color={QuranColors.gold} style={styles.progressBar} />
                <Text style={styles.helperText}>
                  {downloadProgress?.currentAyahName || 'جاري الاتصال بالخادم...'}
                </Text>
                <Text style={styles.helperText}>
                  {toArabicNumerals(downloadProgress?.current || 0)} / {toArabicNumerals(downloadProgress?.total || 0)} مقطع
                </Text>
              </View>
            ) : null}

            {isPreparing && !isDownloading ? (
              <View style={styles.preparing}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={styles.helperText}>جاري التحقق من الملفات...</Text>
              </View>
            ) : null}

            {localError || lastError ? (
              <Text style={styles.errorText}>{localError || lastError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.startButton, (isDownloading || isPreparing) && styles.disabledButton]}
              onPress={handleStart}
              disabled={isDownloading || isPreparing || !ayah}
              activeOpacity={0.8}
            >
              <Text style={styles.startButtonText} numberOfLines={1}>
                {summary?.allDownloaded ? 'تشغيل دون إنترنت' : 'تنزيل السورة وتشغيلها'}
              </Text>
            </TouchableOpacity>

            {isDownloading ? (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelDownload}>
                <Text style={styles.cancelButtonText}>إلغاء التنزيل</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingBottom: 24,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8D5CF',
    alignSelf: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: QuranColors.parchmentBorder,
  },
  headerText: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  title: {
    fontSize: 16,
    lineHeight: 26,
    color: QuranColors.emeraldDark,
    fontWeight: 'bold',
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  subtitle: {
    marginTop: 3,
    color: QuranColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  closeButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  closeText: {
    color: QuranColors.emerald,
    fontWeight: '600',
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 8,
    
  },
  sectionTitle: {
    color: QuranColors.emeraldDark,
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'start',
    writingDirection: 'rtl',
    marginTop: 4,
    marginBottom: 4,
  },
  reciterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: QuranColors.parchmentBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  reciterRowSelected: {
    borderColor: QuranColors.emerald,
    backgroundColor: 'rgba(31,81,63,0.06)',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: QuranColors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: QuranColors.emerald,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: QuranColors.emerald,
  },
  reciterText: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 2,
    alignItems: 'stretch',
  },
  reciterName: {
    fontSize: 14,
    color: QuranColors.textDark,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  reciterSubtitle: {
    fontSize: 11,
    marginTop: 2,
    color: QuranColors.textMuted,
    lineHeight: 18,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  selectedText: {
    color: QuranColors.emerald,
  },
  repeatSection: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: QuranColors.parchment,
    gap: 7,
  },
  optionLabel: {
    textAlign: 'auto'
,
    writingDirection: 'rtl',
    fontSize: 12,
    color: QuranColors.textMuted,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 7,
    flexWrap: 'wrap',
  },
  option: {
    minWidth: 46,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: QuranColors.parchmentBorder,
    borderRadius: 8,
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: QuranColors.emerald,
    backgroundColor: 'rgba(31,81,63,0.10)',
  },
  optionText: {
    color: QuranColors.textDark,
    fontWeight: '600',
    fontSize: 12,
  },
  optionTextSelected: {
    color: QuranColors.emerald,
  },
  helperText: {
    color: QuranColors.textMuted,
    fontSize: 11,
    textAlign: 'start',
    writingDirection: 'rtl',
    marginTop: 3,
  },
  downloadSummary: {
    padding: 12,
    borderWidth: 1,
    borderColor: QuranColors.parchmentBorder,
    borderRadius: 10,
    marginTop: 8,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  downloadSummaryText: {
    color: QuranColors.emeraldDark,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  deleteButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  deleteButtonText: {
    color: '#B23A3A',
    fontSize: 12,
    fontWeight: '600',
  },
  progressSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: QuranColors.parchment,
    borderRadius: 10,
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 14,
    color: QuranColors.emerald,
    fontWeight: 'bold',
  },
  progressLabel: {
    fontSize: 12,
    color: QuranColors.textDark,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(197,155,39,0.2)',
  },
  preparing: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  errorText: {
    color: '#B23A3A',
    textAlign: 'auto'
,
    writingDirection: 'rtl',
    fontSize: 12,
    marginTop: 6,
  },
  startButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: QuranColors.emerald,
  },
  disabledButton: {
    opacity: 0.5,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#B23A3A',
    fontWeight: '600',
  },
});
