# Instalar o Cuidar em outros iPhones (TestFlight)

Com o Apple Developer Program ativo, o caminho para instalar o app em qualquer iPhone sem cabo é o
**TestFlight**: um build é enviado ao App Store Connect e cada pessoa convidada instala pelo app
TestFlight. Enviar ao TestFlight **não** publica o app na App Store.

Identificação do app (de `app.config.ts`): nome **Cuidar**, Bundle ID **br.com.vendra.cuidar**,
versão `0.1.0`, `buildNumber` `1`.

## 1. Criar o app no App Store Connect (uma vez, no navegador)

1. https://appstoreconnect.apple.com → **Apps** → **+** → **Novo app**.
2. Plataforma **iOS**; nome **Cuidar**; idioma principal **Português (Brasil)**;
   Bundle ID **br.com.vendra.cuidar**; SKU `cuidar`; acesso de usuário **Acesso total**.
3. Se o Bundle ID não aparecer na lista, registre-o antes em
   https://developer.apple.com/account/resources/identifiers (**+** → App IDs → App → explícito
   `br.com.vendra.cuidar`, marcando a capability **Time Sensitive Notifications**) e repita o passo 2.
4. Na primeira vez, aceite os contratos pendentes em **Business** → Agreements (o de app pago/
   gratuito aparece na página inicial do App Store Connect quando falta aceitar).

## 2. Gerar e enviar o build (no Mac)

Caminho recomendado: Xcode, que já está conectado ao Apple ID do Andre.

```bash
cd ~/Documents/WaterApp
git checkout main && git pull
npm install
npx expo prebuild --platform ios --clean      # regera ios/ com buildNumber e Info.plist atuais
(cd ios && LANG=en_US.UTF-8 pod install)   # sem LANG, o CocoaPods com Ruby 4 falha com Encoding::CompatibilityError
open ios/Cuidar.xcworkspace
```

Com o **Xcode 27** (SDK do iOS 27), o iOS 27 encerra na abertura qualquer app que ainda use só o AppDelegate.
O template do Expo SDK 57 não adota as cenas (UIScene); por isso `app.config.ts` liga
`expo-build-properties` → `ios.enableSceneSupport`, que faz o `prebuild` registrar o `ExpoAppSceneDelegate`
no Info.plist. Confira depois do prebuild: `/usr/libexec/PlistBuddy -c 'Print UIApplicationSceneManifest' ios/Cuidar/Info.plist`.
Foi o motivo da rejeição do build 5 (2.1.0, crash em iPadOS 27). Ao migrar para o SDK 58 a opção pode sair.

No Xcode:

1. Selecione o destino **Any iOS Device (arm64)** (ao lado do nome do esquema *Cuidar*).
2. Em **Signing & Capabilities** do target *Cuidar*, confira que **Automatically manage signing** está
   ligado e o **Team** é o da conta paga (não o *Personal Team*).
3. **Product → Archive** (alguns minutos). Ao terminar abre o *Organizer*.
4. **Distribute App → App Store Connect → Upload**, mantendo as opções padrão (*Upload symbols*,
   *Manage version and build number* desmarcado). Entre com o Apple ID se o Xcode pedir.
5. Em 5 a 15 minutos chega um e-mail "Cuidar has completed processing". Se vier "Missing Compliance",
   confira que o build tem `ITSAppUsesNonExemptEncryption = false` (passo de `prebuild` acima).

Alternativa sem Xcode aberto (também local, sem fila do EAS):

```bash
npx eas-cli@latest build --local --profile production --platform ios --output cuidar.ipa
npx eas-cli@latest submit --platform ios --path cuidar.ipa
```

O `eas build` pede o login da conta Apple na primeira vez para gerar o certificado de distribuição e
o perfil; o `eas submit` pode criar o registro no App Store Connect sozinho se o passo 1 foi pulado.

## 3. Convidar quem vai testar

No App Store Connect → **Cuidar** → aba **TestFlight**:

- **Testadores internos** (até 100, sem revisão da Apple, build disponível assim que processar):
  a pessoa precisa antes ser adicionada em **Usuários e Acesso** com um Apple ID. Depois,
  TestFlight → *Testadores internos* → **+** → crie um grupo (ex.: "Família") e marque as pessoas.
- **Testadores externos** (até 10 000, por e-mail ou link público): TestFlight → *Testadores externos*
  → **+** grupo → adicione o build → **Enviar para revisão**. A primeira revisão beta leva em geral
  até 1 dia; os builds seguintes costumam ser liberados em minutos. Com o grupo criado, ative
  **Link público** e mande o link.

A pessoa instala o app **TestFlight** na App Store, abre o convite (e-mail ou link) e toca em
**Instalar**. Cada build do TestFlight vale por 90 dias; o app avisa quando houver versão nova.

## 4. Enviar uma versão nova

1. Aumente `ios.buildNumber` em `app.config.ts` (`'1'` → `'2'` …). A `version` só muda quando
   quiser; o App Store Connect exige apenas um número de build maior que o anterior.
2. Repita o passo 2. Os testadores já convidados recebem o novo build sem convite novo (testadores
   externos: só depois que a Apple liberar, normalmente em minutos a partir do segundo build).

## Observações

- O build de TestFlight é um build de produção, sem *dev client*: o JS vai embutido e não carrega do
  Metro. No iPhone do Andre ele substitui o build instalado pelo Xcode (mesmo Bundle ID).
- O entitlement de Time Sensitive Notifications e o `UIBackgroundModes` já vêm de `app.config.ts`;
  o Xcode com assinatura automática habilita a capability no App ID.
- Publicar na App Store é outro passo (ficha da loja, capturas, revisão completa) e não acontece
  por enviar ao TestFlight.
