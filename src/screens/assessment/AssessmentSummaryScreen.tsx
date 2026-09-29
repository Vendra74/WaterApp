import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { evaluateIndividualPlan } from '@/domain/safety/plan';
import { defaultHydrationSettings } from '@/domain/hydration/schedule';
import { requestPermission } from '@/services/notifications/notificationService';
import { useTheme } from '@/ui/theme';
import { STEPS } from './steps';
import type { Profile } from '@/domain/types';

const tri = (v: string) => (v === 'yes' ? 'Sim' : v === 'no' ? 'Não' : 'Não sei');

export function AssessmentSummaryScreen() {
  const nav = useNavigation();
  const t = useTheme();
  const profile = useAppStore((s) => s.profile)!;
  const settings = useAppStore((s) => s.settings);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Profile>(profile);
  const [busy, setBusy] = useState(false);
  const plan = evaluateIndividualPlan({ ...draft, assessmentCompleted: true });

  const rows: { key: string; label: string; value: string }[] = [
    { key: 'name', label: 'Nome', value: `${draft.name} (${draft.preferredName || draft.name})` },
    { key: 'age', label: 'Idade', value: draft.age === null ? 'Não informada' : `${draft.age} anos` },
    { key: 'sleep', label: 'Acordar / dormir', value: `${draft.wakeTime} / ${draft.sleepTime}` },
    { key: 'naps', label: 'Cochilos', value: draft.naps.length ? draft.naps.map((n) => `${n.start}–${n.end}`).join(', ') : 'Nenhum' },
    { key: 'meals', label: 'Refeições', value: draft.meals.map((m) => `${m.label} ${m.time}`).join(', ') },
    { key: 'containers', label: 'Recipientes', value: draft.containers.map((c) => `${c.label} ${c.volumeMl} ml`).join(', ') },
    { key: 'fruits', label: 'Frutas', value: draft.fruitPreferences.join(', ') || 'Nenhuma' },
    { key: 'allergies', label: 'Alergias / restrições', value: [...draft.allergies, ...draft.dietaryRestrictions].join(', ') || 'Nenhuma' },
    { key: 'restriction', label: 'Orientação profissional de líquidos', value: tri(draft.fluidRestriction) + (draft.professionalGoalMl ? ` — ${draft.professionalGoalMl} ml/dia` : '') },
    { key: 'swallow', label: 'Dificuldade para engolir', value: tri(draft.swallowingDifficulty) },
    { key: 'help_needs', label: 'Precisa de ajuda', value: `Beber: ${tri(draft.needsHelpToDrink)} · Banheiro: ${tri(draft.needsHelpToBathroom)}` },
    { key: 'extras', label: 'Medicamentos / cuidador', value: `${draft.wantsMedications ? 'Sim' : 'Não'} / ${draft.wantsCaregiver ? 'Sim' : 'Não'}` },
  ];

  const editingStep = STEPS.find((s) => s.key === editingKey);

  const confirm = async () => {
    setBusy(true);
    try {
      const saved: Profile = { ...draft, assessmentCompleted: true, assessmentStep: 0, lastHealthReviewPromptAt: new Date().toISOString() };
      await updateProfile(saved);
      const base = settings ?? defaultHydrationSettings(saved);
      await updateSettings({ ...base, enabled: true, windowStart: saved.wakeTime, windowEnd: saved.sleepTime });
      await requestPermission();
      nav.reset({ index: 0, routes: [{ name: 'Main' }] });
    } finally {
      setBusy(false);
    }
  };

  if (editingStep) {
    return (
      <Screen title={editingStep.title} footer={<BigButton label="Salvar alteração" onPress={() => setEditingKey(null)} />}>
        {editingStep.help ? <AppText muted>{editingStep.help}</AppText> : null}
        {editingStep.render({ draft, update: (patch) => setDraft((d) => ({ ...d, ...patch })) })}
      </Screen>
    );
  }

  return (
    <Screen
      title="Confira suas respostas"
      footer={
        <View style={{ gap: 8 }}>
          <BigButton label="Confirmar e ativar lembretes" icon="✓" onPress={() => void confirm()} disabled={busy} />
          <BigButton kind="ghost" compact label="Voltar" onPress={() => nav.goBack()} />
        </View>
      }
    >
      <AppText muted>Toque em uma linha para corrigir.</AppText>
      <Card>
        {rows.map((r) => (
          <Pressable
            key={r.key}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}: ${r.value}. Toque para editar.`}
            onPress={() => setEditingKey(r.key)}
            style={{ minHeight: 56, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: t.colors.border, paddingVertical: 8 }}
          >
            <AppText variant="small" muted>{r.label}</AppText>
            <AppText>{r.value}</AppText>
          </Pressable>
        ))}
      </Card>
      <Banner tone={plan.mode === 'restricted_no_suggestions' ? 'warning' : 'info'} title="Seu plano">
        {plan.guidance}
      </Banner>
      <AppText muted variant="small">Ao confirmar, pediremos permissão para enviar notificações. Você pode ajustar horários em Lembretes.</AppText>
    </Screen>
  );
}
