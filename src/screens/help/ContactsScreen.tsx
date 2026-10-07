import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { TextField } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { newId } from '@/domain/ids';
import { strings } from '@/i18n';

export function ContactsScreen() {
  const { contacts, saveContact, removeContact } = useAppStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const s = strings();
  const c = s.contacts;
  const add = async () => {
    if (name.trim().length < 2 || phone.replace(/\D/g, '').length < 3) return;
    await saveContact({ id: newId('ct-'), name: name.trim(), phone: phone.trim(), relationship: relationship.trim() });
    setName(''); setPhone(''); setRelationship('');
  };
  return (
    <Screen title={c.title}>
      <AppText muted>{c.intro}</AppText>
      {contacts.map((ct) => (
        <Card key={ct.id}>
          <AppText variant="heading">{ct.name}</AppText>
          <AppText>{ct.phone}{ct.relationship ? ` · ${ct.relationship}` : ''}</AppText>
          <BigButton kind="ghost" compact label={s.common.remove} onPress={() => void removeContact(ct.id)} />
        </Card>
      ))}
      <Card>
        <AppText variant="heading">{c.newContact}</AppText>
        <View style={{ gap: 12 }}>
          <TextField label={c.name} value={name} onChangeText={setName} autoCapitalize="words" />
          <TextField label={c.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextField label={c.relationship} value={relationship} onChangeText={setRelationship} />
          <BigButton label={c.add} onPress={() => void add()} />
        </View>
      </Card>
    </Screen>
  );
}
