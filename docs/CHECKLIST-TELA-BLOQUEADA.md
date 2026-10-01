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
      Esperado: **silenciado** (sem som; pode aparecer só como ícone).
- [ ] Testar lembrete de **medicamento** (10 s) → bloquear a tela.
      Esperado: **toca e vibra mesmo com Não perturbe**.
- [ ] Desligar o Não perturbe ao terminar.

## D. Alarme exato com o app fechado
- [x] Cadastrar medicamento para daqui a 3 min. Fechar o app pelo gerenciador (deslizar para fora).
      Bloquear a tela e deixar quieto. (medicamento “Teste checklist”, 11:25)
- [x] O aviso chega no minuto certo (anote o atraso): 0 min. (dose das 11:25 entregue às 11:25:00, atraso 0,2 s, com som e vibração)
- [x] Sem confirmar, chega “Medicamento ainda não confirmado” 10 min depois. (11:35:00, atraso 0,1 s, com som e vibração)

## E. Reinício do aparelho
- [ ] Com um lembrete agendado para daqui a 5 min, reiniciar o aparelho e **não** abrir o app.
- [ ] O lembrete chega mesmo assim (anote o atraso): ____ min.
- [ ] Abrir o app: Mais → Testar notificações → lista “Agendados no sistema” continua preenchida.

## Resultados (sessão de 01/10/2026, via adb pelo Mac; `[x]` ok · `[~]` com ressalva)
- **A** OK, exceto A3: o Cuidar não aparece em “Acesso aos modos” porque não declara
  `ACCESS_NOTIFICATION_POLICY`. Mesmo assim os canais v2 estão com “ignorar Não perturbe” ligado no
  aparelho.
- **B** OK: entrega em ~0,1 s na tela bloqueada, som e vibração, gota no carrossel, botões corretos.
- **C** em andamento. Achado já certo: o canal de **água** também está com “ignorar Não perturbe”
  ligado no aparelho (o código atual cria `hydration_v2` com `bypassDnd: false`, mas o Android mantém
  o valor com que o canal foi criado pela primeira vez). Esperado: água silenciada, só medicamento passa.
- **D** OK: com o app fechado pelo gerenciador e a tela bloqueada, dose das 11:25 entregue às 11:25:00
  e repetição “ainda não confirmado” às 11:35:00, ambas com som e vibração.
- **E** autorizada pelo Andre; pendente de execução.
- Lembrete real de água das 11:30 também chegou no segundo exato.

