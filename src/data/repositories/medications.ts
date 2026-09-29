import type { DB } from '../db';
import type { Medication, MedicationOccurrence } from '@/domain/types';
import { enqueue } from './hydration';

interface MedRow {
  id: string; name: string; presentation: string; dose_amount: string; dose_unit: string; route: string;
  schedule_type: string; times: string; interval_hours: number | null; interval_anchor: string | null; weekdays: string;
  start_date: string | null; end_date: string | null; instructions: string; photo_uri: string | null; active: number;
  created_at: string; updated_at: string;
}

const medFromRow = (r: MedRow): Medication => ({
  id: r.id,
  name: r.name,
  presentation: r.presentation,
  doseAmount: r.dose_amount,
  doseUnit: r.dose_unit,
  route: r.route,
  scheduleType: r.schedule_type as Medication['scheduleType'],
  times: JSON.parse(r.times),
  intervalHours: r.interval_hours,
  intervalAnchor: r.interval_anchor,
  weekdays: JSON.parse(r.weekdays),
  startDate: r.start_date,
  endDate: r.end_date,
  instructions: r.instructions,
  photoUri: r.photo_uri,
  active: r.active === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function listMedications(db: DB): Promise<Medication[]> {
  const rows = await db.getAllAsync<MedRow>('SELECT * FROM medications ORDER BY name COLLATE NOCASE');
  return rows.map(medFromRow);
}

export async function upsertMedication(db: DB, m: Medication): Promise<void> {
  await db.runAsync(
    `INSERT INTO medications(id, name, presentation, dose_amount, dose_unit, route, schedule_type, times, interval_hours, interval_anchor, weekdays, start_date, end_date, instructions, photo_uri, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, presentation=excluded.presentation, dose_amount=excluded.dose_amount, dose_unit=excluded.dose_unit,
       route=excluded.route, schedule_type=excluded.schedule_type, times=excluded.times, interval_hours=excluded.interval_hours, interval_anchor=excluded.interval_anchor,
       weekdays=excluded.weekdays, start_date=excluded.start_date, end_date=excluded.end_date, instructions=excluded.instructions, photo_uri=excluded.photo_uri,
       active=excluded.active, updated_at=excluded.updated_at`,
    m.id, m.name, m.presentation, m.doseAmount, m.doseUnit, m.route, m.scheduleType, JSON.stringify(m.times), m.intervalHours, m.intervalAnchor,
    JSON.stringify(m.weekdays), m.startDate, m.endDate, m.instructions, m.photoUri, m.active ? 1 : 0, m.createdAt, m.updatedAt,
  );
  await enqueue(db, 'medication', m.id, 'upsert', { ...m, photoUri: null }); // fotos não são enviadas ao servidor
}

export async function deleteMedication(db: DB, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM medication_occurrences WHERE medication_id = ?', id);
    await db.runAsync('DELETE FROM medications WHERE id = ?', id);
    await enqueue(db, 'medication', id, 'delete', { id });
  });
}

interface OccRow {
  id: string; medication_id: string; planned_at: string; status: string; taken_at: string | null; snoozed_until: string | null;
  note: string; history: string; updated_at: string;
}

const occFromRow = (r: OccRow): MedicationOccurrence => ({
  id: r.id,
  medicationId: r.medication_id,
  plannedAt: r.planned_at,
  status: r.status as MedicationOccurrence['status'],
  takenAt: r.taken_at,
  snoozedUntil: r.snoozed_until,
  note: r.note,
  history: JSON.parse(r.history),
  updatedAt: r.updated_at,
});

export async function listOccurrencesBetween(db: DB, fromISO: string, toISO: string): Promise<MedicationOccurrence[]> {
  const rows = await db.getAllAsync<OccRow>('SELECT * FROM medication_occurrences WHERE planned_at >= ? AND planned_at < ? ORDER BY planned_at', fromISO, toISO);
  return rows.map(occFromRow);
}

export async function listOccurrencesForMedication(db: DB, medicationId: string): Promise<MedicationOccurrence[]> {
  const rows = await db.getAllAsync<OccRow>('SELECT * FROM medication_occurrences WHERE medication_id = ? ORDER BY planned_at', medicationId);
  return rows.map(occFromRow);
}

export async function getOccurrence(db: DB, id: string): Promise<MedicationOccurrence | null> {
  const row = await db.getFirstAsync<OccRow>('SELECT * FROM medication_occurrences WHERE id = ?', id);
  return row ? occFromRow(row) : null;
}

export async function upsertOccurrences(db: DB, occs: MedicationOccurrence[], sync = false): Promise<void> {
  if (occs.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const o of occs) {
      await db.runAsync(
        `INSERT INTO medication_occurrences(id, medication_id, planned_at, status, taken_at, snoozed_until, note, history, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status=excluded.status, taken_at=excluded.taken_at, snoozed_until=excluded.snoozed_until,
           note=excluded.note, history=excluded.history, updated_at=excluded.updated_at`,
        o.id, o.medicationId, o.plannedAt, o.status, o.takenAt, o.snoozedUntil, o.note, JSON.stringify(o.history), o.updatedAt,
      );
      if (sync) await enqueue(db, 'medication_occurrence', o.id, 'upsert', o);
    }
  });
}

/** Remove ocorrências futuras ainda agendadas que não existem mais na prescrição (após edição). */
export async function pruneFutureScheduled(db: DB, medicationId: string, keepIds: string[], nowISO: string): Promise<void> {
  const rows = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM medication_occurrences WHERE medication_id = ? AND planned_at > ? AND status IN ('scheduled','snoozed')",
    medicationId, nowISO,
  );
  const keep = new Set(keepIds);
  const toDelete = rows.map((r) => r.id).filter((id) => !keep.has(id));
  for (const id of toDelete) await db.runAsync('DELETE FROM medication_occurrences WHERE id = ?', id);
}
