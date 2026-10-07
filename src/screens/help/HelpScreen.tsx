import React, { useState } from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { sendHelpRequestedAlert } from '@/services/sync/careService';
import { speak } from '@/services/speech/speech';
import { strings } from '@/i18n';

export function HelpScreen() {
  const nav = useNavigation();
  const { contacts, sync } = useAppStore();
  const [notice, setNotice] = useState<string | null>(null);
  const s = strings();
  const h = s.help;

  const call = async (phone: string) => {
    const url = `tel:${phone.replace(/[^\d+]/g, '')}`;
    // Sem `canOpenURL`: no Android 11+ ele responde "não" para tel: a menos que o manifesto declare
    // <queries> para o discador, e o botão ficava mudo. Abrir direto funciona; o erro é tratado.
    try {
      await Linking.openURL(url);
    } catch {
      setNotice(h.dialerFailed);
    }
  };

  const notifyCaregiver = async () => {
    setNotice(h.sending);
    const sent = await sendHelpRequestedAlert();
    setNotice(sent ? h.sent : h.notSent);
  };

  return (
    <Screen title={h.title}>
      <Banner tone="warning" title={h.notEmergencyTitle}>{h.notEmergencyBody}</Banner>
      <BigButton kind="danger" icon="☎" label={h.callEmergency} onPress={() => void call(h.emergencyNumber)} />
      <Card>
        <AppText variant="heading">{h.myContacts}</AppText>
        {contacts.length === 0 ? <AppText muted>{h.noContacts}</AppText> : null}
        {contacts.map((c) => (
          <BigButton key={c.id} icon="☎" label={h.callContact(c.name, c.relationship)} onPress={() => void call(c.phone)} />
        ))}
        <BigButton kind="secondary" compact label={h.manageContacts} onPress={() => nav.navigate('Contacts')} />
      </Card>
      {sync?.configured && sync.signedIn ? (
        <BigButton kind="secondary" label={h.notifyCaregiver} hint={h.notifyCaregiverHint} onPress={() => void notifyCaregiver()} />
      ) : null}
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      <BigButton kind="ghost" compact icon="🔊" label={h.readScreen} onPress={() => speak(h.spokenIntro + contacts.map((c) => h.spokenCall(c.name)).join(' '))} />
      <BigButton kind="ghost" compact label={s.common.back} onPress={() => nav.goBack()} />
    </Screen>
  );
}
