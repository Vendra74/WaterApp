import { strings } from '@/i18n';

/**
 * Dose para exibição ("1 comprimido" / "1 tablet"). A unidade fica gravada como a pessoa digitou (ou
 * como veio da receita); aqui só se traduz uma unidade conhecida para o idioma em uso, com plural.
 * Unidades desconhecidas e medidas (ml, mg, g) aparecem como estão. Não interpreta a dose.
 */
export type DoseUnitKey = 'tablet' | 'capsule' | 'drop' | 'spoon' | 'teaspoon' | 'tablespoon' | 'sachet' | 'ampoule' | 'application' | 'puff' | 'dose' | 'unit' | 'patch' | 'suppository' | 'injection' | 'vial';

const SYNONYMS: Record<string, DoseUnitKey> = {
  comprimido: 'tablet', comprimidos: 'tablet', comp: 'tablet', cp: 'tablet', tablet: 'tablet', tablets: 'tablet', tab: 'tablet', tabs: 'tablet', pill: 'tablet', pills: 'tablet',
  capsula: 'capsule', capsulas: 'capsule', caps: 'capsule', capsule: 'capsule', capsules: 'capsule',
  gota: 'drop', gotas: 'drop', drop: 'drop', drops: 'drop',
  colher: 'spoon', colheres: 'spoon', spoon: 'spoon', spoons: 'spoon', spoonful: 'spoon', spoonfuls: 'spoon',
  'colher de cha': 'teaspoon', 'colheres de cha': 'teaspoon', 'colher (cha)': 'teaspoon', teaspoon: 'teaspoon', teaspoons: 'teaspoon', tsp: 'teaspoon',
  'colher de sopa': 'tablespoon', 'colheres de sopa': 'tablespoon', 'colher (sopa)': 'tablespoon', tablespoon: 'tablespoon', tablespoons: 'tablespoon', tbsp: 'tablespoon',
  sache: 'sachet', saches: 'sachet', sachet: 'sachet', sachets: 'sachet', envelope: 'sachet', envelopes: 'sachet',
  ampola: 'ampoule', ampolas: 'ampoule', ampoule: 'ampoule', ampoules: 'ampoule', ampule: 'ampoule', ampules: 'ampoule',
  aplicacao: 'application', aplicacoes: 'application', application: 'application', applications: 'application',
  jato: 'puff', jatos: 'puff', borrifada: 'puff', borrifadas: 'puff', puff: 'puff', puffs: 'puff', spray: 'puff', sprays: 'puff',
  dose: 'dose', doses: 'dose',
  unidade: 'unit', unidades: 'unit', unit: 'unit', units: 'unit',
  adesivo: 'patch', adesivos: 'patch', patch: 'patch', patches: 'patch',
  supositorio: 'suppository', supositorios: 'suppository', suppository: 'suppository', suppositories: 'suppository',
  injecao: 'injection', injecoes: 'injection', injection: 'injection', injections: 'injection',
  frasco: 'vial', frascos: 'vial', vial: 'vial', vials: 'vial',
};

const HALF = new Set(['meio', 'meia', 'half', '½', '1/2', '0.5', '0,5']);

/** Unidade digitada → chave conhecida, ou null quando não é reconhecida (fica como está). */
export function doseUnitKey(unit: string): DoseUnitKey | null {
  const plain = unit.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.$/, '').replace(/\s+/g, ' ');
  return SYNONYMS[plain] ?? null;
}

/** Quantidade como escrita ("1", "2", "meio", "1 a 2") → usar singular? */
export function isSingularAmount(amount: string): boolean {
  const a = amount.trim().toLowerCase();
  if (a === '' || HALF.has(a)) return true;
  const n = Number(a.replace(',', '.'));
  return Number.isFinite(n) ? n === 1 : false;
}

export function doseUnitLabel(unit: string, amount: string): string {
  const key = doseUnitKey(unit);
  if (!key) return unit;
  const forms = strings().doseUnits[key];
  return isSingularAmount(amount) ? forms.one : forms.many;
}

export function describeDose(amount: string, unit: string): string {
  return `${amount} ${doseUnitLabel(unit, amount)}`.trim();
}
