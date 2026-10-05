import { getSupabase } from './supabaseClient';
import type { CarePermission } from '@/domain/types';
import { unconfirmedAlertMessage, type UnconfirmedAlertKind } from '@/domain/care/alerts';

export interface RemoteCareLink {
  id: string;
  owner_id: string;
  caregiver_id: string | null;
  permission: CarePermission;
  status: 'pending' | 'active' | 'revoked';
  created_at: string;
  accepted_at: string | null;
  invite_expires_at: string | null;
}

export const CONSENT_TEXT =
  'Autorizo esta pessoa a ver meus registros de água e de medicamentos e a receber avisos de "sem confirmação". Posso revogar quando quiser em Compartilhamento.';

export async function createInvite(permission: CarePermission): Promise<{ ok: true; code: string; expiresAt: string } | { ok: false; error: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Backend não configurado.' };
  const { data, error } = await sb.rpc('create_care_invite', { p_permission: permission, p_consent_text: CONSENT_TEXT });
  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: 'Resposta vazia do servidor.' };
  return { ok: true, code: String(row.code), expiresAt: String(row.expires_at) };
}

export async function acceptInvite(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Backend não configurado.' };
  const { error } = await sb.rpc('accept_care_invite', { p_code: code });
  return error ? { ok: false, error: error.message.includes('invalid') ? 'Código inválido ou expirado.' : error.message } : { ok: true };
}

export async function listMyLinks(): Promise<RemoteCareLink[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.from('care_links').select('*').order('created_at', { ascending: false });
  return (data ?? []) as RemoteCareLink[];
}

export async function revokeLink(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Backend não configurado.' };
  const { error } = await sb.from('care_links').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', id);
  return { ok: !error, error: error?.message };
}

export async function changePermission(id: string, permission: CarePermission): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Backend não configurado.' };
  const { error } = await sb.from('care_links').update({ permission }).eq('id', id);
  return { ok: !error, error: error?.message };
}

export interface CaredPerson { owner_id: string; display_name: string; permission: CarePermission; link_id: string }

export async function listCaredPeople(): Promise<CaredPerson[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.rpc('my_cared_people');
  return (data ?? []) as CaredPerson[];
}

export interface CaredSummary {
  todayWaterMl: number;
  todayLogs: { at: string; volume_ml: number; beverage: string }[];
  occurrences: { id: string; medication_id: string; planned_at: string; status: string }[];
  alerts: { id: string; kind: string; message: string; created_at: string; acknowledged_at: string | null }[];
  medications: { id: string; name: string }[];
}

export async function fetchCaredSummary(ownerId: string, dayStartISO: string, dayEndISO: string): Promise<CaredSummary> {
  const sb = getSupabase();
  if (!sb) throw new Error('Backend não configurado.');
  const [logs, occ, alerts, meds] = await Promise.all([
    sb.from('hydration_logs').select('at, volume_ml, beverage').eq('owner_id', ownerId).is('deleted_at', null).gte('at', dayStartISO).lt('at', dayEndISO).order('at'),
    sb.from('medication_occurrences').select('id, medication_id, planned_at, status').eq('owner_id', ownerId).gte('planned_at', dayStartISO).lt('planned_at', dayEndISO).order('planned_at'),
    sb.from('care_alerts').select('id, kind, message, created_at, acknowledged_at').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(20),
    sb.from('medications').select('id, data').eq('owner_id', ownerId),
  ]);
  const todayLogs = (logs.data ?? []) as CaredSummary['todayLogs'];
  return {
    todayWaterMl: todayLogs.reduce((s, l) => s + l.volume_ml, 0),
    todayLogs,
    occurrences: (occ.data ?? []) as CaredSummary['occurrences'],
    alerts: (alerts.data ?? []) as CaredSummary['alerts'],
    medications: ((meds.data ?? []) as { id: string; data: { name?: string } }[]).map((m) => ({ id: m.id, name: m.data?.name ?? 'Medicamento' })),
  };
}

export async function acknowledgeAlert(id: string, userId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from('care_alerts').update({ acknowledged_at: new Date().toISOString(), acknowledged_by: userId }).eq('id', id);
}

/**
 * Registra um aviso "sem confirmação" para cuidadores ativos. A mensagem nunca afirma que a pessoa
 * não bebeu/não tomou. Retorna false se não houve envio confirmado (offline, sem vínculo, erro).
 */
export async function sendUnconfirmedAlert(kind: UnconfirmedAlertKind, count: number): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: session } = await sb.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return false;
  const { error } = await sb.from('care_alerts').insert({ owner_id: uid, kind, message: unconfirmedAlertMessage(kind, count) });
  return !error;
}

export async function sendHelpRequestedAlert(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: session } = await sb.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return false;
  const { error } = await sb.from('care_alerts').insert({ owner_id: uid, kind: 'help_requested', message: 'A pessoa tocou em "Preciso de ajuda" no aplicativo.' });
  return !error;
}

export async function deleteRemoteData(): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: true };
  const { error } = await sb.rpc('delete_my_data');
  return { ok: !error, error: error?.message };
}
