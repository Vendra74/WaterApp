import { applyPrescriptionDraft, describePrescriptionDraft, normalizePrescriptionDraft } from '../medication/prescriptionDraft';
import { makeMedication } from './fixtures';

describe('rascunho lido da foto da receita', () => {
  it('normaliza uma resposta completa', () => {
    const d = normalizePrescriptionDraft({
      name: '  Losartana   Potássica ',
      presentation: 'Comprimido 50 mg',
      doseAmount: '1',
      doseUnit: 'Comprimido',
      route: 'Via oral',
      times: ['20:00', '08:00', '08:00', '25:99'],
      intervalHours: null,
      instructions: 'Após o café da manhã.',
      readable: true,
      notes: '',
    });
    expect(d).toEqual({
      name: 'Losartana Potássica',
      presentation: 'Comprimido 50 mg',
      doseAmount: '1',
      doseUnit: 'comprimido',
      route: 'oral',
      scheduleType: 'fixed_times',
      times: ['08:00', '20:00'],
      intervalHours: null,
      instructions: 'Após o café da manhã.',
      readable: true,
      notes: '',
    });
  });

  it('intervalo em horas só quando não há horários fixos e dentro de 1 a 24', () => {
    expect(normalizePrescriptionDraft({ name: 'X', intervalHours: 8, readable: true }).scheduleType).toBe('interval_hours');
    expect(normalizePrescriptionDraft({ name: 'X', intervalHours: '12', readable: true }).intervalHours).toBe(12);
    expect(normalizePrescriptionDraft({ name: 'X', intervalHours: 48, readable: true }).scheduleType).toBeNull();
    const both = normalizePrescriptionDraft({ name: 'X', times: ['08:00'], intervalHours: 8, readable: true });
    expect(both.scheduleType).toBe('fixed_times');
    expect(both.intervalHours).toBeNull();
  });

  it('tolera lixo: tipos errados, campos ausentes, textos longos', () => {
    const d = normalizePrescriptionDraft({ name: 42, times: 'oito horas', doseAmount: ['1'], instructions: 'a'.repeat(1000), readable: 'sim' });
    expect(d.name).toBe('');
    expect(d.times).toEqual([]);
    expect(d.doseAmount).toBe('');
    expect(d.instructions).toHaveLength(300);
    expect(d.readable).toBe(false);
    expect(normalizePrescriptionDraft(null).readable).toBe(false);
  });

  it('não considera legível uma leitura sem nome', () => {
    expect(normalizePrescriptionDraft({ readable: true, doseAmount: '1' }).readable).toBe(false);
  });

  it('mapeia a via para as opções do formulário', () => {
    const route = (r: string) => normalizePrescriptionDraft({ route: r }).route;
    expect(route('VO')).toBe('outra');
    expect(route('oral')).toBe('oral');
    expect(route('uso tópico')).toBe('outra');
    expect(route('Tópica')).toBe('tópica');
    expect(route('na pele')).toBe('tópica');
    expect(route('oftálmica')).toBe('ocular');
    expect(route('subcutânea')).toBe('injetável');
    expect(route('')).toBe('');
  });

  it('aplicar só substitui o que a foto preencheu e nunca dias, datas ou lembretes', () => {
    const med = makeMedication({ weekdays: [1, 3], startDate: '2026-10-01', active: false, instructions: 'antiga' });
    const d = normalizePrescriptionDraft({ name: 'Metformina', doseAmount: '', intervalHours: 12, readable: true });
    const next = applyPrescriptionDraft(med, d);
    expect(next.name).toBe('Metformina');
    expect(next.doseAmount).toBe('1'); // mantido do cadastro
    expect(next.instructions).toBe('antiga');
    expect(next.scheduleType).toBe('interval_hours');
    expect(next.intervalHours).toBe(12);
    expect(next.intervalAnchor).toBe('08:00');
    expect(next.times).toEqual([]);
    expect(next.weekdays).toEqual([1, 3]);
    expect(next.startDate).toBe('2026-10-01');
    expect(next.active).toBe(false);

    const fixed = applyPrescriptionDraft(next, normalizePrescriptionDraft({ name: 'Metformina', times: ['07:00', '19:00'], readable: true }));
    expect(fixed.scheduleType).toBe('fixed_times');
    expect(fixed.times).toEqual(['07:00', '19:00']);
    expect(fixed.intervalHours).toBeNull();
  });

  it('descreve o que foi e o que não foi preenchido', () => {
    const d = normalizePrescriptionDraft({ name: 'Losartana', doseAmount: '1', doseUnit: 'comprimido', readable: true });
    expect(describePrescriptionDraft(d)).toEqual({ filled: ['nome', 'dose'], missing: ['apresentação', 'horários', 'instruções'] });
  });
});
