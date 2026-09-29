import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/core/navigation';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner, TextField } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { OCCURRENCE_STATUS_PT } from '@/domain/medication/occurrences';
import { formatDateBR, formatTimeBR } from '@/domain/time/time';
import { speak } from '@/services/speech/speech';

export function OccurrenceActionScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'OccurrenceAction'>>();
  const { occurrences, medications, settings, profile, confirmTaken, snooze, notTaken, correct } = useAppStore();
  const occ = occurrences.find((o) => o.id === route.params.occurrenceId);
  const med = medications.find((m) => m.id === occ?.medicationId);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [correcting, setCorrecting] = useState(false);

  if (!occ || !med) return <Screen title="Medicamento"><AppText>Registro não encontrado.</AppText><BigButton label="Voltar" onPress={() => nav.goBack()} /></Screen>;

  const planned = new Date(occ.plannedAt);
  const isTaken = occ.status === 'taken';

  const doTaken = async () => {
    const r = await confirmTaken(occ.id);
    if (r?.alreadyConfirmed) setMsg('Esta dose já estava confirmada. Nada foi duplicado.');
    else {
      if (profile?.accessibility.speakReminders) speak(`${med.name} confirmado.`);
      nav.goBack();
    }
  };

  const readAloud = () => speak(`${med.name}, ${med.doseAmount} ${med.doseUnit}, ${med.route}. Horário: ${formatTimeBR(planned)}. ${med.instructions}`);

  return (
    <Screen title={med.name}>
      <Card tone={isTaken ? 'success' : 'alt'}>
        <AppText variant="heading">{formatDateBR(planned)} às {formatTimeBR(planned)}</AppText>
        <AppText>{`${med.doseAmount} ${med.doseUnit}`.trim()}{med.presentation ? ` · ${med.presentation}` : ''} · {med.route}</AppText>
        {med.instructions ? <AppText>Instruções: {med.instructions}</AppText> : null}
        <AppText bold>Situação: {OCCURRENCE_STATUS_PT[occ.status]}{occ.takenAt ? ` às ${formatTimeBR(new Date(occ.takenAt))}` : ''}{occ.status === 'snoozed' && occ.snoozedUntil ? ` até ${formatTimeBR(new Date(occ.snoozedUntil))}` : ''}</AppText>
        <BigButton kind="secondary" compact icon="🔊" label="Ler em voz alta" onPress={readAloud} />
      </Card>
      {msg ? <Banner tone="info">{msg}</Banner> : null}
      {isTaken ? (
        <Banner tone="success" title="Dose já confirmada">Se marcou por engano, use “Corrigir registro” abaixo.</Banner>
      ) : (
        <View style={{ gap: 8 }}>
          <BigButton label="Tomei" icon="✓" onPress={() => void doTaken()} />
          <BigButton kind="secondary" label={`Lembrar depois (${settings?.snoozeMinutes ?? 15} min)`} icon="⏰" hint="Adia apenas este aviso. Os próximos horários não mudam." onPress={() => void snooze(occ.id, settings?.snoozeMinutes ?? 15).then(() => nav.goBack())} />
          <BigButton kind="secondary" label="Não tomei" onPress={() => void notTaken(occ.id).then(() => nav.goBack())} />
          <AppText muted variant="small">Adiar não altera a prescrição. O aplicativo não orienta compensar ou dobrar doses: em dúvida, fale com quem prescreveu.</AppText>
        </View>
      )}
      {correcting ? (
        <Card>
          <AppText variant="heading">Corrigir registro</AppText>
          <AppText muted variant="small">A alteração fica no histórico desta dose.</AppText>
          <TextField label="Motivo" value={note} onChangeText={setNote} placeholder="Ex.: tomei mas esqueci de marcar" />
          <BigButton compact label="Marcar como tomada" onPress={() => void correct(occ.id, 'taken', note || 'correção').then(() => nav.goBack())} />
          <BigButton compact kind="secondary" label="Marcar como não tomada" onPress={() => void correct(occ.id, 'not_taken', note || 'correção').then(() => nav.goBack())} />
          <BigButton compact kind="secondary" label="Voltar para agendada" onPress={() => void correct(occ.id, 'scheduled', note || 'correção').then(() => nav.goBack())} />
        </Card>
      ) : (
        <BigButton kind="ghost" compact label="Corrigir registro" onPress={() => setCorrecting(true)} />
      )}
      <Card>
        <AppText variant="label" bold>Histórico desta dose</AppText>
        {occ.history.map((h, i) => (
          <AppText key={i} variant="small" muted>{formatDateBR(new Date(h.at))} {formatTimeBR(new Date(h.at))} — {OCCURRENCE_STATUS_PT[h.to]} ({h.reason})</AppText>
        ))}
      </Card>
      <BigButton kind="ghost" compact label="Voltar" onPress={() => nav.goBack()} />
    </Screen>
  );
}
