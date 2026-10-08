import { pt } from '../pt';
import { en } from '../en';
import { getLocale, resolveLocale, resolvePreference, setLocale, strings } from '../index';
import { formatClock, formatDate, formatHHmm, formatISODate, weekdayShort } from '../format';
import { buildNotificationPlan } from '@/domain/notifications/planner';
import { describeSuggestion } from '@/domain/adaptive/reminderSuggestions';
import { describeSchedule } from '@/screens/medications/format';
import { describeDose } from '@/domain/medication/dose';
import { makeMedication as medication } from '@/domain/__tests__/fixtures';

/** Caminhos de todas as chaves de um dicionário, com o tipo da folha. */
function leaves(obj: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (Array.isArray(obj)) {
    out.set(prefix, `array:${obj.length}`);
    return out;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) for (const [path, type] of leaves(v, prefix ? `${prefix}.${k}` : k)) out.set(path, type);
    return out;
  }
  out.set(prefix, typeof obj === 'function' ? `function:${(obj as (...a: unknown[]) => unknown).length}` : typeof obj);
  return out;
}

afterEach(() => setLocale('pt-BR'));

describe('dicionários', () => {
  it('inglês tem exatamente as mesmas chaves, tipos e aridade do português', () => {
    const a = leaves(pt);
    const b = leaves(en);
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
    for (const [path, type] of a) expect(`${path}: ${b.get(path)}`).toBe(`${path}: ${type}`);
  });

  it('nenhum texto em inglês ficou igual ao português por descuido (exceto os que são iguais mesmo)', () => {
    const same = new Set(['common.ml', 'medicationForm.dose', 'assessment.fontNormal', 'prescription.fieldDose', 'nav.dose', 'common.item', 'common.medication', 'occurrenceStatus.taken', 'hydration.beverageSoup', 'help.emergencyNumber', 'medications.instructions', 'occurrence.instructions', 'profile.instructions', 'medicationForm.dateHint', 'medicationForm.routeOther', 'language.ptBR', 'language.en', 'doseUnits.dose.one', 'doseUnits.dose.many']);
    const a = leaves(pt);
    const pick = (o: unknown, path: string) => path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], o);
    for (const [path, type] of a) {
      if (type !== 'string' || same.has(path) || path.startsWith('defaults.')) continue;
      const vPt = pick(pt, path) as string;
      const vEn = pick(en, path) as string;
      if (vPt.length > 3) expect(`${path}: ${vEn}`).not.toBe(`${path}: ${vPt}`);
    }
  });
});

describe('idioma do aparelho', () => {
  it('inglês só quando o aparelho está em inglês; o resto cai no português', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('EN-us')).toBe('en');
    expect(resolveLocale('pt')).toBe('pt-BR');
    expect(resolveLocale('es')).toBe('pt-BR');
    expect(resolveLocale(undefined)).toBe('pt-BR');
  });
  it('padrão é pt-BR e setLocale troca o dicionário', () => {
    expect(getLocale()).toBe('pt-BR');
    expect(strings().common.yes).toBe('Sim');
    setLocale('en');
    expect(strings().common.yes).toBe('Yes');
  });
});

describe('formatação por idioma', () => {
  const d = new Date(2026, 9, 7, 20, 5);
  it('português: 24 h e dia/mês/ano', () => {
    expect(formatClock(d)).toBe('20:05');
    expect(formatHHmm('08:30')).toBe('08:30');
    expect(formatDate(d)).toBe('07/10/2026');
    expect(formatISODate('2026-10-07')).toBe('07/10/2026');
    expect(weekdayShort(0)).toBe('Dom');
  });
  it('inglês: 12 h com AM/PM e mês/dia/ano', () => {
    setLocale('en');
    expect(formatClock(d)).toBe('8:05 PM');
    expect(formatHHmm('08:30')).toBe('8:30 AM');
    expect(formatHHmm('00:15')).toBe('12:15 AM');
    expect(formatHHmm('12:00')).toBe('12:00 PM');
    expect(formatDate(d)).toBe('10/7/2026');
    expect(formatISODate('2026-10-07')).toBe('10/7/2026');
    expect(weekdayShort(0)).toBe('Sun');
  });
  it('valor que não é HH:mm passa intocado', () => {
    setLocale('en');
    expect(formatHHmm('')).toBe('');
  });
});

