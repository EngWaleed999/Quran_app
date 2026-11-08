import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { NormalizedAyahGeometry } from '../types/svgMushaf.types';
import { BookmarkType, BOOKMARK_TYPE_COLORS } from '../../bookmarks/types/bookmark.types';

interface SvgAyahHighlightOverlayProps {
  viewBox: string;
  ayahs: NormalizedAyahGeometry[];
  selectedVerseKey?: string | null;
  playingVerseKey?: string | null;
  searchHighlightVerseKey?: string | null;
  bookmarkTypesByVerse?: Record<string, BookmarkType[]>;
  khatmahVerseKeys?: string[];
}

interface HighlightPath {
  key: string;
  d: string;
  fillColor: string;
}

export const SvgAyahHighlightOverlay: React.FC<SvgAyahHighlightOverlayProps> = ({
  viewBox,
  ayahs,
  selectedVerseKey,
  playingVerseKey,
  searchHighlightVerseKey,
  bookmarkTypesByVerse = {},
  khatmahVerseKeys = [],
}) => {
  const activeHighlights = useMemo(() => {
    const paths: HighlightPath[] = [];
    const khatmahSet = new Set(khatmahVerseKeys);

    for (const ayah of ayahs) {
      const key = ayah.verseKey;

      // Selection and active playback take visual precedence over saved markers.
      if (selectedVerseKey === key) {
        paths.push({ key: key + ':selected', d: ayah.pathD, fillColor: 'rgba(197, 155, 39, 0.28)' });
        continue;
      }
      if (playingVerseKey === key) {
        paths.push({ key: key + ':playing', d: ayah.pathD, fillColor: 'rgba(31, 81, 63, 0.24)' });
        continue;
      }
      if (searchHighlightVerseKey === key) {
        paths.push({ key: key + ':search', d: ayah.pathD, fillColor: 'rgba(197, 155, 39, 0.24)' });
      }
      if (khatmahSet.has(key)) {
        paths.push({ key: key + ':khatmah', d: ayah.pathD, fillColor: 'rgba(37, 139, 104, 0.18)' });
      }

      const bookmarkTypes = bookmarkTypesByVerse[key] ?? [];
      for (const type of bookmarkTypes) {
        paths.push({
          key: key + ':bookmark:' + type,
          d: ayah.pathD,
          fillColor: BOOKMARK_TYPE_COLORS[type] + '33',
        });
      }
    }

    return paths;
  }, [
    ayahs,
    selectedVerseKey,
    playingVerseKey,
    searchHighlightVerseKey,
    bookmarkTypesByVerse,
    khatmahVerseKeys,
  ]);

  if (activeHighlights.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        {activeHighlights.map((item) => (
          <Path key={item.key} d={item.d} fill={item.fillColor} fillRule="evenodd" />
        ))}
      </Svg>
    </View>
  );
};
