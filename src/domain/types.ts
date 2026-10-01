/**
 * Tipos centrais do domínio. Puros (sem dependência de React Native) para permitir testes.
 * Horários "HH:mm" são locais ao dispositivo; instantes são ISO 8601 com fuso.
 */

export type HHmm = string; // "07:30"
export type ISODateTime = string; // "2026-09-29T10:00:00.000Z"
export type ISODate = string; // "2026-09-29"

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo (padrão JS)
export const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export type TriState = 'yes' | 'no' | 'unknown';

export interface TimeRange {
  start: HHmm;
  end: HHmm;
}

export interface Meal {
  label: string; // "Café da manhã"
  time: HHmm;
}

export interface Container {
  id: string;
  label: string; // "Copo pequeno"
  volumeMl: number;
}

export interface AccessibilityPrefs {
  fontScale: 1 | 1.25 | 1.5 | 1.75;
  highContrast: boolean;
  speakReminders: boolean; // leitura em voz alta dentro do app
  reduceMotion: boolean;
}

export interface Profile {
  id: string;
  name: string;
  preferredName: string;
  age: number | null;
  filledWithHelp: boolean; // preenchido com ajuda de cuidador
  wakeTime: HHmm;
  sleepTime: HHmm;
  naps: TimeRange[];
  meals: Meal[];
  activities: string[];
  heatExposure: TriState;
  drinkPreferences: string[];
  fruitPreferences: string[];
  containers: Container[];
  allergies: string[];
  dietaryRestrictions: string[];
  healthConditions: string[];
  /** Existe restrição de líquidos ou meta orientada por profissional? */
  fluidRestriction: TriState;
  /** Quantidade diária orientada pelo profissional, quando conhecida (ml). */
  professionalGoalMl: number | null;
  professionalInstructions: string;
  swallowingDifficulty: TriState;
  needsHelpToDrink: TriState;
  needsHelpToBathroom: TriState;
  accessibility: AccessibilityPrefs;
  wantsMedications: boolean;
  wantsCaregiver: boolean;
  assessmentCompleted: boolean;
  assessmentStep: number; // para continuar depois
  lastHealthReviewPromptAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type HydrationReminderMode = 'interval' | 'times';

export interface HydrationSettings {
  enabled: boolean;
  mode: HydrationReminderMode;
  intervalMinutes: 60 | 90 | 120 | number;
  times: HHmm[];
  windowStart: HHmm;
  windowEnd: HHmm;
  pauseDuringNaps: boolean;
  weekdays: Weekday[];
  sound: boolean;
  vibrate: boolean;
  snoozeMinutes: number;
  /** Exibir detalhes (nomes de remédios) na tela bloqueada. Padrão: oculto. */
  showDetailsOnLockScreen: boolean;
  /** Após N lembretes seguidos sem confirmação, avisar cuidador autorizado. 0 = desligado. */
  caregiverAlertAfterUnconfirmed: number;
  /**
   * A janela (início/fim) acompanha acordar/dormir do perfil. Vira false quando a pessoa ajusta
   * a janela manualmente em "Lembretes de água" para valores diferentes da rotina.
   */
  windowFollowsRoutine: boolean;
  /** Repetir o lembrete de medicamento a cada N minutos enquanto não confirmado. 0 = não repetir. */
  medicationRepeatMinutes: number;
  /** Quantas repetições no máximo por dose. */
  medicationRepeatCount: number;
}

export type BeverageKind = 'water' | 'tea' | 'juice' | 'milk' | 'coffee' | 'soup' | 'other';

export interface HydrationLog {
  id: string;
  at: ISODateTime;
  volumeMl: number;
  beverage: BeverageKind;
  containerLabel: string | null;
  source: 'manual' | 'notification' | 'demo';
  note: string;
  deletedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type MedicationScheduleType = 'fixed_times' | 'interval_hours';

export interface Medication {
  id: string;
  name: string;
  presentation: string; // "Comprimido 50 mg"
  doseAmount: string; // texto conforme prescrição ("1", "meio", "10")
  doseUnit: string; // "comprimido", "ml", "gotas"
  route: string; // "oral", "tópica"...
  scheduleType: MedicationScheduleType;
  times: HHmm[]; // fixed_times
  intervalHours: number | null; // interval_hours
  intervalAnchor: HHmm | null; // primeiro horário do dia para intervalos
  weekdays: Weekday[];
  startDate: ISODate | null;
  endDate: ISODate | null;
  instructions: string; // instruções do profissional (inclui relação com refeições)
  photoUri: string | null;
  active: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type OccurrenceStatus = 'scheduled' | 'taken' | 'snoozed' | 'unconfirmed' | 'not_taken';

export interface OccurrenceHistoryEntry {
  at: ISODateTime;
  from: OccurrenceStatus | null;
  to: OccurrenceStatus;
  reason: string;
}

export interface MedicationOccurrence {
  /** Identificador determinístico: `${medicationId}@${plannedAt}` — evita duplicidade. */
  id: string;
  medicationId: string;
  plannedAt: ISODateTime;
  status: OccurrenceStatus;
  takenAt: ISODateTime | null;
  snoozedUntil: ISODateTime | null;
  note: string;
  history: OccurrenceHistoryEntry[];
  updatedAt: ISODateTime;
}

export type NotificationKind = 'hydration' | 'medication' | 'health_review' | 'test';

export interface PlannedNotification {
  /** Identificador estável usado no sistema operacional para reconciliar sem duplicar. */
  identifier: string;
  kind: NotificationKind;
  fireAt: ISODateTime;
  title: string;
  body: string;
  categoryId: string;
  channelId: string;
  data: Record<string, string>;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export type CarePermission = 'view' | 'edit';

export interface CareLink {
  id: string;
  caregiverEmail: string | null;
  caregiverName: string | null;
  permission: CarePermission;
  status: 'pending' | 'active' | 'revoked';
  createdAt: ISODateTime;
}

export interface EducationalContent {
  id: string;
  title: string;
  body: string;
  source: string;
  reviewedAt: ISODate;
  status: 'validated' | 'draft' | 'rejected';
  tags: string[];
}
