import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { APP_NAME, APP_TAGLINE } from '@/config/branding';
import { useAppStore } from '@/state/appStore';
import { useTheme } from '@/ui/theme';

export function WelcomeScreen() {
  const nav = useNavigation();
  const t = useTheme();
  const profile = useAppStore((s) => s.profile);
  const canResume = !!profile && profile.assessmentStep > 0 && !profile.assessmentCompleted;
  return (
    <Screen safeTop>
      <View style={{ alignItems: 'center', gap: t.space(1), marginTop: t.space(4) }}>
        <AppText variant="big" accessibilityRole="header">{APP_NAME}</AppText>
        <AppText style={{ textAlign: 'center' }} muted>{APP_TAGLINE}</AppText>
      </View>
      <Card>
        <AppText variant="heading">Como funciona</AppText>
        <AppText>1. Você responde algumas perguntas sobre sua rotina, uma por vez.</AppText>
        <AppText>2. O aplicativo lembra você de beber água e dos seus medicamentos nos horários que você escolher.</AppText>
        <AppText>3. Você registra o que bebeu e o que tomou. Nada é marcado automaticamente.</AppText>
        <AppText muted variant="small">
          O {APP_NAME} é um apoio à rotina. Ele não faz diagnóstico, não calcula doses e não substitui a orientação da sua equipe de saúde.
        </AppText>
      </Card>
      <BigButton label={canResume ? 'Continuar de onde parei' : 'Vamos conhecer sua rotina?'} icon="→" onPress={() => nav.navigate('Assessment', { resume: canResume })} />
      {canResume ? <BigButton kind="secondary" label="Recomeçar as perguntas" onPress={() => nav.navigate('Assessment', { resume: false })} /> : null}
    </Screen>
  );
}
