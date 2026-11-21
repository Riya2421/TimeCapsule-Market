'use strict';
/* Contract test: the front end was built against the localStorage mock (assets/js/api.js). This runs the same calls against the mock and
   against the real server (through the real browser client, assets/js/api-remote.js) and compares the SHAPE of every answer:
   same keys, same value types. If the backend drifts from what the pages expect, this fails. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../src/server');

const JS = path.join(__dirname, '..', '..', 'assets', 'js');
let app, mock, remote;

before(async () => {
  app = createApp({ dbFile: ':memory:', demo: true, rateLimit: 100000 });
  const a = await app.listen(0);
  const base = `http://127.0.0.1:${a.port}`;

  // the mock, exactly as a browser would load it
  const store = {};
  const mw = { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } };
  mw.window = mw; vm.createContext(mw);
  ['data.js', 'api.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), mw, { filename: f }));
  mock = mw.TC.api;

  // the real client, with fetch pointed at the test server and a cookie jar
  let cookie = '';
  const rw = {
    TC_BACKEND: true, URLSearchParams, encodeURIComponent, JSON, Promise, Object, Array, Number, String, Error, Date, console,
    fetch: async (url, opts = {}) => {
      const h = Object.assign({}, opts.headers); if (cookie) h.cookie = cookie;
      const res = await fetch(base + url, Object.assign({}, opts, { headers: h }));
      const sc = res.headers.getSetCookie(); if (sc.length) { const v = sc[sc.length - 1].split(';')[0]; cookie = v.endsWith('=') ? '' : v; }
      return res;
    },
  };
  rw.window = rw; rw.TC = {}; vm.createContext(rw);
  vm.runInContext(fs.readFileSync(path.join(JS, 'api-remote.js'), 'utf8'), rw, { filename: 'api-remote.js' });
  remote = rw.TC.api;
  assert.ok(remote && remote.isRemote, 'api-remote.js did not install itself');
  await remote.boot(); await mock.boot();
});
after(async () => { await app.close(); });

/* shape of a value: objects -> {key: shape}, arrays -> [merged shape of first items], scalars -> type name. null is compatible with anything. */
function shape(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return [v.slice(0, 6).map(shape).reduce(merge, null)];
  if (typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape(v[k])]));
  return typeof v;
}
function merge(a, b) {
  if (a === null) return b; if (b === null) return a;
  if (Array.isArray(a) && Array.isArray(b)) return [merge(a[0], b[0])];
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const out = {}; new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => { out[k] = merge(a[k] === undefined ? null : a[k], b[k] === undefined ? null : b[k]); }); return out;
  }
  return a;
}
function diff(a, b, at = '') {
  if (a === null || b === null) return [];
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) ? diff(a[0] === undefined ? null : a[0], b[0] === undefined ? null : b[0], at + '[]') : [`${at}: array vs ${typeof (Array.isArray(a) ? b : a)}`];
  if (typeof a === 'object' && typeof b === 'object') {
    const out = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) out.push(`${at}.${k}: only on the server`); else if (!(k in b)) out.push(`${at}.${k}: only in the mock`); else out.push(...diff(a[k], b[k], at + '.' + k));
    }
    return out;
  }
  return a === b ? [] : [`${at}: mock ${a} vs server ${b}`];
}
/* intentional differences made while hardening the backend */
const OK = [/\.(password|password_hash)\b/];

async function same(label, fn) {
  const m = await fn(mock), r = await fn(remote);
  const d = diff(shape(m), shape(r), label).filter((x) => !OK.some((re) => re.test(x)));
  assert.deepEqual(d, [], `${label} differs:\n  ` + d.join('\n  '));
}

