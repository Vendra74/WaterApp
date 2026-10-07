import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { APP_NAME } from '@/config/branding';
import { useAppStore } from '@/state/appStore';
import { env } from '@/config/env';
import { strings } from '@/i18n';

export function MoreScreen() {
  const nav = useNavigation();
  const { sync, demoMode } = useAppStore();
  const s = strings();
  const m = s.more;
  return (
    <Screen safeTop title={m.title}>
      <BigButton kind="secondary" icon="👤" label={m.profile} onPress={() => nav.navigate('Profile')} />
      <BigButton kind="secondary" icon="⏰" label={m.reminders} onPress={() => nav.navigate('ReminderSettings')} />
      <BigButton kind="secondary" icon="☎" label={m.contacts} onPress={() => nav.navigate('Contacts')} />
      {env.caregiverEnabled ? (
        <BigButton kind="secondary" icon="👥" label={m.caregiver(sync?.pending ?? 0)} onPress={() => nav.navigate('Caregiver')} />
      ) : null}
      <BigButton kind="secondary" icon="🔔" label={m.testNotifications} onPress={() => nav.navigate('NotificationTest')} />
      <BigButton kind="secondary" icon="📖" label={m.content} onPress={() => nav.navigate('Content')} />
      <BigButton kind="secondary" icon="🗂" label={m.data} onPress={() => nav.navigate('Data')} />
      <AppText muted variant="small">{s.common.appVersion(APP_NAME, '0.1.0')}{demoMode ? m.demoTag : ''}</AppText>
      <AppText muted variant="small">{m.disclaimer}</AppText>
    </Screen>
  );
}
