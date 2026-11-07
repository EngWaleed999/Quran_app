with open('src/features/surah-list/components/SurahDrawerModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update imports
old_rn_imp = """  FlatList,
  Modal,
} from 'react-native';"""

new_rn_imp = """  FlatList,
  Modal,
  I18nManager,
} from 'react-native';"""

assert old_rn_imp in text, "old_rn_imp not found"
text = text.replace(old_rn_imp, new_rn_imp, 1)

# 2. Update styles
old_header = """  header: {
    flexDirection: 'row-reverse',"""
new_header = """  header: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',"""
text = text.replace(old_header, new_header, 1)

old_surah_row = """  surahRow: {
    flexDirection: 'row-reverse',"""
new_surah_row = """  surahRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',"""
text = text.replace(old_surah_row, new_surah_row, 1)

old_surah_title = """  surahTitleRow: {
    flexDirection: 'row-reverse',"""
new_surah_title = """  surahTitleRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',"""
text = text.replace(old_surah_title, new_surah_title, 1)

old_surah_name = """  surahName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
  },
  currentSurahName: {
    color: QuranColors.emeraldDark,
    fontWeight: 'bold',
  },"""

new_surah_name = """  surahName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentSurahName: {
    color: QuranColors.emeraldDark,
    fontWeight: 'bold',
    textAlign: 'right',
    writingDirection: 'rtl',
  },"""
assert old_surah_name in text, "old_surah_name not found"
text = text.replace(old_surah_name, new_surah_name, 1)

old_surah_meta = """  surahMeta: {
    fontSize: 12,
    color: QuranColors.textMuted,
    textAlign: 'right',
  },"""

new_surah_meta = """  surahMeta: {
    fontSize: 12,
    color: QuranColors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },"""
assert old_surah_meta in text, "old_surah_meta not found"
text = text.replace(old_surah_meta, new_surah_meta, 1)

old_bottom_nav = """  bottomNavContainer: {
    flexDirection: 'row-reverse',"""
new_bottom_nav = """  bottomNavContainer: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',"""
text = text.replace(old_bottom_nav, new_bottom_nav, 1)

old_bm_badge = """  bookmarkBadge: {
    flexDirection: 'row-reverse',"""
new_bm_badge = """  bookmarkBadge: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',"""
text = text.replace(old_bm_badge, new_bm_badge, 1)

old_jump_btn = """  jumpBookmarkBtn: {
    flexDirection: 'row-reverse',"""
new_jump_btn = """  jumpBookmarkBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',"""
text = text.replace(old_jump_btn, new_jump_btn, 1)

with open('src/features/surah-list/components/SurahDrawerModal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SurahDrawerModal.tsx updated successfully!")
