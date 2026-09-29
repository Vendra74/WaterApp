import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { TextField } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { newId } from '@/domain/ids';

export function ContactsScreen() {
  const { contacts, saveContact, removeContact } = useAppStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const add = async () => {
    if (name.trim().length < 2 || phone.replace(/\D/g, '').length < 3) return;
    await saveContact({ id: newId('ct-'), name: name.trim(), phone: phone.trim(), relationship: relationship.trim() });
    setName(''); setPhone(''); setRelationship('');
  };
  return (
    <Screen title="Contatos de ajuda">
      <AppText muted>Pessoas para quem você quer ligar ao tocar em “Preciso de ajuda”.</AppText>
      {contacts.map((c) => (
        <Card key={c.id}>
          <AppText variant="heading">{c.name}</AppText>
          <AppText>{c.phone}{c.relationship ? ` · ${c.relationship}` : ''}</AppText>
          <BigButton kind="ghost" compact label="Remover" onPress={() => void removeContact(c.id)} />
        </Card>
      ))}
      <Card>
        <AppText variant="heading">Novo contato</AppText>
        <View style={{ gap: 12 }}>
          <TextField label="Nome" value={name} onChangeText={setName} autoCapitalize="words" />
          <TextField label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextField label="Parentesco ou relação (opcional)" value={relationship} onChangeText={setRelationship} />
          <BigButton label="Adicionar contato" onPress={() => void add()} />
        </View>
      </Card>
    </Screen>
  );
}
