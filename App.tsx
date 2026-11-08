import React, { useEffect, useMemo } from 'react';
import { StyleSheet, I18nManager } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { useFonts } from 'expo-font';
import { SQLiteProvider } from 'expo-sqlite';
import { getPaperTheme, getQuranPalette } from './src/core/theme/theme';
import { useAppPreferences } from './src/core/theme/preferencesStore';
import { MushafPageView } from './src/features/mushaf/components/MushafPageView';
import { initializeAppSchema } from './src/core/database/appSchema';
import { THMANYAH_FONTS } from './src/core/theme/fonts';
import { useFontLoadingStore } from './src/core/theme/fontLoadingStore';

try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch (error) {
  console.warn('I18nManager error:', error);
}

function FontAssetsLoader() {
  const [fontsLoaded] = useFonts({
    UthmanicHafs: require('./assets/fonts/UthmanicHafs1Ver18.ttf'),
    ...THMANYAH_FONTS,
  });

  useEffect(() => {
    if (fontsLoaded) useFontLoadingStore.setState({ loaded: true });
  }, [fontsLoaded]);

  return null;
}

export default function App() {
  const appearance = useAppPreferences((state) => state.appearance);
  const palette = useMemo(() => getQuranPalette(appearance), [appearance]);
  const paperTheme = useMemo(() => getPaperTheme(appearance), [appearance]);
  // Keep these references stable so font loading cannot make SQLiteProvider
  // tear down and reopen its database connection.
  const appContent = useMemo(() => <MushafPageView />, []);
  const databaseAssetSource = useMemo(
    () => ({
      assetId: require('./assets/data/quran-full.db'),
      forceOverwrite: false,
    }),
    []
  );

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <FontAssetsLoader />
        <SafeAreaView
          edges={['left', 'right']}
          style={[styles.safeArea, { backgroundColor: palette.background }]}
        >
          <SQLiteProvider
            databaseName="quran.db"
            onInit={initializeAppSchema}
            assetSource={databaseAssetSource}
          >
            {appContent}
          </SQLiteProvider>
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F0' },
});
