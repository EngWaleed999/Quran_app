import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QuranColors } from '../../../core/theme/theme';
import { AudioActionMode, RepeatConfig } from '../types/audio.types';
import { useAudioStore } from '../stores/useAudioStore';

interface AudioSettingsModalProps {
  visible: boolean;
  mode: AudioActionMode;
  onClose: () => void;
}

const SURAH_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'مرة', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
  { label: '5', value: 5 }, { label: '10', value: 10 }, { label: '∞ بلا نهاية', value: null },
];
const REPEAT_OPTIONS = [1, 2, 3, 5, 10];
const DELAY_OPTIONS = [0, 1, 2, 3, 5, 10];

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({ visible, mode, onClose }) => {
  const savedConfig = useAudioStore((state) => state.repeatConfig);
  const setRepeatConfig = useAudioStore((state) => state.setRepeatConfig);
  const [draft, setDraft] = useState<RepeatConfig>(savedConfig);

  useEffect(() => {
    if (visible) setDraft(savedConfig);
  }, [visible, savedConfig]);

  const update = <K extends keyof RepeatConfig>(key: K, value: RepeatConfig[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const renderNumbers = (values: number[], selected: number, onSelect: (value: number) => void, suffix?: string) => (
    <View style={styles.optionsRow}>
      {values.map((value) => (
        <TouchableOpacity key={value} onPress={() => onSelect(value)} style={[styles.option, selected === value && styles.optionSelected]}>
          <Text style={[styles.optionText, selected === value && styles.optionTextSelected]}>
            {suffix ? (value === 0 ? 'بدون' : value + ' ' + suffix) : value}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const save = () => {
    setRepeatConfig(draft);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleIcon}><MaterialCommunityIcons name="tune-variant" size={21} color={QuranColors.emerald} /></View>
            <View style={styles.headerText}>
              <Text style={styles.title}>إعدادات {mode === 'repeat' ? 'الترديد' : 'التلاوة'}</Text>
              <Text style={styles.subtitle}>تُحفظ اختياراتك وتُطبّق على التشغيل الحالي</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={22} color={QuranColors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>تكرار قراءة السورة بالكامل</Text>
              <Text style={styles.helper}>عدد مرات تشغيل المقطع المحدد من السورة، وتشمل المرة الأولى. اختر «بلا نهاية» للاستمرار حتى توقفه بنفسك.</Text>
              <View style={styles.optionsRow}>
                {SURAH_OPTIONS.map((option) => {
                  const selected = draft.surahRepeatCount === option.value;
                  return (
                    <TouchableOpacity key={option.label} onPress={() => update('surahRepeatCount', option.value)} style={[styles.option, selected && styles.optionSelected, option.value === null && styles.infiniteOption]}>
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {mode === 'repeat' ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>تكرار الآية</Text>
                <Text style={styles.helper}>عدد مرات تشغيل كل آية قبل الانتقال إلى الآية التالية.</Text>
                {renderNumbers(REPEAT_OPTIONS, draft.repeatCount, (value) => update('repeatCount', value), 'مرات')}
                <Text style={styles.fieldLabel}>الفاصل بين تكرارات الآية</Text>
                {renderNumbers(DELAY_OPTIONS, draft.pauseDelaySeconds, (value) => update('pauseDelaySeconds', value), 'ث')}
                <Text style={styles.fieldLabel}>الفاصل بين الآيات</Text>
                {renderNumbers(DELAY_OPTIONS, draft.verseGapDelaySeconds ?? 0, (value) => update('verseGapDelaySeconds', value), 'ث')}
              </View>
            ) : null}

            <View style={styles.info}>
              <MaterialCommunityIcons name="information-outline" size={18} color={QuranColors.emerald} />
              <Text style={styles.infoText}>عند اختيار «بلا نهاية» ستستمر إعادة السورة دون حد تلقائي. أوقف التلاوة من شريط التشغيل عند الانتهاء.</Text>
            </View>
            <TouchableOpacity onPress={save} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>حفظ الإعدادات</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  backdrop: { flex: 1 },
  sheet: { maxHeight: '82%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, paddingBottom: 20 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#D8D5CF', alignSelf: 'center', marginBottom: 10 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: QuranColors.parchmentBorder },
  titleIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(31,81,63,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'flex-end', gap: 3 },
  title: { color: QuranColors.emeraldDark, fontSize: 17, fontWeight: 'bold' },
  subtitle: { color: QuranColors.textMuted, fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  section: { borderWidth: 1, borderColor: QuranColors.parchmentBorder, borderRadius: 12, padding: 13, gap: 10, backgroundColor: QuranColors.parchment },
  sectionTitle: { color: QuranColors.emeraldDark, fontWeight: 'bold', fontSize: 14, textAlign: 'right', writingDirection: 'rtl' },
  helper: { color: QuranColors.textMuted, fontSize: 12, lineHeight: 21, textAlign: 'right', writingDirection: 'rtl' },
  optionsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  option: { minWidth: 43, minHeight: 39, borderWidth: 1, borderColor: QuranColors.parchmentBorder, borderRadius: 8, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  optionSelected: { borderColor: QuranColors.emerald, backgroundColor: 'rgba(31,81,63,0.1)' },
  infiniteOption: { minWidth: 95 },
  optionText: { color: QuranColors.textDark, fontSize: 12, fontWeight: '600' },
  optionTextSelected: { color: QuranColors.emerald, fontWeight: 'bold' },
  fieldLabel: { color: QuranColors.textMuted, fontSize: 12, textAlign: 'right', writingDirection: 'rtl', marginTop: 3 },
  info: { flexDirection: 'row-reverse', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 10, backgroundColor: 'rgba(31,81,63,0.07)' },
  infoText: { flex: 1, color: QuranColors.textMuted, fontSize: 12, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },
  saveButton: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: QuranColors.emerald },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
});
