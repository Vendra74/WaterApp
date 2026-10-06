import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '@/config/env';
import { createChunkedStorage, withLegacyMigration, type KeyValueStore } from './sessionStorage';

let client: SupabaseClient | null = null;

/**
 * Sessão guardada no armazenamento cifrado do sistema (Keystore/Keychain), em partes de até 2 KB.
 * Só neste aparelho (não vai em backup) e acessível após o primeiro desbloqueio, para que a
 * sincronização em segundo plano consiga renovar o token.
 */
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const secureStore: KeyValueStore = {
  get: (key) => SecureStore.getItemAsync(key, secureStoreOptions),
  set: (key, value) => SecureStore.setItemAsync(key, value, secureStoreOptions),
  remove: (key) => SecureStore.deleteItemAsync(key, secureStoreOptions),
};

/** Sessão no SecureStore, com migração única de quem já estava logado via AsyncStorage. */
export const sessionStorage = withLegacyMigration(createChunkedStorage(secureStore), AsyncStorage);

/**
 * Cliente Supabase. Retorna null quando não configurado (modo individual).
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
