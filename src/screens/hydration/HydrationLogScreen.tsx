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
import { strings } from '@/i18n';

const beverages = (): { value: BeverageKind; label: string }[] => {
  const h = strings().hydration;
  return [
    { value: 'water', label: h.beverageWater },
    { value: 'tea', label: h.beverageTea },
    { value: 'juice', label: h.beverageJuice },
    { value: 'milk', label: h.beverageMilk },
    { value: 'coffee', label: h.beverageCoffee },
    { value: 'soup', label: h.beverageSoup },
    { value: 'other', label: h.beverageOther },
  ];
};

export function HydrationLogScreen() {
  const nav = useNavigation();
  const s = strings();
  const h = s.hydration;
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
      if (profile?.accessibility.speakReminders) speak(h.spokenLogged(volume));
      nav.goBack();
      return;
    }
    if (r.reason === 'possible_duplicate') {
      setPendingDup(true);
      setError(h.duplicate);
    } else setError(h.invalidVolume);
  };

  return (
    <Screen
      title={h.title}
      footer={
        <View style={{ gap: 8 }}>
          {pendingDup ? <BigButton kind="secondary" label={h.confirmDuplicate} onPress={() => void save(true)} /> : null}
          <BigButton label={h.logAmount(volume)} icon="✓" onPress={() => void save(false)} />
          <BigButton kind="ghost" compact label={s.common.cancel} onPress={() => nav.goBack()} />
        </View>
      }
    >
      <AppText muted>{h.intro}</AppText>
      <ChoiceGroup
        label={h.container}
        options={containers.map((c) => ({ value: c.label, label: h.containerOption(c.label, c.volumeMl) }))}
        value={container}
        onChange={(v) => {
          const c = containers.find((x) => x.label === v);
          setContainer(String(v));
          if (c) setVolume(c.volumeMl);
        }}
      />
      <Stepper label={h.amount} value={volume} onChange={setVolume} step={50} min={50} max={2000} />
      {allowOtherBeverages ? (
        <ChoiceGroup label={h.whatDidYouDrink} hint={h.whatDidYouDrinkHint} options={beverages()} value={beverage} onChange={(v) => setBeverage(v as BeverageKind)} />
      ) : null}
      {error ? <Banner tone="warning">{error}</Banner> : null}
    </Screen>
  );
}
