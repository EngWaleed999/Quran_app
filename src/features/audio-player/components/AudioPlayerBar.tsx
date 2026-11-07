import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProgressBar } from 'react-native-paper';
import { useAudioStore } from '../stores/useAudioStore';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return (
    String(minutes).padStart(2, '0') +
    ':' +
    String(remainingSeconds).padStart(2, '0')
  );
}

export const AudioPlayerBar: React.FC = () => {
  const {
    status,
    target,
    selectedReciter,
    activeAyah,
    countdown,
    positionSeconds,
    durationSeconds,
    lastError,
    togglePlayback,
    nextAyah,
    previousAyah,
    stop,
  } = useAudioStore();

  if (!target || status === 'idle') return null;

  const progress =
    durationSeconds > 0
      ? Math.min(1, Math.max(0, positionSeconds / durationSeconds))
      : 0;

  let statusText = 'جاري التلاوة';
  if (status === 'checking_files') statusText = 'التحقق من الملفات...';
  if (status === 'downloading') statusText = 'جاري تنزيل السورة...';
  if (status === 'paused') statusText = 'متوقف مؤقتاً';
  if (status === 'waiting_user_repeat') {
    statusText = 'إعادة الآية بعد ' + toArabicNumerals(countdown) + ' ث';
  }
  if (status === 'completed') statusText = 'اكتملت التلاوة';
  if (status === 'error') statusText = lastError || 'تعذر تشغيل الصوت';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.trackInfo}>
          <Text style={styles.surahName} numberOfLines={1}>
            {target.suraName} • {selectedReciter.name}
          </Text>
          <Text style={styles.trackStatus} numberOfLines={1}>
            {activeAyah
              ? 'الآية ' + toArabicNumerals(activeAyah.ayaNo) + ' • ' + statusText
              : statusText}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.stopButton}
          onPress={() => void stop()}
          accessibilityLabel="إيقاف التلاوة"
        >
          <MaterialCommunityIcons name="close" size={20} color={QuranColors.textMuted} />
        </TouchableOpacity>
      </View>

      <ProgressBar
        progress={progress}
        color={QuranColors.gold}
        style={styles.progress}
      />

      <View style={styles.controls}>
        <Text style={styles.timeText}>{formatTime(positionSeconds)}</Text>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => void previousAyah()}
            disabled={status === 'downloading' || status === 'checking_files'}
            accessibilityLabel="الآية السابقة"
          >
            <MaterialCommunityIcons
              name="skip-previous"
              size={25}
              color={QuranColors.emerald}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={() => void togglePlayback()}
            disabled={status === 'downloading' || status === 'checking_files' || status === 'completed'}
            accessibilityLabel={status === 'paused' ? 'استئناف التلاوة' : 'إيقاف مؤقت'}
          >
            <MaterialCommunityIcons
              name={status === 'paused' ? 'play' : 'pause'}
              size={23}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => void nextAyah()}
            disabled={status === 'downloading' || status === 'checking_files'}
            accessibilityLabel="الآية التالية"
          >
            <MaterialCommunityIcons
              name="skip-next"
              size={25}
              color={QuranColors.emerald}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.timeText}>{formatTime(durationSeconds)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF8F0FF',
    borderTopWidth: 1,
    borderTopColor: QuranColors.parchmentBorder,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 8,
  },
  header: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  trackInfo: {
    flex: 1,
    alignItems: I18nManager.isRTL ? 'flex-start' : 'flex-end',
  },
  surahName: {
    color: QuranColors.emeraldDark,
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  trackStatus: {
    color: QuranColors.textMuted,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stopButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  progress: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(197, 155, 39, 0.18)',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  controlButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: QuranColors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 10,
    color: QuranColors.textMuted,
    minWidth: 34,
    textAlign: 'center',
  },
});
