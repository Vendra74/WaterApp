import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Nome provisório do produto. Para renomear o app, altere apenas
 * `src/config/branding.ts` (texto exibido) e as chaves abaixo (loja/sistema).
 */
const APP_DISPLAY_NAME = 'Cuidar';
const APP_SLUG = 'cuidar';
const BUNDLE_ID = 'br.com.vendra.cuidar';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_DISPLAY_NAME,
  slug: APP_SLUG,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: APP_SLUG,
  // O app só tem paletas claras (src/ui/theme.ts). Em 'automatic', o Modo Escuro do sistema pintava
  // componentes nativos (roleta de horário, alertas, teclado) com texto claro sobre o nosso fundo claro.
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    // Número do build enviado ao App Store Connect/TestFlight. Cada envio precisa de um número maior
    // que o anterior (a `version` pode continuar igual). Ver docs/TESTFLIGHT.md.
    buildNumber: '2',
    supportsTablet: true,
    infoPlist: {
      // O app só usa a criptografia padrão do sistema (HTTPS). Sem esta chave, o App Store Connect
      // pergunta sobre exportação de criptografia a cada build enviado.
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        'A câmera é usada apenas para fotografar a embalagem ou a receita de um medicamento, se você quiser.',
      NSPhotoLibraryUsageDescription:
        'O acesso às fotos é usado apenas para anexar uma imagem da embalagem ou da receita de um medicamento.',
      UIBackgroundModes: ['fetch', 'processing'],
    },
    entitlements: {
      // Sem este entitlement o iOS trata `interruptionLevel: 'timeSensitive'` como notificação comum,
      // e o lembrete de medicamento fica calado no Modo Foco / Não Perturbe.
      'com.apple.developer.usernotifications.time-sensitive': true,
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#0B5FA5',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.POST_NOTIFICATIONS',
      // Lembretes de medicamento precisam de horário exato. SCHEDULE_EXACT_ALARM cobre Android 12;
      // em Android 13+ USE_EXACT_ALARM é concedida na instalação para apps de alarme/lembrete
      // (a Play Store pode pedir justificativa na revisão: ver docs/PLAY-STORE.md).
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      // Sem esta permissão o app não aparece na lista "Acesso aos modos / Não perturbe" do sistema,
      // e o canal de medicamentos não consegue ignorar o Não perturbe.
      'android.permission.ACCESS_NOTIFICATION_POLICY',
    ],
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 220,
        resizeMode: 'contain',
        backgroundColor: '#0B5FA5',
        dark: { backgroundColor: '#084780' },
      },
    ],
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#0B5FA5', defaultChannel: 'hydration' }],
    'expo-sqlite',
    'expo-secure-store',
    'expo-background-task',
    [
      'expo-image-picker',
      {
        cameraPermission: 'Fotografar a embalagem ou a receita de um medicamento.',
        photosPermission: 'Anexar uma imagem da embalagem ou da receita de um medicamento.',
        // Sem gravação de vídeo/áudio: evita a permissão RECORD_AUDIO no Android.
        microphonePermission: false,
      },
    ],
    'expo-system-ui',
    'expo-localization',
  ],
  extra: {
    // Identificador público do projeto no EAS (@vendra74/cuidar). Não é segredo.
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '0df6abf4-c3a7-451a-8a04-ff234ea85853' },
  },
  owner: 'vendra74',
});
