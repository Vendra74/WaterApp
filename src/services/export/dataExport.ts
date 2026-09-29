import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDb, wipeDatabase } from '@/data/db';
import { listAllLogs } from '@/data/repositories/hydration';
import { listMedications, listOccurrencesBetween } from '@/data/repositories/medications';
import { listContacts } from '@/data/repositories/misc';
import { DOC_HYDRATION_SETTINGS, DOC_PROFILE, getDocument } from '@/data/repositories/documents';
import { cancelAllOwned } from '@/services/notifications/notificationService';
import { APP_NAME } from '@/config/branding';

/** Exporta todos os dados locais em JSON legível e abre o compartilhamento do sistema. */
export async function exportAllData(): Promise<string> {
  const db = await getDb();
  const payload = {
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
    profile: await getDocument(db, DOC_PROFILE),
    hydrationSettings: await getDocument(db, DOC_HYDRATION_SETTINGS),
    hydrationLogs: await listAllLogs(db),
    medications: await listMedications(db),
    medicationOccurrences: await listOccurrencesBetween(db, '1970-01-01T00:00:00.000Z', '2999-01-01T00:00:00.000Z'),
    emergencyContacts: await listContacts(db),
  };
  const file = new File(Paths.cache, `${APP_NAME.toLowerCase()}-dados-${Date.now()}.json`);
  file.write(JSON.stringify(payload, null, 2));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Exportar meus dados' });
  }
  return file.uri;
}

/** Exclui todos os dados locais e cancela lembretes. O apagamento remoto é feito pelo serviço de sincronização. */
export async function deleteAllLocalData(): Promise<void> {
  await cancelAllOwned();
  await wipeDatabase();
}
