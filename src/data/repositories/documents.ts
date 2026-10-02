import type { DB } from '../db';

/** Documentos JSON versionados (perfil, configurações). */
export async function getDocument<T>(db: DB, key: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM documents WHERE key = ?', key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function setDocument<T>(db: DB, key: string, value: T): Promise<void> {
  await db.runAsync(
    'INSERT INTO documents(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}

export const DOC_PROFILE = 'profile';
export const DOC_HYDRATION_SETTINGS = 'hydration_settings';
export const DOC_CARE = 'care';
export const DOC_NOTIFICATION_STATE = 'notification_state';
export const DOC_CAREGIVER_ALERT_STATE = 'caregiver_alert_state';
export const DOC_OCCURRENCES_QUEUED = 'occurrences_queued';
