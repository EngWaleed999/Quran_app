import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SQLiteDatabase } from 'expo-sqlite';
import { QuranColors } from '../../../core/theme/theme';
import { QuranRepository } from '../../../core/database/quranRepository';
import { KhatmahService } from '../services/khatmahService';
import { DailyWird } from '../types/khatmah.types';

interface KhatmahModalProps {
  visible: boolean;
  db: SQLiteDatabase;
  currentPage: number;
  onClose: () => void;
  onNavigateToPage: (page: number, verseKey?: string) => void;
}

export const KhatmahModal: React.FC<KhatmahModalProps> = ({
  visible,
  db,
  currentPage,
  onClose,
  onNavigateToPage,
}) => {
  const [wird, setWird] = useState<DailyWird | null>(null);
  const [khatmahCount, setKhatmahCount] = useState(1);
  const [durationDays, setDurationDays] = useState('30');
  const [startFrom, setStartFrom] = useState<'beginning' | 'current'>('beginning');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const refresh = async () => {
    const current = await KhatmahService.getDailyWird(db);
    setWird(current);
  };

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    void KhatmahService.getDailyWird(db)
      .then((result) => {
        if (active) {
          setWird(result);
          setCompleted(false);
        }
      })
      .catch((error) => {
        console.warn('[KhatmahModal] Could not load plan:', error);
        Alert.alert('تعذر تحميل ختمتي', 'حدث خطأ أثناء قراءة خطة الختمة.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [visible, db]);

  const createPlan = async () => {
    const days = Number.parseInt(durationDays, 10);
    if (!Number.isInteger(days) || days < 1 || days > 3660) {
      Alert.alert('مدة غير صحيحة', 'أدخل عدد أيام بين 1 و3660.');
      return;
    }
    try {
      setLoading(true);
      let startGlobalAyah = 1;
      if (startFrom === 'current') {
        const pageAyahs = QuranRepository.getPageAyahsSync(db, currentPage);
        const firstAyah = pageAyahs[0];
        if (firstAyah) {
          startGlobalAyah = QuranRepository.getGlobalAyahNumberSync(
            db,
            firstAyah.sura_no,
            firstAyah.aya_no
          );
        }
      }
      await KhatmahService.createPlan(db, {
        khatmahCount,
        durationDays: days,
        startGlobalAyah,
      });
      await refresh();
      setCompleted(false);
    } catch (error) {
      Alert.alert('تعذر إنشاء الخطة', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  };

  const completeWird = async () => {
    Alert.alert('إنهاء الورد', 'هل أتممت قراءة الورد المحدد لهذا اليوم؟', [
      { text: 'متابعة القراءة', style: 'cancel' },
      {
        text: 'نعم، أنهيت الورد',
        onPress: async () => {
          try {
            setLoading(true);
            const next = await KhatmahService.completeDailyWird(db);
            setWird(next);
            setCompleted(!next);
          } catch (error) {
            Alert.alert('تعذر تحديث التقدم', error instanceof Error ? error.message : 'حاول مرة أخرى.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const stopPlan = () => {
    Alert.alert('إيقاف الختمة', 'سيتم إيقاف الخطة الحالية مع الاحتفاظ بسجلها. هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إيقاف الخطة',
        style: 'destructive',
        onPress: async () => {
          await KhatmahService.deleteActivePlan(db);
          setWird(null);
          setCompleted(false);
        },
      },
    ]);
  };

  const startVerse = wird
    ? QuranRepository.getAyahByGlobalNumberSync(db, wird.startGlobalAyah)
    : null;
  const endVerse = wird
    ? QuranRepository.getAyahByGlobalNumberSync(db, wird.endGlobalAyah)
    : null;

  const goToWird = () => {
    if (!startVerse) return;
    onClose();
    onNavigateToPage(startVerse.page, startVerse.sura_no + ':' + startVerse.aya_no);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton} accessibilityLabel="إغلاق">
            <MaterialCommunityIcons name="arrow-right" size={24} color={QuranColors.emerald} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ختمتي</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {loading ? <Text style={styles.helper}>جاري تحديث الخطة...</Text> : null}

          {completed ? (
            <View style={styles.successCard}>
              <MaterialCommunityIcons name="trophy-outline" size={54} color={QuranColors.gold} />
              <Text style={styles.successTitle}>تقبّل الله منك ختمتك</Text>
              <Text style={styles.helper}>أكملت جميع الأجزاء المحددة في خطتك. يمكنك إنشاء خطة جديدة متى شئت.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setCompleted(false)}>
                <Text style={styles.primaryButtonText}>إنشاء خطة جديدة</Text>
              </TouchableOpacity>
            </View>
          ) : wird ? (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.eyebrow}>خطتك الحالية</Text>
                <Text style={styles.planTitle}>{wird.plan.khatmahCount} ختمة خلال {wird.totalDays} يوماً</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: wird.progressPercent + '%' }]} />
                </View>
                <View style={styles.progressMeta}>
                  <Text style={styles.progressText}>{Math.round(wird.progressPercent)}٪ مكتمل</Text>
                  <Text style={styles.progressText}>{wird.completedInPlan.toLocaleString('ar')} / {wird.plan.totalAyahs.toLocaleString('ar')} آية</Text>
                </View>
              </View>

              <View style={styles.wirdCard}>
                <View style={styles.wirdHeading}>
                  <Text style={styles.wirdTitle}>وردك الحالي</Text>
                  <Text style={styles.dayBadge}>اليوم {wird.dayNumber} من {wird.totalDays}</Text>
                </View>
                <Text style={styles.metric}>{wird.dailyTargetPages.toLocaleString('ar')} صفحة تقريباً</Text>
                <Text style={styles.metricSub}>{wird.dailyTargetAyahs.toLocaleString('ar')} آية في هذا الورد</Text>
                {startVerse && endVerse ? (
                  <View style={styles.rangeBox}>
                    <Text style={styles.rangeText}>من سورة {startVerse.sura_name_ar} • الآية {startVerse.aya_no}</Text>
                    <MaterialCommunityIcons name="arrow-down" size={18} color={QuranColors.gold} />
                    <Text style={styles.rangeText}>إلى سورة {endVerse.sura_name_ar} • الآية {endVerse.aya_no}</Text>
                    {wird.wrapsAroundEnd ? <Text style={styles.helper}>يمتد الورد من نهاية المصحف إلى بدايته.</Text> : null}
                  </View>
                ) : null}
                <Text style={styles.helper}>تم تظليل آيات هذا الورد في صفحات المصحف باللون الأخضر. يمكنك الرجوع إليها في أي وقت قبل إنهائها.</Text>
                <TouchableOpacity onPress={goToWird} style={styles.secondaryButton}>
                  <MaterialCommunityIcons name="book-open-page-variant-outline" size={19} color={QuranColors.emerald} />
                  <Text style={styles.secondaryButtonText}>الانتقال إلى بداية الورد</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={completeWird} style={styles.primaryButton} disabled={loading}>
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>انتهيت من الورد اليوم</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={stopPlan} style={styles.stopButton}>
                <Text style={styles.stopText}>إيقاف الخطة الحالية</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.formCard}>
              <MaterialCommunityIcons name="book-check-outline" size={44} color={QuranColors.emerald} />
              <Text style={styles.formTitle}>خطّط لختمتك</Text>
              <Text style={styles.helper}>اختر عدد الختمات والمدة، وسنحسب لك مقدار القراءة اليومي ونظلل آيات وردك داخل المصحف.</Text>

              <Text style={styles.label}>كم ختمة تريد؟</Text>
              <View style={styles.choices}>
                {[1, 2, 3, 5, 10].map((value) => (
                  <TouchableOpacity key={value} onPress={() => setKhatmahCount(value)} style={[styles.choice, khatmahCount === value && styles.choiceSelected]}>
                    <Text style={[styles.choiceText, khatmahCount === value && styles.choiceTextSelected]}>{value.toLocaleString('ar')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>خلال كم يوماً؟</Text>
              <TextInput
                value={durationDays}
                onChangeText={(value) => setDurationDays(value.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                textAlign="right"
                style={styles.daysInput}
                maxLength={4}
              />

              <Text style={styles.label}>من أين تبدأ؟</Text>
              <View style={styles.startChoices}>
                <TouchableOpacity onPress={() => setStartFrom('beginning')} style={[styles.startChoice, startFrom === 'beginning' && styles.choiceSelected]}>
                  <Text style={[styles.startChoiceText, startFrom === 'beginning' && styles.choiceTextSelected]}>من بداية المصحف</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStartFrom('current')} style={[styles.startChoice, startFrom === 'current' && styles.choiceSelected]}>
                  <Text style={[styles.startChoiceText, startFrom === 'current' && styles.choiceTextSelected]}>من موضعي الحالي</Text>
                </TouchableOpacity>
              </View>

              {Number(durationDays) > 0 && Number(durationDays) <= 3660 ? (
                <View style={styles.preview}>
                  <Text style={styles.previewTitle}>هدفك اليومي التقريبي</Text>
                  <Text style={styles.previewMetric}>{Math.ceil((6236 * khatmahCount / Number(durationDays)) / 10.3).toLocaleString('ar')} صفحة</Text>
                  <Text style={styles.helper}>{Math.ceil(6236 * khatmahCount / Number(durationDays)).toLocaleString('ar')} آية يومياً في المتوسط</Text>
                </View>
              ) : null}

              <TouchableOpacity onPress={createPlan} style={styles.primaryButton} disabled={loading}>
                <Text style={styles.primaryButtonText}>إنشاء خطة ختمتي</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: QuranColors.parchment },
  header: { minHeight: 58, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: QuranColors.parchmentBorder },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', writingDirection: 'rtl', fontSize: 18, fontWeight: 'bold', color: QuranColors.emeraldDark },
  content: { padding: 16, gap: 12, flexGrow: 1 },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: QuranColors.parchmentBorder, padding: 15, gap: 10 },
  eyebrow: { color: QuranColors.textMuted, fontSize: 12, textAlign: 'right' },
  planTitle: { color: QuranColors.emeraldDark, fontWeight: 'bold', fontSize: 18, textAlign: 'right' },
  progressTrack: { height: 8, backgroundColor: 'rgba(197,155,39,0.2)', borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: QuranColors.emerald, borderRadius: 8 },
  progressMeta: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 8 },
  progressText: { color: QuranColors.textMuted, fontSize: 11 },
  wirdCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: QuranColors.parchmentBorder, padding: 15, gap: 10 },
  wirdHeading: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  wirdTitle: { color: QuranColors.emeraldDark, fontSize: 17, fontWeight: 'bold' },
  dayBadge: { color: QuranColors.emerald, backgroundColor: 'rgba(31,81,63,0.08)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, fontSize: 11, fontWeight: 'bold' },
  metric: { color: QuranColors.emerald, fontSize: 24, textAlign: 'right', fontWeight: 'bold' },
  metricSub: { color: QuranColors.textMuted, textAlign: 'right', fontSize: 12 },
  rangeBox: { backgroundColor: QuranColors.parchment, borderRadius: 10, padding: 12, alignItems: 'center', gap: 7 },
  rangeText: { color: QuranColors.textDark, fontWeight: '600', fontSize: 13, textAlign: 'center' },
  helper: { color: QuranColors.textMuted, fontSize: 12, textAlign: 'center', writingDirection: 'rtl', lineHeight: 21 },
  primaryButton: { minHeight: 48, backgroundColor: QuranColors.emerald, borderRadius: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  secondaryButton: { minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: QuranColors.emerald, borderRadius: 10, padding: 10 },
  secondaryButtonText: { color: QuranColors.emerald, fontWeight: 'bold', fontSize: 13 },
  stopButton: { alignItems: 'center', padding: 12 },
  stopText: { color: '#B23A3A', fontSize: 12, fontWeight: '600' },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: QuranColors.parchmentBorder, padding: 17, gap: 13, alignItems: 'center' },
  formTitle: { color: QuranColors.emeraldDark, fontWeight: 'bold', fontSize: 19 },
  label: { alignSelf: 'stretch', color: QuranColors.emeraldDark, fontSize: 13, fontWeight: 'bold', textAlign: 'right', writingDirection: 'rtl' },
  choices: { flexDirection: 'row-reverse', gap: 8, alignSelf: 'stretch' },
  choice: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: QuranColors.parchmentBorder, borderRadius: 8, backgroundColor: QuranColors.parchment },
  choiceSelected: { borderColor: QuranColors.emerald, backgroundColor: 'rgba(31,81,63,0.1)' },
  choiceText: { color: QuranColors.textDark, fontWeight: '600' },
  choiceTextSelected: { color: QuranColors.emerald, fontWeight: 'bold' },
  daysInput: { alignSelf: 'stretch', backgroundColor: QuranColors.parchment, borderWidth: 1, borderColor: QuranColors.parchmentBorder, borderRadius: 8, minHeight: 46, paddingHorizontal: 12, color: QuranColors.textDark, fontSize: 16 },
  startChoices: { flexDirection: 'row-reverse', gap: 8, alignSelf: 'stretch' },
  startChoice: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: QuranColors.parchmentBorder, borderRadius: 8, backgroundColor: QuranColors.parchment, paddingHorizontal: 5 },
  startChoiceText: { color: QuranColors.textDark, fontSize: 12, fontWeight: '600' },
  preview: { alignSelf: 'stretch', backgroundColor: 'rgba(197,155,39,0.1)', padding: 12, borderRadius: 10, alignItems: 'center', gap: 5 },
  previewTitle: { color: QuranColors.textMuted, fontSize: 12 },
  previewMetric: { color: QuranColors.emeraldDark, fontSize: 24, fontWeight: 'bold' },
  successCard: { flex: 1, minHeight: 350, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, gap: 15 },
});
