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
import { settingsAfterAssessment } from '@/domain/hydration/schedule';
import { requestPermission } from '@/services/notifications/notificationService';
import { useTheme } from '@/ui/theme';
import { allSteps } from './steps';
import type { Profile } from '@/domain/types';
import { env } from '@/config/env';
import { strings } from '@/i18n';
import { formatHHmm, formatRange } from '@/i18n/format';

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
  const s = strings();
  const sm = s.summary;
  const tri = (v: string) => (v === 'yes' ? s.common.yes : v === 'no' ? s.common.no : s.common.dontKnow);

  const rows: { key: string; label: string; value: string }[] = [
    { key: 'name', label: sm.name, value: `${draft.name} (${draft.preferredName || draft.name})` },
    { key: 'age', label: sm.age, value: draft.age === null ? s.common.notInformed : sm.years(draft.age) },
    { key: 'sleep', label: sm.sleep, value: `${formatHHmm(draft.wakeTime)} / ${formatHHmm(draft.sleepTime)}` },
    { key: 'naps', label: sm.naps, value: draft.naps.length ? draft.naps.map((n) => formatRange(n.start, n.end)).join(', ') : s.common.none },
    { key: 'meals', label: sm.meals, value: draft.meals.map((m) => `${m.label} ${formatHHmm(m.time)}`).join(', ') },
    { key: 'containers', label: sm.containers, value: draft.containers.map((c) => `${c.label} ${c.volumeMl} ml`).join(', ') },
    { key: 'fruits', label: sm.fruits, value: draft.fruitPreferences.join(', ') || s.common.noneF },
    { key: 'allergies', label: sm.allergies, value: [...draft.allergies, ...draft.dietaryRestrictions].join(', ') || s.common.noneF },
    { key: 'restriction', label: sm.restriction, value: tri(draft.fluidRestriction) },
    // A quantidade só vale (e só é editável) quando houve orientação; antes ela não aparecia no resumo.
    ...(draft.fluidRestriction === 'yes'
      ? [{ key: 'goal', label: sm.goal, value: draft.professionalGoalMl ? sm.goalValue(draft.professionalGoalMl) : s.common.notInformed }]
      : []),
    { key: 'swallow', label: sm.swallow, value: tri(draft.swallowingDifficulty) },
    { key: 'help_needs', label: sm.helpNeeds, value: sm.helpNeedsValue(tri(draft.needsHelpToDrink), tri(draft.needsHelpToBathroom)) },
    env.caregiverEnabled
      ? { key: 'extras', label: sm.extrasCaregiver, value: `${draft.wantsMedications ? s.common.yes : s.common.no} / ${draft.wantsCaregiver ? s.common.yes : s.common.no}` }
      : { key: 'extras', label: sm.extras, value: draft.wantsMedications ? s.common.yes : s.common.no },
  ];

  const editingStep = allSteps().find((st) => st.key === editingKey);

  const confirm = async () => {
    setBusy(true);
    try {
      const saved: Profile = { ...draft, assessmentCompleted: true, assessmentStep: 0, lastHealthReviewPromptAt: new Date().toISOString() };
      await updateProfile(saved);
      await updateSettings(settingsAfterAssessment(settings, saved));
      await requestPermission();
      nav.reset({ index: 0, routes: [{ name: 'Main' }] });
    } finally {
      setBusy(false);
    }
  };

  if (editingStep) {
    return (
      <Screen title={editingStep.title} footer={<BigButton label={sm.saveChange} onPress={() => setEditingKey(null)} />}>
        {editingStep.help ? <AppText muted>{editingStep.help}</AppText> : null}
        {editingStep.render({ draft, update: (patch) => setDraft((d) => ({ ...d, ...patch })) })}
      </Screen>
    );
  }

  return (
    <Screen
      title={sm.title}
      footer={
        <View style={{ gap: 8 }}>
          <BigButton label={sm.confirm} icon="✓" onPress={() => void confirm()} disabled={busy} />
          <BigButton kind="ghost" compact label={s.common.back} onPress={() => nav.goBack()} />
        </View>
      }
    >
      <AppText muted>{sm.tapToFix}</AppText>
      <Card>
        {rows.map((r) => (
          <Pressable
            key={r.key}
            accessibilityRole="button"
            accessibilityLabel={sm.tapToEdit(r.label, r.value)}
            onPress={() => setEditingKey(r.key)}
            style={{ minHeight: 56, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: t.colors.border, paddingVertical: 8 }}
          >
            <AppText variant="small" muted>{r.label}</AppText>
            <AppText>{r.value}</AppText>
          </Pressable>
        ))}
      </Card>
      <Banner tone={plan.mode === 'restricted_no_suggestions' ? 'warning' : 'info'} title={sm.yourPlan}>
        {plan.guidance}
      </Banner>
      <AppText muted variant="small">{sm.permissionNote}</AppText>
    </Screen>
  );
}
