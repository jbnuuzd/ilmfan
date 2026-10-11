'use strict';
// Node (mahalliy ishlab chiqish va testlar): node:sqlite ustidan asinxron interfeys
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return {
    raw,
    prepare(sql) {
      const st = raw.prepare(sql);
      return {
        get: async (...a) => st.get(...a) ?? null,
        all: async (...a) => st.all(...a),
        run: async (...a) => { const r = st.run(...a); return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }; },
      };
    },
    async batch(items) {
      raw.exec('BEGIN');
      try { for (const [sql, ...a] of items) raw.prepare(sql).run(...a); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
  };
}

module.exports = { open };
