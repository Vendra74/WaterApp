import { confirmTaken, materializeOccurrences, occurrenceId, pendingOccurrencesToday, plannedTimesFor, snooze, markUnconfirmedIfLate, correctStatus, markNotTaken, staleOccurrencesAfterEdit } from '../medication/occurrences';
import { addDays, formatTimeBR, toISODate } from '../time/time';
import { makeMedication, NOW } from './fixtures';

describe('ocorrências de medicamentos', () => {
  it('gera horários fixos, inclusive noturnos, independentemente da pausa de hidratação', () => {
    const med = makeMedication({ times: ['08:00', '23:00'] });
    const planned = plannedTimesFor(med, NOW, 1).map(formatTimeBR);
    expect(planned).toEqual(['08:00', '23:00']);
  });

  it('gera intervalos prescritos a partir de um horário âncora', () => {
    const med = makeMedication({ scheduleType: 'interval_hours', times: [], intervalHours: 8, intervalAnchor: '06:00' });
    expect(plannedTimesFor(med, NOW, 1).map(formatTimeBR)).toEqual(['06:00', '14:00', '22:00']);
  });

  it('respeita datas de início/fim e dias de uso', () => {
    const med = makeMedication({ startDate: '2026-09-30', endDate: '2026-09-30', times: ['10:00'] });
    const planned = plannedTimesFor(med, NOW, 5);
    expect(planned).toHaveLength(1);
    expect(planned[0]!.getDate()).toBe(30);
    const seg = makeMedication({ weekdays: [1], times: ['10:00'] });
    expect(plannedTimesFor(seg, NOW, 7).every((d) => d.getDay() === 1)).toBe(true);
  });

  it('identificador determinístico impede ocorrência duplicada ao rematerializar', () => {
    const med = makeMedication();
    const first = materializeOccurrences(med, [], NOW, 2, NOW);
    const confirmed = confirmTaken(first[0]!, NOW).occ;
    const second = materializeOccurrences(med, [confirmed, ...first.slice(1)], NOW, 2, NOW);
    expect(second).toHaveLength(first.length);
    expect(new Set(second.map((o) => o.id)).size).toBe(second.length);
    expect(second[0]!.status).toBe('taken');
    expect(second[0]!.id).toBe(occurrenceId(med.id, new Date(2026, 8, 29, 8, 0)));
  });

  it('confirmar duas vezes não duplica e sinaliza que já estava confirmada', () => {
    const med = makeMedication();
    const [occ] = materializeOccurrences(med, [], NOW, 1, NOW);
    const r1 = confirmTaken(occ!, NOW);
    const r2 = confirmTaken(r1.occ, new Date(NOW.getTime() + 60_000));
    expect(r1.alreadyConfirmed).toBe(false);
    expect(r2.alreadyConfirmed).toBe(true);
    expect(r2.occ.history).toHaveLength(r1.occ.history.length);
  });

  it('adiar altera apenas a ocorrência adiada; próximas doses permanecem iguais', () => {
    const med = makeMedication({ times: ['08:00', '20:00'] });
    const occs = materializeOccurrences(med, [], NOW, 2, NOW);
    const before = occs.slice(1).map((o) => o.plannedAt);
    const at8 = new Date(2026, 8, 29, 8, 5);
    const snoozed = snooze(occs[0]!, at8, 15);
    expect(snoozed.status).toBe('snoozed');
    expect(snoozed.plannedAt).toBe(occs[0]!.plannedAt); // horário prescrito não muda
    expect(new Date(snoozed.snoozedUntil!).getTime()).toBe(at8.getTime() + 15 * 60_000);
    const after = materializeOccurrences(med, [snoozed, ...occs.slice(1)], NOW, 2, at8);
    expect(after.slice(1).map((o) => o.plannedAt)).toEqual(before);
  });

  it('sem confirmação após tolerância; correção manual mantém histórico', () => {
    const med = makeMedication({ times: ['08:00'] });
    const [occ] = materializeOccurrences(med, [], NOW, 1, NOW);
    const late = markUnconfirmedIfLate(occ!, new Date(2026, 8, 29, 10, 30), 120);
    expect(late.status).toBe('unconfirmed');
    const fixed = correctStatus(late, 'taken', new Date(2026, 8, 29, 11), 'tomei às 8h e esqueci de marcar');
    expect(fixed.status).toBe('taken');
    expect(fixed.history.map((h) => h.to)).toEqual(['scheduled', 'unconfirmed', 'taken']);
    // Sem horário informado, usa o momento da correção; com horário, registra a hora real da tomada.
    expect(fixed.takenAt).toBe(new Date(2026, 8, 29, 11).toISOString());
    const at8 = correctStatus(late, 'taken', new Date(2026, 8, 29, 11), 'tomei às 8h', new Date(2026, 8, 29, 8, 10).toISOString());
    expect(at8.takenAt).toBe(new Date(2026, 8, 29, 8, 10).toISOString());
  });

  it('sem data de início, não gera doses de dias anteriores ao cadastro; as do próprio dia continuam', () => {
    const createdAt = new Date(2026, 8, 29, 18, 42).toISOString(); // cadastrado hoje às 18:42
    const med = makeMedication({ times: ['18:00', '18:45', '19:15'], createdAt });
    const from = new Date(2026, 8, 28, 0, 0); // desde ontem
    // A dose das 18:00 de hoje existe (pode ter sido tomada antes de cadastrar e ser corrigida); as de ontem não.
    expect(plannedTimesFor(med, from, 2).map((d) => `${d.getDate()} ${formatTimeBR(d)}`)).toEqual(['29 18:00', '29 18:45', '29 19:15']);
    // Com data de início explícita, ela manda (dias inteiros).
    const withStart = makeMedication({ times: ['18:00'], createdAt, startDate: '2026-09-28' });
    expect(plannedTimesFor(withStart, from, 2)).toHaveLength(2);
  });

  it('ocorrência existente que a prescrição não prevê mais vira histórico e ainda recebe "sem confirmação"', () => {
    const med = makeMedication({ times: ['08:00'] });
    const stale = materializeOccurrences(makeMedication({ times: ['06:00'] }), [], NOW, 1, NOW)[0]!; // criada por prescrição antiga
    const later = new Date(2026, 8, 29, 9, 0);
    const out = materializeOccurrences(med, [stale], NOW, 1, later);
    const kept = out.find((o) => o.id === stale.id);
    expect(kept?.status).toBe('unconfirmed');
    expect(out.some((o) => o.plannedAt === new Date(2026, 8, 29, 8, 0).toISOString())).toBe(true);
  });

  it('medicamento inativo não gera ocorrências', () => {
    expect(plannedTimesFor(makeMedication({ active: false }), NOW, 3)).toEqual([]);
  });
});

