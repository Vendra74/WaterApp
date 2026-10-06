import {
  applyHydrationSuggestion,
  applyMedicationSuggestion,
  computeReminderSuggestions,
  consistentShift,
  describeSuggestion,
  filterDismissed,
  median,
  suggestHydrationTimes,
  suggestHydrationWindowStart,
  suggestMedicationTimes,
  MEDICATION_TIME_THRESHOLDS,
} from '../adaptive/reminderSuggestions';
import type { HydrationLog, MedicationOccurrence } from '../types';
import { makeMedication, makeProfile, makeSettings, NOW } from './fixtures';

/** Registro de água num dia (0 = hoje) no horário local HH:mm. */
function logAt(daysAgo: number, hhmm: string, extra: Partial<HydrationLog> = {}): HydrationLog {
  const [h, m] = hhmm.split(':').map(Number);
  const at = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, h, m, 0, 0).toISOString();
  return { id: `l-${daysAgo}-${hhmm}`, at, volumeMl: 200, beverage: 'water', containerLabel: null, source: 'manual', note: '', deletedAt: null, createdAt: at, updatedAt: at, ...extra };
}

/** Dose planejada em `planned`, confirmada `offsetMin` minutos depois (negativo = antes). */
function takenOcc(medicationId: string, daysAgo: number, planned: string, offsetMin: number | null): MedicationOccurrence {
  const [h, m] = planned.split(':').map(Number);
  const plannedAt = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, h, m, 0, 0);
  const takenAt = offsetMin === null ? null : new Date(plannedAt.getTime() + offsetMin * 60_000).toISOString();
  return {
    id: `${medicationId}@${plannedAt.toISOString()}`,
    medicationId,
    plannedAt: plannedAt.toISOString(),
    status: offsetMin === null ? 'unconfirmed' : 'taken',
    takenAt,
    snoozedUntil: null,
    note: '',
    history: [],
    updatedAt: plannedAt.toISOString(),
  };
}

describe('estatística básica', () => {
  it('mediana ignora um dia atípico', () => {
    expect(median([30, 35, 40, 35, 240])).toBe(35);
    expect(median([10, 20])).toBe(15);
    expect(median([])).toBe(0);
  });

  it('exige amostras e dias suficientes, arredonda a 5 e limita ao máximo', () => {
    const th = MEDICATION_TIME_THRESHOLDS;
    const few = [1, 2, 3, 4].map((d) => ({ offset: 40, day: `d${d}` }));
    expect(consistentShift(few, th)).toBeNull();
    const sameDay = [1, 2, 3, 4, 5].map(() => ({ offset: 40, day: 'd1' }));
    expect(consistentShift(sameDay, th)).toBeNull();
    const ok = [1, 2, 3, 4, 5].map((d) => ({ offset: 42, day: `d${d}` }));
    expect(consistentShift(ok, th)).toBe(40);
    const small = [1, 2, 3, 4, 5].map((d) => ({ offset: 12, day: `d${d}` }));
    expect(consistentShift(small, th)).toBeNull();
    const huge = [1, 2, 3, 4, 5].map((d) => ({ offset: 110, day: `d${d}` }));
    expect(consistentShift(huge, th)).toBe(60);
    const early = [1, 2, 3, 4, 5].map((d) => ({ offset: -33, day: `d${d}` }));
    expect(consistentShift(early, th)).toBe(-35);
  });
});

