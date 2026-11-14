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

 
const SURAH_PAGE_RANGES: { name: string; start: number; end: number }[] = [
  { name: 'الفَاتِحة', start: 1, end: 1 },
  { name: 'البَقَرَة', start: 2, end: 49 },
  { name: 'آل عِمران', start: 50, end: 76 },
  { name: 'النِّسَاء', start: 77, end: 106 },
  { name: 'المَائدة', start: 106, end: 127 },
  { name: 'الأنعَام', start: 128, end: 150 },
  { name: 'الأعرَاف', start: 151, end: 176 },
  { name: 'الأنفَال', start: 177, end: 186 },
  { name: 'التوبَة', start: 187, end: 207 },
  { name: 'يُونس', start: 208, end: 221 },
  { name: 'هُود', start: 221, end: 235 },
  { name: 'يُوسُف', start: 235, end: 248 },
  { name: 'الرَّعد', start: 249, end: 255 },
  { name: 'إبراهِيم', start: 255, end: 261 },
  { name: 'الحِجر', start: 262, end: 267 },
  { name: 'النَّحل', start: 267, end: 281 },
  { name: 'الإسرَاء', start: 282, end: 293 },
  { name: 'الكَهف', start: 293, end: 304 },
  { name: 'مَريَم', start: 305, end: 312 },
  { name: 'طه', start: 312, end: 321 },
  { name: 'الأنبيَاء', start: 322, end: 331 },
  { name: 'الحج', start: 332, end: 341 },
  { name: 'المؤمنُون', start: 342, end: 349 },
  { name: 'النور', start: 350, end: 359 },
  { name: 'الفُرقَان', start: 359, end: 366 },
  { name: 'الشعراء', start: 367, end: 376 },
  { name: 'النَّمل', start: 377, end: 385 },
  { name: 'القَصَص', start: 385, end: 396 },
  { name: 'العَنكبُوت', start: 396, end: 404 },
  { name: 'الرُّوم', start: 404, end: 410 },
  { name: 'لُقمَان', start: 411, end: 414 },
  { name: 'السَّجدة', start: 415, end: 417 },
  { name: 'الأحزَاب', start: 418, end: 427 },
  { name: 'سَبإ', start: 428, end: 434 },
  { name: 'فَاطِر', start: 434, end: 440 },
  { name: 'يسٓ', start: 440, end: 445 },
  { name: 'الصَّافَات', start: 446, end: 452 },
  { name: 'صٓ', start: 453, end: 458 },
  { name: 'الزُّمَر', start: 458, end: 467 },
  { name: 'غَافِر', start: 467, end: 476 },
  { name: 'فُصِّلَت', start: 477, end: 482 },
  { name: 'الشُّورى', start: 483, end: 489 },
  { name: 'الزُّخرُف', start: 489, end: 495 },
  { name: 'الدُّخان', start: 496, end: 498 },
  { name: 'الجاثِية', start: 499, end: 502 },
  { name: 'الأحقَاف', start: 502, end: 506 },
  { name: 'مُحمد', start: 507, end: 510 },
  { name: 'الفَتح', start: 511, end: 515 },
  { name: 'الحُجُرَات', start: 515, end: 517 },
  { name: 'قٓ', start: 518, end: 520 },
  { name: 'الذَّاريَات', start: 520, end: 523 },
  { name: 'الطُّور', start: 523, end: 525 },
  { name: 'النَّجم', start: 526, end: 528 },
  { name: 'القَمَر', start: 528, end: 531 },
  { name: 'الرَّحمٰن', start: 531, end: 534 },
  { name: 'الوَاقِعة', start: 534, end: 537 },
  { name: 'الحدِيد', start: 537, end: 541 },
  { name: 'المُجَادلة', start: 542, end: 545 },
  { name: 'الحَشر', start: 545, end: 548 },
  { name: 'المُمتَحنَة', start: 549, end: 551 },
  { name: 'الصَّف', start: 551, end: 552 },
  { name: 'الجُمعَة', start: 553, end: 554 },
  { name: 'المُنَافِقُونَ', start: 554, end: 555 },
  { name: 'التغَابُن', start: 556, end: 557 },
  { name: 'الطَّلَاق', start: 558, end: 559 },
  { name: 'التَّحرِيم', start: 560, end: 561 },
  { name: 'المُلك', start: 562, end: 564 },
  { name: 'القَلَم', start: 564, end: 566 },
  { name: 'الحَاقة', start: 566, end: 568 },
  { name: 'المَعَارج', start: 568, end: 570 },
  { name: 'نُوح', start: 570, end: 571 },
  { name: 'الجِن', start: 572, end: 573 },
  { name: 'المُزمل', start: 574, end: 575 },
  { name: 'المُدثر', start: 575, end: 577 },
  { name: 'القِيَامة', start: 577, end: 578 },
  { name: 'الإنسَان', start: 578, end: 580 },
  { name: 'المُرسَلات', start: 580, end: 581 },
  { name: 'النَّبَإ', start: 582, end: 583 },
  { name: 'النَّازعَات', start: 583, end: 584 },
  { name: 'عَبَسَ', start: 585, end: 586 },
  { name: 'التَّكوير', start: 586, end: 586 },
  { name: 'الانفِطَار', start: 587, end: 587 },
  { name: 'المُطَففين', start: 587, end: 589 },
  { name: 'الانشِقَاق', start: 589, end: 590 },
  { name: 'البُرُوج', start: 590, end: 590 },
  { name: 'الطَّارق', start: 591, end: 591 },
  { name: 'الأعلى', start: 591, end: 592 },
  { name: 'الغَاشِية', start: 592, end: 593 },
  { name: 'الفَجر', start: 593, end: 594 },
  { name: 'البَلَد', start: 594, end: 595 },
  { name: 'الشَّمس', start: 595, end: 595 },
  { name: 'اللَّيل', start: 595, end: 596 },
  { name: 'الضُّحى', start: 596, end: 596 },
  { name: 'الشَّرح', start: 596, end: 597 },
  { name: 'التِّين', start: 597, end: 597 },
  { name: 'العَلَق', start: 597, end: 598 },
  { name: 'القَدر', start: 598, end: 598 },
  { name: 'البَينَة', start: 598, end: 599 },
  { name: 'الزَّلزَلة', start: 599, end: 599 },
  { name: 'العَاديَات', start: 599, end: 600 },
  { name: 'القَارعَة', start: 600, end: 600 },
  { name: 'التَّكاثُر', start: 600, end: 600 },
  { name: 'العَصر', start: 601, end: 601 },
  { name: 'الهُمَزة', start: 601, end: 601 },
  { name: 'الفِيل', start: 601, end: 601 },
  { name: 'قُرَيش', start: 602, end: 602 },
  { name: 'المَاعُون', start: 602, end: 602 },
  { name: 'الكَوثر', start: 602, end: 602 },
  { name: 'الكافِرون', start: 603, end: 603 },
  { name: 'النَّصر', start: 603, end: 603 },
  { name: 'المَسَد', start: 603, end: 603 },
  { name: 'الإخلَاص', start: 604, end: 604 },
  { name: 'الفَلَق', start: 604, end: 604 },
  { name: 'النَّاس', start: 604, end: 604 },
];

