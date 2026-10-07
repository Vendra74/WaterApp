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

## Build de produção (AAB)

A Play Store aceita só **Android App Bundle** (`.aab`), assinado com a chave de upload. O perfil
`production` em `eas.json` já gera o bundle. No Mac (mesmo ambiente de `docs/BUILD.md`):

```bash
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
npx eas-cli@latest build --local --profile production --platform android --output cuidar-1.aab
```

- O build lê o `.env` do projeto: deixe `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  preenchidos para que a leitura de receita por foto exista no app da loja (sem eles o recurso
  fica oculto e as declarações de dados abaixo mudam).
- A chave de assinatura é a mesma do EAS (`eas credentials -p android` mostra e permite baixar o
  keystore; guarde uma cópia fora do Mac). Na primeira publicação o Play Console propõe a
  **Assinatura de apps pelo Google Play**: aceite e deixe o Google gerar a chave de assinatura final;
  a chave do EAS vira a chave de upload.
- Cada envio novo precisa de `android.versionCode` maior em `app.config.ts` (hoje `1`); a `version`
  (`0.1.0`) só muda quando quiser mostrar uma versão nova na ficha.
- Antes de enviar, instale o AAB no Motorola com `bundletool` (`build-apks --connected-device` e
  `install-apks`) ou, mais simples, suba o AAB num teste interno e instale pela Play Store.

## Conta de desenvolvedor e caminho até a produção

1. **Conta** em https://play.google.com/console (taxa única de US$ 25) com verificação de identidade.
   Conta pessoal: nome, endereço e documento; a Play exibe o nome e o e-mail na ficha. Com conta de
   organização (CNPJ), a Play pede o número D-U-N-S e a verificação demora mais.
2. **Conta pessoal nova** (criada depois de novembro de 2023): antes de poder publicar em produção,
   o app precisa passar por um **teste fechado com pelo menos 12 testadores inscritos durante 14 dias
   seguidos**. Depois disso o Console libera o botão “Solicitar acesso à produção”, que ainda passa
   por uma revisão rápida. Conta de organização não tem essa exigência.
3. **Criar o app** no Console: nome “Cuidar: água e remédios”, idioma português (Brasil), tipo App,
   gratuito. O nome não pode mudar para pago depois.
4. Preencher **Conteúdo do app** (lista abaixo), **Ficha da loja** e subir o AAB em **Teste fechado**
   (ou direto em Produção, se a conta permitir).
5. Enviar para revisão. A primeira revisão de um app novo costuma levar até 7 dias; respostas chegam
   por e-mail e na página do app.

## Ficha da loja (Play Console → Presença na loja → Ficha principal)

| Campo | Valor |
|---|---|
| Nome do app (30) | Cuidar: água e remédios |
| Descrição breve (80) | Lembretes de água e medicamentos, com letras grandes e botões fáceis. |
| Categoria | Aplicativo · Saúde e fitness |
| Tags | Lembretes, Saúde |
| E-mail de contato | contato@bookler.com.br |
| Site | https://vendra74.github.io/WaterApp/ |
| Política de privacidade | https://vendra74.github.io/WaterApp/privacidade.html |

### Descrição completa (até 4000 caracteres)

```
O Cuidar ajuda a manter a rotina de hidratação e a lembrar dos medicamentos, com uma tela simples, letras grandes e botões fáceis de tocar. Foi pensado para pessoas idosas e para quem cuida delas.

LEMBRETES DE MEDICAMENTOS
• Cadastre cada remédio com horários e dose, ou fotografe a receita para preencher o cadastro e conferir.
• O lembrete chega no horário exato, inclusive com a tela bloqueada.
• Confirme, adie ou pule a dose com um toque, direto na notificação.
• Veja o que ainda falta no dia na tela Hoje.

LEMBRETES DE ÁGUA
• Escolha os horários e a frequência dos lembretes.
• Registre a água com um toque e acompanhe o dia.
• Os lembretes de água respeitam o Não perturbe; os de medicamento, não.

FEITO PARA SER FÁCIL
• Letras ampliáveis e alto contraste.
• Leitura em voz alta da tela Hoje.
• Botão “Preciso de ajuda” que liga para os contatos que você escolher.

PRIVACIDADE
• Não precisa criar conta.
• Seus registros ficam no seu aparelho. Só a foto de receita que você autorizar ler é enviada para leitura, e não fica guardada.
• Sem anúncios.

