import { create } from 'zustand';
import type { EmergencyContact, HydrationLog, HydrationSettings, Medication, MedicationOccurrence, OccurrenceStatus, Profile } from '@/domain/types';
import { evaluateIndividualPlan, type IndividualPlan } from '@/domain/safety/plan';
import { addDays, startOfLocalDay } from '@/domain/time/time';
import { env } from '@/config/env';
import { getDb } from '@/data/db';
import { deleteContact, listContacts, upsertContact } from '@/data/repositories/misc';
import { loadHydrationSettings, loadProfile, saveHydrationSettings, saveProfile } from '@/services/usecases/profile';
import { addHydrationLog, editHydrationLog, loadLogsForDay, restoreHydrationLog, undoHydrationLog, type AddLogInput, type AddLogResult } from '@/services/usecases/hydration';
import {
  confirmOccurrenceTaken,
  correctOccurrence,
  loadMedications,
  loadOccurrencesBetween,
  markOccurrenceNotTaken,
  refreshOccurrences,
  removeMedication,
  saveMedication,
  snoozeOccurrence,
} from '@/services/usecases/medications';
import { loadNotificationState, rescheduleAll, type NotificationState, getPermissionState, type PermissionState } from '@/services/notifications/notificationService';
import { getSyncStatus, pushOutbox, type SyncStatus } from '@/services/sync/syncService';
import { checkCaregiverAlerts } from '@/services/usecases/caregiverAlerts';
import { dismissReminderSuggestion, loadReminderSuggestions } from '@/services/usecases/suggestions';
import { applyHydrationSuggestion, applyMedicationSuggestion, type ReminderSuggestion } from '@/domain/adaptive/reminderSuggestions';

interface AppState {
  ready: boolean;
  demoMode: boolean;
  profile: Profile | null;
  settings: HydrationSettings | null;
  plan: IndividualPlan | null;
  todayLogs: HydrationLog[];
  medications: Medication[];
  occurrences: MedicationOccurrence[]; // ontem → +14 dias
  contacts: EmergencyContact[];
  notificationState: NotificationState | null;
  permission: PermissionState;
  sync: SyncStatus | null;
  lastUndo: HydrationLog | null;
  /** Sugestões de ajuste de horário aprendidas dos registros (só no aparelho). */
  suggestions: ReminderSuggestion[];

  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (p: Profile) => Promise<void>;
  updateSettings: (s: HydrationSettings) => Promise<void>;
  logWater: (input: AddLogInput) => Promise<AddLogResult>;
  undoLog: (log: HydrationLog) => Promise<void>;
  restoreLog: (log: HydrationLog) => Promise<void>;
  editLog: (log: HydrationLog, changes: Partial<Pick<HydrationLog, 'volumeMl' | 'beverage' | 'at' | 'note'>>) => Promise<void>;
  upsertMedication: (m: Medication) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  confirmTaken: (occurrenceId: string) => Promise<{ alreadyConfirmed: boolean } | null>;
  snooze: (occurrenceId: string, minutes: number) => Promise<void>;
  notTaken: (occurrenceId: string, note?: string) => Promise<void>;
  correct: (occurrenceId: string, to: OccurrenceStatus, note: string) => Promise<void>;
  saveContact: (c: EmergencyContact) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  reschedule: () => Promise<void>;
  refreshSync: () => Promise<void>;
  checkCaregiverAlert: () => Promise<void>;
  refreshSuggestions: () => Promise<void>;
  applySuggestion: (s: ReminderSuggestion) => Promise<void>;
  dismissSuggestion: (s: ReminderSuggestion) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  demoMode: env.demoMode,
  profile: null,
  settings: null,
  plan: null,
  todayLogs: [],
  medications: [],
  occurrences: [],
  contacts: [],
  notificationState: null,
  permission: 'undetermined',
  sync: null,
  lastUndo: null,
  suggestions: [],

  bootstrap: async () => {
    await getDb();
    await get().refresh();
    set({ ready: true });
    void get().reschedule();
    void get().refreshSync();
  },

  refresh: async () => {
    const profile = await loadProfile();
    const settings = await loadHydrationSettings(profile);
    const now = new Date();
    const [todayLogs, medications, contacts, notificationState, permission] = await Promise.all([
      loadLogsForDay(now),
      loadMedications(),
      listContacts(await getDb()),
      loadNotificationState(),
      getPermissionState().catch(() => 'unsupported' as PermissionState),
    ]);
    await refreshOccurrences(now);
    const occurrences = await loadOccurrencesBetween(addDays(startOfLocalDay(now), -1), addDays(startOfLocalDay(now), 15));
    const suggestions = await loadReminderSuggestions(profile, settings, medications, now).catch(() => []);
    set({ profile, settings, plan: evaluateIndividualPlan(profile), todayLogs, medications, occurrences, contacts, notificationState, permission, suggestions });
  },