describe('medicamentos de hoje na tela inicial', () => {
  it('lista só as doses pendentes do dia local, em ordem, e nenhuma dos dias seguintes', () => {
    const med = makeMedication({ times: ['08:00', '20:00'] });
    const occs = materializeOccurrences(med, [], addDays(NOW, -1), 4, NOW);
    expect(occs.length).toBeGreaterThan(4); // ontem, hoje e dias seguintes
    const today = pendingOccurrencesToday(occs, NOW);
    expect(today.map((o) => formatTimeBR(new Date(o.plannedAt)))).toEqual(['08:00', '20:00']);
    expect(today.every((o) => toISODate(new Date(o.plannedAt)) === toISODate(NOW))).toBe(true);
  });

  it('exclui doses de hoje já tomadas ou não tomadas, mas mantém as sem confirmação', () => {
    const med = makeMedication({ times: ['06:00', '08:00', '20:00'] });
    const occs = materializeOccurrences(med, [], NOW, 1, NOW);
    const taken = confirmTaken(occs[0]!, NOW).occ;
    const late = markUnconfirmedIfLate(occs[1]!, new Date(2026, 8, 29, 11, 0), 120);
    const today = pendingOccurrencesToday([late, taken, occs[2]!], NOW);
    expect(today.map((o) => [formatTimeBR(new Date(o.plannedAt)), o.status])).toEqual([
      ['08:00', 'unconfirmed'],
      ['20:00', 'scheduled'],
    ]);
  });

  it('fica vazia quando não há mais doses hoje, mesmo com doses amanhã', () => {
    const med = makeMedication({ times: ['08:00'] });
    const occs = materializeOccurrences(med, [], NOW, 2, NOW);
    const [today, ...rest] = occs;
    const done = confirmTaken(today!, NOW).occ;
    expect(rest).toHaveLength(1);
    expect(pendingOccurrencesToday([done, ...rest], NOW)).toEqual([]);
  });
});

