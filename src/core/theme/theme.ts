import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const QuranColors = {
  // Primary Quran Palette
  emerald: '#1F513F',
  emeraldDark: '#14362A',
  emeraldLight: '#2F785E',
  gold: '#C59B27',
  goldLight: '#E5C058',
  parchment: '#FFF8F0FF',
  parchmentBorder: '#FFF8F0FF',
  textDark: '#1E1E1E',
  textMuted: '#5F5B54',
  highlightAyah: 'rgba(197, 155, 39, 0.18)',
  highlightPlaying: 'rgba(31, 81, 63, 0.18)',
  
  // Night Mode Palette
  nightBg: '#121413',
  nightSurface: '#1C201E',
  nightText: '#FFF8F0FF',
  nightBorder: '#2B3330',
};

export const CustomLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: QuranColors.emerald,
    secondary: QuranColors.gold,
    background: QuranColors.parchment,
    surface: '#FFF8F0FF',
    surfaceVariant: '#FFF8F0FF',
    onBackground: QuranColors.textDark,
    onSurface: QuranColors.textDark,
    outline: QuranColors.parchmentBorder,
  },
};

export const CustomDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: QuranColors.goldLight,
    secondary: QuranColors.emeraldLight,
    background: QuranColors.nightBg,
    surface: QuranColors.nightSurface,
    surfaceVariant: '#262D2A',
    onBackground: QuranColors.nightText,
    onSurface: QuranColors.nightText,
    outline: QuranColors.nightBorder,
  },
};

