import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QuranColors } from '../../../core/theme/theme';
import {
  Bookmark,
  BookmarkType,
  BOOKMARK_TYPE_COLORS,
  BOOKMARK_TYPE_LABELS,
} from '../types/bookmark.types';

interface BookmarksModalProps {
  visible: boolean;
  bookmarks: Bookmark[];
  onClose: () => void;
  onNavigate: (bookmark: Bookmark) => void;
  onRemove: (type: BookmarkType) => void;
}

const TYPES: BookmarkType[] = ['tracking', 'reading', 'memorization'];

export const BookmarksModal: React.FC<BookmarksModalProps> = ({
  visible,
  bookmarks,
  onClose,
  onNavigate,
  onRemove,
}) => {
  const [filter, setFilter] = useState<BookmarkType | 'all'>('all');
  const filtered = useMemo(
    () => filter === 'all' ? bookmarks : bookmarks.filter((item) => item.type === filter),
    [bookmarks, filter]
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton} accessibilityLabel="إغلاق">
            <MaterialCommunityIcons name="arrow-right" size={24} color={QuranColors.emerald} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>الفواصل المحفوظة</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.filters}>
          <TouchableOpacity onPress={() => setFilter('all')} style={[styles.filterChip, filter === 'all' && styles.filterActive]}>
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>الكل</Text>
          </TouchableOpacity>
          {TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setFilter(type)}
              style={[styles.filterChip, filter === type && { borderColor: BOOKMARK_TYPE_COLORS[type], backgroundColor: BOOKMARK_TYPE_COLORS[type] + '18' }]}
            >
              <View style={[styles.dot, { backgroundColor: BOOKMARK_TYPE_COLORS[type] }]} />
              <Text style={[styles.filterText, filter === type && { color: BOOKMARK_TYPE_COLORS[type] }]}>
                {BOOKMARK_TYPE_LABELS[type]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="bookmark-multiple-outline" size={48} color={QuranColors.gold} />
              <Text style={styles.emptyTitle}>لا توجد فواصل هنا بعد</Text>
              <Text style={styles.emptySubtitle}>اضغط مطولاً على آية واحفظ موضعاً للمتابعة أو القراءة أو الحفظ.</Text>
            </View>
          ) : filtered.map((bookmark) => (
            <View key={bookmark.type} style={styles.card}>
              <View style={[styles.typeStripe, { backgroundColor: BOOKMARK_TYPE_COLORS[bookmark.type] }]} />
              <TouchableOpacity style={styles.cardContent} onPress={() => onNavigate(bookmark)} activeOpacity={0.75}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>سورة {bookmark.suraName}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: BOOKMARK_TYPE_COLORS[bookmark.type] + '18' }]}>
                    <Text style={[styles.typeBadgeText, { color: BOOKMARK_TYPE_COLORS[bookmark.type] }]}>{BOOKMARK_TYPE_LABELS[bookmark.type]}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>الآية {bookmark.ayaNo} • الصفحة {bookmark.page}</Text>
                {bookmark.ayahText ? <Text numberOfLines={2} style={styles.snippet}>{bookmark.ayahText}</Text> : null}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onRemove(bookmark.type)} style={styles.removeButton} accessibilityLabel="حذف الفاصل">
                <MaterialCommunityIcons name="delete-outline" size={21} color="#B23A3A" />
              </TouchableOpacity>
            </View>
          ))}
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
  filters: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, padding: 14 },
  filterChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: QuranColors.parchmentBorder, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  filterActive: { backgroundColor: 'rgba(31,81,63,0.08)', borderColor: QuranColors.emerald },
  filterText: { fontSize: 12, color: QuranColors.textMuted, fontWeight: '600' },
  filterTextActive: { color: QuranColors.emerald },
  dot: { width: 7, height: 7, borderRadius: 4 },
  list: { paddingHorizontal: 14, paddingBottom: 30, gap: 10 },
  card: { flexDirection: 'row-reverse', alignItems: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: QuranColors.parchmentBorder, overflow: 'hidden' },
  typeStripe: { width: 4 },
  cardContent: { flex: 1, padding: 12, gap: 5 },
  cardTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: QuranColors.emeraldDark },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: 'bold' },
  meta: { fontSize: 12, color: QuranColors.textMuted, textAlign: 'right', writingDirection: 'rtl' },
  snippet: { marginTop: 2, fontFamily: 'UthmanicHafs', color: QuranColors.textDark, fontSize: 13, lineHeight: 23, textAlign: 'right', writingDirection: 'rtl' },
  removeButton: { width: 42, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 70, gap: 12 },
  emptyTitle: { fontSize: 17, color: QuranColors.emeraldDark, fontWeight: 'bold' },
  emptySubtitle: { fontSize: 13, color: QuranColors.textMuted, textAlign: 'center', lineHeight: 23, writingDirection: 'rtl' },
});
