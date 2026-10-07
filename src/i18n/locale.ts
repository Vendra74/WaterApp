/**
 * Idioma da interface. Puro (sem React Native) para que o domínio e os testes possam usá-lo.
 *
 * Regra do produto: português do Brasil é o padrão; o inglês entra quando o aparelho está em inglês.
 * Qualquer outro idioma do aparelho cai no português. O idioma é definido uma vez na abertura do app
 * (ver `device.ts`) e não muda enquanto o app está aberto.
 */
export type Locale = 'pt-BR' | 'en';

export const DEFAULT_LOCALE: Locale = 'pt-BR';

let current: Locale = DEFAULT_LOCALE;

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
}

export function isEnglish(): boolean {
  return current === 'en';
}

/** Idioma do aparelho (código ISO como "en", "en-US", "pt", "pt-BR") → idioma do app. */
export function resolveLocale(languageCode: string | null | undefined): Locale {
  const code = (languageCode ?? '').toLowerCase();
  return code === 'en' || code.startsWith('en-') ? 'en' : DEFAULT_LOCALE;
}

/** Etiqueta BCP 47 usada por bibliotecas do sistema (voz, roleta de horário). */
export function localeTag(): string {
  return current === 'en' ? 'en-US' : 'pt-BR';
}
