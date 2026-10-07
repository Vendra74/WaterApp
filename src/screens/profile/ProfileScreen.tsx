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
import { strings } from '@/i18n';
import { formatHHmm, formatRange } from '@/i18n/format';

export function ProfileScreen() {
  const nav = useNavigation();
  const { profile, plan, updateProfile } = useAppStore();
  if (!profile || !plan) return null;
  const reviewDue = profile.lastHealthReviewPromptAt ? addDays(new Date(profile.lastHealthReviewPromptAt), HEALTH_REVIEW_INTERVAL_DAYS) <= new Date() : false;
  const a11y = profile.accessibility;
  const s = strings();
  const p = s.profile;
  const a = s.assessment;

  return (
    <Screen title={p.title}>
      <Card>
        <AppText variant="heading">{profile.name}{profile.preferredName ? ` (${profile.preferredName})` : ''}</AppText>
        <AppText muted>{p.routine(formatHHmm(profile.wakeTime), formatHHmm(profile.sleepTime))}{profile.naps.length ? p.naps(profile.naps.map((n) => formatRange(n.start, n.end)).join(', ')) : ''}</AppText>
        <BigButton kind="secondary" compact label={p.update} onPress={() => nav.navigate('Assessment', { resume: false, editing: true })} />
      </Card>
      <Banner tone={plan.mode === 'restricted_no_suggestions' ? 'warning' : plan.mode === 'professional_goal' ? 'success' : 'info'} title={plan.mode === 'professional_goal' ? p.planProfessional(plan.goalMl ?? 0) : plan.mode === 'general_reminders' ? p.planGeneral : p.planRestricted}>
        {plan.guidance}{plan.professionalInstructions ? p.instructions(plan.professionalInstructions) : ''}
      </Banner>
      {reviewDue ? (
        <Card tone="warning">
          <AppText variant="heading">{p.reviewTitle}</AppText>
          <AppText>{p.reviewBody(HEALTH_REVIEW_INTERVAL_DAYS)}</AppText>
          <BigButton compact label={p.reviewSame} onPress={() => void updateProfile({ ...profile, lastHealthReviewPromptAt: new Date().toISOString() })} />
          <BigButton compact kind="secondary" label={p.reviewChanged} onPress={() => nav.navigate('Assessment', { resume: false, editing: true })} />
        </Card>
      ) : null}
      <Card>
        <AppText variant="heading">{p.accessibility}</AppText>
        <ChoiceGroup
          label={a.fontSize}
          options={[{ value: '1', label: a.fontNormal }, { value: '1.25', label: a.fontLarge }, { value: '1.5', label: a.fontXLarge }, { value: '1.75', label: a.fontMax }]}
          value={String(a11y.fontScale)}
          onChange={(v) => void updateProfile({ ...profile, accessibility: { ...a11y, fontScale: Number(v) as 1 | 1.25 | 1.5 | 1.75 } })}
        />
        <Toggle label={a.highContrast} value={a11y.highContrast} onChange={(v) => void updateProfile({ ...profile, accessibility: { ...a11y, highContrast: v } })} />
        <Toggle label={p.speakInApp} value={a11y.speakReminders} onChange={(v) => void updateProfile({ ...profile, accessibility: { ...a11y, speakReminders: v } })} />
        <Toggle label={a.reduceMotion} value={a11y.reduceMotion} onChange={(v) => void updateProfile({ ...profile, accessibility: { ...a11y, reduceMotion: v } })} />
      </Card>
      <Card>
        <AppText variant="heading">{p.recorded}</AppText>
        <AppText>{p.allergies(profile.allergies.join(', ') || p.noneLower)}</AppText>
        <AppText>{p.restrictions(profile.dietaryRestrictions.join(', ') || p.noneLower)}</AppText>
        <AppText>{p.conditions(profile.healthConditions.join(', ') || p.noneLower)}</AppText>
        <AppText muted variant="small">{p.onlyOnDevice}</AppText>
      </Card>
    </Screen>
  );
}
