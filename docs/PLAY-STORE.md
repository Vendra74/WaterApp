# Publicação na Play Store: permissões e declarações

Material para a revisão do app no Google Play Console. Os textos abaixo podem ser colados nos
formulários de declaração. Mantenha-os alinhados com o comportamento real do app.

## Alarmes exatos (`SCHEDULE_EXACT_ALARM` e `USE_EXACT_ALARM`)

O app declara as duas permissões em `app.config.ts` (seção `android.permissions`).

| Permissão | Android | Como é concedida | Uso no Cuidar |
|---|---|---|---|
| `SCHEDULE_EXACT_ALARM` | 12 (API 31) e superior | Pela pessoa, na tela “Alarmes e lembretes” do sistema. Em Android 14+ vem negada por padrão. O app tem o botão “Permitir alarmes exatos” em *Mais → Testar notificações*, que abre essa tela. | Lembretes de medicamento e de água no horário prescrito. |
| `USE_EXACT_ALARM` | 13 (API 33) e superior | Automaticamente, na instalação. Não pode ser revogada pela pessoa. | Garante o horário exato mesmo quando a pessoa idosa não consegue achar a opção no sistema. |

### O que a política do Google Play exige

A política de permissões de alarme exato permite `USE_EXACT_ALARM` apenas quando a função central
do app precisa de alarmes precisos, citando como exemplos despertadores, temporizadores e agendas
que notificam eventos. Apps fora desse grupo devem usar `SCHEDULE_EXACT_ALARM` e pedir a permissão
à pessoa. A revisão pode pedir justificativa por escrito e um vídeo mostrando a função.

O Cuidar se enquadra como lembrete com horário definido pela própria pessoa (ou pela receita):
a notificação de medicamento às 08:00 não tem valor se chegar às 08:07. Ainda assim, a Play Store
pode considerar que um app de medicamentos não é “despertador” e recusar `USE_EXACT_ALARM`.
Decisão recomendada: enviar com as duas permissões e a justificativa abaixo. Se a revisão recusar,
remova somente `USE_EXACT_ALARM` de `app.config.ts`, gere novo build e reenvie: o app continua
funcionando com `SCHEDULE_EXACT_ALARM`, pois já pede a permissão à pessoa e já orienta como ativar.

### Justificativa para colar no formulário (pt-BR)

> O Cuidar é um aplicativo de lembretes de medicamentos e de hidratação para pessoas idosas. Sua
> função central é avisar, no horário exato prescrito, que é hora de tomar um medicamento ou beber
> água, com botões de confirmação na própria notificação. Os horários são definidos pela pessoa a
> partir da receita médica (por exemplo, 08:00, 14:00 e 20:00). Um atraso de alguns minutos, comum
> quando o sistema agrupa alarmes inexatos em economia de bateria, faz a pessoa tomar a dose fora
> do horário ou perder a confirmação. O app usa alarmes exatos exclusivamente para essas
> notificações agendadas pela pessoa; não executa trabalho em segundo plano, não coleta dados nem
> exibe anúncios no disparo. `USE_EXACT_ALARM` é necessária porque o público-alvo tem dificuldade
> para localizar a opção “Alarmes e lembretes” nas configurações do sistema, e sem ela, em
> Android 14, a permissão de alarme exato vem negada por padrão.

### Justificativa para colar no formulário (en)

> Cuidar is a medication and hydration reminder app for older adults. Its core function is to
> notify the person at the exact prescribed time that a medication or a glass of water is due,
> with confirmation actions on the notification itself. Times are set by the person from their
> prescription (for example 08:00, 14:00 and 20:00). A delay of a few minutes, which happens when
> the system batches inexact alarms under battery saving, makes the person take a dose late or
> miss the confirmation window. The app uses exact alarms only for these user-scheduled
> notifications; it performs no other background work, collects no data and shows no ads when an
> alarm fires. USE_EXACT_ALARM is needed because the target audience struggles to find the
> “Alarms & reminders” system setting, and on Android 14 the exact alarm permission is denied by
> default without it.

### Vídeo para a revisão

Grave no celular (tela bloqueada ao final) e envie junto com a justificativa:

1. Cadastrar um medicamento com horário daqui a dois minutos.
2. Bloquear a tela e esperar o lembrete chegar no horário.
3. Tocar em “Tomei” na notificação e mostrar a dose confirmada na tela Hoje.

## Outras permissões declaradas

| Permissão | Motivo | Formulário da Play |
|---|---|---|
| `POST_NOTIFICATIONS` | Exibir os lembretes. Pedida em tempo de execução. | Nenhum. |
| `RECEIVE_BOOT_COMPLETED` | Reagendar lembretes após reiniciar o aparelho. | Nenhum. |
| `VIBRATE` | Vibração opcional nos lembretes. | Nenhum. |
| Câmera e galeria (via `expo-image-picker`) | Foto opcional da embalagem ou receita. Pedida só ao tocar em “Adicionar foto”. | Nenhum. |

O app não declara microfone, localização, contatos nem acesso a arquivos.

## Declarações do Play Console

- **Segurança dos dados**: sem Supabase configurado, nenhum dado sai do aparelho. Com Supabase,
  o app envia registros de água, medicamentos e perfil à conta da pessoa, cifrados em trânsito,
  com exclusão disponível em *Mais → Meus dados → Apagar tudo*. Declare conforme o build enviado.
- **Apps de saúde**: o Cuidar é ferramenta de rotina. Não diagnostica, não prescreve, não calcula
  doses nem metas e não é serviço de emergência (texto em `src/config/branding.ts`). Use essa
  descrição ao preencher a categoria e a declaração de conteúdo de saúde.
- **Público-alvo**: adultos. O app não é dirigido a crianças.
- **Política de privacidade**: a Play exige uma URL pública. Pendência: publicar o texto antes do
  envio.
