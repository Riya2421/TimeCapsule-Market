'use strict';
const crypto = require('node:crypto');
const { fail } = require('./util');

const SESSION_MS = 7 * 86400000;

/* scrypt, with a random salt per password: "scrypt$<salt>$<hash>" */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}
const DUMMY = hashPassword('not-a-real-password');
function verifyPassword(pw, stored) {
  const [alg, s, h] = String(stored || DUMMY).split('$');
  if (alg !== 'scrypt') return false;
  const expect = Buffer.from(h, 'base64');
  const got = crypto.scryptSync(String(pw), Buffer.from(s, 'base64'), expect.length);
  return crypto.timingSafeEqual(got, expect);
}

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

function createSession(db, userId) {
  const tok = crypto.randomBytes(32).toString('base64url');
  db.run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
  db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)', sha(tok), userId, Date.now() + SESSION_MS);
  return tok;
}
function userForSession(db, tok) {
  if (!tok) return null;
  return db.get(`SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id
                 WHERE s.token_hash = ? AND s.expires_at > ?`, sha(tok), Date.now());
}
function destroySession(db, tok) { if (tok) db.run('DELETE FROM sessions WHERE token_hash = ?', sha(tok)); }

/* sliding-window limiter kept in memory: fine for one server process */
function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); fail('Too many attempts. Wait a few minutes and try again.', 429); }
    arr.push(now); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  };
}

/* counts only failures and forgets them after a success, so a person who knows their password is never locked out by their own logins */
function failureLimiter(max, windowMs) {
  const hits = new Map();
  const recent = (key, now) => (hits.get(key) || []).filter((t) => now - t < windowMs);
  return {
    check(key) { if (recent(key, Date.now()).length >= max) fail('Too many attempts. Wait a few minutes and try again.', 429); },
    record(key) {
      const now = Date.now(); const arr = recent(key, now); arr.push(now); hits.set(key, arr);
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    },
    clear(key) { hits.delete(key); },
  };
}

module.exports = { failureLimiter, hashPassword, verifyPassword, createSession, userForSession, destroySession, limiter, SESSION_MS };
