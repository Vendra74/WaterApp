import { createResponseDeduper, responseKey } from '../notifications/responseDedupe';

const resp = (id: string, action = 'open', date = 1000) => ({ actionIdentifier: action, notification: { date, request: { identifier: id } } });

describe('deduplicação de respostas de notificação', () => {
  it('chave distingue notificação, ação e instante', () => {
    expect(responseKey(resp('a'))).toBe(responseKey(resp('a')));
    expect(responseKey(resp('a'))).not.toBe(responseKey(resp('a', 'taken')));
    expect(responseKey(resp('a'))).not.toBe(responseKey(resp('a', 'open', 2000)));
  });

  it('a mesma resposta não é tratada duas vezes; respostas diferentes passam', () => {
    const d = createResponseDeduper();
    const k1 = responseKey(resp('a'));
    expect(d.begin(k1)).toBe(true);
    expect(d.begin(k1)).toBe(false); // em andamento
    d.commit(k1);
    expect(d.begin(k1)).toBe(false); // já tratada
    expect(d.begin(responseKey(resp('b')))).toBe(true);
  });

  it('falha libera a chave para nova tentativa', () => {
    const d = createResponseDeduper();
    const k = responseKey(resp('a'));
    expect(d.begin(k)).toBe(true);
    d.rollback(k);
    expect(d.begin(k)).toBe(true);
  });
});
