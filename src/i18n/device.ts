import { getLocales } from 'expo-localization';
import { resolveLocale, setLocale, type Locale } from './locale';

/**
 * Define o idioma do app a partir do idioma do aparelho. Chamado uma vez, no carregamento do
 * módulo de entrada, antes de qualquer tela ou tarefa em segundo plano gerar texto.
 */
export function initLocaleFromDevice(): Locale {
  let code: string | undefined;
  try {
    code = getLocales()[0]?.languageCode ?? undefined;
  } catch {
    code = undefined; // módulo nativo indisponível (testes, web sem suporte): fica o padrão
  }
  const locale = resolveLocale(code);
  setLocale(locale);
  return locale;
}
