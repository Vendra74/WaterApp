import type { MedicationOccurrence } from '../types';

/**
 * Regras do aviso "sem confirmação" ao cuidador. O aviso descreve apenas a ausência de registro
 * no aplicativo: nunca afirma que a pessoa não bebeu ou não tomou a dose.
 */

/** Doses "sem confirmação" mais antigas que isso não geram aviso novo. */
export const MEDICATION_ALERT_WINDOW_HOURS = 24;

/** O que já foi avisado neste aparelho, para não repetir o mesmo aviso a cada abertura do app. */
export interface CaregiverAlertState {
  /** Horário do último lembrete de água que já gerou aviso. */
  hydrationFiredAt: string | null;
  /** Ocorrências de medicamento que já geraram aviso. */
  medicationOccurrenceIds: string[];
}

export const EMPTY_ALERT_STATE: CaregiverAlertState = { hydrationFiredAt: null, medicationOccurrenceIds: [] };

export interface ReminderResponseRow {
  ref: string;
  at: string;
  action: string;
}

/**
 * Conta lembretes de água seguidos (dos mais recentes para trás) sem registro de água depois deles.
 * `rows` vem do mais recente para o mais antigo. O mesmo lembrete registrado duas vezes conta uma vez.
 */
export function consecutiveUnconfirmed(rows: ReminderResponseRow[]): { count: number; latestFiredAt: string | null } {
  const seen = new Set<string>();
  let latestFiredAt: string | null = null;
  for (const r of rows) {
    if (r.action === 'logged') break;
    if (r.action !== 'fired' || seen.has(r.ref)) continue;
    seen.add(r.ref);
    latestFiredAt ??= r.at;
  }
  return { count: seen.size, latestFiredAt };
}

/** Avisa a cada múltiplo do limite, uma única vez por lembrete. */
export function hydrationAlertDue(count: number, threshold: number, latestFiredAt: string | null, state: CaregiverAlertState): boolean {
  if (threshold <= 0 || count < threshold || count % threshold !== 0) return false;
  return latestFiredAt !== null && latestFiredAt !== state.hydrationFiredAt;
}

function inAlertWindow(occ: MedicationOccurrence, now: Date): boolean {
  const age = now.getTime() - new Date(occ.plannedAt).getTime();
  return age >= 0 && age <= MEDICATION_ALERT_WINDOW_HOURS * 3_600_000;
}

/** Doses recentes "sem confirmação" que ainda não geraram aviso. */
export function medicationAlertCandidates(occs: MedicationOccurrence[], state: CaregiverAlertState, now: Date): MedicationOccurrence[] {
  const alerted = new Set(state.medicationOccurrenceIds);
  return occs.filter((o) => o.status === 'unconfirmed' && inAlertWindow(o, now) && !alerted.has(o.id));
}

/** Após um envio confirmado: guarda só as doses ainda dentro da janela (o estado não cresce sem limite). */
export function markMedicationAlerted(occs: MedicationOccurrence[], state: CaregiverAlertState, now: Date): CaregiverAlertState {
  return {
    ...state,
    medicationOccurrenceIds: occs.filter((o) => o.status === 'unconfirmed' && inAlertWindow(o, now)).map((o) => o.id),
  };
}

export type UnconfirmedAlertKind = 'hydration_unconfirmed' | 'medication_unconfirmed';

export function unconfirmedAlertMessage(kind: UnconfirmedAlertKind, count: number): string {
  if (kind === 'hydration_unconfirmed') {
    const what = count === 1 ? '1 lembrete de água' : `${count} lembretes de água seguidos`;
    return `${what} sem confirmação no aplicativo. Isso não significa que a pessoa não bebeu: vale entrar em contato.`;
  }
  const what = count === 1 ? '1 dose de medicamento' : `${count} doses de medicamento`;
  return `${what} sem confirmação no aplicativo. Isso não significa que a dose não foi tomada: vale entrar em contato.`;
}
