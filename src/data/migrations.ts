/**
 * Migrações incrementais do banco local (SQLite). O índice no array é a versão (user_version = índice + 1).
 * Nunca edite uma migração já publicada: adicione uma nova.
 */
export const MIGRATIONS: string[] = [
  // v1 — esquema inicial
  `
  CREATE TABLE IF NOT EXISTS documents (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hydration_logs (
    id TEXT PRIMARY KEY NOT NULL,
    at TEXT NOT NULL,
    volume_ml INTEGER NOT NULL,
    beverage TEXT NOT NULL DEFAULT 'water',
    container_label TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    note TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_hydration_logs_at ON hydration_logs(at);

  CREATE TABLE IF NOT EXISTS hydration_log_history (
    id TEXT PRIMARY KEY NOT NULL,
    log_id TEXT NOT NULL REFERENCES hydration_logs(id),
    at TEXT NOT NULL,
    change TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    presentation TEXT NOT NULL DEFAULT '',
    dose_amount TEXT NOT NULL DEFAULT '',
    dose_unit TEXT NOT NULL DEFAULT '',
    route TEXT NOT NULL DEFAULT '',
    schedule_type TEXT NOT NULL,
    times TEXT NOT NULL DEFAULT '[]',
    interval_hours REAL,
    interval_anchor TEXT,
    weekdays TEXT NOT NULL DEFAULT '[]',
    start_date TEXT,
    end_date TEXT,
    instructions TEXT NOT NULL DEFAULT '',
    photo_uri TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS medication_occurrences (
    id TEXT PRIMARY KEY NOT NULL,
    medication_id TEXT NOT NULL REFERENCES medications(id),
    planned_at TEXT NOT NULL,
    status TEXT NOT NULL,
    taken_at TEXT,
    snoozed_until TEXT,
    note TEXT NOT NULL DEFAULT '',
    history TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_occ_planned ON medication_occurrences(planned_at);
  CREATE INDEX IF NOT EXISTS idx_occ_med ON medication_occurrences(medication_id);

  CREATE TABLE IF NOT EXISTS emergency_contacts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS reminder_responses (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    ref TEXT NOT NULL,
    at TEXT NOT NULL,
    action TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reminder_responses_at ON reminder_responses(at);

  CREATE TABLE IF NOT EXISTS sync_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    op TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );
  `,
];
