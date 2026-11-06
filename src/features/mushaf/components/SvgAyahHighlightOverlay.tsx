import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { NormalizedAyahGeometry } from '../types/svgMushaf.types';

interface SvgAyahHighlightOverlayProps {
  viewBox: string;
  ayahs: NormalizedAyahGeometry[];
  selectedVerseKey?: string | null;
  bookmarkedVerseKey?: string | null;
  searchHighlightVerseKey?: string | null;
}

/**
 * طبقة تظليل الآيات المتجهية (Declarative SVG Ayah Highlight Overlay)
 * ترسم مضلعات التظليل فوق نصوص المصحف بتطابق هندسي 100% مع مسارات الآيات
 */
export const SvgAyahHighlightOverlay: React.FC<SvgAyahHighlightOverlayProps> = ({
  viewBox,
  ayahs,
  selectedVerseKey,
  bookmarkedVerseKey,
  searchHighlightVerseKey,
}) => {
  const activeHighlights = useMemo(() => {
    return ayahs
      .map((ayah) => {
        let fillColor: string | null = null;

        if (selectedVerseKey === ayah.verseKey) {
          fillColor = 'rgba(197, 155, 39, 0.28)'; // تظليل ذهبي للآية المحددة
        } else if (bookmarkedVerseKey === ayah.verseKey) {
          fillColor = 'rgba(31, 81, 63, 0.20)'; // تظليل زمردي خفيف للإشارة المرجعية
        } else if (searchHighlightVerseKey === ayah.verseKey) {
          fillColor = 'rgba(197, 155, 39, 0.24)'; // تظليل ذهبي عابر للبحث
        }

        if (!fillColor) return null;

        return {
          key: ayah.verseKey,
          d: ayah.pathD,
          fillColor,
        };
      })
      .filter((item): item is { key: string; d: string; fillColor: string } => item !== null);
  }, [ayahs, selectedVerseKey, bookmarkedVerseKey, searchHighlightVerseKey]);

  if (activeHighlights.length === 0) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
      >
        {activeHighlights.map((item) => (
          <Path
            key={item.key}
            d={item.d}
            fill={item.fillColor}
            fillRule="evenodd"
          />
        ))}
      </Svg>
    </View>
  );
};
