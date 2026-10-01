# Checklist curto: lembretes na tela bloqueada (Motorola)

Aparelho: Motorola Edge 50 Pro · Android 16 · Build: PR #2 (`claude/magical-gauss-90xzpi`) · Data: ____

Marque `[x]` quando o esperado acontecer, `[ ]` se falhar, e anote o que viu.
Complementa `docs/TESTE-DISPOSITIVO.md`: cobre só o que ficou pendente lá (Não perturbe ligado de
verdade, alarme exato com o app fechado e reinício do aparelho).

## A. Preparação (1 min)
- [ ] App do PR #2 instalado (Mais → Testar notificações mostra permissão “concedida”).
- [ ] “Permitir alarmes exatos” abre a tela do sistema com a opção ativada.
- [ ] “Permitir tocar no Não perturbe” abre a tela do sistema e o Cuidar está autorizado.

## B. Tela bloqueada, Não perturbe desligado
- [ ] Testar lembrete de água (10 s) → bloquear a tela → chega com som e vibração.
- [ ] A gota aparece na fileira de ícones da tela bloqueada; tocar nela mostra o lembrete inteiro.
- [ ] Expandir mostra “Registrar água”, “Lembrar depois”, “Preciso de ajuda”.
- [ ] Testar lembrete de medicamento (10 s) → mesma coisa, com “Tomei”.

## C. Não perturbe LIGADO
- [ ] Ligar Não perturbe (⊖ na barra de status). Testar lembrete de **água** (10 s) → bloquear a tela.
      Esperado: **silenciado** (sem som; pode aparecer só como ícone).
- [ ] Testar lembrete de **medicamento** (10 s) → bloquear a tela.
      Esperado: **toca e vibra mesmo com Não perturbe**.
- [ ] Desligar o Não perturbe ao terminar.

## D. Alarme exato com o app fechado
- [ ] Cadastrar medicamento para daqui a 3 min. Fechar o app pelo gerenciador (deslizar para fora).
      Bloquear a tela e deixar quieto.
- [ ] O aviso chega no minuto certo (anote o atraso): ____ min.
- [ ] Sem confirmar, chega “Medicamento ainda não confirmado” 10 min depois.

## E. Reinício do aparelho
- [ ] Com um lembrete agendado para daqui a 5 min, reiniciar o aparelho e **não** abrir o app.
- [ ] O lembrete chega mesmo assim (anote o atraso): ____ min.
- [ ] Abrir o app: Mais → Testar notificações → lista “Agendados no sistema” continua preenchida.

## Resultados
(preencher)
