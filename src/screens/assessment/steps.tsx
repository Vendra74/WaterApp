import React from 'react';
import { View } from 'react-native';
import type { Profile, TriState } from '@/domain/types';
import { ChoiceGroup, Stepper, TagInput, TextField, TimeField, Toggle } from '@/ui/components/Fields';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { useTheme } from '@/ui/theme';
import { newId } from '@/domain/ids';

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

const TRI: { value: TriState; label: string }[] = [
  { value: 'yes', label: 'Sim' },
  { value: 'no', label: 'Não' },
  { value: 'unknown', label: 'Não sei' },
];

const NapsEditor = ({ draft, update }: StepProps) => {
  const t = useTheme();
  return (
    <View style={{ gap: t.space(2) }}>
      {draft.naps.map((nap, i) => (
        <View key={i} style={{ gap: t.space(1), borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius, padding: t.space(1.5) }}>
          <TimeField label={`Cochilo ${i + 1} — início`} value={nap.start} onChange={(v) => update({ naps: draft.naps.map((n, j) => (j === i ? { ...n, start: v } : n)) })} />
          <TimeField label={`Cochilo ${i + 1} — fim`} value={nap.end} onChange={(v) => update({ naps: draft.naps.map((n, j) => (j === i ? { ...n, end: v } : n)) })} />
          <BigButton kind="ghost" compact label="Remover este cochilo" onPress={() => update({ naps: draft.naps.filter((_, j) => j !== i) })} />
        </View>
      ))}
      <BigButton kind="secondary" compact label="+ Adicionar cochilo" onPress={() => update({ naps: [...draft.naps, { start: '13:00', end: '14:00' }] })} />
      {draft.naps.length === 0 ? <AppText muted>Se você não costuma cochilar, pode seguir em frente.</AppText> : null}
    </View>
  );
};

const MealsEditor = ({ draft, update }: StepProps) => {
  const t = useTheme();
  return (
    <View style={{ gap: t.space(2) }}>
      {draft.meals.map((meal, i) => (
        <View key={i} style={{ gap: t.space(1), borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius, padding: t.space(1.5) }}>
          <TextField label="Refeição" value={meal.label} onChangeText={(v) => update({ meals: draft.meals.map((m, j) => (j === i ? { ...m, label: v } : m)) })} />
          <TimeField label="Horário" value={meal.time} onChange={(v) => update({ meals: draft.meals.map((m, j) => (j === i ? { ...m, time: v } : m)) })} />
          <BigButton kind="ghost" compact label="Remover" onPress={() => update({ meals: draft.meals.filter((_, j) => j !== i) })} />
        </View>
      ))}
      <BigButton kind="secondary" compact label="+ Adicionar refeição ou lanche" onPress={() => update({ meals: [...draft.meals, { label: 'Lanche', time: '16:00' }] })} />
    </View>
  );
};

const ContainersEditor = ({ draft, update }: StepProps) => {
  const t = useTheme();
  return (
    <View style={{ gap: t.space(2) }}>
      {draft.containers.map((c, i) => (
        <View key={c.id} style={{ gap: t.space(1), borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius, padding: t.space(1.5) }}>
          <TextField label="Nome do recipiente" value={c.label} onChangeText={(v) => update({ containers: draft.containers.map((x, j) => (j === i ? { ...x, label: v } : x)) })} />
          <Stepper label="Quanto cabe" value={c.volumeMl} step={50} min={50} max={2000} onChange={(v) => update({ containers: draft.containers.map((x, j) => (j === i ? { ...x, volumeMl: v } : x)) })} />
          <BigButton kind="ghost" compact label="Remover" onPress={() => update({ containers: draft.containers.filter((_, j) => j !== i) })} />
        </View>
      ))}
      <BigButton kind="secondary" compact label="+ Adicionar copo ou garrafa" onPress={() => update({ containers: [...draft.containers, { id: newId('c-'), label: 'Novo recipiente', volumeMl: 200 }] })} />
    </View>
  );
};

