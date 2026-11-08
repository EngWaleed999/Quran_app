import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { AppText as Text } from '../../../core/theme/components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QuranColors } from '../../../core/theme/theme';
import { useTheme } from 'react-native-paper';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';

interface PageHeaderProps {
  surahNames?: string[];
  surahName?: string;
  jozzNumber: number;
  pageNumber?: number;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenSurahList: () => void;
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
  controlsAnim,
  isControlsVisible,
}) => {
  const theme = useTheme();
  const names = useMemo(() => {
    const source = surahNames && surahNames.length > 0
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
    <View style={[styles.container, !isControlsVisible && styles.compactContainer]}>
      <View style={[styles.topRow, !isControlsVisible && styles.compactTopRow]}>
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
            <MaterialCommunityIcons name="format-list-bulleted" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.centerMetadata}>
          <Text style={[styles.textSide, !isControlsVisible && styles.compactTextSide, { color: theme.colors.onSurfaceVariant }]}>
            الجزء {toArabicNumerals(jozzNumber)}
          </Text>

          <View style={[styles.surahBadge, !isControlsVisible && styles.compactSurahBadge]}>
            <Text
              style={[
                styles.surahText,
                {
                  fontSize: isControlsVisible ? surahFontSize : Math.min(surahFontSize, 11),
                  color: theme.colors.primary,
                },
              ]}
              numberOfLines={names.length <= 2 ? 2 : 3}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {formattedSurahTitle}
            </Text>
          </View>

          <Text style={[styles.textSide, !isControlsVisible && styles.compactTextSide, { color: theme.colors.onSurfaceVariant }]}>
            {pageNumber ? 'صفحة ' + toArabicNumerals(pageNumber) : 'الحزب ' + toArabicNumerals(Math.ceil(jozzNumber * 2))}
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
            <MaterialCommunityIcons name="magnify" size={21} color={theme.colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onOpenSettings}
            accessibilityLabel="الإعدادات"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {isControlsVisible ? (
        <View style={styles.separatorContainer}>
          <View style={[styles.line, { backgroundColor: theme.colors.outline }]} />
          <View style={styles.diamond} />
          <View style={[styles.line, { backgroundColor: theme.colors.outline }]} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 2,
    backgroundColor: 'transparent',
  },
  compactContainer: {
    paddingTop: 1,
    paddingBottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 42,
    position: 'relative',
  },
  compactTopRow: {
    minHeight: 28,
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
    backgroundColor: 'rgba(31, 81, 63, 0.07)',
  },
  centerMetadata: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    maxWidth: '100%',
  },
  textSide: {
    fontSize: 12,
    fontWeight: 'bold',
    flexShrink: 0,
  },
  compactTextSide: {
    fontSize: 10,
  },
  surahBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(31, 81, 63, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(31, 81, 63, 0.15)',
    maxWidth: '42%',
    minWidth: 72,
    flexShrink: 1,
  },
  compactSurahBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 64,
  },
  surahText: {
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 17,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 1,
  },
  line: {
    flex: 1,
    height: 1,
  },
  diamond: {
    width: 6,
    height: 6,
    backgroundColor: QuranColors.gold,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: 8,
  },
});