  updateProfile: async (p) => {
    const saved = await saveProfile(p);
    set({ profile: saved, plan: evaluateIndividualPlan(saved) });
    await get().reschedule();
    void get().refreshSync();
  },

  updateSettings: async (s) => {
    await saveHydrationSettings(s);
    set({ settings: s });
    await get().reschedule();
    await get().refreshSuggestions();
  },

  refreshSuggestions: async () => {
    const { profile, settings, medications } = get();
    if (!profile || !settings) return;
    set({ suggestions: await loadReminderSuggestions(profile, settings, medications).catch(() => []) });
  },

  logWater: async (input) => {
    const result = await addHydrationLog(input);
    if (result.ok) {
      set({ todayLogs: await loadLogsForDay(new Date()), lastUndo: result.log });
      void get().refreshSync();
    }
    return result;
  },

  undoLog: async (log) => {
    await undoHydrationLog(log);
    set({ todayLogs: await loadLogsForDay(new Date()), lastUndo: null });
    void get().refreshSync();
  },

  restoreLog: async (log) => {
    await restoreHydrationLog(log);
    set({ todayLogs: await loadLogsForDay(new Date()) });
  },

  editLog: async (log, changes) => {
    await editHydrationLog(log, changes);
    set({ todayLogs: await loadLogsForDay(new Date()) });
    void get().refreshSync();
  },

  upsertMedication: async (m) => {
    await saveMedication(m);
    await get().refresh();
    await get().reschedule();
    void get().refreshSync();
  },

  deleteMedication: async (id) => {
    await removeMedication(id);
    await get().refresh();
    await get().reschedule();
    void get().refreshSync();
  },

  confirmTaken: async (id) => {
    const r = await confirmOccurrenceTaken(id);
    await get().refresh();
    void get().reschedule();
    void get().refreshSync();
    return r ? { alreadyConfirmed: r.alreadyConfirmed } : null;
  },

  snooze: async (id, minutes) => {
    await snoozeOccurrence(id, minutes);
    await get().refresh();
    await get().reschedule();
    void get().refreshSync();
  },

  notTaken: async (id, note) => {
    await markOccurrenceNotTaken(id, note);
    await get().refresh();
    void get().reschedule();
    void get().refreshSync();
  },

  correct: async (id, to, note) => {
    await correctOccurrence(id, to, note);
    await get().refresh();
    void get().reschedule();
    void get().refreshSync();
  },

  saveContact: async (c) => {
    await upsertContact(await getDb(), c);
    set({ contacts: await listContacts(await getDb()) });
  },

  removeContact: async (id) => {
    await deleteContact(await getDb(), id);
    set({ contacts: await listContacts(await getDb()) });
  },

  reschedule: async () => {
    const notificationState = await rescheduleAll();
    const permission = await getPermissionState().catch(() => 'unsupported' as PermissionState);
    set({ notificationState, permission });
  },

  refreshSync: async () => {
    try {
      const status = await pushOutbox();
      set({ sync: status });
    } catch {
      set({ sync: await getSyncStatus().catch(() => null) });
    }
  },

  /** A pessoa aceitou a sugestão: aplica ao horário correspondente e reagenda. */
  applySuggestion: async (s) => {
    const { settings, medications } = get();
    if (s.kind === 'medication_time') {
      const med = medications.find((m) => m.id === s.medicationId);
      if (med) await get().upsertMedication(applyMedicationSuggestion(med, s));
    } else if (settings) {
      await get().updateSettings(applyHydrationSuggestion(settings, s));
    }
    set({ suggestions: get().suggestions.filter((x) => x.key !== s.key) });
  },

  /** A pessoa recusou: some da tela e não volta por um tempo. */
  dismissSuggestion: async (s) => {
    await dismissReminderSuggestion(s.key);
    set({ suggestions: get().suggestions.filter((x) => x.key !== s.key) });
  },

  /** Avisa cuidador sobre lembretes e doses sem confirmação (somente se configurado e autorizado) e envia a fila. */
  checkCaregiverAlert: async () => {
    await checkCaregiverAlerts().catch(() => undefined);
    void get().refreshSync();
  },
}));
