# Backend (Supabase) — opcional

O modo individual do aplicativo funciona sem este backend. Ele é necessário apenas para
autenticação e compartilhamento com cuidador.

## Aplicar migrações

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

Ou cole `migrations/0001_init.sql` no SQL Editor do painel.

## Autenticação

O app usa login por código enviado ao e-mail (OTP). No painel: Authentication → Providers → Email,
ative "Email OTP" e desative confirmação por link se quiser apenas código. Ajuste o template
"Magic Link" para incluir `{{ .Token }}`.

## Segurança

- Todas as tabelas têm RLS. Cuidadores só leem dados de titulares com vínculo `active`;
  edição exige permissão `edit`.
- Convites: apenas o hash SHA-256 do código é armazenado; validade de 48 h.
- Revogação: o titular altera `status = 'revoked'`; o acesso cai imediatamente nas políticas.
- `delete_my_data()` remove todos os dados remotos do titular.
- Push para o cuidador (aviso "sem confirmação") **não** está implementado: exige uma Edge Function
  com Expo Push ou FCM/APNs e as credenciais correspondentes. Os avisos ficam em `care_alerts` e
  aparecem no app do cuidador ao abrir.
