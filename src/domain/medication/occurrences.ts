import type { ISODateTime, Medication, MedicationOccurrence, OccurrenceStatus } from '../types';
import { addDays, atLocalTime, iso, parseISODate, startOfLocalDay, toISODate, weekdayOf } from '../time/time';
import { strings } from '@/i18n';

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
  // Sem data de início, nenhuma dose é esperada em dias anteriores ao cadastro (as de ontem
  // apareceriam como "sem confirmação" para um remédio recém-cadastrado). As doses do próprio dia
  // do cadastro continuam existindo, inclusive as já passadas: a pessoa pode ter tomado antes de
  // cadastrar e precisa poder registrar/corrigir.
  const notBefore = start ? null : startOfLocalDay(new Date(med.createdAt));

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
  return result.filter((t, i) => (!notBefore || t.getTime() >= notBefore.getTime()) && (i === 0 || t.getTime() !== result[i - 1]!.getTime()));
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
  const plannedIds = new Set<string>();
  for (const at of planned) {
    const id = occurrenceId(med.id, at);
    plannedIds.add(id);
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
        history: [{ at: iso(now), from: null, to: 'scheduled', reason: strings().occurrenceReason.planned }],
        updatedAt: iso(now),
      });
    }
  }
  // Ocorrências já existentes que a prescrição atual não prevê mais (edição, ou criadas por uma
  // versão anterior) permanecem como histórico e continuam sujeitas a "sem confirmação" se passadas.
  for (const o of existing) {
    if (plannedIds.has(o.id)) continue;
    if (new Date(o.plannedAt).getTime() > now.getTime()) continue;
    out.push(markUnconfirmedIfLate(o, now, unconfirmedAfterMinutes));
  }
  return out;
}

/**
 * Ocorrências novas ou alteradas em relação às já gravadas. Só essas precisam ser regravadas e
 * enviadas ao servidor (o cuidador vê as doses previstas e as que ficaram "sem confirmação").
 */
export function changedOccurrences(existing: MedicationOccurrence[], next: MedicationOccurrence[]): MedicationOccurrence[] {
  const byId = new Map(existing.map((o) => [o.id, o]));
  return next.filter((o) => {
    const prev = byId.get(o.id);
    return !prev || prev.status !== o.status || prev.updatedAt !== o.updatedAt;
  });
}

export function markUnconfirmedIfLate(
  occ: MedicationOccurrence,
  now: Date,
  toleranceMinutes: number,
): MedicationOccurrence {
  if (occ.status !== 'scheduled' && occ.status !== 'snoozed') return occ;
  const reference = occ.status === 'snoozed' && occ.snoozedUntil ? new Date(occ.snoozedUntil) : new Date(occ.plannedAt);
  if (now.getTime() - reference.getTime() > toleranceMinutes * 60_000) {
    return transition(occ, 'unconfirmed', now, strings().occurrenceReason.lateUnconfirmed);
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
    occ: transition(occ, 'taken', now, strings().occurrenceReason.confirmedByUser, { takenAt: iso(now), snoozedUntil: null }),
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
  return transition(occ, 'snoozed', now, strings().occurrenceReason.snoozed(minutes), { snoozedUntil: iso(until) });
}

export function markNotTaken(occ: MedicationOccurrence, now: Date, note = ''): MedicationOccurrence {
  return transition(occ, 'not_taken', now, strings().occurrenceReason.reportedNotTaken, { note, snoozedUntil: null });
}

/**
 * Correção manual mantendo histórico. Ao marcar como tomada, `takenAt` informa a hora real em que
 * a pessoa tomou (ex.: "tomei às 8h e esqueci de marcar"); sem ela, mantém a já registrada ou usa agora.
 */
export function correctStatus(occ: MedicationOccurrence, to: OccurrenceStatus, now: Date, note: string, takenAt?: ISODateTime): MedicationOccurrence {
  return transition(occ, to, now, strings().occurrenceReason.manualCorrection(note), {
    note,
    takenAt: to === 'taken' ? takenAt ?? occ.takenAt ?? iso(now) : null,
  });
}

/** Rótulo da situação de uma dose no idioma atual. */
export function occurrenceStatusLabel(status: OccurrenceStatus): string {
  return strings().occurrenceStatus[status];
}

export function occurrencesForDay(occs: MedicationOccurrence[], day: Date): MedicationOccurrence[] {
  const key = toISODate(day);
  return occs.filter((o) => toISODate(new Date(o.plannedAt)) === key);
}

const PENDING_STATUSES: readonly OccurrenceStatus[] = ['scheduled', 'snoozed', 'unconfirmed'];

/**
 * Doses pendentes (agendadas, adiadas ou sem confirmação) do dia local de `now`, em ordem de horário.
 * Doses de dias seguintes não entram: a tela "Hoje" mostra apenas o que ainda precisa de atenção hoje,
 * inclusive as já passadas sem confirmação, que ainda podem ser registradas.
 */
export function pendingOccurrencesToday(occs: MedicationOccurrence[], now: Date): MedicationOccurrence[] {
  return occurrencesForDay(occs, now)
    .filter((o) => PENDING_STATUSES.includes(o.status))
    .sort((a, b) => new Date(a.plannedAt).getTime() - new Date(b.plannedAt).getTime());
}
