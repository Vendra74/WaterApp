import { getLocale } from './locale';
import { pt, type Strings } from './pt';
import { en } from './en';

export { getLocale, setLocale, resolveLocale, isEnglish, localeTag, type Locale } from './locale';
export type { Strings } from './pt';

/**
 * Textos da interface no idioma atual. Função (e não constante) porque o idioma é definido na
 * abertura do app, depois de os módulos carregarem. Em componentes, chame como `const s = strings();`.
 */
export function strings(): Strings {
  return getLocale() === 'en' ? en : pt;
}
