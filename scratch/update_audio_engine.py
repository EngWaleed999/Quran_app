with open('src/features/audio-player/services/audioPlayerEngine.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target1 = """    this.repeatConfig = {
      repeatCount: Math.max(1, Math.floor(repeatConfig.repeatCount)),
      pauseDelaySeconds: Math.max(0, repeatConfig.pauseDelaySeconds),
    };"""

replacement1 = """    this.repeatConfig = {
      repeatCount: Math.max(1, Math.floor(repeatConfig.repeatCount)),
      pauseDelaySeconds: Math.max(0, repeatConfig.pauseDelaySeconds),
      verseGapDelaySeconds: Math.max(0, repeatConfig.verseGapDelaySeconds ?? 0),
    };"""

assert target1 in text, "target1 not found"
text = text.replace(target1, replacement1, 1)

target2 = """    this.currentAyahRepeatCount = 0;
    if (this.currentIndex < this.tracks.length - 1) {
      this.currentIndex += 1;
      await this.playCurrentAyah();
    } else {
      this.completePlayback();
    }"""

replacement2 = """    this.currentAyahRepeatCount = 0;
    if (this.currentIndex < this.tracks.length - 1) {
      this.currentIndex += 1;
      const verseGap = this.repeatConfig.verseGapDelaySeconds ?? 0;
      if (verseGap > 0) {
        this.beginRepeatDelay(verseGap * 1000);
      } else {
        await this.playCurrentAyah();
      }
    } else {
      this.completePlayback();
    }"""

assert target2 in text, "target2 not found"
text = text.replace(target2, replacement2, 1)

with open('src/features/audio-player/services/audioPlayerEngine.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print("audioPlayerEngine.ts updated successfully!")
