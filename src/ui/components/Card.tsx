import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '../theme';

export function Card({ style, children, tone = 'default', ...rest }: ViewProps & { tone?: 'default' | 'alt' | 'warning' | 'success' }) {
  const t = useTheme();
  const bg = tone === 'alt' ? t.colors.surfaceAlt : tone === 'warning' ? t.colors.warningBg : tone === 'success' ? t.colors.successBg : t.colors.surface;
  return (
    <View
      style={[
        { backgroundColor: bg, borderRadius: t.radius, padding: t.space(2), borderWidth: t.highContrast ? 2 : 1, borderColor: t.colors.border, gap: t.space(1) },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
