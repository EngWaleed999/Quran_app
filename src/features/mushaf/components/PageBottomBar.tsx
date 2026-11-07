import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text } from '../../../core/theme/components/AppText';
import { ProgressBar } from 'react-native-paper';
import { QuranColors } from '../../../core/theme/theme';
import { useTheme } from 'react-native-paper';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';

interface PageBottomBarProps {
  currentPage: number;
  totalPages?: number;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export const PageBottomBar: React.FC<PageBottomBarProps> = ({
  currentPage,
  totalPages = 604,
  onNextPage,
  onPrevPage,
}) => {
  const theme = useTheme();
  const progress = currentPage / totalPages;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }]}>
      {/* Visual Progress Bar (Inverted scaleX to fill from Right-to-Left matching authentic Quran order) */}
      <View style={styles.progressWrapper}>
        <ProgressBar
          progress={progress}
          color={theme.colors.secondary}
          style={styles.progressBar}
        />
      </View>

      <View style={styles.barContent}>
        {/* Right: Previous Page Button (returns towards Page 1 on the right in RTL) */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={onPrevPage}
          disabled={currentPage <= 1}
          accessibilityLabel="الصفحة السابقة"
        >
          <Text style={[styles.navButtonText, { color: theme.colors.primary }, currentPage <= 1 && styles.disabledText]}>
            السابقة
          </Text>
        </TouchableOpacity>

        {/* Center: Current Page indicator */}
        <View style={styles.centerInfo}>
          <Text style={[styles.pageText, { color: theme.colors.onSurface }]}>
            صفحة {toArabicNumerals(currentPage)} من {toArabicNumerals(totalPages)}
          </Text>
        </View>

        {/* Left: Next Page Button (advances towards Page 604 on the left in RTL) */}
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: theme.colors.surfaceVariant }]}
          onPress={onNextPage}
          disabled={currentPage >= totalPages}
          accessibilityLabel="الصفحة التالية"
        >
          <Text style={[styles.navButtonText, { color: theme.colors.primary }, currentPage >= totalPages && styles.disabledText]}>
            التالية
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF8F0FF',
    borderTopWidth: 1,
    borderTopColor: QuranColors.parchmentBorder,
    paddingBottom: 16,
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 8,
  },
  progressWrapper: {
    transform: [{ scaleX: -1 }],
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(197, 155, 39, 0.2)',
  },
  barContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  navButton: {
    minWidth: 84,
    minHeight: 44, // Generous touch target
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(31, 81, 63, 0.08)',
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: QuranColors.emerald,
  },
  disabledText: {
    color: '#CCC',
  },
  centerInfo: {
    alignItems: 'center',
  },
  pageText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: QuranColors.textDark,
  },
});
