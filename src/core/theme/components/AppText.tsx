import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { MD3Theme, useTheme } from 'react-native-paper';
import { getAppFont, FontStyleWeight } from '../fonts';
import { useFontLoadingStore } from '../fontLoadingStore';

export interface AppTextProps extends TextProps {
  /** Force centering or custom alignment if needed */
  align?: 'right' | 'left' | 'center' | 'justify';
}

/**
 * Shared Arabic text primitive.
 *
 * Legacy components still contain references to the original classic palette.
 * Resolve those semantic colors against the active Paper theme at render time,
 * so a screen does not keep dark ink on a dark surface after a theme switch.
 */
function resolveSemanticColor(color: unknown, theme: MD3Theme): string | undefined {
  if (typeof color !== 'string') return undefined;

  const semanticColors: Record<string, string> = {
    '#1E1E1E': theme.colors.onSurface,
    '#20342A': theme.colors.onSurface,
    '#5F5B54': theme.colors.onSurfaceVariant,
    '#617268': theme.colors.onSurfaceVariant,
    '#1F513F': theme.colors.primary,
    '#14362A': theme.colors.primary,
    '#2F785E': theme.colors.primary,
    '#2F6E52': theme.colors.primary,
    '#C59B27': theme.colors.secondary,
    '#B68E35': theme.colors.secondary,
    '#E5C058': theme.colors.secondary,
    '#D4B25E': theme.colors.primary,
    '#FFF8F0FF': theme.colors.onSurface,
  };

  return semanticColors[color.toUpperCase()] ?? color;
}

export const AppText: React.FC<AppTextProps> = ({
  style,
  align,
  children,
  ...rest
}) => {
  const theme = useTheme<MD3Theme>();
  const customFontsLoaded = useFontLoadingStore((state) => state.loaded);
  const flattenedStyle = StyleSheet.flatten(style);
  const resolvedColor = resolveSemanticColor(flattenedStyle?.color, theme);

  // If style already defines an explicit custom font (e.g., UthmanicHafs), preserve it
  let resolvedFontFamily = flattenedStyle?.fontFamily;
  if (!resolvedFontFamily) {
    const rawWeight = flattenedStyle?.fontWeight;
    let weight: FontStyleWeight = 'regular';
    if (rawWeight === 'bold' || rawWeight === '700' || rawWeight === '800' || rawWeight === '900') {
      weight = 'bold';
    } else if (rawWeight === '500' || rawWeight === '600') {
      weight = 'medium';
    } else if (rawWeight === '100' || rawWeight === '200' || rawWeight === '300') {
      weight = 'light';
    }
    resolvedFontFamily = getAppFont(weight);
  }

  return (
    <RNText
      style={[
        styles.defaultText,
        { color: theme.colors.onSurface, fontFamily: customFontsLoaded ? resolvedFontFamily : undefined },
        style,
        customFontsLoaded ? null : { fontFamily: undefined },
        resolvedColor ? { color: resolvedColor } : null,
        align ? { textAlign: align } : null,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  defaultText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
