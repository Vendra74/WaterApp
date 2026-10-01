# Gerar o development build

O app usa módulos nativos (notificações com botões, SQLite, tarefas em segundo plano), então o
**Expo Go não serve** para o teste real. É preciso um *development build*. Escolha um caminho.

## Caminho A — EAS Build (na nuvem, sem Android Studio/Xcode)

Pré-requisitos: conta gratuita em https://expo.dev e o celular com o app **Expo Orbit** ou o
navegador para instalar o arquivo.

```bash
npm install
npx eas-cli@latest login
npx eas-cli@latest init            # cria o projeto e grava o projectId (aceite o padrão)
npx eas-cli@latest build --profile development --platform android
```

- Ao terminar, o EAS mostra um QR code e um link `.apk`. Abra no celular Android e instale
  (permita "instalar apps desconhecidos" se o sistema pedir).
- iOS: `--platform ios` exige uma conta Apple Developer (paga) e o registro do UDID do iPhone
  (`npx eas-cli@latest device:create`). O EAS gera um `.ipa` de distribuição interna instalável
  pelo link.

Depois de instalar, no computador:

```bash
npx expo start --dev-client
```

Abra o app no celular e escolha o servidor da mesma rede Wi-Fi (ou escaneie o QR code).
Se a rede bloquear, use `npx expo start --dev-client --tunnel`.

## Caminho B — Build local

Android, sem Android Studio (caminho usado no Mac do Andre em 01/10/2026, build em ~12 min):

```bash
brew install openjdk@17 android-commandlinetools
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools"
npx eas-cli@latest build --local --profile development --platform android --output cuidar-dev.apk
adb install -r cuidar-dev.apk
```

`eas build --local` assina com a mesma chave do EAS, então o APK instala por cima do anterior sem
perder os dados do app. Um `npx expo run:android` comum assina com outra chave: o Android recusa a
atualização e seria preciso desinstalar o app (apagando os dados).

Android com Android Studio (SDK 35+, NDK e JDK 17 embutidos): conecte o celular com
**depuração USB** ativada e rode `npx expo run:android --device` (vale a observação da chave acima).

iOS (somente macOS com Xcode): conecte o iPhone, confie no computador e rode:

```bash
npx expo run:ios --device
```

## Depois do build

Siga `docs/TESTE-DISPOSITIVO.md` e anote os resultados. Qualquer falha, cole no chat a mensagem
exata (e, se possível, a saída de `npx expo start --dev-client`, ou `adb logcat -s ReactNativeJS
expo-notifications` no Android) para eu corrigir.
