import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';
import { initLocaleFromDevice } from './src/i18n/device';

// Tarefas em segundo plano precisam ser definidas no escopo do módulo, antes do app montar.
import './src/services/background/backgroundTasks';

import App from './src/core/App';

// Idioma antes de qualquer texto: as tarefas em segundo plano e as notificações geram texto sem passar por tela.
initLocaleFromDevice();

registerRootComponent(App);
