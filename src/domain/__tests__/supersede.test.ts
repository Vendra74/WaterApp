import { selectSuperseded } from '../notifications/supersede';

const hyd = (id: string, slotAt = '2026-09-30T17:00:00.000Z') => ({ identifier: id, data: { kind: 'hydration', slotAt } });
const med = (id: string, occurrenceId: string, repeat?: string) => ({ identifier: id, data: { kind: 'medication', occurrenceId, medicationId: 'm1', ...(repeat ? { repeat } : {}) } });
const test = (id: string) => ({ identifier: id, data: { kind: 'test' } });
const review = { identifier: 'review@1', data: { kind: 'health_review' } };

describe('selectSuperseded', () => {
  it('lembrete de água novo dispensa os de água anteriores, e só eles', () => {
    const presented = [hyd('hyd@1'), hyd('hyd@2'), med('med@a', 'occ-a'), test('test@1'), review];
    expect(selectSuperseded(hyd('hyd@3'), presented)).toEqual(['hyd@1', 'hyd@2']);
  });

  it('não dispensa a si mesmo', () => {
    expect(selectSuperseded(hyd('hyd@1'), [hyd('hyd@1')])).toEqual([]);
  });

  it('repetição de dose dispensa apenas o aviso original da mesma ocorrência', () => {
    const presented = [med('med@a', 'occ-a'), med('med@b', 'occ-b'), hyd('hyd@1')];
    expect(selectSuperseded(med('med@a#1', 'occ-a', '1'), presented)).toEqual(['med@a']);
  });

  it('medicamento sem ocorrência não dispensa nada', () => {
    expect(selectSuperseded({ identifier: 'x', data: { kind: 'medication' } }, [med('med@a', 'occ-a')])).toEqual([]);
  });

  it('teste dispensa testes anteriores, mas não lembretes reais', () => {
    expect(selectSuperseded(test('test@2'), [test('test@1'), hyd('hyd@1'), med('med@a', 'occ-a')])).toEqual(['test@1']);
  });

  it('revisão de saúde, tipo desconhecido ou dados ausentes não dispensam nada', () => {
    const presented = [hyd('hyd@1'), test('test@1')];
    expect(selectSuperseded(review, presented)).toEqual([]);
    expect(selectSuperseded({ identifier: 'z', data: { kind: 'outro' } }, presented)).toEqual([]);
    expect(selectSuperseded({ identifier: 'w', data: null }, presented)).toEqual([]);
  });
});
