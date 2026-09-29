import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Banner, ChoiceGroup, Stepper } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import type { BeverageKind } from '@/domain/types';
import { speak } from '@/services/speech/speech';

const BEVERAGES: { value: BeverageKind; label: string }[] = [
  { value: 'water', label: 'Água' },
  { value: 'tea', label: 'Chá' },
  { value: 'juice', label: 'Suco' },
  { value: 'milk', label: 'Leite' },
  { value: 'coffee', label: 'Café' },
  { value: 'soup', label: 'Sopa / caldo' },
  { value: 'other', label: 'Outra bebida' },
];

export function HydrationLogScreen() {
  const nav = useNavigation();
  const { profile, plan, logWater } = useAppStore();
  const containers = profile?.containers ?? [];
  const [volume, setVolume] = useState(containers[0]?.volumeMl ?? 200);
  const [container, setContainer] = useState<string | null>(containers[0]?.label ?? null);
  const [beverage, setBeverage] = useState<BeverageKind>('water');
  const [error, setError] = useState<string | null>(null);
  const [pendingDup, setPendingDup] = useState(false);
  // Outras bebidas só quando há plano profissional que contemple controle de líquidos.
  const allowOtherBeverages = plan?.mode === 'professional_goal';

  const save = async (force = false) => {
    setError(null);
    const r = await logWater({ volumeMl: volume, beverage, containerLabel: container, force });
    if (r.ok) {
      if (profile?.accessibility.speakReminders) speak(`Registrado: ${volume} mililitros.`);
      nav.goBack();
      return;
    }
    if (r.reason === 'possible_duplicate') {
      setPendingDup(true);
      setError('Você registrou a mesma quantidade há pouco. Quer registrar de novo mesmo assim?');
    } else setError('Quantidade inválida. Use entre 1 e 2000 ml.');
  };

  return (
    <Screen
      title="Registrar água"
      footer={
        <View style={{ gap: 8 }}>
          {pendingDup ? <BigButton kind="secondary" label="Sim, registrar de novo" onPress={() => void save(true)} /> : null}
          <BigButton label={`Registrar ${volume} ml`} icon="✓" onPress={() => void save(false)} />
          <BigButton kind="ghost" compact label="Cancelar" onPress={() => nav.goBack()} />
        </View>
      }
    >
      <AppText muted>Escolha o recipiente e ajuste a quantidade se precisar.</AppText>
      <ChoiceGroup
        label="Recipiente"
        options={containers.map((c) => ({ value: c.label, label: `${c.label} — ${c.volumeMl} ml` }))}
        value={container}
        onChange={(v) => {
          const c = containers.find((x) => x.label === v);
          setContainer(String(v));
          if (c) setVolume(c.volumeMl);
        }}
      />
      <Stepper label="Quantidade" value={volume} onChange={setVolume} step={50} min={50} max={2000} />
      {allowOtherBeverages ? (
        <ChoiceGroup label="O que você bebeu?" hint="Seu plano contempla controle de líquidos; registre as outras bebidas indicadas." options={BEVERAGES} value={beverage} onChange={(v) => setBeverage(v as BeverageKind)} />
      ) : null}
      {error ? <Banner tone="warning">{error}</Banner> : null}
    </Screen>
  );
}
