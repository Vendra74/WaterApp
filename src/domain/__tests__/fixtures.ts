import type { HydrationSettings, Medication, Profile } from '../types';

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    name: 'Maria',
    preferredName: 'Dona Maria',
    age: 78,
    filledWithHelp: false,
    wakeTime: '07:00',
    sleepTime: '22:00',
    naps: [{ start: '13:00', end: '14:00' }],
    meals: [
      { label: 'Café da manhã', time: '07:30' },
      { label: 'Almoço', time: '12:00' },
      { label: 'Lanche da tarde', time: '16:00' },
      { label: 'Jantar', time: '19:00' },
    ],
    activities: ['caminhada'],
    heatExposure: 'no',
    drinkPreferences: ['água', 'chá'],
    fruitPreferences: ['banana', 'mamão', 'morango'],
    containers: [{ id: 'c1', label: 'Copo', volumeMl: 200 }],
    allergies: ['morango'],
    dietaryRestrictions: [],
    healthConditions: [],
    fluidRestriction: 'no',
    professionalGoalMl: null,
    professionalInstructions: '',
    swallowingDifficulty: 'no',
    needsHelpToDrink: 'no',
    needsHelpToBathroom: 'no',
    accessibility: { fontScale: 1.25, highContrast: false, speakReminders: false, reduceMotion: false },
    wantsMedications: true,
    wantsCaregiver: false,
    assessmentCompleted: true,
    assessmentStep: 0,
    lastHealthReviewPromptAt: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

export function makeSettings(overrides: Partial<HydrationSettings> = {}): HydrationSettings {
  return {
    enabled: true,
    mode: 'interval',
    intervalMinutes: 60,
    times: [],
    windowStart: '08:00',
    windowEnd: '20:00',
    pauseDuringNaps: true,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    sound: true,
    vibrate: true,
    snoozeMinutes: 15,
    showDetailsOnLockScreen: false,
    caregiverAlertAfterUnconfirmed: 0,
    ...overrides,
  };
}

export function makeMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 'm1',
    name: 'Losartana',
    presentation: 'Comprimido 50 mg',
    doseAmount: '1',
    doseUnit: 'comprimido',
    route: 'oral',
    scheduleType: 'fixed_times',
    times: ['08:00', '23:00'],
    intervalHours: null,
    intervalAnchor: null,
    weekdays: [],
    startDate: null,
    endDate: null,
    instructions: 'Após o café',
    photoUri: null,
    active: true,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Terça-feira, 29/09/2026 às 07:15 (horário local de São Paulo definido em jest.setup). */
export const NOW = new Date(2026, 8, 29, 7, 15, 0, 0);
