import React from 'react';
import { View } from 'react-native';
import type { Profile, TriState } from '@/domain/types';
import { ChoiceGroup, Stepper, TagInput, TextField, TimeField, Toggle } from '@/ui/components/Fields';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { useTheme } from '@/ui/theme';
import { newId } from '@/domain/ids';
import { env } from '@/config/env';
import { strings } from '@/i18n';

export interface StepProps {
  draft: Profile;
  update: (patch: Partial<Profile>) => void;
}

export interface Step {
  key: string;
  title: string;
  help?: string;
  /** Se retornar string, bloqueia avançar com a mensagem. */
  validate?: (d: Profile) => string | null;
  render: (p: StepProps) => React.ReactNode;
  /** Pergunta condicional. */
  when?: (d: Profile) => boolean;
}

const NapsEditor = ({ draft, update }: StepProps) => {
  const t = useTheme();
  const s = strings();
  return (
    <View style={{ gap: t.space(2) }}>
      {draft.naps.map((nap, i) => (
        <View key={i} style={{ gap: t.space(1), borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius, padding: t.space(1.5) }}>
          <TimeField label={s.assessment.napStart(i + 1)} value={nap.start} onChange={(v) => update({ naps: draft.naps.map((n, j) => (j === i ? { ...n, start: v } : n)) })} />
          <TimeField label={s.assessment.napEnd(i + 1)} value={nap.end} onChange={(v) => update({ naps: draft.naps.map((n, j) => (j === i ? { ...n, end: v } : n)) })} />
          <BigButton kind="ghost" compact label={s.assessment.removeNap} onPress={() => update({ naps: draft.naps.filter((_, j) => j !== i) })} />
        </View>
      ))}
      <BigButton kind="secondary" compact label={s.assessment.addNap} onPress={() => update({ naps: [...draft.naps, { start: '13:00', end: '14:00' }] })} />
      {draft.naps.length === 0 ? <AppText muted>{s.assessment.noNapHint}</AppText> : null}
    </View>
  );
};

const MealsEditor = ({ draft, update }: StepProps) => {
  const t = useTheme();
  const s = strings();
  return (
    <View style={{ gap: t.space(2) }}>
      {draft.meals.map((meal, i) => (
        <View key={i} style={{ gap: t.space(1), borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius, padding: t.space(1.5) }}>
          <TextField label={s.assessment.meal} value={meal.label} onChangeText={(v) => update({ meals: draft.meals.map((m, j) => (j === i ? { ...m, label: v } : m)) })} />
          <TimeField label={s.assessment.time} value={meal.time} onChange={(v) => update({ meals: draft.meals.map((m, j) => (j === i ? { ...m, time: v } : m)) })} />
          <BigButton kind="ghost" compact label={s.common.remove} onPress={() => update({ meals: draft.meals.filter((_, j) => j !== i) })} />
        </View>
      ))}
      <BigButton kind="secondary" compact label={s.assessment.addMeal} onPress={() => update({ meals: [...draft.meals, { label: s.assessment.newMealLabel, time: '16:00' }] })} />
    </View>
  );
};

const ContainersEditor = ({ draft, update }: StepProps) => {
  const t = useTheme();
  const s = strings();
  return (
    <View style={{ gap: t.space(2) }}>
      {draft.containers.map((c, i) => (
        <View key={c.id} style={{ gap: t.space(1), borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius, padding: t.space(1.5) }}>
          <TextField label={s.assessment.containerName} value={c.label} onChangeText={(v) => update({ containers: draft.containers.map((x, j) => (j === i ? { ...x, label: v } : x)) })} />
          <Stepper label={s.assessment.containerVolume} value={c.volumeMl} step={50} min={50} max={2000} onChange={(v) => update({ containers: draft.containers.map((x, j) => (j === i ? { ...x, volumeMl: v } : x)) })} />
          <BigButton kind="ghost" compact label={s.common.remove} onPress={() => update({ containers: draft.containers.filter((_, j) => j !== i) })} />
        </View>
      ))}
      <BigButton kind="secondary" compact label={s.assessment.addContainer} onPress={() => update({ containers: [...draft.containers, { id: newId('c-'), label: s.assessment.newContainerLabel, volumeMl: 200 }] })} />
    </View>
  );
};

/**
 * Perguntas da avaliação inicial, no idioma atual. É uma função (e não uma constante) porque os
 * títulos vêm do dicionário, definido na abertura do app.
 */
