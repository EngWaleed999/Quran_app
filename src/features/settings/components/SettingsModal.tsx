import React from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppText as Text } from "../../../core/theme/components/AppText";
import { AppearanceMode, getQuranPalette } from "../../../core/theme/theme";
import { useAppPreferences } from "../../../core/theme/preferencesStore";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

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
    mode: "classic",
    title: "المصحف التقليدي",
    description: "خلفية ورقية دافئة ومريحة للقراءة الطويلة.",
    icon: "book-open-page-variant",
    sampleBackground: "#FFF8F0",
    sampleSurface: "#FFFFFF",
    sampleText: "#1F513F",
  },
  {
    mode: "soft",
    title: "الأخضر الهادئ",
    description: "درجة خضراء خفيفة تقلل التباين الحاد.",
    icon: "leaf",
    sampleBackground: "#EEF4EF",
    sampleSurface: "#FBFDFB",
    sampleText: "#2F6E52",
  },
  {
    mode: "dark",
    title: "الوضع الليلي",
    description: "سطح داكن ونص فاتح للاستخدام في الإضاءة المنخفضة.",
    icon: "moon-waning-crescent",
    sampleBackground: "#121413",
    sampleSurface: "#1C201E",
    sampleText: "#D4B25E",
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const appearance = useAppPreferences((state) => state.appearance);
  const setAppearance = useAppPreferences((state) => state.setAppearance);
  const palette = getQuranPalette(appearance);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: palette.surface,
              borderBottomColor: palette.border,
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

        <View style={styles.content}>
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
                        { backgroundColor: option.sampleText, width: "68%" },
                      ]}
                    />
                    <View
                      style={[
                        styles.previewLine,
                        { backgroundColor: option.sampleText, width: "88%" },
                      ]}
                    />
                    <View
                      style={[
                        styles.previewLine,
                        { backgroundColor: option.sampleText, width: "52%" },
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

          {/* <View style={[styles.footer, { borderTopColor: palette.border }]}>
            <Text style={[styles.footerText, { color: palette.muted }]}>تطبيق القرآن الكريم • يعمل محلياً دون اتصال</Text>
          </View> */}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    writingDirection: "rtl",
  },
  content: { paddingHorizontal: 16, paddingTop: 22, gap: 13 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 19, fontWeight: "bold", textAlign: "auto" },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    textAlign: "auto",
    writingDirection: "rtl",
  },
  themeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 13,
    borderWidth: 1.2,
    padding: 12,
  },
  selectedCard: { borderWidth: 2 },
  themeText: { flex: 1, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  themeTitle: { fontSize: 14, fontWeight: "bold" },
  themeDescription: {
    fontSize: 11,
    lineHeight: 19,
    textAlign: "auto",
    writingDirection: "rtl",
  },
  preview: {
    width: 65,
    height: 68,
    borderRadius: 8,
    borderWidth: 1,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  previewPage: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  previewLine: { height: 2, borderRadius: 2, opacity: 0.75 },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 19,
    textAlign: "auto",
    writingDirection: "rtl",
  },
  footer: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 14,
    alignItems: "center",
  },
  footerText: { fontSize: 10 },
});
