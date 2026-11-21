'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const file = process.env.DB_FILE || path.join(ROOT, 'data', 'timecapsule.db');

function open(dbFile = file) {
  if (dbFile !== ':memory:') fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const raw = new DatabaseSync(dbFile);
  raw.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (dbFile !== ':memory:') raw.exec('PRAGMA journal_mode = WAL;');

  const cache = new Map();
  const stmt = (sql) => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
  const clean = (a) => a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));

  const db = {
    raw,
    all: (sql, ...p) => stmt(sql).all(...clean(p)),
    get: (sql, ...p) => stmt(sql).get(...clean(p)) || null,
    run: (sql, ...p) => { const r = stmt(sql).run(...clean(p)); return { id: Number(r.lastInsertRowid), changes: Number(r.changes) }; },
    exec: (sql) => raw.exec(sql),
    /* run fn inside a transaction; nested calls join the outer one. The driver is synchronous,
       so no other request can interleave between BEGIN and COMMIT. */
    tx(fn) {
      if (raw.isTransaction) return fn();
      raw.exec('BEGIN IMMEDIATE');
      try { const out = fn(); raw.exec('COMMIT'); return out; } catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
    close: () => raw.close(),
    hasSchema: () => !!raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get(),
  };
  return db;
}

module.exports = { open, file, ROOT };
