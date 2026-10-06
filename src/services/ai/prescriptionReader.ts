import { getDb } from '@/data/db';
import { DOC_AI_CONSENT, getDocument, setDocument } from '@/data/repositories/documents';
import { isSupabaseConfigured } from '@/config/env';
import { getSupabase } from '@/services/sync/supabaseClient';
import { normalizePrescriptionDraft, type PrescriptionDraft } from '@/domain/medication/prescriptionDraft';

/**
 * Leitura de receita por foto. A imagem vai para a Edge Function `ler-receita` (que guarda a chave
 * da API) e volta como rascunho normalizado pelo domínio. Nada é salvo sem a pessoa conferir.
 */
export const CONSENT_TEXT_AI =
  'Para preencher o cadastro, a foto da receita ou da caixa é enviada ao servidor do Cuidar e ao serviço de inteligência artificial que faz a leitura. A imagem é usada só para isso e não fica guardada. O resultado é um rascunho: você confere cada campo antes de salvar. Você pode retirar esta autorização em Mais → Meus dados.';

export function isPrescriptionReadingAvailable(): boolean {
  return isSupabaseConfigured();
}

export async function hasAiConsent(): Promise<boolean> {
  const doc = await getDocument<{ acceptedAt: string }>(await getDb(), DOC_AI_CONSENT);
  return !!doc?.acceptedAt;
}

export async function setAiConsent(accepted: boolean): Promise<void> {
  const db = await getDb();
  await setDocument(db, DOC_AI_CONSENT, accepted ? { acceptedAt: new Date().toISOString() } : {});
}

export type ReadPrescriptionResult = { ok: true; draft: PrescriptionDraft } | { ok: false; error: string };

export async function readPrescriptionPhoto(imageBase64: string, mediaType = 'image/jpeg'): Promise<ReadPrescriptionResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Leitura por foto não configurada neste build.' };
  if (!(await hasAiConsent())) return { ok: false, error: 'Autorização necessária.' };

  // Sessão: a existente (conta do cuidador) ou uma anônima só para autorizar a chamada.
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) return { ok: false, error: 'Não foi possível conectar ao serviço de leitura.' };
  }

  const { data, error } = await sb.functions.invoke<{ draft?: unknown; error?: string }>('ler-receita', { body: { imageBase64, mediaType } });
  if (error) {
    const detail = await describeInvokeError(error);
    return { ok: false, error: detail ?? 'Falha ao ler a foto. Tente de novo com mais luz e a receita inteira na imagem.' };
  }
  if (!data || data.error) return { ok: false, error: data?.error ?? 'Resposta vazia do serviço.' };
  const draft = normalizePrescriptionDraft(data.draft);
  if (!draft.readable) return { ok: false, error: draft.notes || 'Não foi possível identificar um medicamento na foto. Tente aproximar e focar no nome.' };
  return { ok: true, draft };
}

/** A função devolve { error } com status 4xx/5xx; supabase-js embute a Response no erro. */
async function describeInvokeError(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
  try {
    const body = await ctx?.json?.();
    return body?.error ?? null;
  } catch {
    return null;
  }
}
