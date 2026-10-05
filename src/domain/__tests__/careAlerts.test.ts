import {
  EMPTY_ALERT_STATE,
  consecutiveUnconfirmed,
  hydrationAlertDue,
  markMedicationAlerted,
  medicationAlertCandidates,
  unconfirmedAlertMessage,
} from '../care/alerts';
import { changedOccurrences, materializeOccurrences, markUnconfirmedIfLate } from '../medication/occurrences';
import type { MedicationOccurrence } from '../types';
import { makeMedication, NOW } from './fixtures';

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function occ(id: string, plannedAt: string, status: MedicationOccurrence['status']): MedicationOccurrence {
  return { id, medicationId: 'm1', plannedAt, status, takenAt: null, snoozedUntil: null, note: '', history: [], updatedAt: plannedAt };
}

describe('aviso ao cuidador: lembretes de água', () => {
  it('conta lembretes seguidos até o último registro de água, sem contar o mesmo lembrete duas vezes', () => {
    const rows = [
      { ref: 's3', at: hoursAgo(1), action: 'fired' },
      { ref: 's3', at: hoursAgo(1), action: 'fired' },
      { ref: 's2', at: hoursAgo(3), action: 'opened' },
      { ref: 's2', at: hoursAgo(3), action: 'fired' },
      { ref: 's1', at: hoursAgo(5), action: 'logged' },
      { ref: 's1', at: hoursAgo(5), action: 'fired' },
    ];
    expect(consecutiveUnconfirmed(rows)).toEqual({ count: 2, latestFiredAt: hoursAgo(1) });
    expect(consecutiveUnconfirmed([])).toEqual({ count: 0, latestFiredAt: null });
  });

  it('avisa ao atingir o limite e não repete o aviso para o mesmo lembrete', () => {
    const at = hoursAgo(1);
    expect(hydrationAlertDue(2, 0, at, EMPTY_ALERT_STATE)).toBe(false);
    expect(hydrationAlertDue(1, 2, at, EMPTY_ALERT_STATE)).toBe(false);
    expect(hydrationAlertDue(2, 2, at, EMPTY_ALERT_STATE)).toBe(true);
    expect(hydrationAlertDue(2, 2, at, { ...EMPTY_ALERT_STATE, hydrationFiredAt: at })).toBe(false);
    expect(hydrationAlertDue(3, 2, hoursAgo(0.5), { ...EMPTY_ALERT_STATE, hydrationFiredAt: at })).toBe(false);
    expect(hydrationAlertDue(4, 2, hoursAgo(0.2), { ...EMPTY_ALERT_STATE, hydrationFiredAt: at })).toBe(true);
  });
});

describe('aviso ao cuidador: doses de medicamento', () => {
  const occs = [
    occ('antiga', hoursAgo(30), 'unconfirmed'),
    occ('a', hoursAgo(5), 'unconfirmed'),
    occ('b', hoursAgo(3), 'unconfirmed'),
    occ('tomada', hoursAgo(4), 'taken'),
    occ('recente', hoursAgo(1), 'scheduled'),
  ];

  it('seleciona só doses sem confirmação das últimas 24 h ainda não avisadas', () => {
    expect(medicationAlertCandidates(occs, EMPTY_ALERT_STATE, NOW).map((o) => o.id)).toEqual(['a', 'b']);
    expect(medicationAlertCandidates(occs, { ...EMPTY_ALERT_STATE, medicationOccurrenceIds: ['a'] }, NOW).map((o) => o.id)).toEqual(['b']);
  });

  it('depois do envio não avisa de novo e esquece doses fora da janela', () => {
    const state = markMedicationAlerted(occs, { hydrationFiredAt: 'x', medicationOccurrenceIds: ['muito-antiga'] }, NOW);
    expect(state).toEqual({ hydrationFiredAt: 'x', medicationOccurrenceIds: ['a', 'b'] });
    expect(medicationAlertCandidates(occs, state, NOW)).toEqual([]);
  });

  it('a mensagem nunca afirma que a dose não foi tomada ou que a pessoa não bebeu', () => {
    expect(unconfirmedAlertMessage('medication_unconfirmed', 1)).toMatch(/^1 dose de medicamento sem confirmação no aplicativo\. Isso não significa/);
    expect(unconfirmedAlertMessage('medication_unconfirmed', 2)).toMatch(/^2 doses de medicamento sem confirmação/);
    expect(unconfirmedAlertMessage('hydration_unconfirmed', 3)).toMatch(/^3 lembretes de água seguidos sem confirmação no aplicativo\. Isso não significa/);
  });
});

describe('envio de ocorrências ao servidor', () => {
  it('só ocorrências novas ou alteradas entram na fila', () => {
    const med = makeMedication();
    const first = materializeOccurrences(med, [], NOW, 2, NOW);
    expect(changedOccurrences([], first)).toHaveLength(first.length);
    expect(changedOccurrences(first, materializeOccurrences(med, first, NOW, 2, NOW))).toEqual([]);
    const late = new Date(new Date(first[0]!.plannedAt).getTime() + 3 * 3_600_000);
    const next = first.map((o) => markUnconfirmedIfLate(o, late, 120));
    const changed = changedOccurrences(first, next);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.every((o) => o.status === 'unconfirmed')).toBe(true);
  });
});
