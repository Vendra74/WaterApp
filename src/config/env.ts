/**
 * Variáveis públicas (EXPO_PUBLIC_*) são embutidas no bundle. Nunca coloque segredos aqui.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /**
   * Compartilhamento com cuidador (conta, convite, envio ao servidor). Desligado nesta versão: o
   * login depende de e-mail com código, que exige um serviço de e-mail próprio ainda não contratado.
   */
  caregiverEnabled: (process.env.EXPO_PUBLIC_CAREGIVER_ENABLED ?? 'false').toLowerCase() === 'true',
  demoMode: (process.env.EXPO_PUBLIC_DEMO_MODE ?? 'false').toLowerCase() === 'true',
};

/** Com o cuidador desligado o app não fala com o servidor: nada de conta, envio ou aviso. */
export const isSupabaseConfigured = (): boolean =>
  env.caregiverEnabled && env.supabaseUrl.startsWith('https://') && env.supabaseAnonKey.length > 20;
