import { getDb } from '@/data/db';
import { DOC_AI_CONSENT, getDocument, setDocument } from '@/data/repositories/documents';
import { hasSupabaseCredentials } from '@/config/env';
import { getSupabaseForReading } from '@/services/sync/supabaseClient';
import { normalizePrescriptionDraft, type PrescriptionDraft } from '@/domain/medication/prescriptionDraft';
import { getLocale, strings } from '@/i18n';

/**
 * Leitura de receita por foto. A imagem vai para a Edge Function `ler-receita` (que guarda a chave
 * da API) e volta como rascunho normalizado pelo domínio. Nada é salvo sem a pessoa conferir.
 */
export const consentTextAi = (): string => strings().prescription.consent;

/** Disponível sempre que o bundle tem as credenciais do projeto, mesmo com o cuidador desligado. */
export function isPrescriptionReadingAvailable(): boolean {
  return hasSupabaseCredentials();
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
  const s = strings().prescription;
  const sb = getSupabaseForReading();
  if (!sb) return { ok: false, error: s.notConfigured };
  if (!(await hasAiConsent())) return { ok: false, error: s.consentRequired };

  // Sessão: a existente (conta do cuidador) ou uma anônima só para autorizar a chamada.
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) return { ok: false, error: s.connectFailed };
  }

  // `language` diz à função em que idioma escrever as observações ("notes"); a transcrição copia a receita como está.
  const { data, error } = await sb.functions.invoke<ServerResponse>('ler-receita', { body: { imageBase64, mediaType, language: getLocale() } });
  if (error) {
    const detail = await describeInvokeError(error);
    return { ok: false, error: detail ?? s.readFailed };
  }
  if (!data || data.error) return { ok: false, error: data ? localizeServerError(data) : s.emptyResponse };
  const draft = normalizePrescriptionDraft(data.draft);
  if (!draft.readable) return { ok: false, error: draft.notes || s.notIdentified };
  return { ok: true, draft };
}

interface ServerResponse {
  draft?: unknown;
  /** Mensagem em português (compatível com versões anteriores da função). */
  error?: string;
  /** Código estável do erro, traduzido pelo app (ver `strings().prescription.serverError`). */
  code?: string;
}

/** Mensagem de erro do servidor no idioma do app; sem código conhecido, mostra o texto que veio. */
function localizeServerError(body: ServerResponse): string {
  const byCode = body.code ? strings().prescription.serverError[body.code] : undefined;
  return byCode ?? body.error ?? strings().prescription.emptyResponse;
}

/** A função devolve { error, code } com status 4xx/5xx; supabase-js embute a Response no erro. */
async function describeInvokeError(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: { json?: () => Promise<ServerResponse> } }).context;
  try {
    const body = await ctx?.json?.();
    return body && (body.code || body.error) ? localizeServerError(body) : null;
  } catch {
    return null;
  }
}
