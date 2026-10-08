import { describeDose } from '@/domain/medication/dose';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/core/navigation';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner, TextField, TimeField } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { occurrenceStatusLabel } from '@/domain/medication/occurrences';
import { atLocalTime, formatTimeBR } from '@/domain/time/time';
import { speak } from '@/services/speech/speech';
import { strings } from '@/i18n';
import { formatClock, formatDate } from '@/i18n/format';
import { routeLabel } from './format';

export function OccurrenceActionScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'OccurrenceAction'>>();
  const { occurrences, medications, settings, profile, confirmTaken, snooze, notTaken, correct } = useAppStore();
  const occ = occurrences.find((o) => o.id === route.params.occurrenceId);
  const med = medications.find((m) => m.id === occ?.medicationId);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [takenTime, setTakenTime] = useState<string | null>(null);
  const s = strings();
  const oc = s.occurrence;

  if (!occ || !med) return <Screen title={s.common.medication}><AppText>{oc.notFound}</AppText><BigButton label={s.common.back} onPress={() => nav.goBack()} /></Screen>;

  const planned = new Date(occ.plannedAt);
  const isTaken = occ.status === 'taken';

  const doTaken = async () => {
    const r = await confirmTaken(occ.id);
    if (r?.alreadyConfirmed) setMsg(oc.alreadyConfirmed);
    else {
      if (profile?.accessibility.speakReminders) speak(oc.spokenConfirmed(med.name));
      nav.goBack();
    }
  };

  const readAloud = () => speak(oc.spokenDetails(med.name, describeDose(med.doseAmount, med.doseUnit), routeLabel(med.route), formatClock(planned), med.instructions));

  return (
    <Screen title={med.name}>
      <Card tone={isTaken ? 'success' : 'alt'}>
        <AppText variant="heading">{oc.dateAt(formatDate(planned), formatClock(planned))}</AppText>
        <AppText>{describeDose(med.doseAmount, med.doseUnit)}{med.presentation ? ` · ${med.presentation}` : ''} · {routeLabel(med.route)}</AppText>
        {med.instructions ? <AppText>{oc.instructions(med.instructions)}</AppText> : null}
        <AppText bold>{oc.status(occurrenceStatusLabel(occ.status))}{occ.takenAt ? oc.atTime(formatClock(new Date(occ.takenAt))) : ''}{occ.status === 'snoozed' && occ.snoozedUntil ? oc.untilTime(formatClock(new Date(occ.snoozedUntil))) : ''}</AppText>
        <BigButton kind="secondary" compact icon="🔊" label={s.common.readAloud} onPress={readAloud} />
      </Card>
      {msg ? <Banner tone="info">{msg}</Banner> : null}
      {isTaken ? (
        <Banner tone="success" title={oc.alreadyTitle}>{oc.alreadyBody}</Banner>
      ) : (
        <View style={{ gap: 8 }}>
          <BigButton label={oc.taken} icon="✓" onPress={() => void doTaken()} />
          <BigButton kind="secondary" label={oc.snooze(settings?.snoozeMinutes ?? 15)} icon="⏰" hint={oc.snoozeHint} onPress={() => void snooze(occ.id, settings?.snoozeMinutes ?? 15).then(() => nav.goBack())} />
          <BigButton kind="secondary" label={oc.notTaken} onPress={() => void notTaken(occ.id).then(() => nav.goBack())} />
          <AppText muted variant="small">{oc.noCompensation}</AppText>
        </View>
      )}
      {correcting ? (
        <Card>
          <AppText variant="heading">{oc.correctTitle}</AppText>
          <AppText muted variant="small">{oc.correctNote}</AppText>
          <TextField label={oc.reason} value={note} onChangeText={setNote} placeholder={oc.reasonPlaceholder} />
          <TimeField label={oc.takenTime} hint={oc.takenTimeHint} value={takenTime ?? formatTimeBR(occ.takenAt ? new Date(occ.takenAt) : planned)} onChange={setTakenTime} />
          <BigButton compact label={oc.markTaken} onPress={() => void correct(occ.id, 'taken', note || s.occurrenceReason.correction, atLocalTime(planned, takenTime ?? formatTimeBR(occ.takenAt ? new Date(occ.takenAt) : planned)).toISOString()).then(() => nav.goBack())} />
          <BigButton compact kind="secondary" label={oc.markNotTaken} onPress={() => void correct(occ.id, 'not_taken', note || s.occurrenceReason.correction).then(() => nav.goBack())} />
          <BigButton compact kind="secondary" label={oc.backToScheduled} onPress={() => void correct(occ.id, 'scheduled', note || s.occurrenceReason.correction).then(() => nav.goBack())} />
        </Card>
      ) : (
        <BigButton kind="ghost" compact label={oc.correct} onPress={() => setCorrecting(true)} />
      )}
      <Card>
        <AppText variant="label" bold>{oc.historyTitle}</AppText>
        {occ.history.map((h, i) => (
          <AppText key={i} variant="small" muted>{formatDate(new Date(h.at))} {formatClock(new Date(h.at))} — {occurrenceStatusLabel(h.to)} ({h.reason})</AppText>
        ))}
      </Card>
      <BigButton kind="ghost" compact label={s.common.back} onPress={() => nav.goBack()} />
    </Screen>
  );
}
