with open('src/features/mushaf/components/AyahActionModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update imports
old_rn_imp = """  ScrollView,
  Share,
} from 'react-native';"""

new_rn_imp = """  ScrollView,
  Share,
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

old_badges_row = """  badgesRow: {
    flexDirection: 'row-reverse',"""
new_badges_row = """  badgesRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',"""
text = text.replace(old_badges_row, new_badges_row, 1)

old_badge_pill = """  badgePill: {
    flexDirection: 'row-reverse',"""
new_badge_pill = """  badgePill: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',"""
text = text.replace(old_badge_pill, new_badge_pill, 1)

old_action_row = """  actionRow: {
    flexDirection: 'row-reverse',"""
new_action_row = """  actionRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',"""
text = text.replace(old_action_row, new_action_row, 1)

old_action_title = """  actionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: QuranColors.textDark,
    textAlign: 'right',
  },"""
new_action_title = """  actionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: QuranColors.textDark,
    textAlign: 'right',
    writingDirection: 'rtl',
  },"""
text = text.replace(old_action_title, new_action_title, 1)

old_action_sub = """  actionSubtitle: {
    fontSize: 12,
    color: QuranColors.textMuted,
    textAlign: 'right',
  },"""
new_action_sub = """  actionSubtitle: {
    fontSize: 12,
    color: QuranColors.textMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },"""
text = text.replace(old_action_sub, new_action_sub, 1)

with open('src/features/mushaf/components/AyahActionModal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("AyahActionModal.tsx updated successfully!")
