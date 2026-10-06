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
import { isValidHHmm, WEEKDAY_LABELS_PT } from '@/domain/time/time';
import { applyPrescriptionDraft, describePrescriptionDraft } from '@/domain/medication/prescriptionDraft';
import { CONSENT_TEXT_AI, hasAiConsent, isPrescriptionReadingAvailable, readPrescriptionPhoto, setAiConsent } from '@/services/ai/prescriptionReader';

function blank(): Medication {
  const now = new Date().toISOString();
  return {
    id: newId('m-'), name: '', presentation: '', doseAmount: '1', doseUnit: 'comprimido', route: 'oral', scheduleType: 'fixed_times', times: ['08:00'],
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
  const canRead = isPrescriptionReadingAvailable();
  useEffect(() => {
    if (canRead) void hasAiConsent().then(setConsent);
  }, [canRead]);
  const set = (patch: Partial<Medication>) => setM((x) => ({ ...x, ...patch }));

  /** Pede a autorização uma vez; fica guardada até a pessoa retirar em Meus dados. */
  const ensureConsent = () =>
    new Promise<boolean>((resolve) => {
      if (consent) return resolve(true);
      Alert.alert('Enviar a foto para leitura?', CONSENT_TEXT_AI, [
        { text: 'Agora não', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Autorizo', onPress: () => void setAiConsent(true).then(() => { setConsent(true); resolve(true); }) },
      ]);
    });

  /** Lê a receita ou a caixa pela foto e preenche o formulário como rascunho. */
  const fillFromPhoto = async (camera: boolean) => {
    if (!(await ensureConsent())) return;
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Sem permissão', 'Não foi possível acessar a câmera ou as fotos.');
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
      Alert.alert('Sem permissão', 'Não foi possível acessar a câmera ou as fotos.');
      return;
    }
    const r = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!r.canceled && r.assets[0]) set({ photoUri: r.assets[0].uri });
  };

  const save = async () => {
    if (m.name.trim().length < 2) return setError('Informe o nome do medicamento.');
    if (m.scheduleType === 'fixed_times') {
      if (m.times.length === 0 || m.times.some((t) => !isValidHHmm(t))) return setError('Informe pelo menos um horário válido.');
    } else if (!m.intervalHours || m.intervalHours <= 0 || m.intervalHours > 24 || !m.intervalAnchor) {
      return setError('Informe o intervalo em horas (1 a 24) e o primeiro horário do dia.');
    }
    if (m.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(m.startDate)) return setError('Data de início inválida (use AAAA-MM-DD).');
    if (m.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(m.endDate)) return setError('Data de término inválida (use AAAA-MM-DD).');
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
      title={existing ? 'Editar medicamento' : 'Cadastrar medicamento'}
      footer={
        <View style={{ gap: 8 }}>
          <BigButton label="Salvar e ativar lembretes" icon="✓" onPress={() => void save()} disabled={busy} />
          <BigButton kind="ghost" compact label="Cancelar" onPress={() => nav.goBack()} />
        </View>
      }
    >
      {canRead ? (
        <Card tone="alt">
          <AppText variant="heading">Preencher pela foto</AppText>
          <AppText>Tire uma foto da receita ou da caixa. O cadastro é preenchido como rascunho e você confere cada campo antes de salvar.</AppText>
          {reading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLiveRegion="polite">
              <ActivityIndicator color={t.colors.primary} />
              <AppText bold>Lendo a foto…</AppText>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BigButton kind="secondary" compact style={{ flex: 1 }} icon="📷" label="Tirar foto" onPress={() => void fillFromPhoto(true)} />
              <BigButton kind="secondary" compact style={{ flex: 1 }} label="Escolher foto" onPress={() => void fillFromPhoto(false)} />
            </View>
          )}
          <AppText muted variant="small">A foto é enviada para leitura e não fica guardada. Autorização em Mais → Meus dados.</AppText>
        </Card>
      ) : (
        <Banner tone="info">Copie da receita. A foto é apenas um apoio visual: nada é lido automaticamente da imagem.</Banner>
      )}
      {readResult ? (
        <Banner tone="success" title="Preenchido pela foto. Confira cada campo antes de salvar.">
          {readResult.filled.length ? `Lido: ${readResult.filled.join(', ')}. ` : ''}
          {readResult.missing.length ? `Não encontrado na foto: ${readResult.missing.join(', ')}. ` : ''}
          {readResult.notes}
        </Banner>
      ) : null}
      {error ? <Banner tone="warning">{error}</Banner> : null}
      <TextField label="Nome" value={m.name} onChangeText={(v) => set({ name: v })} autoCapitalize="words" />
      <TextField label="Apresentação ou concentração" hint="Ex.: comprimido 50 mg, xarope 5 mg/ml" value={m.presentation} onChangeText={(v) => set({ presentation: v })} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><TextField label="Dose" value={m.doseAmount} onChangeText={(v) => set({ doseAmount: v })} /></View>
        <View style={{ flex: 2 }}><TextField label="Unidade" hint="comprimido, ml, gotas…" value={m.doseUnit} onChangeText={(v) => set({ doseUnit: v })} /></View>
      </View>
      <ChoiceGroup
        label="Via de administração"
        options={[{ value: 'oral', label: 'Oral (boca)' }, { value: 'tópica', label: 'Na pele' }, { value: 'ocular', label: 'Nos olhos' }, { value: 'inalatória', label: 'Inalação' }, { value: 'injetável', label: 'Injeção' }, { value: 'outra', label: 'Outra' }]}
        value={m.route}
        onChange={(v) => set({ route: String(v) })}
      />
      <ChoiceGroup
        label="Como são os horários?"
        options={[{ value: 'fixed_times', label: 'Horários fixos (ex.: 8h e 20h)' }, { value: 'interval_hours', label: 'A cada X horas (ex.: de 8 em 8 horas)' }]}
        value={m.scheduleType}
        onChange={(v) => set({ scheduleType: v as Medication['scheduleType'], intervalAnchor: v === 'interval_hours' ? m.intervalAnchor ?? '08:00' : null, intervalHours: v === 'interval_hours' ? m.intervalHours ?? 8 : null })}
      />
      {m.scheduleType === 'fixed_times' ? (
        <View style={{ gap: 12 }}>
          {m.times.map((tm, i) => (
            <View key={i} style={{ gap: 8 }}>
              <TimeField label={`Horário ${i + 1}`} value={tm} onChange={(v) => set({ times: m.times.map((x, j) => (j === i ? v : x)) })} />
              {m.times.length > 1 ? <BigButton kind="ghost" compact label="Remover este horário" onPress={() => set({ times: m.times.filter((_, j) => j !== i) })} /> : null}
            </View>
          ))}
          <BigButton kind="secondary" compact label="+ Adicionar horário" onPress={() => set({ times: [...m.times, '20:00'] })} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <TextField label="A cada quantas horas?" keyboardType="number-pad" value={m.intervalHours ? String(m.intervalHours) : ''} onChangeText={(v) => set({ intervalHours: v ? Number(v.replace(/\D/g, '')) : null })} />
          <TimeField label="Primeiro horário do dia" value={m.intervalAnchor ?? '08:00'} onChange={(v) => set({ intervalAnchor: v })} />
        </View>
      )}
      <ChoiceGroup
        label="Dias de uso"
        hint="Nenhum selecionado = todos os dias."
        multi
        options={([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => ({ value: String(d), label: WEEKDAY_LABELS_PT[d] }))}
        value={m.weekdays.map(String)}
        onChange={(v) => set({ weekdays: (v as string[]).map(Number).sort() as Weekday[] })}
      />
      <TextField label="Data de início (opcional)" hint="AAAA-MM-DD" value={m.startDate ?? ''} onChangeText={(v) => set({ startDate: v.trim() || null })} />
      <TextField label="Data de término (opcional)" hint="AAAA-MM-DD" value={m.endDate ?? ''} onChangeText={(v) => set({ endDate: v.trim() || null })} />
      <TextField label="Instruções do profissional" hint="Ex.: tomar com alimento; em jejum; evitar leite." value={m.instructions} onChangeText={(v) => set({ instructions: v })} multiline />
      <View style={{ gap: 8 }}>
        <AppText variant="label" bold>Foto da embalagem ou receita (opcional)</AppText>
        {m.photoUri ? <Image source={{ uri: m.photoUri }} accessibilityLabel="Foto anexada" style={{ width: '100%', height: 200, borderRadius: 12 }} resizeMode="cover" /> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BigButton kind="secondary" compact style={{ flex: 1 }} label="Tirar foto" onPress={() => void pickPhoto(true)} />
          <BigButton kind="secondary" compact style={{ flex: 1 }} label="Escolher foto" onPress={() => void pickPhoto(false)} />
        </View>
        {m.photoUri ? <BigButton kind="ghost" compact label="Remover foto" onPress={() => set({ photoUri: null })} /> : null}
      </View>
      <Toggle label="Lembretes ativos" hint="Desligue para pausar sem apagar o cadastro." value={m.active} onChange={(v) => set({ active: v })} />
      {error ? <Banner tone="warning">{error}</Banner> : null}
    </Screen>
  );
}
