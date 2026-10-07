import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import type { RootStackParamList, TabParamList } from './navigation';
import { ThemeContext, buildTheme, DEFAULT_PREFS } from '@/ui/theme';
import { useAppStore } from '@/state/appStore';
import { configureNotificationHandler, dismissSuperseded, recordHydrationFired, routeResponse, scheduleHydrationSnooze, type RoutedResponse } from '@/services/notifications/notificationService';
import { createResponseDeduper, responseKey } from '@/domain/notifications/responseDedupe';
import { registerBackgroundTasks } from '@/services/background/backgroundTasks';
import { speak } from '@/services/speech/speech';
import { strings } from '@/i18n';

import { WelcomeScreen } from '@/screens/WelcomeScreen';
import { AssessmentScreen } from '@/screens/assessment/AssessmentScreen';
import { AssessmentSummaryScreen } from '@/screens/assessment/AssessmentSummaryScreen';
import { TodayScreen } from '@/screens/today/TodayScreen';
import { HydrationLogScreen } from '@/screens/hydration/HydrationLogScreen';
import { MedicationsScreen } from '@/screens/medications/MedicationsScreen';
import { MedicationFormScreen } from '@/screens/medications/MedicationFormScreen';
import { MedicationDetailScreen } from '@/screens/medications/MedicationDetailScreen';
import { OccurrenceActionScreen } from '@/screens/medications/OccurrenceActionScreen';
import { HistoryScreen } from '@/screens/history/HistoryScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { ReminderSettingsScreen } from '@/screens/settings/ReminderSettingsScreen';
import { CaregiverScreen } from '@/screens/care/CaregiverScreen';
import { CaredPersonScreen } from '@/screens/care/CaredPersonScreen';
import { HelpScreen } from '@/screens/help/HelpScreen';
import { ContactsScreen } from '@/screens/help/ContactsScreen';
import { NotificationTestScreen } from '@/screens/more/NotificationTestScreen';
import { DataScreen } from '@/screens/more/DataScreen';
import { ContentScreen } from '@/screens/more/ContentScreen';
import { MoreScreen } from '@/screens/more/MoreScreen';

configureNotificationHandler();

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

function TabIcon({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  return <Text style={{ fontSize: focused ? 26 : 22, color }} importantForAccessibility="no">{label}</Text>;
}

/** Rótulo da aba em uma linha: com letras grandes, "Medicamentos" e "Histórico" reduzem em vez de truncar. */
function TabLabel({ label, color, fontSize }: { label: string; color: string; fontSize: number }) {
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontSize, fontWeight: '700', color, textAlign: 'center' }}>
      {label}
    </Text>
  );
}

function MainTabs() {
  const prefs = useAppStore((s) => s.profile?.accessibility ?? DEFAULT_PREFS);
  const theme = buildTheme(prefs);
  // Altura fixa ignora a área segura: no Android com botões de navegação a barra do sistema cobria as abas.
  const insets = useSafeAreaInsets();
  const s = strings().nav;
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabel: ({ color, children }) => <TabLabel label={String(children)} color={color} fontSize={theme.font(13)} />,
        tabBarItemStyle: { paddingHorizontal: 2 },
        tabBarStyle: { height: 76 + insets.bottom, paddingBottom: 10 + insets.bottom, paddingTop: 6, backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
      }}
    >
      <Tabs.Screen name="Today" component={TodayScreen} options={{ title: s.today, tabBarIcon: (p) => <TabIcon label="🏠" {...p} /> }} />
      <Tabs.Screen name="Medications" component={MedicationsScreen} options={{ title: s.medications, tabBarIcon: (p) => <TabIcon label="💊" {...p} /> }} />
      <Tabs.Screen name="History" component={HistoryScreen} options={{ title: s.history, tabBarIcon: (p) => <TabIcon label="📅" {...p} /> }} />
      <Tabs.Screen name="More" component={MoreScreen} options={{ title: s.more, tabBarIcon: (p) => <TabIcon label="☰" {...p} /> }} />
    </Tabs.Navigator>
  );
}

/** Evita processar duas vezes a mesma resposta (listener + última resposta ao abrir o app). */
const deduper = createResponseDeduper();

async function handleResponse(response: Notifications.NotificationResponse) {
  const key = responseKey(response);
  if (!deduper.begin(key)) return;
  try {
    await processResponse(response);
    deduper.commit(key);
    // Limpa a resposta guardada pelo módulo nativo para que um recarregamento do JS não a repita.
    await Notifications.clearLastNotificationResponseAsync();
  } catch (e) {
    deduper.rollback(key);
    console.warn('Falha ao tratar resposta de notificação', e instanceof Error ? e.message : String(e));
  }
}

/** Tela de destino de uma ação de lembrete de água (real ou de teste). */
function navigateForHydrationAction(action: RoutedResponse['action']) {
  if (action === 'help') navigationRef.navigate('Help');
  else if (action === 'log_water') navigationRef.navigate('HydrationLog', { fromNotification: true });
  else navigationRef.navigate('Main');
}

