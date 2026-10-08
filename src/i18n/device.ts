import { getLocales } from 'expo-localization';
import { resolvePreference, setLocale, type LanguagePreference, type Locale } from './locale';

/** Código do idioma do aparelho ("en", "pt", ...) ou undefined quando o módulo nativo não responde. */
export function deviceLanguageCode(): string | undefined {
  try {
    return getLocales()[0]?.languageCode ?? undefined;
  } catch {
    return undefined; // módulo nativo indisponível (testes, web sem suporte): fica o padrão
  }
}

/**
 * Define o idioma do app a partir do idioma do aparelho. Chamado uma vez, no carregamento do
 * módulo de entrada, antes de qualquer tela ou tarefa em segundo plano gerar texto. A preferência
 * gravada pela pessoa é aplicada logo depois, assim que o banco abre (`applyStoredLanguage`).
 */
export function initLocaleFromDevice(): Locale {
  return applyLanguagePreference('auto');
}

/** Aplica a escolha da pessoa (ou o idioma do aparelho, em "auto") e devolve o idioma resultante. */
export function applyLanguagePreference(preference: LanguagePreference): Locale {
  const locale = resolvePreference(preference, deviceLanguageCode());
  setLocale(locale);
  return locale;
}
