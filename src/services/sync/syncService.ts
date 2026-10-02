import * as Network from 'expo-network';
import { getDb } from '@/data/db';
import { countOutbox, failOutbox, listOutbox, removeOutbox, type OutboxItem } from '@/data/repositories/misc';
import { getSupabase } from './supabaseClient';
import type { HydrationLog, Medication, MedicationOccurrence } from '@/domain/types';

export interface SyncStatus {
  configured: boolean;
  signedIn: boolean;
  online: boolean;
  pending: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

let lastSyncAt: string | null = null;
let lastError: string | null = null;
let running = false;

export async function getSyncStatus(): Promise<SyncStatus> {
  const sb = getSupabase();
  const db = await getDb();
  const pending = await countOutbox(db);
  let signedIn = false;
  if (sb) {
    const { data } = await sb.auth.getSession();
    signedIn = !!data.session;
  }
  let online = false;
  try {
    const state = await Network.getNetworkStateAsync();
    online = !!state.isInternetReachable || !!state.isConnected;
  } catch {
    online = false;
  }
  return { configured: !!sb, signedIn, online, pending, lastSyncAt, lastError };
}

/** Envia a fila local para o servidor. Só roda com sessão ativa e rede; falhas ficam na fila. */
export async function pushOutbox(): Promise<SyncStatus> {
  if (running) return getSyncStatus();
  running = true;
  try {
    const sb = getSupabase();
    const status = await getSyncStatus();
    if (!sb || !status.signedIn || !status.online) return status;
    const { data: session } = await sb.auth.getSession();
    const uid = session.session!.user.id;
    const db = await getDb();
    const items = await listOutbox(db, 100);
    for (const item of items) {
      try {
        await pushItem(sb, uid, item);
        await removeOutbox(db, item.id);
      } catch (e) {
        await failOutbox(db, item.id, e instanceof Error ? e.message : String(e));
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
    lastSyncAt = new Date().toISOString();
    if (items.length > 0 && (await countOutbox(db)) === 0) lastError = null;
    return getSyncStatus();
  } finally {
    running = false;
  }
}

async function pushItem(sb: NonNullable<ReturnType<typeof getSupabase>>, uid: string, item: OutboxItem): Promise<void> {
  const payload = JSON.parse(item.payload) as unknown;
  switch (item.entity) {
    case 'profile': {
      const { error } = await sb.from('shared_profiles').upsert({ owner_id: uid, data: payload, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      return;
    }
    case 'hydration_log': {
      const l = payload as HydrationLog;
      const { error } = await sb.from('hydration_logs').upsert({
        id: l.id, owner_id: uid, at: l.at, volume_ml: l.volumeMl, beverage: l.beverage, source: l.source, deleted_at: l.deletedAt, updated_at: l.updatedAt, recorded_by: uid,
      });
      if (error) throw new Error(error.message);
      return;
    }
    case 'medication': {
      if (item.op === 'delete') {
        // As ocorrências do medicamento excluído também saem do servidor (como no aparelho).
        const occ = await sb.from('medication_occurrences').delete().eq('medication_id', item.entity_id).eq('owner_id', uid);
        if (occ.error) throw new Error(occ.error.message);
        const { error } = await sb.from('medications').delete().eq('id', item.entity_id).eq('owner_id', uid);
        if (error) throw new Error(error.message);
        return;
      }
      const m = payload as Medication;
      const { error } = await sb.from('medications').upsert({ id: m.id, owner_id: uid, data: m, updated_at: m.updatedAt });
      if (error) throw new Error(error.message);
      return;
    }
    case 'medication_occurrence': {
      if (item.op === 'delete') {
        const { error } = await sb.from('medication_occurrences').delete().eq('id', item.entity_id).eq('owner_id', uid);
        if (error) throw new Error(error.message);
        return;
      }
      const o = payload as MedicationOccurrence;
      const { error } = await sb.from('medication_occurrences').upsert({
        id: o.id, owner_id: uid, medication_id: o.medicationId, planned_at: o.plannedAt, status: o.status, taken_at: o.takenAt, snoozed_until: o.snoozedUntil, history: o.history, updated_at: o.updatedAt, recorded_by: uid,
      });
      if (error) throw new Error(error.message);
      return;
    }
    default:
      return; // entidade desconhecida: descarta
  }
}
