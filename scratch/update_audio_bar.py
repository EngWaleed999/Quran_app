with open('src/features/audio-player/components/AudioPlayerBar.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_rn_imp = "import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';"
new_rn_imp = "import { View, Text, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';"
assert old_rn_imp in text, "old_rn_imp not found"
text = text.replace(old_rn_imp, new_rn_imp, 1)

text = text.replace("flexDirection: 'row-reverse',", "flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',")

old_track_info = """  trackInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  surahName: {
    color: QuranColors.emeraldDark,
    fontWeight: 'bold',
    fontSize: 13,
  },
  trackStatus: {
    color: QuranColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },"""

new_track_info = """  trackInfo: {
    flex: 1,
    alignItems: I18nManager.isRTL ? 'flex-start' : 'flex-end',
  },
  surahName: {
    color: QuranColors.emeraldDark,
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  trackStatus: {
    color: QuranColors.textMuted,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },"""

assert old_track_info in text, "old_track_info not found"
text = text.replace(old_track_info, new_track_info, 1)

with open('src/features/audio-player/components/AudioPlayerBar.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("AudioPlayerBar.tsx updated successfully!")
