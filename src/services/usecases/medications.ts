import { getDb } from '@/data/db';
import {
  deleteMedication as repoDelete,
  getOccurrence,
  listMedications,
  listOccurrencesBetween,
  listOccurrencesForMedication,
  pruneFutureScheduled,
  upsertMedication,
  upsertOccurrences,
} from '@/data/repositories/medications';
import { recordReminderResponse } from '@/data/repositories/misc';
import type { Medication, MedicationOccurrence, OccurrenceStatus } from '@/domain/types';
import { DOC_OCCURRENCES_QUEUED, getDocument, setDocument } from '@/data/repositories/documents';
import { changedOccurrences, confirmTaken, correctStatus, markNotTaken, materializeOccurrences, snooze } from '@/domain/medication/occurrences';
import { addDays, startOfLocalDay } from '@/domain/time/time';

/** Horizonte de materialização de ocorrências (dias). */
export const OCCURRENCE_HORIZON_DAYS = 14;
/** Tolerância até marcar "sem confirmação" (minutos). */
export const UNCONFIRMED_AFTER_MINUTES = 120;

export async function loadMedications(): Promise<Medication[]> {
  return listMedications(await getDb());
}

export async function saveMedication(med: Medication): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await upsertMedication(db, { ...med, updatedAt: now.toISOString() });
  const existing = await listOccurrencesForMedication(db, med.id);
  const occs = materializeOccurrences(med, existing, addDays(startOfLocalDay(now), -1), OCCURRENCE_HORIZON_DAYS + 1, now, UNCONFIRMED_AFTER_MINUTES);
  await upsertOccurrences(db, changedOccurrences(existing, occs), true);
  // Após edição da prescrição, horários futuros que deixaram de existir são removidos (histórico é preservado).
  await pruneFutureScheduled(db, med.id, occs.map((o) => o.id), now.toISOString());
}

export async function removeMedication(id: string): Promise<void> {
  await repoDelete(await getDb(), id);
}

/** Rematerializa ocorrências de todos os medicamentos ativos e marca atrasadas como "sem confirmação". */
export async function refreshOccurrences(now = new Date()): Promise<MedicationOccurrence[]> {
  const db = await getDb();
  const meds = await listMedications(db);
  // Versões anteriores não enviavam doses agendadas nem "sem confirmação": na primeira vez, envia todas.
  const queuedBefore = (await getDocument<boolean>(db, DOC_OCCURRENCES_QUEUED)) === true;
  const all: MedicationOccurrence[] = [];
  for (const med of meds) {
    const existing = await listOccurrencesForMedication(db, med.id);
    const occs = materializeOccurrences(med, existing, addDays(startOfLocalDay(now), -1), OCCURRENCE_HORIZON_DAYS + 1, now, UNCONFIRMED_AFTER_MINUTES);
    await upsertOccurrences(db, queuedBefore ? changedOccurrences(existing, occs) : occs, true);
    all.push(...occs);
    // Ocorrências antigas fora do horizonte permanecem no banco (histórico).
  }
  if (!queuedBefore) await setDocument(db, DOC_OCCURRENCES_QUEUED, true);
  return all;
}

export async function loadOccurrencesBetween(from: Date, to: Date): Promise<MedicationOccurrence[]> {
  return listOccurrencesBetween(await getDb(), from.toISOString(), to.toISOString());
}

export async function loadOccurrence(id: string): Promise<MedicationOccurrence | null> {
  return getOccurrence(await getDb(), id);
}

export async function confirmOccurrenceTaken(id: string): Promise<{ occ: MedicationOccurrence; alreadyConfirmed: boolean } | null> {
  const db = await getDb();
  const occ = await getOccurrence(db, id);
  if (!occ) return null;
  const result = confirmTaken(occ, new Date());
  if (!result.alreadyConfirmed) {
    await upsertOccurrences(db, [result.occ], true);
    await recordReminderResponse(db, 'medication', id, 'taken');
  }
  return result;
}

export async function snoozeOccurrence(id: string, minutes: number): Promise<MedicationOccurrence | null> {
  const db = await getDb();
  const occ = await getOccurrence(db, id);
  if (!occ) return null;
  const next = snooze(occ, new Date(), minutes);
  await upsertOccurrences(db, [next], true);
  await recordReminderResponse(db, 'medication', id, 'snoozed');
  return next;
}

export async function markOccurrenceNotTaken(id: string, note = ''): Promise<MedicationOccurrence | null> {
  const db = await getDb();
  const occ = await getOccurrence(db, id);
  if (!occ) return null;
  const next = markNotTaken(occ, new Date(), note);
  await upsertOccurrences(db, [next], true);
  await recordReminderResponse(db, 'medication', id, 'not_taken');
  return next;
}

export async function correctOccurrence(id: string, to: OccurrenceStatus, note: string, takenAt?: string): Promise<MedicationOccurrence | null> {
  const db = await getDb();
  const occ = await getOccurrence(db, id);
  if (!occ) return null;
  const next = correctStatus(occ, to, new Date(), note, takenAt);
  await upsertOccurrences(db, [next], true);
  return next;
}
