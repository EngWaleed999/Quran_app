import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ProgressBar } from 'react-native-paper';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';

interface PageBottomBarProps {
  currentPage: number;
  totalPages?: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  fontSize: number;
  onIncreaseFontSize: () => void;
  onDecreaseFontSize: () => void;
}

export const PageBottomBar: React.FC<PageBottomBarProps> = ({
  currentPage,
  totalPages = 604,
  onNextPage,
  onPrevPage,
  fontSize,
  onIncreaseFontSize,
  onDecreaseFontSize,
}) => {
  const progress = currentPage / totalPages;

  return (
    <View style={styles.container}>
      {/* Visual Progress Bar (Inverted scaleX to fill from Right-to-Left matching authentic Quran order) */}
      <View style={styles.progressWrapper}>
        <ProgressBar
          progress={progress}
          color={QuranColors.gold}
          style={styles.progressBar}
        />
      </View>

      <View style={styles.barContent}>
        {/* Left: Next Page Button (advances towards Page 604 on the left) */}
       

        {/* Center: Current Page indicator & Font sizing controls */}
      

        {/* Right: Previous Page Button (returns towards Page 1 on the right) */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={onPrevPage}
          disabled={currentPage <= 1}
          accessibilityLabel="الصفحة السابقة"
        >
          <Text style={[styles.navButtonText, currentPage <= 1 && styles.disabledText]}>
            السابقة 
          </Text>
        </TouchableOpacity>


          <View style={styles.centerInfo}>
          <Text style={styles.pageText}>
            صفحة {toArabicNumerals(currentPage)} من {toArabicNumerals(totalPages)}
          </Text>

          {/* Quick font sizing controls for elderly comfort */}
          <View style={styles.fontSizeControls}>
            <TouchableOpacity
              style={styles.fontBtn}
              onPress={onDecreaseFontSize}
              disabled={fontSize <= 16}
            >
              <Text style={styles.fontBtnText}>أ-</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fontBtn}
              onPress={onIncreaseFontSize}
              disabled={fontSize >= 36}
            >
              <Text style={styles.fontBtnText}>أ+</Text>
            </TouchableOpacity>
          </View>
        </View>

         <TouchableOpacity
          style={styles.navButton}
          onPress={onNextPage}
          disabled={currentPage >= totalPages}
          accessibilityLabel="الصفحة التالية"
        >
          <Text style={[styles.navButtonText, currentPage >= totalPages && styles.disabledText]}>
             التالية
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
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
    minHeight: 44, // Generous touch target for elderly
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
  fontSizeControls: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  fontBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: QuranColors.parchment,
    borderWidth: 1,
    borderColor: QuranColors.parchmentBorder,
  },
  fontBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: QuranColors.textMuted,
  },
});