export const STEPS: Step[] = [
  {
    key: 'help',
    title: 'Quem está respondendo?',
    help: 'Você pode responder sozinho ou com a ajuda de alguém de confiança.',
    render: ({ draft, update }) => (
      <ChoiceGroup
        options={[
          { value: 'self', label: 'Eu mesmo(a)' },
          { value: 'helped', label: 'Com ajuda de um familiar ou cuidador' },
        ]}
        value={draft.filledWithHelp ? 'helped' : 'self'}
        onChange={(v) => update({ filledWithHelp: v === 'helped' })}
      />
    ),
  },
  {
    key: 'name',
    title: 'Qual é o seu nome?',
    validate: (d) => (d.name.trim().length < 2 ? 'Escreva seu nome para continuar.' : null),
    render: ({ draft, update }) => (
      <View style={{ gap: 16 }}>
        <TextField label="Nome" value={draft.name} onChangeText={(v) => update({ name: v })} autoCapitalize="words" />
        <TextField label="Como prefere ser chamado(a)?" hint="É assim que vamos falar com você nos lembretes." value={draft.preferredName} onChangeText={(v) => update({ preferredName: v })} autoCapitalize="words" />
      </View>
    ),
  },
  {
    key: 'age',
    title: 'Quantos anos você tem?',
    help: 'Usamos a idade apenas para adaptar a linguagem e os lembretes. Não calculamos metas por idade.',
    render: ({ draft, update }) => (
      <TextField label="Idade" keyboardType="number-pad" value={draft.age === null ? '' : String(draft.age)} onChangeText={(v) => update({ age: v.trim() === '' ? null : Number(v.replace(/\D/g, '')) })} />
    ),
  },
  {
    key: 'sleep',
    title: 'Que horas você costuma acordar e dormir?',
    help: 'Os lembretes de água ficam dentro desse período. Medicamentos noturnos continuam sendo lembrados.',
    render: ({ draft, update }) => (
      <View style={{ gap: 16 }}>
        <TimeField label="Acordar" value={draft.wakeTime} onChange={(v) => update({ wakeTime: v })} />
        <TimeField label="Dormir" value={draft.sleepTime} onChange={(v) => update({ sleepTime: v })} />
      </View>
    ),
  },
  { key: 'naps', title: 'Você costuma cochilar durante o dia?', help: 'Podemos pausar os lembretes de água nesses horários.', render: (p) => <NapsEditor {...p} /> },
  { key: 'meals', title: 'Quais são os horários das suas refeições?', help: 'Ajuda a sugerir água e, se você quiser, frutas nos lanches.', render: (p) => <MealsEditor {...p} /> },
  {
    key: 'activities',
    title: 'O que você costuma fazer no dia a dia?',
    render: ({ draft, update }) => (
      <ChoiceGroup
        multi
        options={[
          { value: 'caminhada', label: 'Caminhadas' },
          { value: 'exercicio', label: 'Exercícios ou fisioterapia' },
          { value: 'casa', label: 'Tarefas de casa' },
          { value: 'jardim', label: 'Jardim ou horta' },
          { value: 'trabalho', label: 'Trabalho' },
          { value: 'descanso', label: 'Fico mais em casa, descansando' },
        ]}
        value={draft.activities}
        onChange={(v) => update({ activities: v as string[] })}
      />
    ),
  },
  {
    key: 'heat',
    title: 'Você fica exposto(a) ao calor ou ao sol com frequência?',
    help: 'Só para conhecer sua rotina. O aplicativo não aumenta metas por causa do calor.',
    render: ({ draft, update }) => <ChoiceGroup options={TRI} value={draft.heatExposure} onChange={(v) => update({ heatExposure: v as TriState })} />,
  },
  {
    key: 'drinks',
    title: 'O que você gosta de beber?',
    help: 'Água é sempre a opção principal nos lembretes.',
    render: ({ draft, update }) => <TagInput label="Bebidas" values={draft.drinkPreferences} onChange={(v) => update({ drinkPreferences: v })} placeholder="Ex.: chá, suco" />,
  },
  {
    key: 'fruits',
    title: 'Quais frutas você gosta?',
    help: 'Podem aparecer como sugestão nos lanches. Frutas não substituem a água.',
    render: ({ draft, update }) => <TagInput label="Frutas" values={draft.fruitPreferences} onChange={(v) => update({ fruitPreferences: v })} placeholder="Ex.: banana, mamão" />,
  },
  { key: 'containers', title: 'Qual copo ou garrafa você costuma usar?', help: 'Facilita registrar quanto você bebeu.', render: (p) => <ContainersEditor {...p} /> },
  {
    key: 'allergies',
    title: 'Você tem alergias ou restrições alimentares?',
    help: 'Usamos apenas para não sugerir algo que você não pode. Deixe em branco se não tiver.',
    render: ({ draft, update }) => (
      <View style={{ gap: 16 }}>
        <TagInput label="Alergias" values={draft.allergies} onChange={(v) => update({ allergies: v })} placeholder="Ex.: morango" />
        <TagInput label="Restrições alimentares" values={draft.dietaryRestrictions} onChange={(v) => update({ dietaryRestrictions: v })} placeholder="Ex.: sem açúcar" />
      </View>
    ),
  },
  {
    key: 'conditions',
    title: 'Há condições de saúde que você gostaria de registrar?',
    help: 'Opcional. Fica só no seu aparelho e serve para você e quem cuida de você lembrarem. O aplicativo não interpreta essas informações.',
    render: ({ draft, update }) => <TagInput label="Condições relatadas" values={draft.healthConditions} onChange={(v) => update({ healthConditions: v })} placeholder="Ex.: pressão alta" />,
  },
  {
    key: 'restriction',
    title: 'Algum profissional de saúde orientou uma quantidade de líquidos por dia, ou uma restrição?',
    help: 'Se não souber, escolha "Não sei". Nesse caso o aplicativo não vai sugerir quantidades.',
    render: ({ draft, update }) => <ChoiceGroup options={TRI} value={draft.fluidRestriction} onChange={(v) => update({ fluidRestriction: v as TriState })} />,
  },
  {
    key: 'goal',
    title: 'Qual foi a quantidade e a orientação recebida?',
    help: 'Informe apenas se souber. Não é preciso adivinhar: deixe em branco se não tiver certeza.',
    when: (d) => d.fluidRestriction === 'yes',
    render: ({ draft, update }) => (
      <View style={{ gap: 16 }}>
        <TextField
          label="Quantidade por dia (ml)"
          hint="Ex.: 1500. Deixe em branco se não souber."
          keyboardType="number-pad"
          value={draft.professionalGoalMl === null ? '' : String(draft.professionalGoalMl)}
          onChangeText={(v) => update({ professionalGoalMl: v.trim() === '' ? null : Number(v.replace(/\D/g, '')) })}
        />
        <TextField label="Instruções recebidas" hint="Ex.: incluir sopas e sucos na conta; evitar à noite." value={draft.professionalInstructions} onChangeText={(v) => update({ professionalInstructions: v })} multiline />
      </View>
    ),
  },
  {
    key: 'swallow',
    title: 'Você tem dificuldade para engolir ou costuma engasgar ao beber?',
    help: 'Se sim ou não souber, o aplicativo não sugere quantidades nem alimentos: confirme um plano com sua equipe de saúde.',
    render: ({ draft, update }) => <ChoiceGroup options={TRI} value={draft.swallowingDifficulty} onChange={(v) => update({ swallowingDifficulty: v as TriState })} />,
  },
  {
    key: 'help_needs',
    title: 'Você precisa de ajuda para pegar água, beber ou ir ao banheiro?',
    render: ({ draft, update }) => (
      <View style={{ gap: 16 }}>
        <ChoiceGroup label="Para pegar água ou beber" options={TRI} value={draft.needsHelpToDrink} onChange={(v) => update({ needsHelpToDrink: v as TriState })} />
        <ChoiceGroup label="Para chegar ao banheiro" options={TRI} value={draft.needsHelpToBathroom} onChange={(v) => update({ needsHelpToBathroom: v as TriState })} />
      </View>
    ),
  },
  {
    key: 'a11y',
    title: 'Como você prefere ver e ouvir o aplicativo?',
    render: ({ draft, update }) => (
      <View style={{ gap: 16 }}>
        <ChoiceGroup
          label="Tamanho das letras"
          options={[
            { value: '1', label: 'Normal' },
            { value: '1.25', label: 'Grande' },
            { value: '1.5', label: 'Muito grande' },
            { value: '1.75', label: 'Máximo' },
          ]}
          value={String(draft.accessibility.fontScale)}
          onChange={(v) => update({ accessibility: { ...draft.accessibility, fontScale: Number(v) as 1 | 1.25 | 1.5 | 1.75 } })}
        />
        <Toggle label="Alto contraste" value={draft.accessibility.highContrast} onChange={(v) => update({ accessibility: { ...draft.accessibility, highContrast: v } })} />
        <Toggle label="Ler lembretes em voz alta dentro do aplicativo" hint="Funciona com o aplicativo aberto." value={draft.accessibility.speakReminders} onChange={(v) => update({ accessibility: { ...draft.accessibility, speakReminders: v } })} />
        <Toggle label="Reduzir animações" value={draft.accessibility.reduceMotion} onChange={(v) => update({ accessibility: { ...draft.accessibility, reduceMotion: v } })} />
      </View>
    ),
  },
  {
    key: 'extras',
    title: 'Você quer cadastrar medicamentos e convidar um cuidador?',
    help: 'As duas coisas são opcionais e podem ser feitas depois.',
    render: ({ draft, update }) => (
      <View style={{ gap: 16 }}>
        <Toggle label="Quero cadastrar meus medicamentos" value={draft.wantsMedications} onChange={(v) => update({ wantsMedications: v })} />
        <Toggle label="Quero convidar um familiar ou cuidador" hint="Precisa de internet e de uma conta." value={draft.wantsCaregiver} onChange={(v) => update({ wantsCaregiver: v })} />
      </View>
    ),
  },
];

export function visibleSteps(draft: Profile): Step[] {
  return STEPS.filter((s) => !s.when || s.when(draft));
}
