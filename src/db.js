'use strict';
/*
 * Ma'lumotlar bazasi qatlami — Node (node:sqlite, db-node.js) va Cloudflare D1 (db-d1.js) uchun BIR XIL asinxron interfeys:
 *   db.prepare(sql).get(...args) | .all(...args) | .run(...args)   (hammasi Promise)
 *   db.batch([[sql, ...args], ...])                               (atomik)
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  full_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'beginner',      -- doctoral | independent | beginner
  degree TEXT NOT NULL DEFAULT 'phd',           -- phd | dsc
  direction_code TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  months INTEGER NOT NULL DEFAULT 12,
  start_month TEXT NOT NULL DEFAULT '',         -- YYYY-MM
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS directions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  field_group TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',                -- vergul bilan ajratilgan teglar
  hints TEXT NOT NULL DEFAULT ''                -- yo'nalishga xos hujjat/joriy etish maslahatlari (| bilan)
);
CREATE TABLE IF NOT EXISTS journals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'journal',         -- journal | conference
  issn TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  since_year INTEGER,
  access TEXT NOT NULL DEFAULT 'free',          -- free | paid (nashr uchun to'lov)
  apc_usd INTEGER,
  scopus_status TEXT NOT NULL DEFAULT 'none',   -- none | active | discontinued
  quartile TEXT NOT NULL DEFAULT '',            -- Q1..Q4
  oak_status TEXT NOT NULL DEFAULT 'none',      -- none | active | removed
  impact_factor REAL,
  wos INTEGER NOT NULL DEFAULT 0,
  subjects TEXT NOT NULL DEFAULT '',
  acceptance INTEGER NOT NULL DEFAULT 3,        -- 1..5, yuqori = qabul ehtimoli yuqori
  review_weeks INTEGER,
  official_url TEXT NOT NULL DEFAULT '',
  scopus_url TEXT NOT NULL DEFAULT '',
  oak_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  verified INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS journal_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_id INTEGER NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  source TEXT NOT NULL DEFAULT 'admin',
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS user_journals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journal_id INTEGER NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  category TEXT NOT NULL,                       -- scopus | oak | impact | conference
  access TEXT NOT NULL,                         -- free | paid
  flag TEXT NOT NULL DEFAULT '',                -- '' | downgraded | delisted | removed
  flag_reason TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',                -- upgraded / new
  replaces INTEGER,
  snap_quartile TEXT NOT NULL DEFAULT '',
  fit_score INTEGER,
  fit_text TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, journal_id, category)
);
CREATE TABLE IF NOT EXISTS refresh_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  access TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  degree TEXT NOT NULL DEFAULT 'phd',
  kind TEXT NOT NULL,                           -- oak | foreign | scopus | conf_nat | conf_int | textbook | monograph | dgu
  title TEXT NOT NULL,
  min_count INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  verified INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS doc_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'defense',     -- defense | implementation | experiment | admin
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  phase TEXT NOT NULL DEFAULT 'late',           -- early | mid | late (qachon boshlash kerak)
  required INTEGER NOT NULL DEFAULT 1,
  directions TEXT NOT NULL DEFAULT '',          -- bo'sh = hammaga; aks holda teglar
  cancelled_from TEXT NOT NULL DEFAULT ''       -- YYYY-MM-DD: shu sanadan keyingi himoyalar uchun bekor qilingan talab
);
CREATE TABLE IF NOT EXISTS user_tasks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  PRIMARY KEY (user_id, task_key)
);
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS motivations (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS journals_name_uq ON journals(name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS requirements_uq ON requirements(degree, kind);
CREATE UNIQUE INDEX IF NOT EXISTS quotes_uq ON quotes(author, text);
CREATE INDEX IF NOT EXISTS user_journals_idx ON user_journals(user_id, category, access);
CREATE INDEX IF NOT EXISTS login_attempts_idx ON login_attempts(key, ts);
`;

function schemaStatements() {
  return SCHEMA.replace(/--[^\n]*/g, '').split(';').map((x) => x.trim()).filter(Boolean);
}

async function initSchema(db) {
  await db.batch(schemaStatements().map((sql) => [sql]));
  const cols = (await db.prepare('PRAGMA table_info(doc_templates)').all()).map((c) => c.name);
  if (!cols.includes('cancelled_from')) await db.prepare("ALTER TABLE doc_templates ADD COLUMN cancelled_from TEXT NOT NULL DEFAULT ''").run();
}

async function getSetting(db, key, def = '') {
  const row = await db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row?.value ?? def;
}
const setSetting = (db, key, value) =>
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));

/** Katta batch'larni bo'laklarga bo'lib yuboradi (D1 cheklovlari uchun) */
async function batchChunked(db, statements, size = 80) {
  for (let i = 0; i < statements.length; i += size) await db.batch(statements.slice(i, i + size));
}

module.exports = { SCHEMA, initSchema, getSetting, setSetting, batchChunked };
