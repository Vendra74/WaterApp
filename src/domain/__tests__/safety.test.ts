import { evaluateIndividualPlan, goalProgressPercent } from '../safety/plan';
import { suggestFor } from '../safety/suggestions';
import { makeProfile } from './fixtures';

describe('plano individual — limites de segurança', () => {
  it('sem plano profissional: lembretes gerais, sem meta e sem percentual', () => {
    const plan = evaluateIndividualPlan(makeProfile());
    expect(plan.mode).toBe('general_reminders');
    expect(plan.goalMl).toBeNull();
    expect(plan.showGoalProgress).toBe(false);
    expect(goalProgressPercent(1500, plan)).toBeNull();
  });

  it('nunca aplica meta universal de 2 litros nem calcula por idade', () => {
    const jovem = evaluateIndividualPlan(makeProfile({ age: 65 }));
    const idoso = evaluateIndividualPlan(makeProfile({ age: 92 }));
    expect(jovem.goalMl).toBeNull();
    expect(idoso.goalMl).toBeNull();
  });

  it('com meta profissional informada: usa a meta e mostra percentual', () => {
    const plan = evaluateIndividualPlan(
      makeProfile({ fluidRestriction: 'yes', professionalGoalMl: 1200, professionalInstructions: 'Máximo 1,2 L/dia' }),
    );
    expect(plan.mode).toBe('professional_goal');
    expect(plan.goalMl).toBe(1200);
    expect(goalProgressPercent(600, plan)).toBe(50);
  });

  it('restrição sem quantidade conhecida bloqueia volumes e sugestões', () => {
    const plan = evaluateIndividualPlan(makeProfile({ fluidRestriction: 'yes', professionalGoalMl: null }));
    expect(plan.mode).toBe('restricted_no_suggestions');
    expect(plan.allowIndividualSuggestions).toBe(false);
    expect(plan.flags).toContain('fluid_restriction_without_quantity');
    expect(plan.guidance).toMatch(/equipe de saúde/i);
  });

  it('"não sei" na restrição não é tratado como ausência de risco', () => {
    const plan = evaluateIndividualPlan(makeProfile({ fluidRestriction: 'unknown' }));
    expect(plan.mode).toBe('restricted_no_suggestions');
  });

  it('dificuldade de deglutição (ou incerteza) bloqueia sugestões mesmo com meta', () => {
    const yes = evaluateIndividualPlan(makeProfile({ swallowingDifficulty: 'yes', fluidRestriction: 'yes', professionalGoalMl: 1500 }));
    const unknown = evaluateIndividualPlan(makeProfile({ swallowingDifficulty: 'unknown' }));
    expect(yes.allowIndividualSuggestions).toBe(false);
    expect(unknown.allowIndividualSuggestions).toBe(false);
    expect(yes.guidance).toMatch(/engolir/);
  });

  it('avaliação incompleta bloqueia sugestões individualizadas', () => {
    const plan = evaluateIndividualPlan(makeProfile({ assessmentCompleted: false }));
    expect(plan.allowIndividualSuggestions).toBe(false);
  });
});

describe('sugestões', () => {
  it('água é sempre a primeira sugestão', () => {
    const profile = makeProfile();
    const plan = evaluateIndividualPlan(profile);
    const s = suggestFor(profile, plan, new Date(2026, 8, 29, 10, 0));
    expect(s[0]).toEqual({ kind: 'water', label: 'Água', countsAsFluid: true });
    expect(s).toHaveLength(1);
  });

  it('frutas aparecem só no lanche, filtradas por alergia, e nunca contam como líquido', () => {
    const profile = makeProfile();
    const plan = evaluateIndividualPlan(profile);
    const s = suggestFor(profile, plan, new Date(2026, 8, 29, 16, 10));
    const fruits = s.filter((x) => x.kind === 'fruit');
    expect(fruits.map((f) => f.label)).toEqual(['banana', 'mamão']);
    expect(fruits.every((f) => f.countsAsFluid === false)).toBe(true);
  });

  it('plano restrito bloqueia frutas mesmo no horário do lanche', () => {
    const profile = makeProfile({ swallowingDifficulty: 'yes' });
    const plan = evaluateIndividualPlan(profile);
    const s = suggestFor(profile, plan, new Date(2026, 8, 29, 16, 0));
    expect(s.map((x) => x.kind)).toEqual(['water']);
  });
});
