import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, I18nManager, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  SQLiteProvider,
  defaultDatabaseDirectory,
  type SQLiteProviderAssetSource,
} from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { getPaperTheme, getQuranPalette } from './src/core/theme/theme';
import { useAppPreferences } from './src/core/theme/preferencesStore';
import { MushafPageView } from './src/features/mushaf/components/MushafPageView';
import { initializeAppSchema } from './src/core/database/appSchema';
import { THMANYAH_FONTS } from './src/core/theme/fonts';
import { useFontLoadingStore } from './src/core/theme/fontLoadingStore';

// Prevent native splash screen from hiding prematurely before JS runtime & SQLite bootstrap
void SplashScreen.preventAutoHideAsync().catch(() => {});

const QURAN_DATABASE_NAME = 'quran.db';
const QURAN_DATABASE_ASSET = require('./assets/data/quran-full.db');

try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch (error) {
  console.warn('I18nManager error:', error);
}

/**
 * Optional app typography must never gate the first Mushaf frame.
 * AppText uses the platform fallback until these bundled fonts are ready.
 */
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

  const [databaseBootstrapReady, setDatabaseBootstrapReady] = useState(false);
  const [databaseAssetSource, setDatabaseAssetSource] =
    useState<SQLiteProviderAssetSource | undefined>(undefined);

  // SQLiteProvider's assetSource calls Asset.downloadAsync before every provider
  // initialization. Check the native SQLite file first so existing installations
  // open their already-imported DB directly instead of staging the 115 MB asset
  // in Cache on every app launch. The canonical DB file is never modified here.
  useEffect(() => {
    let cancelled = false;

    async function prepareDatabaseSource() {
      let source: SQLiteProviderAssetSource | undefined;

      try {
        const directory = defaultDatabaseDirectory;
        if (!directory) {
          source = { assetId: QURAN_DATABASE_ASSET, forceOverwrite: false };
        } else {
          const databaseUri =
            'file://' + directory.replace(/\/+$/, '') + '/' + QURAN_DATABASE_NAME;
          const info = await FileSystem.getInfoAsync(databaseUri);
          const hasExistingDatabase =
            info.exists && 'size' in info && typeof info.size === 'number' && info.size > 0;

          if (!hasExistingDatabase) {
            source = { assetId: QURAN_DATABASE_ASSET, forceOverwrite: false };
          }
        }
      } catch (error) {
        // Fail safely: use the existing one-time asset import path when the
        // native database path cannot be inspected on this platform.
        console.warn('[App] Could not inspect local SQLite file:', error);
        source = { assetId: QURAN_DATABASE_ASSET, forceOverwrite: false };
      }

      if (cancelled) return;
      setDatabaseAssetSource(source);
      setDatabaseBootstrapReady(true);
    }

    void prepareDatabaseSource();
    return () => {
      cancelled = true;
    };
  }, []);

  // Dismiss splash screen smoothly as soon as bootstrap completes, without unnecessary wait
  useEffect(() => {
    if (databaseBootstrapReady) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [databaseBootstrapReady]);

  // Keep descendants stable. In particular, SQLiteProvider must not reopen
  // the database when fonts or appearance preferences update.
  const appContent = useMemo(() => <MushafPageView />, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <FontAssetsLoader />
        <SafeAreaView
          edges={['left', 'right']}
          style={[styles.safeArea, { backgroundColor: palette.background }]}
        >
          {databaseBootstrapReady ? (
            <SQLiteProvider
              databaseName={QURAN_DATABASE_NAME}
              onInit={initializeAppSchema}
              assetSource={databaseAssetSource}
            >
              {appContent}
            </SQLiteProvider>
          ) : (
            <View style={styles.startup}>
              <ActivityIndicator size="large" color={palette.primary} />
            </View>
          )}
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  startup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
