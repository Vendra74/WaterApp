import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import type { RootStackParamList } from '@/core/navigation';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Banner, ChoiceGroup, TextField, TimeField, Toggle } from '@/ui/components/Fields';
import { Card } from '@/ui/components/Card';
import { useTheme } from '@/ui/theme';
import { useAppStore } from '@/state/appStore';
import type { Medication, Weekday } from '@/domain/types';
import { newId } from '@/domain/ids';
import { isValidHHmm } from '@/domain/time/time';
import { applyPrescriptionDraft, describePrescriptionDraft } from '@/domain/medication/prescriptionDraft';
import { consentTextAi, hasAiConsent, isPrescriptionReadingAvailable, readPrescriptionPhoto, setAiConsent } from '@/services/ai/prescriptionReader';
import { strings } from '@/i18n';
import { weekdayShort } from '@/i18n/format';

function blank(): Medication {
  const now = new Date().toISOString();
  return {
    id: newId('m-'), name: '', presentation: '', doseAmount: '1', doseUnit: strings().medicationForm.defaultDoseUnit, route: 'oral', scheduleType: 'fixed_times', times: ['08:00'],
    intervalHours: null, intervalAnchor: null, weekdays: [], startDate: null, endDate: null, instructions: '', photoUri: null, active: true, createdAt: now, updatedAt: now,
  };
}

