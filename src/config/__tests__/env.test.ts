/**
 * A leitura de receita por foto não pode depender do cuidador estar ligado: em 06/10/2026 o build
 * saiu com o cartão “Preencher pela foto” escondido porque `isSupabaseConfigured` exigia o cuidador.
 */
const URL = 'https://exemplo.supabase.co';
const KEY = 'chave-publica-de-teste-com-mais-de-20-caracteres';

type EnvModule = typeof import('../env');

function loadEnv(vars: Record<string, string | undefined>): EnvModule {
  for (const k of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_CAREGIVER_ENABLED']) {
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  let m: EnvModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    m = require('../env') as EnvModule;
  });
  return m!;
}

describe('credenciais do Supabase e cuidador', () => {
  it('com credenciais e cuidador desligado, a leitura por foto fica disponível e a sincronização não', () => {
    const m = loadEnv({ EXPO_PUBLIC_SUPABASE_URL: URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: KEY, EXPO_PUBLIC_CAREGIVER_ENABLED: 'false' });
    expect(m.hasSupabaseCredentials()).toBe(true);
    expect(m.isSupabaseConfigured()).toBe(false);
  });

  it('com credenciais e cuidador ligado, as duas ficam disponíveis', () => {
    const m = loadEnv({ EXPO_PUBLIC_SUPABASE_URL: URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: KEY, EXPO_PUBLIC_CAREGIVER_ENABLED: 'true' });
    expect(m.hasSupabaseCredentials()).toBe(true);
    expect(m.isSupabaseConfigured()).toBe(true);
  });

  it('sem credenciais nada fica disponível, mesmo com o cuidador ligado', () => {
    const m = loadEnv({ EXPO_PUBLIC_CAREGIVER_ENABLED: 'true' });
    expect(m.hasSupabaseCredentials()).toBe(false);
    expect(m.isSupabaseConfigured()).toBe(false);
  });
});
