import type { HHmm, Medication, MedicationScheduleType } from '../types';
import { isValidHHmm } from '../time/time';

/**
 * Rascunho de cadastro de medicamento lido de uma foto (receita ou caixa).
 *
 * O modelo de IA só TRANSCREVE o que está escrito; esta função normaliza e valida a resposta
 * antes de qualquer coisa chegar ao formulário. Regras:
 *  - nada é salvo automaticamente: o rascunho preenche o formulário e a pessoa confere cada campo;
 *  - campos que não estão na foto ficam vazios (nunca inventamos dose, horário ou unidade);
 *  - dias de uso, data de início/término e lembretes ativos não são preenchidos pela foto;
 *  - textos são cortados em tamanhos razoáveis para a interface.
 */
export interface PrescriptionDraft {
  name: string;
  presentation: string;
  doseAmount: string;
  doseUnit: string;
  route: string;
  scheduleType: MedicationScheduleType | null;
  times: HHmm[];
  intervalHours: number | null;
  instructions: string;
  /** O modelo conseguiu ler um medicamento na foto? */
  readable: boolean;
  /** Observações do modelo sobre o que não ficou claro (exibidas à pessoa). */
  notes: string;
}

export const KNOWN_ROUTES = ['oral', 'tópica', 'ocular', 'inalatória', 'injetável', 'outra'] as const;

const MAX_SHORT = 80;
const MAX_LONG = 300;

export function normalizePrescriptionDraft(raw: unknown): PrescriptionDraft {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const times = Array.isArray(r.times)
    ? [...new Set(r.times.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(isValidHHmm))].sort()
    : [];
  const intervalRaw = typeof r.intervalHours === 'number' ? Math.round(r.intervalHours) : typeof r.intervalHours === 'string' ? Number.parseInt(r.intervalHours, 10) : NaN;
  const intervalHours = Number.isInteger(intervalRaw) && intervalRaw >= 1 && intervalRaw <= 24 ? intervalRaw : null;
  const scheduleType: MedicationScheduleType | null = times.length > 0 ? 'fixed_times' : intervalHours ? 'interval_hours' : null;
  const name = text(r.name, MAX_SHORT);
  return {
    name,
    presentation: text(r.presentation, MAX_SHORT),
    doseAmount: text(r.doseAmount, 20),
    doseUnit: text(r.doseUnit, 30).toLowerCase(),
    route: normalizeRoute(text(r.route, 30)),
    scheduleType,
    times,
    intervalHours: scheduleType === 'interval_hours' ? intervalHours : null,
    instructions: text(r.instructions, MAX_LONG),
    readable: r.readable === true && name.length > 0,
    notes: text(r.notes, MAX_LONG),
  };
}

/** Aplica o rascunho ao cadastro em edição. Só substitui campos que a foto preencheu. */
export function applyPrescriptionDraft(med: Medication, draft: PrescriptionDraft): Medication {
  const next: Medication = { ...med };
  if (draft.name) next.name = draft.name;
  if (draft.presentation) next.presentation = draft.presentation;
  if (draft.doseAmount) next.doseAmount = draft.doseAmount;
  if (draft.doseUnit) next.doseUnit = draft.doseUnit;
  if (draft.route) next.route = draft.route;
  if (draft.instructions) next.instructions = draft.instructions;
  if (draft.scheduleType === 'fixed_times') {
    next.scheduleType = 'fixed_times';
    next.times = draft.times;
    next.intervalHours = null;
    next.intervalAnchor = null;
  } else if (draft.scheduleType === 'interval_hours' && draft.intervalHours) {
    next.scheduleType = 'interval_hours';
    next.intervalHours = draft.intervalHours;
    next.intervalAnchor = med.intervalAnchor ?? '08:00';
    next.times = [];
  }
  return next;
}

/** Campos preenchidos e campos que ficaram em branco, em pt-BR, para a pessoa conferir. */
export function describePrescriptionDraft(draft: PrescriptionDraft): { filled: string[]; missing: string[] } {
  const filled: string[] = [];
  const missing: string[] = [];
  const check = (ok: boolean, label: string) => (ok ? filled : missing).push(label);
  check(draft.name.length > 0, 'nome');
  check(draft.presentation.length > 0, 'apresentação');
  check(draft.doseAmount.length > 0 && draft.doseUnit.length > 0, 'dose');
  check(draft.scheduleType !== null, 'horários');
  check(draft.instructions.length > 0, 'instruções');
  return { filled, missing };
}

function text(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeRoute(v: string): string {
  const n = v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!n) return '';
  if (n.startsWith('oral') || n.includes('boca') || n.includes('via oral')) return 'oral';
  if (n.startsWith('top') || n.includes('pele')) return 'tópica';
  if (n.startsWith('ocul') || n.includes('olho') || n.includes('oftal')) return 'ocular';
  if (n.startsWith('inal') || n.includes('bombinha')) return 'inalatória';
  if (n.startsWith('injet') || n.includes('subcut') || n.includes('intramusc') || n.includes('intraven')) return 'injetável';
  return 'outra';
}
