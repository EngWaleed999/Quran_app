import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../../core/theme/components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SQLiteDatabase } from 'expo-sqlite';
import { QuranColors } from '../../../core/theme/theme';
import { NotesService } from '../services/notesService';
import { AyahNote } from '../types/note.types';
import { SelectedAyahInfo } from '../../mushaf/components/AyahActionModal';

interface NotesModalProps {
  visible: boolean;
  db: SQLiteDatabase;
  draftAyah: SelectedAyahInfo | null;
  onClose: () => void;
  onNavigate: (note: AyahNote) => void;
}

export const NotesModal: React.FC<NotesModalProps> = ({
  visible,
  db,
  draftAyah,
  onClose,
  onNavigate,
}) => {
  const [notes, setNotes] = useState<AyahNote[]>([]);
  const [editingAyah, setEditingAyah] = useState<SelectedAyahInfo | null>(null);
  const [editingNote, setEditingNote] = useState<AyahNote | null>(null);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    const result = await NotesService.getAll(db);
    setNotes(result);
  };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const result = await NotesService.getAll(db);
        if (!cancelled) setNotes(result);
        if (draftAyah) {
          const existing = await NotesService.getByVerseKey(db, draftAyah.verseKey);
          if (!cancelled) {
            setEditingAyah(draftAyah);
            setEditingNote(existing);
            setNoteText(existing?.noteText ?? '');
          }
        } else {
          setEditingAyah(null);
          setEditingNote(null);
          setNoteText('');
        }
      } catch (error) {
        console.warn('[NotesModal] Could not load notes:', error);
        if (!cancelled) Alert.alert('تعذر فتح الملاحظات', 'حدث خطأ أثناء قراءة الملاحظات المحفوظة.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, draftAyah?.verseKey, db]);

  const handleEdit = async (note: AyahNote) => {
    const ayah: SelectedAyahInfo = {
      verseKey: note.verseKey,
      suraNo: note.suraNo,
      ayaNo: note.ayaNo,
      page: note.page,
      suraName: note.suraName,
      jozz: 1,
      ayahText: note.ayahText,
    };
    setEditingAyah(ayah);
    setEditingNote(note);
    setNoteText(note.noteText);
  };

  const handleSave = async () => {
    if (!editingAyah) return;
    const trimmed = noteText.trim();
    if (!trimmed) {
      Alert.alert('الملاحظة فارغة', 'اكتب ملاحظتك أولاً، أو احذف الملاحظة الحالية.');
      return;
    }
    try {
      await NotesService.save(db, {
        verseKey: editingAyah.verseKey,
        suraNo: editingAyah.suraNo,
        ayaNo: editingAyah.ayaNo,
        page: editingAyah.page,
        suraName: editingAyah.suraName,
        ayahText: editingAyah.ayahText ?? '',
        noteText: trimmed,
        createdAt: editingNote?.createdAt,
      });
      await reload();
      setEditingAyah(null);
      setEditingNote(null);
      setNoteText('');
    } catch (error) {
      console.warn('[NotesModal] Could not save note:', error);
      Alert.alert('تعذر حفظ الملاحظة', 'لم يتم حفظ التغيير. حاول مرة أخرى.');
    }
  };

  const handleDelete = () => {
    if (!editingAyah) return;
    Alert.alert('حذف الملاحظة', 'هل تريد حذف الملاحظة المرتبطة بهذه الآية؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await NotesService.delete(db, editingAyah.verseKey);
          await reload();
          setEditingAyah(null);
          setEditingNote(null);
          setNoteText('');
        },
      },
    ]);
  };

  const orderedNotes = useMemo(() => notes, [notes]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (editingAyah) {
              setEditingAyah(null);
              setEditingNote(null);
              setNoteText('');
            } else {
              onClose();
            }
          }} style={styles.headerButton} accessibilityLabel={editingAyah ? 'رجوع إلى الملاحظات' : 'إغلاق'}>
            <MaterialCommunityIcons name={editingAyah ? 'arrow-right' : 'close'} size={23} color={QuranColors.emerald} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editingAyah ? 'ملاحظة الآية' : 'ملاحظاتي'}</Text>
          <View style={styles.headerButton} />
        </View>

        {editingAyah ? (
          <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
            <View style={styles.ayahCard}>
              <Text style={styles.ayahMeta}>سورة {editingAyah.suraName} • الآية {editingAyah.ayaNo} • الصفحة {editingAyah.page}</Text>
              {!!editingAyah.ayahText && <Text style={styles.ayahText}>{editingAyah.ayahText}</Text>}
            </View>
            <Text style={styles.fieldLabel}>ملاحظتك</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              multiline
              textAlign="right"
              textAlignVertical="top"
              placeholder="اكتب تدبراً أو فائدة أو سؤالاً تريد الرجوع إليه..."
              placeholderTextColor={QuranColors.textMuted}
              style={styles.input}
              maxLength={5000}
              autoFocus
            />
            <Text style={styles.counter}>{noteText.length} / 5000</Text>
            <TouchableOpacity onPress={handleSave} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>حفظ الملاحظة</Text>
            </TouchableOpacity>
            {editingNote ? (
              <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                <MaterialCommunityIcons name="delete-outline" size={19} color="#B23A3A" />
                <Text style={styles.deleteButtonText}>حذف الملاحظة</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent}>
            {loading ? <Text style={styles.emptyText}>جاري تحميل الملاحظات...</Text> : null}
            {!loading && orderedNotes.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="note-text-outline" size={48} color={QuranColors.gold} />
                <Text style={styles.emptyTitle}>لا توجد ملاحظات بعد</Text>
                <Text style={styles.emptyText}>اضغط مطولاً على أي آية، ثم اختر إضافة ملاحظة لتسجيل فوائدك وتدبراتك.</Text>
              </View>
            ) : orderedNotes.map((note) => (
              <View key={note.verseKey} style={styles.noteCard}>
                <TouchableOpacity style={styles.noteMain} onPress={() => void handleEdit(note)}>
                  <Text style={styles.noteTitle}>سورة {note.suraName} • الآية {note.ayaNo}</Text>
                  <Text style={styles.noteBody} numberOfLines={3}>{note.noteText}</Text>
                  <Text style={styles.noteDate}>{new Date(note.updatedAt).toLocaleDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onNavigate(note)} style={styles.goButton} accessibilityLabel="الانتقال إلى الآية">
                  <MaterialCommunityIcons name="book-open-page-variant-outline" size={20} color={QuranColors.emerald} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: QuranColors.parchment },
  header: { minHeight: 58, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: QuranColors.parchmentBorder },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', writingDirection: 'rtl', fontSize: 18, fontWeight: 'bold', color: QuranColors.emeraldDark },
  editorContent: { padding: 16, gap: 12 },
  ayahCard: { borderWidth: 1, borderColor: QuranColors.parchmentBorder, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, gap: 10 },
  ayahMeta: { textAlign: 'right', writingDirection: 'rtl', color: QuranColors.emerald, fontWeight: 'bold', fontSize: 13 },
  ayahText: { color: QuranColors.textDark, fontFamily: 'UthmanicHafs', fontSize: 17, lineHeight: 34, textAlign: 'center', writingDirection: 'rtl' },
  fieldLabel: { textAlign: 'right', writingDirection: 'rtl', color: QuranColors.emeraldDark, fontSize: 14, fontWeight: 'bold' },
  input: { minHeight: 190, maxHeight: 360, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: QuranColors.parchmentBorder, borderRadius: 12, padding: 14, fontSize: 15, lineHeight: 25, color: QuranColors.textDark, writingDirection: 'rtl' },
  counter: { textAlign: 'left', color: QuranColors.textMuted, fontSize: 11 },
  primaryButton: { backgroundColor: QuranColors.emerald, borderRadius: 10, alignItems: 'center', paddingVertical: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  deleteButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  deleteButtonText: { color: '#B23A3A', fontWeight: '600' },
  listContent: { padding: 14, gap: 10, flexGrow: 1 },
  noteCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: QuranColors.parchmentBorder, borderRadius: 12, padding: 12 },
  noteMain: { flex: 1, gap: 5 },
  noteTitle: { color: QuranColors.emeraldDark, fontWeight: 'bold', fontSize: 14, textAlign: 'right', writingDirection: 'rtl' },
  noteBody: { color: QuranColors.textDark, fontSize: 13, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl' },
  noteDate: { color: QuranColors.textMuted, fontSize: 10, textAlign: 'right' },
  goButton: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, minHeight: 250, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25, gap: 12 },
  emptyTitle: { color: QuranColors.emeraldDark, fontWeight: 'bold', fontSize: 17 },
  emptyText: { color: QuranColors.textMuted, textAlign: 'center', writingDirection: 'rtl', lineHeight: 23, fontSize: 13 },
});
