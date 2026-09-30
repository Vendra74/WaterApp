# Validação, limitações e pendências

Data: 2026-09-29 · Ambiente de desenvolvimento sem acesso a dispositivo físico, emulador ou
`docs.expo.dev` (política de rede). As APIs foram conferidas pelos tipos e READMEs dos pacotes
instalados (Expo SDK 57: expo-notifications 57.0.x, expo-sqlite 57.0.x, expo-background-task 57.0.x).

## Verificado neste ambiente

| Item | Como | Resultado |
|---|---|---|
| Typecheck (`tsc --noEmit`, strict) | `npm run typecheck` | OK |
| Lint (eslint-config-expo) | `npm run lint` | OK |
| Testes das regras críticas | `npm test` | 34 testes, 5 suítes, OK |
| Empacotamento Metro (Android, Hermes) | `expo export --platform android` | OK, 1116 módulos |
| Resolução do `app.config.ts` e plugins | `expo config --type public` | OK |

## Funciona sem configuração externa (modo individual)

- Avaliação inicial com uma pergunta por tela, progresso, voltar, “Salvar e continuar depois”,
  perguntas “Não sei”, resumo editável e confirmação antes de ativar lembretes.
- Plano individual com regras de segurança (sem meta universal, sem cálculo automático, bloqueio de
  sugestões em restrição/deglutição/incerteza; meta e percentual só com plano profissional).
- Lembretes de hidratação: intervalos (60/90/120/180), horários específicos, janela, pausa em
  cochilos, dias da semana, som/vibração, “lembrar depois”, privacidade na tela bloqueada.
- Registro de água com recipientes habituais, ajuste de quantidade, aviso de duplicidade, desfazer,
  corrigir e restaurar, com histórico de alterações. Nada é registrado só por abrir a notificação.
- Medicamentos: cadastro completo (nome, apresentação, dose/unidade, via, horários fixos ou
  intervalos, dias, início/término, instruções, foto opcional sem leitura automática), ocorrências
  com ID determinístico e estados (agendada, tomada, adiada, sem confirmação, não tomada), adiamento
  isolado, correção com histórico, prevenção de duplicidade.
- Notificações locais agendadas no sistema (gatilhos por data), com ações “Registrar água”,
  “Lembrar depois”, “Preciso de ajuda” / “Tomei”; canais Android separados; reconciliação por
  identificador (só agenda/cancela a diferença); orçamento respeitando o limite de 64 do iOS com
  prioridade para medicamentos; reagendamento ao abrir o app, ao voltar ao primeiro plano, ao editar
  dados e em tarefa periódica em segundo plano.
- Tela “Testar notificações” com estado da permissão, lista do que está agendado, botão de teste
  em 10 s e limitações conhecidas.
- Leitura em voz alta dentro do app (expo-speech, pt-BR).
- “Preciso de ajuda”: liga para SAMU/contatos via discador; nunca mostra “ajuda enviada” sem
  confirmação técnica; deixa claro que não é serviço de emergência.
- Histórico diário e semanal; perfil e plano; pergunta periódica (90 dias) se as orientações mudaram.
- Exportação de dados (JSON via compartilhamento do sistema) e exclusão total.
- Persistência em SQLite (sobrevive a fechar/abrir o app).

## Depende de configuração externa

| Recurso | Depende de | Estado |
|---|---|---|
| Conta e login por código de e-mail | Supabase configurado + Email OTP ativado | Implementado; não testado contra servidor real |
| Convite, consentimento, ver/editar, revogação | Migração `0001_init.sql` aplicada (RLS) | Implementado; isolamento e revogação validados por revisão das políticas, não por teste automatizado |
| Sincronização com fila e pendências visíveis | Supabase + rede | Implementado (`sync_outbox`) |
| Aviso “sem confirmação” ao cuidador | Supabase; app do titular precisa ser aberto ou receber notificação em primeiro plano/segundo plano | Implementado como registro em `care_alerts`, visto pelo cuidador ao abrir o app |
| Push para o cuidador (aviso em tempo real) | Edge Function + Expo Push/FCM/APNs e credenciais | **Não implementado** |
| Builds nativos / lojas | Android Studio/Xcode ou conta EAS | Perfis em `eas.json`; `expo prebuild` não pôde ser executado aqui |

## Não pôde ser testado neste ambiente (precisa de dispositivo físico)

- Entrega real de notificações e comportamento dos botões de ação em Android e iOS.
- Comportamento com permissão negada em tempo de execução, reinício do aparelho (as notificações
  agendadas por data persistem no sistema; a tarefa periódica e a reabertura do app repõem o
  horizonte) e mudança de fuso horário (o reagendamento recalcula a partir do horário local).
- Execução da tarefa em segundo plano (`expo-background-task`), que fica a critério do sistema.
- Leitura de tela (TalkBack/VoiceOver) — os componentes têm papéis, rótulos e estados, mas a
  navegação real não foi verificada.
