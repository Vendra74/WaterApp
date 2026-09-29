import { getDb } from '@/data/db';
import { insertLog } from '@/data/repositories/hydration';
import { upsertMedication } from '@/data/repositories/medications';
import { setDocument, DOC_PROFILE } from '@/data/repositories/documents';
import { emptyProfile } from '@/services/usecases/profile';
import { newId } from '@/domain/ids';
import type { Medication, Profile } from '@/domain/types';

/**
 * Dados fictícios — usados apenas quando EXPO_PUBLIC_DEMO_MODE=true e o usuário aciona "Carregar demonstração".
 * Todos os registros ficam marcados com source 'demo' e o perfil com nome "(Demonstração)".
 */
export async function loadDemoData(): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const profile: Profile = {
    ...emptyProfile(),
    name: 'Maria (Demonstração)',
    preferredName: 'Dona Maria',
    age: 79,
    naps: [{ start: '13:30', end: '14:30' }],
    fruitPreferences: ['Banana', 'Mamão'],
    allergies: [],
    fluidRestriction: 'no',
    swallowingDifficulty: 'no',
    needsHelpToDrink: 'no',
    needsHelpToBathroom: 'no',
    heatExposure: 'no',
    wantsMedications: true,
    assessmentCompleted: true,
  };
  await setDocument(db, DOC_PROFILE, profile);

  for (let i = 0; i < 4; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8 + i * 2, 5).toISOString();
    await insertLog(db, {
      id: newId('demo-'),
      at,
      volumeMl: 200,
      beverage: 'water',
      containerLabel: 'Copo',
      source: 'demo',
      note: 'Dado de demonstração',
      deletedAt: null,
      createdAt: at,
      updatedAt: at,
    });
  }

  const med: Medication = {
    id: newId('demo-m-'),
    name: 'Exemplo (Demonstração)',
    presentation: 'Comprimido 10 mg',
    doseAmount: '1',
    doseUnit: 'comprimido',
    route: 'oral',
    scheduleType: 'fixed_times',
    times: ['08:00', '22:30'],
    intervalHours: null,
    intervalAnchor: null,
    weekdays: [],
    startDate: null,
    endDate: null,
    instructions: 'Exemplo fictício. Não é uma prescrição.',
    photoUri: null,
    active: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await upsertMedication(db, med);
}
