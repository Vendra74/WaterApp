import type { EducationalContent } from '../types';
import { strings } from '@/i18n';

/**
 * Catálogo editável de conteúdo educativo. Cada item tem fonte, data de revisão e status.
 * Somente itens `validated` aparecem em produção. Itens `draft` ficam visíveis apenas em modo demo,
 * com rótulo "não validado". Nenhum conteúdo aqui é recomendação clínica individual.
 */
export const CONTENT_CATALOG: EducationalContent[] = [
  {
    id: 'water-default',
    title: 'Por que a água é a opção padrão?',
    body: 'Neste aplicativo, água é sempre a primeira sugestão para os lembretes. Outras bebidas e frutas aparecem apenas como complemento, quando compatíveis com o que você informou. O aplicativo não calcula quantas gramas de fruta "valem" em líquido.',
    source: 'Texto do produto (não clínico). Revisão editorial interna.',
    reviewedAt: '2026-09-01',
    status: 'validated',
    tags: ['hidratação'],
  },
  {
    id: 'no-universal-goal',
    title: 'Por que não existe uma meta única para todo mundo?',
    body: 'A quantidade de líquidos adequada varia de pessoa para pessoa e pode ser limitada por algumas condições de saúde. Por isso o aplicativo não fixa "2 litros" nem calcula metas por idade ou peso. Se você tem uma orientação da sua equipe de saúde, cadastre-a em Perfil e plano.',
    source: 'Texto do produto (não clínico). Revisão editorial interna.',
    reviewedAt: '2026-09-01',
    status: 'validated',
    tags: ['hidratação', 'segurança'],
  },
  {
    id: 'medication-safety',
    title: 'Como o aplicativo trata seus medicamentos',
    body: 'O aplicativo lembra os horários exatamente como você cadastrou a partir da prescrição. Ele não sugere doses, não indica interações e não orienta "compensar" uma dose esquecida. Em caso de dúvida sobre uma dose não tomada, fale com quem prescreveu.',
    source: 'Texto do produto (não clínico). Revisão editorial interna.',
    reviewedAt: '2026-09-01',
    status: 'validated',
    tags: ['medicamentos', 'segurança'],
  },
  {
    id: 'not-emergency',
    title: 'Este aplicativo não é um serviço de emergência',
    body: 'O botão "Preciso de ajuda" apenas facilita ligar para contatos que você escolheu. Ninguém monitora o aplicativo em tempo real. Em emergência, ligue para o SAMU (192) ou o serviço local.',
    source: 'Texto do produto. Número do SAMU conforme divulgação pública do Ministério da Saúde.',
    reviewedAt: '2026-09-01',
    status: 'validated',
    tags: ['segurança'],
  },
  {
    id: 'draft-heat',
    title: 'Dias quentes (rascunho, não validado)',
    body: 'Rascunho aguardando revisão de profissional de saúde. Não exibido em produção.',
    source: 'Pendente',
    reviewedAt: '2026-09-01',
    status: 'draft',
    tags: ['hidratação'],
  },
];

export function visibleContent(catalog: EducationalContent[], demoMode: boolean): EducationalContent[] {
  return catalog.filter((c) => c.status === 'validated' || (demoMode && c.status === 'draft'));
}

/**
 * Catálogo com título, texto e fonte no idioma atual. Os metadados (id, data de revisão, status,
 * etiquetas) vêm de `CONTENT_CATALOG`; o texto em português acima é a referência editorial e o
 * inglês fica em `src/i18n/en.ts`. Um item sem tradução mantém o texto em português.
 */
export function localizedContent(catalog: EducationalContent[] = CONTENT_CATALOG): EducationalContent[] {
  const texts = strings().content.items;
  return catalog.map((c) => {
    const t = texts[c.id];
    return t ? { ...c, title: t.title, body: t.body, source: t.source } : c;
  });
}
