import { getDb } from '@/data/db';
import { DOC_DISMISSED_SUGGESTIONS, getDocument, setDocument } from '@/data/repositories/documents';
import type { HydrationSettings, ISODateTime, Medication, Profile } from '@/domain/types';
import { addDays, startOfLocalDay } from '@/domain/time/time';
import {
  computeReminderSuggestions,
  filterDismissed,
  HYDRATION_WINDOW_THRESHOLDS,
  type ReminderSuggestion,
} from '@/domain/adaptive/reminderSuggestions';
import { loadLogsLastDays } from './hydration';
import { loadOccurrencesBetween } from './medications';

type Dismissed = Record<string, ISODateTime>;

/**
 * Sugestões de ajuste de horário calculadas só com os dados locais dos últimos dias.
 * Retorna as que a pessoa ainda não recusou recentemente.
 */
export async function loadReminderSuggestions(profile: Profile, settings: HydrationSettings, medications: Medication[], now = new Date()): Promise<ReminderSuggestion[]> {
  if (!settings.suggestReminderAdjustments) return [];
  const days = HYDRATION_WINDOW_THRESHOLDS.lookbackDays;
  const db = await getDb();
  const [logs, occurrences, dismissed] = await Promise.all([
    loadLogsLastDays(days + 1),
    loadOccurrencesBetween(addDays(startOfLocalDay(now), -(days + 1)), now),
    getDocument<Dismissed>(db, DOC_DISMISSED_SUGGESTIONS),
  ]);
  const all = computeReminderSuggestions({ settings, naps: profile.naps, logs, medications, occurrences, now });
  return filterDismissed(all, dismissed ?? {}, now);
}

/** Registra a recusa: a mesma sugestão fica escondida por um tempo. */
export async function dismissReminderSuggestion(key: string, now = new Date()): Promise<void> {
  const db = await getDb();
  const dismissed = (await getDocument<Dismissed>(db, DOC_DISMISSED_SUGGESTIONS)) ?? {};
  await setDocument(db, DOC_DISMISSED_SUGGESTIONS, { ...dismissed, [key]: now.toISOString() });
}
