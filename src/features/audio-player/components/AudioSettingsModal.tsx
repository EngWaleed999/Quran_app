import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { AppText as Text } from "../../../core/theme/components/AppText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { QuranColors } from "../../../core/theme/theme";
import { AudioActionMode, RepeatConfig } from "../types/audio.types";
import { useAudioStore } from "../stores/useAudioStore";

interface AudioSettingsModalProps {
  visible: boolean;
  mode: AudioActionMode;
  onClose: () => void;
}

const SURAH_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: "مرة", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "∞ بلا نهاية", value: null },
];
const REPEAT_OPTIONS = [1, 2, 3, 5, 10];
const DELAY_OPTIONS = [0, 1, 2, 3, 5, 10];

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  visible,
  mode,
  onClose,
}) => {
  const theme = useTheme();
  const tilawahConfig = useAudioStore((state) => state.tilawahConfig);
  const repeatModeConfig = useAudioStore((state) => state.repeatModeConfig);
  const setRepeatConfig = useAudioStore((state) => state.setRepeatConfig);

  const activeSavedConfig =
    mode === "repeat" ? repeatModeConfig : tilawahConfig;
  const [draft, setDraft] = useState<RepeatConfig>(activeSavedConfig);

  useEffect(() => {
    if (visible) {
      setDraft(mode === "repeat" ? repeatModeConfig : tilawahConfig);
    }
  }, [visible, mode, repeatModeConfig, tilawahConfig]);

  const update = <K extends keyof RepeatConfig>(
    key: K,
    value: RepeatConfig[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const renderNumbers = (
    values: number[],
    selected: number,
    onSelect: (value: number) => void,
    suffix?: string,
  ) => (
    <View style={styles.optionsRow}>
      {values.map((value) => (
        <TouchableOpacity
          key={value}
          onPress={() => onSelect(value)}
          style={[
            styles.option,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
            },
            selected === value && {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.optionText,
              selected === value && styles.optionTextSelected,
            ]}
          >
            {suffix ? (value === 0 ? "بدون" : value + " " + suffix) : value}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const save = () => {
    setRepeatConfig(draft, mode);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
          <View
            style={[styles.handle, { backgroundColor: theme.colors.outline }]}
          />
          <View
            style={[styles.header, { borderBottomColor: theme.colors.outline }]}
          >
            <View
              style={[
                styles.titleIcon,
                {
                  backgroundColor: theme.dark
                    ? "rgba(47,120,94,0.2)"
                    : "rgba(31,81,63,0.08)",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="tune-variant"
                size={21}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                إعدادات {mode === "repeat" ? "الترديد" : "التلاوة"}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                تُحفظ اختياراتك وتُطبّق على التشغيل الحالي
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.section,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.outline,
                },
              ]}
            >
              <Text
                style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
              >
                تكرار المقطع حتى نهاية السورة
              </Text>
              <Text
                style={[
                  styles.helper,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                تبدأ الدورة الأولى من الآية التي اخترتها حتى نهاية السورة، ثم
                يُعاد تشغيل السورة كاملة من بدايتها. يشمل العدد التشغيل الأول.
              </Text>
              <View style={styles.optionsRow}>
                {SURAH_OPTIONS.map((option) => {
                  const selected = draft.surahRepeatCount === option.value;
                  return (
                    <TouchableOpacity
                      key={option.label}
                      onPress={() => update("surahRepeatCount", option.value)}
                      style={[
                        styles.option,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.outline,
                        },
                        selected && {
                          backgroundColor: theme.colors.surfaceVariant,
                          borderColor: theme.colors.primary,
                        },
                        option.value === null && styles.infiniteOption,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {mode === "repeat" ? (
              <View
                style={[
                  styles.section,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor: theme.colors.outline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  تكرار الآية
                </Text>
                <Text
                  style={[
                    styles.helper,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  عدد مرات تشغيل كل آية قبل الانتقال إلى الآية التالية.
                </Text>
                {renderNumbers(
                  REPEAT_OPTIONS,
                  draft.repeatCount,
                  (value) => update("repeatCount", value),
                  "مرات",
                )}
                <Text
                  style={[
                    styles.fieldLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  الفاصل بين تكرارات الآية
                </Text>
                {renderNumbers(
                  DELAY_OPTIONS,
                  draft.pauseDelaySeconds,
                  (value) => update("pauseDelaySeconds", value),
                  "ث",
                )}
                <Text
                  style={[
                    styles.fieldLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  الفاصل بين الآيات
                </Text>
                {renderNumbers(
                  DELAY_OPTIONS,
                  draft.verseGapDelaySeconds ?? 0,
                  (value) => update("verseGapDelaySeconds", value),
                  "ث",
                )}
              </View>
            ) : (
              <View
                style={[
                  styles.section,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor: theme.colors.outline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  الفاصل بين الآيات المتتالية
                </Text>
                <Text
                  style={[
                    styles.helper,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  إضافة فترة صمت قصيرة بين كل آية والتي تليها أثناء الاستماع
                  المتواصل.
                </Text>
                {renderNumbers(
                  DELAY_OPTIONS,
                  draft.verseGapDelaySeconds ?? 0,
                  (value) => update("verseGapDelaySeconds", value),
                  "ث",
                )}
              </View>
            )}

            <View
              style={[
                styles.info,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text
                style={[
                  styles.infoText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                عند اختيار «بلا نهاية» سيستمر تكرار المقطع من آية البداية
                المحددة دون حد تلقائي. أوقف التلاوة من شريط التشغيل عند
                الانتهاء.
              </Text>
            </View>
            <TouchableOpacity
              onPress={save}
              style={[
                styles.saveButton,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  { color: theme.colors.onPrimary },
                ]}
              >
                حفظ 
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingBottom: 20,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D8D5CF",
    alignSelf: "center",
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: QuranColors.parchmentBorder,
  },
  titleIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(31,81,63,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, alignItems: "center", gap: 18 },
  title: { color: QuranColors.emeraldDark, fontSize: 17, fontWeight: "bold",
 },
  subtitle: {
    color: QuranColors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "auto",
    writingDirection: "rtl",
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 16, gap: 12 },
  section: {
    borderWidth: 1,
    borderColor: QuranColors.parchmentBorder,
    borderRadius: 12,
    padding: 13,
    gap: 10,
    backgroundColor: QuranColors.parchment,
  },
  sectionTitle: {
    color: QuranColors.emeraldDark,
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
    writingDirection: "rtl",
  },
  helper: {
    color: QuranColors.textMuted,
    fontSize: 12,
    lineHeight: 21,
    textAlign: "right",
    writingDirection: "rtl",
  },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  option: {
    minWidth: 43,
    minHeight: 39,
    borderWidth: 1,
    borderColor: QuranColors.parchmentBorder,
    borderRadius: 8,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  optionSelected: {
    borderColor: QuranColors.emerald,
    backgroundColor: "rgba(31,81,63,0.1)",
  },
  infiniteOption: { minWidth: 95 },
  optionText: { color: QuranColors.textDark, fontSize: 12, fontWeight: "600" },
  optionTextSelected: { color: QuranColors.emerald, fontWeight: "bold" },
  fieldLabel: {
    color: QuranColors.textMuted,
    fontSize: 12,
    textAlign: "auto",
    writingDirection: "rtl",
    marginTop: 3,
  },
  info: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(31,81,63,0.07)",
  },
  infoText: {
    flex: 1,
    color: QuranColors.textMuted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "auto",
    writingDirection: "rtl",
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 10,
    alignItems: "center",
    lineHeight:25,
    justifyContent: "center",
    backgroundColor: QuranColors.emerald,
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
});
