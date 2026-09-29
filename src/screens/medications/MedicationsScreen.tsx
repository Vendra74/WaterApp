import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { useAppStore } from '@/state/appStore';
import { describeSchedule } from './format';

export function MedicationsScreen() {
  const nav = useNavigation();
  const medications = useAppStore((s) => s.medications);
  return (
    <Screen title="Medicamentos" footer={<BigButton label="Cadastrar medicamento" icon="+" onPress={() => nav.navigate('MedicationForm')} />}>
      <AppText muted>Cadastre exatamente como está na prescrição. O aplicativo não sugere doses nem horários.</AppText>
      {medications.length === 0 ? <AppText>Nenhum medicamento cadastrado.</AppText> : null}
      {medications.map((m) => (
        <Card key={m.id} tone={m.active ? 'default' : 'alt'}>
          <AppText variant="heading">{m.name}{m.active ? '' : ' (pausado)'}</AppText>
          <AppText>{[m.presentation, `${m.doseAmount} ${m.doseUnit}`.trim(), m.route].filter(Boolean).join(' · ')}</AppText>
          <AppText muted>{describeSchedule(m)}</AppText>
          <BigButton kind="secondary" compact label="Ver detalhes e histórico" onPress={() => nav.navigate('MedicationDetail', { id: m.id })} />
        </Card>
      ))}
    </Screen>
  );
}
