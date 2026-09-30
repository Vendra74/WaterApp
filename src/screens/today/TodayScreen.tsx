import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { totalForDay } from '@/domain/hydration/logs';
import { goalProgressPercent } from '@/domain/safety/plan';
import { suggestFor } from '@/domain/safety/suggestions';
import { generateHydrationSlots } from '@/domain/hydration/schedule';
import { formatTimeBR, WEEKDAY_LONG_PT, weekdayOf } from '@/domain/time/time';
import { OCCURRENCE_STATUS_PT } from '@/domain/medication/occurrences';
import { speak } from '@/services/speech/speech';
import { useTheme } from '@/ui/theme';

export function TodayScreen() {
  const nav = useNavigation();
  const t = useTheme();
  const { profile, settings, plan, todayLogs, medications, occurrences, permission, notificationState, sync, lastUndo, undoLog } = useAppStore();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const total = totalForDay(todayLogs, now);
  const pct = plan ? goalProgressPercent(total, plan) : null;
  const nextHydration = useMemo(() => {
    if (!settings || !profile) return null;
    const slots = generateHydrationSlots({ settings, naps: profile.naps, now, days: 2 });
    return slots[0]?.at ?? null;
  }, [settings, profile, now]);
  const medsById = new Map(medications.map((m) => [m.id, m]));
  const upcoming = occurrences
    .filter((o) => (o.status === 'scheduled' || o.status === 'snoozed' || o.status === 'unconfirmed') && new Date(o.plannedAt).getTime() > now.getTime() - 12 * 3_600_000)
    .slice(0, 4);
  const suggestions = profile && plan ? suggestFor(profile, plan, now) : [];
  const name = profile?.preferredName || profile?.name || '';

  const readAloud = () => {
    const parts = [
      `Agora são ${formatTimeBR(now)}.`,
      nextHydration ? `Próximo lembrete de água às ${formatTimeBR(nextHydration)}.` : 'Nenhum lembrete de água programado.',
      `Hoje você registrou ${total} mililitros.`,
      upcoming.length ? `Próximo medicamento: ${medsById.get(upcoming[0]!.medicationId)?.name ?? ''} às ${formatTimeBR(new Date(upcoming[0]!.plannedAt))}.` : '',
    ];
    speak(parts.join(' '));
  };

  return (
    <Screen>
      {/* Com letras muito grandes o botão não cabe ao lado da hora: empilha em vez de cortar. */}
      <View style={t.fontScale >= 1.5 ? { gap: t.space(1) } : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <AppText muted>{WEEKDAY_LONG_PT[weekdayOf(now)]}</AppText>
          <AppText variant="big" accessibilityLabel={`Agora são ${formatTimeBR(now)}`}>{formatTimeBR(now)}</AppText>
        </View>
        <BigButton kind="secondary" compact icon="🔊" label="Ler em voz alta" onPress={readAloud} />
      </View>
      {name ? <AppText variant="heading">Olá, {name}.</AppText> : null}

      {permission === 'denied' ? (
        <Banner tone="warning" title="Notificações desligadas">Os lembretes não vão aparecer. Ative em Mais → Testar notificações.</Banner>
      ) : null}
      {notificationState?.lastError && permission !== 'denied' ? <Banner tone="warning" title="Agendamento">{notificationState.lastError}</Banner> : null}

      <Card tone="alt">
        <AppText variant="label" muted>Próximo lembrete de água</AppText>
        <AppText variant="big">{nextHydration ? formatTimeBR(nextHydration) : '—'}</AppText>
        {!settings?.enabled ? <AppText muted>Lembretes de água desligados. Ligue em Lembretes.</AppText> : null}
        <AppText variant="label" muted>Água registrada hoje</AppText>
        <AppText variant="heading">{total} ml{pct !== null && plan?.goalMl ? ` · ${pct}% de ${plan.goalMl} ml` : ''}</AppText>
        {pct !== null && pct > 100 ? <AppText style={{ color: t.colors.warning }}>Acima da quantidade orientada. Se tiver dúvida, fale com sua equipe de saúde.</AppText> : null}
        {suggestions.length > 1 ? (
          <AppText muted variant="small">Sugestão de agora: {suggestions.map((s) => s.label).join(', ')}. (Frutas não contam como líquido.)</AppText>
        ) : null}
      </Card>

      <BigButton label="Registrar água" icon="💧" onPress={() => nav.navigate('HydrationLog')} />
      {lastUndo ? (
        <BigButton kind="ghost" compact label={`Desfazer último registro (${lastUndo.volumeMl} ml)`} onPress={() => void undoLog(lastUndo)} />
      ) : null}

      <Card>
        <AppText variant="heading">Próximos medicamentos</AppText>
        {upcoming.length === 0 ? <AppText muted>{medications.length === 0 ? 'Nenhum medicamento cadastrado.' : 'Nada pendente nas próximas horas.'}</AppText> : null}
        {upcoming.map((o) => {
          const m = medsById.get(o.medicationId);
          const when = o.status === 'snoozed' && o.snoozedUntil ? new Date(o.snoozedUntil) : new Date(o.plannedAt);
          return (
            <BigButton
              key={o.id}
              kind="secondary"
              compact
              label={`${formatTimeBR(when)} · ${m?.name ?? 'Medicamento'} · ${OCCURRENCE_STATUS_PT[o.status]}`}
              hint="Abre as opções: tomei, lembrar depois, não tomei"
              onPress={() => nav.navigate('OccurrenceAction', { occurrenceId: o.id })}
            />
          );
        })}
      </Card>

      <BigButton kind="danger" label="Preciso de ajuda" icon="☎" onPress={() => nav.navigate('Help')} />

      {sync && sync.configured && sync.pending > 0 ? (
        <AppText muted variant="small">{sync.pending} registro(s) aguardando sincronização{sync.online ? '' : ' (sem internet)'}.</AppText>
      ) : null}
    </Screen>
  );
}
