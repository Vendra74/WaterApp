import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabaseCredentials, isSupabaseConfigured } from '@/config/env';

let client: SupabaseClient | null = null;

/**
 * Cliente Supabase. Retorna null quando não configurado (modo individual).
 * A sessão é persistida em AsyncStorage (padrão da documentação Supabase para Expo).
 * Endurecimento pendente: cifrar a sessão com chave em SecureStore (limite de 2 KB por item).
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return getSupabaseForReading();
}

/**
 * Cliente só com as credenciais, sem exigir o cuidador ligado. Usado pela leitura de receita por
 * foto, que tem autorização própria da pessoa. Nenhum serviço de sincronização deve usar este.
 */
export function getSupabaseForReading(): SupabaseClient | null {
  if (!hasSupabaseCredentials()) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
