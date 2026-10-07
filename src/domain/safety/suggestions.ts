import type { Profile } from '../types';
import { hhmmToMinutes } from '../time/time';
import type { IndividualPlan } from './plan';
import { strings } from '@/i18n';

export interface Suggestion {
  kind: 'water' | 'fruit';
  label: string;
  /** Frutas nunca são convertidas em ml. */
  countsAsFluid: boolean;
}

/**
 * Sugestão geral para um horário. Água é sempre a opção padrão.
 * Frutas aparecem somente como complemento em horários de lanche, quando permitido pelo plano
 * e compatível com alergias/restrições relatadas.
 */
export function suggestFor(
  profile: Pick<Profile, 'meals' | 'fruitPreferences' | 'allergies' | 'dietaryRestrictions'>,
  plan: IndividualPlan,
  at: Date,
): Suggestion[] {
  const suggestions: Suggestion[] = [{ kind: 'water', label: strings().plan.water, countsAsFluid: true }];
  if (!plan.allowIndividualSuggestions) return suggestions;

  const minute = at.getHours() * 60 + at.getMinutes();
  const snackWindow = profile.meals.some((meal) => {
    if (!/lanche|colação|ceia|snack/i.test(meal.label)) return false;
    const mealMin = hhmmToMinutes(meal.time);
    return Math.abs(mealMin - minute) <= 45;
  });
  if (!snackWindow) return suggestions;

  const blocked = new Set(
    [...profile.allergies, ...profile.dietaryRestrictions].map((s) => normalize(s)),
  );
  for (const fruit of profile.fruitPreferences) {
    const n = normalize(fruit);
    const conflicts = [...blocked].some((b) => b.length > 0 && (n.includes(b) || b.includes(n)));
    if (!conflicts) {
      suggestions.push({ kind: 'fruit', label: fruit, countsAsFluid: false });
    }
  }
  return suggestions;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}
