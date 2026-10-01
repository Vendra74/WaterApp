import type { HydrationSettings, Medication, MedicationOccurrence, PlannedNotification } from '../types';
import { iso } from '../time/time';
import type { HydrationSlot } from '../hydration/schedule';

export const CATEGORY_HYDRATION = 'cuidar.hydration';
export const CATEGORY_MEDICATION = 'cuidar.medication';
export const CATEGORY_GENERIC = 'cuidar.generic';

/**
 * Canais Android. A importância de um canal não pode ser alterada depois de criado, por isso o
 * identificador tem versão: mudar a configuração exige um novo id (e apagar o antigo).
 */
export const CHANNEL_HYDRATION = 'hydration_v2';
export const CHANNEL_MEDICATION = 'medication_v2';
export const CHANNEL_GENERIC = 'general_v2';
export const LEGACY_CHANNELS = ['hydration', 'medication', 'general'];

export const ACTION_LOG_WATER = 'log_water';
export const ACTION_SNOOZE = 'snooze';
export const ACTION_HELP = 'help';
export const ACTION_TAKEN = 'taken';

/**
 * Limites reais das plataformas:
 *  - iOS mantém no máximo 64 notificações locais pendentes por app (as demais são descartadas).
 *  - Android não tem limite fixo de notificações, mas alarmes exatos são limitados e o sistema
 *    pode adiar em modo de economia de bateria.
 * Usamos um orçamento único e conservador e reagendamos ao abrir o app ou em tarefa periódica.
 */
export const DEFAULT_BUDGET = 60;

export interface PlanInput {
  now: Date;
  hydrationSlots: HydrationSlot[];
  medications: Medication[];
  occurrences: MedicationOccurrence[];
  settings: Pick<HydrationSettings, 'showDetailsOnLockScreen'> & Partial<Pick<HydrationSettings, 'medicationRepeatMinutes' | 'medicationRepeatCount'>>;
  preferredName: string;
  budget?: number;
  healthReviewDue?: Date | null;
}

/**
 * Constrói a lista priorizada de notificações a agendar no sistema.
 * Prioridade: medicamentos (inclusive noturnos) > hidratação > revisão periódica.
 * Nunca depende de a tela estar aberta: o resultado é entregue ao agendador nativo.
 */
export function buildNotificationPlan(input: PlanInput): PlannedNotification[] {
  const budget = input.budget ?? DEFAULT_BUDGET;
  const nowMs = input.now.getTime();
  const medsById = new Map(input.medications.map((m) => [m.id, m]));

  const medication: PlannedNotification[] = [];
  for (const occ of input.occurrences) {
    const med = medsById.get(occ.medicationId);
    if (!med || !med.active) continue;
    let fireAt: Date | null = null;
    if (occ.status === 'scheduled') fireAt = new Date(occ.plannedAt);
    else if (occ.status === 'snoozed' && occ.snoozedUntil) fireAt = new Date(occ.snoozedUntil);
    if (!fireAt || fireAt.getTime() <= nowMs) continue;

    const detailed = input.settings.showDetailsOnLockScreen;
    const title = detailed ? `Medicamento: ${med.name}` : 'Hora do seu medicamento';
    const body = detailed
      ? `${med.doseAmount} ${med.doseUnit}${med.instructions ? ` · ${med.instructions}` : ''}`.trim()
      : 'Toque para ver os detalhes e confirmar.';
    const content = `${title}|${body}`;
    medication.push({
      identifier: `med@${occ.id}@${fireAt.toISOString()}@${hash(content)}`,
      kind: 'medication',
      fireAt: iso(fireAt),
      title,
      body,
      categoryId: CATEGORY_MEDICATION,
      channelId: CHANNEL_MEDICATION,
      data: { kind: 'medication', occurrenceId: occ.id, medicationId: med.id },
    });
    // Repetições enquanto a dose não for confirmada: são canceladas na reconciliação assim que o
    // estado da ocorrência muda (tomada, adiada, não tomada). Não alteram a prescrição.
    const repeatMin = input.settings.medicationRepeatMinutes ?? 0;
    const repeatCount = input.settings.medicationRepeatCount ?? 0;
    if (occ.status === 'scheduled' && repeatMin > 0) {
      for (let i = 1; i <= repeatCount; i++) {
        const at = new Date(fireAt.getTime() + i * repeatMin * 60_000);
        const rTitle = detailed ? `Ainda não confirmado: ${med.name}` : 'Medicamento ainda não confirmado';
        const rBody = detailed ? `${med.doseAmount} ${med.doseUnit}`.trim() : 'Toque para ver os detalhes e confirmar.';
        medication.push({
          identifier: `med@${occ.id}@${at.toISOString()}@r${i}@${hash(rTitle + rBody)}`,
          kind: 'medication',
          fireAt: iso(at),
          title: rTitle,
          body: rBody,
          categoryId: CATEGORY_MEDICATION,
          channelId: CHANNEL_MEDICATION,
          data: { kind: 'medication', occurrenceId: occ.id, medicationId: med.id, repeat: String(i) },
        });
      }
    }
  }
  medication.sort((a, b) => a.fireAt.localeCompare(b.fireAt));

  const hydration: PlannedNotification[] = [];
  for (const slot of input.hydrationSlots) {
    if (slot.at.getTime() <= nowMs) continue;
    const title = 'Hora de beber água';
    const body = input.preferredName ? `${input.preferredName}, que tal um copo de água agora?` : 'Que tal um copo de água agora?';
    hydration.push({
      identifier: `hyd@${slot.at.toISOString()}@${hash(title + body)}`,
      kind: 'hydration',
      fireAt: iso(slot.at),
      title,
      body,
      categoryId: CATEGORY_HYDRATION,
      channelId: CHANNEL_HYDRATION,
      data: { kind: 'hydration', slotAt: slot.at.toISOString() },
    });
  }

  const extras: PlannedNotification[] = [];
  if (input.healthReviewDue && input.healthReviewDue.getTime() > nowMs) {
    extras.push({
      identifier: `review@${input.healthReviewDue.toISOString()}`,
      kind: 'health_review',
      fireAt: iso(input.healthReviewDue),
      title: 'Suas orientações mudaram?',
      body: 'De tempos em tempos vale conferir se as orientações da sua equipe de saúde continuam as mesmas.',
      categoryId: CATEGORY_GENERIC,
      channelId: CHANNEL_GENERIC,
      data: { kind: 'health_review' },
    });
  }

  // Orçamento: medicamentos primeiro (até 70% do orçamento, mínimo 1 por dia próximo),
  // depois hidratação em ordem cronológica, depois extras se sobrar espaço.
  const medBudget = Math.min(medication.length, Math.max(Math.floor(budget * 0.7), 1));
  const plan: PlannedNotification[] = medication.slice(0, medBudget);
  const remaining = budget - plan.length;
  plan.push(...hydration.slice(0, Math.max(0, remaining - (extras.length > 0 ? 1 : 0))));
  if (plan.length < budget) plan.push(...extras.slice(0, budget - plan.length));
  // Se ainda houver espaço, completa com mais medicamentos.
  if (plan.length < budget && medication.length > medBudget) {
    plan.push(...medication.slice(medBudget, medBudget + (budget - plan.length)));
  }

  plan.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
  return dedupeByIdentifier(plan);
}

