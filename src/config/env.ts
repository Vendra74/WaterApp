/**
 * Variáveis públicas (EXPO_PUBLIC_*) são embutidas no bundle. Nunca coloque segredos aqui.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  demoMode: (process.env.EXPO_PUBLIC_DEMO_MODE ?? 'false').toLowerCase() === 'true',
};

export const isSupabaseConfigured = (): boolean =>
  env.supabaseUrl.startsWith('https://') && env.supabaseAnonKey.length > 20;