describe('edição da prescrição (inclusive sugestão de horário aceita)', () => {
  // Hoje às 19:43: a dose das 13:00 já passou sem confirmação; a pessoa aceita mudar para 13:30.
  const now = new Date(2026, 9, 17, 19, 43, 0, 0);
  const before = makeMedication({ times: ['13:00'] });
  const after = { ...before, times: ['13:30'] };

  it('remove a dose de hoje sem confirmação do horário antigo e as agendadas dos próximos dias', () => {
    const existing = materializeOccurrences(before, [], addDays(now, -3), 10, now);
    const stale = staleOccurrencesAfterEdit(after, existing, now, 14);
    const todayOld = occurrenceId(before.id, new Date(2026, 9, 17, 13, 0));
    expect(stale.map((o) => o.id)).toContain(todayOld);
    expect(stale.every((o) => formatTimeBR(new Date(o.plannedAt)) === '13:00')).toBe(true);
    expect(stale.every((o) => new Date(o.plannedAt).getTime() >= new Date(2026, 9, 17).getTime())).toBe(true);
    // Dias anteriores (histórico) ficam.
    expect(stale.map((o) => toISODate(new Date(o.plannedAt)))).not.toContain('2026-10-16');
    expect(stale.length).toBe(existing.filter((o) => new Date(o.plannedAt).getTime() >= new Date(2026, 9, 17).getTime()).length);
  });

  it('depois da limpeza só a dose nova aparece nas pendentes de hoje', () => {
    const existing = materializeOccurrences(before, [], addDays(now, -3), 10, now);
    const stale = new Set(staleOccurrencesAfterEdit(after, existing, now, 14).map((o) => o.id));
    const kept = existing.filter((o) => !stale.has(o.id));
    const next = materializeOccurrences(after, kept, addDays(now, -1), 15, now);
    expect(pendingOccurrencesToday(next, now).map((o) => formatTimeBR(new Date(o.plannedAt)))).toEqual(['13:30']);
  });

  it('preserva o que a pessoa registrou, mesmo no horário antigo', () => {
    const existing = materializeOccurrences(before, [], addDays(now, -1), 3, now);
    const todayOld = existing.find((o) => o.id === occurrenceId(before.id, new Date(2026, 9, 17, 13, 0)))!;
    const taken = confirmTaken(todayOld, now).occ;
    const tomorrowNotTaken = markNotTaken(existing.find((o) => o.id === occurrenceId(before.id, new Date(2026, 9, 18, 13, 0)))!, now);
    const withRecords = existing.map((o) => (o.id === taken.id ? taken : o.id === tomorrowNotTaken.id ? tomorrowNotTaken : o));
    const stale = staleOccurrencesAfterEdit(after, withRecords, now, 14);
    expect(stale.map((o) => o.id)).not.toContain(taken.id);
    expect(stale.map((o) => o.id)).not.toContain(tomorrowNotTaken.id);
  });

  it('não mexe em nada quando a prescrição não muda os horários', () => {
    const existing = materializeOccurrences(before, [], addDays(now, -1), 15, now);
    expect(staleOccurrencesAfterEdit(before, existing, now, 14)).toEqual([]);
  });
});
