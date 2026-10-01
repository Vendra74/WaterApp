import { buildNotificationPlan, reconcile, isOwnedIdentifier, isPlanManagedIdentifier } from '../notifications/planner';
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

  it('repete o lembrete de medicamento enquanto não confirmado e para ao confirmar', () => {
    const m = makeMedication({ times: ['08:00'] });
    const [occ] = materializeOccurrences(m, [], NOW, 1, NOW);
    const withRepeat = { ...settings, medicationRepeatMinutes: 10, medicationRepeatCount: 2 };
    const plan = buildNotificationPlan({ now: NOW, hydrationSlots: [], medications: [m], occurrences: [occ!], settings: withRepeat, preferredName: '' });
    expect(plan.map((p) => new Date(p.fireAt).getMinutes())).toEqual([0, 10, 20]);
    expect(plan[1]!.title).toMatch(/não confirmado/i);
    const snoozed = snooze(occ!, new Date(2026, 8, 29, 8, 1), 15);
    const afterSnooze = buildNotificationPlan({ now: new Date(2026, 8, 29, 8, 1), hydrationSlots: [], medications: [m], occurrences: [snoozed], settings: withRepeat, preferredName: '' });
    expect(afterSnooze).toHaveLength(1); // adiada: só o novo aviso, sem repetições
  });

  it('mantém as repetições futuras de uma dose cujo horário já passou sem confirmação', () => {
    const m = makeMedication({ times: ['08:00'] });
    const [occ] = materializeOccurrences(m, [], NOW, 1, NOW);
    const withRepeat = { ...settings, medicationRepeatMinutes: 10, medicationRepeatCount: 2 };
    // App aberto às 08:05, dose das 08:00 ainda "agendada": o aviso original já passou,
    // mas os "ainda não confirmado" de 08:10 e 08:20 continuam agendados.
    const at805 = new Date(2026, 8, 29, 8, 5);
    const plan = buildNotificationPlan({ now: at805, hydrationSlots: [], medications: [m], occurrences: [occ!], settings: withRepeat, preferredName: '' });
    expect(plan.map((p) => new Date(p.fireAt).getMinutes())).toEqual([10, 20]);
    expect(plan.every((p) => /não confirmado/i.test(p.title))).toBe(true);
    // Às 08:25 nada resta a agendar para essa dose.
    const late = buildNotificationPlan({ now: new Date(2026, 8, 29, 8, 25), hydrationSlots: [], medications: [m], occurrences: [occ!], settings: withRepeat, preferredName: '' });
    expect(late).toHaveLength(0);
  });

  it('reconciliação só agenda/cancela a diferença e não toca identificadores de terceiros', () => {
    const slots = generateHydrationSlots({ settings, naps: [], now: NOW, days: 1 });
    const plan = buildNotificationPlan({ now: NOW, hydrationSlots: slots, medications: [], occurrences: [], settings, preferredName: '' });
    const existing = [plan[0]!.identifier, plan[1]!.identifier, 'hyd@obsoleto@x', 'snooze@hyd@123', 'test@1', 'other-app-id'].map((identifier) => ({ identifier }));
    const r = reconcile(existing, plan);
    expect(r.toCancel).toEqual(['hyd@obsoleto@x']); // avisos únicos e testes não são cancelados pela reconciliação
    expect(isOwnedIdentifier('snooze@hyd@123')).toBe(true);
    expect(isPlanManagedIdentifier('snooze@hyd@123')).toBe(false);
    expect(r.toSchedule).toHaveLength(plan.length - 2);
    expect(r.unchanged).toBe(2);
    expect(isOwnedIdentifier('other-app-id')).toBe(false);
  });

  it('reagenda o que aponta para canal diferente do planejado (migração de canais)', () => {
    const slots = generateHydrationSlots({ settings, naps: [], now: NOW, days: 1 });
    const plan = buildNotificationPlan({ now: NOW, hydrationSlots: slots, medications: [], occurrences: [], settings, preferredName: 'Maria' });
    expect(plan.length).toBeGreaterThan(2);
    const at = (i: number) => {
      const p = plan[i];
      if (!p) throw new Error(`plano sem posição ${i}`);
      return p;
    };
    const [a, b, c] = [at(0), at(1), at(2)];
    const existing = [
      { identifier: a.identifier, channelId: 'hydration' }, // canal antigo, apagado
      { identifier: b.identifier, channelId: b.channelId }, // correto
      { identifier: c.identifier }, // sem canal (iOS): mantido
      { identifier: 'test@1', channelId: 'hydration' }, // aviso único: fora da reconciliação
    ];
    const r = reconcile(existing, plan);
    expect(r.toCancel).toEqual([a.identifier]);
    expect(r.toSchedule.map((p) => p.identifier)).toEqual([a.identifier, ...plan.slice(3).map((p) => p.identifier)]);
    expect(r.unchanged).toBe(2);
  });
});