export interface Reconciliation {
  toCancel: string[];
  toSchedule: PlannedNotification[];
  unchanged: number;
}

/** Agendamento já existente no sistema. `channelId` é o canal Android gravado no gatilho (ausente no iOS). */
export interface ExistingScheduled {
  identifier: string;
  channelId?: string | null;
}

/**
 * Compara o que já está agendado no sistema (identificadores do app) com o plano desejado.
 * Só cancela/agenda a diferença: evita duplicidade após sincronização ou edição de horários.
 * Um agendamento cujo canal difere do planejado (por exemplo, canal antigo apagado após uma
 * migração) é refeito: o Android entregaria a notificação num canal genérico, sem a importância,
 * o som e a vibração configurados.
 */
export function reconcile(existingScheduled: ExistingScheduled[], plan: PlannedNotification[]): Reconciliation {
  const wanted = new Map(plan.map((p) => [p.identifier, p]));
  // Só reconcilia o que o plano gerencia; avisos únicos ("lembrar depois" da água, testes) não são cancelados aqui.
  const existing = new Map(existingScheduled.filter((e) => isPlanManagedIdentifier(e.identifier)).map((e) => [e.identifier, e] as const));
  const stale = (e: ExistingScheduled): boolean => {
    const p = wanted.get(e.identifier);
    return !p || (typeof e.channelId === 'string' && e.channelId !== p.channelId);
  };
  const toCancel = [...existing.values()].filter(stale).map((e) => e.identifier);
  const toSchedule = plan.filter((p) => {
    const e = existing.get(p.identifier);
    return !e || stale(e);
  });
  return { toCancel, toSchedule, unchanged: plan.length - toSchedule.length };
}

/** Identificadores criados por este app (inclui avisos únicos e testes). */
export function isOwnedIdentifier(id: string): boolean {
  return /^(hyd|med|review|test|snooze)@/.test(id);
}

/** Identificadores que o planejador controla e reconcilia a cada reagendamento. */
export function isPlanManagedIdentifier(id: string): boolean {
  return /^(hyd|med|review)@/.test(id);
}

function dedupeByIdentifier(list: PlannedNotification[]): PlannedNotification[] {
  const seen = new Set<string>();
  return list.filter((n) => (seen.has(n.identifier) ? false : (seen.add(n.identifier), true)));
}

export function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