function getSurahsForPage(page: number): string {
  const surahs = SURAH_PAGE_RANGES.filter(
    (s) => page >= s.start && page <= s.end
  );
  if (surahs.length === 0) return '';
  if (surahs.length === 1) return 'سورة ' + surahs[0].name;
  return 'سورة ' + surahs.map((s) => s.name).join(' • ');
}

interface PageBottomBarProps {
  currentPage: number;
  totalPages?: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  onSeekPage: (page: number) => void | Promise<void>;
}

const THUMB_SIZE = 18;
const TOUCH_HORIZONTAL_MARGIN = 16;
const TOOLTIP_WIDTH = 180;

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

        {isDragging && trackWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.barTooltip,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.primary,
                transform: [
                  {
                    translateX:
                      travelWidth > 0
                        ? thumbX.interpolate({
                            inputRange: [0, travelWidth],
                            outputRange: [
                              0,
                              Math.max(0, trackWidth - TOOLTIP_WIDTH),
                            ],
                            extrapolate: 'clamp',
                          })
                        : 0,
                  },
                ],
              },
            ]}
          >
            <Text
              style={[styles.barTooltipText, { color: theme.colors.primary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {getSurahsForPage(previewPage)}
            </Text>
          </Animated.View>
        ) : null}
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
  barTooltip: {
    position: 'absolute',
    top: -42,
    width: TOOLTIP_WIDTH,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 8,
    zIndex: 99,
  },
  barTooltipText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
