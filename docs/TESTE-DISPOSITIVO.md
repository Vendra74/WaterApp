# Checklist de teste em aparelho físico

Preencha e devolva. Marque `[x]` quando o resultado esperado ocorrer; anote o que aconteceu de
diferente. Aparelho: Motorola Edge 50 Pro · Sistema: Android 16 (API 36) · Data: 30/09/2026

Sessão de 30/09/2026 (via adb, aparelho travado com PIN; itens sem marca não foram exercitados nesta sessão):
`[x]` verificado · `[~]` verificado com ressalva (ver Observações).

## 0. Instalação e primeira abertura
- [ ] O app abre na tela de boas-vindas (“Cuidar”).
- [ ] Letras grandes, botões grandes, sem texto cortado.

## 1. Avaliação inicial
- [ ] Cada tela mostra uma pergunta e “Pergunta N de M”.
- [ ] “Voltar” retorna à pergunta anterior mantendo a resposta.
- [ ] “Salvar e continuar depois” → fechar o app → reabrir → “Continuar de onde parei” volta no ponto certo.
- [ ] Respondendo “Sim” em orientação de líquidos, aparece a pergunta de quantidade.
- [ ] Resumo permite tocar em uma linha e corrigir.
- [ ] Ao confirmar, o sistema pede permissão de notificações. Conceda.

## 2. Tela Hoje
- [ ] Mostra hora atual, próximo lembrete de água, água registrada e próximos medicamentos.
- [ ] “Ler em voz alta” fala em português.
- [ ] Sem plano profissional, **não** aparece percentual de meta.

## 3. Notificações — teste rápido (Mais → Testar notificações)
- [x] Permissão aparece como “concedida”. (dumpsys: `importance=DEFAULT`, canais `hydration_v2`/`medication_v2` com importância 5 e `bypassDnd=true`)
- [x] Android: “Permitir alarmes exatos” abre a tela do sistema com a opção ativada (ou ative-a). (dumpsys alarm: `exactAllowReason=policy_permission`)
- [x] Modo Não perturbe desligado durante o teste (ícone ⊖ na barra de status = ligado). Com ele ligado, o Android silencia tudo; “Permitir tocar no Não perturbe” libera só os medicamentos.
- [x] Lembrete aparece como banner no topo da tela (não só na barra), com som e vibração. (`heads_up_notifications_enabled=1`; som e vibração confirmados pelo testador)
- [~] “Testar lembrete de água (10 s)” → bloquear a tela → a notificação aparece com som/vibração. Aparece, mas como **ícone** no carrossel da tela bloqueada (Motorola), não como cartão; ver Observações.
- [x] Expandir a notificação mostra os botões “Registrar água”, “Lembrar depois”, “Preciso de ajuda”. (dumpsys: `actions=3` com esses títulos)
- [ ] Tocar em “Registrar água” abre a tela de registro **sem** registrar nada sozinho.
- [ ] Tocar em “Preciso de ajuda” abre a tela de ajuda.
- [ ] “Testar lembrete de medicamento (10 s)” → botões “Tomei”, “Lembrar depois”, “Preciso de ajuda”.
- [ ] A lista “Agendados no sistema” mostra os próximos horários.

## 4. Hidratação de hora em hora
- [ ] Mais → Lembretes de água: intervalo 1 h, período curto (ex.: da hora atual até +3 h). Salvar.
- [ ] Voltar à tela de teste: os horários listados são de hora em hora **dentro** do período.
- [x] Aguardar o primeiro lembrete com o app fechado: ele chega no horário (anote o atraso, se houver): 0 min. (lembrete das 17:30 postado às 17:30:00, processo do app congelado até então; tela apagada acordou com o aviso)
- [ ] Registrar água pela notificação → aparece em Histórico → Hoje com hora e quantidade.
- [ ] Registrar a mesma quantidade de novo em menos de 1 min → app pergunta se é duplicado.
- [ ] “Desfazer” remove; em Histórico, “Restaurar” traz de volta.
- [ ] Cadastrar um cochilo no perfil cobrindo o próximo horário → lembrete daquele horário some da lista.

## 5. Medicamento noturno independente da pausa de água
- [ ] Lembretes de água configurados para parar às 22:00.
- [ ] Cadastrar medicamento com horário 23:30 (ou 3 min à frente da hora atual, fora do período da água).
- [ ] A notificação do medicamento chega mesmo fora do período de água.
- [ ] Por padrão a tela bloqueada mostra “Hora do seu medicamento” **sem** o nome do remédio.
- [ ] Ligando “Mostrar nome do medicamento na notificação”, o nome passa a aparecer.

## 6. Adiamento e duplicidade
- [ ] Cadastrar medicamento com dois horários (ex.: agora+2 min e agora+30 min).
- [ ] Na primeira notificação, “Lembrar depois” → chega novo aviso em 15 min (ou o valor escolhido).
- [ ] O segundo horário **não** muda (conferir em Medicamentos → detalhes).
- [ ] Sem confirmar, chega “Medicamento ainda não confirmado” após 10 min (repetição configurável em Lembretes).
- [ ] “Tomei” → situação “Tomada”. Tocar de novo na dose → mensagem “já estava confirmada”, sem duplicar.
- [ ] Deixar uma dose passar 2 h sem ação → situação “Sem confirmação”.
- [ ] “Corrigir registro” → “Marcar como tomada” → histórico mostra as duas alterações.

## 7. Persistência
- [ ] Fechar o app pelo gerenciador (deslizar para fora) → reabrir → perfil, registros e medicamentos intactos.
- [ ] Reiniciar o aparelho → reabrir → os lembretes seguintes continuam listados e chegam.

## 8. Fuso horário
- [ ] Mudar o fuso do aparelho manualmente (ex.: para Manaus) → abrir o app → horários da lista
      acompanham o relógio local do aparelho. Voltar o fuso ao normal.

## 9. Bloqueio de sugestões
- [ ] Perfil → “Atualizar minhas respostas” → dificuldade para engolir: “Sim”. Concluir.
- [ ] Perfil mostra aviso laranja “Sem sugestões de volume” e nenhuma sugestão de fruta na tela Hoje.
- [ ] Orientação de líquidos “Não sei” → mesmo comportamento.
- [ ] Orientação “Sim” com 1200 ml → Hoje mostra “x% de 1200 ml”; Registro de água oferece outras bebidas.

## 10. Ajuda
- [ ] Cadastrar um contato (Mais → Contatos de ajuda).
- [ ] “Preciso de ajuda” → “Ligar para <nome>” abre o discador com o número.
- [ ] Texto “não é um serviço de emergência” visível.

## 11. Acessibilidade
- [ ] Tamanho “Máximo” de letras: nada fica ilegível ou sobreposto (anote a tela se houver).
- [ ] Alto contraste: bordas e textos pretos sobre branco.
- [ ] TalkBack/VoiceOver: botões anunciam texto e estado (“ligado/desligado”, “marcado”).

## 12. Dados
- [ ] “Exportar meus dados” abre o compartilhamento com um arquivo `.json`.
- [ ] “Apagar todos os meus dados” → volta à tela de boas-vindas e os lembretes somem da lista.

## 13. Cuidador (somente com Supabase configurado)
- [ ] Conta A gera convite; conta B aceita; B vê água/medicamentos de A.
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
ignorando o Não perturbe se autorizado.

