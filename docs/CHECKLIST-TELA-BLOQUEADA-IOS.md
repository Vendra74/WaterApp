# Checklist curto: lembretes na tela bloqueada (iPhone)

Aparelho: _a preencher_ · iOS: _a preencher_ · Build: _a preencher_ · Data: _a preencher_

Marque `[x]` quando o esperado acontecer, `[ ]` se falhar, e anote o que viu.
É a versão para iPhone de `docs/CHECKLIST-TELA-BLOQUEADA.md` (Motorola). O que muda no iOS:

- Não existem “alarmes exatos” nem “Acesso aos modos”: o iOS entrega notificações locais no horário
  e quem decide o que fura o **Modo Foco / Não Perturbe** é o nível “Urgente” (Time Sensitive) da
  notificação. O Cuidar marca como urgente só os lembretes de medicamento.
- O iOS guarda no máximo 64 notificações pendentes por app.
- A chave lateral de silencioso tira o som de qualquer notificação (fica só a vibração). Deixe o
  iPhone **com som** durante o teste, exceto no item F.
- Os botões do lembrete aparecem ao **manter o dedo pressionado** sobre a notificação.

## A. Preparação (2 min)
- [ ] App instalado e aberto pelo menos uma vez (Mais → Testar notificações mostra permissão “concedida”).
- [ ] Ajustes → Notificações → Cuidar: “Permitir Notificações” ligado, com Tela Bloqueada, Central de
      Notificações, Faixas e Sons marcados.
- [ ] Na mesma tela aparece a chave “Notificações Urgentes” e ela está ligada.
- [ ] Ajustes → Notificações → Resumo Programado: desligado, ou o Cuidar fora do resumo.

## B. Tela bloqueada, Foco desligado
- [ ] Testar lembrete de água (10 s) → bloquear a tela → chega com som e vibração e acende a tela.
- [ ] Manter pressionado mostra “Registrar água”, “Lembrar depois”, “Preciso de ajuda”.
- [ ] Testar lembrete de medicamento (10 s) → mesma coisa, com “Tomei”.
- [ ] Tocar em “Tomei” pede o desbloqueio e abre o app na confirmação (nada é registrado sozinho).

## C. Modo Foco “Não Perturbe” LIGADO
Antes: Ajustes → Foco → Não Perturbe → Apps: o Cuidar **não** deve estar na lista de permitidos, e
“Notificações Urgentes” deve estar ligado.
- [ ] Ligar o Não Perturbe (Central de Controle → Foco). Testar lembrete de **água** (10 s) → bloquear a tela.
      Esperado: **silenciado** (sem som, sem acender a tela; fica só na Central de Notificações).
- [ ] Testar lembrete de **medicamento** (10 s) → bloquear a tela.
      Esperado: **toca, vibra e acende a tela mesmo com o Foco**, com a etiqueta “Urgente”.
- [ ] Desligar o Foco ao terminar.

## D. Horário certo com o app fechado
- [ ] Cadastrar medicamento para daqui a 3 min. Fechar o app pelo seletor de apps (deslizar para cima).
      Bloquear a tela e deixar quieto.
- [ ] O aviso chega no minuto certo (anote o atraso): ___
- [ ] Sem confirmar, chega “Medicamento ainda não confirmado” 10 min depois.

## E. Reinício do aparelho
- [ ] Com um lembrete agendado para daqui a 5 min, reiniciar o iPhone e **não** abrir o app
      (anote se desbloqueou o aparelho depois de ligar ou se deixou na tela de código).
- [ ] O lembrete chega mesmo assim (anote o atraso): ___
- [ ] Abrir o app: Mais → Testar notificações → lista “Agendados no sistema” continua preenchida
      (anote “planejadas” e “agendadas”; agendadas nunca passa de 64).

## F. Só no iPhone
- [ ] Chave de silencioso ligada: o lembrete de medicamento aparece e vibra, sem som.
- [ ] Apagar o medicamento de teste: a notificação dele some da tela bloqueada e da Central de Notificações.

## Resultados
_A preencher depois da sessão de teste._
