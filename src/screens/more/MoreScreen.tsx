import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { APP_NAME } from '@/config/branding';
import { useAppStore } from '@/state/appStore';
import { env } from '@/config/env';

export function MoreScreen() {
  const nav = useNavigation();
  const { sync, demoMode } = useAppStore();
  return (
    <Screen safeTop title="Mais">
      <BigButton kind="secondary" icon="👤" label="Perfil e plano" onPress={() => nav.navigate('Profile')} />
      <BigButton kind="secondary" icon="⏰" label="Lembretes de água" onPress={() => nav.navigate('ReminderSettings')} />
      <BigButton kind="secondary" icon="☎" label="Contatos de ajuda" onPress={() => nav.navigate('Contacts')} />
      {env.caregiverEnabled ? (
        <BigButton kind="secondary" icon="👥" label={`Compartilhar com cuidador${sync?.pending ? ` (${sync.pending} pendentes)` : ''}`} onPress={() => nav.navigate('Caregiver')} />
      ) : null}
      <BigButton kind="secondary" icon="🔔" label="Testar notificações" onPress={() => nav.navigate('NotificationTest')} />
      <BigButton kind="secondary" icon="📖" label="Saiba mais" onPress={() => nav.navigate('Content')} />
      <BigButton kind="secondary" icon="🗂" label="Meus dados (exportar / apagar)" onPress={() => nav.navigate('Data')} />
      <AppText muted variant="small">{APP_NAME} · versão 0.1.0{demoMode ? ' · MODO DEMONSTRAÇÃO' : ''}</AppText>
      <AppText muted variant="small">Ferramenta de apoio à rotina. Não faz diagnóstico, não prescreve e não substitui orientação profissional.</AppText>
    </Screen>
  );
}
