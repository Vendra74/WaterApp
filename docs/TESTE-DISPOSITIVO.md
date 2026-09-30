# Checklist de teste em aparelho físico

Preencha e devolva. Marque `[x]` quando o resultado esperado ocorrer; anote o que aconteceu de
diferente. Aparelho: ______________ · Sistema: ______________ · Data: ____/____/______

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
- [ ] Permissão aparece como “concedida”.
- [ ] Android: “Permitir alarmes exatos” abre a tela do sistema com a opção ativada (ou ative-a).
- [ ] “Testar lembrete de água (10 s)” → bloquear a tela → a notificação aparece com som/vibração.
- [ ] Expandir a notificação mostra os botões “Registrar água”, “Lembrar depois”, “Preciso de ajuda”.
- [ ] Tocar em “Registrar água” abre a tela de registro **sem** registrar nada sozinho.
- [ ] Tocar em “Preciso de ajuda” abre a tela de ajuda.
- [ ] “Testar lembrete de medicamento (10 s)” → botões “Tomei”, “Lembrar depois”, “Preciso de ajuda”.
- [ ] A lista “Agendados no sistema” mostra os próximos horários.

## 4. Hidratação de hora em hora
- [ ] Mais → Lembretes de água: intervalo 1 h, período curto (ex.: da hora atual até +3 h). Salvar.
- [ ] Voltar à tela de teste: os horários listados são de hora em hora **dentro** do período.
- [ ] Aguardar o primeiro lembrete com o app fechado: ele chega no horário (anote o atraso, se houver): ______ min.
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
_________________________________________________________________________
