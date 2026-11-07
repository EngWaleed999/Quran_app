import re

with open('src/features/mushaf/components/TafsirModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update imports
old_imp = "import React, { useState, useEffect, useCallback } from 'react';"
new_imp = "import React, { useState, useEffect, useCallback, useMemo } from 'react';"
text = text.replace(old_imp, new_imp, 1)

old_rn_imp = "  ActivityIndicator,\n} from 'react-native';"
new_rn_imp = "  ActivityIndicator,\n  I18nManager,\n} from 'react-native';"
text = text.replace(old_rn_imp, new_rn_imp, 1)

# 2. Add sentences useMemo
target_ref = "  const latestRequestIdRef = React.useRef<number>(0);"
sentences_code = """  const latestRequestIdRef = React.useRef<number>(0);

  // تقسيم النص إلى جمل تنتهي بنقطة لتسهيل القراءة وتتبع التفسير مع فواصل جمالية
  const sentences = useMemo(() => {
    if (!tafsirText) return [];
    const raw = tafsirText.split(/(?<=\\.)\\s+/);
    return raw.map((s) => s.trim()).filter((s) => s.length > 0);
  }, [tafsirText]);"""
text = text.replace(target_ref, sentences_code, 1)

# 3. Update Tafsir rendering
old_body = """            ) : (
              <View style={styles.tafsirBodyContainer}>
                <Text
                  style={[styles.tafsirBodyText, isDark && styles.tafsirBodyTextDark]}
                  selectable
                >
                  {tafsirText}
                </Text>
              </View>
            )}"""

new_body = """            ) : (
              <View style={styles.tafsirBodyContainer}>
                {sentences.map((sentence, index) => (
                  <View key={index} style={styles.sentenceWrapper}>
                    {index > 0 && (
                      <View
                        style={[
                          styles.sentenceDivider,
                          isDark && styles.sentenceDividerDark,
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.tafsirBodyText,
                        isDark && styles.tafsirBodyTextDark,
                      ]}
                      selectable
                    >
                      {sentence}
                    </Text>
                  </View>
                ))}
              </View>
            )}"""
assert old_body in text, "old_body not found"
text = text.replace(old_body, new_body, 1)

# 4. Update styles
old_header_bar = """  headerBar: {
    flexDirection: 'row-reverse',"""
new_header_bar = """  headerBar: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',"""
text = text.replace(old_header_bar, new_header_bar, 1)

old_tabs_row = """  tabsRow: {
    flexDirection: 'row-reverse',"""
new_tabs_row = """  tabsRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',"""
text = text.replace(old_tabs_row, new_tabs_row, 1)

old_ayah_text = """  ayahText: {
    fontSize: 18,
    lineHeight: 32,
    color: QuranColors.emeraldDark,
    textAlign: 'center',
    fontWeight: '600',
  },"""
new_ayah_text = """  ayahText: {
    fontSize: 18,
    lineHeight: 32,
    color: QuranColors.emeraldDark,
    textAlign: 'center',
    writingDirection: 'rtl',
    fontWeight: '600',
  },"""
text = text.replace(old_ayah_text, new_ayah_text, 1)

old_tafsir_styles = """  tafsirBodyContainer: {
    paddingVertical: 4,
  },
  tafsirBodyText: {
    fontSize: 16.5,
    lineHeight: 30,
    color: '#2C2B29',
    textAlign: 'right',
  },
  tafsirBodyTextDark: {
    color: '#D8D5CD',
  },"""

new_tafsir_styles = """  tafsirBodyContainer: {
    paddingVertical: 4,
    width: '100%',
  },
  sentenceWrapper: {
    width: '100%',
  },
  sentenceDivider: {
    height: 1,
    backgroundColor: 'rgba(197, 155, 39, 0.2)',
    marginVertical: 12,
    width: '100%',
  },
  sentenceDividerDark: {
    backgroundColor: 'rgba(229, 192, 88, 0.18)',
  },
  tafsirBodyText: {
    fontSize: 16.5,
    lineHeight: 32,
    color: '#2C2B29',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tafsirBodyTextDark: {
    color: '#D8D5CD',
    textAlign: 'right',
    writingDirection: 'rtl',
  },"""
assert old_tafsir_styles in text, "old_tafsir_styles not found"
text = text.replace(old_tafsir_styles, new_tafsir_styles, 1)

with open('src/features/mushaf/components/TafsirModal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("TafsirModal.tsx updated successfully!")
