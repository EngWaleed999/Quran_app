with open('src/features/audio-player/stores/useAudioStore.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target = """        selectedReciter: RECITERS[0],
        repeatConfig: { repeatCount: 3, pauseDelaySeconds: 2 },
        status: 'idle',"""

replacement = """        selectedReciter: RECITERS[0],
        repeatConfig: { repeatCount: 3, pauseDelaySeconds: 2, verseGapDelaySeconds: 0 },
        status: 'idle',"""

assert target in text, "target not found"
text = text.replace(target, replacement, 1)

target2 = """        setRepeatConfig: (config) =>
          set({
            repeatConfig: {
              repeatCount: Math.max(1, Math.floor(config.repeatCount)),
              pauseDelaySeconds: Math.max(0, config.pauseDelaySeconds),
            },
          }),"""

replacement2 = """        setRepeatConfig: (config) =>
          set({
            repeatConfig: {
              repeatCount: Math.max(1, Math.floor(config.repeatCount)),
              pauseDelaySeconds: Math.max(0, config.pauseDelaySeconds),
              verseGapDelaySeconds: Math.max(0, config.verseGapDelaySeconds ?? 0),
            },
          }),"""

assert target2 in text, "target2 not found"
text = text.replace(target2, replacement2, 1)

with open('src/features/audio-player/stores/useAudioStore.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print("useAudioStore.ts updated successfully!")
