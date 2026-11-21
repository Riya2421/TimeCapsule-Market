'use strict';
/* Creates the schema and loads the demo data (backend/seed/seed.json, exported from the front-end prototype).
   Dates in the file are relative to seed.base_date, so they are shifted to make "today" line up with the real today. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { addDays, daysBetween, isoDate } = require('./util');
const { hashPassword } = require('./auth');

const SCHEMA = path.join(__dirname, '..', 'schema.sqlite.sql');
const SEED = path.join(__dirname, '..', 'seed', 'seed.json');

function createSchema(db) { db.exec(fs.readFileSync(SCHEMA, 'utf8')); }

/* delete every row (keeps the schema). Foreign keys are switched off for the wipe, which must happen outside a transaction. */
function wipe(db) {
  const tables = db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map((r) => r.name);
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    tables.forEach((t) => db.exec(`DELETE FROM "${t}"`));
    if (db.get("SELECT name FROM sqlite_master WHERE name = 'sqlite_sequence'")) db.exec('DELETE FROM sqlite_sequence');
  } finally { db.exec('PRAGMA foreign_keys = ON'); }
}

function loadSeed(db) {
  const S = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  const delta = daysBetween(S.base_date, isoDate(new Date()));
  const d = (s) => (s ? addDays(s.slice(0, 10), delta) + s.slice(10) : s); // works for dates and ISO timestamps
  const now = new Date().toISOString();

  db.tx(() => {
    S.users.forEach((u) => {
      // only the two demo logins keep their documented passwords; the rest get an unguessable one
      const pw = u.password === 'x' ? crypto.randomBytes(18).toString('base64url') : u.password;
      db.run('INSERT INTO users (id, name, email, phone, password_hash, role, created_at) VALUES (?,?,?,?,?,?,?)', u.id, u.name, u.email, '', hashPassword(pw), u.role, now);
    });
    S.occasions.forEach((o) => db.run('INSERT INTO occasions (id, slug, name, tagline, emoji, color, ink) VALUES (?,?,?,?,?,?,?)', o.id, o.slug, o.name, o.tagline, o.emoji, o.color, o.ink));
    S.vendors.forEach((v) => db.run('INSERT INTO vendors (id, shop_name, contact_email, city) VALUES (?,?,?,?)', v.id, v.shop_name, v.contact_email, v.city));
    S.products.forEach((p) => {
      db.run('INSERT INTO products (id, vendor_id, name, price, stock, emoji, tint, blurb) VALUES (?,?,?,?,?,?,?,?)', p.id, p.vendor_id, p.name, p.price, p.stock, p.emoji, p.tint, p.blurb);
      p.tags.forEach((t) => db.run('INSERT INTO product_tags (product_id, tag) VALUES (?,?)', p.id, t));
    });
    S.collections.forEach((c) => {
      db.run('INSERT INTO collections (id, occasion_id, title, blurb) VALUES (?,?,?,?)', c.id, c.occasion_id, c.title, c.blurb);
      c.productIds.forEach((pid, i) => db.run('INSERT INTO collection_products (collection_id, product_id, position) VALUES (?,?,?)', c.id, pid, i));
    });
    S.quiz.forEach((q, qi) => {
      db.run('INSERT INTO quiz_questions (id, position, question) VALUES (?,?,?)', q.id, qi, q.question);
      q.options.forEach((o, oi) => db.run('INSERT INTO quiz_options (id, question_id, position, label, tag, occasion_id, budget) VALUES (?,?,?,?,?,?,?)',
        o.id, q.id, oi, o.text, o.tag === undefined ? null : o.tag, o.occasion_id === undefined ? null : o.occasion_id, o.budget === undefined ? null : o.budget));
    });
    S.recipients.forEach((r) => db.run('INSERT INTO recipients (id, user_id, name, relation, interests, birthday, email, address) VALUES (?,?,?,?,?,?,?,?)',
      r.id, r.user_id, r.name, r.relation, r.interests, r.birthday, r.email, r.address)); // birthdays are real dates, so they are not shifted
    S.capsules.forEach((c) => {
      db.run(`INSERT INTO capsules (id, owner_id, recipient_id, occasion_id, title, type, status, share_token, recipient_token, target_amount, funding_deadline,
                gift_wrap, budget, total_price, thank_you, created_at, completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      c.id, c.owner_id, c.recipient_id, c.occasion_id, c.title, c.type, c.status, c.share_token, c.recipient_token, c.target_amount, d(c.funding_deadline),
      c.gift_wrap ? 1 : 0, c.budget, c.total_price, c.thank_you || '', d(c.created_at), d(c.completed_at));
      c.stages.forEach((s) => {
        db.run('INSERT INTO stages (id, capsule_id, stage_no, unlock_date, status, message) VALUES (?,?,?,?,?,?)', s.id, c.id, s.stage_no, d(s.unlock_date), s.status, s.message);
        s.items.forEach((i) => db.run('INSERT INTO stage_items (id, stage_id, product_id, qty) VALUES (?,?,?,?)', i.id, s.id, i.product_id, i.qty));
      });
    });
    S.contributions.forEach((x) => db.run('INSERT INTO contributions (id, capsule_id, contributor_name, amount, message, product_id, txn_ref, created_at, refunded) VALUES (?,?,?,?,?,?,?,?,?)',
      x.id, x.capsule_id, x.contributor_name, x.amount, x.message, x.product_id, x.txn_ref, d(x.created_at), x.refunded ? 1 : 0));
    S.orders.forEach((o) => {
      db.run('INSERT INTO orders (id, user_id, capsule_id, occasion_id, total, status, created_at, address, pay_mode, pay_status, txn_ref) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        o.id, o.user_id, o.capsule_id, o.occasion_id, o.total, o.status, d(o.created_at), o.address, o.payment.mode, o.payment.status, o.payment.txn_ref);
      o.items.forEach((i) => db.run('INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?,?,?,?)', o.id, i.product_id, i.qty, i.price));
      o.deliveries.forEach((x) => db.run('INSERT INTO deliveries (id, order_id, stage_id, address, scheduled_date, status) VALUES (?,?,?,?,?,?)', x.id, o.id, x.stage_id, x.address, d(x.scheduled_date), x.status));
    });
    S.memory_events.forEach((m) => db.run('INSERT INTO memory_events (id, user_id, capsule_id, event_date, reminder_date, notified) VALUES (?,?,?,?,?,?)',
      m.id, m.user_id, m.capsule_id, d(m.event_date), d(m.reminder_date), m.notified ? 1 : 0));
    S.wishlist.forEach((w) => db.run('INSERT INTO wishlist (user_id, collection_id) VALUES (?,?)', w.user_id, w.collection_id));
    db.run("INSERT INTO settings (k, v) VALUES ('clock_offset', '0')");
  });
}

/* fresh database: schema + demo data */
function init(db) { createSchema(db); loadSeed(db); }
/* wipe and reload (used by the "Reset demo data" button) */
function reset(db) { wipe(db); loadSeed(db); }

module.exports = { init, reset, createSchema, loadSeed, wipe };

if (require.main === module) {
  const dbm = require('./db');
  const db = dbm.open();
  if (db.hasSchema()) { reset(db); console.log('Database reset with demo data:', dbm.file); }
  else { init(db); console.log('Database created with demo data:', dbm.file); }
  db.close();
}
