import { getLocale } from './locale';
import { pt } from './pt';
import { en } from './en';

/**
 * Nomes padrão de recipientes e refeições para exibição.
 *
 * Os nomes ficam gravados no perfil como estavam quando foram criados (“Copo pequeno”, “Garrafinha”,
 * “Café da manhã”…), no idioma em uso naquele momento. Ao trocar o idioma, um nome que ainda é um dos
 * padrões (em qualquer idioma) aparece no idioma atual; o que a pessoa escreveu por conta própria
 * aparece exatamente como escreveu. O que fica gravado não muda.
 */
const PAIRS: readonly [pt: string, en: string][] = [
  ...pt.defaults.containers.map((c, i) => [c.label, en.defaults.containers[i]?.label ?? c.label] as [string, string]),
  ...pt.defaults.meals.map((m, i) => [m.label, en.defaults.meals[i]?.label ?? m.label] as [string, string]),
  [pt.assessment.newContainerLabel, en.assessment.newContainerLabel],
  [pt.assessment.newMealLabel, en.assessment.newMealLabel],
];

function normalize(label: string): string {
  return label.trim().toLowerCase();
}

/** Nome gravado → nome no idioma em uso (só para os padrões; o resto volta igual). */
export function displayLabel(label: string): string {
  const key = normalize(label);
  const pair = PAIRS.find(([p, e]) => normalize(p) === key || normalize(e) === key);
  if (!pair) return label;
  return getLocale() === 'en' ? pair[1] : pair[0];
}
