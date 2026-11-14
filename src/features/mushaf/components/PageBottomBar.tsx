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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
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

const THUMB_SIZE = 18;
const TOUCH_HORIZONTAL_MARGIN = 16;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

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
  const dragStartLeftRef = useRef(0);

  // These values move immediately with the finger. They prevent the thumb from
  // waiting for a React render on every move event.
  const thumbX = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  const [trackWidth, setTrackWidth] = useState(0);
  const [previewPage, setPreviewPage] = useState(currentPage);
  const [isDragging, setIsDragging] = useState(false);

  onSeekPageRef.current = onSeekPage;

  // The thumb travels from its left edge at x=0 to the end of the track.
  const travelWidth = Math.max(0, trackWidth - THUMB_SIZE);

  const pageToRatio = useCallback(
    (page: number) => {
      if (totalPages <= 1) return 0;
      return clamp((page - 1) / (totalPages - 1), 0, 1);
    },
    [totalPages]
  );

  const setVisualPosition = useCallback(
    (left: number) => {
      const safeLeft = clamp(left, 0, travelWidth);
      const ratioFromLeft = travelWidth > 0 ? safeLeft / travelWidth : 0;

      // No animation is intentional: this keeps the thumb exactly under the
      // finger instead of adding lag or an elastic/jittery effect.
      thumbX.setValue(safeLeft);
      progress.setValue(1 - ratioFromLeft);
    },
    [progress, thumbX, travelWidth]
  );

  const pageFromLeft = useCallback(
    (left: number) => {
      const safeLeft = clamp(left, 0, travelWidth);
      const ratioFromLeft = travelWidth > 0 ? safeLeft / travelWidth : 0;
      const ratioFromRight = 1 - ratioFromLeft;

      const page = clamp(
        1 + Math.round(ratioFromRight * (totalPages - 1)),
        1,
        totalPages
      );

      return { page, safeLeft };
    },
    [totalPages, travelWidth]
  );

  const updateFromLeft = useCallback(
    (left: number) => {
      if (travelWidth <= 0) return;

      const { page, safeLeft } = pageFromLeft(left);
      setVisualPosition(safeLeft);

      if (page !== previewPageRef.current) {
        previewPageRef.current = page;
        setPreviewPage(page);
      }
    },
    [pageFromLeft, setVisualPosition, travelWidth]
  );

  useEffect(() => {
    currentPageRef.current = currentPage;

    if (!isDraggingRef.current) {
      previewPageRef.current = currentPage;
      setPreviewPage(currentPage);

      const ratioFromRight = pageToRatio(currentPage);
      setVisualPosition((1 - ratioFromRight) * travelWidth);
    }
  }, [currentPage, pageToRatio, setVisualPosition, travelWidth]);

  const finishSeek = useCallback(() => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    setIsDragging(false);

    const targetPage = previewPageRef.current;
    if (targetPage === currentPageRef.current) return;

    const requestId = ++seekRequestRef.current;
    Promise.resolve(onSeekPageRef.current(targetPage)).catch((error) => {
      console.warn('[PageBottomBar] Page navigation failed:', error);
    }).finally(() => {
      // The request id prevents an older async navigation from affecting a
      // newer drag. The parent remains the source of truth for currentPage.
      if (requestId !== seekRequestRef.current) return;
    });
  }, []);

  const cancelSeek = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
    previewPageRef.current = currentPageRef.current;
    setPreviewPage(currentPageRef.current);

    const ratioFromRight = pageToRatio(currentPageRef.current);
    setVisualPosition((1 - ratioFromRight) * travelWidth);
  }, [pageToRatio, setVisualPosition, travelWidth]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // The entire bar is a slider, including empty space around the thumb.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event) => {
          isDraggingRef.current = true;
          setIsDragging(true);

          // Capture the exact starting point once. During movement we use dx,
          // which is stable and prevents locationX-related jumps at the middle
          // or the end of the track.
          dragStartLeftRef.current = clamp(
            event.nativeEvent.locationX - THUMB_SIZE / 2,
            0,
            travelWidth
          );
          updateFromLeft(dragStartLeftRef.current);
        },

        onPanResponderMove: (_event, gestureState) => {
          updateFromLeft(dragStartLeftRef.current + gestureState.dx);
        },

        onPanResponderRelease: finishSeek,
        onPanResponderTerminate: cancelSeek,
      }),
    [cancelSeek, finishSeek, travelWidth, updateFromLeft]
  );

  const displayedPage = isDragging ? previewPage : currentPage;
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
      <View
        style={styles.progressTouchArea}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          if (width === widthRef.current) return;

          widthRef.current = width;
          setTrackWidth(width);
        }}
        {...panResponder.panHandlers}
      >
        <View
          pointerEvents="none"
          style={[styles.trackBase, { backgroundColor: theme.colors.outline }]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.trackFill,
            {
              right: THUMB_SIZE / 2,
              backgroundColor: theme.colors.secondary,
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.max(0, travelWidth)],
              }),
            },
          ]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.secondary,
              transform: [{ translateX: thumbX }],
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
          <Text style={[styles.navButtonText, { color: theme.colors.primary }]}>السابقـة</Text>
        </TouchableOpacity>

        <View style={styles.centerInfo}>
          <Text style={[styles.pageText, { color: theme.colors.onSurface }]}>
            صفحة {toArabicNumerals(displayedPage)} من {toArabicNumerals(totalPages)}
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
          <Text style={[styles.navButtonText, { color: theme.colors.primary }]}>التالية</Text>
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
    height: 42,
    marginHorizontal: TOUCH_HORIZONTAL_MARGIN,
    justifyContent: 'center',
    // Physical direction is fixed and must not depend on the device locale.
    direction: 'ltr',
  },
  trackBase: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: 6,
    borderRadius: 3,
  },
  trackFill: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: 12,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
  },
  barContent: {
    flexDirection: 'row',
    direction: 'ltr',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
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
