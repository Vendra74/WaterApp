# Checklist de teste em aparelho físico

Preencha e devolva. Marque `[x]` quando o resultado esperado ocorrer; anote o que aconteceu de
diferente. Aparelho: Motorola Edge 50 Pro · Sistema: Android 16 (API 36) · Data: 30/09/2026

Sessão de 30/09/2026 (via adb, aparelho travado com PIN; itens sem marca não foram exercitados nesta sessão):
`[x]` verificado · `[~]` verificado com ressalva (ver Observações).

## 0. Instalação e primeira abertura
- [ ] O app abre na tela de boas-vindas (“Cuidar”). (não testado: exigiria apagar os dados do aparelho)
- [x] Letras grandes, botões grandes, sem texto cortado. (tamanho “Grande”; ver seção 11 para “Máximo”)

## 1. Avaliação inicial
- [x] Cada tela mostra uma pergunta e “Pergunta N de M”. (“Pergunta 1 de 19”, via “Atualizar minhas respostas”)
- [x] “Voltar” retorna à pergunta anterior mantendo a resposta.
- [~] “Salvar e continuar depois” → fechar o app → reabrir → “Continuar de onde parei” volta no ponto certo. No fluxo de atualização (perfil já concluído) o botão grava as respostas e volta ao Perfil; “Continuar de onde parei” só existe na avaliação inicial, não testada.
- [x] Respondendo “Sim” em orientação de líquidos, aparece a pergunta de quantidade. (e agora também uma linha “Quantidade orientada” no resumo)
- [x] Resumo permite tocar em uma linha e corrigir. (a quantidade em ml não tinha linha própria; adicionada)
- [x] Ao confirmar, o sistema pede permissão de notificações. Conceda. (já concedida neste aparelho)

## 2. Tela Hoje
- [x] Mostra hora atual, próximo lembrete de água, água registrada e próximos medicamentos.
- [ ] “Ler em voz alta” fala em português. (não verificável por adb; sem erro no logcat)
- [x] Sem plano profissional, **não** aparece percentual de meta. (com “Não sei”: só “150 ml”)

## 3. Notificações — teste rápido (Mais → Testar notificações)
- [x] Permissão aparece como “concedida”. (dumpsys: `importance=DEFAULT`, canais `hydration_v2`/`medication_v2` com importância 5 e `bypassDnd=true`)
- [x] Android: “Permitir alarmes exatos” abre a tela do sistema com a opção ativada (ou ative-a). (dumpsys alarm: `exactAllowReason=policy_permission`)
- [x] Modo Não perturbe desligado durante o teste (ícone ⊖ na barra de status = ligado). Com ele ligado, o Android silencia tudo; “Permitir tocar no Não perturbe” libera só os medicamentos.
- [x] Lembrete aparece como banner no topo da tela (não só na barra), com som e vibração. (`heads_up_notifications_enabled=1`; som e vibração confirmados pelo testador)
- [~] “Testar lembrete de água (10 s)” → bloquear a tela → a notificação aparece com som/vibração. Aparece, mas como **ícone** no carrossel da tela bloqueada (Motorola), não como cartão; ver Observações. Entrega em 10 s confirmada (canal `hydration_v2`, importância máxima).
- [x] Expandir a notificação mostra os botões “Registrar água”, “Lembrar depois”, “Preciso de ajuda”. (dumpsys: `actions=3` com esses títulos)
- [x] Tocar em “Registrar água” abre a tela de registro **sem** registrar nada sozinho. (corrigido: no teste os botões iam para a tela Hoje)
- [x] Tocar em “Preciso de ajuda” abre a tela de ajuda.
- [x] “Testar lembrete de medicamento (10 s)” → botões “Tomei”, “Lembrar depois”, “Preciso de ajuda”. (canal `medication_v2`)
- [x] A lista “Agendados no sistema” mostra os próximos horários.

## 4. Hidratação de hora em hora
- [x] Mais → Lembretes de água: intervalo 1 h, período curto (ex.: da hora atual até +3 h). Salvar. (18:00–21:00)
- [x] Voltar à tela de teste: os horários listados são de hora em hora **dentro** do período.
- [x] Aguardar o primeiro lembrete com o app fechado: ele chega no horário (anote o atraso, se houver): 0 min. (lembrete das 17:30 postado às 17:30:00, processo do app congelado até então; tela apagada acordou com o aviso)
- [x] Registrar água pela notificação → aparece em Histórico → Hoje com hora e quantidade. (“18:06 — 150 ml”)
- [x] Registrar a mesma quantidade de novo em menos de 1 min → app pergunta se é duplicado. (“Sim, registrar de novo”)
- [x] “Desfazer” remove; em Histórico, “Restaurar” traz de volta.
- [x] Cadastrar um cochilo no perfil cobrindo o próximo horário → lembrete daquele horário some da lista. (cochilo 19:00–20:00 removeu 19:05/19:30)