describe('sugestão para lembretes de água em horários escolhidos', () => {
  const settings = makeSettings({ mode: 'times', times: ['10:00', '15:00'], windowStart: '08:00', windowEnd: '20:00', pauseDuringNaps: false });

  it('sugere o horário em que a pessoa realmente registra', () => {
    const logs = [1, 2, 3, 4, 5, 6].map((d) => logAt(d, '10:40'));
    const s = suggestHydrationTimes(settings, [], logs, NOW);
    expect(s).toEqual([expect.objectContaining({ kind: 'hydration_time', from: '10:00', to: '10:40', samples: 6, days: 6, key: 'hyd:10:00' })]);
  });

  it('não sugere quando a pessoa registra na hora do lembrete', () => {
    const logs = [1, 2, 3, 4, 5, 6].map((d) => logAt(d, '10:05', { source: 'notification' }));
    expect(suggestHydrationTimes(settings, [], logs, NOW)).toEqual([]);
  });

  it('não sugere com poucos dias de registro', () => {
    const logs = [1, 2, 3].map((d) => logAt(d, '10:40'));
    expect(suggestHydrationTimes(settings, [], logs, NOW)).toEqual([]);
  });

  it('ignora registros excluídos, antigos e de outro lembrete', () => {
    const logs = [
      ...[1, 2, 3, 4, 5].map((d) => logAt(d, '10:40', { deletedAt: NOW.toISOString() })),
      ...[20, 21, 22, 23, 24].map((d) => logAt(d, '10:40')),
      ...[1, 2, 3, 4, 5].map((d) => logAt(d, '13:00')), // mais perto das 15:00? não: 180 min de ambos, fora da janela
    ];
    expect(suggestHydrationTimes(settings, [], logs, NOW)).toEqual([]);
  });

  it('em cada dia só conta o registro mais próximo do lembrete', () => {
    // Dois registros por dia: um na hora e um 60 min depois. O mais próximo (na hora) manda.
    const logs = [1, 2, 3, 4, 5].flatMap((d) => [logAt(d, '10:00'), logAt(d, '11:00')]);
    expect(suggestHydrationTimes(settings, [], logs, NOW)).toEqual([]);
  });

  it('não propõe horário fora do período, em cochilo ou em cima de outro lembrete', () => {
    const late = makeSettings({ mode: 'times', times: ['19:30'], windowStart: '08:00', windowEnd: '20:00', pauseDuringNaps: false });
    expect(suggestHydrationTimes(late, [], [1, 2, 3, 4, 5].map((d) => logAt(d, '20:30')), NOW)).toEqual([]);

    const nap = makeSettings({ mode: 'times', times: ['12:30'], pauseDuringNaps: true });
    expect(suggestHydrationTimes(nap, [{ start: '13:00', end: '14:00' }], [1, 2, 3, 4, 5].map((d) => logAt(d, '13:15')), NOW)).toEqual([]);

    const close = makeSettings({ mode: 'times', times: ['10:00', '10:50'], pauseDuringNaps: false });
    // Registros às 10:25 (desvio +25 das 10:00) proporiam 10:25, a 25 min das 10:50: perto demais, não sugere.
    expect(suggestHydrationTimes(close, [], [1, 2, 3, 4, 5].map((d) => logAt(d, '10:25')), NOW)).toEqual([]);
  });
});

describe('sugestão para o início do período (modo intervalo)', () => {
  const settings = makeSettings({ mode: 'interval', intervalMinutes: 120, windowStart: '07:00', windowEnd: '20:00', pauseDuringNaps: false });

  it('sugere começar mais tarde quando o primeiro registro do dia é sempre depois', () => {
    const logs = [1, 2, 3, 4, 5, 6].flatMap((d) => [logAt(d, '08:40'), logAt(d, '11:00'), logAt(d, '15:00')]);
    const s = suggestHydrationWindowStart(settings, [], logs, NOW);
    expect(s).toEqual([expect.objectContaining({ kind: 'hydration_window_start', from: '07:00', to: '08:40', days: 6 })]);
    // Nunca mais de 2 horas de uma vez.
    const late = [1, 2, 3, 4, 5, 6].map((d) => logAt(d, '09:40'));
    expect(suggestHydrationWindowStart(settings, [], late, NOW)[0]?.to).toBe('09:00');
  });

  it('ignora o dia de hoje (ainda incompleto) e dias sem registro', () => {
    const logs = [0, 1, 2, 3, 4].map((d) => logAt(d, '09:10'));
    expect(suggestHydrationWindowStart(settings, [], logs, NOW)).toEqual([]);
  });

  it('não sugere em janelas que cruzam a meia-noite', () => {
    const night = makeSettings({ mode: 'interval', windowStart: '20:00', windowEnd: '02:00' });
    expect(suggestHydrationWindowStart(night, [], [1, 2, 3, 4, 5, 6].map((d) => logAt(d, '21:00')), NOW)).toEqual([]);
  });
});

