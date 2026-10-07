import { getDb } from '@/data/db';
import { DOC_LANGUAGE, getDocument, setDocument } from '@/data/repositories/documents';
import { isLanguagePreference, type LanguagePreference, type Locale } from '@/i18n';
import { applyLanguagePreference } from '@/i18n/device';

interface LanguageDoc { preference: LanguagePreference }

export async function loadLanguagePreference(): Promise<LanguagePreference> {
  const db = await getDb();
  const doc = await getDocument<Partial<LanguageDoc>>(db, DOC_LANGUAGE);
  return isLanguagePreference(doc?.preference) ? doc.preference : 'auto';
}

export async function saveLanguagePreference(preference: LanguagePreference): Promise<void> {
  const db = await getDb();
  await setDocument<LanguageDoc>(db, DOC_LANGUAGE, { preference });
}

/**
 * Lê a preferência gravada e aplica. Chamado na abertura do app (antes das telas) e nas tarefas em
 * segundo plano antes de gerar texto de notificação, já que elas rodam sem passar pela tela.
 */
export async function applyStoredLanguage(): Promise<{ preference: LanguagePreference; locale: Locale }> {
  const preference = await loadLanguagePreference().catch(() => 'auto' as const);
  return { preference, locale: applyLanguagePreference(preference) };
}