async function processResponse(response: Notifications.NotificationResponse) {
  const routed = await routeResponse(response);
  const store = useAppStore.getState();
  if (!navigationRef.isReady()) throw new Error('navegação ainda não pronta');
  switch (routed.kind) {
    case 'hydration':
      if (routed.action === 'snooze') {
        const minutes = store.settings?.snoozeMinutes ?? 15;
        await scheduleHydrationSnooze(minutes, store.settings?.sound ?? true);
        navigationRef.navigate('Main');
        Alert.alert(strings().notifications.snoozedAlertTitle, strings().notifications.snoozedAlertBody(minutes));
      } else navigateForHydrationAction(routed.action === 'open' ? 'log_water' : routed.action); // toque simples abre o registro
      break;
    case 'medication':
      if (routed.action === 'help') navigationRef.navigate('Help');
      else if (routed.occurrenceId) {
        if (routed.action === 'taken') {
          await store.confirmTaken(routed.occurrenceId);
        } else if (routed.action === 'snooze') {
          await store.snooze(routed.occurrenceId, store.settings?.snoozeMinutes ?? 15);
        }
        navigationRef.navigate('OccurrenceAction', { occurrenceId: routed.occurrenceId });
      }
      break;
    case 'health_review':
      navigationRef.navigate('Profile');
      break;
    case 'test':
      // Notificação da tela "Testar notificações": mesmas telas do lembrete real, sem registrar nem adiar.
      navigateForHydrationAction(routed.action);
      if (routed.action === 'snooze') {
        Alert.alert(strings().notifications.testSnoozeAlertTitle, strings().notifications.testSnoozeAlertBody(store.settings?.snoozeMinutes ?? 15));
      }
      break;
    default:
      navigationRef.navigate('Main');
  }
}

export default function App() {
  const { ready, profile, bootstrap, refresh, reschedule, checkCaregiverAlert } = useAppStore();
  const prefs = profile?.accessibility ?? DEFAULT_PREFS;
  const theme = useMemo(() => buildTheme(prefs), [prefs]);
  const [navReady, setNavReady] = useState(false);

  useEffect(() => {
    void bootstrap().then(() => registerBackgroundTasks());
  }, [bootstrap]);

  // Ao voltar ao primeiro plano: recarrega dados e reagenda (cobre reinício, fuso e limites de agendamento).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh().then(reschedule).then(checkCaregiverAlert);
      }
    });
    return () => sub.remove();
  }, [refresh, reschedule, checkCaregiverAlert]);

  // Notificação recebida com o app aberto: registra exibição, dispensa as que ficaram obsoletas
  // (evita o agrupamento que esconde os botões na tela bloqueada) e, se configurado, lê em voz alta.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const data = (n.request.content.data ?? {}) as Record<string, string>;
      if (data.kind === 'hydration' && data.slotAt) void recordHydrationFired(data.slotAt);
      void dismissSuperseded(n).catch(() => undefined);
      if (useAppStore.getState().profile?.accessibility.speakReminders) speak(`${n.request.content.title ?? ''}. ${n.request.content.body ?? ''}`);
      void useAppStore.getState().checkCaregiverAlert();
    });
    return () => sub.remove();
  }, []);

  // Resposta do usuário (toque ou botão da notificação), inclusive a que abriu o app.
  useEffect(() => {
    if (!navReady || !ready) return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => void handleResponse(r));
    const last = Notifications.getLastNotificationResponse();
    if (last) void handleResponse(last);
    return () => sub.remove();
  }, [navReady, ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.colors.background, card: theme.colors.surface, text: theme.colors.text, primary: theme.colors.primary, border: theme.colors.border } };
  const initial: keyof RootStackParamList = profile?.assessmentCompleted ? 'Main' : 'Welcome';
  const s = strings().nav;

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={theme}>
        <NavigationContainer ref={navigationRef} theme={navTheme} onReady={() => setNavReady(true)}>
          <StatusBar style="dark" />
          <Stack.Navigator
            initialRouteName={initial}
            screenOptions={{
              headerTitleStyle: { fontSize: theme.font(18), fontWeight: '700' },
              headerBackButtonDisplayMode: 'minimal',
              headerTintColor: theme.colors.primary,
              animation: theme.reduceMotion ? 'none' : 'default',
            }}
          >
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Assessment" component={AssessmentScreen} options={{ title: s.assessment }} />
            <Stack.Screen name="AssessmentSummary" component={AssessmentSummaryScreen} options={{ title: s.summary }} />
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="HydrationLog" component={HydrationLogScreen} options={{ title: s.logWater, presentation: 'modal' }} />
            <Stack.Screen name="MedicationForm" component={MedicationFormScreen} options={{ title: s.medication }} />
            <Stack.Screen name="MedicationDetail" component={MedicationDetailScreen} options={{ title: s.medication }} />
            <Stack.Screen name="OccurrenceAction" component={OccurrenceActionScreen} options={{ title: s.dose }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: s.profile }} />
            <Stack.Screen name="ReminderSettings" component={ReminderSettingsScreen} options={{ title: s.reminders }} />
            <Stack.Screen name="Caregiver" component={CaregiverScreen} options={{ title: s.caregiver }} />
            <Stack.Screen name="CaredPerson" component={CaredPersonScreen} options={{ title: s.caredPerson }} />
            <Stack.Screen name="Help" component={HelpScreen} options={{ title: s.help, presentation: 'modal' }} />
            <Stack.Screen name="Contacts" component={ContactsScreen} options={{ title: s.contacts }} />
            <Stack.Screen name="NotificationTest" component={NotificationTestScreen} options={{ title: s.notifications }} />
            <Stack.Screen name="Data" component={DataScreen} options={{ title: s.data }} />
            <Stack.Screen name="Content" component={ContentScreen} options={{ title: s.content }} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