- Câmera/galeria para foto do medicamento.
- Compartilhamento do arquivo de exportação.

## Limitações conscientes

- iOS mantém no máximo 64 notificações pendentes por app. O planejador prioriza medicamentos e
  completa com hidratação; o restante é agendado quando o app abre ou na tarefa periódica. A tela de
  teste mostra quando houve truncamento.
- Android 12+: sem permissão de alarme exato, o expo-notifications usa alarmes inexatos
  (`setAndAllowWhileIdle`), que o sistema agrupa e atrasa em minutos (verificado em aparelho: o teste
  de 10 s não aparecia). O app declara `SCHEDULE_EXACT_ALARM` (Android 12) e `USE_EXACT_ALARM`
  (Android 13+, concedida na instalação) e oferece o botão “Permitir alarmes exatos” na tela de teste.
  Política da Play Store: `USE_EXACT_ALARM` é aceita para apps cuja função central são alarmes ou
  lembretes com horário; na publicação, justificar como lembrete de medicamentos.
- Android pode atrasar notificações em economia de bateria/Doze; alguns fabricantes exigem liberar o
  app nas configurações de bateria.
- Avisos falados só com o app aberto.
- “Lembrar depois” da água agenda um aviso único; não altera a grade.
- Aviso ao cuidador exige que o app do titular processe o lembrete (primeiro plano ou tarefa em
  segundo plano); sem isso, não há contagem — por isso a mensagem sempre diz “sem confirmação”.
- Sessão do Supabase é guardada em AsyncStorage (padrão da documentação); endurecimento com
  cifragem via SecureStore é pendência.
- Conformidade legal (LGPD) completa exige revisão jurídica específica; estão implementados os
  controles técnicos de consentimento, exportação, exclusão e autorização no servidor.

## Resultados em aparelho (2026-09-30, Android, development build via EAS)

- Build EAS concluído e instalado; avaliação inicial e tela Hoje funcionam.
- Corrigido em campo: categoria de notificação sem ações era rejeitada pelo Android e abortava o
  agendamento; som `'default'` no canal era tratado como arquivo personalizado.
- Corrigido em campo: alarmes inexatos atrasavam o teste de 10 s (ver limitação acima).
- Verificado em campo (Motorola Edge 50 Pro): lembrete de água entregue com ícone, texto e os três
  botões de ação. Com o modo Não perturbe ligado o lembrete ficou apenas na barra de status; canais
  passaram a importância máxima e visíveis na tela bloqueada, e há opção de os medicamentos
  ignorarem o Não perturbe (exige autorização do usuário nas configurações do sistema).
- Verificado em campo (30/09, adb + dumpsys): a tela bloqueada da Motorola (estilo Peek) mostra um
  carrossel de ícones com 4 vagas por página, conversas na frente; a gota do Cuidar pode cair na 2ª
  página. Tocando nela o lembrete aparece inteiro sem desbloquear. Nenhuma configuração do sistema
  bloqueava o app; `lockscreenVisibility` do canal é ignorado pelo Android. O app passou a dispensar
  lembretes anteriores do mesmo tipo quando chega um novo (com o processo vivo), para evitar o
  agrupamento que escondia os botões. Detalhes em `docs/TESTE-DISPOSITIVO.md`.
- Corrigido em campo (30/09): após a migração de canais, os lembretes já agendados continuavam no
  canal antigo apagado e eram entregues no canal genérico do Expo (importância menor, sem ignorar
  Não perturbe). O reconciliador agora refaz agendamentos cujo canal difere do planejado.
- Sessão pela interface (30/09, adb + uiautomator): seções 1–6 e 9–12 do checklist exercitadas.
  Corrigidos em campo: botões de configurações do sistema mudos (import dinâmico de
  expo-application), discador (`canOpenURL('tel:')` falso no Android 11+), roteamento dos botões da
  notificação de teste, layout em letras “Máximo”, período de lembretes sobrescrito ao atualizar a
  avaliação, linha de quantidade no resumo, ordem das doses nos detalhes e doses geradas antes do
  cadastro do medicamento. Detalhes em `docs/TESTE-DISPOSITIVO.md`.

## Roteiro sugerido de teste em dispositivo

1. Instalar development build; concluir a avaliação; conceder permissão.
2. *Mais → Testar notificações*: disparar teste de água e de medicamento com a tela bloqueada;
   usar cada botão e confirmar que nada é registrado sem confirmação.
3. Configurar hidratação de hora em hora em janela curta e conferir a lista “Agendados no sistema”.
4. Cadastrar medicamento às 23:30 com janela de água até 22:00; conferir que o lembrete aparece.
5. Adiar uma dose; conferir que as próximas permanecem; confirmar duas vezes e ver a mensagem.
6. Fechar e reabrir o app (e reiniciar o aparelho); conferir dados e reagendamento.
7. Mudar o fuso do aparelho e abrir o app; conferir horários recalculados.
8. Com Supabase: criar duas contas, convidar, aceitar, ver dados, revogar e confirmar bloqueio.