describe('textos gerados pelo domínio em inglês', () => {
  it('notificações de água e medicamento saem em inglês', () => {
    setLocale('en');
    const now = new Date(2026, 9, 7, 7, 0);
    const med = medication({ id: 'm1', name: 'Losartan' });
    const plan = buildNotificationPlan({
      now,
      hydrationSlots: [{ at: new Date(2026, 9, 7, 9, 0) }],
      medications: [med],
      occurrences: [{ id: 'o1', medicationId: 'm1', plannedAt: new Date(2026, 9, 7, 8, 0).toISOString(), status: 'scheduled', takenAt: null, snoozedUntil: null, note: '', history: [], updatedAt: now.toISOString() }],
      settings: { showDetailsOnLockScreen: false, medicationRepeatMinutes: 10, medicationRepeatCount: 1 },
      preferredName: 'Mary',
      healthReviewDue: null,
    });
    const titles = plan.map((p) => p.title);
    expect(titles).toContain('Time for your medication');
    expect(titles).toContain('Medication not confirmed yet');
    expect(plan.find((p) => p.kind === 'hydration')?.body).toBe('Mary, how about a glass of water now?');
  });

  it('sugestão de horário e descrição da prescrição em inglês, com 12 h', () => {
    setLocale('en');
    const text = describeSuggestion({ kind: 'hydration_time', key: 'hyd:08:00', from: '08:00', to: '08:30', samples: 5, days: 5 });
    expect(text.accept).toBe('Change to 8:30 AM');
    expect(text.reject).toBe('Keep 8:00 AM');
    expect(describeSchedule(medication({ times: ['08:00', '20:00'], weekdays: [] }))).toBe('at 8:00 AM, 8:00 PM, every day');
  });
});

describe('preferência de idioma', () => {
  it('auto segue o aparelho; escolha fixa ignora o aparelho', () => {
    expect(resolvePreference('auto', 'en-US')).toBe('en');
    expect(resolvePreference('auto', 'pt-BR')).toBe('pt-BR');
    expect(resolvePreference('auto', undefined)).toBe('pt-BR');
    expect(resolvePreference('en', 'pt-BR')).toBe('en');
    expect(resolvePreference('pt-BR', 'en')).toBe('pt-BR');
  });
});

describe('unidade da dose no idioma em uso', () => {
  it('traduz unidades conhecidas com plural e mantém o resto', () => {
    expect(describeDose('1', 'comprimido')).toBe('1 comprimido');
    expect(describeDose('2', 'tablet')).toBe('2 comprimidos');
    expect(describeDose('meio', 'comprimido')).toBe('meio comprimido');
    expect(describeDose('10', 'ml')).toBe('10 ml');
    expect(describeDose('1', 'pastilha')).toBe('1 pastilha');
    setLocale('en');
    expect(describeDose('1', 'comprimido')).toBe('1 tablet');
    expect(describeDose('2', 'comprimidos')).toBe('2 tablets');
    expect(describeDose('1,5', 'cápsula')).toBe('1,5 capsules');
    expect(describeDose('20', 'gotas')).toBe('20 drops');
    expect(describeDose('2', 'colher de chá')).toBe('2 teaspoons');
    setLocale('pt-BR');
    expect(describeDose('1', 'tbsp')).toBe('1 colher de sopa');
    setLocale('en');
    expect(describeDose('10', 'ml')).toBe('10 ml');
    expect(describeDose('1', 'pastilha')).toBe('1 pastilha');
  });
});
