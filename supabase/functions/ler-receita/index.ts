// Edge Function (Deno) do Cuidar: lê uma foto de receita ou caixa de remédio e devolve um RASCUNHO
// de cadastro em JSON. A chave da API fica aqui no servidor (secret ANTHROPIC_API_KEY), nunca no app.
//
// Regras do produto que esta função garante:
//  - só transcreve o que está escrito; nunca sugere dose, horário ou "compensar" dose;
//  - a imagem não é guardada: vai para o modelo e é descartada;
//  - exige usuário autenticado (sessão anônima do app serve) e limita leituras por dia por usuário.
//
// Deploy: `npx supabase functions deploy ler-receita` e `npx supabase secrets set ANTHROPIC_API_KEY=...`.
// Ver supabase/README.md.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = Deno.env.get('MODELO_LEITURA') ?? 'claude-opus-5-5';
const LEITURAS_POR_DIA = Number(Deno.env.get('LEITURAS_POR_DIA') ?? '20');
const MAX_BASE64 = 6_000_000; // ~4,5 MB de imagem

// O app informa o idioma da interface (`language`: "pt-BR" ou "en"). A transcrição copia a receita como
// está, em qualquer idioma; só as observações ("notes") são escritas no idioma do app.
type Idioma = 'pt-BR' | 'en';

const SISTEMA = (idioma: Idioma) => `Você transcreve informações de uma foto de receita médica ou de caixa de medicamento para preencher um rascunho de cadastro que a pessoa vai conferir campo a campo. A receita pode estar em português ou em inglês.

Regras obrigatórias:
- Copie apenas o que está escrito na imagem. Não deduza, não complete e não corrija nada.
- Se um campo não estiver legível ou não existir na imagem, deixe-o vazio ("" ou null ou []).
- Nunca sugira dose, horário, frequência ou substituição. Nunca dê orientação de saúde.
- "name": nome do medicamento como escrito (princípio ativo ou marca). "presentation": forma e concentração (ex.: "comprimido 50 mg", "xarope 5 mg/ml").
- "doseAmount": quantidade por tomada como escrita (ex.: "1", "meio", "10"); "doseUnit": unidade (comprimido, ml, gotas, cápsula...).
- "route": via como escrita (oral, tópica, ocular, inalatória, injetável...).
- "times": horários explícitos no formato "HH:mm" (24 h) SOMENTE se a receita escrever horários. "intervalHours": número de horas se a receita disser "de X em X horas". Se disser apenas "2 vezes ao dia" sem horários, deixe ambos vazios e explique em "notes".
- "instructions": instruções do prescritor (com alimento, em jejum, duração do tratamento...), como escritas.
- "readable": true se você identificou pelo menos o nome de um medicamento; false caso contrário.
- "notes": em uma ou duas frases, o que não ficou claro ou o que a pessoa deve conferir. Se a foto tiver mais de um medicamento, transcreva só o primeiro e avise em "notes".
- Escreva "notes" ${idioma === 'en' ? 'em inglês (English)' : 'em português do Brasil'}. Os demais campos copiam o texto da imagem como está, sem traduzir.`;

const FORMATO = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      presentation: { type: 'string' },
      doseAmount: { type: 'string' },
      doseUnit: { type: 'string' },
      route: { type: 'string' },
      times: { type: 'array', items: { type: 'string' } },
      intervalHours: { type: ['integer', 'null'] },
      instructions: { type: 'string' },
      readable: { type: 'boolean' },
      notes: { type: 'string' },
    },
    required: ['name', 'presentation', 'doseAmount', 'doseUnit', 'route', 'times', 'intervalHours', 'instructions', 'readable', 'notes'],
    additionalProperties: false,
  },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Erro com código estável (o app traduz pelo `code`) e mensagem em português (compatível com apps antigos). */
const erro = (status: number, code: string, error: string) => json(status, { code, error });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'método não permitido' });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json(500, { error: 'ANTHROPIC_API_KEY não configurada no servidor' });

  // Usuário autenticado (o app usa sessão anônima do Supabase só para isto).
  const auth = req.headers.get('Authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json(401, { error: 'não autenticado' });
  const userId = userData.user.id;

  // Limite diário por usuário (evita abuso da chave): registra só a data, nunca a imagem.
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await admin.from('leituras_receita').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since);
  if ((count ?? 0) >= LEITURAS_POR_DIA) return erro(429, 'daily_limit', 'limite diário de leituras atingido; tente amanhã');

  let body: { imageBase64?: string; mediaType?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'corpo inválido' });
  }
  const imageBase64 = body.imageBase64 ?? '';
  const mediaType = body.mediaType ?? 'image/jpeg';
  const idioma: Idioma = body.language === 'en' ? 'en' : 'pt-BR';
  if (!imageBase64 || imageBase64.length > MAX_BASE64) return erro(400, 'image_too_large', 'imagem ausente ou grande demais');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) return erro(400, 'image_format', 'formato de imagem não aceito');

  await admin.from('leituras_receita').insert({ user_id: userId });

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: 'low', format: FORMATO },
      system: SISTEMA(idioma),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: imageBase64 } },
            { type: 'text', text: idioma === 'en' ? 'Transcribe the medication in this photo in the requested format.' : 'Transcreva o medicamento desta foto no formato pedido.' },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal') return erro(422, 'refused', 'o serviço não conseguiu processar esta imagem');
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return erro(502, 'read_failed', 'resposta vazia do modelo');
    return json(200, { draft: JSON.parse(text.text) });
  } catch (e) {
    const status = e instanceof Anthropic.RateLimitError ? 429 : e instanceof Anthropic.APIError ? 502 : 500;
    const message = e instanceof Error ? e.message : String(e);
    console.error('ler-receita', status, message);
    return status === 429 ? erro(429, 'busy', 'serviço ocupado; tente de novo em instantes') : erro(status, 'read_failed', 'falha ao ler a imagem');
  }
});
