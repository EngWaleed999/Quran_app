import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { QuranColors } from '../../../core/theme/theme';

interface SurahBannerProps {
  surahName: string;
  suraNo: number;
}

export const SurahBanner: React.FC<SurahBannerProps> = ({ surahName, suraNo }) => {
  const showBasmala = suraNo !== 1 && suraNo !== 9;

  return (
    <View style={styles.container}>
      {/* Decorative Ornate Header Box */}
      <View style={styles.bannerOuter}>
        <View style={styles.bannerInner}>
          <Text style={styles.cornerOrnament}>✤</Text>
          <Text style={styles.titleText}>سُورَةُ {surahName}</Text>
          <Text style={styles.cornerOrnament}>✤</Text>
        </View>
      </View>

      {/* Basmala */}
      {showBasmala && (
        <View style={styles.basmalaContainer}>
          <Text style={styles.basmalaText}>
            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    alignItems: 'center',
    width: '100%',
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
    paddingVertical: 3,
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
  basmalaContainer: {
    marginTop: 4,
    marginBottom: 2,
  },
  basmalaText: {
    fontSize: 18,
    color: QuranColors.textDark,
    textAlign: 'center',
    fontFamily: 'HafsSmart',
  },
});

