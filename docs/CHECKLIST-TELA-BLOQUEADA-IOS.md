# Checklist curto: lembretes na tela bloqueada (iPhone)

Aparelho: iPhone 17 Pro Max · iOS 26.6.2 · Build: Release local (Xcode 27) de `main` em 7463b1e, assinado com Personal Team gratuito · Data: 01/10/2026

Marque `[x]` quando o esperado acontecer, `[ ]` se falhar, `[-]` se não foi testado, e anote o que viu.
É a versão para iPhone de `docs/CHECKLIST-TELA-BLOQUEADA.md` (Motorola). O que muda no iOS:

- Não existem “alarmes exatos” nem “Acesso aos modos”: o iOS entrega notificações locais no horário
  e quem decide o que fura o **Modo Foco / Não Perturbe** é o nível “Urgente” (Time Sensitive) da
  notificação. O Cuidar marca como urgente só os lembretes de medicamento.
- O iOS guarda no máximo 64 notificações pendentes por app.
- A chave lateral de silencioso tira o som de qualquer notificação (fica só a vibração). Deixe o
  iPhone **com som** durante o teste, exceto no item F.
- Os botões do lembrete aparecem ao **manter o dedo pressionado** sobre a notificação.
- Não há como tocar na tela do iPhone pelo Mac (como o `adb` no Android): os toques são manuais.
  Pelo cabo dá para instalar, abrir o app e ler os dados dele (`xcrun devicectl`).

## A. Preparação (2 min)
- [x] App instalado e aberto pelo menos uma vez (Mais → Testar notificações mostra permissão “concedida”).
- [-] Ajustes → Notificações → Cuidar: “Permitir Notificações” ligado, com Tela Bloqueada, Central de
      Notificações, Faixas e Sons marcados. (não conferido na tela de Ajustes; os lembretes do bloco B chegaram normalmente)
- [-] Na mesma tela aparece a chave “Notificações Urgentes” e ela está ligada. (não se aplica a este
      build: sem o entitlement a chave não existe; ver Resultados)
- [-] Ajustes → Notificações → Resumo Programado: desligado, ou o Cuidar fora do resumo. (não conferido)

## B. Tela bloqueada, Foco desligado
- [x] Testar lembrete de água (10 s) → bloquear a tela → chega com som e vibração e acende a tela.
- [x] Manter pressionado mostra “Registrar água”, “Lembrar depois”, “Preciso de ajuda”.
- [x] Testar lembrete de medicamento (10 s) → mesma coisa, com “Tomei”.
- [-] Tocar em “Tomei” pede o desbloqueio e abre o app na confirmação (nada é registrado sozinho).
      (não testado: nos dois lembretes o botão tocado foi “Lembrar depois”, que abriu o app sem dizer
      o que aconteceu; ver achado 1)

## C. Modo Foco “Não Perturbe” LIGADO
Antes: Ajustes → Foco → Não Perturbe → Apps: o Cuidar **não** deve estar na lista de permitidos, e
“Notificações Urgentes” deve estar ligado.
- [x] Ligar o Não Perturbe (Central de Controle → Foco). Testar lembrete de **água** (10 s) → bloquear a tela.
      Esperado: **silenciado** (sem som, sem acender a tela; fica só na Central de Notificações).
- [ ] Testar lembrete de **medicamento** (10 s) → bloquear a tela.
      Esperado: **toca, vibra e acende a tela mesmo com o Foco**, com a etiqueta “Urgente”.
      **FALHA:** ficou quieto, igual à água (ver Resultados).
- [x] Desligar o Foco ao terminar. (só foi desligado depois da dose das 17:45; ver bloco D)

## D. Horário certo com o app fechado
- [x] Cadastrar medicamento para daqui a 3 min. Fechar o app pelo seletor de apps (deslizar para cima).
      Bloquear a tela e deixar quieto. (medicamento “Teste” salvo às 17:43:37, dose às 17:45)
- [-] O aviso chega no minuto certo (anote o atraso): não avaliado. O Não Perturbe tinha ficado ligado
      desde o bloco C e a dose das 17:45 não apareceu; é o mesmo bug do bloco C, agora com um lembrete real.
