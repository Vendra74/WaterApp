import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { getDb } from '@/data/db';
import { DOC_NOTIFICATION_STATE, getDocument, setDocument } from '@/data/repositories/documents';
import { recordReminderResponse } from '@/data/repositories/misc';
import type { PlannedNotification } from '@/domain/types';
import { generateHydrationSlots } from '@/domain/hydration/schedule';
import {
  ACTION_HELP,
  ACTION_LOG_WATER,
  ACTION_SNOOZE,
  ACTION_TAKEN,
  CATEGORY_GENERIC,
  CATEGORY_HYDRATION,
  CATEGORY_MEDICATION,
  CHANNEL_GENERIC,
  CHANNEL_HYDRATION,
  CHANNEL_MEDICATION,
  LEGACY_CHANNELS,
  buildNotificationPlan,
  isOwnedIdentifier,
  reconcile,
} from '@/domain/notifications/planner';
import { selectSuperseded } from '@/domain/notifications/supersede';
import { addDays } from '@/domain/time/time';
import { loadHydrationSettings, loadProfile } from '@/services/usecases/profile';
import { loadMedications, refreshOccurrences } from '@/services/usecases/medications';
import { strings } from '@/i18n';

/** Dias à frente para gerar lembretes de hidratação (o orçamento do planejador limita a quantidade). */
const HYDRATION_HORIZON_DAYS = 3;
const MEDICATION_HORIZON_DAYS = 14;
/** Intervalo para perguntar se as orientações de saúde mudaram (dias). */
export const HEALTH_REVIEW_INTERVAL_DAYS = 90;

export interface NotificationState {
  lastRescheduleAt: string | null;
  scheduledCount: number;
  plannedCount: number;
  truncated: boolean;
  lastError: string | null;
  lastCancelled: number;
  lastScheduled: number;
}

let handlerConfigured = false;

/** Mostra banners também com o app em primeiro plano (o usuário pode não perceber sem isso). */
export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  });
}

export async function ensureChannels(_showDetailsOnLockScreen: boolean, sound: boolean, vibrate: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;
  // A privacidade do conteúdo (nome do medicamento) é controlada no texto da notificação.
  // `lockscreenVisibility` no canal é ignorado pelo Android (o sistema sobrescreve com a
  // preferência do usuário; no dumpsys aparece como -1000). Fica aqui só por documentação:
  // quem decide a exibição na tela bloqueada é a configuração do sistema.
  // Canal Android: sem a chave `sound` o sistema usa o som padrão; `null` significa silencioso.
  // Um nome de arquivo (inclusive 'default') seria procurado como som personalizado.
  const base = {
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    ...(sound ? {} : { sound: null }),
    vibrationPattern: vibrate ? [0, 400, 250, 400, 250, 400] : undefined,
    enableVibrate: vibrate,
    enableLights: true,
    lightColor: '#0B5FA5',
    showBadge: true,
  };
  const s = strings().notifications;
  await Notifications.setNotificationChannelAsync(CHANNEL_HYDRATION, { ...base, bypassDnd: false, name: s.channelHydrationName, description: s.channelHydrationDesc });
  await Notifications.setNotificationChannelAsync(CHANNEL_MEDICATION, {
    ...base,
    // Só tem efeito se o usuário conceder acesso ao "Não perturbe" nas configurações do sistema.
    bypassDnd: true,
    name: s.channelMedicationName,
    description: s.channelMedicationDesc,
  });
  for (const legacy of LEGACY_CHANNELS) {
    try {
      await Notifications.deleteNotificationChannelAsync(legacy);
    } catch {
      // canal antigo pode não existir
    }
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_GENERIC, {
    ...base,
    bypassDnd: false,
    importance: Notifications.AndroidImportance.DEFAULT,
    name: s.channelGenericName,
    description: s.channelGenericDesc,
  });
}

/**
 * Som no conteúdo: no Android um booleano usa o som do canal; no iOS 'default' é o som do sistema.
 * Uma string no Android é tratada como arquivo de som personalizado.
 */
export function contentSound(enabled: boolean): boolean | 'default' {
  if (Platform.OS === 'ios') return enabled ? 'default' : false;
  return enabled;
}

