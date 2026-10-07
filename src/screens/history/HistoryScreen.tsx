import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { ChoiceGroup, Stepper, TimeField } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { loadLogsLastDays } from '@/services/usecases/hydration';
import { loadOccurrencesBetween } from '@/services/usecases/medications';
import type { HydrationLog, MedicationOccurrence } from '@/domain/types';
import { totalsByDay } from '@/domain/hydration/logs';
import { addDays, atLocalTime, formatTimeBR, parseISODate, startOfLocalDay, toISODate } from '@/domain/time/time';
import { occurrenceStatusLabel } from '@/domain/medication/occurrences';
import { strings } from '@/i18n';
import { formatClock, formatDate } from '@/i18n/format';
import { useTheme } from '@/ui/theme';

export function HistoryScreen() {
  const nav = useNavigation();
  const t = useTheme();
  const s = strings();
  const h = s.history;
  const { medications, plan, todayLogs, undoLog, restoreLog, editLog, logWater } = useAppStore();
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [logs, setLogs] = useState<HydrationLog[]>([]);
  const [occs, setOccs] = useState<MedicationOccurrence[]>([]);
  const [editing, setEditing] = useState<HydrationLog | null>(null);
  const [volume, setVolume] = useState(0);
  const [editTime, setEditTime] = useState('08:00');
  const [day, setDay] = useState(toISODate(new Date()));
  const [adding, setAdding] = useState(false);
  const [newTime, setNewTime] = useState('10:00');
  const [newVolume, setNewVolume] = useState(200);

  const reload = async () => {
    setLogs(await loadLogsLastDays(7));
    const start = addDays(startOfLocalDay(new Date()), -6);
    setOccs(await loadOccurrencesBetween(start, addDays(startOfLocalDay(new Date()), 1)));
  };
  useEffect(() => {
    void reload();
  }, [todayLogs]);

  const medsById = new Map(medications.map((m) => [m.id, m]));
  const today = toISODate(new Date());
  const dayLogs = logs.filter((l) => toISODate(new Date(l.at)) === day);
  const dayOccs = occs.filter((o) => toISODate(new Date(o.plannedAt)) === day);
  const totals = totalsByDay(logs);
  const weekDays = Array.from({ length: 7 }, (_, i) => toISODate(addDays(new Date(), -6 + i)));
  const dayIndex = weekDays.indexOf(day);
  const dayLabel = (d: string) => (d === today ? h.today : d === toISODate(addDays(new Date(), -1)) ? h.yesterday : formatDate(parseISODate(d)));
  const changeDay = (i: number) => {
    const next = weekDays[i];
    if (!next) return;
    setDay(next);
    setAdding(false);
    setEditing(null);
  };

  // Incluir um registro em um dia anterior (ex.: esqueceu de marcar). Fica identificado na observação.
  const addForDay = async () => {
    const at = atLocalTime(parseISODate(day), newTime);
    if (at.getTime() > Date.now()) return;
    const r = await logWater({ volumeMl: newVolume, at, force: true, note: day === today ? '' : h.addedFromHistory });
    if (r.ok) {
      setAdding(false);
      await reload();
    }
  };

  return (
    <Screen safeTop title={h.title}>
      <ChoiceGroup options={[{ value: 'day', label: h.today }, { value: 'week', label: h.last7Days }]} value={mode} onChange={(v) => setMode(v as 'day' | 'week')} />
      {mode === 'day' ? (
        <>
          {/* Navegação por dia (até 7 dias atrás) para conferir ou incluir o que ficou sem marcar. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BigButton kind="secondary" compact icon="◀" label={h.previous} disabled={dayIndex <= 0} onPress={() => changeDay(dayIndex - 1)} />
            <AppText bold style={{ flex: 1, textAlign: 'center' }} accessibilityLiveRegion="polite">{dayLabel(day)}{day === today ? '' : ` (${formatDate(parseISODate(day))})`}</AppText>
            <BigButton kind="secondary" compact icon="▶" label={h.next} disabled={dayIndex >= weekDays.length - 1} onPress={() => changeDay(dayIndex + 1)} />
          </View>
          <Card>
            <AppText variant="heading">{h.waterTotal(dayLogs.filter((l) => !l.deletedAt).reduce((sum, l) => sum + l.volumeMl, 0))}</AppText>
            {plan?.goalMl && plan.showGoalProgress ? <AppText muted>{h.guidedAmount(plan.goalMl)}</AppText> : null}
            {dayLogs.length === 0 ? <AppText muted>{day === today ? h.noLogsToday : h.noLogsDay}</AppText> : null}
            {dayLogs.map((l) => (
              <View key={l.id} style={{ borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: 8, gap: 6 }}>
                <AppText style={l.deletedAt ? { textDecorationLine: 'line-through', color: t.colors.textMuted } : undefined}>
                  {formatClock(new Date(l.at))} — {l.volumeMl} ml{l.beverage !== 'water' ? ` (${l.beverage})` : ''}{l.source === 'demo' ? h.demoTag : ''}{l.deletedAt ? h.undoneTag : ''}
                </AppText>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {l.deletedAt ? (
                    <BigButton kind="ghost" compact label={h.restore} onPress={() => void restoreLog(l).then(reload)} />
                  ) : (
                    <>
                      <BigButton kind="ghost" compact label={h.fix} onPress={() => { setEditing(l); setVolume(l.volumeMl); setEditTime(formatTimeBR(new Date(l.at))); }} />
                      <BigButton kind="ghost" compact label={h.undo} onPress={() => void undoLog(l).then(reload)} />
                    </>
                  )}
                </View>
                {editing?.id === l.id ? (
                  <Card tone="alt">
                    <Stepper label={h.newAmount} value={volume} onChange={setVolume} step={50} min={50} />
                    <TimeField label={h.time} value={editTime} onChange={setEditTime} />
                    <BigButton compact label={h.saveFix} onPress={() => void editLog(l, { volumeMl: volume, at: atLocalTime(parseISODate(day), editTime).toISOString() }).then(() => { setEditing(null); void reload(); })} />
                    <BigButton compact kind="ghost" label={s.common.cancel} onPress={() => setEditing(null)} />
                  </Card>
                ) : null}
              </View>
            ))}
            {adding ? (
              <Card tone="alt">
                <AppText variant="label" bold>{h.addEntry(dayLabel(day).toLowerCase())}</AppText>
                <TimeField label={h.time} value={newTime} onChange={setNewTime} />
                <Stepper label={h.amount} value={newVolume} onChange={setNewVolume} step={50} min={50} />
                <BigButton compact label={h.saveEntry} onPress={() => void addForDay()} />
                <BigButton compact kind="ghost" label={s.common.cancel} onPress={() => setAdding(false)} />
              </Card>
            ) : (
              <BigButton kind="secondary" compact label={h.addEntryButton} hint={h.addEntryHint} onPress={() => { setAdding(true); setEditing(null); }} />
            )}
          </Card>
          <Card>
            <AppText variant="heading">{day === today ? h.medicationsToday : h.medicationsDay}</AppText>
            {dayOccs.length === 0 ? <AppText muted>{h.noDosesDay}</AppText> : null}
            {dayOccs.map((o) => (
              <BigButton
                key={o.id}
                kind="ghost"
                compact
                label={`${formatClock(new Date(o.plannedAt))} · ${medsById.get(o.medicationId)?.name ?? s.common.medication} · ${occurrenceStatusLabel(o.status)}`}
                onPress={() => nav.navigate('OccurrenceAction', { occurrenceId: o.id })}
              />
            ))}
          </Card>
        </>
      ) : (
        <>
          <Card>
            <AppText variant="heading">{h.waterPerDay}</AppText>
            {weekDays.map((d) => {
              const tot = totals.find((x) => x.day === d);
              const ml = tot?.totalMl ?? 0;
              const max = Math.max(1, ...totals.map((x) => x.totalMl), plan?.goalMl ?? 0);
              return (
                <View key={d} style={{ gap: 4 }} accessibilityLabel={h.dayA11y(formatDate(parseISODate(d)), ml, tot?.count ?? 0)}>
                  <AppText>{h.dayRow(formatDate(parseISODate(d)), ml, tot?.count ?? 0)}</AppText>
                  <View style={{ height: 14, backgroundColor: t.colors.surfaceAlt, borderRadius: 7, borderWidth: 1, borderColor: t.colors.border }}>
                    <View style={{ width: `${Math.min(100, Math.round((ml / max) * 100))}%`, height: '100%', backgroundColor: t.colors.primary, borderRadius: 7 }} />
                  </View>
                </View>
              );
            })}
            <AppText muted variant="small">{h.noLevel}</AppText>
          </Card>
          <Card>
            <AppText variant="heading">{h.medicationsWeek}</AppText>
            {(['taken', 'not_taken', 'unconfirmed', 'scheduled', 'snoozed'] as const).map((st) => (
              <AppText key={st}>{occurrenceStatusLabel(st)}: {occs.filter((o) => o.status === st).length}</AppText>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