## 5. Medicamento noturno independente da pausa de água
- [x] Lembretes de água configurados para parar às 22:00. (usado 21:00)
- [x] Cadastrar medicamento com horário 23:30 (ou 3 min à frente da hora atual, fora do período da água). (18:45 e 19:15)
- [x] A notificação do medicamento chega mesmo fora do período de água. (18:45:00, canal `medication_v2`)
- [x] Por padrão a tela bloqueada mostra “Hora do seu medicamento” **sem** o nome do remédio.
- [x] Ligando “Mostrar nome do medicamento na notificação”, o nome passa a aparecer. (aviso das 20:28: “Medicamento: Remédio Teste”)

## 6. Adiamento e duplicidade
- [x] Cadastrar medicamento com dois horários (ex.: agora+2 min e agora+30 min).
- [x] Na primeira notificação, “Lembrar depois” → chega novo aviso em 15 min (ou o valor escolhido). (adiado pelo app; aviso agendado para +15 min na lista) Aviso adiado chegou às 20:28:09, 15 min após adiar.
- [x] O segundo horário **não** muda (conferir em Medicamentos → detalhes).
- [x] Sem confirmar, chega “Medicamento ainda não confirmado” após 10 min (repetição configurável em Lembretes). (dumpsys: original + repetições aos +10 e +20 min para cada dose)
- [x] “Tomei” → situação “Tomada”. Tocar de novo na dose → mensagem “já estava confirmada”, sem duplicar.
- [x] Deixar uma dose passar 2 h sem ação → situação “Sem confirmação”. (visto nas doses de 29/09 geradas para ontem; ver Observações)
- [x] “Corrigir registro” → “Marcar como tomada” → histórico mostra as duas alterações. (usado “Marcar como não tomada”; histórico da dose lista planejada + confirmada + correção)

## 7. Persistência
- [x] Fechar o app pelo gerenciador (deslizar para fora) → reabrir → perfil, registros e medicamentos intactos. (vários `force-stop` durante a sessão)
- [ ] Reiniciar o aparelho → reabrir → os lembretes seguintes continuam listados e chegam. (não testado nesta sessão)

## 8. Fuso horário
- [ ] (não testável por adb sem root) Mudar o fuso do aparelho manualmente (ex.: para Manaus) → abrir o app → horários da lista
      acompanham o relógio local do aparelho. Voltar o fuso ao normal.

## 9. Bloqueio de sugestões
- [x] Perfil → “Atualizar minhas respostas” → dificuldade para engolir: “Sim”. Concluir.
- [x] Perfil mostra aviso laranja “Sem sugestões de volume” e nenhuma sugestão de fruta na tela Hoje.
- [x] Orientação de líquidos “Não sei” → mesmo comportamento.
- [x] Orientação “Sim” com 1200 ml → Hoje mostra “x% de 1200 ml”; Registro de água oferece outras bebidas. (“13% de 1200 ml”)

## 10. Ajuda
- [x] Cadastrar um contato (Mais → Contatos de ajuda).
- [x] “Preciso de ajuda” → “Ligar para <nome>” abre o discador com o número. (corrigido: `canOpenURL('tel:')` devolvia falso no Android 11+ e o botão só mostrava erro; agora abre o seletor Telefone/Minha Claro)
- [x] Texto “não é um serviço de emergência” visível.

## 11. Acessibilidade
- [x] Tamanho “Máximo” de letras: nada fica ilegível ou sobreposto (anote a tela se houver). (corrigido: na tela Hoje o botão “Ler em voz alta” era cortado e os rótulos das abas truncavam)
- [x] Alto contraste: bordas e textos pretos sobre branco.
- [~] TalkBack/VoiceOver: botões anunciam texto e estado (“ligado/desligado”, “marcado”). TalkBack não ativado; a árvore de acessibilidade (uiautomator) expõe rótulos e estados (“ligado/desligado”, checked) nos interruptores e caixas.

## 12. Dados
- [x] “Exportar meus dados” abre o compartilhamento com um arquivo `.json`. (`cuidar-dados-<timestamp>.json`)
- [ ] “Apagar todos os meus dados” → volta à tela de boas-vindas e os lembretes somem da lista. (não executado: apagaria os dados do testador)

## 13. Cuidador (somente com Supabase configurado)
Roteiro completo com duas contas em `docs/TESTE-CUIDADOR.md`.
- [ ] Conta A gera convite; conta B aceita; B vê água/medicamentos de A. (build sem Supabase: “Compartilhamento remoto não configurado neste build”)
- [ ] A revoga; B não vê mais (e recebe erro ao atualizar).

## Observações livres
**Tela bloqueada (30/09/2026, Motorola Edge 50 Pro, Android 16).** Investigado com `adb shell settings`
e `dumpsys notification`/SystemUI. Nada bloqueia o app: `lock_screen_show_notifications=1`,
`lock_screen_allow_private_notifications=1`, `zen_mode=0`; o SystemUI não filtra as notificações do
Cuidar no keyguard (só a de USB). O que acontece é a apresentação da Motorola (`KeyguardStyle=PEEK`):
a tela bloqueada mostra um **carrossel com 4 ícones por página**, e a seção “Pessoas” (SMS, chamada
perdida, WhatsApp) vem sempre antes da seção “Alertas”, onde ficam os lembretes. Com 3 conversas
pendentes sobra 1 vaga na primeira página, ocupada pela notificação de alerta mais recente; lembretes
mais antigos vão para a 2ª página (deslizar a fileira). Tocando na gota, a tela bloqueada mostra o
lembrete inteiro (título, texto e, expandindo, os botões) sem desbloquear.