describe('sugestão para medicamentos', () => {
  const med = makeMedication({ id: 'm1', times: ['08:00', '20:00'] });

  it('sugere quando a confirmação vem consistentemente depois do aviso', () => {
    const occs = [1, 2, 3, 4, 5].map((d) => takenOcc('m1', d, '08:00', 38));
    const s = suggestMedicationTimes(med, occs, NOW);
    expect(s).toEqual([expect.objectContaining({ kind: 'medication_time', medicationId: 'm1', medicationName: 'Losartana', from: '08:00', to: '08:40', samples: 5, days: 5 })]);
  });

  it('não ultrapassa 60 minutos e ignora confirmações muito distantes', () => {
    const occs = [1, 2, 3, 4, 5].map((d) => takenOcc('m1', d, '08:00', 95));
    expect(suggestMedicationTimes(med, occs, NOW)[0]?.to).toBe('09:00');
    const far = [1, 2, 3, 4, 5].map((d) => takenOcc('m1', d, '08:00', 300));
    expect(suggestMedicationTimes(med, far, NOW)).toEqual([]);
  });

  it('só usa doses confirmadas; sem confirmação não conta', () => {
    const occs = [1, 2, 3, 4, 5].map((d) => takenOcc('m1', d, '08:00', null));
    expect(suggestMedicationTimes(med, occs, NOW)).toEqual([]);
  });

  it('não sugere para intervalos em horas nem para medicamento inativo', () => {
    const occs = [1, 2, 3, 4, 5].map((d) => takenOcc('m1', d, '08:00', 40));
    expect(suggestMedicationTimes({ ...med, scheduleType: 'interval_hours', intervalHours: 8, intervalAnchor: '08:00' }, occs, NOW)).toEqual([]);
    expect(suggestMedicationTimes({ ...med, active: false }, occs, NOW)).toEqual([]);
  });

  it('não aproxima dois horários do mesmo remédio', () => {
    const twice = makeMedication({ id: 'm1', times: ['08:00', '08:45'] });
    const occs = [1, 2, 3, 4, 5].map((d) => takenOcc('m1', d, '08:00', 30));
    expect(suggestMedicationTimes(twice, occs, NOW)).toEqual([]);
  });
});

describe('conjunto, recusas e aplicação', () => {
  const profile = makeProfile();
  const settings = makeSettings({ mode: 'times', times: ['10:00'], pauseDuringNaps: false });
  const med = makeMedication({ id: 'm1', times: ['08:00'] });
  const logs = [1, 2, 3, 4, 5].map((d) => logAt(d, '10:30'));
  const occs = [1, 2, 3, 4, 5, 6].map((d) => takenOcc('m1', d, '08:00', 30));

  it('junta água e medicamentos, mais registros primeiro', () => {
    const all = computeReminderSuggestions({ settings, naps: profile.naps, logs, medications: [med], occurrences: occs, now: NOW });
    expect(all.map((s) => s.kind)).toEqual(['medication_time', 'hydration_time']);
  });

  it('pode ser desligado nas configurações', () => {
    const off = computeReminderSuggestions({ settings: { ...settings, suggestReminderAdjustments: false }, naps: [], logs, medications: [med], occurrences: occs, now: NOW });
    expect(off).toEqual([]);
  });

  it('uma sugestão recusada some por 14 dias e depois volta', () => {
    const all = computeReminderSuggestions({ settings, naps: [], logs, medications: [med], occurrences: occs, now: NOW });
    const dismissedAt = new Date(NOW.getTime() - 3 * 86_400_000).toISOString();
    const visible = filterDismissed(all, { 'med:m1:08:00': dismissedAt }, NOW);
    expect(visible.map((s) => s.key)).toEqual(['hyd:10:00']);
    const old = new Date(NOW.getTime() - 15 * 86_400_000).toISOString();
    expect(filterDismissed(all, { 'med:m1:08:00': old }, NOW)).toHaveLength(2);
  });

  it('aplicar troca só o horário sugerido e mantém o resto', () => {
    const [hyd] = suggestHydrationTimes(makeSettings({ mode: 'times', times: ['10:00', '16:00'], pauseDuringNaps: false }), [], logs, NOW);
    const next = applyHydrationSuggestion(makeSettings({ mode: 'times', times: ['16:00', '10:00'] }), hyd!);
    expect(next.times).toEqual(['10:30', '16:00']);

    const win = { kind: 'hydration_window_start', key: 'hydwin:start', from: '07:00', to: '08:30', samples: 5, days: 5 } as const;
    const w = applyHydrationSuggestion(makeSettings({ windowStart: '07:00', windowFollowsRoutine: true }), win);
    expect(w.windowStart).toBe('08:30');
    expect(w.windowFollowsRoutine).toBe(false);

    const [ms] = suggestMedicationTimes(med, occs, NOW);
    expect(applyMedicationSuggestion(med, ms!).times).toEqual(['08:30']);
    expect(applyMedicationSuggestion(makeMedication({ id: 'outro' }), ms!).times).toEqual(['08:00', '23:00']);
  });

  it('texto em pt-BR descreve o observado sem orientar dose', () => {
    const [ms] = suggestMedicationTimes(med, occs, NOW);
    const text = describeSuggestion(ms!);
    expect(text.title).toContain('Losartana');
    expect(text.body).toContain('08:30');
    expect(text.body).toContain('quem prescreveu');
    expect(text.accept).toBe('Mudar para 08:30');
    expect(text.reject).toBe('Manter 08:00');
  });
});
