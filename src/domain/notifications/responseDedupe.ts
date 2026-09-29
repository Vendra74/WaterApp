/**
 * Deduplicação de respostas de notificação. Uma mesma resposta pode chegar duas vezes ao JS
 * (listener em tempo real + "última resposta" consultada ao abrir o app). Guardamos apenas a
 * chave da última resposta tratada com sucesso: a duplicata é sempre a imediatamente anterior.
 */
export interface ResponseLike {
  actionIdentifier: string;
  notification: { date: number; request: { identifier: string } };
}

export function responseKey(r: ResponseLike): string {
  return `${r.notification.request.identifier}|${r.actionIdentifier}|${r.notification.date}`;
}

export interface ResponseDeduper {
  /** Reserva a chave para processamento. Retorna false se já foi tratada ou está em andamento. */
  begin: (key: string) => boolean;
  /** Marca como tratada com sucesso. */
  commit: (key: string) => void;
  /** Libera a chave após falha, permitindo nova tentativa. */
  rollback: (key: string) => void;
}

export function createResponseDeduper(): ResponseDeduper {
  let lastHandled: string | null = null;
  let inFlight: string | null = null;
  return {
    begin: (key) => {
      if (key === lastHandled || key === inFlight) return false;
      inFlight = key;
      return true;
    },
    commit: (key) => {
      lastHandled = key;
      if (inFlight === key) inFlight = null;
    },
    rollback: (key) => {
      if (inFlight === key) inFlight = null;
    },
  };
}
