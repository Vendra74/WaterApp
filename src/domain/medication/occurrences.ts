import type { Medication, MedicationOccurrence, OccurrenceStatus } from '../types';
import { addDays, atLocalTime, iso, parseISODate, startOfLocalDay, toISODate, weekdayOf } from '../time/time';

export function occurrenceId(medicationId: string, plannedAt: Date): string {
  return `${medicationId}@${plannedAt.toISOString()}`;
}

/**
 * Horários planejados de um medicamento em uma faixa de dias, conforme a prescrição cadastrada.
 * Não infere nem ajusta doses: apenas materializa o que foi cadastrado.
 * Independente da pausa noturna da hidratação (medicamentos noturnos continuam).
 */
export function plannedTimesFor(med: Medication, from: Date, days: number): Date[] {
  if (!med.active) return [];
  const result: Date[] = [];
  const start = med.startDate ? parseISODate(med.startDate) : null;
  const end = med.endDate ? parseISODate(med.endDate) : null;

  for (let d = 0; d < days; d++) {
    const day = addDays(startOfLocalDay(from), d);
    if (start && day.getTime() < start.getTime()) continue;
    if (end && day.getTime() > end.getTime()) continue;
    if (med.weekdays.length > 0 && !med.weekdays.includes(weekdayOf(day))) continue;

    if (med.scheduleType === 'fixed_times') {
      for (const t of med.times) result.push(atLocalTime(day, t));
    } else if (med.intervalHours && med.intervalHours > 0 && med.intervalAnchor) {
      const anchor = atLocalTime(day, med.intervalAnchor);
      const endOfDay = atLocalTime(addDays(day, 1), '00:00').getTime();
      for (let t = anchor.getTime(); t < endOfDay; t += med.intervalHours * 3_600_000) {
        result.push(new Date(t));
      }
    }
  }
  result.sort((a, b) => a.getTime() - b.getTime());
  return result.filter((t, i) => i === 0 || t.getTime() !== result[i - 1]!.getTime());
}

/**
 * Materializa ocorrências para um medicamento, preservando as já existentes (com status).
 * Ocorrências passadas ainda "agendadas" sem confirmação viram "sem confirmação" após tolerância.
 */
export function materializeOccurrences(
  med: Medication,
  existing: MedicationOccurrence[],
  from: Date,
  days: number,
  now: Date,
  unconfirmedAfterMinutes = 120,
): MedicationOccurrence[] {
  const byId = new Map(existing.map((o) => [o.id, o]));
  const planned = plannedTimesFor(med, from, days);
  const out: MedicationOccurrence[] = [];
  for (const at of planned) {
    const id = occurrenceId(med.id, at);
    const current = byId.get(id);
    if (current) {
      out.push(markUnconfirmedIfLate(current, now, unconfirmedAfterMinutes));
    } else {
      out.push({
        id,
        medicationId: med.id,
        plannedAt: iso(at),
        status: 'scheduled',
        takenAt: null,
        snoozedUntil: null,
        note: '',
        history: [{ at: iso(now), from: null, to: 'scheduled', reason: 'planejada' }],
        updatedAt: iso(now),
      });
    }
  }
  return out;
}

export function markUnconfirmedIfLate(
  occ: MedicationOccurrence,
  now: Date,
  toleranceMinutes: number,
): MedicationOccurrence {
  if (occ.status !== 'scheduled' && occ.status !== 'snoozed') return occ;
  const reference = occ.status === 'snoozed' && occ.snoozedUntil ? new Date(occ.snoozedUntil) : new Date(occ.plannedAt);
  if (now.getTime() - reference.getTime() > toleranceMinutes * 60_000) {
    return transition(occ, 'unconfirmed', now, 'sem confirmação após o horário');
  }
  return occ;
}

export function transition(
  occ: MedicationOccurrence,
  to: OccurrenceStatus,
  now: Date,
  reason: string,
  extra: Partial<Pick<MedicationOccurrence, 'takenAt' | 'snoozedUntil' | 'note'>> = {},
): MedicationOccurrence {
  return {
    ...occ,
    ...extra,
    status: to,
    history: [...occ.history, { at: iso(now), from: occ.status, to, reason }],
    updatedAt: iso(now),
  };
}

/** Confirmar como tomada. Idempotente: se já confirmada, retorna igual e sinaliza. */
export function confirmTaken(occ: MedicationOccurrence, now: Date): { occ: MedicationOccurrence; alreadyConfirmed: boolean } {
  if (occ.status === 'taken') return { occ, alreadyConfirmed: true };
  return {
    occ: transition(occ, 'taken', now, 'confirmada pelo usuário', { takenAt: iso(now), snoozedUntil: null }),
    alreadyConfirmed: false,
  };
}

/**
 * Adiar: afeta apenas esta ocorrência (novo horário de aviso). Não altera a prescrição
 * nem as próximas ocorrências, e não orienta compensação de dose.
 */
export function snooze(occ: MedicationOccurrence, now: Date, minutes: number): MedicationOccurrence {
  if (occ.status === 'taken') return occ;
  const until = new Date(now.getTime() + minutes * 60_000);
  return transition(occ, 'snoozed', now, `adiada ${minutes} min`, { snoozedUntil: iso(until) });
}

export function markNotTaken(occ: MedicationOccurrence, now: Date, note = ''): MedicationOccurrence {
  return transition(occ, 'not_taken', now, 'informada como não tomada', { note, snoozedUntil: null });
}

/** Correção manual mantendo histórico. */
export function correctStatus(occ: MedicationOccurrence, to: OccurrenceStatus, now: Date, note: string): MedicationOccurrence {
  return transition(occ, to, now, `correção manual: ${note}`, {
    note,
    takenAt: to === 'taken' ? occ.takenAt ?? iso(now) : null,
  });
}

export const OCCURRENCE_STATUS_PT: Record<OccurrenceStatus, string> = {
  scheduled: 'Agendada',
  taken: 'Tomada',
  snoozed: 'Adiada',
  unconfirmed: 'Sem confirmação',
  not_taken: 'Não tomada',
};

export function occurrencesForDay(occs: MedicationOccurrence[], day: Date): MedicationOccurrence[] {
  const key = toISODate(day);
  return occs.filter((o) => toISODate(new Date(o.plannedAt)) === key);
}
