import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export type AppearanceMode = 'classic' | 'soft' | 'dark';

export interface QuranPalette {
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  muted: string;
  primary: string;
  primaryDark: string;
  secondary: string;
  border: string;
  pageText: string;
}

export const QuranPalettes: Record<AppearanceMode, QuranPalette> = {
  classic: {
    background: '#FFF8F0',
    surface: '#FFFFFF',
    surfaceVariant: '#F8F0E6',
    text: '#1E1E1E',
    muted: '#5F5B54',
    primary: '#1F513F',
    primaryDark: '#14362A',
    secondary: '#C59B27',
    border: '#E8DED0',
    pageText: '#231F20',
  },
  soft: {
    background: '#EEF4EF',
    surface: '#FBFDFB',
    surfaceVariant: '#E2ECE4',
    text: '#20342A',
    muted: '#617268',
    primary: '#2F6E52',
    primaryDark: '#1B4A35',
    secondary: '#B68E35',
    border: '#D3E1D5',
    pageText: '#20342A',
  },
  dark: {
    background: '#121413',
    surface: '#1C201E',
    surfaceVariant: '#262D2A',
    text: '#F4EFE5',
    muted: '#B8C1B9',
    primary: '#D4B25E',
    primaryDark: '#E5C978',
    secondary: '#79B39A',
    border: '#2B3330',
    pageText: '#FFF8F0',
  },
};

export function getQuranPalette(mode: AppearanceMode): QuranPalette {
  return QuranPalettes[mode] ?? QuranPalettes.classic;
}

export function getPaperTheme(mode: AppearanceMode) {
  const palette = getQuranPalette(mode);
  const base = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      primary: palette.primary,
      secondary: palette.secondary,
      background: palette.background,
      surface: palette.surface,
      surfaceVariant: palette.surfaceVariant,
      onBackground: palette.text,
      onSurface: palette.text,
      outline: palette.border,
    },
  };
}

export const QuranColors = {
  emerald: '#1F513F',
  emeraldDark: '#14362A',
  emeraldLight: '#2F785E',
  gold: '#C59B27',
  goldLight: '#E5C058',
  parchment: '#FFF8F0FF',
  parchmentBorder: '#E8DED0',
  textDark: '#1E1E1E',
  textMuted: '#5F5B54',
  highlightAyah: 'rgba(197, 155, 39, 0.18)',
  highlightPlaying: 'rgba(31, 81, 63, 0.18)',
  nightBg: '#121413',
  nightSurface: '#1C201E',
  nightText: '#FFF8F0FF',
  nightBorder: '#2B3330',
};

export const CustomLightTheme = getPaperTheme('classic');
export const CustomDarkTheme = getPaperTheme('dark');
