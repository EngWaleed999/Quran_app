with open('src/features/audio-player/services/audioPlayerEngine.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target1 = """      player.replace({ uri: localUri });
      player.setActiveForLockScreen(true, {
        title: 'سورة ' + this.target.suraName + ' • الآية ' + track.ayaNo,
        artist: this.reciter.name,
        albumTitle: 'القرآن الكريم',
      });
      player.play();"""

replacement1 = """      player.replace({ uri: localUri });
      // تفعيل شاشة القفل متاح فقط في حزم الإنتاج المخصصة (Standalone APK) لوجود Foreground Service
      // في Expo Go يتم تخطيه لمنع خطأ Service binding failed
      if (__DEV__ === false) {
        try {
          player.setActiveForLockScreen(true, {
            title: 'سورة ' + this.target.suraName + ' • الآية ' + track.ayaNo,
            artist: this.reciter.name,
            albumTitle: 'القرآن الكريم',
          });
        } catch {
          // تجاهل آمن في بيئات التطوير
        }
      }
      player.play();"""

assert target1 in text, "target1 not found"
text = text.replace(target1, replacement1, 1)

target2 = "    this.player?.setActiveForLockScreen(false);"
replacement2 = """    if (__DEV__ === false) {
      try {
        this.player?.setActiveForLockScreen(false);
      } catch {
        // ignore
      }
    }"""

text = text.replace(target2, replacement2)

with open('src/features/audio-player/services/audioPlayerEngine.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print("audioPlayerEngine.ts updated successfully!")
