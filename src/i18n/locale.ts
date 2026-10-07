/**
 * Idioma da interface. Puro (sem React Native) para que o domínio e os testes possam usá-lo.
 *
 * Regra do produto: português do Brasil é o padrão; o inglês entra quando o aparelho está em inglês.
 * Qualquer outro idioma do aparelho cai no português. A pessoa pode fixar o idioma em
 * Mais → Idioma (preferência gravada no aparelho; ver `services/usecases/language.ts`).
 */
export type Locale = 'pt-BR' | 'en';

/** Escolha da pessoa: seguir o aparelho ou um idioma fixo. */
export type LanguagePreference = 'auto' | Locale;

export const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = ['auto', 'pt-BR', 'en'];

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return typeof value === 'string' && (LANGUAGE_PREFERENCES as readonly string[]).includes(value);
}

/** Preferência gravada + idioma do aparelho → idioma do app. */
export function resolvePreference(preference: LanguagePreference, deviceLanguageCode: string | null | undefined): Locale {
  return preference === 'auto' ? resolveLocale(deviceLanguageCode) : preference;
}

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
