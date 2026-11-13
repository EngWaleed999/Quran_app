// import React from 'react';
// import { View, StyleSheet, TouchableOpacity } from 'react-native';
// import { AppText as Text } from '../../../core/theme/components/AppText';
// import { ProgressBar } from 'react-native-paper';
// import { QuranColors } from '../../../core/theme/theme';
// import { useTheme } from 'react-native-paper';
// import { toArabicNumerals } from '../../../core/utils/arabicNumbers';

// interface PageBottomBarProps {
//   currentPage: number;
//   totalPages?: number;
//   onNextPage: () => void;
//   onPrevPage: () => void;
// }

// export const PageBottomBar: React.FC<PageBottomBarProps> = ({
//   currentPage,
//   totalPages = 604,
//   onNextPage,
//   onPrevPage,
// }) => {
//   const theme = useTheme();
//   const progress = currentPage / totalPages;

//   return (
//     <View style={[styles.container, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }]}>
//       {/* Visual Progress Bar (Inverted scaleX to fill from Right-to-Left matching authentic Quran order) */}
//       <View style={styles.progressWrapper}>
//         <ProgressBar
//           progress={progress}
//           color={theme.colors.secondary}
//           style={styles.progressBar}
//         />
//       </View>

//       <View style={styles.barContent}>
//         {/* Right: Previous Page Button (returns towards Page 1 on the right in RTL) */}
//         <TouchableOpacity
//           style={[styles.navButton, { backgroundColor: theme.colors.surfaceVariant }]}
//           onPress={onPrevPage}
//           disabled={currentPage <= 1}
//           accessibilityLabel="الصفحة السابقة"
//         >
//           <Text style={[styles.navButtonText, { color: theme.colors.primary }, currentPage <= 1 && styles.disabledText]}>
//             السابقة
//           </Text>
//         </TouchableOpacity>

//         {/* Center: Current Page indicator */}
//         <View style={styles.centerInfo}>
//           <Text style={[styles.pageText, { color: theme.colors.onSurface }]}>
//             صفحة {toArabicNumerals(currentPage)} من {toArabicNumerals(totalPages)}
//           </Text>
//         </View>

//         {/* Left: Next Page Button (advances towards Page 604 on the left in RTL) */}
//         <TouchableOpacity
//           style={[styles.navButton, { backgroundColor: theme.colors.surfaceVariant }]}
//           onPress={onNextPage}
//           disabled={currentPage >= totalPages}
//           accessibilityLabel="الصفحة التالية"
//         >
//           <Text style={[styles.navButtonText, { color: theme.colors.primary }, currentPage >= totalPages && styles.disabledText]}>
//             التالية
//           </Text>
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     backgroundColor: '#FFF8F0FF',
//     borderTopWidth: 1,
//     borderTopColor: QuranColors.parchmentBorder,
//     paddingBottom: 16,
//     paddingTop: 4,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: -2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 3,
//     elevation: 8,
//   },
//   progressWrapper: {
//     transform: [{ scaleX: -1 }],
//   },
//   progressBar: {
//     height: 3,
//     backgroundColor: 'rgba(197, 155, 39, 0.2)',
//   },
//   barContent: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingHorizontal: 16,
//     paddingTop: 8,
//   },
//   navButton: {
//     minWidth: 84,
//     minHeight: 44, // Generous touch target
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingHorizontal: 12,
//     borderRadius: 8,
//     backgroundColor: 'rgba(31, 81, 63, 0.08)',
//   },
//   navButtonText: {
//     fontSize: 15,
//     fontWeight: 'bold',
//     color: QuranColors.emerald,
//   },
//   disabledText: {
//     color: '#CCC',
//   },
//   centerInfo: {
//     alignItems: 'center',
//   },
//   pageText: {
//     fontSize: 15,
//     fontWeight: 'bold',
//     color: QuranColors.textDark,
//   },
// });

//================================================
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  View,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
} from 'react-native';

import { AppText as Text } from '../../../core/theme/components/AppText';
import { useTheme } from 'react-native-paper';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';

interface PageBottomBarProps {
  currentPage: number;
  totalPages?: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  onSeekPage: (page: number) => void | Promise<void>;
}

const THUMB_SIZE = 14;

