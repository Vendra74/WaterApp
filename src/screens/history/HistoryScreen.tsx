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
import { addDays, atLocalTime, formatDateBR, formatTimeBR, parseISODate, startOfLocalDay, toISODate } from '@/domain/time/time';
import { OCCURRENCE_STATUS_PT } from '@/domain/medication/occurrences';
import { useTheme } from '@/ui/theme';

export function HistoryScreen() {
  const nav = useNavigation();
  const t = useTheme();
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
  const dayLabel = (d: string) => (d === today ? 'Hoje' : d === toISODate(addDays(new Date(), -1)) ? 'Ontem' : formatDateBR(parseISODate(d)));
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
    const r = await logWater({ volumeMl: newVolume, at, force: true, note: day === today ? '' : 'incluído pelo histórico' });
    if (r.ok) {
      setAdding(false);
      await reload();
    }
  };

  return (
    <Screen safeTop title="Histórico">
      <ChoiceGroup options={[{ value: 'day', label: 'Hoje' }, { value: 'week', label: 'Últimos 7 dias' }]} value={mode} onChange={(v) => setMode(v as 'day' | 'week')} />
      {mode === 'day' ? (
        <>
          {/* Navegação por dia (até 7 dias atrás) para conferir ou incluir o que ficou sem marcar. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BigButton kind="secondary" compact icon="◀" label="Anterior" disabled={dayIndex <= 0} onPress={() => changeDay(dayIndex - 1)} />
            <AppText bold style={{ flex: 1, textAlign: 'center' }} accessibilityLiveRegion="polite">{dayLabel(day)}{day === today ? '' : ` (${formatDateBR(parseISODate(day))})`}</AppText>
            <BigButton kind="secondary" compact icon="▶" label="Próximo" disabled={dayIndex >= weekDays.length - 1} onPress={() => changeDay(dayIndex + 1)} />
          </View>
          <Card>
            <AppText variant="heading">Água — {dayLogs.filter((l) => !l.deletedAt).reduce((s, l) => s + l.volumeMl, 0)} ml</AppText>
            {plan?.goalMl && plan.showGoalProgress ? <AppText muted>Quantidade orientada: {plan.goalMl} ml</AppText> : null}
            {dayLogs.length === 0 ? <AppText muted>{day === today ? 'Nenhum registro hoje.' : 'Nenhum registro neste dia.'}</AppText> : null}
            {dayLogs.map((l) => (
              <View key={l.id} style={{ borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: 8, gap: 6 }}>
                <AppText style={l.deletedAt ? { textDecorationLine: 'line-through', color: t.colors.textMuted } : undefined}>
                  {formatTimeBR(new Date(l.at))} — {l.volumeMl} ml{l.beverage !== 'water' ? ` (${l.beverage})` : ''}{l.source === 'demo' ? ' · demonstração' : ''}{l.deletedAt ? ' · desfeito' : ''}
                </AppText>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {l.deletedAt ? (
                    <BigButton kind="ghost" compact label="Restaurar" onPress={() => void restoreLog(l).then(reload)} />
                  ) : (
                    <>
                      <BigButton kind="ghost" compact label="Corrigir" onPress={() => { setEditing(l); setVolume(l.volumeMl); setEditTime(formatTimeBR(new Date(l.at))); }} />
                      <BigButton kind="ghost" compact label="Desfazer" onPress={() => void undoLog(l).then(reload)} />
                    </>
                  )}
                </View>
                {editing?.id === l.id ? (
                  <Card tone="alt">
                    <Stepper label="Nova quantidade" value={volume} onChange={setVolume} step={50} min={50} />
                    <TimeField label="Horário" value={editTime} onChange={setEditTime} />
                    <BigButton compact label="Salvar correção" onPress={() => void editLog(l, { volumeMl: volume, at: atLocalTime(parseISODate(day), editTime).toISOString() }).then(() => { setEditing(null); void reload(); })} />
                    <BigButton compact kind="ghost" label="Cancelar" onPress={() => setEditing(null)} />
                  </Card>
                ) : null}
              </View>
            ))}
            {adding ? (
              <Card tone="alt">
                <AppText variant="label" bold>Incluir registro: {dayLabel(day).toLowerCase()}</AppText>
                <TimeField label="Horário" value={newTime} onChange={setNewTime} />
                <Stepper label="Quantidade" value={newVolume} onChange={setNewVolume} step={50} min={50} />
                <BigButton compact label="Salvar registro" onPress={() => void addForDay()} />
                <BigButton compact kind="ghost" label="Cancelar" onPress={() => setAdding(false)} />
              </Card>
            ) : (
              <BigButton kind="secondary" compact label="+ Incluir registro neste dia" hint="Para quando você bebeu e esqueceu de marcar." onPress={() => { setAdding(true); setEditing(null); }} />
            )}
          </Card>
          <Card>
            <AppText variant="heading">{day === today ? 'Medicamentos de hoje' : 'Medicamentos do dia'}</AppText>
            {dayOccs.length === 0 ? <AppText muted>Nenhuma dose prevista neste dia.</AppText> : null}
            {dayOccs.map((o) => (
              <BigButton
                key={o.id}
                kind="ghost"
                compact
                label={`${formatTimeBR(new Date(o.plannedAt))} · ${medsById.get(o.medicationId)?.name ?? 'Medicamento'} · ${OCCURRENCE_STATUS_PT[o.status]}`}
                onPress={() => nav.navigate('OccurrenceAction', { occurrenceId: o.id })}
              />
            ))}
          </Card>
        </>
      ) : (
        <>
          <Card>
            <AppText variant="heading">Água por dia</AppText>
            {weekDays.map((d) => {
              const tot = totals.find((x) => x.day === d);
              const ml = tot?.totalMl ?? 0;
              const max = Math.max(1, ...totals.map((x) => x.totalMl), plan?.goalMl ?? 0);
              return (
                <View key={d} style={{ gap: 4 }} accessibilityLabel={`${formatDateBR(parseISODate(d))}: ${ml} mililitros em ${tot?.count ?? 0} registros`}>
                  <AppText>{formatDateBR(parseISODate(d))} — {ml} ml ({tot?.count ?? 0} registros)</AppText>
                  <View style={{ height: 14, backgroundColor: t.colors.surfaceAlt, borderRadius: 7, borderWidth: 1, borderColor: t.colors.border }}>
                    <View style={{ width: `${Math.min(100, Math.round((ml / max) * 100))}%`, height: '100%', backgroundColor: t.colors.primary, borderRadius: 7 }} />
                  </View>
                </View>
              );
            })}
            <AppText muted variant="small">Estes são os valores que você registrou. O aplicativo não calcula um “nível de hidratação”.</AppText>
          </Card>
          <Card>
            <AppText variant="heading">Medicamentos na semana</AppText>
            {(['taken', 'not_taken', 'unconfirmed', 'scheduled', 'snoozed'] as const).map((s) => (
              <AppText key={s}>{OCCURRENCE_STATUS_PT[s]}: {occs.filter((o) => o.status === s).length}</AppText>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
