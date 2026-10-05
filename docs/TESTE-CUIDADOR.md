# Teste do cuidador com duas contas reais

Roteiro e resultados do teste de compartilhamento: vínculo, aviso “sem confirmação” e sessão.
Aparelho do titular: Motorola Edge 50 Pro (Android 16), development build do `main`.

## Estado em 05/10/2026

O servidor existe e foi validado de ponta a ponta com duas contas temporárias (tabela de
resultados no fim). **O teste nos aparelhos, com as contas reais, ainda não foi executado.**

- Projeto Supabase “cuidar” (São Paulo, ref `vqpvazseakezfsivxtgq`), criado em 05/10/2026 na
  organização do Andre. A senha do banco está no Chaves do Mac dele, item
  `supabase-cuidar-db-password`.
- Migrações `0001_init.sql` e `0002_convite_pgcrypto.sql` aplicadas com `supabase db push`.
- Código de login com 6 dígitos (`supabase/config.toml`, aplicado com `supabase config push`;
  o padrão do Supabase era 8, e o app pede 6).
- `.env` na pasta do projeto no Mac (não versionado) com a URL e a chave pública.

**Pendência: e-mail do código.** O e-mail padrão do Supabase traz só um link, não o código, e o
plano gratuito recusa alterar o modelo sem SMTP próprio (“Email template modification is not
available for free tier projects using the default email provider”). Além disso, pela documentação
do Supabase, o servidor de e-mail padrão só entrega para membros da organização e tem limite baixo
de envios por hora. Enquanto não houver SMTP próprio (ou plano pago), ninguém consegue entrar
sozinho pelo app: o código precisa ser gerado pelo painel/API de administração. O modelo pronto
está em `supabase/templates/codigo.html`, comentado em `supabase/config.toml`.

## Preparação do servidor (como foi feito)

```bash
supabase projects create cuidar --org-id <org> --region sa-east-1 --db-password <senha>
supabase link --project-ref <ref>
supabase db push
supabase config push            # confira o diff antes de aceitar
SB_URL=... SB_ANON=... SB_SERVICE=... node scripts/teste-servidor-cuidador.cjs
```

No development build basta gravar o `.env` e reiniciar o Metro com
`npx expo start --dev-client --clear`: as variáveis `EXPO_PUBLIC_*` entram no pacote JavaScript.
O build Release do iPhone precisa ser recompilado com o `.env` presente.

## Roteiro

Conta A = titular (Motorola). Conta B = cuidador (segundo aparelho ou segunda instalação).

### 1. Login e sessão
- [ ] A: Mais → Compartilhar com cuidador → e-mail → “Enviar código” → código chega por e-mail.
- [ ] A: código errado mostra erro e não entra; código certo mostra “Conectado como …”.
- [ ] A: “Pendências de envio” cai para 0 depois de “Sincronizar agora”.
- [ ] A: fechar o app (remover dos recentes) e reabrir: continua conectado.
- [ ] A: reiniciar o aparelho: continua conectado.
- [ ] B: mesmo login em outro aparelho, com outro e-mail.
- [ ] “Sair da conta” volta para a tela de e-mail; reabrir o app não reconecta sozinho.
- [ ] Com o PR “Guardar a sessão do Supabase no SecureStore”: quem já estava conectado continua
      conectado depois da atualização (migração da sessão) e os itens acima se repetem.

### 2. Vínculo
- [ ] A: sem marcar “Li e autorizo”, o botão de convite fica desativado.
- [ ] A: gera código (8 caracteres, validade de 48 h); aparece “Convite pendente”.
- [ ] B: “Acompanhar alguém” com código errado → “Código inválido ou expirado.”
- [ ] B: código certo → “Convite aceito.” e botão “Ver <nome de A>”.
- [ ] A: o mesmo código não pode ser aceito de novo; A não consegue aceitar o próprio convite.
- [ ] B: vê a água de hoje e as doses de hoje de A (agendadas, tomadas, sem confirmação).
- [ ] A registra água e confirma uma dose; B toca “Atualizar” e vê a mudança.

### 3. Aviso de dose sem confirmação
- [ ] A: cadastra um medicamento de teste com horário próximo e não confirma.
- [ ] 2 h depois do horário, A abre o app: a dose vira “Sem confirmação”.
- [ ] B: “Atualizar” mostra o aviso “1 dose de medicamento sem confirmação no aplicativo…”.
- [ ] A abre o app de novo várias vezes: o aviso não se repete.
- [ ] B: “Marcar como visto” tira o aviso da lista.
- [ ] A com o app fechado desde antes do horário: anotar se e quando o aviso chega a B.
- [ ] A: com o aviso de medicamento desligado em “Aviso ao cuidador”, nenhum aviso é criado.
- [ ] Água: com “2 lembretes”, dois lembretes seguidos sem registro geram um único aviso.

