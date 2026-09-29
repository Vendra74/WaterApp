import type { DB } from '../db';
import type { HydrationLog } from '@/domain/types';
import { newId } from '@/domain/ids';

interface Row {
  id: string;
  at: string;
  volume_ml: number;
  beverage: string;
  container_label: string | null;
  source: string;
  note: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: Row): HydrationLog => ({
  id: r.id,
  at: r.at,
  volumeMl: r.volume_ml,
  beverage: r.beverage as HydrationLog['beverage'],
  containerLabel: r.container_label,
  source: r.source as HydrationLog['source'],
  note: r.note,
  deletedAt: r.deleted_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function listLogsBetween(db: DB, fromISO: string, toISO: string): Promise<HydrationLog[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM hydration_logs WHERE at >= ? AND at < ? ORDER BY at DESC', fromISO, toISO);
  return rows.map(fromRow);
}

export async function listAllLogs(db: DB): Promise<HydrationLog[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM hydration_logs ORDER BY at DESC');
  return rows.map(fromRow);
}

export async function insertLog(db: DB, log: HydrationLog): Promise<void> {
  await db.runAsync(
    `INSERT INTO hydration_logs(id, at, volume_ml, beverage, container_label, source, note, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    log.id, log.at, log.volumeMl, log.beverage, log.containerLabel, log.source, log.note, log.deletedAt, log.createdAt, log.updatedAt,
  );
  await enqueue(db, 'hydration_log', log.id, 'upsert', log);
}

export async function updateLog(db: DB, log: HydrationLog, change: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE hydration_logs SET at = ?, volume_ml = ?, beverage = ?, container_label = ?, note = ?, deleted_at = ?, updated_at = ? WHERE id = ?`,
      log.at, log.volumeMl, log.beverage, log.containerLabel, log.note, log.deletedAt, log.updatedAt, log.id,
    );
    await db.runAsync('INSERT INTO hydration_log_history(id, log_id, at, change) VALUES (?, ?, ?, ?)', newId('h-'), log.id, new Date().toISOString(), change);
    await enqueue(db, 'hydration_log', log.id, 'upsert', log);
  });
}

export async function logHistory(db: DB, logId: string): Promise<{ at: string; change: string }[]> {
  return db.getAllAsync<{ at: string; change: string }>('SELECT at, change FROM hydration_log_history WHERE log_id = ? ORDER BY at', logId);
}

export async function enqueue(db: DB, entity: string, entityId: string, op: string, payload: unknown): Promise<void> {
  await db.runAsync(
    'INSERT INTO sync_outbox(entity, entity_id, op, payload, created_at) VALUES (?, ?, ?, ?, ?)',
    entity, entityId, op, JSON.stringify(payload), new Date().toISOString(),
  );
}
