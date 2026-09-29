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
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription:
        'A câmera é usada apenas para fotografar a embalagem ou a receita de um medicamento, se você quiser.',
      NSPhotoLibraryUsageDescription:
        'O acesso às fotos é usado apenas para anexar uma imagem da embalagem ou da receita de um medicamento.',
      UIBackgroundModes: ['fetch', 'processing'],
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
    ],
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#0B5FA5', defaultChannel: 'hydration' }],
    'expo-sqlite',
    'expo-secure-store',
    'expo-background-task',
    ['expo-image-picker', { cameraPermission: 'Fotografar a embalagem ou a receita de um medicamento.' }],
    'expo-localization',
  ],
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '' },
  },
});
