import { getSupabase } from './supabaseClient';

export interface AuthUser {
  id: string;
  email: string | null;
}

export async function currentUser(): Promise<AuthUser | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email ?? null } : null;
}

/** Envia um código de 6 dígitos para o e-mail. */
export async function requestEmailCode(email: string, displayName: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Backend não configurado.' };
  const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, data: { display_name: displayName } } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function verifyEmailCode(email: string, code: string): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Backend não configurado.' };
  const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
  if (error || !data.user) return { ok: false, error: error?.message ?? 'Código inválido.' };
  return { ok: true, user: { id: data.user.id, email: data.user.email ?? null } };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}
