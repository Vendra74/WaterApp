/**
 * Armazenamento da sessão de autenticação em partes pequenas, para caber no limite
 * de 2 KB por item do SecureStore (cifrado pelo sistema: Keystore no Android, Keychain no iOS).
 *
 * Lógica pura, sem módulos nativos: a persistência real é injetada via `KeyValueStore`.
 */

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Interface mínima esperada pelo `auth.storage` do supabase-js. */
export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Tamanho de cada parte em unidades UTF-16. No pior caso (3 bytes por unidade em UTF-8),
 * 600 unidades ocupam 1800 bytes, abaixo do limite de 2048 bytes do SecureStore.
 */
export const DEFAULT_CHUNK_SIZE = 600;

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

const parseCount = (raw: string | null): number | null => {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

export const splitIntoChunks = (value: string, chunkSize = DEFAULT_CHUNK_SIZE): string[] => {
  if (chunkSize < 1) throw new Error('chunkSize deve ser maior que zero');
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += chunkSize) chunks.push(value.slice(i, i + chunkSize));
  return chunks;
};

const removeChunks = async (store: KeyValueStore, key: string, from: number, to: number) => {
  for (let i = from; i < to; i++) await store.remove(chunkKey(key, i));
};

/**
 * Divide cada valor em partes `key.0`, `key.1`, … e guarda a quantidade em `key.n`.
 * Se alguma parte estiver faltando (escrita interrompida), o valor é tratado como ausente.
 */
export function createChunkedStorage(store: KeyValueStore, chunkSize = DEFAULT_CHUNK_SIZE): SessionStorage {
  return {
    async getItem(key) {
      const count = parseCount(await store.get(countKey(key)));
      if (count === null) return null;
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await store.get(chunkKey(key, i));
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(key, value) {
      const previous = parseCount(await store.get(countKey(key))) ?? 0;
      const chunks = splitIntoChunks(value, chunkSize);
      await Promise.all(chunks.map((chunk, i) => store.set(chunkKey(key, i), chunk)));
      await store.set(countKey(key), String(chunks.length));
      await removeChunks(store, key, chunks.length, previous);
    },

    async removeItem(key) {
      const count = parseCount(await store.get(countKey(key))) ?? 0;
      await store.remove(countKey(key));
      await removeChunks(store, key, 0, count);
    },
  };
}

/**
 * Migração única: se a sessão ainda não existe no armazenamento seguro, busca no armazenamento
 * antigo (AsyncStorage), copia para o seguro e apaga do antigo. Evita deslogar quem já usava o app.
 */
export function withLegacyMigration(secure: SessionStorage, legacy: SessionStorage): SessionStorage {
  return {
    async getItem(key) {
      const current = await secure.getItem(key);
      if (current !== null) return current;
      const old = await legacy.getItem(key);
      if (old === null) return null;
      await secure.setItem(key, old);
      await legacy.removeItem(key);
      return old;
    },
    setItem: (key, value) => secure.setItem(key, value),
    async removeItem(key) {
      await secure.removeItem(key);
      await legacy.removeItem(key);
    },
  };
}