export const PageBottomBar: React.FC<PageBottomBarProps> = ({
  currentPage,
  totalPages = 604,
  onNextPage,
  onPrevPage,
  onSeekPage,
}) => {
  const theme = useTheme();

  const widthRef = useRef(0);
  const currentPageRef = useRef(currentPage);
  const previewPageRef = useRef(currentPage);
  const onSeekPageRef = useRef(onSeekPage);

  const isDraggingRef = useRef(false);
  const seekRequestRef = useRef(0);

  const [trackWidth, setTrackWidth] = useState(0);
  const [previewPage, setPreviewPage] = useState(currentPage);
  const [isDragging, setIsDragging] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  onSeekPageRef.current = onSeekPage;

  useEffect(() => {
    currentPageRef.current = currentPage;

    if (!isDraggingRef.current) {
      previewPageRef.current = currentPage;
      setPreviewPage(currentPage);
    }
  }, [currentPage]);

  /**
   * Physical coordinate mapping:
   * Left  = Page 604
   * Right = Page 1
   *
   * لا نستخدم I18nManager أو scaleX هنا.
   */
  const updatePreviewFromX = useCallback(
    (locationX: number) => {
      const width = widthRef.current;

      if (width <= THUMB_SIZE) return;

      const usableWidth = width - THUMB_SIZE;

      const adjustedX = Math.max(
        0,
        Math.min(usableWidth, locationX - THUMB_SIZE / 2)
      );

      const ratioFromLeft = adjustedX / usableWidth;
      const ratioFromRight = 1 - ratioFromLeft;

      const nextPage = Math.max(
        1,
        Math.min(
          totalPages,
          1 + Math.round(ratioFromRight * (totalPages - 1))
        )
      );

      if (nextPage !== previewPageRef.current) {
        previewPageRef.current = nextPage;
        setPreviewPage(nextPage);
      }
    },
    [totalPages]
  );

  const finishSeek = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);

    const targetPage = previewPageRef.current;

    if (targetPage === currentPageRef.current) {
      return;
    }

    const requestId = ++seekRequestRef.current;

    setIsSeeking(true);

    Promise.resolve(onSeekPageRef.current(targetPage))
      .catch((error) => {
        console.warn('[PageBottomBar] Page navigation failed:', error);
      })
      .finally(() => {
        if (requestId === seekRequestRef.current) {
          setIsSeeking(false);
        }
      });
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event) => {
          isDraggingRef.current = true;
          setIsDragging(true);

          updatePreviewFromX(event.nativeEvent.locationX);
        },

        onPanResponderMove: (event) => {
          updatePreviewFromX(event.nativeEvent.locationX);
        },

        onPanResponderRelease: finishSeek,

        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          setIsDragging(false);

          previewPageRef.current = currentPageRef.current;
          setPreviewPage(currentPageRef.current);
        },
      }),
    [updatePreviewFromX, finishSeek]
  );

  const displayedPage =
    isDragging || isSeeking ? previewPage : currentPage;

  const usableWidth = Math.max(0, trackWidth - THUMB_SIZE);

  const progressRatio =
    totalPages > 1
      ? (displayedPage - 1) / (totalPages - 1)
      : 0;

  const thumbLeft = (1 - progressRatio) * usableWidth;
  const fillWidth = progressRatio * usableWidth;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
        },
      ]}
    >
      {/* منطقة لمس الشريط بالكامل */}
      <View
        style={styles.progressTouchArea}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;

          widthRef.current = width;
          setTrackWidth(width);
        }}
        {...panResponder.panHandlers}
      >
        {/* المسار الخلفي */}
        <View
          pointerEvents="none"
          style={[
            styles.trackBase,
            { backgroundColor: theme.colors.outline },
          ]}
        />

        {/* التقدم من اليمين إلى اليسار */}
        <View
          pointerEvents="none"
          style={[
            styles.trackFill,
            {
              right: THUMB_SIZE / 2,
              width: fillWidth,
              backgroundColor: theme.colors.secondary,
            },
          ]}
        />

        {/* المؤشر */}
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: thumbLeft,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.secondary,
            },
          ]}
        />
      </View>

      <View style={styles.barContent}>
        <TouchableOpacity
          style={[
            styles.navButton,
            { backgroundColor: theme.colors.surfaceVariant },
            currentPage <= 1 && styles.disabledButton,
          ]}
          onPress={onPrevPage}
          disabled={currentPage <= 1}
          activeOpacity={0.7}
          accessibilityLabel="الصفحة السابقة"
        >
          <Text style={[styles.navButtonText, { color: theme.colors.primary }]}>
            السابقة
          </Text>
        </TouchableOpacity>

        {/* رقم الصفحة يظهر هنا فقط، حتى أثناء السحب */}
        <View style={styles.centerInfo}>
          <Text
            style={[
              styles.pageText,
              { color: theme.colors.onSurface },
            ]}
          >
            صفحة {toArabicNumerals(displayedPage)} من{' '}
            {toArabicNumerals(totalPages)}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.navButton,
            { backgroundColor: theme.colors.surfaceVariant },
            currentPage >= totalPages && styles.disabledButton,
          ]}
          onPress={onNextPage}
          disabled={currentPage >= totalPages}
          activeOpacity={0.7}
          accessibilityLabel="الصفحة التالية"
        >
          <Text style={[styles.navButtonText, { color: theme.colors.primary }]}>
            التالية
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingBottom: 16,
    paddingTop: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 8,
  },

  progressTouchArea: {
    height: 32,
    marginHorizontal: 16,
    justifyContent: 'center',
  },

  trackBase: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: 4,
    borderRadius: 2,
  },

  trackFill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
  },

  thumb: {
    position: 'absolute',
    top: 9,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    elevation: 2,
  },

  barContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  navButton: {
    minWidth: 84,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  navButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },

  disabledButton: {
    opacity: 0.35,
  },

  centerInfo: {
    flex: 1,
    alignItems: 'center',
  },

  pageText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
});