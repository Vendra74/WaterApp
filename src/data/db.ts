import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './migrations';

export type DB = SQLite.SQLiteDatabase;

let dbPromise: Promise<DB> | null = null;

export const DB_NAME = 'cuidar.db';

export function getDb(): Promise<DB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function migrate(db: DB): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version]!;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version += 1;
  }
}

/** Apaga todo o banco local (exclusão de dados pelo usuário). */
export async function wipeDatabase(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM reminder_responses;
      DELETE FROM sync_outbox;
      DELETE FROM emergency_contacts;
      DELETE FROM medication_occurrences;
      DELETE FROM medications;
      DELETE FROM hydration_log_history;
      DELETE FROM hydration_logs;
      DELETE FROM documents;
    `);
  });
}