- [x] Sem confirmar, chega “Medicamento ainda não confirmado” 10 min depois. (17:55, com o app fechado
      e o Foco já desligado)

## E. Reinício do aparelho
- [x] Com um lembrete agendado para daqui a 5 min, reiniciar o iPhone e **não** abrir o app
      (reiniciado logo após a repetição das 17:55; código digitado depois de ligar).
- [x] O lembrete chega mesmo assim (anote o atraso): segunda repetição às 18:05, no minuto.
- [-] Abrir o app: Mais → Testar notificações → lista “Agendados no sistema” continua preenchida
      (não conferido na tela depois do reinício; antes dele o estado gravado pelo app era “planejadas 60 · agendadas 60”).

## F. Só no iPhone
- [-] Chave de silencioso ligada: o lembrete de medicamento aparece e vibra, sem som. (não testado)
- [-] Apagar o medicamento de teste: a notificação dele some da tela bloqueada e da Central de Notificações. (não testado)

## Resultados (sessão de 01/10/2026, toques feitos por Andre; 10 itens OK, 1 falha, 8 não testados)
Build testado: Release compilado no Mac a partir de `main` (7463b1e) com `expo prebuild` + `xcodebuild`,
assinado com a conta Apple gratuita (Personal Team). Para assinar com conta gratuita foi preciso tirar o
entitlement `aps-environment` (push remoto), que o Personal Team não aceita; as notificações locais não
dependem dele. Som e vibração foram relatados por quem estava com o aparelho, não medidos.

- **A/B** OK: permissão concedida; água e medicamento chegam na tela bloqueada com som, vibração e os
  botões corretos ao manter pressionado.
- **C** C2 **falha**: com o Não Perturbe ligado, o lembrete de medicamento fica calado. Causa: o app
  pede `interruptionLevel: 'timeSensitive'`, mas não declarava o entitlement
  `com.apple.developer.usernotifications.time-sensitive`; sem ele o iOS trata o lembrete como comum.
  A falha se repetiu com um lembrete real (dose das 17:45 do bloco D, com o Foco esquecido ligado).
- **D** repetição “ainda não confirmado” entregue às 17:55 com o app fechado pelo seletor e a tela
  bloqueada. O banco do app, lido pelo cabo, mostra o reagendamento às 17:43:37 com 60 planejadas,
  60 agendadas e nenhum erro.
- **E** OK: depois de reiniciar o iPhone sem abrir o app, a segunda repetição chegou às 18:05.

### Achados
1. **Usabilidade:** “Lembrar depois” abre o app sem dizer o que foi feito. No lembrete de teste nada
   é adiado (de propósito), e no de água o novo aviso é agendado sem confirmação na tela.
2. O lembrete de **teste** de água pedia o nível “urgente”, diferente do lembrete real de água. Sem o
   entitlement não fazia diferença; com ele, o teste de água furaria o Foco.
3. **Limite da conta gratuita:** o Personal Team recusa a capacidade Time Sensitive Notifications
   (“Personal development teams … do not support the Time Sensitive Notifications capability”).
   A correção do item C2 só pode ser verificada no aparelho com o Apple Developer Program pago.
4. O app instalado com conta gratuita expira em 7 dias (até 08/10/2026); depois disso é preciso
   reinstalar pelo Mac. Os dados do app são mantidos na reinstalação.

### Correções (mesmo PR, commit separado)
- Entitlement de Time Sensitive declarado em `app.config.ts`. **Não verificado no aparelho** (achado 3).
- Lembrete de teste de água passa a usar o nível comum.
- “Lembrar depois” mostra uma confirmação (“Lembrete adiado… em N min”, ou que o teste não adia nada).
  Conferido no iPhone com a versão corrigida (commit 5f040ac, mesma assinatura gratuita): o aviso aparece no lembrete de teste.

Estado deixado no aparelho: Não Perturbe desligado, Modo de Desenvolvedor ligado, versão corrigida instalada
por cima (sem o entitlement de Time Sensitive), medicamento “Teste” apagado por Andre, dados do perfil intactos.
