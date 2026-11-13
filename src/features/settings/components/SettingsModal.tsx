import React from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '../../../core/theme/components/AppText';
import { AppearanceMode, getQuranPalette, QuranColors } from '../../../core/theme/theme';
import { useAppPreferences } from '../../../core/theme/preferencesStore';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const SUPPORT_EMAIL = 'getcoreplus.io@gmail.com';

const OPTIONS: Array<{
  mode: AppearanceMode;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  sampleBackground: string;
  sampleSurface: string;
  sampleText: string;
}> = [
  {
    mode: 'classic',
    title: 'المصحف التقليدي',
    description: 'خلفية ورقية دافئة ومريحة للقراءة الطويلة.',
    icon: 'book-open-page-variant',
    sampleBackground: '#FFF8F0',
    sampleSurface: '#FFFFFF',
    sampleText: '#1F513F',
  },
  {
    mode: 'soft',
    title: 'الأخضر الهادئ',
    description: 'درجة خضراء خفيفة تقلل التباين الحاد.',
    icon: 'leaf',
    sampleBackground: '#EEF4EF',
    sampleSurface: '#FBFDFB',
    sampleText: '#2F6E52',
  },
  {
    mode: 'dark',
    title: 'الوضع الليلي',
    description: 'سطح داكن ونص فاتح للاستخدام في الإضاءة المنخفضة.',
    icon: 'moon-waning-crescent',
    sampleBackground: '#121413',
    sampleSurface: '#1C201E',
    sampleText: '#D4B25E',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const appearance = useAppPreferences((state) => state.appearance);
  const setAppearance = useAppPreferences((state) => state.setAppearance);
  const palette = getQuranPalette(appearance);

  const handleSendEmail = async () => {
    const subject = encodeURIComponent('تطبيق بيان - تواصل وملاحظات أو طلب ميزة');
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert(
          'البريد الإلكتروني للتواصل',
          `يمكنك مراسلتنا مباشرة على البريد:\n${SUPPORT_EMAIL}`
        );
      }
    } catch {
      Alert.alert(
        'البريد الإلكتروني للتواصل',
        `يمكنك مراسلتنا مباشرة على البريد:\n${SUPPORT_EMAIL}`
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: palette.surface,
              borderBottomColor: palette.border,
              paddingTop: Math.max(insets.top + 6, 16),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityLabel="رجوع"
          >
            <MaterialCommunityIcons
              name="arrow-right"
              size={24}
              color={palette.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: palette.primaryDark }]}>
            الإعدادات
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Section: Appearance */}
          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                المظهر
              </Text>
              <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
                اختر النمط المناسب لعينيك وبيئة القراءة.
              </Text>
            </View>
            <MaterialCommunityIcons
              name="palette-outline"
              size={25}
              color={palette.secondary}
            />
          </View>

          {OPTIONS.map((option) => {
            const selected = appearance === option.mode;
            return (
              <TouchableOpacity
                key={option.mode}
                onPress={() => setAppearance(option.mode)}
                activeOpacity={0.8}
                style={[
                  styles.themeCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: selected ? palette.primary : palette.border,
                  },
                  selected && styles.selectedCard,
                ]}
              >
                <View style={styles.themeText}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.themeTitle, { color: palette.text }]}>
                      {option.title}
                    </Text>
                    {selected ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={palette.primary}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[styles.themeDescription, { color: palette.muted }]}
                  >
                    {option.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.preview,
                    {
                      backgroundColor: option.sampleBackground,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.previewPage,
                      { backgroundColor: option.sampleSurface },
                    ]}
                  >
                    <View
                      style={[
                        styles.previewLine,
                        { backgroundColor: option.sampleText, width: '68%' },
                      ]}
                    />
                    <View
                      style={[
                        styles.previewLine,
                        { backgroundColor: option.sampleText, width: '88%' },
                      ]}
                    />
                    <View
                      style={[
                        styles.previewLine,
                        { backgroundColor: option.sampleText, width: '52%' },
                      ]}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <View
            style={[
              styles.infoBox,
              { backgroundColor: palette.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name="information-outline"
              size={19}
              color={palette.primary}
            />
            <Text style={[styles.infoText, { color: palette.muted }]}>
              يتم حفظ اختيار المظهر على الجهاز وتطبيقه تلقائياً عند فتح التطبيق
              مرة أخرى.
            </Text>
          </View>

          {/* Section: About the App and Developer */}
          <View style={[styles.sectionHeading, { marginTop: 14 }]}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                عن التطبيق والمطور
              </Text>
              <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
                صدقة جارية ومصادر بيانات موثوقة.
              </Text>
            </View>
            <MaterialCommunityIcons
              name="heart-outline"
              size={24}
              color={QuranColors.gold}
            />
          </View>

          <View
            style={[
              styles.aboutCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            {/* Charity Banner */}
            <View style={styles.charityRow}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={22}
                color={QuranColors.emerald}
              />
              <Text style={[styles.charityTitle, { color: palette.primary }]}>
                صدقة جارية لوجه الله تعالى
              </Text>
            </View>

            <Text style={[styles.aboutText, { color: palette.text }]}>
              هذا التطبيق مجاني بالكامل وبدون أي إعلانات، صُمم بنية الصدقة الجارية لوجه الله تعالى وخدمة لكتابه العزيز وتيسير قراءته وتدبره.
            </Text>

            {/* Sources */}
            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            <View style={styles.sourcesSection}>
              <Text style={[styles.sourcesHeader, { color: palette.primary }]}>
                مصادر البيانات المعتمدة:
              </Text>
              <View style={styles.sourceBullet}>
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={QuranColors.emerald}
                />
                <Text style={[styles.sourceText, { color: palette.muted }]}>
                  الرسم العثماني وأحكام التجويد: مجمع الملك فهد لطباعة المصحف الشريف، ومشروع تنزيل المعتمد (Tanzil.net).
                </Text>
              </View>

              <View style={styles.sourceBullet}>
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color={QuranColors.emerald}
                />
                <Text style={[styles.sourceText, { color: palette.muted }]}>
                  التفسير: تيسير الكريم الرحمن في تفسير كلام المنان للشيخ عبدالرحمن السعدي.
                </Text>
              </View>
            </View>

            {/* Contact / Feedback Button */}
            <TouchableOpacity
              style={[
                styles.contactButton,
                { backgroundColor: palette.primary },
              ]}
              onPress={handleSendEmail}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.contactButtonText}>
                تواصل مع المطور أو اطلب ميزة
              </Text>
            </TouchableOpacity>

            <Text style={[styles.emailHint, { color: palette.muted }]}>
              للإبلاغ عن خطأ أو اقتراح تحسين: {SUPPORT_EMAIL}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 40,
    gap: 13,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 13,
    borderWidth: 1.2,
    padding: 12,
  },
  selectedCard: { borderWidth: 2 },
  themeText: { flex: 1, gap: 6 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  themeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    writingDirection: 'rtl',
  },
  themeDescription: {
    fontSize: 11,
    lineHeight: 19,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  preview: {
    width: 65,
    height: 68,
    borderRadius: 8,
    borderWidth: 1,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  previewLine: { height: 2, borderRadius: 2, opacity: 0.75 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 19,
    textAlign: 'start',
    writingDirection: 'rtl',
  },

  // كارت عن التطبيق والمطور
  aboutCard: {
    borderRadius: 15,
    borderWidth: 1.2,
    padding: 16,
    gap: 12,
  },
  charityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  charityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    writingDirection: 'rtl',
  },
  aboutText: {
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  sourcesSection: {
    gap: 8,
  },
  sourcesHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  sourceBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  sourceText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  contactButton: {
    marginTop: 6,
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emailHint: {
    fontSize: 11,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 2,
  },
});