### 4. Revogação
- [ ] A: “Revogar acesso”; B: “Atualizar” deixa de mostrar os dados e a pessoa sai da lista.
- [ ] A: “Mudar para apenas ver” / “Permitir registrar” altera o vínculo.

## Revisão do código (01/10/2026)

Corrigido neste PR:

- **Convite falhava no Supabase.** `create_care_invite` e `accept_care_invite` fixavam
  `search_path = public`, mas a `pgcrypto` fica no esquema `extensions`: gerar convite daria
  “function digest does not exist”. Corrigido em `0002_convite_pgcrypto.sql`.
- **Dose sem confirmação nunca avisava o cuidador.** Só existia aviso para lembretes de água; o
  tipo `medication_unconfirmed` estava previsto no servidor, mas nada o enviava. Agora cada dose
  que fica “sem confirmação” nas últimas 24 h gera um aviso, uma única vez, com opção de desligar
  em “Aviso ao cuidador”. Regras em `src/domain/care/alerts.ts`.
- **O cuidador não via doses agendadas nem “sem confirmação”.** Só iam para o servidor as doses em
  que o titular tocou (tomada, adiada, não tomada); para o cuidador, o dia aparecia como “Nenhuma
  dose prevista hoje”. Agora toda ocorrência nova ou alterada entra na fila de envio, e as já
  existentes no aparelho são enviadas uma vez.
- **Aviso de água repetido.** O aviso era reenviado toda vez que o app voltava ao primeiro plano
  enquanto a contagem não mudasse. Agora sai uma vez por lembrete.
- **Doses removidas ficavam no servidor.** Ao editar horários ou excluir um medicamento, as doses
  futuras antigas continuavam visíveis ao cuidador. Agora a exclusão também é enviada.
- A fila de envio agora é enviada também quando o app volta ao primeiro plano e depois de “adiar”.
- Com o app fechado, as tarefas em segundo plano passam a marcar doses atrasadas, avisar o cuidador
  e enviar a fila, quando o sistema as executa (sem garantia de horário).

Limitações conhecidas, não resolvidas aqui:

- **O aviso depende do aparelho do titular.** Se o app não abrir e o sistema não rodar a tarefa em
  segundo plano (aparelho desligado, sem internet, economia de bateria), o cuidador não é avisado.
  Um aviso confiável precisa ser calculado no servidor (rotina agendada que compara horário
  previsto com confirmação recebida) e entregue por push.
- **Não há push para o cuidador.** O aviso só aparece quando ele abre o app e toca em “Atualizar”.
- **Permissão “Ver e registrar” não tem tela.** O servidor aceita registros do cuidador, mas a tela
  da pessoa acompanhada é só de leitura.
- **Troca de conta no mesmo aparelho.** “Sair da conta” mantém os dados locais e a fila; se outra
  conta entrar no mesmo aparelho, as pendências são enviadas para a conta nova.
- **A fila cresce sem conta conectada.** No uso individual tudo é enfileirado e nunca enviado; o
  primeiro login envia o acumulado, 100 itens por sincronização, um pedido por item.
- O cuidador não tem botão para encerrar o próprio vínculo (o servidor permite).
- Código de convite tem 8 caracteres hexadecimais e não há limite de tentativas no servidor.

## Resultados

| Data | Aparelhos | Bloco | Resultado |
|---|---|---|---|
| 05/10/2026 | Servidor “cuidar”, script `scripts/teste-servidor-cuidador.cjs`, duas contas temporárias | Login por código de 6 dígitos; código errado recusado; conta criada no primeiro acesso | OK |
| 05/10/2026 | idem | Convite: geração, código errado, próprio convite, aceite, segundo aceite recusado | OK |
| 05/10/2026 | idem | Cuidador sem vínculo não vê nada; com vínculo vê nome, água, dose “sem confirmação” e nome do remédio | OK |
| 05/10/2026 | idem | Aviso de dose sem confirmação: titular registra, cuidador vê e marca como visto | OK |
| 05/10/2026 | idem | “Apenas ver” não registra água nem aumenta a própria permissão | OK |
| 05/10/2026 | idem | Revogação corta o acesso a dados, avisos e lista; “apagar meus dados” limpa o servidor | OK |
| — | Motorola + segundo aparelho, contas reais | Roteiro acima (telas do app) | ainda não executado |
