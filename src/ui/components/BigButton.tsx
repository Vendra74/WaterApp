import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from '../theme';

type Kind = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  kind?: Kind;
  icon?: string; // emoji/símbolo sempre acompanhado de texto
  disabled?: boolean;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  testID?: string;
}

export function BigButton({ label, onPress, kind = 'primary', icon, disabled, hint, style, compact, testID }: Props) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.colors.primary : kind === 'danger' ? t.colors.danger : kind === 'secondary' ? t.colors.secondary : 'transparent';
  const fg = kind === 'primary' ? t.colors.onPrimary : kind === 'danger' ? t.colors.onDanger : kind === 'secondary' ? t.colors.onSecondary : t.colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: compact ? 52 : t.touchMin,
          paddingHorizontal: t.space(2),
          paddingVertical: t.space(1.5),
          borderRadius: t.radius,
          backgroundColor: bg,
          borderWidth: kind === 'ghost' || kind === 'secondary' || t.highContrast ? 2 : 0,
          borderColor: kind === 'ghost' ? t.colors.primary : t.colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: t.space(1),
        },
        style,
      ]}
    >
      {icon ? <AppText variant="heading" style={{ color: fg }} importantForAccessibility="no">{icon}</AppText> : null}
      <View style={{ flexShrink: 1 }}>
        <AppText variant={compact ? 'label' : 'heading'} bold style={{ color: fg, textAlign: 'center' }}>{label}</AppText>
      </View>
    </Pressable>
  );
}
