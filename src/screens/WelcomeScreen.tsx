import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { APP_NAME, appTagline } from '@/config/branding';
import { useAppStore } from '@/state/appStore';
import { useTheme } from '@/ui/theme';
import { strings } from '@/i18n';

export function WelcomeScreen() {
  const nav = useNavigation();
  const t = useTheme();
  const s = strings().welcome;
  const profile = useAppStore((s) => s.profile);
  const canResume = !!profile && profile.assessmentStep > 0 && !profile.assessmentCompleted;
  return (
    <Screen safeTop>
      <View style={{ alignItems: 'center', gap: t.space(1), marginTop: t.space(4) }}>
        <AppText variant="big" accessibilityRole="header">{APP_NAME}</AppText>
        <AppText style={{ textAlign: 'center' }} muted>{appTagline()}</AppText>
      </View>
      <Card>
        <AppText variant="heading">{s.howItWorks}</AppText>
        <AppText>{s.step1}</AppText>
        <AppText>{s.step2}</AppText>
        <AppText>{s.step3}</AppText>
        <AppText muted variant="small">{s.disclaimer(APP_NAME)}</AppText>
      </Card>
      <BigButton label={canResume ? s.resume : s.start} icon="→" onPress={() => nav.navigate('Assessment', { resume: canResume })} />
      {canResume ? <BigButton kind="secondary" label={s.restart} onPress={() => nav.navigate('Assessment', { resume: false })} /> : null}
    </Screen>
  );
}
