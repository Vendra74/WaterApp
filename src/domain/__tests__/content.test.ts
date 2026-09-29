import { CONTENT_CATALOG, visibleContent } from '../content/catalog';

describe('catálogo educativo', () => {
  it('produção mostra apenas conteúdo validado', () => {
    const prod = visibleContent(CONTENT_CATALOG, false);
    expect(prod.every((c) => c.status === 'validated')).toBe(true);
    expect(prod.every((c) => c.source.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(c.reviewedAt))).toBe(true);
  });
  it('modo demo pode exibir rascunhos', () => {
    expect(visibleContent(CONTENT_CATALOG, true).some((c) => c.status === 'draft')).toBe(true);
  });
});
