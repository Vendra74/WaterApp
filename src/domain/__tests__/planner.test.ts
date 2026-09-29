import { buildNotificationPlan, reconcile, isOwnedIdentifier } from '../notifications/planner';
import { generateHydrationSlots } from '../hydration/schedule';
import { materializeOccurrences, snooze } from '../medication/occurrences';
import { makeMedication, makeSettings, NOW } from './fixtures';

describe('planejador de notificações', () => {
  const settings = makeSettings({ intervalMinutes: 60, windowStart: '08:00', windowEnd: '22:00', pauseDuringNaps: false });
  const med = makeMedication({ times: ['23:30'] }); // noturno, fora da janela de hidratação

  it('medicamento noturno é agendado mesmo com hidratação em pausa noturna', () => {
    const slots = generateHydrationSlots({ settings, naps: [], now: NOW, days: 1 });
    const occurrences = materializeOccurrences(med, [], NOW, 1, NOW);
    const plan = buildNotificationPlan({ now: NOW, hydrationSlots: slots, medications: [med], occurrences, settings, preferredName: 'Maria' });
    const medNotifs = plan.filter((p) => p.kind === 'medication');
    expect(medNotifs).toHaveLength(1);
    expect(new Date(medNotifs[0]!.fireAt).getHours()).toBe(23);
    expect(plan.filter((p) => p.kind === 'hydration').some((p) => new Date(p.fireAt).getHours() === 23)).toBe(false);
  });

  it('respeita o orçamento e prioriza medicamentos', () => {
    const slots = generateHydrationSlots({ settings, naps: [], now: NOW, days: 14 });
    const meds = [makeMedication({ id: 'a', times: ['08:00', '14:00', '20:00'] }), makeMedication({ id: 'b', times: ['09:00'] })];
    const occurrences = meds.flatMap((m) => materializeOccurrences(m, [], NOW, 14, NOW));
    const plan = buildNotificationPlan({ now: NOW, hydrationSlots: slots, medications: meds, occurrences, settings, preferredName: '', budget: 60 });
    expect(plan.length).toBeLessThanOrEqual(60);
    expect(plan.filter((p) => p.kind === 'medication').length).toBeGreaterThanOrEqual(42);
    expect(new Set(plan.map((p) => p.identifier)).size).toBe(plan.length);
  });

  it('esconde nome do medicamento por padrão e mostra quando o usuário optar', () => {
    const occurrences = materializeOccurrences(med, [], NOW, 1, NOW);
    const hidden = buildNotificationPlan({ now: NOW, hydrationSlots: [], medications: [med], occurrences, settings, preferredName: '' });
    expect(hidden[0]!.title).not.toContain('Losartana');
    const shown = buildNotificationPlan({ now: NOW, hydrationSlots: [], medications: [med], occurrences, settings: { showDetailsOnLockScreen: true }, preferredName: '' });
    expect(shown[0]!.title).toContain('Losartana');
    expect(shown[0]!.identifier).not.toBe(hidden[0]!.identifier);
  });

  it('ocorrência adiada é notificada no novo horário; confirmada não é notificada', () => {
    const m = makeMedication({ times: ['08:00'] });
    const [occ] = materializeOccurrences(m, [], NOW, 1, NOW);
    const at8 = new Date(2026, 8, 29, 8, 2);
    const snoozed = snooze(occ!, at8, 10);
    const plan = buildNotificationPlan({ now: at8, hydrationSlots: [], medications: [m], occurrences: [snoozed], settings, preferredName: '' });
    expect(plan).toHaveLength(1);
    expect(new Date(plan[0]!.fireAt).getTime()).toBe(at8.getTime() + 10 * 60_000);
  });

  it('reconciliação só agenda/cancela a diferença e não toca identificadores de terceiros', () => {
    const slots = generateHydrationSlots({ settings, naps: [], now: NOW, days: 1 });
    const plan = buildNotificationPlan({ now: NOW, hydrationSlots: slots, medications: [], occurrences: [], settings, preferredName: '' });
    const existing = [plan[0]!.identifier, plan[1]!.identifier, 'hyd@obsoleto@x', 'other-app-id'];
    const r = reconcile(existing, plan);
    expect(r.toCancel).toEqual(['hyd@obsoleto@x']);
    expect(r.toSchedule).toHaveLength(plan.length - 2);
    expect(r.unchanged).toBe(2);
    expect(isOwnedIdentifier('other-app-id')).toBe(false);
  });
});
