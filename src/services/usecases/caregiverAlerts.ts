import { getDb } from '@/data/db';
import { DOC_CAREGIVER_ALERT_STATE, getDocument, setDocument } from '@/data/repositories/documents';
import { listOccurrencesBetween } from '@/data/repositories/medications';
import { consecutiveUnconfirmedHydration } from '@/data/repositories/misc';
import {
  EMPTY_ALERT_STATE,
  MEDICATION_ALERT_WINDOW_HOURS,
  hydrationAlertDue,
  markMedicationAlerted,
  medicationAlertCandidates,
  type CaregiverAlertState,
} from '@/domain/care/alerts';
import { currentUser } from '@/services/sync/authService';
import { sendUnconfirmedAlert } from '@/services/sync/careService';
import { loadHydrationSettings, loadProfile } from './profile';

/**
 * Registra avisos "sem confirmação" para cuidadores autorizados: lembretes de água seguidos e doses
 * de medicamento. Sem conta conectada nada é enviado. Um aviso só é marcado como feito depois de
 * envio confirmado; se falhar (sem internet), a próxima verificação tenta de novo.
 * Chame depois de `refreshOccurrences`, que é quem marca as doses atrasadas como "sem confirmação".
 */
export async function checkCaregiverAlerts(now = new Date()): Promise<void> {
  if (!(await currentUser())) return;
  const db = await getDb();
  const settings = await loadHydrationSettings(await loadProfile());
  let state: CaregiverAlertState = { ...EMPTY_ALERT_STATE, ...((await getDocument<Partial<CaregiverAlertState>>(db, DOC_CAREGIVER_ALERT_STATE)) ?? {}) };
  const since = new Date(now.getTime() - MEDICATION_ALERT_WINDOW_HOURS * 3_600_000);

  const { count, latestFiredAt } = await consecutiveUnconfirmedHydration(db, since.toISOString());
  if (hydrationAlertDue(count, settings.caregiverAlertAfterUnconfirmed, latestFiredAt, state) && (await sendUnconfirmedAlert('hydration_unconfirmed', count))) {
    state = { ...state, hydrationFiredAt: latestFiredAt };
    await setDocument(db, DOC_CAREGIVER_ALERT_STATE, state);
  }

  if (settings.caregiverAlertMedication) {
    const occs = await listOccurrencesBetween(db, since.toISOString(), now.toISOString());
    const pending = medicationAlertCandidates(occs, state, now);
    if (pending.length > 0 && (await sendUnconfirmedAlert('medication_unconfirmed', pending.length))) {
      state = markMedicationAlerted(occs, state, now);
      await setDocument(db, DOC_CAREGIVER_ALERT_STATE, state);
    }
  }
}
