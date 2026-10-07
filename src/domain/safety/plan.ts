import type { Profile } from '../types';
import { strings } from '@/i18n';

/**
 * Regras explícitas de segurança para personalização.
 *
 *  - Não existe meta universal (ex.: 2 litros).
 *  - Nenhuma meta é calculada automaticamente por idade, peso, clima ou atividade.
 *  - Só há meta de volume quando o usuário informa um plano profissional com quantidade.
 *  - Com restrição sem quantidade conhecida, dificuldade de deglutição ou informação essencial
 *    incerta, não geramos volumes nem sugestões alimentares individualizadas.
 */

export type PlanMode =
  | 'professional_goal' // meta informada por profissional: usa limites do plano
  | 'general_reminders' // lembretes gerais sem meta de volume
  | 'restricted_no_suggestions'; // não gerar volumes nem sugestões individualizadas

export type SafetyFlag =
  | 'fluid_restriction_without_quantity'
  | 'fluid_restriction_unknown'
  | 'swallowing_difficulty'
  | 'swallowing_unknown'
  | 'assessment_incomplete';

export interface IndividualPlan {
  mode: PlanMode;
  /** Meta diária válida (ml) — apenas quando informada por profissional. */
  goalMl: number | null;
  /** Instruções do profissional, exibidas junto ao plano. */
  professionalInstructions: string;
  /** Pode exibir sugestões individualizadas (frutas nos lanches etc.)? */
  allowIndividualSuggestions: boolean;
  /** Pode exibir percentual de meta? Só com meta válida. */
  showGoalProgress: boolean;
  flags: SafetyFlag[];
  /** Mensagem de orientação (não clínica) para o usuário. */
  guidance: string;
}

export function evaluateIndividualPlan(profile: Pick<
  Profile,
  | 'fluidRestriction'
  | 'professionalGoalMl'
  | 'professionalInstructions'
  | 'swallowingDifficulty'
  | 'assessmentCompleted'
>): IndividualPlan {
  const flags: SafetyFlag[] = [];

  if (!profile.assessmentCompleted) flags.push('assessment_incomplete');
  if (profile.swallowingDifficulty === 'yes') flags.push('swallowing_difficulty');
  if (profile.swallowingDifficulty === 'unknown') flags.push('swallowing_unknown');
  if (profile.fluidRestriction === 'unknown') flags.push('fluid_restriction_unknown');

  const hasValidGoal =
    profile.fluidRestriction === 'yes' &&
    typeof profile.professionalGoalMl === 'number' &&
    Number.isFinite(profile.professionalGoalMl) &&
    profile.professionalGoalMl > 0;

  if (profile.fluidRestriction === 'yes' && !hasValidGoal) {
    flags.push('fluid_restriction_without_quantity');
  }

  const blocking = flags.some((f) =>
    ['fluid_restriction_without_quantity', 'fluid_restriction_unknown', 'swallowing_difficulty', 'swallowing_unknown', 'assessment_incomplete'].includes(f),
  );

  if (blocking) {
    return {
      mode: 'restricted_no_suggestions',
      goalMl: hasValidGoal ? profile.professionalGoalMl : null,
      professionalInstructions: profile.professionalInstructions,
      allowIndividualSuggestions: false,
      showGoalProgress: hasValidGoal && !flags.includes('assessment_incomplete'),
      flags,
      guidance: guidanceFor(flags),
    };
  }

  if (hasValidGoal) {
    return {
      mode: 'professional_goal',
      goalMl: profile.professionalGoalMl,
      professionalInstructions: profile.professionalInstructions,
      allowIndividualSuggestions: true,
      showGoalProgress: true,
      flags,
      guidance: strings().plan.professionalGoal,
    };
  }

  return {
    mode: 'general_reminders',
    goalMl: null,
    professionalInstructions: profile.professionalInstructions,
    allowIndividualSuggestions: true,
    showGoalProgress: false,
    flags,
    guidance: strings().plan.generalReminders,
  };
}

function guidanceFor(flags: SafetyFlag[]): string {
  const s = strings().plan;
  if (flags.includes('assessment_incomplete')) return s.assessmentIncomplete;
  if (flags.includes('swallowing_difficulty') || flags.includes('swallowing_unknown')) return s.swallowing;
  if (flags.includes('fluid_restriction_without_quantity') || flags.includes('fluid_restriction_unknown')) return s.restriction;
  return s.fallback;
}

/** Percentual de meta: apenas quando existe meta válida; nunca extrapola 100 no indicador visual. */
export function goalProgressPercent(totalMl: number, plan: IndividualPlan): number | null {
  if (!plan.showGoalProgress || plan.goalMl === null || plan.goalMl <= 0) return null;
  return Math.round((totalMl / plan.goalMl) * 100);
}
