# Checklist curto: lembretes na tela bloqueada (Motorola)

Aparelho: Motorola Edge 50 Pro · Android 16 · Build: PR #2 (`claude/magical-gauss-90xzpi`) · Data: 01/10/2026

Marque `[x]` quando o esperado acontecer, `[ ]` se falhar, e anote o que viu.
Complementa `docs/TESTE-DISPOSITIVO.md`: cobre só o que ficou pendente lá (Não perturbe ligado de
verdade, alarme exato com o app fechado e reinício do aparelho).

## A. Preparação (1 min)
- [x] App do PR #2 instalado (Mais → Testar notificações mostra permissão “concedida”). (development build de 30/09 com JS do PR #2)
- [x] “Permitir alarmes exatos” abre a tela do sistema com a opção ativada. (`USE_EXACT_ALARM` concedida)
- [~] “Permitir tocar no Não perturbe” abre a tela do sistema e o Cuidar está autorizado. **Falha parcial:** a tela “Acesso aos modos” abre, mas o Cuidar não aparece na lista (o manifesto não declara `ACCESS_NOTIFICATION_POLICY`).

## B. Tela bloqueada, Não perturbe desligado
- [x] Testar lembrete de água (10 s) → bloquear a tela → chega com som e vibração. (atraso ~0,1 s; som e vibração confirmados no histórico de áudio e do vibrador)
- [x] A gota aparece na fileira de ícones da tela bloqueada; tocar nela mostra o lembrete inteiro.
- [x] Expandir mostra “Registrar água”, “Lembrar depois”, “Preciso de ajuda”.
- [x] Testar lembrete de medicamento (10 s) → mesma coisa, com “Tomei”.

## C. Não perturbe LIGADO
- [ ] Ligar Não perturbe (⊖ na barra de status). Testar lembrete de **água** (10 s) → bloquear a tela.
      Esperado: **silenciado** (sem som; pode aparecer só como ícone). **FALHA:** a água chegou em ~0,1 s,
      tocou e vibrou com Não perturbe em prioridade (ver Resultados).
- [x] Testar lembrete de **medicamento** (10 s) → bloquear a tela.
      Esperado: **toca e vibra mesmo com Não perturbe**. (atraso ~0,1 s, som e vibração)
- [x] Desligar o Não perturbe ao terminar.

## D. Alarme exato com o app fechado
- [x] Cadastrar medicamento para daqui a 3 min. Fechar o app pelo gerenciador (deslizar para fora).
      Bloquear a tela e deixar quieto. (medicamento “Teste checklist”, 11:25)
- [x] O aviso chega no minuto certo (anote o atraso): 0 min. (dose das 11:25 entregue às 11:25:00, atraso 0,2 s, com som e vibração)
- [x] Sem confirmar, chega “Medicamento ainda não confirmado” 10 min depois. (11:35:00, atraso 0,1 s, com som e vibração)

## E. Reinício do aparelho
- [x] Com um lembrete agendado para daqui a 5 min, reiniciar o aparelho e **não** abrir o app. (`adb reboot` às 14:23:17, aparelho de volta às 14:24:29; alarmes recriados logo após o boot)
- [x] O lembrete chega mesmo assim (anote o atraso): 0 min. (14:30:00, atraso 0,3 s, som e vibração)
- [x] Abrir o app: Mais → Testar notificações → lista “Agendados no sistema” continua preenchida. (60 planejadas, 60 agendadas)

## Resultados (sessão de 01/10/2026, via adb pelo Mac; 15 itens OK, 1 falha, 1 falha parcial)
Build testado: APK de desenvolvimento de 30/09 com JavaScript do PR #2 (commit f65a6a5); a configuração
nativa não mudou depois dele. Som e vibração confirmados pelo histórico de áudio e do vibrador do aparelho.

- **A** OK, exceto A3 (falha parcial): o Cuidar não aparece em “Acesso aos modos” porque o manifesto
  não declara `ACCESS_NOTIFICATION_POLICY`; o texto da tela manda “ativar o Cuidar na lista”, o que
  não é possível.
- **B** OK: entrega em ~0,1 s na tela bloqueada, som e vibração, gota no carrossel, botões corretos.
- **C** C1 **falha**: com Não perturbe em prioridade a água não foi silenciada (tocou e vibrou). Causa:
  no aparelho os canais `hydration_v2`, `medication_v2` e `general_v2` estão com “ignorar Não
  perturbe” ligado e o sistema trata o app inteiro como prioritário. O código atual cria o canal de
  água com `bypassDnd: false`, mas o Android mantém o valor com que o canal foi criado da primeira
  vez. C2 OK (medicamento toca e vibra com Não perturbe). C3 OK.
- **D** OK: com o app fechado pelo gerenciador e a tela bloqueada, dose das 11:25 entregue às 11:25:00
  e repetição “ainda não confirmado” às 11:35:00, ambas com som e vibração.
- **E** OK: após `adb reboot` sem abrir o app, o lembrete das 14:30 chegou às 14:30:00 e a lista do
  sistema continuou com 60 agendamentos.
- Lembrete real de água das 11:30 também chegou no segundo exato.

### Achados fora do checklist
1. **Bug:** abrir o app depois do horário de uma dose não confirmada cancela as repetições “ainda não
   confirmado” pendentes. Em `src/domain/notifications/planner.ts` a ocorrência com horário já passado
   é pulada inteira, junto com as repetições. Em D3 a repetição só chegou porque o app ficou fechado.
2. Apagar um medicamento não remove da bandeja a notificação dele que já está na tela.
3. Deslizar o app para fora do gerenciador não encerrou o processo neste aparelho; os alarmes
   continuaram normais.
4. Para simular o botão ⊖ por adb, usar `cmd notification set_dnd priority`; `set_dnd on` liga o
   silêncio total e deixa o toque em silencioso.

Estado deixado no aparelho: Não perturbe desligado, toque normal, volume de notificação 5/7,
medicamento de teste apagado, dados reais intactos. Ficaram na bandeja notificações de teste para dispensar.
