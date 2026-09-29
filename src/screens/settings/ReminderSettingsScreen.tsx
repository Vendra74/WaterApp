import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner, ChoiceGroup, TimeField, Toggle } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import type { HydrationSettings, Weekday } from '@/domain/types';
import { WEEKDAY_LABELS_PT } from '@/domain/time/time';
import { generateHydrationSlots } from '@/domain/hydration/schedule';

export function ReminderSettingsScreen() {
  const nav = useNavigation();
  const { settings, profile, updateSettings, medications } = useAppStore();
  const [s, setS] = useState<HydrationSettings>(settings!);
  const set = (p: Partial<HydrationSettings>) => setS((x) => ({ ...x, ...p }));
  const preview = profile ? generateHydrationSlots({ settings: s, naps: profile.naps, now: new Date(new Date().setHours(0, 0, 0, 0)), days: 1 }) : [];
  const hasNightMeds = medications.some((m) => m.active && m.times.some((tm) => tm >= s.windowEnd || tm < s.windowStart));

  return (
    <Screen
      title="Lembretes de água"
      footer={
        <View style={{ gap: 8 }}>
          <BigButton label="Salvar" icon="✓" onPress={() => void updateSettings(s).then(() => nav.goBack())} />
          <BigButton kind="ghost" compact label="Cancelar" onPress={() => nav.goBack()} />
        </View>
      }
    >
      <Toggle label="Lembretes de água ligados" value={s.enabled} onChange={(v) => set({ enabled: v })} />
      <ChoiceGroup
        label="Como lembrar?"
        options={[{ value: 'interval', label: 'De tanto em tanto tempo' }, { value: 'times', label: 'Em horários que eu escolher' }]}
        value={s.mode}
        onChange={(v) => set({ mode: v as HydrationSettings['mode'] })}
      />
      {s.mode === 'interval' ? (
        <ChoiceGroup
          label="Intervalo"
          options={[{ value: '60', label: 'A cada 1 hora' }, { value: '90', label: 'A cada 1 hora e meia' }, { value: '120', label: 'A cada 2 horas' }, { value: '180', label: 'A cada 3 horas' }]}
          value={String(s.intervalMinutes)}
          onChange={(v) => set({ intervalMinutes: Number(v) })}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {s.times.map((tm, i) => (
            <View key={i} style={{ gap: 8 }}>
              <TimeField label={`Horário ${i + 1}`} value={tm} onChange={(v) => set({ times: s.times.map((x, j) => (j === i ? v : x)) })} />
              <BigButton kind="ghost" compact label="Remover" onPress={() => set({ times: s.times.filter((_, j) => j !== i) })} />
            </View>
          ))}
          <BigButton kind="secondary" compact label="+ Adicionar horário" onPress={() => set({ times: [...s.times, '10:00'] })} />
        </View>
      )}
      <Card>
        <AppText variant="heading">Período dos lembretes</AppText>
        <TimeField label="Começar às" value={s.windowStart} onChange={(v) => set({ windowStart: v })} />
        <TimeField label="Parar às" value={s.windowEnd} onChange={(v) => set({ windowEnd: v })} />
        <Toggle label="Pausar durante os cochilos" hint={profile?.naps.length ? `Cochilos: ${profile.naps.map((n) => `${n.start}–${n.end}`).join(', ')}` : 'Nenhum cochilo cadastrado no perfil.'} value={s.pauseDuringNaps} onChange={(v) => set({ pauseDuringNaps: v })} />
      </Card>
      {hasNightMeds ? (
        <Banner tone="info" title="Medicamentos fora do período">
          A pausa da água não desliga os lembretes de medicamentos. Eles continuam nos horários cadastrados.
        </Banner>
      ) : null}
      <ChoiceGroup
        label="Dias da semana"
        multi
        options={([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => ({ value: String(d), label: WEEKDAY_LABELS_PT[d] }))}
        value={s.weekdays.map(String)}
        onChange={(v) => set({ weekdays: (v as string[]).map(Number).sort() as Weekday[] })}
      />
      <Card>
        <AppText variant="heading">Som e vibração</AppText>
        <Toggle label="Som" value={s.sound} onChange={(v) => set({ sound: v })} />
        <Toggle label="Vibração" hint="Android: também controlado pelo canal nas configurações do sistema." value={s.vibrate} onChange={(v) => set({ vibrate: v })} />
        <ChoiceGroup label='Tempo de "Lembrar depois"' options={[{ value: '10', label: '10 minutos' }, { value: '15', label: '15 minutos' }, { value: '30', label: '30 minutos' }]} value={String(s.snoozeMinutes)} onChange={(v) => set({ snoozeMinutes: Number(v) })} />
      </Card>
      <Card>
        <AppText variant="heading">Privacidade</AppText>
        <Toggle label="Mostrar nome do medicamento na notificação" hint="Desligado por padrão: a tela bloqueada mostra apenas 'Hora do seu medicamento'." value={s.showDetailsOnLockScreen} onChange={(v) => set({ showDetailsOnLockScreen: v })} />
      </Card>
      <Card tone="alt">
        <AppText variant="label" bold>Prévia de um dia</AppText>
        <AppText muted>{preview.length ? preview.map((p) => `${String(p.at.getHours()).padStart(2, '0')}:${String(p.at.getMinutes()).padStart(2, '0')}`).join(' · ') : 'Nenhum lembrete com esta configuração.'}</AppText>
        <AppText muted variant="small">O sistema pode atrasar notificações em economia de bateria. Veja “Testar notificações” em Mais.</AppText>
      </Card>
    </Screen>
  );
}
