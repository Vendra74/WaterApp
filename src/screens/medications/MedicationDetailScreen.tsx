import { describeDose } from '@/domain/medication/dose';
import React from 'react';
import { Alert, Image } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/core/navigation';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { useAppStore } from '@/state/appStore';
import { occurrenceStatusLabel } from '@/domain/medication/occurrences';
import { describeSchedule, routeLabel } from './format';
import { strings } from '@/i18n';
import { formatClock, formatDate } from '@/i18n/format';

export function MedicationDetailScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'MedicationDetail'>>();
  const { medications, occurrences, deleteMedication } = useAppStore();
  const s = strings();
  const md = s.medications;
  const m = medications.find((x) => x.id === route.params.id);
  if (!m) return <Screen title={s.common.medication}><AppText>{md.notFound}</AppText></Screen>;
  // Doses em ordem cronológica: as últimas 5 (inclusive as de hoje que já passaram) e depois as
  // próximas. Antes, a lista vinha do mais distante para o mais próximo e cortava em 20: com 14 dias
  // de doses, as de hoje ficavam de fora.
  const all = occurrences.filter((o) => o.medicationId === m.id).sort((a, b) => a.plannedAt.localeCompare(b.plannedAt));
  const nowMs = Date.now();
  const firstUpcoming = all.findIndex((o) => new Date(o.plannedAt).getTime() >= nowMs);
  const start = Math.max(0, (firstUpcoming === -1 ? all.length : firstUpcoming) - 5);
  const occs = all.slice(start, start + 20);

  const remove = () =>
    Alert.alert(md.deleteTitle, md.deleteBody, [
      { text: s.common.cancel, style: 'cancel' },
      { text: md.delete, style: 'destructive', onPress: () => void deleteMedication(m.id).then(() => nav.goBack()) },
    ]);

  return (
    <Screen title={m.name}>
      <Card>
        <AppText>{[m.presentation, describeDose(m.doseAmount, m.doseUnit), routeLabel(m.route)].filter(Boolean).join(' · ')}</AppText>
        <AppText muted>{describeSchedule(m)}</AppText>
        {m.instructions ? <AppText>{md.instructions(m.instructions)}</AppText> : null}
        {m.photoUri ? <Image source={{ uri: m.photoUri }} accessibilityLabel={md.photoA11y} style={{ width: '100%', height: 220, borderRadius: 12 }} resizeMode="cover" /> : null}
      </Card>
      <BigButton kind="secondary" label={md.edit} onPress={() => nav.navigate('MedicationForm', { id: m.id })} />
      <Card>
        <AppText variant="heading">{md.recentDoses}</AppText>
        {occs.length === 0 ? <AppText muted>{md.noDoses}</AppText> : null}
        {occs.map((o) => (
          <BigButton
            key={o.id}
            kind="ghost"
            compact
            label={`${formatDate(new Date(o.plannedAt))} ${formatClock(new Date(o.plannedAt))} — ${occurrenceStatusLabel(o.status)}${o.takenAt ? ` (${formatClock(new Date(o.takenAt))})` : ''}`}
            hint={md.doseHint}
            onPress={() => nav.navigate('OccurrenceAction', { occurrenceId: o.id })}
          />
        ))}
      </Card>
      <BigButton kind="danger" label={md.deleteButton} onPress={remove} />
    </Screen>
  );
}
