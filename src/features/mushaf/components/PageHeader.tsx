import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';

interface PageHeaderProps {
  surahName: string;
  jozzNumber: number;
  pageNumber?: number;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenSurahList: () => void;
  controlsAnim: Animated.Value;
  isControlsVisible: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  surahName,
  jozzNumber,
  pageNumber,
  onOpenSearch,
  onOpenSettings,
  onOpenSurahList,
  controlsAnim,
  isControlsVisible,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* Right Action Button (List Navig Drawer) - Animated Fade */}
        <Animated.View
          style={[styles.rightActions, { opacity: controlsAnim }]}
          pointerEvents={isControlsVisible ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onOpenSurahList}
            accessibilityLabel="فهرس السور"
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="format-list-bulleted"
              size={22}
              color={QuranColors.emerald}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Center: Surah metadata - Always visible and centered (Zero Layout Shift) */}
        <View style={styles.centerMetadata}>
          <Text style={styles.textSide}>
            الجزء {toArabicNumerals(jozzNumber)}
          </Text>

          <View style={styles.surahBadge}>
            <Text style={styles.surahText}>
              سورة {surahName}
            </Text>
          </View>

          <Text style={styles.textSide}>
            {pageNumber ? `صفحة ${toArabicNumerals(pageNumber)}` : `الحزب ${toArabicNumerals(Math.ceil(jozzNumber * 2))}`}
          </Text>
        </View>

        {/* Left Action Buttons (Search & Settings) - Animated Fade */}
        <Animated.View
          style={[styles.leftActions, { opacity: controlsAnim }]}
          pointerEvents={isControlsVisible ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onOpenSearch}
            accessibilityLabel="البحث في المصحف"
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={22}
              color={QuranColors.emerald}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onOpenSettings}
            accessibilityLabel="الإعدادات"
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="cog-outline"
              size={22}
              color={QuranColors.emerald}
            />
          </TouchableOpacity>
        </Animated.View>
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
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
    backgroundColor: 'transparent',
  },
  topRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 40,
    position: 'relative',
  },
  rightActions: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  leftActions: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(31, 81, 63, 0.06)',
  },
  centerMetadata: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  textSide: {
    fontSize: 13,
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
    fontSize: 15,
    color: QuranColors.emerald,
    fontWeight: 'bold',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 2,
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
