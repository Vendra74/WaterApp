import { generateHydrationSlots, isDuringNap } from '../hydration/schedule';
import { looksLikeDuplicate, totalForDay, totalsByDay } from '../hydration/logs';
import { formatTimeBR } from '../time/time';
import { makeSettings, NOW } from './fixtures';

const times = (slots: { at: Date }[]) => slots.map((s) => formatTimeBR(s.at));

describe('lembretes de hidratação', () => {
  it('de hora em hora respeita a janela configurada e ignora o passado', () => {
    const slots = generateHydrationSlots({
      settings: makeSettings({ intervalMinutes: 60, windowStart: '08:00', windowEnd: '12:00', pauseDuringNaps: false }),
      naps: [],
      now: new Date(2026, 8, 29, 9, 30),
      days: 1,
    });
    expect(times(slots)).toEqual(['10:00', '11:00', '12:00']);
  });

  it('suporta 90 e 120 minutos', () => {
    const s90 = generateHydrationSlots({ settings: makeSettings({ intervalMinutes: 90, windowEnd: '14:00', pauseDuringNaps: false }), naps: [], now: NOW, days: 1 });
    expect(times(s90)).toEqual(['08:00', '09:30', '11:00', '12:30', '14:00']);
    const s120 = generateHydrationSlots({ settings: makeSettings({ intervalMinutes: 120, windowEnd: '14:00', pauseDuringNaps: false }), naps: [], now: NOW, days: 1 });
    expect(times(s120)).toEqual(['08:00', '10:00', '12:00', '14:00']);
  });

  it('pausa para cochilo remove lembretes dentro do cochilo', () => {
    const slots = generateHydrationSlots({
      settings: makeSettings({ intervalMinutes: 60, windowEnd: '16:00' }),
      naps: [{ start: '13:00', end: '14:30' }],
      now: NOW,
      days: 1,
    });
    expect(times(slots)).not.toContain('13:00');
    expect(times(slots)).not.toContain('14:00');
    expect(times(slots)).toContain('15:00');
    expect(isDuringNap(new Date(2026, 8, 29, 13, 30), [{ start: '13:00', end: '14:30' }])).toBe(true);
  });

  it('respeita dias da semana', () => {
    // NOW é terça (2). Apenas quarta (3) habilitada → nada hoje, lembretes amanhã.
    const slots = generateHydrationSlots({ settings: makeSettings({ weekdays: [3], intervalMinutes: 120, pauseDuringNaps: false }), naps: [], now: NOW, days: 2 });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.at.getDay() === 3)).toBe(true);
  });

  it('horários específicos dentro da janela', () => {
    const slots = generateHydrationSlots({
      settings: makeSettings({ mode: 'times', times: ['07:00', '09:15', '15:00', '21:00'], windowStart: '08:00', windowEnd: '20:00', pauseDuringNaps: false }),
      naps: [],
      now: NOW,
      days: 1,
    });
    expect(times(slots)).toEqual(['09:15', '15:00']);
  });

  it('janela que cruza a meia-noite', () => {
    const slots = generateHydrationSlots({
      settings: makeSettings({ intervalMinutes: 120, windowStart: '22:00', windowEnd: '02:00', pauseDuringNaps: false }),
      naps: [],
      now: new Date(2026, 8, 29, 21, 0),
      days: 1,
    });
    expect(times(slots)).toEqual(['22:00', '00:00', '02:00']);
    expect(slots[1]!.at.getDate()).toBe(30);
  });

  it('desativado não gera nada', () => {
    expect(generateHydrationSlots({ settings: makeSettings({ enabled: false }), naps: [], now: NOW, days: 3 })).toEqual([]);
  });
});

describe('registros de hidratação', () => {
  const base = { beverage: 'water' as const, containerLabel: 'Copo', source: 'manual' as const, note: '', deletedAt: null, createdAt: '', updatedAt: '' };
  it('total do dia ignora excluídos e outros dias', () => {
    const logs = [
      { ...base, id: '1', at: new Date(2026, 8, 29, 8).toISOString(), volumeMl: 200 },
      { ...base, id: '2', at: new Date(2026, 8, 29, 9).toISOString(), volumeMl: 250, deletedAt: 'x' },
      { ...base, id: '3', at: new Date(2026, 8, 28, 9).toISOString(), volumeMl: 300 },
    ];
    expect(totalForDay(logs, new Date(2026, 8, 29))).toBe(200);
    expect(totalsByDay(logs).map((d) => d.totalMl)).toEqual([300, 200]);
  });

  it('detecta duplicidade acidental em janela curta', () => {
    const at = new Date(2026, 8, 29, 8, 0, 0).toISOString();
    const logs = [{ ...base, id: '1', at, volumeMl: 200 }];
    expect(looksLikeDuplicate(logs, { at: new Date(2026, 8, 29, 8, 0, 30).toISOString(), volumeMl: 200, beverage: 'water' })).toBe(true);
    expect(looksLikeDuplicate(logs, { at: new Date(2026, 8, 29, 8, 5, 0).toISOString(), volumeMl: 200, beverage: 'water' })).toBe(false);
  });
});
