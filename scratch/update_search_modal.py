with open('src/features/search/components/SearchModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update imports
old_rn_imp = """  FlatList,
  Modal,
} from 'react-native';"""

new_rn_imp = """  FlatList,
  Modal,
  I18nManager,
} from 'react-native';"""

if old_rn_imp in text:
    text = text.replace(old_rn_imp, new_rn_imp, 1)

# Replace all flexDirection: 'row-reverse' with flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse'
text = text.replace("flexDirection: 'row-reverse',", "flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',")

# Ensure writingDirection: 'rtl' on right-aligned texts
text = text.replace("textAlign: 'right',", "textAlign: 'right',\n    writingDirection: 'rtl',")

with open('src/features/search/components/SearchModal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SearchModal.tsx updated successfully!")