O Cuidar é uma ferramenta de apoio à rotina. Não faz diagnóstico, não prescreve, não calcula doses nem metas e não substitui a orientação de profissionais de saúde. Não é um serviço de emergência.
```

### Imagens obrigatórias

| Item | Tamanho | Onde está |
|---|---|---|
| Ícone | 512 × 512 px, PNG | `/mnt/project-files/cuidar/play/icone-512.png` (gerado de `assets/icon.png`) |
| Gráfico de destaque | 1024 × 500 px, PNG ou JPG | `/mnt/project-files/cuidar/play/grafico-destaque.png` |
| Capturas de tela de celular | mínimo 2, máximo 8; 16:9 ou 9:16, lado maior entre 320 e 3840 px | Tirar no Motorola com o build de produção (sequência sugerida em `APP-STORE.md`, seção “Capturas de tela”). |

Capturas de tablet (7" e 10") só são exigidas se o app for declarado como otimizado para tablets.

## Conteúdo do app (Play Console → Política → Conteúdo do app)

| Declaração | Resposta |
|---|---|
| Política de privacidade | https://vendra74.github.io/WaterApp/privacidade.html |
| Anúncios | Não contém anúncios. |
| Acesso ao app | Todas as funções disponíveis sem login (a leitura por foto usa uma sessão anônima criada pelo próprio app). |
| Classificação de conteúdo | Questionário IARC, categoria Utilitário/Produtividade; responda “não” a tudo. Resultado esperado: Livre. |
| Público-alvo | 18 anos ou mais. Não é dirigido a crianças. |
| App de notícias | Não. |
| Apps de saúde | Sim: “Rastreamento e gerenciamento de saúde” (lembretes de medicamentos e hidratação). Não é dispositivo médico, não faz diagnóstico nem recomendações clínicas. |
| Rastreamento de contatos / COVID | Não. |
| Recursos financeiros | Não. |
| Apps governamentais | Não. |
| Segurança dos dados | Ver tabela abaixo. |

### Segurança dos dados (build com leitura de receita por foto)

- **Coleta ou compartilha dados do usuário?** Sim.
- **Criptografia em trânsito?** Sim (HTTPS).
- **Mecanismo para pedir exclusão?** Sim: a foto não é retida; demais dados são apagados pelo próprio
  app (*Mais → Meus dados → Apagar tudo*). Informe o e-mail de contato para pedidos.
- Tipos de dados:

| Tipo | Coletado | Compartilhado | Obrigatório | Finalidade |
|---|---|---|---|---|
| Fotos e vídeos → Fotos | Sim, só quando a pessoa envia uma receita para leitura | Sim, com o provedor de IA que faz a leitura | Opcional | Funcionalidade do app |
| Informações de saúde | Não é coletado: horários, doses e registros ficam só no aparelho | Não | — | — |
| IDs do dispositivo ou outros | Sim: identificador anônimo criado pelo app, só para contar leituras | Não | Opcional | Funcionalidade, prevenção de abuso |

Nenhum dado é usado para publicidade, análise ou personalização. A foto é processada e descartada:
a Play aceita marcar como “processamento efêmero” se a imagem não for retida por mais tempo que a
leitura, mas, como o provedor de IA pode guardá-la por um período curto conforme a própria política,
a declaração acima é a mais segura.

Se o AAB for gerado **sem** as credenciais do Supabase, a leitura por foto fica oculta e a resposta
passa a ser “Não coleta nem compartilha dados”, como na versão da App Store.

## Antes de clicar em “Enviar para revisão”

- [ ] Conta de desenvolvedor verificada.
- [ ] App criado no Console com o nome e o idioma acima.
- [ ] AAB de produção gerado e instalado num aparelho real (notificação de medicamento com a tela
      bloqueada, Não perturbe, reinício do aparelho).
- [ ] Ficha da loja: textos, ícone 512, gráfico de destaque, 2 a 8 capturas.
- [ ] Conteúdo do app: todas as declarações acima preenchidas.
- [ ] Justificativa de alarmes exatos e vídeo (seção acima) salvos para responder à revisão, se pedir.
- [ ] Países: Brasil (acrescente outros se quiser).
- [ ] Conta pessoal nova: teste fechado com 12 testadores por 14 dias concluído e acesso à produção
      solicitado.
