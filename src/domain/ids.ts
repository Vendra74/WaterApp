/**
 * Geração de identificadores sem dependência nativa (usável em testes).
 * Em produção, expo-crypto está disponível, mas este gerador é suficiente para IDs locais.
 */
export function newId(prefix = ''): string {
  const rand = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `${prefix}${Date.now().toString(16)}-${rand()}-${rand()}`;
}
