/**
 * Quais notificações já exibidas ficam obsoletas quando chega uma nova.
 *
 * Sem isso, lembretes antigos se acumulam na barra e o Android os agrupa: na tela bloqueada
 * (por exemplo, no carrossel de ícones da Motorola) aparece um grupo recolhido em vez do
 * lembrete atual com seus botões. Regras:
 * - um lembrete de água substitui os de água anteriores (o pedido atual é o que vale);
 * - a repetição de "medicamento ainda não confirmado" substitui o aviso original da mesma
 *   ocorrência, e nunca o de outra dose ou outro remédio;
 * - uma notificação de teste substitui os testes anteriores;
 * - nada mais é dispensado (revisão de saúde, tipos desconhecidos).
 */
export interface PresentedLike {
  identifier: string;
  data: Record<string, unknown> | null | undefined;
}

function field(n: PresentedLike, key: string): string {
  const v = n.data?.[key];
  return typeof v === 'string' ? v : '';
}

export function selectSuperseded(received: PresentedLike, presented: PresentedLike[]): string[] {
  const kind = field(received, 'kind');
  const others = presented.filter((p) => p.identifier !== received.identifier);
  if (kind === 'hydration' || kind === 'test') {
    return others.filter((p) => field(p, 'kind') === kind).map((p) => p.identifier);
  }
  if (kind === 'medication') {
    const occurrenceId = field(received, 'occurrenceId');
    if (!occurrenceId) return [];
    return others.filter((p) => field(p, 'kind') === 'medication' && field(p, 'occurrenceId') === occurrenceId).map((p) => p.identifier);
  }
  return [];
}
