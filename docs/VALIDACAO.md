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
- Android pode atrasar notificações em economia de bateria/Doze; alguns fabricantes exigem liberar o
  app nas configurações de bateria. `SCHEDULE_EXACT_ALARM` está declarado; o uso efetivo de alarmes
  exatos depende do sistema e da versão do expo-notifications.
- Avisos falados só com o app aberto.
- “Lembrar depois” da água agenda um aviso único; não altera a grade.
- Aviso ao cuidador exige que o app do titular processe o lembrete (primeiro plano ou tarefa em
  segundo plano); sem isso, não há contagem — por isso a mensagem sempre diz “sem confirmação”.
- Sessão do Supabase é guardada em AsyncStorage (padrão da documentação); endurecimento com
  cifragem via SecureStore é pendência.
- Conformidade legal (LGPD) completa exige revisão jurídica específica; estão implementados os
  controles técnicos de consentimento, exportação, exclusão e autorização no servidor.

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
