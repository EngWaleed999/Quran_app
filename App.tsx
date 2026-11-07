import React from 'react';
import { StyleSheet, View, I18nManager } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SQLiteProvider } from 'expo-sqlite';
import { CustomLightTheme, QuranColors } from './src/core/theme/theme';
import { MushafPageView } from './src/features/mushaf/components/MushafPageView';
import { initializeAppSchema } from './src/core/database/appSchema';

try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch (error) {
  console.warn('I18nManager error:', error);
}

export default function App() {
  const [fontsLoaded] = useFonts({
    HafsSmart: require('./assets/fonts/HafsSmart_08.ttf'),
    UthmanicHafs: require('./assets/fonts/UthmanicHafs1Ver18.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={styles.blankBackground} />;
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={CustomLightTheme}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safeArea}>
          <SQLiteProvider
            databaseName="quran.db"
            onInit={initializeAppSchema}
            assetSource={{
              assetId: require('./assets/data/quran.db'),
              // Keep the bundled database as a first-install seed. Re-copying it
              // on every app reload causes avoidable disk I/O and startup delay.
              forceOverwrite: false,
            }}
          >
            <MushafPageView />
          </SQLiteProvider>
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: QuranColors.parchment,
  },
  blankBackground: {
    flex: 1,
    backgroundColor: QuranColors.parchment,
  },
});
