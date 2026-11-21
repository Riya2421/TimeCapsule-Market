'use strict';
const crypto = require('node:crypto');

class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (msg, status = 400) => { throw new HttpError(msg, status); };

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return isoDate(d); };
const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / DAY);
const validDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isoDate(parseIso(s)) === s;
const token = () => crypto.randomBytes(12).toString('base64url');
const txnRef = (p = 'rzp_test_') => p + crypto.randomBytes(5).toString('hex');
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const posInt = (v, label = 'quantity', max = 50) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > max) fail(`Enter a valid ${label}.`);
  return n;
};

module.exports = { HttpError, fail, DAY, isoDate, parseIso, addDays, daysBetween, validDate, token, txnRef, str, posInt };
