# Publicação na App Store

Material para preencher o App Store Connect. Os textos podem ser colados como estão; mantenha-os
alinhados com o comportamento real do app (sem metas automáticas, sem conversões, sem recomendações
clínicas). O build enviado é o mesmo já aprovado no TestFlight (ver [TESTFLIGHT.md](TESTFLIGHT.md)).

## Páginas públicas (GitHub Pages)

A Apple exige uma **URL de política de privacidade** e uma **URL de suporte**. As duas páginas
estão nesta pasta: `docs/privacidade.html` e `docs/index.html`. Para publicá-las:

1. No GitHub, abra **Settings → Pages** do repositório.
2. Em *Build and deployment*, escolha **Deploy from a branch**, branch `main`, pasta `/docs`, e salve.
3. Em alguns minutos as páginas ficam em:
   - suporte: `https://vendra74.github.io/WaterApp/`
   - privacidade: `https://vendra74.github.io/WaterApp/privacidade.html`
4. Troque `CONTATO@EXEMPLO.COM` nas duas páginas pelo e-mail de contato que vai constar na loja.

## Ficha da loja (App Store Connect → Cuidar → Distribuição → 1.0 Preparar para envio)

| Campo | Valor |
|---|---|
| Nome | Cuidar: água e remédios (já definido ao criar o app; 30 caracteres no máximo) |
| Subtítulo (30) | Lembretes de água e medicamentos |
| Categoria principal | Saúde e fitness |
| Categoria secundária | Utilitários (evite “Medicina”: a diretriz 5.1.3 impõe exigências extras a essa categoria, e o app se declara apoio à rotina) |
| Idioma principal | Português (Brasil) |
| Preço | Grátis |
| Disponibilidade | Brasil (acrescente outros países se quiser) |
| Classificação etária | Responda “Nenhum” a tudo, exceto **Informações médicas/tratamento: Infrequente/Leve**. Resultado esperado: 4+ (ou 12+, conforme o questionário atual da Apple). |
| Direitos autorais | 2026 André Luiz Machado Vendramini |
| URL de suporte | `https://vendra74.github.io/WaterApp/` |
| URL de privacidade | `https://vendra74.github.io/WaterApp/privacidade.html` |

### Palavras-chave (até 100 caracteres, separadas por vírgula)

```
água,hidratação,remédio,medicamento,lembrete,idoso,idosos,cuidador,saúde,rotina,alarme,dose
```

### Texto promocional (até 170 caracteres, pode mudar sem novo build)

```
Letras grandes, botões fáceis e lembretes que tocam na hora certa, mesmo com a tela bloqueada.
```

### Descrição (até 4000 caracteres)

```
O Cuidar ajuda a manter a rotina de hidratação e a lembrar dos medicamentos, com uma tela simples, letras grandes e botões fáceis de tocar. Foi pensado para pessoas idosas e para quem cuida delas.

LEMBRETES DE MEDICAMENTOS
• Cadastre cada remédio com horários e dose.
• O lembrete chega no horário, inclusive com a tela bloqueada.
• Confirme, adie ou pule a dose com um toque, direto na notificação.
• Veja o que ainda falta no dia na tela Hoje.

LEMBRETES DE ÁGUA
• Escolha os horários e a frequência dos lembretes.
• Registre a água com um toque e acompanhe o dia.
• Os lembretes de água ficam silenciosos no Não Perturbe; os de medicamento, não.

FEITO PARA SER FÁCIL
• Letras ampliáveis e alto contraste.
• Leitura em voz alta da tela Hoje.
• Botão “Preciso de ajuda” que liga para os contatos que você escolher.

PRIVACIDADE
• Não precisa criar conta.
• Todos os dados ficam no seu aparelho. Nada é enviado ao desenvolvedor.
• Sem anúncios.

O Cuidar é uma ferramenta de apoio à rotina. Não faz diagnóstico, não prescreve, não calcula doses nem metas e não substitui a orientação de profissionais de saúde. Não é um serviço de emergência.
```

### Novidades desta versão (0.1.0)

```
Primeira versão do Cuidar: lembretes de água e de medicamentos, confirmação de dose pela notificação, leitura em voz alta e botão de ajuda.
```

