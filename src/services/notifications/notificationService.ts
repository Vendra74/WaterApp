import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
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
  buildNotificationPlan,
  isOwnedIdentifier,
  reconcile,
} from '@/domain/notifications/planner';
import { addDays } from '@/domain/time/time';
import { loadHydrationSettings, loadProfile } from '@/services/usecases/profile';
import { loadMedications, refreshOccurrences } from '@/services/usecases/medications';

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
    }),
  });
}

export async function ensureChannels(showDetailsOnLockScreen: boolean, sound: boolean, vibrate: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;
  const visibility = showDetailsOnLockScreen
    ? Notifications.AndroidNotificationVisibility.PUBLIC
    : Notifications.AndroidNotificationVisibility.PRIVATE;
  // Canal Android: sem a chave `sound` o sistema usa o som padrão; `null` significa silencioso.
  // Um nome de arquivo (inclusive 'default') seria procurado como som personalizado.
  const base = {
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: visibility,
    ...(sound ? {} : { sound: null }),
    vibrationPattern: vibrate ? [0, 300, 200, 300] : undefined,
    enableVibrate: vibrate,
    bypassDnd: false,
  };
  await Notifications.setNotificationChannelAsync(CHANNEL_HYDRATION, { ...base, name: 'Lembretes de água', description: 'Lembretes para beber água.' });
  await Notifications.setNotificationChannelAsync(CHANNEL_MEDICATION, {
    ...base,
    importance: Notifications.AndroidImportance.MAX,
    name: 'Lembretes de medicamentos',
    description: 'Horários dos medicamentos cadastrados. Independente da pausa noturna da água.',
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_GENERIC, {
    ...base,
    importance: Notifications.AndroidImportance.DEFAULT,
    name: 'Avisos gerais',
    description: 'Revisões periódicas e testes.',
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
  await Notifications.setNotificationCategoryAsync(CATEGORY_HYDRATION, [
    { identifier: ACTION_LOG_WATER, buttonTitle: 'Registrar água', options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: 'Lembrar depois', options: { opensAppToForeground: true } },
    { identifier: ACTION_HELP, buttonTitle: 'Preciso de ajuda', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORY_MEDICATION, [
    { identifier: ACTION_TAKEN, buttonTitle: 'Tomei', options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: 'Lembrar depois', options: { opensAppToForeground: true } },
    { identifier: ACTION_HELP, buttonTitle: 'Preciso de ajuda', options: { opensAppToForeground: true } },
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
      const next: NotificationState = { ...state, lastRescheduleAt: now.toISOString(), scheduledCount: 0, plannedCount: 0, truncated: false, lastError: 'Permissão de notificações não concedida.' };
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
    const diff = reconcile(existing.map((n) => n.identifier), plan);

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
      ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.HIGH } : {}),
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
      title: 'Hora de beber água',
      body: 'Lembrete adiado. Que tal agora?',
      data: { kind: 'hydration', slotAt: new Date().toISOString() },
      categoryIdentifier: CATEGORY_HYDRATION,
      sound: contentSound(sound),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(60, minutes * 60), channelId: CHANNEL_HYDRATION },
  });
  return id;
}

/** Notificação de teste em N segundos (tela "Testar notificações"). */
export async function scheduleTestNotification(seconds: number, kind: 'hydration' | 'medication'): Promise<string> {
  const id = `test@${Date.now()}`;
  await ensureCategories();
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: kind === 'hydration' ? 'Teste: hora de beber água' : 'Teste: hora do seu medicamento',
      body: 'Esta é uma notificação de teste. Você pode usar os botões para conferir as ações.',
      data: { kind: 'test' },
      categoryIdentifier: kind === 'hydration' ? CATEGORY_HYDRATION : CATEGORY_MEDICATION,
      sound: contentSound(true),
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

/** Registra que um lembrete de hidratação foi exibido (para contar "sem confirmação"). */
export async function recordHydrationFired(slotAt: string): Promise<void> {
  const db = await getDb();
  await recordReminderResponse(db, 'hydration', slotAt, 'fired');
}
