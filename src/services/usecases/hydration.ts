import { getDb } from '@/data/db';
import { insertLog, listAllLogs, listLogsBetween, logHistory, updateLog } from '@/data/repositories/hydration';
import { recordReminderResponse } from '@/data/repositories/misc';
import type { BeverageKind, HydrationLog } from '@/domain/types';
import { newId } from '@/domain/ids';
import { isValidVolume, looksLikeDuplicate } from '@/domain/hydration/logs';
import { addDays, startOfLocalDay } from '@/domain/time/time';
import { strings } from '@/i18n';

export interface AddLogInput {
  volumeMl: number;
  beverage?: BeverageKind;
  containerLabel?: string | null;
  source?: HydrationLog['source'];
  at?: Date;
  note?: string;
  /** Se true, ignora a verificação de duplicidade (usuário confirmou). */
  force?: boolean;
}

export type AddLogResult = { ok: true; log: HydrationLog } | { ok: false; reason: 'invalid_volume' | 'possible_duplicate' };

export async function addHydrationLog(input: AddLogInput): Promise<AddLogResult> {
  if (!isValidVolume(input.volumeMl)) return { ok: false, reason: 'invalid_volume' };
  const db = await getDb();
  const at = (input.at ?? new Date()).toISOString();
  const beverage = input.beverage ?? 'water';
  if (!input.force) {
    const recent = await listLogsBetween(db, new Date(Date.now() - 10 * 60_000).toISOString(), new Date(Date.now() + 60_000).toISOString());
    if (looksLikeDuplicate(recent, { at, volumeMl: input.volumeMl, beverage })) return { ok: false, reason: 'possible_duplicate' };
  }
  const now = new Date().toISOString();
  const log: HydrationLog = {
    id: newId('w-'),
    at,
    volumeMl: Math.round(input.volumeMl),
    beverage,
    containerLabel: input.containerLabel ?? null,
    source: input.source ?? 'manual',
    note: input.note ?? '',
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await insertLog(db, log);
  await recordReminderResponse(db, 'hydration', log.id, 'logged');
  return { ok: true, log };
}

export async function editHydrationLog(log: HydrationLog, changes: Partial<Pick<HydrationLog, 'volumeMl' | 'beverage' | 'at' | 'note'>>): Promise<HydrationLog> {
  const db = await getDb();
  const next: HydrationLog = { ...log, ...changes, updatedAt: new Date().toISOString() };
  await updateLog(db, next, `${strings().hydrationLogReason.edit}: ${JSON.stringify({ from: pick(log), to: pick(next) })}`);
  return next;
}

export async function undoHydrationLog(log: HydrationLog): Promise<HydrationLog> {
  const db = await getDb();
  const next: HydrationLog = { ...log, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await updateLog(db, next, strings().hydrationLogReason.undone);
  return next;
}

export async function restoreHydrationLog(log: HydrationLog): Promise<HydrationLog> {
  const db = await getDb();
  const next: HydrationLog = { ...log, deletedAt: null, updatedAt: new Date().toISOString() };
  await updateLog(db, next, strings().hydrationLogReason.restored);
  return next;
}

export async function loadLogsForDay(day: Date): Promise<HydrationLog[]> {
  const db = await getDb();
  const start = startOfLocalDay(day);
  return listLogsBetween(db, start.toISOString(), addDays(start, 1).toISOString());
}

export async function loadLogsLastDays(days: number): Promise<HydrationLog[]> {
  const db = await getDb();
  const start = addDays(startOfLocalDay(new Date()), -(days - 1));
  return listLogsBetween(db, start.toISOString(), addDays(startOfLocalDay(new Date()), 1).toISOString());
}

export async function loadAllLogs(): Promise<HydrationLog[]> {
  return listAllLogs(await getDb());
}

export async function loadLogHistory(logId: string) {
  return logHistory(await getDb(), logId);
}

const pick = (l: HydrationLog) => ({ at: l.at, volumeMl: l.volumeMl, beverage: l.beverage, note: l.note });
