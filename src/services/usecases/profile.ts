import { getDb } from '@/data/db';
import { DOC_HYDRATION_SETTINGS, DOC_PROFILE, getDocument, setDocument } from '@/data/repositories/documents';
import { enqueue } from '@/data/repositories/hydration';
import type { HydrationSettings, Profile } from '@/domain/types';
import { defaultHydrationSettings } from '@/domain/hydration/schedule';
import { newId } from '@/domain/ids';
import { strings } from '@/i18n';

export function emptyProfile(): Profile {
  const now = new Date().toISOString();
  const d = strings().defaults;
  return {
    id: newId('p-'),
    name: '',
    preferredName: '',
    age: null,
    filledWithHelp: false,
    wakeTime: '07:00',
    sleepTime: '22:00',
    naps: [],
    meals: d.meals.map((m) => ({ ...m })),
    activities: [],
    heatExposure: 'unknown',
    drinkPreferences: [d.drink],
    fruitPreferences: [],
    containers: d.containers.map((c) => ({ id: newId('c-'), ...c })),
    allergies: [],
    dietaryRestrictions: [],
    healthConditions: [],
    fluidRestriction: 'unknown',
    professionalGoalMl: null,
    professionalInstructions: '',
    swallowingDifficulty: 'unknown',
    needsHelpToDrink: 'unknown',
    needsHelpToBathroom: 'unknown',
    accessibility: { fontScale: 1.25, highContrast: false, speakReminders: false, reduceMotion: false },
    wantsMedications: false,
    wantsCaregiver: false,
    assessmentCompleted: false,
    assessmentStep: 0,
    lastHealthReviewPromptAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function loadProfile(): Promise<Profile> {
  const db = await getDb();
  return (await getDocument<Profile>(db, DOC_PROFILE)) ?? emptyProfile();
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const db = await getDb();
  const next = { ...profile, updatedAt: new Date().toISOString() };
  await setDocument(db, DOC_PROFILE, next);
  await enqueue(db, 'profile', next.id, 'upsert', sanitizeProfileForSync(next));
  return next;
}

export async function loadHydrationSettings(profile: Profile): Promise<HydrationSettings> {
  const db = await getDb();
  const stored = await getDocument<Partial<HydrationSettings>>(db, DOC_HYDRATION_SETTINGS);
  // Campos novos recebem o padrão sem exigir migração do documento.
  return { ...defaultHydrationSettings(profile), ...(stored ?? {}) } as HydrationSettings;
}

export async function saveHydrationSettings(settings: HydrationSettings): Promise<void> {
  const db = await getDb();
  await setDocument(db, DOC_HYDRATION_SETTINGS, settings);
}

/** O cuidador vê apenas o essencial; alergias/condições ficam no dispositivo. */
function sanitizeProfileForSync(p: Profile) {
  return {
    id: p.id,
    preferredName: p.preferredName,
    wakeTime: p.wakeTime,
    sleepTime: p.sleepTime,
    professionalGoalMl: p.professionalGoalMl,
    fluidRestriction: p.fluidRestriction,
    updatedAt: p.updatedAt,
  };
}