/** Categorias com botões. Android rejeita categorias sem ações, por isso não há categoria "genérica". */
export async function ensureCategories(): Promise<void> {
  const s = strings().notifications;
  await Notifications.setNotificationCategoryAsync(CATEGORY_HYDRATION, [
    { identifier: ACTION_LOG_WATER, buttonTitle: s.actionLogWater, options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: s.actionSnooze, options: { opensAppToForeground: true } },
    { identifier: ACTION_HELP, buttonTitle: s.actionHelp, options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORY_MEDICATION, [
    { identifier: ACTION_TAKEN, buttonTitle: s.actionTaken, options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: s.actionSnooze, options: { opensAppToForeground: true } },
    { identifier: ACTION_HELP, buttonTitle: s.actionHelp, options: { opensAppToForeground: true } },
  ]);
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPermissionState(): Promise<PermissionState> {
  if (!Device.isDevice && Platform.OS === 'ios') return 'unsupported'; // simulador iOS não entrega notificações locais de forma confiável
  const s = await Notifications.getPermissionsAsync();
  if (s.granted || s.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  if (s.status === 'undetermined' || s.canAskAgain) return 'undetermined';
  return 'denied';
}

export async function requestPermission(): Promise<PermissionState> {
  const s = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  if (s.granted) return 'granted';
  return s.canAskAgain ? 'undetermined' : 'denied';
}

export async function loadNotificationState(): Promise<NotificationState> {
  const db = await getDb();
  return (
    (await getDocument<NotificationState>(db, DOC_NOTIFICATION_STATE)) ?? {
      lastRescheduleAt: null,
      scheduledCount: 0,
      plannedCount: 0,
      truncated: false,
      lastError: null,
      lastCancelled: 0,
      lastScheduled: 0,
    }
  );
}

let rescheduling: Promise<NotificationState> | null = null;

/**
 * Recalcula tudo o que deve estar agendado no sistema e aplica somente a diferença.
 * Chamado: ao abrir o app, ao alterar perfil/configurações/medicamentos, após responder um lembrete,
 * em mudança de fuso e na tarefa periódica em segundo plano. Idempotente.
 */
export function rescheduleAll(): Promise<NotificationState> {
  if (rescheduling) return rescheduling;
  rescheduling = doReschedule().finally(() => {
    rescheduling = null;
  });
  return rescheduling;
}

async function doReschedule(): Promise<NotificationState> {
  const db = await getDb();
  const state = await loadNotificationState();
  try {
    const now = new Date();
    const profile = await loadProfile();
    const settings = await loadHydrationSettings(profile);
    const medications = await loadMedications();
    const occurrences = await refreshOccurrences(now);

    const permission = await getPermissionState();
    if (permission !== 'granted') {
      // Sem permissão: garante que nada nosso fique pendente e registra o motivo.
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of existing) if (isOwnedIdentifier(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
      const next: NotificationState = { ...state, lastRescheduleAt: now.toISOString(), scheduledCount: 0, plannedCount: 0, truncated: false, lastError: strings().notifications.permissionNotGranted };
      await setDocument(db, DOC_NOTIFICATION_STATE, next);
      return next;
    }

    let setupError: string | null = null;
    try {
      await ensureChannels(settings.showDetailsOnLockScreen, settings.sound, settings.vibrate);
      await ensureCategories();
    } catch (e) {
      // Falha em canal/categoria não deve impedir o agendamento dos lembretes.
      setupError = e instanceof Error ? e.message : String(e);
    }

    const hydrationSlots = profile.assessmentCompleted
      ? generateHydrationSlots({ settings, naps: profile.naps, now, days: HYDRATION_HORIZON_DAYS })
      : [];

    const horizonEnd = addDays(now, MEDICATION_HORIZON_DAYS);
    const relevant = occurrences.filter((o) => new Date(o.plannedAt) <= horizonEnd);

    const reviewDue = profile.assessmentCompleted
      ? addDays(new Date(profile.lastHealthReviewPromptAt ?? profile.updatedAt), HEALTH_REVIEW_INTERVAL_DAYS)
      : null;

    const plan = buildNotificationPlan({
      now,
      hydrationSlots,
      medications,
      occurrences: relevant,
      settings,
      preferredName: profile.preferredName,
      healthReviewDue: reviewDue,
    });

    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const diff = reconcile(
      existing.map((n) => ({ identifier: n.identifier, channelId: triggerChannelId(n.trigger) })),
      plan,
    );

    for (const id of diff.toCancel) await Notifications.cancelScheduledNotificationAsync(id);
    for (const n of diff.toSchedule) await scheduleOne(n, settings.sound);

    const after = await Notifications.getAllScheduledNotificationsAsync();
    const ours = after.filter((n) => isOwnedIdentifier(n.identifier)).length;
    const totalWanted = hydrationSlots.length + relevant.filter((o) => o.status === 'scheduled' || o.status === 'snoozed').length;
    const next: NotificationState = {
      lastRescheduleAt: now.toISOString(),
      scheduledCount: ours,
      plannedCount: plan.length,
      truncated: totalWanted > plan.length || ours < plan.length,
      lastError: setupError,
      lastCancelled: diff.toCancel.length,
      lastScheduled: diff.toSchedule.length,
    };
    await setDocument(db, DOC_NOTIFICATION_STATE, next);
    return next;
  } catch (e) {
    const next: NotificationState = { ...state, lastRescheduleAt: new Date().toISOString(), lastError: e instanceof Error ? e.message : String(e) };
    await setDocument(db, DOC_NOTIFICATION_STATE, next);
    return next;
  }
}

/** Canal Android gravado no gatilho de um agendamento existente (undefined no iOS ou se ausente). */
function triggerChannelId(trigger: Notifications.NotificationTrigger | null): string | undefined {
  if (!trigger || typeof trigger !== 'object') return undefined;
  const c = (trigger as { channelId?: unknown }).channelId;
  return typeof c === 'string' ? c : undefined;
}

async function scheduleOne(n: PlannedNotification, sound: boolean): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: n.identifier,
    content: {
      title: n.title,
      body: n.body,
      data: n.data,
      sound: contentSound(sound),
      ...(n.categoryId === CATEGORY_GENERIC ? {} : { categoryIdentifier: n.categoryId }),
      interruptionLevel: n.kind === 'medication' ? 'timeSensitive' : 'active',
      ...(Platform.OS === 'android'
        ? { priority: n.kind === 'medication' ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.HIGH, vibrate: [0, 400, 250, 400] }
        : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(n.fireAt), channelId: n.channelId },
  });
}

/**
 * "Lembrar depois" de um lembrete de água: aviso único daqui a N minutos.
 * Não altera a grade de lembretes (o planejador não gerencia identificadores `snooze@`).
 */
export async function scheduleHydrationSnooze(minutes: number, sound: boolean): Promise<string> {
  const id = `snooze@hyd@${Date.now()}`;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: strings().notifications.hydrationTitle,
      body: strings().notifications.hydrationSnoozedBody,
      data: { kind: 'hydration', slotAt: new Date().toISOString() },
      categoryIdentifier: CATEGORY_HYDRATION,
      sound: contentSound(sound),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(60, minutes * 60), channelId: CHANNEL_HYDRATION },
  });
  return id;
}

