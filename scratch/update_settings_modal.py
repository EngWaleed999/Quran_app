with open('src/features/settings/components/SettingsModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_rn_imp = """  TouchableOpacity,
  Modal,
} from 'react-native';"""

new_rn_imp = """  TouchableOpacity,
  Modal,
  I18nManager,
} from 'react-native';"""

if old_rn_imp in text:
    text = text.replace(old_rn_imp, new_rn_imp, 1)

text = text.replace("flexDirection: 'row-reverse',", "flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',")

with open('src/features/settings/components/SettingsModal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SettingsModal.tsx updated successfully!")
