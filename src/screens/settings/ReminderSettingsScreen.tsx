import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner, ChoiceGroup, TimeField, Toggle } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import type { HydrationSettings, Weekday } from '@/domain/types';
import { generateHydrationSlots, settingsAfterManualEdit } from '@/domain/hydration/schedule';
import { strings } from '@/i18n';
import { formatClock, formatRange, weekdayShort } from '@/i18n/format';

export function ReminderSettingsScreen() {
  const nav = useNavigation();
  const { settings, profile, updateSettings, medications } = useAppStore();
  const [s, setS] = useState<HydrationSettings>(settings!);
  const set = (p: Partial<HydrationSettings>) => setS((x) => ({ ...x, ...p }));
  const preview = profile ? generateHydrationSlots({ settings: s, naps: profile.naps, now: new Date(new Date().setHours(0, 0, 0, 0)), days: 1 }) : [];
  const hasNightMeds = medications.some((m) => m.active && m.times.some((tm) => tm >= s.windowEnd || tm < s.windowStart));
  const t = strings();
  const r = t.reminders;

  return (
    <Screen
      title={r.title}
      footer={
        <View style={{ gap: 8 }}>
          <BigButton label={t.common.save} icon="✓" onPress={() => void updateSettings(profile ? settingsAfterManualEdit(s, profile) : s).then(() => nav.goBack())} />
          <BigButton kind="ghost" compact label={t.common.cancel} onPress={() => nav.goBack()} />
        </View>
      }
    >
      <Toggle label={r.enabled} value={s.enabled} onChange={(v) => set({ enabled: v })} />
      <ChoiceGroup
        label={r.how}
        options={[{ value: 'interval', label: r.modeInterval }, { value: 'times', label: r.modeTimes }]}
        value={s.mode}
        onChange={(v) => set({ mode: v as HydrationSettings['mode'] })}
      />
      {s.mode === 'interval' ? (
        <ChoiceGroup
          label={r.interval}
          options={[{ value: '60', label: r.every1h }, { value: '90', label: r.every90m }, { value: '120', label: r.every2h }, { value: '180', label: r.every3h }]}
          value={String(s.intervalMinutes)}
          onChange={(v) => set({ intervalMinutes: Number(v) })}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {s.times.map((tm, i) => (
            <View key={i} style={{ gap: 8 }}>
              <TimeField label={r.timeN(i + 1)} value={tm} onChange={(v) => set({ times: s.times.map((x, j) => (j === i ? v : x)) })} />
              <BigButton kind="ghost" compact label={t.common.remove} onPress={() => set({ times: s.times.filter((_, j) => j !== i) })} />
            </View>
          ))}
          <BigButton kind="secondary" compact label={r.addTime} onPress={() => set({ times: [...s.times, '10:00'] })} />
        </View>
      )}
      <Card>
        <AppText variant="heading">{r.period}</AppText>
        <TimeField label={r.startAt} value={s.windowStart} onChange={(v) => set({ windowStart: v })} />
        <TimeField label={r.stopAt} value={s.windowEnd} onChange={(v) => set({ windowEnd: v })} />
        <Toggle label={r.pauseNaps} hint={profile?.naps.length ? r.napsList(profile.naps.map((n) => formatRange(n.start, n.end)).join(', ')) : r.noNaps} value={s.pauseDuringNaps} onChange={(v) => set({ pauseDuringNaps: v })} />
      </Card>
      {hasNightMeds ? (
        <Banner tone="info" title={r.nightMedsTitle}>{r.nightMedsBody}</Banner>
      ) : null}
      <ChoiceGroup
        label={r.weekdays}
        multi
        options={([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => ({ value: String(d), label: weekdayShort(d) }))}
        value={s.weekdays.map(String)}
        onChange={(v) => set({ weekdays: (v as string[]).map(Number).sort() as Weekday[] })}
      />
      <Card>
        <AppText variant="heading">{r.soundVibration}</AppText>
        <Toggle label={r.sound} value={s.sound} onChange={(v) => set({ sound: v })} />
        <Toggle label={r.vibration} hint={r.vibrationHint} value={s.vibrate} onChange={(v) => set({ vibrate: v })} />
        <ChoiceGroup label={r.snoozeTime} options={[10, 15, 30].map((m) => ({ value: String(m), label: r.minutes(m) }))} value={String(s.snoozeMinutes)} onChange={(v) => set({ snoozeMinutes: Number(v) })} />
      </Card>
      <Card>
        <AppText variant="heading">{r.suggestionsTitle}</AppText>
        <Toggle label={r.suggestions} hint={r.suggestionsHint} value={s.suggestReminderAdjustments} onChange={(v) => set({ suggestReminderAdjustments: v })} />
      </Card>
      <Card>
        <AppText variant="heading">{r.unconfirmedTitle}</AppText>
        <ChoiceGroup
          label={r.repeat}
          hint={r.repeatHint}
          options={[{ value: '0', label: r.noRepeat }, ...[5, 10, 15].map((m) => ({ value: String(m), label: r.everyMinutes(m) }))]}
          value={String(s.medicationRepeatMinutes)}
          onChange={(v) => set({ medicationRepeatMinutes: Number(v) })}
        />
        {s.medicationRepeatMinutes > 0 ? (
          <ChoiceGroup label={r.howManyTimes} options={[1, 2, 3].map((n) => ({ value: String(n), label: r.times(n) }))} value={String(s.medicationRepeatCount)} onChange={(v) => set({ medicationRepeatCount: Number(v) })} />
        ) : null}
      </Card>
      <Card>
        <AppText variant="heading">{r.privacy}</AppText>
        <Toggle label={r.showName} hint={r.showNameHint} value={s.showDetailsOnLockScreen} onChange={(v) => set({ showDetailsOnLockScreen: v })} />
      </Card>
      <Card tone="alt">
        <AppText variant="label" bold>{r.preview}</AppText>
        <AppText muted>{preview.length ? preview.map((p) => formatClock(p.at)).join(' · ') : r.noPreview}</AppText>
        <AppText muted variant="small">{r.previewNote}</AppText>
      </Card>
    </Screen>
  );
}