/**
 * Abre a tela do sistema para permitir alarmes exatos (Android 12+). Sem essa permissão o sistema
 * agrupa e atrasa os lembretes em vários minutos. Retorna a mensagem de erro se não foi possível abrir.
 * Importações estáticas: o `import()` dinâmico de expo-application falhava no development build
 * ("Cannot read property 'reload' of undefined") e o botão não abria nada.
 */
export async function openExactAlarmSettings(): Promise<string | null> {
  if (Platform.OS !== 'android') return strings().notifications.androidOnly;
  try {
    await IntentLauncher.startActivityAsync('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', {
      data: `package:${Application.applicationId ?? ''}`,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Apresenta uma notificação imediatamente, sem alarme (isola problemas de exibição/canal). */
export async function presentTestNotificationNow(): Promise<string> {
  const id = `test@now@${Date.now()}`;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: strings().notifications.testNowTitle,
      body: strings().notifications.testNowBody,
      data: { kind: 'test' },
      sound: contentSound(true),
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_HYDRATION } : null,
  });
  return id;
}

/** Abre a tela do sistema para permitir que lembretes de medicamento ignorem o modo Não perturbe. */
export async function openDndAccessSettings(): Promise<string | null> {
  if (Platform.OS !== 'android') return strings().notifications.androidOnly;
  try {
    await IntentLauncher.startActivityAsync('android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS');
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Notificação de teste em N segundos (tela "Testar notificações"). */
export async function scheduleTestNotification(seconds: number, kind: 'hydration' | 'medication'): Promise<string> {
  const id = `test@${Date.now()}`;
  const s = strings().notifications;
  await ensureCategories();
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: kind === 'hydration' ? s.testHydrationTitle : s.testMedicationTitle,
      body: s.testBody,
      data: { kind: 'test' },
      categoryIdentifier: kind === 'hydration' ? CATEGORY_HYDRATION : CATEGORY_MEDICATION,
      sound: contentSound(true),
      // Igual ao lembrete real: só o medicamento fura o Modo Foco do iOS.
      interruptionLevel: kind === 'medication' ? 'timeSensitive' : 'active',
      ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.MAX, vibrate: [0, 400, 250, 400] } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, seconds),
      channelId: kind === 'hydration' ? CHANNEL_HYDRATION : CHANNEL_MEDICATION,
    },
  });
  return id;
}

