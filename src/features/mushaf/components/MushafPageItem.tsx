import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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
  onPageDataLoaded?: (page: number, surahName: string, jozz: number) => void;
}

const MushafPageItemComponent: React.FC<MushafPageItemProps> = ({
  page,
  db,
  fontSize,
  isNear,
  onPageDataLoaded,
}) => {
  // Synchronous initial fetch: Eliminates blank frames completely
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

  const isSpecialCenterPage = page === 1 || page === 2;

  return (
    <ScrollView
      style={styles.pageScrollView}
      contentContainerStyle={[
        styles.scrollContainer,
        isSpecialCenterPage && styles.centerContainer,
      ]}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.paperFrame}>
        <View style={styles.contentArea}>
          {surahGroups.map((group) => {
            const startsNewSurah = group.ayahs.some((a) => a.aya_no === 1);

            return (
              <View key={`page-${page}-sura-${group.suraNo}`} style={styles.surahBlock}>
                {startsNewSurah && (
                  <SurahBanner surahName={group.suraName} suraNo={group.suraNo} />
                )}

                {/* Fully justified Quran text with flush margins right and left */}
                <Text
                  style={[
                    styles.ayahFlowText,
                    {
                      fontSize,
                      lineHeight: Math.round(fontSize * 1.95),
                      textAlign: isSpecialCenterPage ? 'center' : 'justify',
                    },
                  ]}
                >
                  {group.ayahs.map((ayah) => (
                    <Text key={`ayah-${ayah.id}`}>
                      {ayah.aya_text}{' '}
                    </Text>
                  ))}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Bottom page number indicator within the authentic Mushaf frame */}
        <View style={styles.pageNumberBadge}>
          <Text style={styles.pageNumberText}>
            {toArabicNumerals(page)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export const MushafPageItem = React.memo(MushafPageItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.page === nextProps.page &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.isNear === nextProps.isNear
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
    paddingHorizontal: 8,      // تقليل الهامش الخارجي لزيادة مساحة القراءة
    paddingTop: 8,
    paddingBottom: 24,         // مساحة سفلية إضافية لمنع اختفاء آخر آية تحت الشريط
  },
  centerContainer: {
    justifyContent: 'center',
  },
  paperFrame: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: QuranColors.parchmentBorder,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contentArea: {
    flexGrow: 1,
  },
  surahBlock: {
    marginBottom: 8,
  },
  ayahFlowText: {
    fontFamily: 'HafsSmart',
    color: QuranColors.textDark,
    writingDirection: 'rtl',
    paddingHorizontal: 7.7,
    paddingVertical: 2,
  },
  pageNumberBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 2,
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(197, 155, 39, 0.25)',
  },
  pageNumberText: {
    fontSize: 13,
    color: QuranColors.textMuted,
    fontFamily: 'System',
    fontWeight: '600',
  },
});
