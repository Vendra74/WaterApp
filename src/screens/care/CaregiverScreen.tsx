import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner, ChoiceGroup, TextField, Toggle } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { isSupabaseConfigured } from '@/config/env';
import { currentUser, requestEmailCode, signOut, verifyEmailCode, type AuthUser } from '@/services/sync/authService';
import { acceptInvite, CONSENT_TEXT, changePermission, createInvite, listCaredPeople, listMyLinks, revokeLink, type CaredPerson, type RemoteCareLink } from '@/services/sync/careService';
import type { CarePermission } from '@/domain/types';
import { formatDate as formatDateBR } from '@/i18n/format';

export function CaregiverScreen() {
  const nav = useNavigation();
  const { profile, settings, updateSettings, refreshSync, sync } = useAppStore();
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [links, setLinks] = useState<RemoteCareLink[]>([]);
  const [cared, setCared] = useState<CaredPerson[]>([]);
  const [permission, setPermission] = useState<CarePermission>('view');
  const [consent, setConsent] = useState(false);
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [acceptCode, setAcceptCode] = useState('');

  const load = async () => {
    const u = await currentUser();
    setUser(u);
    if (u) {
      setLinks(await listMyLinks());
      setCared(await listCaredPeople());
    }
  };
  useEffect(() => {
    if (configured) void load();
  }, [configured]);

  if (!configured) {
    return (
      <Screen title="Compartilhar com cuidador">
        <Banner tone="info" title="Integração pendente">
          Este build não tem o servidor de compartilhamento configurado. O uso individual funciona normalmente. Para ativar, configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY e aplique as migrações em supabase/.
        </Banner>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen title="Compartilhar com cuidador">
        <AppText>Para compartilhar, você precisa de uma conta. Enviamos um código para o seu e-mail; não há senha.</AppText>
        {!codeSent ? (
          <View style={{ gap: 12 }}>
            <TextField label="Seu e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <BigButton label="Enviar código" onPress={() => void requestEmailCode(email, profile?.name ?? '').then((r) => { setMsg(r.ok ? 'Código enviado. Veja seu e-mail.' : r.error); if (r.ok) setCodeSent(true); })} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <TextField label="Código recebido" value={code} onChangeText={setCode} keyboardType="number-pad" />
            <BigButton label="Entrar" onPress={() => void verifyEmailCode(email, code).then((r) => { if (r.ok) { setMsg(null); void load(); void refreshSync(); } else setMsg(r.error); })} />
            <BigButton kind="ghost" compact label="Enviar outro código" onPress={() => setCodeSent(false)} />
          </View>
        )}
        {msg ? <Banner tone="info">{msg}</Banner> : null}
      </Screen>
    );
  }

  const myOwnerLinks = links.filter((l) => l.owner_id === user.id);

  return (
    <Screen title="Compartilhar com cuidador">
      <Card tone="alt">
        <AppText>Conectado como {user.email}</AppText>
        <AppText muted variant="small">Pendências de envio: {sync?.pending ?? 0}{sync && !sync.online ? ' · sem internet' : ''}{sync?.lastError ? ` · erro: ${sync.lastError}` : ''}</AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BigButton compact kind="secondary" style={{ flex: 1 }} label="Sincronizar agora" onPress={() => void refreshSync().then(load)} />
          <BigButton compact kind="ghost" style={{ flex: 1 }} label="Sair da conta" onPress={() => void signOut().then(() => setUser(null))} />
        </View>
      </Card>

      <Card>
        <AppText variant="heading">Convidar alguém para me acompanhar</AppText>
        <ChoiceGroup
          label="Permissão"
          options={[
            { value: 'view', label: 'Apenas ver', description: 'Vê registros de água e medicamentos e recebe avisos de “sem confirmação”.' },
            { value: 'edit', label: 'Ver e registrar', description: 'Também pode registrar água e confirmar doses por você.' },
          ]}
          value={permission}
          onChange={(v) => setPermission(v as CarePermission)}
        />
        <Toggle label="Li e autorizo o compartilhamento" hint={CONSENT_TEXT} value={consent} onChange={setConsent} />
        <BigButton label="Gerar código de convite" disabled={!consent} onPress={() => void createInvite(permission).then((r) => { if (r.ok) { setInvite({ code: r.code, expiresAt: r.expiresAt }); void load(); } else setMsg(r.error); })} />
        {invite ? (
          <Banner tone="success" title={`Código: ${invite.code}`}>
            Peça para a pessoa digitar este código no aplicativo dela, em “Acompanhar alguém”. Vale até {formatDateBR(new Date(invite.expiresAt))}.
          </Banner>
        ) : null}
      </Card>

      <Card>
        <AppText variant="heading">Quem me acompanha</AppText>
        {myOwnerLinks.length === 0 ? <AppText muted>Ninguém ainda.</AppText> : null}
        {myOwnerLinks.map((l) => (
          <View key={l.id} style={{ gap: 8, borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 8 }}>
            <AppText>{l.status === 'pending' ? 'Convite pendente' : l.status === 'active' ? 'Ativo' : 'Revogado'} · {l.permission === 'edit' ? 'ver e registrar' : 'apenas ver'} · desde {formatDateBR(new Date(l.created_at))}</AppText>
            {l.status !== 'revoked' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <BigButton compact kind="secondary" style={{ flex: 1 }} label={l.permission === 'edit' ? 'Mudar para apenas ver' : 'Permitir registrar'} onPress={() => void changePermission(l.id, l.permission === 'edit' ? 'view' : 'edit').then(load)} />
                <BigButton compact kind="danger" style={{ flex: 1 }} label="Revogar acesso" onPress={() => void revokeLink(l.id).then(load)} />
              </View>
            ) : null}
          </View>
        ))}
      </Card>

      <Card>
        <AppText variant="heading">Aviso ao cuidador</AppText>
        <ChoiceGroup
          label='Avisar após quantos lembretes de água seguidos sem confirmação?'
          hint='A mensagem diz apenas "sem confirmação". Não afirma que você não bebeu.'
          options={[{ value: '0', label: 'Não avisar' }, { value: '2', label: '2 lembretes' }, { value: '3', label: '3 lembretes' }, { value: '4', label: '4 lembretes' }]}
          value={String(settings?.caregiverAlertAfterUnconfirmed ?? 0)}
          onChange={(v) => settings && void updateSettings({ ...settings, caregiverAlertAfterUnconfirmed: Number(v) })}
        />
        <Toggle
          label="Avisar quando uma dose de medicamento ficar sem confirmação"
          hint="O aviso sai cerca de 2 horas depois do horário da dose, quando o aplicativo é aberto ou consegue rodar em segundo plano. Diz apenas “sem confirmação”. Não afirma que você não tomou."
          value={settings?.caregiverAlertMedication ?? true}
          onChange={(v) => settings && void updateSettings({ ...settings, caregiverAlertMedication: v })}
        />
      </Card>

      <Card>
        <AppText variant="heading">Acompanhar alguém</AppText>
        <TextField label="Código recebido" value={acceptCode} onChangeText={setAcceptCode} autoCapitalize="characters" />
        <BigButton kind="secondary" label="Aceitar convite" onPress={() => void acceptInvite(acceptCode).then((r) => { setMsg(r.ok ? 'Convite aceito.' : r.error); if (r.ok) void load(); })} />
        {cared.map((p) => (
          <BigButton key={p.link_id} compact label={`Ver ${p.display_name || 'pessoa'}`} onPress={() => nav.navigate('CaredPerson', { ownerId: p.owner_id, name: p.display_name || 'Pessoa', permission: p.permission })} />
        ))}
      </Card>
      {msg ? <Banner tone="info">{msg}</Banner> : null}
    </Screen>
  );
}
