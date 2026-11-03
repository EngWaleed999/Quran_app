import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Pressable } from 'react-native';
import { SQLiteDatabase } from 'expo-sqlite';
import { QuranRepository } from '../../../core/database/quranRepository';
import { SurahBanner } from './SurahBanner';
import { Ayah } from '../types/mushaf.types';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';

interface MushafPageItemProps {
  page: number;
  db: SQLiteDatabase;
  fontSize: number;
  isNear: boolean;
  isFullScreen?: boolean;
  onToggleControls?: () => void;
  onPageDataLoaded?: (page: number, surahName: string, jozz: number) => void;
}

const RLM = '\u200F'; // Unicode Right-to-Left Mark forces trailing text/last line to align strictly to the Right

const MushafPageItemComponent: React.FC<MushafPageItemProps> = ({
  page,
  db,
  fontSize,
  isNear,
  isFullScreen = false,
  onToggleControls,
  onPageDataLoaded,
}) => {
  const { height: windowHeight } = useWindowDimensions();

  // Dynamically calculate frame height so the Mushaf paper fills the available screen
  const availableContentHeight = isFullScreen
    ? windowHeight - 20
    : Math.max(480, windowHeight - 128);

  // Synchronous initial fetch: 0-latency instant page render
  const [ayahs, setAyahs] = useState<Ayah[]>(() => {
    if (isNear) {
      return QuranRepository.getPageAyahsSync(db, page);
    }
    return [];
  });

  useEffect(() => {
    if (isNear && ayahs.length === 0) {
      const data = QuranRepository.getPageAyahsSync(db, page);
      if (data.length > 0) {
        setAyahs(data);
        if (onPageDataLoaded) {
          onPageDataLoaded(page, data[0].sura_name_ar || '', data[0].jozz);
        }
      }
    }
  }, [isNear, ayahs.length, db, page, onPageDataLoaded]);

  // Group ayahs by sura_no with memoization
  const surahGroups = useMemo(() => {
    const groups: { suraNo: number; suraName: string; ayahs: Ayah[] }[] = [];
    ayahs.forEach((ayah) => {
      const last = groups[groups.length - 1];
      if (last && last.suraNo === ayah.sura_no) {
        last.ayahs.push(ayah);
      } else {
        groups.push({
          suraNo: ayah.sura_no,
          suraName: ayah.sura_name_ar || '',
          ayahs: [ayah],
        });
      }
    });
    return groups;
  }, [ayahs]);

  if (!isNear || ayahs.length === 0) {
    return <View style={styles.placeholder} />;
  }

  // Only opening pages (Al-Fatihah and Al-Baqarah 1-5) are centered by classical tradition
  const isSpecialCenterPage = page === 1 || page === 2;

  return (
    <ScrollView
      style={styles.pageScrollView}
      contentContainerStyle={[
        styles.scrollContainer,
        { minHeight: availableContentHeight },
      ]}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <Pressable
        onPress={onToggleControls}
        style={[styles.paperFrame, { minHeight: availableContentHeight }]}
      >
        {/* Content ALWAYS starts from the top of the page under the header */}
        <View style={styles.contentArea}>
          {surahGroups.map((group) => {
            const startsNewSurah = group.ayahs.some((a) => a.aya_no === 1);

            return (
              <View key={`page-${page}-sura-${group.suraNo}`} style={styles.surahBlock}>
                {startsNewSurah && (
                  <SurahBanner surahName={group.suraName} suraNo={group.suraNo} />
                )}

                {/* Flowing Quran Text: Lines justified with last line strictly ending on the Right */}
                <Text
                  style={[
                    styles.ayahFlowText,
                    {
                      fontSize,
                      // Tight, balanced line height so all 15 lines fit cleanly on mobile screen
                      lineHeight: Math.round(fontSize * 1.76),
                      textAlign: isSpecialCenterPage ? 'center' : 'justify',
                    },
                  ]}
                >
                  {group.ayahs.map((ayah) => (
                    <Text key={`ayah-${ayah.id}`}>
                      {ayah.aya_text}{' '}
                    </Text>
                  ))}
                  {RLM}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Bottom page number badge anchored within the authentic Mushaf frame */}
        <View style={styles.pageNumberBadge}>
          <Text style={styles.pageNumberText}>
            {toArabicNumerals(page)}
          </Text>
        </View>
      </Pressable>
    </ScrollView>
  );
};

export const MushafPageItem = React.memo(MushafPageItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.page === nextProps.page &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.isNear === nextProps.isNear &&
    prevProps.isFullScreen === nextProps.isFullScreen
  );
});

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: QuranColors.parchment,
  },
  pageScrollView: {
    flex: 1,
    backgroundColor: QuranColors.parchment,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 4,
  },
  paperFrame: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: QuranColors.parchmentBorder,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 2,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contentArea: {
    flexGrow: 1,
    justifyContent: 'flex-start', // All ayahs start strictly from the top of the page
  },
  surahBlock: {
    marginBottom: 4,
  },
  ayahFlowText: {
    fontFamily: 'HafsSmart',
    color: QuranColors.textDark,
    writingDirection: 'rtl',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  pageNumberBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 2,
    marginTop: 2,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(197, 155, 39, 0.25)',
  },
  pageNumberText: {
    fontSize: 12,
    color: QuranColors.textMuted,
    fontFamily: 'System',
    fontWeight: '600',
  },
});
