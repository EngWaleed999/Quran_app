import React, { useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';

interface PageHeaderProps {
  surahNames?: string[];
  surahName?: string;
  jozzNumber: number;
  pageNumber?: number;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenSurahList: () => void;
  onOpenBookmarks: () => void;
  onOpenNotes: () => void;
  onOpenKhatmah: () => void;
  controlsAnim: Animated.Value;
  isControlsVisible: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  surahNames,
  surahName,
  jozzNumber,
  pageNumber,
  onOpenSearch,
  onOpenSettings,
  onOpenSurahList,
  onOpenBookmarks,
  onOpenNotes,
  onOpenKhatmah,
  controlsAnim,
  isControlsVisible,
}) => {
  const names = useMemo(() => {
    const source =
      surahNames && surahNames.length > 0
        ? surahNames
        : surahName
          ? [surahName]
          : [];

    return source.filter((name, index) => name && source.indexOf(name) === index);
  }, [surahNames, surahName]);

  const formattedSurahTitle = useMemo(() => {
    if (names.length === 0) return '';
    if (names.length === 1) return 'سورة ' + names[0];
    return 'السور: ' + names.join(' • ');
  }, [names]);

  const surahFontSize = names.length <= 1 ? 14 : names.length === 2 ? 12.5 : 11.5;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
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
          <TouchableOpacity style={styles.iconBtn} onPress={onOpenBookmarks} accessibilityLabel="الفواصل المحفوظة" hitSlop={8}>
            <MaterialCommunityIcons name="bookmark-multiple-outline" size={21} color={QuranColors.emerald} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={onOpenNotes} accessibilityLabel="ملاحظاتي" hitSlop={8}>
            <MaterialCommunityIcons name="note-text-outline" size={21} color={QuranColors.emerald} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={onOpenKhatmah} accessibilityLabel="ختمتي" hitSlop={8}>
            <MaterialCommunityIcons name="book-check-outline" size={21} color={QuranColors.emerald} />
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.centerMetadata}>
          <Text style={styles.textSide}>
            الجزء {toArabicNumerals(jozzNumber)}
          </Text>

          <View style={styles.surahBadge}>
            <Text
              style={[styles.surahText, { fontSize: surahFontSize }]}
              numberOfLines={names.length <= 2 ? 2 : 3}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {formattedSurahTitle}
            </Text>
          </View>

          <Text style={styles.textSide}>
            {pageNumber
              ? 'صفحة ' + toArabicNumerals(pageNumber)
              : 'الحزب ' + toArabicNumerals(Math.ceil(jozzNumber * 2))}
          </Text>
        </View>

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
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    backgroundColor: 'transparent',
  },
  topRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 42,
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
    gap: 4,
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
    gap: 7,
    maxWidth: '100%',
  },
  textSide: {
    fontSize: 12,
    color: QuranColors.textMuted,
    fontFamily: 'System',
    fontWeight: '600',
    flexShrink: 0,
  },
  surahBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(31, 81, 63, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(31, 81, 63, 0.15)',
    maxWidth: '48%',
    minWidth: 82,
    flexShrink: 1,
  },
  surahText: {
    color: QuranColors.emerald,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 17,
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
