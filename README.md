# Cuidar — lembretes de água e medicamentos para pessoas idosas

Aplicativo Android/iOS (React Native + Expo SDK 57 + TypeScript) que ajuda a manter uma rotina de
hidratação e a lembrar dos medicamentos prescritos. Interface em português do Brasil, letras
ampliáveis, alto contraste, áreas de toque grandes e leitura em voz alta dentro do app.

> O Cuidar é uma ferramenta de apoio à rotina. Não diagnostica, não prescreve, não calcula doses
> nem metas automaticamente e não substitui orientação profissional. Não é um serviço de emergência.

O nome é provisório: altere `src/config/branding.ts` (textos) e as constantes no topo de
`app.config.ts` (nome na loja, slug, bundle id).

## Estrutura

```
src/
  config/        nome do app, variáveis públicas (sem segredos)
  domain/        regras puras e testáveis: tempo, segurança do plano, hidratação, medicamentos,
                 planejador de notificações, catálogo educativo
  data/          SQLite (expo-sqlite): migrações versionadas e repositórios
  services/      casos de uso, agendador de notificações reais, tarefas em segundo plano, fala,
                 exportação/exclusão, modo demo, Supabase (auth, cuidador, fila de sincronização)
  state/         estado global (zustand) que orquestra casos de uso e reagendamento
  ui/            tema acessível e componentes base
  screens/       telas
  core/          App raiz e navegação
supabase/        migrações SQL com RLS e funções de convite/revogação (opcional)
docs/            relatório de validação e limitações
```

Interface, regras de negócio, persistência, sincronização e agendamento ficam em camadas separadas.
As regras críticas em `src/domain` não dependem de React Native e têm testes em `src/domain/__tests__`.

## Executar

Pré-requisitos: Node 20+, npm, e um **development build** (o app usa módulos nativos —
notificações com ações, SQLite, tarefas em segundo plano — que o Expo Go não cobre integralmente).

```bash
npm install
cp .env.example .env            # opcional; sem backend o modo individual funciona
npm run typecheck && npm test && npm run lint

# Development build local (precisa de Android Studio / Xcode):
npx expo run:android
npx expo run:ios

# Ou na nuvem com EAS:
npm run build:dev:android
npm run build:dev:ios
# depois: npx expo start --dev-client
```

Builds de distribuição interna/produção: `eas build --profile preview|production --platform all`
(perfis em `eas.json`). Preencha `EAS_PROJECT_ID` no `.env` ou em `app.config.ts`.

Os diretórios `android/` e `ios/` são gerados (Continuous Native Generation); não os edite à mão.

## Variáveis de ambiente

Veja `.env.example`. Só variáveis `EXPO_PUBLIC_*` (públicas) entram no app. A chave anônima do
Supabase é pública por design; a segurança vem das políticas RLS no servidor. **Nunca** coloque
service keys no app.

- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`: ativam login e compartilhamento.
- `EXPO_PUBLIC_DEMO_MODE=true`: mostra “Carregar dados de demonstração” em *Mais → Meus dados* e
  rótulos “MODO DEMONSTRAÇÃO”. Dados fictícios ficam marcados como `demo`.

## Banco de dados

- Local: SQLite (`cuidar.db`) com migrações em `src/data/migrations.ts` (`PRAGMA user_version`).
- Remoto (opcional): `supabase/migrations/0001_init.sql` — tabelas, RLS, funções
  `create_care_invite`, `accept_care_invite`, `delete_my_data`, `my_cared_people`.
  Instruções em `supabase/README.md`.

## Testes

`npm test` roda os testes Jest (`jest-expo`) das regras críticas:

- Plano individual: sem meta universal; meta só com plano profissional; “não sei”, restrição sem
  quantidade e dificuldade de deglutição bloqueiam volumes e sugestões.
- Sugestões: água sempre primeiro; frutas só no lanche, filtradas por alergia, nunca em ml.
- Hidratação: intervalos 60/90/120, janela (inclusive cruzando a meia-noite), cochilos, dias da
  semana, horários específicos, total diário, duplicidade.
- Medicamentos: horários fixos e intervalos, noturnos independentes da pausa de água, IDs
  determinísticos (sem duplicidade), confirmar duas vezes não duplica, adiar não altera as próximas
  doses, “sem confirmação” após tolerância, correção com histórico.
- Notificações: prioridade de medicamentos, orçamento da plataforma, ocultação do nome na tela
  bloqueada, adiamento, reconciliação sem duplicar nem cancelar avisos de terceiros.
- Catálogo educativo: produção só exibe conteúdo validado.

## O que funciona e o que depende de configuração externa

Veja `docs/VALIDACAO.md` para a lista completa, incluindo o que não pôde ser testado neste
ambiente (sem dispositivo físico).
