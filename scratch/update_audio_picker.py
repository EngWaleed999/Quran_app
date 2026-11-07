with open('src/features/audio-player/components/AudioPickerModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update imports
old_rn_imp = """  TouchableOpacity,
  View,
} from 'react-native';"""

new_rn_imp = """  TouchableOpacity,
  View,
  I18nManager,
} from 'react-native';"""

assert old_rn_imp in text, "old_rn_imp not found"
text = text.replace(old_rn_imp, new_rn_imp, 1)

# 2. Add verseGapSeconds state
old_state = "  const [pauseDelaySeconds, setPauseDelaySeconds] = useState(2);"
new_state = """  const [pauseDelaySeconds, setPauseDelaySeconds] = useState(2);
  const [verseGapSeconds, setVerseGapSeconds] = useState(0);"""
assert old_state in text, "old_state not found"
text = text.replace(old_state, new_state, 1)

# 3. Update handleConfirm setRepeatConfig
old_set_repeat = """      setRepeatConfig(
        mode === 'repeat'
          ? { repeatCount, pauseDelaySeconds }
          : { repeatCount: 1, pauseDelaySeconds: 0 }
      );"""

new_set_repeat = """      setRepeatConfig(
        mode === 'repeat'
          ? { repeatCount, pauseDelaySeconds, verseGapDelaySeconds: verseGapSeconds }
          : { repeatCount: 1, pauseDelaySeconds: 0, verseGapDelaySeconds: 0 }
      );"""
assert old_set_repeat in text, "old_set_repeat not found"
text = text.replace(old_set_repeat, new_set_repeat, 1)

# 4. Add UI for verseGapSeconds in repeat section
old_repeat_ui = """                <Text style={styles.helperText}>
                  سيُعاد تشغيل كل آية قبل الانتقال إلى الآية التالية.
                </Text>"""

new_repeat_ui = """                <Text style={styles.optionLabel}>التأخير بين الآيات (فاصل الانتقال)</Text>
                <View style={styles.optionsRow}>
                  {[0, 2, 3, 5].map((value) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setVerseGapSeconds(value)}
                      style={[
                        styles.option,
                        verseGapSeconds === value && styles.optionSelected,
                      ]}
                      disabled={isDownloading || isPreparing}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          verseGapSeconds === value && styles.optionTextSelected,
                        ]}
                      >
                        {value === 0 ? 'بدون' : toArabicNumerals(value) + ' ث'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.helperText}>
                  سيُعاد تشغيل كل آية قبل الانتقال إلى الآية التالية.
                </Text>"""
assert old_repeat_ui in text, "old_repeat_ui not found"
text = text.replace(old_repeat_ui, new_repeat_ui, 1)

# 5. Fix flexDirection: 'row-reverse'
text = text.replace("flexDirection: 'row-reverse',", "flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',")

# Ensure writingDirection: 'rtl' on right-aligned text styles
text = text.replace("textAlign: 'right',", "textAlign: 'right',\n    writingDirection: 'rtl',")

with open('src/features/audio-player/components/AudioPickerModal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("AudioPickerModal.tsx updated successfully!")
