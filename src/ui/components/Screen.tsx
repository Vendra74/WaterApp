import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { useTheme } from '../theme';

interface Props {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
}

export function Screen({ title, children, footer, scroll = true }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const content = (
    <View style={{ padding: t.space(2), gap: t.space(2), paddingBottom: t.space(4) }}>
      {title ? <AppText variant="title">{title}</AppText> : null}
      {children}
    </View>
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">{content}</ScrollView> : <View style={{ flex: 1 }}>{content}</View>}
      {footer ? (
        <View style={{ padding: t.space(2), paddingBottom: Math.max(insets.bottom, t.space(2)), gap: t.space(1), backgroundColor: t.colors.surface, borderTopWidth: 1, borderTopColor: t.colors.border }}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
