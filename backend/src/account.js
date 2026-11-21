'use strict';
const { fail, str } = require('./util');
const auth = require('./auth');
const core = require('./core');
const catalog = require('./catalog');
const { needUser, view } = core;

const loginLimit = auth.failureLimiter(8, 15 * 60 * 1000); // 8 wrong passwords per email+IP per 15 minutes
const registerLimit = auth.limiter(Number(process.env.REGISTER_LIMIT) || 10, 60 * 60 * 1000); // 10 new accounts per IP per hour
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const me = (ctx) => core.safeUser(ctx.user);

function login(ctx, email, password) {
  const key = String(email || '').trim().toLowerCase();
  const lk = ctx.ip + '|' + key;
  loginLimit.check(lk);
  const u = ctx.db.get('SELECT * FROM users WHERE email = ?', key);
  const ok = auth.verifyPassword(password, u && u.password_hash); // runs scrypt even for unknown emails, so timing does not reveal them
  if (!u || !ok) { loginLimit.record(lk); fail('That email and password do not match.', 401); }
  loginLimit.clear(lk);
  ctx.startSession(u.id);
  return core.safeUser(u);
}
function register(ctx, body) {
  const { name, email, password, phone } = body || {};
  registerLimit(ctx.ip);
  const db = ctx.db;
  if (!str(name, 80) || !str(email, 190) || !password) fail('Fill in your name, email and password.');
  if (!EMAIL.test(str(email, 190))) fail('Enter a valid email address.');
  if (String(password).length < 6) fail('Use a password with at least 6 characters.');
  if (String(password).length > 200) fail('That password is too long.');
  const em = str(email, 190).toLowerCase();
  if (db.get('SELECT id FROM users WHERE email = ?', em)) fail('An account with this email already exists. Log in instead.', 409);
  const id = db.run('INSERT INTO users (name, email, phone, password_hash, role, created_at) VALUES (?,?,?,?,?,?)', str(name, 80), em, str(phone, 20), auth.hashPassword(password), 'customer', core.stamp(db)).id;
  ctx.startSession(id);
  return core.safeUser(db.get('SELECT * FROM users WHERE id = ?', id));
}
function logout(ctx) { ctx.endSession(); return true; }

function timeline(ctx) {
  const db = ctx.db, u = needUser(ctx);
  const caps = db.all("SELECT * FROM capsules WHERE owner_id = ? AND status IN ('confirmed','active','completed')", u.id).map((c) => view(db, c));
  return caps.sort((a, b) => b.stages[0].unlock_date.localeCompare(a.stages[0].unlock_date)).map((c) => {
    const m = db.get('SELECT * FROM memory_events WHERE capsule_id = ? ORDER BY id LIMIT 1', c.id);
    return { capsule: c, event: m ? Object.assign(m, { notified: !!m.notified }) : null };
  });
}

const wishlistIds = (db, userId) => (userId ? db.all('SELECT collection_id FROM wishlist WHERE user_id = ? ORDER BY collection_id', userId).map((r) => r.collection_id) : []);
function wishlist(ctx) {
  const ids = wishlistIds(ctx.db, needUser(ctx).id);
  return catalog.collectionsList(ctx.db).filter((c) => ids.includes(c.id));
}
function toggleWishlist(ctx, collection_id) {
  const db = ctx.db, u = needUser(ctx);
  const col = db.get('SELECT id FROM collections WHERE id = ?', Number(collection_id));
  if (!col) fail('That collection does not exist.', 404);
  const had = db.run('DELETE FROM wishlist WHERE user_id = ? AND collection_id = ?', u.id, col.id).changes > 0;
  if (!had) db.run('INSERT INTO wishlist (user_id, collection_id) VALUES (?,?)', u.id, col.id);
  return !had;
}
const mailbox = (ctx) => ctx.db.all('SELECT id, to_addr, subject, body, link, kind, created_at FROM outbox WHERE user_id = ? ORDER BY id DESC LIMIT 200', needUser(ctx).id)
  .map((r) => ({ id: r.id, to: r.to_addr, subject: r.subject, body: r.body, link: r.link, kind: r.kind, date: r.created_at }));

module.exports = { me, login, register, logout, timeline, wishlist, wishlistIds, toggleWishlist, mailbox };
