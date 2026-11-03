import React, { useEffect } from 'react';
import { StyleSheet, View, I18nManager } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SQLiteProvider } from 'expo-sqlite';
import { CustomLightTheme, QuranColors } from './src/core/theme/theme';
import { MushafPageView } from './src/features/mushaf/components/MushafPageView';

// Force RTL layout so native text engines align Arabic last lines to the right
try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch (e) {
  console.warn('I18nManager error:', e);
}

export default function App() {
  const [fontsLoaded] = useFonts({
    HafsSmart: require('./assets/fonts/HafsSmart_08.ttf'),
  });

  // No landing page - seamless direct transition into the Mushaf page
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
            assetSource={{
              assetId: require('./assets/data/quran.db'),
              forceOverwrite: true,
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
