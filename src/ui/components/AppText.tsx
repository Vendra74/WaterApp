import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme';

type Variant = 'title' | 'heading' | 'body' | 'label' | 'small' | 'big';

const SIZES: Record<Variant, number> = { title: 26, heading: 21, body: 18, label: 16, small: 15, big: 34 };

export function AppText({ variant = 'body', muted, bold, style, children, ...rest }: TextProps & { variant?: Variant; muted?: boolean; bold?: boolean }) {
  const t = useTheme();
  const base: TextStyle = {
    fontSize: t.font(SIZES[variant]),
    lineHeight: Math.round(t.font(SIZES[variant]) * 1.35),
    color: muted ? t.colors.textMuted : t.colors.text,
    fontWeight: bold || variant === 'title' || variant === 'heading' || variant === 'big' ? '700' : '400',
  };
  return (
    <Text
      accessibilityRole={variant === 'title' || variant === 'heading' ? 'header' : undefined}
      allowFontScaling
      maxFontSizeMultiplier={2}
      style={[base, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}
