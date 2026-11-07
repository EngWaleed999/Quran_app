import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Share,
  I18nManager,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QuranColors } from '../../../core/theme/theme';
import { toArabicNumerals } from '../../../core/utils/arabicNumbers';
import { Bookmark, BookmarkType, BOOKMARK_TYPE_COLORS } from '../../bookmarks/types/bookmark.types';

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
  bookmarks: Bookmark[];
  onClose: () => void;
  onToggleBookmark: (ayah: SelectedAyahInfo, type: BookmarkType) => void;
  onOpenNote?: (ayah: SelectedAyahInfo) => void;
  onOpenTafsir?: (ayah: SelectedAyahInfo) => void;
  onPlayAudio?: (ayah: SelectedAyahInfo) => void;
  onRepeatAudio?: (ayah: SelectedAyahInfo) => void;
}

export const AyahActionModal: React.FC<AyahActionModalProps> = ({
  visible,
  ayah,
  bookmarks,
  onClose,
  onToggleBookmark,
  onOpenNote,
  onOpenTafsir,
  onPlayAudio,
  onRepeatAudio,
}) => {
  if (!ayah) return null;

  const hasBookmark = (type: BookmarkType) => bookmarks.some((item) => item.type === type && item.verseKey === ayah.verseKey);

  const handleShare = async () => {
    try {
      const message =
        'سورة ' + ayah.suraName + ' - الآية ' + toArabicNumerals(ayah.ayaNo) +
        ' (صفحة ' + toArabicNumerals(ayah.page) + '):\n\n' +
        (ayah.ayahText || '') + '\n\n— تطبيق القرآن الكريم';
      await Share.share({ message });
    } catch (error) {
      console.warn('Share error:', error);
    }
  };

  const runAudioAction = (
    action: ((selectedAyah: SelectedAyahInfo) => void) | undefined
  ) => {
    onClose();
    action?.(ayah);
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
          <View style={styles.dragHandle} />

          <View style={styles.header}>
            <View style={styles.headerTitleCol}>
              <Text style={styles.surahTitleText}>
                سُورَةُ {ayah.suraName} • الآيَةُ {toArabicNumerals(ayah.ayaNo)}
              </Text>
              <View style={styles.badgesRow}>
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>الجزء {toArabicNumerals(ayah.jozz)}</Text>
                </View>
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>صفحة {toArabicNumerals(ayah.page)}</Text>
                </View>
                {bookmarks.some((item) => item.verseKey === ayah.verseKey) ? (
                  <View style={[styles.badgePill, styles.bookmarkedPill]}>
                    <MaterialCommunityIcons name="bookmark-check" size={13} color="#FFFFFF" />
                    <Text style={[styles.badgeText, styles.bookmarkedText]}>فاصل محفوظ</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={22} color={QuranColors.textMuted} />
            </TouchableOpacity>
          </View>

          {ayah.ayahText ? (
            <View style={styles.snippetBox}>
              <Text style={styles.snippetText} numberOfLines={3}>
                {ayah.ayahText}
              </Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.actionsScroll}
            contentContainerStyle={styles.actionsContent}
            showsVerticalScrollIndicator={false}
          >
            {(['tracking', 'reading', 'memorization'] as const).map((type) => {
              const selected = hasBookmark(type);
              const title = type === 'tracking' ? 'فاصل متابعة' : type === 'reading' ? 'فاصل قراءة' : 'فاصل حفظ';
              const subtitle = type === 'tracking' ? 'تحديد موضع أريد متابعة القراءة منه' : type === 'reading' ? 'تحديد موضع القراءة الحالي' : 'تحديد موضع أراجع أو أحفظ منه';
              const icon = type === 'tracking' ? 'flag-checkered' : type === 'reading' ? 'bookmark-check' : 'school-outline';
              const tint = BOOKMARK_TYPE_COLORS[type];
              return (
                <TouchableOpacity key={type} style={[styles.actionRow, selected && { borderColor: tint, backgroundColor: tint + '12' }]} onPress={() => onToggleBookmark(ayah, type)} activeOpacity={0.7}>
                  <View style={[styles.actionIconBox, { borderColor: tint + '55' }, selected && { backgroundColor: tint }]}>
                    <MaterialCommunityIcons name={selected ? 'bookmark-check' : icon} size={23} color={selected ? '#FFFFFF' : tint} />
                  </View>
                  <View style={styles.actionDetails}>
                    <Text style={[styles.actionTitle, selected && { color: tint }]}>{selected ? 'إزالة ' + title : title}</Text>
                    <Text style={styles.actionSubtitle}>{subtitle}</Text>
                  </View>
                  <MaterialCommunityIcons name={selected ? 'check-circle' : 'plus-circle-outline'} size={20} color={tint} />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => runAudioAction(onPlayAudio)}
            >
              <View style={styles.actionIconBox}>
                <MaterialCommunityIcons
                  name="play-circle-outline"
                  size={24}
                  color={QuranColors.emerald}
                />
              </View>
              <View style={styles.actionDetails}>
                <Text style={styles.actionTitle}>تلاوة</Text>
                <Text style={styles.actionSubtitle}>
                  اختر القارئ وشغّل السورة من هذه الآية
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-left" size={20} color={QuranColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => runAudioAction(onRepeatAudio)}
            >
              <View style={styles.actionIconBox}>
                <MaterialCommunityIcons name="repeat" size={24} color={QuranColors.emerald} />
              </View>
              <View style={styles.actionDetails}>
                <Text style={styles.actionTitle}>ترديد وتكرار</Text>
                <Text style={styles.actionSubtitle}>
                  كرّر كل آية مع تأخير زمني قابل للتعديل
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-left" size={20} color={QuranColors.textMuted} />
            </TouchableOpacity>

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
                <Text style={styles.actionSubtitle}>تفسير السعدي، والتفسير الميسر</Text>
              </View>
              <MaterialCommunityIcons name="chevron-left" size={20} color={QuranColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} activeOpacity={0.7} onPress={() => { onClose(); onOpenNote?.(ayah); }}>
              <View style={styles.actionIconBox}>
                <MaterialCommunityIcons name="note-edit-outline" size={24} color={QuranColors.emerald} />
              </View>
              <View style={styles.actionDetails}>
                <Text style={styles.actionTitle}>إضافة ملاحظة</Text>
                <Text style={styles.actionSubtitle}>احفظ فائدة أو تدبراً مرتبطاً بهذه الآية</Text>
              </View>
              <MaterialCommunityIcons name="chevron-left" size={20} color={QuranColors.textMuted} />
            </TouchableOpacity>

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
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
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
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  badgePill: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
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
  bookmarkedText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
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
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
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
    writingDirection: 'rtl',
  },
  bookmarkedTitle: {
    color: QuranColors.emerald,
  },
  actionSubtitle: {
    fontSize: 12,
    color: QuranColors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