export async function listOwnedScheduled(): Promise<{ identifier: string; fireAt: string | null; kind: string }[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all
    .filter((n) => isOwnedIdentifier(n.identifier))
    .map((n) => {
      const t = n.trigger as { type?: string; value?: number; date?: number } | null;
      const value = t && typeof t === 'object' ? (t.value ?? t.date) : undefined;
      return { identifier: n.identifier, fireAt: typeof value === 'number' ? new Date(value).toISOString() : null, kind: String(n.content.data?.kind ?? '') };
    })
    .sort((a, b) => (a.fireAt ?? '').localeCompare(b.fireAt ?? ''));
}

export async function cancelAllOwned(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) if (isOwnedIdentifier(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
}

export interface RoutedResponse {
  kind: 'hydration' | 'medication' | 'health_review' | 'test' | 'unknown';
  action: 'open' | 'log_water' | 'snooze' | 'help' | 'taken';
  occurrenceId?: string;
  slotAt?: string;
}

/** Traduz uma resposta do sistema em uma intenção de navegação; registra o evento para o aviso de "sem confirmação". */
export async function routeResponse(response: Notifications.NotificationResponse): Promise<RoutedResponse> {
  const data = (response.notification.request.content.data ?? {}) as Record<string, string>;
  const kind = (data.kind as RoutedResponse['kind']) ?? 'unknown';
  const actionId = response.actionIdentifier;
  const action: RoutedResponse['action'] =
    actionId === ACTION_LOG_WATER ? 'log_water' : actionId === ACTION_SNOOZE ? 'snooze' : actionId === ACTION_HELP ? 'help' : actionId === ACTION_TAKEN ? 'taken' : 'open';
  const db = await getDb();
  if (kind === 'hydration') await recordReminderResponse(db, 'hydration', data.slotAt ?? '', action === 'open' ? 'opened' : action === 'log_water' ? 'opened' : action === 'snooze' ? 'snoozed' : 'help');
  return { kind, action, occurrenceId: data.occurrenceId, slotAt: data.slotAt };
}

/**
 * Dispensa da barra as notificações que a recém-chegada torna obsoletas (ver `selectSuperseded`).
 * Só roda com o app em primeiro plano (o listener de recebimento não dispara em segundo plano);
 * fora disso o sistema agrupa as antigas normalmente.
 */
export async function dismissSuperseded(received: Notifications.Notification): Promise<string[]> {
  const presented = await Notifications.getPresentedNotificationsAsync();
  const ids = selectSuperseded(
    { identifier: received.request.identifier, data: received.request.content.data },
    presented.map((p) => ({ identifier: p.request.identifier, data: p.request.content.data })),
  );
  for (const id of ids) await Notifications.dismissNotificationAsync(id);
  return ids;
}

/** Registra que um lembrete de hidratação foi exibido (para contar "sem confirmação"). */
export async function recordHydrationFired(slotAt: string): Promise<void> {
  const db = await getDb();
  await recordReminderResponse(db, 'hydration', slotAt, 'fired');
}
