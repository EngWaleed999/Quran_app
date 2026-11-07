import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';

export interface AppTextProps extends TextProps {
  /** Force centering or custom alignment if needed */
  align?: 'right' | 'left' | 'center' | 'justify';
}

/**
 * Production-grade Arabic Text component with guaranteed RTL alignment.
 * Solves the default LTR / textAlign: 'auto' mismatch on mobile platforms.
 */
export const AppText: React.FC<AppTextProps> = ({
  style,
  align,
  children,
  ...rest
}) => {
  return (
    <RNText
      style={[
        styles.defaultText,
        align ? { textAlign: align } : null,
        style,
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
