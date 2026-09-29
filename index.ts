import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';

// Tarefas em segundo plano precisam ser definidas no escopo do módulo, antes do app montar.
import './src/services/background/backgroundTasks';

import App from './src/core/App';

registerRootComponent(App);