## Capturas de tela

A Apple exige pelo menos as do iPhone de 6,9" (1320 × 2868 px, por exemplo iPhone 17 Pro Max) e
aceita que elas sejam reaproveitadas para os tamanhos menores.

**iPad:** `supportsTablet` está ligado em `app.config.ts`, o que obriga capturas de iPad 13"
(2064 × 2752 px) e faz a revisão testar num layout que nunca foi validado. Recomendação para esta
primeira versão: `supportsTablet: false`, com `ios.buildNumber` maior, gerando um build novo antes do
envio.

Sugestão de sequência (3 a 6 imagens, tiradas no próprio iPhone com o build do TestFlight):

1. Tela **Hoje** com um lembrete de água e um medicamento pendente.
2. Notificação de medicamento na tela bloqueada com os botões “Tomei” e “Lembrar depois”.
3. Tela **Medicamentos** com dois ou três cadastrados.
4. Tela **Histórico**.
5. Tela **Hoje** com letras grandes ligadas (Perfil → acessibilidade).

Não use dados reais de pessoas; nomes de medicamentos genéricos (por exemplo, “Vitamina D”) evitam
qualquer leitura como recomendação.

## Privacidade do app (App Store Connect → Privacidade do app)

- **Você ou seus parceiros terceirizados coletam dados deste app?** Não.
  - Justificativa: todos os dados ficam no aparelho; não há conta, servidor, análise de uso nem anúncios.
  - O rótulo exibido na loja será “Dados não coletados”.
- Se uma versão futura ativar o compartilhamento com cuidador (Supabase), refaça o questionário:
  passaria a coletar “Informações de saúde” e “Informações de contato”, vinculadas ao usuário, para
  a funcionalidade do app.

## Informações para a revisão (App Review Information)

- **Login necessário:** não.
- **Contato:** seu nome, telefone e e-mail.
- **Notas (colar):**

```
O Cuidar é um app de lembretes de hidratação e de medicamentos. Não exige login; todos os recursos funcionam localmente no aparelho e os lembretes usam notificações locais. O app não faz diagnóstico, não prescreve nem calcula doses ou metas; os horários e quantidades são sempre informados pela própria pessoa. Para testar: conclua a avaliação inicial, cadastre um medicamento com horário próximo e permita as notificações. O entitlement de Time Sensitive Notifications é usado só para o lembrete de medicamento, para que ele toque mesmo no Modo Foco; o lembrete de água não usa esse nível.
```

## Distribuição não listada (opcional)

Se preferir que o app fique na App Store só por link, sem aparecer na busca, peça a distribuição não
listada **antes** de enviar para revisão, em https://developer.apple.com/support/unlisted-app-distribution/
(formulário curto explicando o público restrito). Depois de aprovada, a opção aparece em
*Pricing and Availability*. A revisão é a mesma da publicação normal.

## Criptografia

`ITSAppUsesNonExemptEncryption = false` já está no build (ver `app.config.ts`), então o App Store
Connect não pergunta sobre exportação de criptografia.

## Envio

1. Em **Distribuição → iOS App → 1.0 Preparar para envio**, preencha os campos acima, envie as capturas
   e escolha o build (o mais recente aprovado no TestFlight).
2. Preencha **Privacidade do app** e **Classificação etária**.
3. Em **Lançamento da versão**, escolha “Lançar manualmente” se quiser controlar o dia.
4. Clique em **Adicionar para revisão** e depois **Enviar para revisão**. A revisão costuma levar de 1 a
   3 dias; respostas da Apple chegam por e-mail e na página do app.
5. Se a Apple pedir algo (por exemplo, uma mudança na descrição), responda pelo **Resolution Center** na
   mesma página.

## Depois da publicação

- Cada versão nova precisa de `version` novo (`0.1.1`, `0.2.0`…) em `app.config.ts`, além de
  `ios.buildNumber` maior, e passa pela revisão de novo (geralmente mais rápida).
- O TestFlight continua servindo para testar o build seguinte antes de publicá-lo.
- A Play Store tem o próprio material em [PLAY-STORE.md](PLAY-STORE.md).
