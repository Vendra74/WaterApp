import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner, ChoiceGroup, Toggle } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { addDays } from '@/domain/time/time';
import { HEALTH_REVIEW_INTERVAL_DAYS } from '@/services/notifications/notificationService';

export function ProfileScreen() {
  const nav = useNavigation();
  const { profile, plan, updateProfile } = useAppStore();
  if (!profile || !plan) return null;
  const reviewDue = profile.lastHealthReviewPromptAt ? addDays(new Date(profile.lastHealthReviewPromptAt), HEALTH_REVIEW_INTERVAL_DAYS) <= new Date() : false;
  const a11y = profile.accessibility;

  return (
    <Screen title="Perfil e plano">
      <Card>
        <AppText variant="heading">{profile.name}{profile.preferredName ? ` (${profile.preferredName})` : ''}</AppText>
        <AppText muted>Acorda {profile.wakeTime} · dorme {profile.sleepTime}{profile.naps.length ? ` · cochilos ${profile.naps.map((n) => `${n.start}–${n.end}`).join(', ')}` : ''}</AppText>
        <BigButton kind="secondary" compact label="Atualizar minhas respostas" onPress={() => nav.navigate('Assessment', { resume: false, editing: true })} />
      </Card>
      <Banner tone={plan.mode === 'restricted_no_suggestions' ? 'warning' : plan.mode === 'professional_goal' ? 'success' : 'info'} title={plan.mode === 'professional_goal' ? `Plano informado: ${plan.goalMl} ml/dia` : plan.mode === 'general_reminders' ? 'Lembretes gerais, sem meta de volume' : 'Sem sugestões de volume'}>
        {plan.guidance}{plan.professionalInstructions ? `\n\nInstruções: ${plan.professionalInstructions}` : ''}
      </Banner>
      {reviewDue ? (
        <Card tone="warning">
          <AppText variant="heading">Suas orientações de saúde mudaram?</AppText>
          <AppText>Faz mais de {HEALTH_REVIEW_INTERVAL_DAYS} dias desde a última confirmação.</AppText>
          <BigButton compact label="Não mudaram" onPress={() => void updateProfile({ ...profile, lastHealthReviewPromptAt: new Date().toISOString() })} />
          <BigButton compact kind="secondary" label="Mudaram, quero atualizar" onPress={() => nav.navigate('Assessment', { resume: false, editing: true })} />
        </Card>
      ) : null}
      <Card>
        <AppText variant="heading">Acessibilidade</AppText>
        <ChoiceGroup
          label="Tamanho das letras"
          options={[{ value: '1', label: 'Normal' }, { value: '1.25', label: 'Grande' }, { value: '1.5', label: 'Muito grande' }, { value: '1.75', label: 'Máximo' }]}
          value={String(a11y.fontScale)}
          onChange={(v) => void updateProfile({ ...profile, accessibility: { ...a11y, fontScale: Number(v) as 1 | 1.25 | 1.5 | 1.75 } })}
        />
        <Toggle label="Alto contraste" value={a11y.highContrast} onChange={(v) => void updateProfile({ ...profile, accessibility: { ...a11y, highContrast: v } })} />
        <Toggle label="Ler em voz alta dentro do aplicativo" value={a11y.speakReminders} onChange={(v) => void updateProfile({ ...profile, accessibility: { ...a11y, speakReminders: v } })} />
        <Toggle label="Reduzir animações" value={a11y.reduceMotion} onChange={(v) => void updateProfile({ ...profile, accessibility: { ...a11y, reduceMotion: v } })} />
      </Card>
      <Card>
        <AppText variant="heading">Informações registradas</AppText>
        <AppText>Alergias: {profile.allergies.join(', ') || 'nenhuma'}</AppText>
        <AppText>Restrições: {profile.dietaryRestrictions.join(', ') || 'nenhuma'}</AppText>
        <AppText>Condições relatadas: {profile.healthConditions.join(', ') || 'nenhuma'}</AppText>
        <AppText muted variant="small">Ficam apenas neste aparelho. O aplicativo não interpreta essas informações.</AppText>
      </Card>
    </Screen>
  );
}
