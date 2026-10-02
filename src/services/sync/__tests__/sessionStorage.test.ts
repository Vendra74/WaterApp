import {
  createChunkedStorage,
  DEFAULT_CHUNK_SIZE,
  splitIntoChunks,
  withLegacyMigration,
  type KeyValueStore,
  type SessionStorage,
} from '../sessionStorage';

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    remove: async (k) => void data.delete(k),
  };
};

const simpleStorage = (): SessionStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
};

const KEY = 'sb-projeto-auth-token';

describe('armazenamento da sessão em partes', () => {
  it('cada parte respeita o limite de 2 KB mesmo com caracteres de 3 bytes', () => {
    const value = 'ç'.repeat(5000);
    const chunks = splitIntoChunks(value);
    expect(chunks.join('')).toBe(value);
    for (const c of chunks) expect(new TextEncoder().encode(c).length).toBeLessThanOrEqual(2048);
    expect(chunks.length).toBe(Math.ceil(5000 / DEFAULT_CHUNK_SIZE));
  });

  it('grava e lê de volta um valor maior que 2 KB', async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    const session = JSON.stringify({ access_token: 'a'.repeat(3000), refresh_token: 'r'.repeat(100) });
    await storage.setItem(KEY, session);
    expect(await storage.getItem(KEY)).toBe(session);
    expect(store.data.get(`${KEY}.n`)).toBe(String(Math.ceil(session.length / DEFAULT_CHUNK_SIZE)));
  });

  it('valor ausente retorna null', async () => {
    expect(await createChunkedStorage(memoryStore()).getItem(KEY)).toBeNull();
  });

  it('valor vazio é preservado', async () => {
    const storage = createChunkedStorage(memoryStore());
    await storage.setItem(KEY, '');
    expect(await storage.getItem(KEY)).toBe('');
  });

  it('sobrescrever com valor menor apaga as partes antigas', async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store, 4);
    await storage.setItem(KEY, 'abcdefghij'); // 3 partes
    await storage.setItem(KEY, 'xy'); // 1 parte
    expect(await storage.getItem(KEY)).toBe('xy');
    expect([...store.data.keys()].sort()).toEqual([`${KEY}.0`, `${KEY}.n`]);
  });

  it('remover apaga todas as partes e o contador', async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store, 4);
    await storage.setItem(KEY, 'abcdefghij');
    await storage.removeItem(KEY);
    expect(store.data.size).toBe(0);
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('parte faltando (escrita interrompida) é tratada como sessão ausente', async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store, 4);
    await storage.setItem(KEY, 'abcdefghij');
    store.data.delete(`${KEY}.1`);
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('contador inválido é tratado como sessão ausente', async () => {
    const store = memoryStore();
    store.data.set(`${KEY}.n`, 'abc');
    expect(await createChunkedStorage(store).getItem(KEY)).toBeNull();
  });

  it('chaves diferentes não se misturam', async () => {
    const storage = createChunkedStorage(memoryStore(), 4);
    await storage.setItem(KEY, 'sessao-1');
    await storage.setItem(`${KEY}-code-verifier`, 'verificador');
    expect(await storage.getItem(KEY)).toBe('sessao-1');
    expect(await storage.getItem(`${KEY}-code-verifier`)).toBe('verificador');
  });
});

describe('migração do armazenamento antigo', () => {
  it('move a sessão do antigo para o seguro na primeira leitura', async () => {
    const secure = simpleStorage();
    const legacy = simpleStorage();
    legacy.data.set(KEY, 'sessao-antiga');
    const storage = withLegacyMigration(secure, legacy);
    expect(await storage.getItem(KEY)).toBe('sessao-antiga');
    expect(secure.data.get(KEY)).toBe('sessao-antiga');
    expect(legacy.data.has(KEY)).toBe(false);
  });

  it('prefere a sessão já existente no seguro', async () => {
    const secure = simpleStorage();
    const legacy = simpleStorage();
    secure.data.set(KEY, 'nova');
    legacy.data.set(KEY, 'antiga');
    expect(await withLegacyMigration(secure, legacy).getItem(KEY)).toBe('nova');
    expect(legacy.data.get(KEY)).toBe('antiga');
  });

  it('sem sessão em nenhum dos dois retorna null', async () => {
    expect(await withLegacyMigration(simpleStorage(), simpleStorage()).getItem(KEY)).toBeNull();
  });

  it('gravar só escreve no seguro; remover limpa os dois', async () => {
    const secure = simpleStorage();
    const legacy = simpleStorage();
    legacy.data.set(KEY, 'antiga');
    const storage = withLegacyMigration(secure, legacy);
    await storage.setItem(KEY, 'nova');
    expect(secure.data.get(KEY)).toBe('nova');
    expect(legacy.data.get(KEY)).toBe('antiga');
    await storage.removeItem(KEY);
    expect(secure.data.has(KEY)).toBe(false);
    expect(legacy.data.has(KEY)).toBe(false);
  });
});
