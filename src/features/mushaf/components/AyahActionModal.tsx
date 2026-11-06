import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Share,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';

export interface SelectedAyahInfo {
  verseKey: string;
  suraNo: number;
  ayaNo: number;
  page: number;
  suraName: string;
  jozz: number;
  ayahText?: string;
}

interface AyahActionModalProps {
  visible: boolean;
  ayah: SelectedAyahInfo | null;
  isBookmarked: boolean;
  onClose: () => void;
  onToggleBookmark: (ayah: SelectedAyahInfo) => void;
  onOpenTafsir?: (ayah: SelectedAyahInfo) => void;
}

export const AyahActionModal: React.FC<AyahActionModalProps> = ({
  visible,
  ayah,
  isBookmarked,
  onClose,
  onToggleBookmark,
  onOpenTafsir,
}) => {
  if (!ayah) return null;

  const handleShare = async () => {
    try {
      const message = `سورة ${ayah.suraName} - الآية ${toArabicNumerals(ayah.ayaNo)} (صفحة ${toArabicNumerals(ayah.page)}):\n\n${ayah.ayahText || ''}\n\n— تطبيق القرآن الكريم`;
      await Share.share({ message });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdropPressable}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.bottomSheetContainer}>
          {/* Top Sheet Handle */}
          <View style={styles.dragHandle} />

          {/* Ayah Header Information */}
          <View style={styles.header}>
            <View style={styles.headerTitleCol}>
              <Text style={styles.surahTitleText}>
                سُورَةُ {ayah.suraName} • الآيَةُ {toArabicNumerals(ayah.ayaNo)}
              </Text>
              <View style={styles.badgesRow}>
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>
                    الجزء {toArabicNumerals(ayah.jozz)}
                  </Text>
                </View>
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>
                    صفحة {toArabicNumerals(ayah.page)}
                  </Text>
                </View>
                {isBookmarked ? (
                  <View style={[styles.badgePill, styles.bookmarkedPill]}>
                    <MaterialCommunityIcons name="bookmark-check" size={13} color="#FFFFFF" />
                    <Text style={[styles.badgeText, { color: '#FFFFFF', fontWeight: 'bold' }]}>
                      فاصل محفوظ
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={22} color={QuranColors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Ayah Snippet Preview */}
          {ayah.ayahText ? (
            <View style={styles.snippetBox}>
              <Text style={styles.snippetText} numberOfLines={3}>
                {ayah.ayahText}
              </Text>
            </View>
          ) : null}

          {/* Action List Grid */}
          <ScrollView
            style={styles.actionsScroll}
            contentContainerStyle={styles.actionsContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Bookmark Action (Fully Functional) */}
            <TouchableOpacity
              style={[styles.actionRow, isBookmarked && styles.bookmarkedActionRow]}
              onPress={() => onToggleBookmark(ayah)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBox, isBookmarked && styles.bookmarkedIconBox]}>
                <MaterialCommunityIcons
                  name={isBookmarked ? 'bookmark-remove' : 'bookmark-plus-outline'}
                  size={24}
                  color={isBookmarked ? '#FFFFFF' : QuranColors.gold}
                />
              </View>
              <View style={styles.actionDetails}>
                <Text style={[styles.actionTitle, isBookmarked && styles.bookmarkedTitle]}>
                  {isBookmarked ? 'إزالة الفاصل من هذه الآية' : 'وضع فاصل قراءة هنا'}
                </Text>
                <Text style={styles.actionSubtitle}>
                  {isBookmarked
                    ? 'إلغاء تعيين الفاصل الحالي'
                    : 'تثبيت فاصل مرجعي للرجوع إلى موضع الآية لاحقاً'}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-left"
                size={20}
                color={isBookmarked ? QuranColors.emerald : QuranColors.textMuted}
              />
            </TouchableOpacity>

            {/* 2. Recitation Action (Visual UI) */}
            <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}>
              <View style={styles.actionIconBox}>
                <MaterialCommunityIcons
                  name="play-circle-outline"
                  size={24}
                  color={QuranColors.emerald}
                />
              </View>
              <View style={styles.actionDetails}>
                <Text style={styles.actionTitle}>تلاوة الآية</Text>
                <Text style={styles.actionSubtitle}>
                  الاستماع لتلاوة الآية بصوت الشيخ ماهر المعيقلي (قريباً)
                </Text>
              </View>
              <View style={styles.comingSoonTag}>
                <Text style={styles.comingSoonText}>قريباً</Text>
              </View>
            </TouchableOpacity>

            {/* 3. Repetition Action (Visual UI) */}
            <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}>
              <View style={styles.actionIconBox}>
                <MaterialCommunityIcons name="repeat" size={24} color={QuranColors.emerald} />
              </View>
              <View style={styles.actionDetails}>
                <Text style={styles.actionTitle}>ترديد وتكرار</Text>
                <Text style={styles.actionSubtitle}>
                  تحديد نطاق وعدد مرات تكرار الآية للحفظ والتثبيت (قريباً)
                </Text>
              </View>
              <View style={styles.comingSoonTag}>
                <Text style={styles.comingSoonText}>قريباً</Text>
              </View>
            </TouchableOpacity>

            {/* 4. Tafsir Action (Fully Functional) */}
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                onOpenTafsir?.(ayah);
              }}
            >
              <View style={styles.actionIconBox}>
                <MaterialCommunityIcons
                  name="book-open-page-variant-outline"
                  size={24}
                  color={QuranColors.emerald}
                />
              </View>
              <View style={styles.actionDetails}>
                <Text style={styles.actionTitle}>التفسيرات</Text>
                <Text style={styles.actionSubtitle}>
                  تفسير السعدي، والتفسير الميسر
                </Text>
              </View>
            </TouchableOpacity>

            {/* 5. Share Action (Fully Functional) */}
            <TouchableOpacity style={styles.actionRow} onPress={handleShare} activeOpacity={0.7}>
              <View style={styles.actionIconBox}>
                <MaterialCommunityIcons
                  name="share-variant-outline"
                  size={24}
                  color={QuranColors.emerald}
                />
              </View>
              <View style={styles.actionDetails}>
                <Text style={styles.actionTitle}>مشاركة الآية</Text>
                <Text style={styles.actionSubtitle}>مشاركة نص الآية مع معلومات السورة</Text>
              </View>
              <MaterialCommunityIcons name="chevron-left" size={20} color={QuranColors.textMuted} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  bottomSheetContainer: {
    maxHeight: '62%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 12,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: QuranColors.parchmentBorder,
  },
  headerTitleCol: {
    flex: 1,
    gap: 6,
  },
  surahTitleText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
    textAlign: 'center',
  },
  badgesRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  badgePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(31, 81, 63, 0.08)',
  },
  bookmarkedPill: {
    backgroundColor: QuranColors.emerald,
  },
  badgeText: {
    fontSize: 11,
    color: QuranColors.textMuted,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    marginRight: -4,
  },
  snippetBox: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    backgroundColor: QuranColors.parchment,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: QuranColors.parchmentBorder,
  },
  snippetText: {
    fontSize: 14,
    lineHeight: 24,
    color: QuranColors.textDark,
    textAlign: 'center',
    fontFamily: 'UthmanicHafs',
  },
  actionsScroll: {
    maxHeight: 320,
  },
  actionsContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: QuranColors.parchment,
    borderWidth: 1,
    borderColor: QuranColors.parchmentBorder,
    gap: 12,
  },
  bookmarkedActionRow: {
    backgroundColor: 'rgba(31, 81, 63, 0.06)',
    borderColor: QuranColors.emerald,
    borderWidth: 1.5,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: QuranColors.parchmentBorder,
  },
  bookmarkedIconBox: {
    backgroundColor: QuranColors.emerald,
    borderColor: QuranColors.emerald,
  },
  actionDetails: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: QuranColors.textDark,
    textAlign: 'right',
  },
  bookmarkedTitle: {
    color: QuranColors.emerald,
  },
  actionSubtitle: {
    fontSize: 12,
    color: QuranColors.textMuted,
    textAlign: 'right',
  },
  comingSoonTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(197, 155, 39, 0.14)',
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: QuranColors.gold,
  },
});
