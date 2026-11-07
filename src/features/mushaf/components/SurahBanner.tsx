import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { AppText as Text } from '../../../core/theme/components/AppText';
import { useTheme } from 'react-native-paper';
import { QuranColors } from '../../../core/theme/theme';

interface SurahBannerProps {
  surahName: string;
  suraNo: number;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Renders the ornate surah-name banner.
 * Supports both light and dark themes with native responsiveness.
 */
export const SurahBanner: React.FC<SurahBannerProps> = ({ surahName, containerStyle }) => {
  const theme = useTheme();
  const isDark = theme.dark;

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.bannerOuter, isDark && styles.bannerOuterDark]}>
        <View style={[styles.bannerInner, isDark && styles.bannerInnerDark]}>
          <Text style={[styles.cornerOrnament, isDark && styles.cornerOrnamentDark]}>✤</Text>
          <Text style={[styles.titleText, isDark && styles.titleTextDark]}>سُورَةُ {surahName}</Text>
          <Text style={[styles.cornerOrnament, isDark && styles.cornerOrnamentDark]}>✤</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  bannerOuter: {
    width: '96%',
    padding: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: QuranColors.gold,
    backgroundColor: 'rgba(197, 155, 39, 0.08)',
  },
  bannerOuterDark: {
    borderColor: QuranColors.goldLight,
    backgroundColor: 'rgba(229, 192, 88, 0.08)',
  },
  bannerInner: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: QuranColors.gold,
    backgroundColor: '#FFFDF9',
  },
  bannerInnerDark: {
    borderColor: QuranColors.goldLight,
    backgroundColor: QuranColors.nightSurface,
  },
  cornerOrnament: {
    fontSize: 14,
    color: QuranColors.gold,
  },
  cornerOrnamentDark: {
    color: QuranColors.goldLight,
  },
  titleText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
    textAlign: 'center',
  },
  titleTextDark: {
    color: QuranColors.goldLight,
  },
});