test('public catalogue and quiz answers have the same shape', async () => {
  await same('occasions', (a) => a.occasions());
  await same('occasion', (a) => a.occasion('new-home'));
  await same('collections', (a) => a.collections());
  await same('collections(filtered)', (a) => a.collections({ occasion_id: 1, maxBudget: 3000 }));
  await same('collection', (a) => a.collection(1));
  await same('products', (a) => a.products());
  await same('products(q)', (a) => a.products({ q: 'tea' }));
  await same('product', (a) => a.product(1));
  await same('quiz', (a) => a.quiz());
  await same('score', (a) => a.score({ tags: ['tea', 'cozy'], occasion_id: 1, budget: 2500 }));
  await same('suggest', (a) => a.suggest({ tags: ['tea', 'cozy'], occasion_id: 1, budget: 2500 }));
  await same('publicGroup', (a) => a.publicGroup('kabirgroup2026'));
  await same('recipientView(active)', (a) => a.recipientView('demoaanya0001'));
  await same('recipientView(completed)', (a) => a.recipientView('demomeera0003'));
});

test('customer answers have the same shape', async () => {
  for (const a of [mock, remote]) await a.login('demo@timecapsule.in', 'demo123');
  await same('me', (a) => a.me());
  await same('recipients', (a) => a.recipients());
  await same('capsules', (a) => a.capsules());
  await same('capsule(1)', (a) => a.capsule(1));
  await same('capsule(2)', (a) => a.capsule(2));
  await same('capsule(3)', (a) => a.capsule(3));
  await same('group', (a) => a.group(2));
  await same('timeline', (a) => a.timeline());
  await same('wishlist', (a) => a.wishlist());
  await same('orders', (a) => a.orders());
  await same('order', (a) => a.order(1));
  await same('mailbox', (a) => a.mailbox());
  await same('cart(empty)', (a) => a.cart());
});

test('builder, cart and checkout answers have the same shape', async () => {
  await same('newCapsule', (a) => a.newCapsule({ occasion_id: 1, recipient_id: 1, title: 'Shape test' }));
  await same('buildFromQuiz', (a) => a.buildFromQuiz({ tags: ['tea', 'cozy'], occasion_id: 1, budget: 2500 }, { recipient_id: 1 }));
  await same('capsuleFromCollection', (a) => a.capsuleFromCollection(2));
  for (const a of [mock, remote]) {
    const caps = await a.capsules(); const c = caps.find((x) => x.status === 'draft');
    a._draft = c.id;
  }
  await same('addItem', (a) => a.addItem(a._draft, 1, 4, 1));
  await same('updateStage', (a) => a.updateStage(a._draft, 1, { message: 'hello' }));
  await same('addStage', (a) => a.addStage(a._draft));
  await same('addProductToCart', (a) => a.addProductToCart(3, 2, 1));
  await same('addCapsuleToCart', (a) => a.addCapsuleToCart(a._draft).catch((e) => ({ error: true })));
  await same('placeOrder', async (a) => (await a.placeOrder({ mode: 'upi', address: '12 Test Street, New Delhi 110001', name: 'Aarav' })).map((o) => ({ id: o.id, total: o.total, capsule_id: o.capsule_id, txn_ref: o.txn_ref })));
});

test('admin answers have the same shape', async () => {
  for (const a of [mock, remote]) await a.login('admin@timecapsule.in', 'admin123');
  await same('adminStats', (a) => a.adminStats());
  await same('adminProducts', (a) => a.adminProducts());
  await same('adminVendors', (a) => a.adminVendors());
  await same('adminCollections', (a) => a.adminCollections());
  await same('adminOrders', (a) => a.adminOrders());
  await same('adminCapsules', (a) => a.adminCapsules());
});

test('errors reach the page as Error objects with the server message', async () => {
  const anon = remote; await anon.logout();
  await assert.rejects(() => anon.capsules(), /log in/i);
  await assert.rejects(() => anon.login('demo@timecapsule.in', 'wrong'), /do not match/);
});

test('every function the pages call on the mock exists on the remote client', () => {
  const internal = ['totalsOf']; // a mock-only helper that no page calls
  const missing = Object.keys(mock).filter((k) => typeof mock[k] === 'function' && !internal.includes(k) && typeof remote[k] !== 'function');
  assert.deepEqual(missing, []);
});
