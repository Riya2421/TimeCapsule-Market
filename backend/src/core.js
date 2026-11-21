'use strict';
/* Shared lookups and the response shapes (these must match assets/js/api.js, the front-end mock). */
const { fail, DAY, isoDate, addDays } = require('./util');

const CFG = { GIFT_WRAP: 49, STAGE_FEE: 29, MAX_STAGES: 5 };

/* ---------- clock (demo clock offset lives in the settings table) ---------- */
function clockOffset(db) { const r = db.get("SELECT v FROM settings WHERE k = 'clock_offset'"); return r ? Number(r.v) : 0; }
function setClockOffset(db, n) { db.run("INSERT INTO settings (k, v) VALUES ('clock_offset', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", String(n)); }
const now = (db) => new Date(Date.now() + clockOffset(db) * DAY);
const today = (db) => isoDate(now(db));
const stamp = (db) => now(db).toISOString();

/* ---------- auth guards ---------- */
function needUser(ctx) { if (!ctx.user) fail('Please log in first.', 401); return ctx.user; }
function needAdmin(ctx) { const u = needUser(ctx); if (u.role !== 'admin') fail('Admin access only.', 403); return u; }

/* ---------- products ---------- */
function withTags(db, rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const tags = db.all(`SELECT product_id, tag FROM product_tags WHERE product_id IN (${ids.map(() => '?').join(',')}) ORDER BY tag`, ...ids);
  const by = {};
  tags.forEach((t) => { (by[t.product_id] = by[t.product_id] || []).push(t.tag); });
  return rows.map((r) => ({ id: r.id, vendor_id: r.vendor_id, name: r.name, price: r.price, stock: r.stock, emoji: r.emoji, tint: r.tint, tags: by[r.id] || [], blurb: r.blurb }));
}
const activeProducts = (db) => withTags(db, db.all('SELECT * FROM products WHERE is_active = 1 ORDER BY id'));
/* history (orders, capsules) can still point at a product an admin has retired, so this ignores is_active */
function productById(db, id) { return withTags(db, db.all('SELECT * FROM products WHERE id = ?', Number(id)))[0] || null; }
function liveProduct(db, id) { return withTags(db, db.all('SELECT * FROM products WHERE id = ? AND is_active = 1', Number(id)))[0] || null; }

/* ---------- capsules ---------- */
function totals(db, capsuleId, giftWrap, budget) {
  const r = db.get(`SELECT COALESCE(SUM(p.price * i.qty), 0) AS items, COALESCE(SUM(i.qty), 0) AS count
                    FROM stage_items i JOIN stages s ON s.id = i.stage_id JOIN products p ON p.id = i.product_id
                    WHERE s.capsule_id = ?`, capsuleId);
  const n = db.get('SELECT COUNT(*) AS n FROM stages WHERE capsule_id = ?', capsuleId).n;
  const wrap = giftWrap ? CFG.GIFT_WRAP * n : 0;
  const fee = CFG.STAGE_FEE * n;
  return { items: r.items, count: r.count, wrap, fee, total: r.items + wrap + fee, budget: budget || 0, remaining: (budget || 0) - r.items };
}
const raised = (db, capsuleId) => db.get('SELECT COALESCE(SUM(amount), 0) AS s FROM contributions WHERE capsule_id = ? AND refunded = 0', capsuleId).s;

function safeUser(u) { return u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null; }

function stagesOf(db, capsuleId) {
  const stages = db.all('SELECT * FROM stages WHERE capsule_id = ? ORDER BY stage_no', capsuleId);
  stages.forEach((s) => {
    s.items = db.all('SELECT id, product_id, qty FROM stage_items WHERE stage_id = ? ORDER BY id', s.id);
    s.items.forEach((i) => { i.product = productById(db, i.product_id); });
  });
  return stages;
}

function view(db, c) {
  const out = {
    id: c.id, owner_id: c.owner_id, recipient_id: c.recipient_id, occasion_id: c.occasion_id, title: c.title, type: c.type, status: c.status,
    share_token: c.share_token, recipient_token: c.recipient_token, target_amount: c.target_amount, funding_deadline: c.funding_deadline,
    gift_wrap: !!c.gift_wrap, budget: c.budget, created_at: c.created_at, thank_you: c.thank_you, completed_at: c.completed_at, total_price: c.total_price,
  };
  out.stages = stagesOf(db, c.id);
  out.totals = totals(db, c.id, c.gift_wrap, c.budget);
  out.raised = c.type === 'group' ? raised(db, c.id) : 0;
  out.recipient = c.recipient_id ? db.get('SELECT * FROM recipients WHERE id = ?', c.recipient_id) : null;
  out.occasion = c.occasion_id ? db.get('SELECT * FROM occasions WHERE id = ?', c.occasion_id) : null;
  out.owner = safeUser(db.get('SELECT id, name, email, role FROM users WHERE id = ?', c.owner_id));
  const ord = db.get('SELECT id FROM orders WHERE capsule_id = ? ORDER BY id LIMIT 1', c.id);
  out.order_id = ord ? ord.id : null;
  return out;
}

/* ---------- outbox (stands in for Nodemailer) ---------- */
function email(db, userId, to, subject, body, link, kind) {
  db.run('INSERT INTO outbox (user_id, to_addr, subject, body, link, kind, created_at) VALUES (?,?,?,?,?,?,?)',
    userId, to, subject, body, link || null, kind || 'info', stamp(db));
}

/* ---------- capsule lookups ---------- */
function capsuleRow(db, id) {
  const c = db.get('SELECT * FROM capsules WHERE id = ?', Number(id));
  if (!c) fail('That capsule does not exist.', 404);
  return c;
}
/* read: owner or admin. write: owner only */
function ownCapsule(ctx, id, write) {
  const u = needUser(ctx);
  const c = capsuleRow(ctx.db, id);
  if (c.owner_id !== u.id && (write || u.role !== 'admin')) fail('Capsule not found.', 404); // same answer as a missing id, so ids cannot be probed
  return c;
}
function needDraft(c) {
  if (c.status !== 'draft') fail('This capsule is already paid for, so it cannot be changed.');
}

module.exports = { CFG, clockOffset, setClockOffset, now, today, stamp, needUser, needAdmin, withTags, activeProducts, productById, liveProduct, totals, raised, safeUser, view, stagesOf, email, capsuleRow, ownCapsule, needDraft, addDays };
