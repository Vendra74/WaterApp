import type { DB } from '../db';
import type { EmergencyContact } from '@/domain/types';
import { newId } from '@/domain/ids';
import { consecutiveUnconfirmed, type ReminderResponseRow } from '@/domain/care/alerts';

export async function listContacts(db: DB): Promise<EmergencyContact[]> {
  return db.getAllAsync<EmergencyContact>('SELECT id, name, phone, relationship FROM emergency_contacts ORDER BY name');
}
export async function upsertContact(db: DB, c: EmergencyContact): Promise<void> {
  await db.runAsync(
    'INSERT INTO emergency_contacts(id, name, phone, relationship) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone, relationship=excluded.relationship',
    c.id, c.name, c.phone, c.relationship,
  );
}
export async function deleteContact(db: DB, id: string): Promise<void> {
  await db.runAsync('DELETE FROM emergency_contacts WHERE id = ?', id);
}

export type ReminderAction = 'fired' | 'logged' | 'snoozed' | 'help' | 'taken' | 'not_taken' | 'opened' | 'dismissed';

export async function recordReminderResponse(db: DB, kind: 'hydration' | 'medication', ref: string, action: ReminderAction): Promise<void> {
  await db.runAsync('INSERT INTO reminder_responses(id, kind, ref, at, action) VALUES (?, ?, ?, ?, ?)', newId('r-'), kind, ref, new Date().toISOString(), action);
}

/**
 * Conta lembretes de hidratação consecutivos (mais recentes) sem confirmação.
 * "Confirmação" = registro de água após o lembrete. Serve apenas para o aviso "sem confirmação" ao cuidador.
 */
export async function consecutiveUnconfirmedHydration(db: DB, sinceISO: string): Promise<{ count: number; latestFiredAt: string | null }> {
  const rows = await db.getAllAsync<ReminderResponseRow>(
    "SELECT ref, at, action FROM reminder_responses WHERE kind = 'hydration' AND at >= ? ORDER BY at DESC",
    sinceISO,
  );
  return consecutiveUnconfirmed(rows);
}

export interface OutboxItem { id: number; entity: string; entity_id: string; op: string; payload: string; attempts: number; last_error: string | null }

export async function listOutbox(db: DB, limit = 50): Promise<OutboxItem[]> {
  return db.getAllAsync<OutboxItem>('SELECT * FROM sync_outbox ORDER BY id LIMIT ?', limit);
}
export async function countOutbox(db: DB): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM sync_outbox');
  return r?.n ?? 0;
}
export async function removeOutbox(db: DB, id: number): Promise<void> {
  await db.runAsync('DELETE FROM sync_outbox WHERE id = ?', id);
}
export async function failOutbox(db: DB, id: number, error: string): Promise<void> {
  await db.runAsync('UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?', error.slice(0, 500), id);
}
export async function clearOutbox(db: DB): Promise<void> {
  await db.runAsync('DELETE FROM sync_outbox');
}
