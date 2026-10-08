import { describeDose } from '@/domain/medication/dose';
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { useAppStore } from '@/state/appStore';
import { describeSchedule, routeLabel } from './format';
import { strings } from '@/i18n';

export function MedicationsScreen() {
  const nav = useNavigation();
  const medications = useAppStore((st) => st.medications);
  const s = strings().medications;
  return (
    <Screen safeTop title={s.title} footer={<BigButton label={s.add} icon="+" onPress={() => nav.navigate('MedicationForm')} />}>
      <AppText muted>{s.intro}</AppText>
      {medications.length === 0 ? <AppText>{s.none}</AppText> : null}
      {medications.map((m) => (
        <Card key={m.id} tone={m.active ? 'default' : 'alt'}>
          <AppText variant="heading">{m.name}{m.active ? '' : s.paused}</AppText>
          <AppText>{[m.presentation, describeDose(m.doseAmount, m.doseUnit), routeLabel(m.route)].filter(Boolean).join(' · ')}</AppText>
          <AppText muted>{describeSchedule(m)}</AppText>
          <BigButton kind="secondary" compact label={s.seeDetails} onPress={() => nav.navigate('MedicationDetail', { id: m.id })} />
        </Card>
      ))}
    </Screen>
  );
}
