import React from 'react';
import { Alert, Image } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/core/navigation';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { useAppStore } from '@/state/appStore';
import { OCCURRENCE_STATUS_PT } from '@/domain/medication/occurrences';
import { formatDateBR, formatTimeBR } from '@/domain/time/time';
import { describeSchedule } from './format';

export function MedicationDetailScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'MedicationDetail'>>();
  const { medications, occurrences, deleteMedication } = useAppStore();
  const m = medications.find((x) => x.id === route.params.id);
  if (!m) return <Screen title="Medicamento"><AppText>Não encontrado.</AppText></Screen>;
  // Doses em ordem cronológica: as últimas 5 (inclusive as de hoje que já passaram) e depois as
  // próximas. Antes, a lista vinha do mais distante para o mais próximo e cortava em 20: com 14 dias
  // de doses, as de hoje ficavam de fora.
  const all = occurrences.filter((o) => o.medicationId === m.id).sort((a, b) => a.plannedAt.localeCompare(b.plannedAt));
  const nowMs = Date.now();
  const firstUpcoming = all.findIndex((o) => new Date(o.plannedAt).getTime() >= nowMs);
  const start = Math.max(0, (firstUpcoming === -1 ? all.length : firstUpcoming) - 5);
  const occs = all.slice(start, start + 20);

  const remove = () =>
    Alert.alert('Apagar medicamento?', 'O cadastro e o histórico de doses deste medicamento serão apagados deste aparelho.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => void deleteMedication(m.id).then(() => nav.goBack()) },
    ]);

  return (
    <Screen title={m.name}>
      <Card>
        <AppText>{[m.presentation, `${m.doseAmount} ${m.doseUnit}`.trim(), m.route].filter(Boolean).join(' · ')}</AppText>
        <AppText muted>{describeSchedule(m)}</AppText>
        {m.instructions ? <AppText>Instruções: {m.instructions}</AppText> : null}
        {m.photoUri ? <Image source={{ uri: m.photoUri }} accessibilityLabel="Foto da embalagem ou receita" style={{ width: '100%', height: 220, borderRadius: 12 }} resizeMode="cover" /> : null}
      </Card>
      <BigButton kind="secondary" label="Editar" onPress={() => nav.navigate('MedicationForm', { id: m.id })} />
      <Card>
        <AppText variant="heading">Doses recentes e próximas</AppText>
        {occs.length === 0 ? <AppText muted>Nenhuma dose registrada ainda.</AppText> : null}
        {occs.map((o) => (
          <BigButton
            key={o.id}
            kind="ghost"
            compact
            label={`${formatDateBR(new Date(o.plannedAt))} ${formatTimeBR(new Date(o.plannedAt))} — ${OCCURRENCE_STATUS_PT[o.status]}${o.takenAt ? ` (${formatTimeBR(new Date(o.takenAt))})` : ''}`}
            hint="Abre as opções de confirmação ou correção"
            onPress={() => nav.navigate('OccurrenceAction', { occurrenceId: o.id })}
          />
        ))}
      </Card>
      <BigButton kind="danger" label="Apagar medicamento" onPress={remove} />
    </Screen>
  );
}
