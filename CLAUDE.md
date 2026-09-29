# Cuidar — notas para desenvolvimento

- Expo SDK 57 + TypeScript. Sem Expo Router: navegação em `src/core/App.tsx` (React Navigation).
- Regras de negócio ficam em `src/domain` (puras, testadas). UI nunca calcula regras de segurança.
- Comandos: `npm run typecheck`, `npm test`, `npm run lint`. Rode os três antes de concluir.
- Nunca edite `android/` ou `ios/` (gerados). Configuração nativa em `app.config.ts`.
- Não adicionar metas automáticas, conversões de fruta em ml nem recomendações clínicas.
- Textos da interface em pt-BR; use aspas tipográficas “ ” em JSX.
