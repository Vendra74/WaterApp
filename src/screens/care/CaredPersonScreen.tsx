import React, { useEffect, useState } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/core/navigation';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner } from '@/ui/components/Fields';
import { acknowledgeAlert, fetchCaredSummary, type CaredSummary } from '@/services/sync/careService';
import { currentUser } from '@/services/sync/authService';
import { addDays, formatDateBR, formatTimeBR, startOfLocalDay } from '@/domain/time/time';
import { OCCURRENCE_STATUS_PT } from '@/domain/medication/occurrences';
import type { OccurrenceStatus } from '@/domain/types';

export function CaredPersonScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CaredPerson'>>();
  const { ownerId, name } = route.params;
  const [summary, setSummary] = useState<CaredSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    try {
      const start = startOfLocalDay(new Date());
      setSummary(await fetchCaredSummary(ownerId, start.toISOString(), addDays(start, 1).toISOString()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void load();
  }, [ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const medName = (id: string) => summary?.medications.find((m) => m.id === id)?.name ?? 'Medicamento';

  return (
    <Screen title={name}>
      <AppText muted>O que você vê aqui são os registros feitos no aplicativo. Ausência de registro não significa que a pessoa não bebeu ou não tomou.</AppText>
      {error ? <Banner tone="warning">{error}</Banner> : null}
      <BigButton compact kind="secondary" label="Atualizar" onPress={() => void load()} />
      {summary ? (
        <>
          <Card>
            <AppText variant="heading">Avisos</AppText>
            {summary.alerts.filter((a) => !a.acknowledged_at).length === 0 ? <AppText muted>Nenhum aviso pendente.</AppText> : null}
            {summary.alerts.filter((a) => !a.acknowledged_at).map((a) => (
              <Card key={a.id} tone="warning">
                <AppText>{formatDateBR(new Date(a.created_at))} {formatTimeBR(new Date(a.created_at))}</AppText>
                <AppText>{a.message}</AppText>
                <BigButton compact label="Marcar como visto" onPress={() => void currentUser().then((u) => u && acknowledgeAlert(a.id, u.id)).then(load)} />
              </Card>
            ))}
          </Card>
          <Card>
            <AppText variant="heading">Água registrada hoje: {summary.todayWaterMl} ml</AppText>
            {summary.todayLogs.map((l, i) => <AppText key={i}>{formatTimeBR(new Date(l.at))} — {l.volume_ml} ml</AppText>)}
          </Card>
          <Card>
            <AppText variant="heading">Medicamentos de hoje</AppText>
            {summary.occurrences.length === 0 ? <AppText muted>Nenhuma dose prevista hoje.</AppText> : null}
            {summary.occurrences.map((o) => <AppText key={o.id}>{formatTimeBR(new Date(o.planned_at))} · {medName(o.medication_id)} · {OCCURRENCE_STATUS_PT[o.status as OccurrenceStatus] ?? o.status}</AppText>)}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
