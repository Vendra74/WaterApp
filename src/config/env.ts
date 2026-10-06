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

/** URL e chave pública do projeto presentes no bundle (necessário para qualquer chamada ao servidor). */
export const hasSupabaseCredentials = (): boolean =>
  env.supabaseUrl.startsWith('https://') && env.supabaseAnonKey.length > 20;

/**
 * Compartilhamento com cuidador pronto para uso: credenciais presentes e recurso ligado. Com o
 * cuidador desligado não há conta, envio de doses nem avisos. A leitura de receita por foto não
 * depende disto: ela usa só as credenciais (ver `getSupabaseForReading`).
 */
export const isSupabaseConfigured = (): boolean => env.caregiverEnabled && hasSupabaseCredentials();