export function MedicationFormScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'MedicationForm'>>();
  const { medications, upsertMedication } = useAppStore();
  const existing = medications.find((m) => m.id === route.params?.id);
  const [m, setM] = useState<Medication>(existing ?? blank());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [readResult, setReadResult] = useState<{ filled: string[]; missing: string[]; notes: string } | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const t = useTheme();
  const s = strings();
  const f = s.medicationForm;
  const canRead = isPrescriptionReadingAvailable();
  useEffect(() => {
    if (canRead) void hasAiConsent().then(setConsent);
  }, [canRead]);
  const set = (patch: Partial<Medication>) => setM((x) => ({ ...x, ...patch }));

  /** Pede a autorização uma vez; fica guardada até a pessoa retirar em Meus dados. */
  const ensureConsent = () =>
    new Promise<boolean>((resolve) => {
      if (consent) return resolve(true);
      Alert.alert(f.consentTitle, consentTextAi(), [
        { text: f.consentLater, style: 'cancel', onPress: () => resolve(false) },
        { text: f.consentAccept, onPress: () => void setAiConsent(true).then(() => { setConsent(true); resolve(true); }) },
      ]);
    });

  /** Lê a receita ou a caixa pela foto e preenche o formulário como rascunho. */
  const fillFromPhoto = async (camera: boolean) => {
    if (!(await ensureConsent())) return;
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(f.noPermissionTitle, f.noPermissionBody);
      return;
    }
    const opts = { mediaTypes: ['images' as const], quality: 0.5, base64: true };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = !r.canceled ? r.assets[0] : undefined;
    if (!asset?.base64) return;
    setReading(true);
    setReadResult(null);
    setError(null);
    try {
      const result = await readPrescriptionPhoto(asset.base64, asset.mimeType ?? 'image/jpeg');
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setM((x) => applyPrescriptionDraft({ ...x, photoUri: asset.uri }, result.draft));
      setReadResult({ ...describePrescriptionDraft(result.draft), notes: result.draft.notes });
    } finally {
      setReading(false);
    }
  };

  const pickPhoto = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(f.noPermissionTitle, f.noPermissionBody);
      return;
    }
    const r = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!r.canceled && r.assets[0]) set({ photoUri: r.assets[0].uri });
  };

  const save = async () => {
    if (m.name.trim().length < 2) return setError(f.errName);
    if (m.scheduleType === 'fixed_times') {
      if (m.times.length === 0 || m.times.some((tm) => !isValidHHmm(tm))) return setError(f.errTimes);
    } else if (!m.intervalHours || m.intervalHours <= 0 || m.intervalHours > 24 || !m.intervalAnchor) {
      return setError(f.errInterval);
    }
    if (m.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(m.startDate)) return setError(f.errStartDate);
    if (m.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(m.endDate)) return setError(f.errEndDate);
    setBusy(true);
    try {
      await upsertMedication({ ...m, name: m.name.trim() });
      nav.goBack();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={existing ? f.titleEdit : f.titleNew}
      footer={
        <View style={{ gap: 8 }}>
          <BigButton label={f.saveAndActivate} icon="✓" onPress={() => void save()} disabled={busy} />
          <BigButton kind="ghost" compact label={s.common.cancel} onPress={() => nav.goBack()} />
        </View>
      }
    >
      {canRead ? (
        <Card tone="alt">
          <AppText variant="heading">{f.fillFromPhoto}</AppText>
          <AppText>{f.fillFromPhotoBody}</AppText>
          {reading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLiveRegion="polite">
              <ActivityIndicator color={t.colors.primary} />
              <AppText bold>{f.reading}</AppText>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BigButton kind="secondary" compact style={{ flex: 1 }} icon="📷" label={f.takePhoto} onPress={() => void fillFromPhoto(true)} />
              <BigButton kind="secondary" compact style={{ flex: 1 }} label={f.choosePhoto} onPress={() => void fillFromPhoto(false)} />
            </View>
          )}
          <AppText muted variant="small">{f.photoNotStored}</AppText>
        </Card>
      ) : (
        <Banner tone="info">{f.photoVisualOnly}</Banner>
      )}
      {readResult ? (
        <Banner tone="success" title={f.filledTitle}>
          {readResult.filled.length ? f.filledRead(readResult.filled.join(', ')) : ''}
          {readResult.missing.length ? f.filledMissing(readResult.missing.join(', ')) : ''}
          {readResult.notes}
        </Banner>
      ) : null}
      {error ? <Banner tone="warning">{error}</Banner> : null}
      <TextField label={f.name} value={m.name} onChangeText={(v) => set({ name: v })} autoCapitalize="words" />
      <TextField label={f.presentation} hint={f.presentationHint} value={m.presentation} onChangeText={(v) => set({ presentation: v })} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><TextField label={f.dose} value={m.doseAmount} onChangeText={(v) => set({ doseAmount: v })} /></View>
        <View style={{ flex: 2 }}><TextField label={f.unit} hint={f.unitHint} value={m.doseUnit} onChangeText={(v) => set({ doseUnit: v })} /></View>
      </View>
      <ChoiceGroup
        label={f.route}
        options={[{ value: 'oral', label: f.routeOral }, { value: 'tópica', label: f.routeTopical }, { value: 'ocular', label: f.routeOcular }, { value: 'inalatória', label: f.routeInhaled }, { value: 'injetável', label: f.routeInjection }, { value: 'outra', label: f.routeOther }]}
        value={m.route}
        onChange={(v) => set({ route: String(v) })}
      />
      <ChoiceGroup
        label={f.scheduleType}
        options={[{ value: 'fixed_times', label: f.fixedTimes }, { value: 'interval_hours', label: f.intervalHours }]}
        value={m.scheduleType}
        onChange={(v) => set({ scheduleType: v as Medication['scheduleType'], intervalAnchor: v === 'interval_hours' ? m.intervalAnchor ?? '08:00' : null, intervalHours: v === 'interval_hours' ? m.intervalHours ?? 8 : null })}
      />
      {m.scheduleType === 'fixed_times' ? (
        <View style={{ gap: 12 }}>
          {m.times.map((tm, i) => (
            <View key={i} style={{ gap: 8 }}>
              <TimeField label={f.timeN(i + 1)} value={tm} onChange={(v) => set({ times: m.times.map((x, j) => (j === i ? v : x)) })} />
              {m.times.length > 1 ? <BigButton kind="ghost" compact label={f.removeTime} onPress={() => set({ times: m.times.filter((_, j) => j !== i) })} /> : null}
            </View>
          ))}
          <BigButton kind="secondary" compact label={f.addTime} onPress={() => set({ times: [...m.times, '20:00'] })} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <TextField label={f.everyHowManyHours} keyboardType="number-pad" value={m.intervalHours ? String(m.intervalHours) : ''} onChangeText={(v) => set({ intervalHours: v ? Number(v.replace(/\D/g, '')) : null })} />
          <TimeField label={f.firstTimeOfDay} value={m.intervalAnchor ?? '08:00'} onChange={(v) => set({ intervalAnchor: v })} />
        </View>
      )}
      <ChoiceGroup
        label={f.weekdays}
        hint={f.weekdaysHint}
        multi
        options={([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => ({ value: String(d), label: weekdayShort(d) }))}
        value={m.weekdays.map(String)}
        onChange={(v) => set({ weekdays: (v as string[]).map(Number).sort() as Weekday[] })}
      />
      <TextField label={f.startDate} hint={f.dateHint} value={m.startDate ?? ''} onChangeText={(v) => set({ startDate: v.trim() || null })} />
      <TextField label={f.endDate} hint={f.dateHint} value={m.endDate ?? ''} onChangeText={(v) => set({ endDate: v.trim() || null })} />
      <TextField label={f.instructions} hint={f.instructionsHint} value={m.instructions} onChangeText={(v) => set({ instructions: v })} multiline />
      <View style={{ gap: 8 }}>
        <AppText variant="label" bold>{f.photoLabel}</AppText>
        {m.photoUri ? <Image source={{ uri: m.photoUri }} accessibilityLabel={f.photoAttached} style={{ width: '100%', height: 200, borderRadius: 12 }} resizeMode="cover" /> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BigButton kind="secondary" compact style={{ flex: 1 }} label={f.takePhoto} onPress={() => void pickPhoto(true)} />
          <BigButton kind="secondary" compact style={{ flex: 1 }} label={f.choosePhoto} onPress={() => void pickPhoto(false)} />
        </View>
        {m.photoUri ? <BigButton kind="ghost" compact label={f.removePhoto} onPress={() => set({ photoUri: null })} /> : null}
      </View>
      <Toggle label={f.active} hint={f.activeHint} value={m.active} onChange={(v) => set({ active: v })} />
      {error ? <Banner tone="warning">{error}</Banner> : null}
    </Screen>
  );
}
