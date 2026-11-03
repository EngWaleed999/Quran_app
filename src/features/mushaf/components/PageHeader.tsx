import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';

interface PageHeaderProps {
  surahName: string;
  jozzNumber: number;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ surahName, jozzNumber }) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Juz Info */}
        <Text style={styles.textSide}>
          الجزء {toArabicNumerals(jozzNumber)}
        </Text>

        {/* Surah Name */}
        <View style={styles.surahBadge}>
          <Text style={styles.surahText}>
            سورة {surahName}
          </Text>
        </View>

        {/* Placeholder for symmetry / Bookmark indicator */}
        <Text style={styles.textSide}>
          {/* يمكن إضافة الحزب هنا لاحقاً */}
          الحزب {toArabicNumerals(Math.ceil(jozzNumber * 2))}
        </Text>
      </View>

      {/* Elegant Islamic Separator line */}
      <View style={styles.separatorContainer}>
        <View style={styles.line} />
        <View style={styles.diamond} />
        <View style={styles.line} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textSide: {
    fontSize: 14,
    color: QuranColors.textMuted,
    fontFamily: 'System',
    fontWeight: '600',
  },
  surahBadge: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(31, 81, 63, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(31, 81, 63, 0.15)',
  },
  surahText: {
    fontSize: 16,
    color: QuranColors.emerald,
    fontWeight: 'bold',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: QuranColors.parchmentBorder,
  },
  diamond: {
    width: 6,
    height: 6,
    backgroundColor: QuranColors.gold,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: 8,
  },
});

