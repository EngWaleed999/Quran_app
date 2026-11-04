import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { QuranColors } from '../../../core/theme/theme';

interface SurahBannerProps {
  surahName: string;
  suraNo: number;
}

/**
 * Renders only the surah-name physical line.
 * The basmala is a separate QCF reserved line and is positioned independently,
 * which also handles headings that cross a page boundary.
 */
export const SurahBanner: React.FC<SurahBannerProps> = ({ surahName }) => (
  <View style={styles.container}>
    <View style={styles.bannerOuter}>
      <View style={styles.bannerInner}>
        <Text style={styles.cornerOrnament}>✤</Text>
        <Text style={styles.titleText}>سُورَةُ {surahName}</Text>
        <Text style={styles.cornerOrnament}>✤</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerOuter: {
    width: '96%',
    padding: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: QuranColors.gold,
    backgroundColor: 'rgba(197, 155, 39, 0.08)',
  },
  bannerInner: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: QuranColors.gold,
    backgroundColor: '#FFFDF9',
  },
  cornerOrnament: {
    fontSize: 14,
    color: QuranColors.gold,
  },
  titleText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
    textAlign: 'center',
  },
});
