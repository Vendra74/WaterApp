import React, { useState } from 'react';
import { Platform, Pressable, TextInput, View, type TextInputProps } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppText } from './AppText';
import { useTheme } from '../theme';
import { atLocalTime, formatTimeBR, isValidHHmm } from '@/domain/time/time';
import type { HHmm } from '@/domain/types';
import { isEnglish, localeTag, strings } from '@/i18n';
import { formatHHmm } from '@/i18n/format';

export function TextField({ label, hint, ...rest }: TextInputProps & { label: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space(0.5) }}>
      <AppText variant="label" bold>{label}</AppText>
      {hint ? <AppText variant="small" muted>{hint}</AppText> : null}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={t.colors.textMuted}
        style={{
          minHeight: 56,
          borderWidth: 2,
          borderColor: t.colors.border,
          borderRadius: t.radius,
          paddingHorizontal: t.space(2),
          fontSize: t.font(18),
          color: t.colors.text,
          backgroundColor: t.colors.surface,
        }}
        {...rest}
      />
    </View>
  );
}

export function TimeField({ label, value, onChange, hint }: { label: string; value: HHmm; onChange: (v: HHmm) => void; hint?: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const date = atLocalTime(new Date(), isValidHHmm(value) ? value : '08:00');
  const onPick = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (e.type === 'dismissed' || !d) return;
    onChange(formatTimeBR(d));
  };
  return (
    <View style={{ gap: t.space(0.5) }}>
      <AppText variant="label" bold>{label}</AppText>
      {hint ? <AppText variant="small" muted>{hint}</AppText> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings().summary.tapToEdit(label, formatHHmm(value))}
        onPress={() => setOpen((o) => !o)}
        style={{ minHeight: 56, borderWidth: 2, borderColor: t.colors.border, borderRadius: t.radius, justifyContent: 'center', paddingHorizontal: t.space(2), backgroundColor: t.colors.surface }}
      >
        <AppText variant="heading">{formatHHmm(value)}</AppText>
      </Pressable>
      {open ? (
        // O app só tem paletas claras, mas com userInterfaceStyle "automatic" a roleta do iOS seguia o modo
        // escuro do sistema: números brancos sobre fundo branco. Fixa a variante clara e a cor do texto.
        <DateTimePicker
          value={date}
          mode="time"
          is24Hour={!isEnglish()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPick}
          locale={localeTag()}
          themeVariant="light"
          textColor={t.colors.text}
        />
      ) : null}
      {open && Platform.OS === 'ios' ? (
        <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
          <AppText bold style={{ color: t.colors.primary }}>{strings().common.done}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  multi,
  hint,
}: {
  label?: string;
  options: { value: T; label: string; description?: string }[];
  value: T[] | T | null;
  onChange: (v: T[] | T) => void;
  multi?: boolean;
  hint?: string;
}) {
  const t = useTheme();
  const selected = new Set<T>(Array.isArray(value) ? value : value ? [value] : []);
  return (
    <View style={{ gap: t.space(1) }} accessibilityRole={multi ? undefined : 'radiogroup'}>
      {label ? <AppText variant="label" bold>{label}</AppText> : null}
      {hint ? <AppText variant="small" muted>{hint}</AppText> : null}
      {options.map((o) => {
        const on = selected.has(o.value);
        return (
          <Pressable
            key={o.value}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            accessibilityHint={o.description}
            onPress={() => {
              if (multi) {
                const next = new Set(selected);
                if (on) next.delete(o.value);
                else next.add(o.value);
                onChange([...next]);
              } else onChange(o.value);
            }}
            style={{
              minHeight: t.touchMin,
              borderRadius: t.radius,
              borderWidth: 2,
              borderColor: on ? t.colors.primary : t.colors.border,
              backgroundColor: on ? t.colors.secondary : t.colors.surface,
              padding: t.space(1.5),
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.space(1.5),
            }}
          >
            <AppText variant="heading" style={{ color: on ? t.colors.primary : t.colors.textMuted }} importantForAccessibility="no">{on ? '☑' : '☐'}</AppText>
            <View style={{ flex: 1 }}>
              <AppText bold={on}>{o.label}</AppText>
              {o.description ? <AppText variant="small" muted>{o.description}</AppText> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ label, value, onChange, step = 50, min = 0, max = 2000, unit = 'ml' }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string }) {
  const t = useTheme();
  const btn = (txt: string, delta: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => onChange(Math.min(max, Math.max(min, value + delta)))}
      style={{ width: t.touchMin, height: t.touchMin, borderRadius: t.radius, backgroundColor: t.colors.secondary, borderWidth: 2, borderColor: t.colors.border, alignItems: 'center', justifyContent: 'center' }}
    >
      <AppText variant="big" style={{ color: t.colors.onSecondary }}>{txt}</AppText>
    </Pressable>
  );
  return (
    <View style={{ gap: t.space(0.5) }}>
      <AppText variant="label" bold>{label}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {btn('−', -step, strings().common.decrease(step, unit))}
        <AppText variant="big" accessibilityLiveRegion="polite">{value} {unit}</AppText>
        {btn('+', step, strings().common.increase(step, unit))}
      </View>
    </View>
  );
}

export function TagInput({ label, values, onChange, hint, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; hint?: string; placeholder?: string }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setText('');
  };
  return (
    <View style={{ gap: t.space(1) }}>
      <TextField label={label} hint={hint} value={text} onChangeText={setText} onSubmitEditing={add} placeholder={placeholder} returnKeyType="done" />
      <Pressable accessibilityRole="button" accessibilityLabel={strings().common.addItem(text || strings().common.item)} onPress={add} style={{ minHeight: 48, justifyContent: 'center' }}>
        <AppText bold style={{ color: t.colors.primary }}>{strings().common.add}</AppText>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(1) }}>
        {values.map((v) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityLabel={strings().common.removeItem(v)}
            onPress={() => onChange(values.filter((x) => x !== v))}
            style={{ minHeight: 48, paddingHorizontal: t.space(1.5), borderRadius: 24, backgroundColor: t.colors.secondary, borderWidth: 2, borderColor: t.colors.border, justifyContent: 'center' }}
          >
            <AppText style={{ color: t.colors.onSecondary }}>{v}  ✕</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Banner({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'success'; title?: string; children: React.ReactNode }) {
  const t = useTheme();
  const bg = tone === 'warning' ? t.colors.warningBg : tone === 'success' ? t.colors.successBg : t.colors.surfaceAlt;
  const fg = tone === 'warning' ? t.colors.warning : tone === 'success' ? t.colors.success : t.colors.onSecondary;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: bg, borderRadius: t.radius, padding: t.space(2), borderWidth: 2, borderColor: fg, gap: t.space(0.5) }}>
      {title ? <AppText bold style={{ color: fg }}>{tone === 'warning' ? '⚠ ' : tone === 'success' ? '✓ ' : 'ℹ '}{title}</AppText> : null}
      <AppText style={{ color: t.colors.text }}>{children}</AppText>
    </View>
  );
}

export function ProgressBar({ current, total }: { current: number; total: number }) {
  const t = useTheme();
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: current, text: strings().assessment.questionOf(current, total) }} style={{ gap: t.space(0.5) }}>
      <AppText variant="small" muted>{strings().assessment.questionOf(current, total)}</AppText>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.colors.primary }} />
      </View>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: object }) {
  const t = useTheme();
  return <View style={[{ flexDirection: 'row', gap: t.space(1), flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => onChange(!value)}
      style={{ minHeight: t.touchMin, flexDirection: 'row', alignItems: 'center', gap: t.space(1.5), padding: t.space(1.5), borderRadius: t.radius, borderWidth: 2, borderColor: value ? t.colors.primary : t.colors.border, backgroundColor: value ? t.colors.secondary : t.colors.surface }}
    >
      <AppText variant="heading" style={{ color: value ? t.colors.primary : t.colors.textMuted }} importantForAccessibility="no">{value ? '☑' : '☐'}</AppText>
      <View style={{ flex: 1 }}>
        <AppText bold>{label}</AppText>
        {hint ? <AppText variant="small" muted>{hint}</AppText> : null}
        <AppText variant="small" muted>{value ? strings().common.on : strings().common.off}</AppText>
      </View>
    </Pressable>
  );
}
