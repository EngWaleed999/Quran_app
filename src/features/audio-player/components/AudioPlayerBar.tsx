import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';
import { AppText as Text } from '../../../core/theme/components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProgressBar } from 'react-native-paper';
import { useAudioStore } from '../stores/useAudioStore';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';
import { AudioSettingsModal } from './AudioSettingsModal';
import { useTheme } from 'react-native-paper';

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
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const theme = useTheme();
  // Keep subscriptions granular; position ticks should not rerender unrelated controls.
  const status = useAudioStore((state) => state.status);
  const activeMode = useAudioStore((state) => state.activeMode);
  const target = useAudioStore((state) => state.target);
  const selectedReciter = useAudioStore((state) => state.selectedReciter);
  const activeAyah = useAudioStore((state) => state.activeAyah);
  const countdown = useAudioStore((state) => state.countdown);
  const pendingDelayKind = useAudioStore((state) => state.pendingDelayKind);
  const positionSeconds = useAudioStore((state) => state.positionSeconds);
  const durationSeconds = useAudioStore((state) => state.durationSeconds);
  const lastError = useAudioStore((state) => state.lastError);
  const togglePlayback = useAudioStore((state) => state.togglePlayback);
  const nextAyah = useAudioStore((state) => state.nextAyah);
  const previousAyah = useAudioStore((state) => state.previousAyah);
  const stop = useAudioStore((state) => state.stop);

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
    const waitLabel = pendingDelayKind === 'verse-gap'
      ? 'الآية التالية بعد '
      : 'إعادة الآية بعد ';
    statusText = waitLabel + toArabicNumerals(countdown) + ' ث';
  }
  if (status === 'completed') statusText = 'اكتملت التلاوة';
  if (status === 'error') statusText = lastError || 'تعذر تشغيل الصوت';

  return (
    <>
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }]}>
      <View style={styles.header}>
        <View style={styles.trackInfo}>
          <Text style={[styles.surahName, { color: theme.colors.primary }]} numberOfLines={1}>
            {target.suraName} • {selectedReciter.name}
          </Text>
          <Text style={[styles.trackStatus, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {activeAyah
              ? 'الآية ' + toArabicNumerals(activeAyah.ayaNo) + ' • ' + statusText
              : statusText}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.stopButton}
          onPress={() => setIsSettingsVisible(true)}
          accessibilityLabel="إعدادات التلاوة والترديد"
        >
          <MaterialCommunityIcons name="cog-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.stopButton}
          onPress={() => void stop()}
          accessibilityLabel="إيقاف التلاوة"
        >
          <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <ProgressBar
        progress={progress}
        color={theme.colors.secondary}
        style={styles.progress}
      />

      <View style={styles.controls}>
        <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>{formatTime(positionSeconds)}</Text>

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
              color={theme.colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => void togglePlayback()}
            disabled={status === 'downloading' || status === 'checking_files' || status === 'completed'}
            accessibilityLabel={status === 'paused' ? 'استئناف التلاوة' : 'إيقاف مؤقت'}
          >
            <MaterialCommunityIcons
              name={status === 'paused' ? 'play' : 'pause'}
              size={23}
              color={theme.colors.onPrimary}
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

        <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>{formatTime(durationSeconds)}</Text>
      </View>
    </View>
    <AudioSettingsModal
      visible={isSettingsVisible}
      mode={activeMode}
      onClose={() => setIsSettingsVisible(false)}
    />
    </>
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
    flexDirection: 'row',
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
        textAlign: 'start'
,
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