export function allSteps(): Step[] {
  const s = strings();
  const a = s.assessment;
  const TRI: { value: TriState; label: string }[] = [
    { value: 'yes', label: s.common.yes },
    { value: 'no', label: s.common.no },
    { value: 'unknown', label: s.common.dontKnow },
  ];
  return [
    {
      key: 'help',
      title: a.whoTitle,
      help: a.whoHelp,
      render: ({ draft, update }) => (
        <ChoiceGroup
          options={[
            { value: 'self', label: a.whoSelf },
            { value: 'helped', label: a.whoHelped },
          ]}
          value={draft.filledWithHelp ? 'helped' : 'self'}
          onChange={(v) => update({ filledWithHelp: v === 'helped' })}
        />
      ),
    },
    {
      key: 'name',
      title: a.nameTitle,
      validate: (d) => (d.name.trim().length < 2 ? a.nameRequired : null),
      render: ({ draft, update }) => (
        <View style={{ gap: 16 }}>
          <TextField label={a.name} value={draft.name} onChangeText={(v) => update({ name: v })} autoCapitalize="words" />
          <TextField label={a.preferredName} hint={a.preferredNameHint} value={draft.preferredName} onChangeText={(v) => update({ preferredName: v })} autoCapitalize="words" />
        </View>
      ),
    },
    {
      key: 'age',
      title: a.ageTitle,
      help: a.ageHelp,
      render: ({ draft, update }) => (
        <TextField label={a.age} keyboardType="number-pad" value={draft.age === null ? '' : String(draft.age)} onChangeText={(v) => update({ age: v.trim() === '' ? null : Number(v.replace(/\D/g, '')) })} />
      ),
    },
    {
      key: 'sleep',
      title: a.sleepTitle,
      help: a.sleepHelp,
      render: ({ draft, update }) => (
        <View style={{ gap: 16 }}>
          <TimeField label={a.wake} value={draft.wakeTime} onChange={(v) => update({ wakeTime: v })} />
          <TimeField label={a.sleep} value={draft.sleepTime} onChange={(v) => update({ sleepTime: v })} />
        </View>
      ),
    },
    { key: 'naps', title: a.napsTitle, help: a.napsHelp, render: (p) => <NapsEditor {...p} /> },
    { key: 'meals', title: a.mealsTitle, help: a.mealsHelp, render: (p) => <MealsEditor {...p} /> },
    {
      key: 'activities',
      title: a.activitiesTitle,
      render: ({ draft, update }) => (
        <ChoiceGroup
          multi
          options={[
            { value: 'caminhada', label: a.activityWalk },
            { value: 'exercicio', label: a.activityExercise },
            { value: 'casa', label: a.activityHome },
            { value: 'jardim', label: a.activityGarden },
            { value: 'trabalho', label: a.activityWork },
            { value: 'descanso', label: a.activityRest },
          ]}
          value={draft.activities}
          onChange={(v) => update({ activities: v as string[] })}
        />
      ),
    },
    {
      key: 'heat',
      title: a.heatTitle,
      help: a.heatHelp,
      render: ({ draft, update }) => <ChoiceGroup options={TRI} value={draft.heatExposure} onChange={(v) => update({ heatExposure: v as TriState })} />,
    },
    {
      key: 'drinks',
      title: a.drinksTitle,
      help: a.drinksHelp,
      render: ({ draft, update }) => <TagInput label={a.drinks} values={draft.drinkPreferences} onChange={(v) => update({ drinkPreferences: v })} placeholder={a.drinksPlaceholder} />,
    },
    {
      key: 'fruits',
      title: a.fruitsTitle,
      help: a.fruitsHelp,
      render: ({ draft, update }) => <TagInput label={a.fruits} values={draft.fruitPreferences} onChange={(v) => update({ fruitPreferences: v })} placeholder={a.fruitsPlaceholder} />,
    },
    { key: 'containers', title: a.containersTitle, help: a.containersHelp, render: (p) => <ContainersEditor {...p} /> },
    {
      key: 'allergies',
      title: a.allergiesTitle,
      help: a.allergiesHelp,
      render: ({ draft, update }) => (
        <View style={{ gap: 16 }}>
          <TagInput label={a.allergies} values={draft.allergies} onChange={(v) => update({ allergies: v })} placeholder={a.allergiesPlaceholder} />
          <TagInput label={a.restrictions} values={draft.dietaryRestrictions} onChange={(v) => update({ dietaryRestrictions: v })} placeholder={a.restrictionsPlaceholder} />
        </View>
      ),
    },
    {
      key: 'conditions',
      title: a.conditionsTitle,
      help: a.conditionsHelp,
      render: ({ draft, update }) => <TagInput label={a.conditions} values={draft.healthConditions} onChange={(v) => update({ healthConditions: v })} placeholder={a.conditionsPlaceholder} />,
    },
    {
      key: 'restriction',
      title: a.restrictionTitle,
      help: a.restrictionHelp,
      render: ({ draft, update }) => <ChoiceGroup options={TRI} value={draft.fluidRestriction} onChange={(v) => update({ fluidRestriction: v as TriState })} />,
    },
    {
      key: 'goal',
      title: a.goalTitle,
      help: a.goalHelp,
      when: (d) => d.fluidRestriction === 'yes',
      render: ({ draft, update }) => (
        <View style={{ gap: 16 }}>
          <TextField
            label={a.goalAmount}
            hint={a.goalAmountHint}
            keyboardType="number-pad"
            value={draft.professionalGoalMl === null ? '' : String(draft.professionalGoalMl)}
            onChangeText={(v) => update({ professionalGoalMl: v.trim() === '' ? null : Number(v.replace(/\D/g, '')) })}
          />
          <TextField label={a.goalInstructions} hint={a.goalInstructionsHint} value={draft.professionalInstructions} onChangeText={(v) => update({ professionalInstructions: v })} multiline />
        </View>
      ),
    },
    {
      key: 'swallow',
      title: a.swallowTitle,
      help: a.swallowHelp,
      render: ({ draft, update }) => <ChoiceGroup options={TRI} value={draft.swallowingDifficulty} onChange={(v) => update({ swallowingDifficulty: v as TriState })} />,
    },
    {
      key: 'help_needs',
      title: a.helpNeedsTitle,
      render: ({ draft, update }) => (
        <View style={{ gap: 16 }}>
          <ChoiceGroup label={a.helpDrink} options={TRI} value={draft.needsHelpToDrink} onChange={(v) => update({ needsHelpToDrink: v as TriState })} />
          <ChoiceGroup label={a.helpBathroom} options={TRI} value={draft.needsHelpToBathroom} onChange={(v) => update({ needsHelpToBathroom: v as TriState })} />
        </View>
      ),
    },
    {
      key: 'a11y',
      title: a.a11yTitle,
      render: ({ draft, update }) => (
        <View style={{ gap: 16 }}>
          <ChoiceGroup
            label={a.fontSize}
            options={[
              { value: '1', label: a.fontNormal },
              { value: '1.25', label: a.fontLarge },
              { value: '1.5', label: a.fontXLarge },
              { value: '1.75', label: a.fontMax },
            ]}
            value={String(draft.accessibility.fontScale)}
            onChange={(v) => update({ accessibility: { ...draft.accessibility, fontScale: Number(v) as 1 | 1.25 | 1.5 | 1.75 } })}
          />
          <Toggle label={a.highContrast} value={draft.accessibility.highContrast} onChange={(v) => update({ accessibility: { ...draft.accessibility, highContrast: v } })} />
          <Toggle label={a.speakReminders} hint={a.speakRemindersHint} value={draft.accessibility.speakReminders} onChange={(v) => update({ accessibility: { ...draft.accessibility, speakReminders: v } })} />
          <Toggle label={a.reduceMotion} value={draft.accessibility.reduceMotion} onChange={(v) => update({ accessibility: { ...draft.accessibility, reduceMotion: v } })} />
        </View>
      ),
    },
    {
      key: 'extras',
      title: env.caregiverEnabled ? a.extrasTitleCaregiver : a.extrasTitle,
      help: env.caregiverEnabled ? a.extrasHelpCaregiver : a.extrasHelp,
      render: ({ draft, update }) => (
        <View style={{ gap: 16 }}>
          <Toggle label={a.wantsMedications} value={draft.wantsMedications} onChange={(v) => update({ wantsMedications: v })} />
          {env.caregiverEnabled ? (
            <Toggle label={a.wantsCaregiver} hint={a.wantsCaregiverHint} value={draft.wantsCaregiver} onChange={(v) => update({ wantsCaregiver: v })} />
          ) : null}
        </View>
      ),
    },
  ];
}

export function visibleSteps(draft: Profile): Step[] {
  return allSteps().filter((s) => !s.when || s.when(draft));
}