Detalhe de plataforma: `lockscreenVisibility` definido pelo app no canal é ignorado pelo Android
(o dumpsys mostra `mLockscreenVisibility=-1000`, valor imposto pelo sistema). Não há configuração
adicional que o app possa fazer; o comentário do código foi corrigido.

Ajuste feito no código: quando chega um lembrete novo com o app em execução, os anteriores do mesmo
tipo (água substitui água; repetição de dose substitui o aviso original da mesma dose; teste substitui
teste) são dispensados da barra. Isso evita o agrupamento automático do Android 16, que na tela
bloqueada mostrava um grupo recolhido em vez do lembrete atual com os botões.

**Lembrete real das 17:30 (app em segundo plano, processo congelado, tela apagada).** Entregue às
17:30:00 pelo alarme exato; a tela acordou e a gota ficou na 1ª página do carrossel. Porém o dumpsys
mostrou a notificação no canal `expo_notifications_fallback_notification_channel` (importância 4,
sem ignorar Não perturbe, sem o padrão de vibração), e não em `hydration_v2`. Causa: os agendamentos
gravados antes da migração dos canais (`hydration` → `hydration_v2`) continuam apontando para o canal
apagado; o reconciliador só comparava identificadores e os mantinha. No aparelho, os 22 agendamentos
guardados estavam nessa situação. **Corrigido:** o reconciliador agora cancela e refaz qualquer
agendamento cujo canal difira do planejado. Verificado no aparelho após recarregar o app: os 22
agendamentos passaram para `hydration_v2`/`general_v2` e o alarme seguinte (19:30) continua marcado.
Conferir no próximo lembrete: deve chegar com importância máxima (banner) e, no medicamento,
ignorando o Não perturbe se autorizado. Confirmado depois: lembretes reais de água (18:00, 18:05,
18:30) e de medicamento (18:45, 19:15) chegaram no segundo exato nos canais `hydration_v2` e
`medication_v2`.

**Sessão pela interface (adb + uiautomator, aparelho destravado, 17:40–20:30).** Outros achados e
correções:
- Botões “Permitir alarmes exatos” e “Permitir tocar no Não perturbe” não abriam nada: o
  `import()` dinâmico de `expo-application` falhava no development build (“Cannot read property
  'reload' of undefined”) e o erro era engolido. Trocado por importação estática; a mensagem de
  erro agora inclui a causa. A tela “Alarmes e lembretes” mostra a opção ativada e bloqueada pelo
  sistema (o app declara `USE_EXACT_ALARM`).
- “Ligar para <contato>” só mostrava “não conseguiu abrir o discador”: `Linking.canOpenURL('tel:')`
  devolve falso no Android 11+ sem `<queries>` no manifesto. Agora abre direto (`openURL`).
- Botões da notificação de **teste** abriam a tela Hoje em vez das telas de registro/ajuda (o tipo
  `test` caía no roteamento padrão). Corrigido.
- Letras “Máximo”: botão “Ler em voz alta” cortado na tela Hoje e rótulos das abas truncados.
  Corrigido (cabeçalho empilha; rótulo das abas reduz para caber).
- Confirmar “Atualizar minhas respostas” redefinia o período dos lembretes para acordar/dormir,
  descartando o período ajustado em “Lembretes de água”. Agora só redefine quando acordar/dormir
  mudam (ou na primeira avaliação).
- Resumo da avaliação: não havia linha para editar a quantidade orientada (ml) e o valor aparecia
  mesmo com orientação “Não sei”. Adicionada a linha “Quantidade orientada” (só com “Sim”).
- Detalhes do medicamento: a lista de doses vinha do mais distante para o mais próximo e cortava em
  20; com 14 dias de doses, as de hoje não apareciam. Agora: 5 recentes + próximas, em ordem.
- Medicamento cadastrado hoje sem data de início gerava doses de **ontem** como “Sem confirmação”.
  Agora nenhuma dose é gerada antes do cadastro (com data de início explícita, ela manda). As
  ocorrências já gravadas permanecem até o remédio ser apagado.
- Tela bloqueada durante a sessão: com o aparelho travado, tocar no **grupo** de notificações do
  Cuidar (quando há várias) abre o app pelo atalho do grupo e cancela os avisos sem gerar
  resposta; com um único aviso, os botões funcionam normalmente.
- Não testados nesta sessão: reinício do aparelho, mudança de fuso (sem root), TalkBack,
  “Apagar todos os meus dados”, cuidador (build sem Supabase), primeira abertura.

Estado deixado no aparelho ao final: configurações de lembrete restauradas (2 h, 07:30–23:30, sem
cochilo), plano 2000 ml/dia, medicamento de teste apagado, tempo de tela de volta a 1 min.

