import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import type { RootStackParamList, TabParamList } from './navigation';
import { ThemeContext, buildTheme, DEFAULT_PREFS } from '@/ui/theme';
import { useAppStore } from '@/state/appStore';
import { configureNotificationHandler, recordHydrationFired, routeResponse } from '@/services/notifications/notificationService';
import { registerBackgroundTasks } from '@/services/background/backgroundTasks';
import { speak } from '@/services/speech/speech';

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

function MainTabs() {
  const prefs = useAppStore((s) => s.profile?.accessibility ?? DEFAULT_PREFS);
  const theme = buildTheme(prefs);
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: theme.font(13), fontWeight: '700' },
        tabBarStyle: { height: 76, paddingBottom: 10, paddingTop: 6, backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
      }}
    >
      <Tabs.Screen name="Hoje" component={TodayScreen} options={{ tabBarIcon: (p) => <TabIcon label="🏠" {...p} /> }} />
      <Tabs.Screen name="Medicamentos" component={MedicationsScreen} options={{ tabBarIcon: (p) => <TabIcon label="💊" {...p} /> }} />
      <Tabs.Screen name="Histórico" component={HistoryScreen} options={{ tabBarIcon: (p) => <TabIcon label="📅" {...p} /> }} />
      <Tabs.Screen name="Mais" component={MoreScreen} options={{ tabBarIcon: (p) => <TabIcon label="☰" {...p} /> }} />
    </Tabs.Navigator>
  );
}

/** Evita processar duas vezes a mesma resposta (listener + última resposta ao abrir o app). */
const handledResponses = new Set<string>();

async function handleResponse(response: Notifications.NotificationResponse) {
  const key = `${response.notification.request.identifier}|${response.actionIdentifier}|${response.notification.date}`;
  if (handledResponses.has(key)) return;
  handledResponses.add(key);
  const routed = await routeResponse(response);
  const store = useAppStore.getState();
  if (!navigationRef.isReady()) return;
  switch (routed.kind) {
    case 'hydration':
      if (routed.action === 'help') navigationRef.navigate('Help');
      else if (routed.action === 'snooze') {
        // "Lembrar depois" da água: agenda um aviso único daqui a N minutos, sem alterar a grade.
        const minutes = store.settings?.snoozeMinutes ?? 15;
        await Notifications.scheduleNotificationAsync({
          identifier: `snooze@hyd@${Date.now()}`,
          content: { title: 'Hora de beber água', body: 'Lembrete adiado. Que tal agora?', data: { kind: 'hydration', slotAt: new Date().toISOString() }, categoryIdentifier: 'cuidar.hydration', sound: 'default' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60, channelId: 'hydration' },
        });
        navigationRef.navigate('Main');
      } else navigationRef.navigate('HydrationLog', { fromNotification: true });
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

  // Notificação recebida com o app aberto: registra exibição e, se configurado, lê em voz alta.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const data = (n.request.content.data ?? {}) as Record<string, string>;
      if (data.kind === 'hydration' && data.slotAt) void recordHydrationFired(data.slotAt);
      if (useAppStore.getState().profile?.accessibility.speakReminders) speak(`${n.request.content.title ?? ''}. ${n.request.content.body ?? ''}`);
      void useAppStore.getState().checkCaregiverAlert();
    });
    return () => sub.remove();
  }, []);

  // Resposta do usuário (toque ou botão da notificação), inclusive a que abriu o app.
  useEffect(() => {
    if (!navReady || !ready) return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => void handleResponse(r));
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) void handleResponse(r);
    });
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
            <Stack.Screen name="Assessment" component={AssessmentScreen} options={{ title: 'Avaliação inicial' }} />
            <Stack.Screen name="AssessmentSummary" component={AssessmentSummaryScreen} options={{ title: 'Resumo' }} />
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="HydrationLog" component={HydrationLogScreen} options={{ title: 'Registrar água', presentation: 'modal' }} />
            <Stack.Screen name="MedicationForm" component={MedicationFormScreen} options={{ title: 'Medicamento' }} />
            <Stack.Screen name="MedicationDetail" component={MedicationDetailScreen} options={{ title: 'Medicamento' }} />
            <Stack.Screen name="OccurrenceAction" component={OccurrenceActionScreen} options={{ title: 'Dose' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil e plano' }} />
            <Stack.Screen name="ReminderSettings" component={ReminderSettingsScreen} options={{ title: 'Lembretes' }} />
            <Stack.Screen name="Caregiver" component={CaregiverScreen} options={{ title: 'Cuidador' }} />
            <Stack.Screen name="CaredPerson" component={CaredPersonScreen} options={{ title: 'Acompanhamento' }} />
            <Stack.Screen name="Help" component={HelpScreen} options={{ title: 'Ajuda', presentation: 'modal' }} />
            <Stack.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Contatos' }} />
            <Stack.Screen name="NotificationTest" component={NotificationTestScreen} options={{ title: 'Notificações' }} />
            <Stack.Screen name="Data" component={DataScreen} options={{ title: 'Meus dados' }} />
            <Stack.Screen name="Content" component={ContentScreen} options={{ title: 'Saiba mais' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
