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

export function HelpScreen() {
  const nav = useNavigation();
  const { contacts, sync } = useAppStore();
  const [notice, setNotice] = useState<string | null>(null);

  const call = async (phone: string) => {
    const url = `tel:${phone.replace(/[^\d+]/g, '')}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else setNotice('Este aparelho não conseguiu abrir o discador. Use o telefone para ligar.');
  };

  const notifyCaregiver = async () => {
    setNotice('Enviando aviso…');
    const sent = await sendHelpRequestedAlert();
    setNotice(sent ? 'Aviso registrado para o cuidador. Ele verá ao abrir o aplicativo. Não há garantia de que ele veja agora.' : 'Não foi possível enviar o aviso (sem internet, sem conta ou sem cuidador vinculado). Ligue para alguém.');
  };

  return (
    <Screen title="Preciso de ajuda">
      <Banner tone="warning" title="Este aplicativo não é um serviço de emergência">
        Ninguém monitora o aplicativo em tempo real. Em emergência, ligue para o SAMU (192).
      </Banner>
      <BigButton kind="danger" icon="☎" label="Ligar para o SAMU (192)" onPress={() => void call('192')} />
      <Card>
        <AppText variant="heading">Meus contatos</AppText>
        {contacts.length === 0 ? <AppText muted>Nenhum contato cadastrado.</AppText> : null}
        {contacts.map((c) => (
          <BigButton key={c.id} icon="☎" label={`Ligar para ${c.name}${c.relationship ? ` (${c.relationship})` : ''}`} onPress={() => void call(c.phone)} />
        ))}
        <BigButton kind="secondary" compact label="Gerenciar contatos" onPress={() => nav.navigate('Contacts')} />
      </Card>
      {sync?.configured && sync.signedIn ? (
        <BigButton kind="secondary" label="Avisar meu cuidador pelo aplicativo" hint="Registra um aviso; o cuidador vê quando abrir o aplicativo" onPress={() => void notifyCaregiver()} />
      ) : null}
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      <BigButton kind="ghost" compact icon="🔊" label="Ler esta tela em voz alta" onPress={() => speak('Tela de ajuda. Este aplicativo não é um serviço de emergência. Em emergência, ligue para o SAMU, 192. ' + contacts.map((c) => `Ligar para ${c.name}.`).join(' '))} />
      <BigButton kind="ghost" compact label="Voltar" onPress={() => nav.goBack()} />
    </Screen>
  );
}
