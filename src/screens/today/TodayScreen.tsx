import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { totalForDay } from '@/domain/hydration/logs';
import { goalProgressPercent } from '@/domain/safety/plan';
import { suggestFor } from '@/domain/safety/suggestions';
import { generateHydrationSlots } from '@/domain/hydration/schedule';
import { weekdayOf } from '@/domain/time/time';
import { occurrenceStatusLabel, pendingOccurrencesToday } from '@/domain/medication/occurrences';
import { strings } from '@/i18n';
import { formatClock, weekdayLong } from '@/i18n/format';
import { describeSuggestion } from '@/domain/adaptive/reminderSuggestions';
import { speak } from '@/services/speech/speech';
import { useTheme } from '@/ui/theme';

export function TodayScreen() {
  const nav = useNavigation();
  const t = useTheme();
  const s = strings();
  const td = s.today;
  const { profile, settings, plan, todayLogs, medications, occurrences, permission, notificationState, sync, lastUndo, undoLog, suggestions: reminderSuggestions, applySuggestion, dismissSuggestion } = useAppStore();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const total = totalForDay(todayLogs, now);
  const pct = plan ? goalProgressPercent(total, plan) : null;
  const nextHydration = useMemo(() => {
    if (!settings || !profile) return null;
    const slots = generateHydrationSlots({ settings, naps: profile.naps, now, days: 2 });
    return slots[0]?.at ?? null;
  }, [settings, profile, now]);
  const medsById = new Map(medications.map((m) => [m.id, m]));
  // Apenas as doses de hoje: as de amanhã em diante confundiam a lista.
  const upcoming = useMemo(() => pendingOccurrencesToday(occurrences, now), [occurrences, now]);
  const suggestions = profile && plan ? suggestFor(profile, plan, now) : [];
  const name = profile?.preferredName || profile?.name || '';
  const suggestion = reminderSuggestions[0] ?? null;
  const suggestionText = suggestion ? describeSuggestion(suggestion) : null;

  const readAloud = () => {
    const parts = [
      `${td.nowIs(formatClock(now))}.`,
      nextHydration ? td.nextWaterAt(formatClock(nextHydration)) : td.noWaterScheduled,
      td.loggedToday(total),
      upcoming.length ? td.nextMedication(medsById.get(upcoming[0]!.medicationId)?.name ?? '', formatClock(new Date(upcoming[0]!.plannedAt))) : '',
    ];
    speak(parts.join(' '));
  };

  return (
    <Screen safeTop>
      {/* Com letras muito grandes o botão não cabe ao lado da hora: empilha em vez de cortar. */}
      <View style={t.fontScale >= 1.5 ? { gap: t.space(1) } : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <AppText muted>{weekdayLong(weekdayOf(now))}</AppText>
          <AppText variant="big" accessibilityLabel={td.nowIs(formatClock(now))}>{formatClock(now)}</AppText>
        </View>
        <BigButton kind="secondary" compact icon="🔊" label={s.common.readAloud} onPress={readAloud} />
      </View>
      {name ? <AppText variant="heading">{td.hello(name)}</AppText> : null}

      {permission === 'denied' ? (
        <Banner tone="warning" title={td.notificationsOffTitle}>{td.notificationsOffBody}</Banner>
      ) : null}
      {notificationState?.lastError && permission !== 'denied' ? <Banner tone="warning" title={td.schedulingTitle}>{notificationState.lastError}</Banner> : null}

      <Card tone="alt">
        <AppText variant="label" muted>{td.nextWater}</AppText>
        <AppText variant="big">{nextHydration ? formatClock(nextHydration) : '—'}</AppText>
        {!settings?.enabled ? <AppText muted>{td.waterOff}</AppText> : null}
        <AppText variant="label" muted>{td.waterToday}</AppText>
        <AppText variant="heading">{pct !== null && plan?.goalMl ? td.totalWithGoal(total, pct, plan.goalMl) : `${total} ml`}</AppText>
        {pct !== null && pct > 100 ? <AppText style={{ color: t.colors.warning }}>{td.aboveGoal}</AppText> : null}
        {suggestions.length > 1 ? (
          <AppText muted variant="small">{td.suggestionNow(suggestions.map((x) => x.label).join(', '))}</AppText>
        ) : null}
      </Card>

      <BigButton label={td.logWater} icon="💧" onPress={() => nav.navigate('HydrationLog')} />
      {lastUndo ? (
        <BigButton kind="ghost" compact label={td.undoLast(lastUndo.volumeMl)} onPress={() => void undoLog(lastUndo)} />
      ) : null}

      {/* Uma sugestão por vez, aprendida dos registros dos últimos dias. Nada muda sem tocar em "Mudar". */}
      {suggestion ? (
        <Card tone="alt" accessibilityRole="summary">
          <AppText variant="heading">{suggestionText!.title}</AppText>
          <AppText>{suggestionText!.body}</AppText>
          <AppText muted variant="small">{td.suggestionNote}</AppText>
          <BigButton compact icon="✓" label={suggestionText!.accept} onPress={() => void applySuggestion(suggestion)} />
          <BigButton compact kind="ghost" label={suggestionText!.reject} onPress={() => void dismissSuggestion(suggestion)} />
        </Card>
      ) : null}

      <Card>
        <AppText variant="heading">{td.medicationsToday}</AppText>
        {upcoming.length === 0 ? <AppText muted>{medications.length === 0 ? td.noMedications : td.noMedicationsLeft}</AppText> : null}
        {upcoming.map((o) => {
          const m = medsById.get(o.medicationId);
          const when = o.status === 'snoozed' && o.snoozedUntil ? new Date(o.snoozedUntil) : new Date(o.plannedAt);
          return (
            <BigButton
              key={o.id}
              kind="secondary"
              compact
              label={`${formatClock(when)} · ${m?.name ?? s.common.medication} · ${occurrenceStatusLabel(o.status)}`}
              hint={td.occurrenceHint}
              onPress={() => nav.navigate('OccurrenceAction', { occurrenceId: o.id })}
            />
          );
        })}
      </Card>

      <BigButton kind="danger" label={td.needHelp} icon="☎" onPress={() => nav.navigate('Help')} />

      {sync && sync.configured && sync.pending > 0 ? (
        <AppText muted variant="small">{td.pendingSync(sync.pending, !sync.online)}</AppText>
      ) : null}
    </Screen>
  );
}
