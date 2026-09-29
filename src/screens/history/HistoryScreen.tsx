import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { ChoiceGroup, Stepper } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { loadLogsLastDays } from '@/services/usecases/hydration';
import { loadOccurrencesBetween } from '@/services/usecases/medications';
import type { HydrationLog, MedicationOccurrence } from '@/domain/types';
import { totalsByDay } from '@/domain/hydration/logs';
import { addDays, formatDateBR, formatTimeBR, parseISODate, startOfLocalDay, toISODate } from '@/domain/time/time';
import { OCCURRENCE_STATUS_PT } from '@/domain/medication/occurrences';
import { useTheme } from '@/ui/theme';

export function HistoryScreen() {
  const nav = useNavigation();
  const t = useTheme();
  const { medications, plan, todayLogs, undoLog, restoreLog, editLog } = useAppStore();
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [logs, setLogs] = useState<HydrationLog[]>([]);
  const [occs, setOccs] = useState<MedicationOccurrence[]>([]);
  const [editing, setEditing] = useState<HydrationLog | null>(null);
  const [volume, setVolume] = useState(0);

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
  const dayLogs = logs.filter((l) => toISODate(new Date(l.at)) === today);
  const dayOccs = occs.filter((o) => toISODate(new Date(o.plannedAt)) === today);
  const totals = totalsByDay(logs);
  const weekDays = Array.from({ length: 7 }, (_, i) => toISODate(addDays(new Date(), -6 + i)));

  return (
    <Screen title="Histórico">
      <ChoiceGroup options={[{ value: 'day', label: 'Hoje' }, { value: 'week', label: 'Últimos 7 dias' }]} value={mode} onChange={(v) => setMode(v as 'day' | 'week')} />
      {mode === 'day' ? (
        <>
          <Card>
            <AppText variant="heading">Água — {dayLogs.filter((l) => !l.deletedAt).reduce((s, l) => s + l.volumeMl, 0)} ml</AppText>
            {plan?.goalMl && plan.showGoalProgress ? <AppText muted>Quantidade orientada: {plan.goalMl} ml</AppText> : null}
            {dayLogs.length === 0 ? <AppText muted>Nenhum registro hoje.</AppText> : null}
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
                      <BigButton kind="ghost" compact label="Corrigir" onPress={() => { setEditing(l); setVolume(l.volumeMl); }} />
                      <BigButton kind="ghost" compact label="Desfazer" onPress={() => void undoLog(l).then(reload)} />
                    </>
                  )}
                </View>
                {editing?.id === l.id ? (
                  <Card tone="alt">
                    <Stepper label="Nova quantidade" value={volume} onChange={setVolume} step={50} min={50} />
                    <BigButton compact label="Salvar correção" onPress={() => void editLog(l, { volumeMl: volume }).then(() => { setEditing(null); void reload(); })} />
                    <BigButton compact kind="ghost" label="Cancelar" onPress={() => setEditing(null)} />
                  </Card>
                ) : null}
              </View>
            ))}
          </Card>
          <Card>
            <AppText variant="heading">Medicamentos de hoje</AppText>
            {dayOccs.length === 0 ? <AppText muted>Nenhuma dose prevista hoje.</AppText> : null}
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
