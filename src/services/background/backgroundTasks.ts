import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const RESCHEDULE_TASK = 'cuidar.reschedule';
export const NOTIFICATION_TASK = 'cuidar.notification-received';

/**
 * Tarefa periódica: reagenda notificações no sistema (repõe o horizonte, aplica mudanças de fuso).
 * O sistema decide quando executar (mínimo ~15 min no Android; iOS a critério do sistema).
 * Não é garantia de execução: ao abrir o app também reagendamos.
 */
TaskManager.defineTask(RESCHEDULE_TASK, async () => {
  try {
    const { rescheduleAll } = await import('@/services/notifications/notificationService');
    await rescheduleAll();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Tarefa executada quando uma notificação chega com o app em segundo plano (Android/iOS conforme suporte).
 * Usada apenas para registrar que um lembrete de água foi exibido (contagem "sem confirmação").
 */
TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data }) => {
  try {
    if (!data || 'actionIdentifier' in data) return Notifications.BackgroundNotificationTaskResult.NoData;
    const raw = data as unknown as { request?: { content?: { data?: Record<string, unknown> } }; data?: Record<string, unknown> };
    const payload = (raw.request?.content?.data ?? raw.data ?? {}) as Record<string, string>;
    if (payload.kind === 'hydration' && payload.slotAt) {
      const { recordHydrationFired } = await import('@/services/notifications/notificationService');
      await recordHydrationFired(payload.slotAt);
    }
    return Notifications.BackgroundNotificationTaskResult.NewData;
  } catch {
    return Notifications.BackgroundNotificationTaskResult.Failed;
  }
});

export async function registerBackgroundTasks(): Promise<{ periodic: boolean; notification: boolean; reason?: string }> {
  const result = { periodic: false, notification: false, reason: undefined as string | undefined };
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Available) {
      const registered = await TaskManager.isTaskRegisteredAsync(RESCHEDULE_TASK);
      if (!registered) await BackgroundTask.registerTaskAsync(RESCHEDULE_TASK, { minimumInterval: 6 * 60 });
      result.periodic = true;
    } else {
      result.reason = 'Tarefas em segundo plano restritas pelo sistema.';
    }
  } catch (e) {
    result.reason = e instanceof Error ? e.message : String(e);
  }
  try {
    if (Platform.OS !== 'web') {
      await Notifications.registerTaskAsync(NOTIFICATION_TASK);
      result.notification = true;
    }
  } catch {
    // Expo Go e alguns ambientes não suportam; a contagem "sem confirmação" cai para o modo em primeiro plano.
  }
  return result;
}
