import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView, Share, I18nManager, Alert } from 'react-native';
import { AppText as Text } from '../../../core/theme/components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
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

  ayahTextUthmani?: string;
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
  onOpenTajweed?: (ayah: SelectedAyahInfo) => void;
}

export const AyahActionModal: React.FC<AyahActionModalProps> = ({
  visible,
  ayah,
  bookmarks,
  onClose,
  onToggleBookmark,
  onOpenNote,
  onOpenTafsir,
  onOpenTajweed,
  onPlayAudio,
  onRepeatAudio,
}) => {
  const theme = useTheme();
  if (!ayah) return null;

  const hasBookmark = (type: BookmarkType) =>
    bookmarks.some((item) => item.type === type && item.verseKey === ayah.verseKey);

  const handleShare = async () => {
    const text = ayah.ayahText?.trim();

    if (!text) {
      console.warn('[AyahShare] Empty ayah text:', ayah.verseKey);
      return;
    }

    const message =
      `سورة ${ayah.suraName} - الآية ${toArabicNumerals(ayah.ayaNo)}` +
      ` (صفحة ${toArabicNumerals(ayah.page)}):\n\n` +
      `﴿ ${text} ﴾\n\n` +
      'القرآن الكريم';

    try {
      const result = await Share.share(
        {
          message,
          title: 'مشاركة الآية',
        },
        {
          dialogTitle: 'مشاركة الآية',
        }
      );

      console.log('[AyahShare] Share result:', result);
    } catch (error) {
      console.error('[AyahShare] Native share failed:', error);
    }
  };

  const runAudioAction = (
    action: ((selectedAyah: SelectedAyahInfo) => void) | undefined
  ) => {
    action?.(ayah);
  };

  const actionBoxDynamicStyle = {
    backgroundColor: theme.colors.surfaceVariant,
    borderColor: theme.colors.outline,
  };

  const actionIconBoxDynamicStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.outline,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdropPressable}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.bottomSheetContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.dragHandle, { backgroundColor: theme.colors.outline }]} />

          <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
            <View style={styles.headerTitleCol}>
              <Text style={[styles.surahTitleText, { color: theme.colors.primary }]}>
                سُورَةُ {ayah.suraName} • الآيَةُ {toArabicNumerals(ayah.ayaNo)}
              </Text>
              <View style={styles.badgesRow}>
                <View style={[styles.badgePill, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.badgeText, { color: theme.colors.onSurfaceVariant }]}>
                    الجزء {toArabicNumerals(ayah.jozz)}
                  </Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.badgeText, { color: theme.colors.onSurfaceVariant }]}>
                    صفحة {toArabicNumerals(ayah.page)}
                  </Text>
                </View>
                {bookmarks.some((item) => item.verseKey === ayah.verseKey) ? (
                  <View style={[styles.badgePill, styles.bookmarkedPill]}>
                    <MaterialCommunityIcons name="bookmark-check" size={13} color="#FFFFFF" />
                    <Text style={[styles.badgeText, styles.bookmarkedText]}>فاصل محفوظ</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={onClose}
              hitSlop={10}
            >
              <MaterialCommunityIcons name="close" size={22} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {ayah.ayahText ? (
            <View
              style={[
                styles.snippetBox,
                { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline },
              ]}
            >
              <Text
                style={[styles.snippetText, { color: theme.colors.onSurface }]}
                numberOfLines={4}
              >
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
              const title =
                type === 'tracking'
                  ? 'فاصل متابعة'
                  : type === 'reading'
                    ? 'فاصل قراءة'
                    : 'فاصل حفظ';
              const subtitle =
                type === 'tracking'
                  ? 'تحديد موضع أريد متابعة القراءة منه'
                  : type === 'reading'
                    ? 'تحديد موضع القراءة الحالي'
                    : 'تحديد موضع أراجع أو أحفظ منه';
              const icon =
                type === 'tracking'
                  ? 'flag-checkered'
                  : type === 'reading'
                    ? 'bookmark-check'
                    : 'school-outline';
              const tint = BOOKMARK_TYPE_COLORS[type];
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.actionRow,
                    actionBoxDynamicStyle,
                    selected && { borderColor: tint, backgroundColor: tint + '15' },
                  ]}
                  onPress={() => onToggleBookmark(ayah, type)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.actionIconBox,
                      actionIconBoxDynamicStyle,
                      { borderColor: tint + '55' },
                      selected && { backgroundColor: tint },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={selected ? 'bookmark-check' : icon}
                      size={23}
                      color={selected ? '#FFFFFF' : tint}
                    />
                  </View>
                  <View style={styles.actionDetails}>
                    <Text
                      style={[
                        styles.actionTitle,
                        { color: theme.colors.onSurface },
                        selected && { color: tint },
                      ]}
                    >
                      {selected ? 'إزالة ' + title : title}
                    </Text>
                    <Text style={[styles.actionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                      {subtitle}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={selected ? 'check-circle' : 'plus-circle-outline'}
                    size={20}
                    color={tint}
                  />
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.actionRow, actionBoxDynamicStyle]}
              activeOpacity={0.7}
              onPress={() => runAudioAction(onPlayAudio)}
            >
              <View style={[styles.actionIconBox, actionIconBoxDynamicStyle]}>
                <MaterialCommunityIcons
                  name="play-circle-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.actionDetails}>
                <Text style={[styles.actionTitle, { color: theme.colors.onSurface }]}>تلاوة</Text>
                <Text style={[styles.actionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  اختر القارئ وشغّل السورة من هذه الآية
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-left"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionRow, actionBoxDynamicStyle]}
              activeOpacity={0.7}
              onPress={() => runAudioAction(onRepeatAudio)}
            >
              <View style={[styles.actionIconBox, actionIconBoxDynamicStyle]}>
                <MaterialCommunityIcons name="repeat" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.actionDetails}>
                <Text style={[styles.actionTitle, { color: theme.colors.onSurface }]}>
                  استمع وردد
                </Text>
                <Text style={[styles.actionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  كرّر كل آية مع تأخير زمني قابل للتعديل
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-left"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            <TouchableOpacity
                  style={[styles.actionRow, actionBoxDynamicStyle]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onClose();
                    onOpenTajweed?.(ayah);
                  }}
                >
                  <View style={[styles.actionIconBox, actionIconBoxDynamicStyle]}>
                    <MaterialCommunityIcons
                      name="book-open-variant"
                      size={24}
                      color={theme.colors.primary}
                    />
                  </View>

                  <View style={styles.actionDetails}>
                    <Text style={[styles.actionTitle, { color: theme.colors.onSurface }]}>
                      أحكام التجويد
                    </Text>

                    <Text style={[styles.actionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                      تعرّف على الأحكام ومواضعها في الآية
                    </Text>
                  </View>

                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                  />
                </TouchableOpacity>


            <TouchableOpacity
              style={[styles.actionRow, actionBoxDynamicStyle]}
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                onOpenTafsir?.(ayah);
              }}
            >
              <View style={[styles.actionIconBox, actionIconBoxDynamicStyle]}>
                <MaterialCommunityIcons
                  name="book-open-page-variant-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.actionDetails}>
                <Text style={[styles.actionTitle, { color: theme.colors.onSurface }]}>
                  التفسيرات
                </Text>
                <Text style={[styles.actionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  تفسير السعدي
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-left"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionRow, actionBoxDynamicStyle]}
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                onOpenNote?.(ayah);
              }}
            >
              <View style={[styles.actionIconBox, actionIconBoxDynamicStyle]}>
                <MaterialCommunityIcons
                  name="note-edit-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.actionDetails}>
                <Text style={[styles.actionTitle, { color: theme.colors.onSurface }]}>
                  إضافة ملاحظة
                </Text>
                <Text style={[styles.actionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  احفظ فائدة أو تدبراً مرتبطاً بهذه الآية
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-left"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionRow, actionBoxDynamicStyle]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBox, actionIconBoxDynamicStyle]}>
                <MaterialCommunityIcons
                  name="share-variant-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.actionDetails}>
                <Text style={[styles.actionTitle, { color: theme.colors.onSurface }]}>
                  مشاركة الآية
                </Text>
                <Text style={[styles.actionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  مشاركة نص الآية المشكول مع معلومات السورة
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-left"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
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
    maxHeight: '95%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
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
  },
  headerTitleCol: {
    flex: 1,
    gap: 6,
  },
  surahTitleText: {
    fontSize: 17,
    fontWeight: 'bold',
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
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -4,
  },
  snippetBox: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  snippetText: {
    fontSize: 19, // <--- تم تكبير حجم الخط ليتناسب مع الرسم العثماني
    lineHeight: 36, // <--- مسافة السطر لمنع تداخل الحركات والتنوين
    textAlign: 'center',
    fontFamily: 'UthmanicHafs',
  },
  actionsScroll: {
    maxHeight: 340,
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
    borderWidth: 1,
    gap: 12,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  actionDetails: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'auto'
    ,
    writingDirection: 'rtl',
  },
  actionSubtitle: {
    fontSize: 12,
    textAlign: 'auto'
    ,
    writingDirection: 'rtl',
  },
});
