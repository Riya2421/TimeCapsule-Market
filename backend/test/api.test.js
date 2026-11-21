'use strict';
/* Run with:  npm test   (inside backend/)    Each test file starts its own server on a random port with an in-memory database. */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.REGISTER_LIMIT = '100000'; // the per-IP signup cap would otherwise stop this suite
const { createApp } = require('../src/server');

let app, base;
before(async () => { app = createApp({ dbFile: ':memory:', demo: true, rateLimit: 100000 }); const a = await app.listen(0); base = `http://127.0.0.1:${a.port}`; });
after(async () => { await app.close(); });

/* tiny client with a cookie jar */
function client() {
  let cookie = '';
  const c = {
    async req(method, path, body, headers = {}) {
      const h = Object.assign({ 'X-TC-Client': '1' }, headers);
      if (cookie) h.cookie = cookie;
      if (body !== undefined) h['Content-Type'] = 'application/json';
      const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = res.headers.getSetCookie();
      if (sc.length) { const v = sc[sc.length - 1].split(';')[0]; cookie = v.endsWith('=') ? '' : v; }
      let data = null; try { data = await res.json(); } catch (e) { /* no body */ }
      return { status: res.status, data, headers: res.headers };
    },
    get: (p) => c.req('GET', p), post: (p, b) => c.req('POST', p, b === undefined ? {} : b), put: (p, b) => c.req('PUT', p, b), patch: (p, b) => c.req('PATCH', p, b), del: (p) => c.req('DELETE', p),
    login: async (email, password) => { const r = await c.post('/api/auth/login', { email, password }); assert.equal(r.status, 200, 'login failed: ' + JSON.stringify(r.data)); return r.data; },
  };
  return c;
}
const demoUser = async () => { const c = client(); await c.login('demo@timecapsule.in', 'demo123'); return c; };
const admin = async () => { const c = client(); await c.login('admin@timecapsule.in', 'admin123'); return c; };
let n = 0;
async function newUser(tag = 'u') { const c = client(); const email = `${tag}${++n}_${Date.now()}@example.com`; const r = await c.post('/api/auth/register', { name: 'Test ' + tag, email, password: 'secret12' }); assert.equal(r.status, 200, JSON.stringify(r.data)); c.email = email; return c; }
const addDays = (iso, d) => { const t = new Date(iso + 'T12:00:00'); t.setDate(t.getDate() + d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

describe('auth', () => {
  test('login sets an HttpOnly SameSite cookie and never exposes the password hash', async () => {
    const c = client();
    const r = await c.post('/api/auth/login', { email: 'demo@timecapsule.in', password: 'demo123' });
    assert.equal(r.status, 200);
    assert.match(r.headers.getSetCookie()[0], /tc_sid=.+; HttpOnly; SameSite=Lax/);
    assert.ok(!JSON.stringify(r.data).match(/hash|password|scrypt/i));
    const me = await c.get('/api/auth/me');
    assert.equal(me.data.email, 'demo@timecapsule.in');
    assert.ok(!JSON.stringify(me.data).match(/hash|password/i));
  });
  test('wrong password and unknown email give the same generic error', async () => {
    const a = await client().post('/api/auth/login', { email: 'demo@timecapsule.in', password: 'nope-nope' });
    const b = await client().post('/api/auth/login', { email: 'ghost@nowhere.com', password: 'nope-nope' });
    assert.equal(a.status, 401); assert.equal(b.status, 401);
    assert.equal(a.data.error, b.data.error);
  });
  test('logout invalidates the session on the server', async () => {
    const c = await demoUser();
    const old = c.req; let saved = '';
    const probe = await c.get('/api/capsules'); assert.equal(probe.status, 200);
    await c.post('/api/auth/logout');
    assert.equal((await c.get('/api/capsules')).status, 401);
  });
  test('registration validates input and refuses duplicate emails', async () => {
    const c = client();
    assert.equal((await c.post('/api/auth/register', { name: '', email: 'a@b.co', password: 'secret12' })).status, 400);
    assert.equal((await c.post('/api/auth/register', { name: 'X', email: 'not-an-email', password: 'secret12' })).status, 400);
    assert.equal((await c.post('/api/auth/register', { name: 'X', email: 'x@y.co', password: '123' })).status, 400);
    const ok = await newUser('dup');
    const again = await client().post('/api/auth/register', { name: 'Y', email: ok.email, password: 'secret12' });
    assert.equal(again.status, 409);
    assert.equal(again.data.error.includes('already exists'), true);
  });
  test('registering can never create an admin', async () => {
    const c = client();
    const r = await c.post('/api/auth/register', { name: 'Sneaky', email: `s${Date.now()}@example.com`, password: 'secret12', role: 'admin' });
    assert.equal(r.data.role, 'customer');
    assert.equal((await c.get('/api/admin/stats')).status, 403);
  });
  test('passwords are stored as scrypt hashes, not plain text', async () => {
    const row = app.db.get("SELECT password_hash FROM users WHERE email = 'demo@timecapsule.in'");
    assert.ok(!row.password_hash.includes('demo123'));
    assert.match(row.password_hash, /^scrypt\$/);
  });
  test('repeated failed logins are rate limited', async () => {
    const c = client(); let last;
    for (let i = 0; i < 12; i++) last = await c.post('/api/auth/login', { email: 'ratelimit@example.com', password: 'wrong-pass' });
    assert.equal(last.status, 429);
  });
});

describe('request safety', () => {
  test('state-changing requests need the custom header (CSRF guard)', async () => {
    const res = await fetch(base + '/api/auth/logout', { method: 'POST' });
    assert.equal(res.status, 403);
  });
  test('a foreign Origin is refused', async () => {
    const c = client();
    const r = await c.req('POST', '/api/auth/logout', {}, { Origin: 'https://evil.example' });
    assert.equal(r.status, 403);
  });
  test('malformed and oversized bodies are rejected cleanly', async () => {
    const c = client();
    const bad = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'X-TC-Client': '1', 'Content-Type': 'application/json' }, body: '{nope' });
    assert.equal(bad.status, 400);
    const big = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'X-TC-Client': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a'.repeat(300000) }) }).catch(() => ({ status: 413 }));
    assert.ok([413, 400].includes(big.status));
    const arr = await c.post('/api/auth/login', [1, 2]);
    assert.equal(arr.status, 400);
  });
  test('unknown routes 404, wrong methods 405, and errors never leak internals', async () => {
    const c = client();
    assert.equal((await c.get('/api/nothing')).status, 404);
    assert.equal((await c.del('/api/occasions')).status, 405);
    const r = await c.get('/api/products/abc');
    assert.ok(!JSON.stringify(r.data).match(/sqlite|SELECT|stack|node:/i));
  });
  test('static server only serves the front end, never backend files or the database', async () => {
    for (const p of ['/backend/src/server.js', '/backend/data/timecapsule.db', '/backend/seed/seed.json', '/%2e%2e/backend/package.json', '/assets/../backend/package.json', '/assets/%2e%2e/backend/package.json', '/.git/config', '/README.md']) {
      const res = await fetch(base + p); assert.equal(res.status, 404, p);
    }
    const ok = await fetch(base + '/index.html'); assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
  });
  test('SQL injection strings are treated as plain text', async () => {
    const c = client();
    const q = await c.get('/api/products?q=' + encodeURIComponent("' OR 1=1 --"));
    assert.equal(q.status, 200); assert.equal(q.data.length, 0);
    const t = await c.get('/api/products?tag=' + encodeURIComponent("tea' UNION SELECT password_hash FROM users --"));
    assert.equal(t.status, 200); assert.equal(t.data.length, 0);
    const l = await c.post('/api/auth/login', { email: "' OR '1'='1", password: "' OR '1'='1" });
    assert.equal(l.status, 401);
    const u = await newUser('inj');
    const r = await u.post('/api/recipients', { name: "Robert'); DROP TABLE users;--", address: 'x' });
    assert.equal(r.data.name, "Robert'); DROP TABLE users;--");
    assert.equal((await client().get('/api/occasions')).data.length, 8);
  });
});

describe('catalogue and recommendation score', () => {
  test('occasions, collections, products have the shapes the front end expects', async () => {
    const c = client();
    const col = (await c.get('/api/collections')).data;
    assert.equal(col.length, 13);
    assert.deepEqual(Object.keys(col[0]).sort(), ['blurb', 'id', 'occasion', 'occasion_id', 'productIds', 'products', 'title', 'total']);
    const p = (await c.get('/api/products/1')).data;
    assert.ok(p.vendor && Array.isArray(p.tags) && Array.isArray(p.similar) && Array.isArray(p.collections));
    assert.equal((await c.get('/api/collections?maxBudget=1500')).data.every((x) => x.total <= 1500), true);
  });
  test('score = 3T + 2O + B (worked example from the report)', async () => {
    const c = client();
    const r = await c.post('/api/quiz/score', { tags: ['tea', 'cozy'], occasion_id: 1, budget: 2500 });
    const by = Object.fromEntries(r.data.map((x) => [x.product.name, x]));
    assert.deepEqual([by['Ceramic tea mug set'].T, by['Ceramic tea mug set'].O, by['Ceramic tea mug set'].B, by['Ceramic tea mug set'].score], [2, 1, 1, 9]);
    assert.equal(by['Herbal tea sampler'].score, 7);
    const scores = r.data.map((x) => x.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  });
  test('suggested bundle never exceeds the budget and has at most 6 items', async () => {
    const c = client();
    for (const budget of [500, 1200, 2500, 6000]) {
      const r = await c.post('/api/quiz/suggest', { tags: ['tea', 'cozy', 'books'], occasion_id: 1, budget });
      assert.ok(r.data.sum <= budget, `budget ${budget} sum ${r.data.sum}`);
      assert.ok(r.data.picked.length <= 6);
    }
  });
  test('garbage quiz answers do not crash scoring', async () => {
    const c = client();
    const r = await c.post('/api/quiz/score', { tags: 'x', occasion_id: 'abc', budget: -5 });
    assert.equal(r.status, 200);
  });
});

describe('ownership and roles', () => {
  test('anonymous users cannot reach private routes', async () => {
    const c = client();
    for (const p of ['/api/capsules', '/api/cart', '/api/orders', '/api/recipients', '/api/timeline', '/api/mailbox', '/api/wishlist']) assert.equal((await c.get(p)).status, 401, p);
  });
  test('customers cannot reach admin routes; admins can', async () => {
    const u = await demoUser();
    for (const p of ['/api/admin/stats', '/api/admin/products', '/api/admin/orders', '/api/admin/capsules']) assert.equal((await u.get(p)).status, 403, p);
    assert.equal((await u.post('/api/admin/products', { name: 'x', price: 10 })).status, 403);
    const a = await admin();
    assert.equal((await a.get('/api/admin/stats')).status, 200);
  });
  test("one customer cannot read, change, fund or delete another customer's capsule", async () => {
    const other = await newUser('intruder');
    assert.equal((await other.get('/api/capsules/1')).status, 404);
    assert.equal((await other.patch('/api/capsules/1', { title: 'hacked' })).status, 404);
    assert.equal((await other.post('/api/capsules/1/stages')).status, 404);
    assert.equal((await other.del('/api/capsules/1')).status, 404);
    assert.equal((await other.post('/api/cart/capsules', { id: 1 })).status, 404);
    assert.equal((await other.get('/api/orders/1')).status, 404);
    assert.equal((await other.get('/api/capsules/2/group')).status, 404);
    assert.equal((await other.del('/api/recipients/1')).status, 200); // idempotent no-op...
    assert.equal((await (await demoUser()).get('/api/recipients')).data.length >= 3, true); // ...and it deleted nothing
    const mine = (await other.get('/api/capsules')).data;
    assert.equal(mine.length, 0);
  });
  test('an admin-only status change is rejected for customers', async () => {
    const u = await demoUser();
    assert.equal((await u.patch('/api/admin/orders/1/status', { status: 'delivered' })).status, 403);
  });
});

describe('capsule builder, cart and checkout', () => {
  async function draftWithItem(c, recipientId, pid = 1) {
    const cap = (await c.post('/api/capsules', { occasion_id: 1, recipient_id: recipientId, title: 'Test capsule' })).data;
    const r = await c.post(`/api/capsules/${cap.id}/stages/1/items`, { productId: pid, qty: 1 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data;
  }
  test('totals follow items + gift wrap + stage handling', async () => {
    const c = await demoUser();
    const cap = await draftWithItem(c, 1);
    const price = (await c.get('/api/products/1')).data.price;
    assert.equal(cap.totals.items, price);
    assert.equal(cap.totals.fee, 29);
    assert.equal(cap.totals.wrap, 0);
    const wrapped = (await c.patch(`/api/capsules/${cap.id}`, { gift_wrap: true })).data;
    assert.equal(wrapped.totals.wrap, 49);
    assert.equal(wrapped.totals.total, price + 49 + 29);
    const two = (await c.post(`/api/capsules/${cap.id}/stages`)).data;
    assert.equal(two.stages.length, 2);
    assert.equal(two.totals.fee, 58);
  });
  test('stage limit, past dates and empty stages are refused', async () => {
    const c = await demoUser();
    const cap = await draftWithItem(c, 1);
    for (let i = 0; i < 4; i++) assert.equal((await c.post(`/api/capsules/${cap.id}/stages`)).status, 200);
    assert.equal((await c.post(`/api/capsules/${cap.id}/stages`)).status, 400); // max 5
    assert.equal((await c.patch(`/api/capsules/${cap.id}/stages/1`, { unlock_date: '2020-01-01' })).status, 400);
    assert.equal((await c.patch(`/api/capsules/${cap.id}/stages/1`, { unlock_date: 'not a date' })).status, 400);
    const add = await c.post('/api/cart/capsules', { id: cap.id });
    assert.equal(add.status, 400); // empty stages
  });
  test('checkout: declined card, COD blocked for capsules, success places the order and takes stock', async () => {
    const c = await demoUser();
    const cap = await draftWithItem(c, 1, 3);
    const before = (await c.get('/api/products/3')).data.stock;
    assert.equal((await c.post('/api/cart/capsules', { id: cap.id })).status, 200);
    assert.equal((await c.post('/api/orders', { mode: 'cod' })).status, 400);
    assert.equal((await c.post('/api/orders', { mode: 'card', cardNumber: '4000 0000 0000 0002' })).status, 400);
    assert.equal((await c.get('/api/cart')).data.lines.length, 1); // a failed payment keeps the cart
    const ok = await c.post('/api/orders', { mode: 'card', cardNumber: '4242 4242 4242 4242' });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.length, 1);
    assert.equal((await c.get('/api/cart')).data.lines.length, 0);
    assert.equal((await c.get('/api/products/3')).data.stock, before - 1);
    const order = (await c.get('/api/orders/' + ok.data[0].id)).data;
    assert.equal(order.deliveries.length, 1);
    assert.equal(order.payment.status, 'success');
    const placed = (await c.get('/api/capsules/' + cap.id)).data;
    assert.equal(placed.status, 'confirmed');
    assert.equal((await c.patch(`/api/capsules/${cap.id}`, { title: 'changed after payment' })).status, 400); // locked once paid
  });
  test('two buyers racing for the last unit: exactly one wins, stock never goes negative', async () => {
    const a = await admin();
    const prod = (await a.get('/api/admin/products')).data.find((p) => p.id === 5);
    const saved = await a.post('/api/admin/products', Object.assign({}, prod, { stock: 1 }));
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const u1 = await newUser('racer'), u2 = await newUser('racer');
    for (const u of [u1, u2]) assert.equal((await u.post('/api/cart/products', { productId: 5, qty: 1 })).status, 200);
    const body = { mode: 'upi', address: '12 Test Street, Delhi 110001', name: 'Racer' };
    const res = await Promise.all([u1.post('/api/orders', body), u2.post('/api/orders', body)]);
    assert.deepEqual(res.map((r) => r.status).sort(), [200, 400]);
    assert.equal(app.db.get('SELECT stock FROM products WHERE id = 5').stock, 0);
  });
  test('loose products need a delivery address; quantities are validated', async () => {
    const u = await newUser('loose');
    assert.equal((await u.post('/api/cart/products', { productId: 2, qty: 1 })).status, 200);
    assert.equal((await u.post('/api/orders', { mode: 'upi', address: 'short' })).status, 400);
    const line = (await u.get('/api/cart')).data.lines[0];
    assert.equal((await u.put('/api/cart/lines/' + line.idx, { qty: 'many' })).status, 400);
    assert.equal((await u.put('/api/cart/lines/' + line.idx, { qty: 9999 })).status, 400); // more than the stock
    assert.equal((await u.put('/api/cart/lines/' + line.idx, { qty: 2 })).data.lines[0].qty, 2);
    assert.equal((await u.put('/api/cart/lines/' + line.idx, { qty: 0 })).data.lines.length, 0); // zero removes the line
    assert.equal((await u.post('/api/cart/products', { productId: 2, qty: 1 })).status, 200);
    const mine = (await u.get('/api/cart')).data.lines[0].idx;
    assert.equal((await (await newUser('cartspy')).put('/api/cart/lines/' + mine, { qty: 3 })).status, 404); // cannot touch someone else's line
    assert.equal((await u.post('/api/cart/products', { productId: 999, qty: 1 })).status >= 400, true);
  });
});

describe('group funding', () => {
  async function groupCapsule(c, daysToDeadline = 3) {
    const t = (await c.get('/api/auth/me')) && (await fetch(base + '/api/bootstrap', { headers: { cookie: '' } }).then((r) => r.json())).today;
    const cap = (await c.post('/api/capsules', { occasion_id: 4, recipient_id: 1, title: 'Group test' })).data;
    await c.post(`/api/capsules/${cap.id}/stages/1/items`, { productId: 1, qty: 1 });
    await c.patch(`/api/capsules/${cap.id}/stages/1`, { unlock_date: addDays(t, 20) });
    await c.patch(`/api/capsules/${cap.id}`, { type: 'group' });
    const started = await c.post(`/api/capsules/${cap.id}/funding`, { deadline: addDays(t, daysToDeadline) });
    assert.equal(started.status, 200, JSON.stringify(started.data));
    return { cap: started.data, today: t };
  }
  test('rules: deadline before first unlock, money capped at what is still needed, min ₹10', async () => {
    const c = await demoUser();
    const t = (await fetch(base + '/api/bootstrap').then((r) => r.json())).today;
    const cap = (await c.post('/api/capsules', { occasion_id: 4, recipient_id: 1 })).data;
    await c.post(`/api/capsules/${cap.id}/stages/1/items`, { productId: 1, qty: 1 });
    await c.patch(`/api/capsules/${cap.id}`, { type: 'group' });
    assert.equal((await c.post(`/api/capsules/${cap.id}/funding`, { deadline: addDays(t, 5) })).status, 400); // first unlock is tomorrow
    const { cap: g } = await groupCapsule(c);
    const tok = g.share_token;
    assert.ok(tok && tok.length >= 8);
    const need = g.target_amount;
    const anon = client();
    assert.equal((await anon.post(`/api/public/groups/${tok}/contributions`, { name: 'Zed', amount: 5 })).status, 400);
    assert.equal((await anon.post(`/api/public/groups/${tok}/contributions`, { name: 'Zed', amount: need + 1 })).status, 400);
    assert.equal((await anon.post(`/api/public/groups/${tok}/contributions`, { name: '', amount: 50 })).status, 400);
    assert.equal((await anon.post(`/api/public/groups/${tok}/contributions`, { name: 'Zed', amount: 10.5 })).status, 400);
    const pub = (await anon.get('/api/public/groups/' + tok)).data;
    assert.equal(pub.raised, 0);
    assert.ok(!JSON.stringify(pub).match(/email|address|recipient_token/));
  });
  test('reaching the target auto-creates a paid group order exactly once', async () => {
    const c = await demoUser();
    const { cap } = await groupCapsule(c);
    const anon = client();
    const half = Math.floor(cap.target_amount / 2);
    const r1 = await anon.post(`/api/public/groups/${cap.share_token}/contributions`, { name: 'A', amount: half, message: 'Congrats!' });
    assert.equal(r1.data.confirmed, false);
    const r2 = await anon.post(`/api/public/groups/${cap.share_token}/contributions`, { name: 'B', amount: cap.target_amount - half });
    assert.equal(r2.data.confirmed, true);
    const after = (await c.get('/api/capsules/' + cap.id)).data;
    assert.equal(after.status, 'confirmed');
    const orders = (await c.get('/api/orders')).data.filter((o) => o.capsule_id === cap.id);
    assert.equal(orders.length, 1);
    assert.equal(orders[0].payment.mode, 'group');
    assert.equal((await anon.post(`/api/public/groups/${cap.share_token}/contributions`, { name: 'C', amount: 50 })).status, 400); // closed
  });
  test('a friend can add a gift instead of money: the target rises by its price', async () => {
    const c = await demoUser();
    const { cap } = await groupCapsule(c);
    const anon = client();
    const p = (await anon.get('/api/products/2')).data;
    const r = await anon.post(`/api/public/groups/${cap.share_token}/contributions`, { name: 'Gifter', product_id: 2 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.target, cap.target_amount + p.price);
    assert.equal(r.data.raised, p.price);
  });
  test('missing the deadline cancels the capsule and refunds contributions', async () => {
    const c = await demoUser();
    const { cap } = await groupCapsule(c, 2);
    const anon = client();
    await anon.post(`/api/public/groups/${cap.share_token}/contributions`, { name: 'Early', amount: 100 });
    const adv = await anon.post('/api/demo/advance', { days: 3 });
    assert.equal(adv.status, 200);
    const after = (await c.get('/api/capsules/' + cap.id)).data;
    assert.equal(after.status, 'cancelled');
    const g = (await anon.get('/api/public/groups/' + cap.share_token)).data;
    assert.equal(g.raised, 0);
    assert.equal(app.db.get('SELECT refunded FROM contributions WHERE capsule_id = ? LIMIT 1', cap.id).refunded, 1);
    assert.equal((await anon.post(`/api/public/groups/${cap.share_token}/contributions`, { name: 'Late', amount: 50 })).status, 400);
  });
  test('share tokens cannot be guessed or enumerated', async () => {
    const anon = client();
    for (const t of ['1', '2', 'abc', 'kabirgroup2025', "' OR 1=1 --", 'a'.repeat(200)]) assert.equal((await anon.get('/api/public/groups/' + encodeURIComponent(t))).data, null, t);
    assert.equal((await anon.get('/api/public/recipient/1')).data, null);
  });
});

describe('scheduler, recipient view and memory timeline', () => {
  test('stages unlock on their date, emails are queued, capsule completes, a reminder follows a year later', async () => {
    const c = await demoUser();
    const t0 = (await fetch(base + '/api/bootstrap').then((r) => r.json())).today;
    const rcp = (await c.post('/api/recipients', { name: 'Sched Friend', email: 'sched@example.com', address: '9 Lane, Delhi 110001' })).data;
    const cap = (await c.post('/api/capsules', { occasion_id: 2, recipient_id: rcp.id, title: 'Scheduler capsule' })).data;
    await c.post(`/api/capsules/${cap.id}/stages/1/items`, { productId: 6, qty: 1 });
    await c.post(`/api/capsules/${cap.id}/stages`);
    await c.post(`/api/capsules/${cap.id}/stages/2/items`, { productId: 7, qty: 1 });
    await c.patch(`/api/capsules/${cap.id}/stages/2`, { unlock_date: addDays(t0, 10) });
    await c.post('/api/cart/capsules', { id: cap.id });
    const paid = await c.post('/api/orders', { mode: 'upi' });
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    const tok = (await c.get('/api/capsules/' + cap.id)).data.recipient_token;
    const anon = client();
    let v = (await anon.get('/api/public/recipient/' + tok)).data;
    assert.deepEqual(v.stages.map((s) => s.status), ['locked', 'locked']);
    assert.ok(v.stages.every((s) => s.items.length === 0 && s.message === '')); // locked stages reveal nothing
    const adv1 = await c.post('/api/demo/advance', { days: 1 });
    assert.ok(adv1.data.events.some((e) => e.type === 'unlock' && e.capsule_id === cap.id));
    v = (await anon.get('/api/public/recipient/' + tok)).data;
    assert.deepEqual(v.stages.map((s) => s.status), ['unlocked', 'locked']);
    assert.ok(v.stages[0].items.length > 0);
    assert.ok(v.stages[1].items.length === 0);
    const mail = (await c.get('/api/mailbox')).data;
    assert.ok(mail.some((m) => m.kind === 'unlock' && m.subject.includes('Scheduler capsule')));
    await c.post('/api/demo/advance', { days: 9 }); // day 10: stage 2 unlocks
    assert.equal((await c.get('/api/capsules/' + cap.id)).data.status, 'active');
    await c.post('/api/demo/advance', { days: 3 }); // two days later both stages are delivered
    assert.equal((await c.get('/api/capsules/' + cap.id)).data.status, 'completed');
    const tl = (await c.get('/api/timeline')).data.find((x) => x.capsule.id === cap.id);
    assert.ok(tl.event && tl.event.reminder_date > t0);
    const adv = await c.post('/api/demo/advance', { days: 370 });
    assert.ok(adv.data.events.some((e) => e.type === 'reminder' && e.capsule_id === cap.id));
    assert.equal((await c.get('/api/orders/' + paid.data[0].id)).data.status, 'delivered');
    await c.post('/api/demo/reset-clock');
  });
  test('running the scheduler again changes nothing (idempotent)', async () => {
    const before = JSON.stringify(app.db.all('SELECT id, status FROM capsules ORDER BY id'));
    const c = client();
    await c.get('/api/bootstrap'); await c.get('/api/bootstrap');
    assert.equal(JSON.stringify(app.db.all('SELECT id, status FROM capsules ORDER BY id')), before);
  });
  test("a recipient's thank-you reaches the sender, friends' notes stay sealed until the first stage opens", async () => {
    const anon = client();
    const v = (await anon.get('/api/public/recipient/demokabir0002')).data; // funding capsule is not visible at all
    assert.equal(v, null);
    const ok = await anon.post('/api/public/recipient/demoaanya0001/thank-you', { text: 'Loved it!' });
    assert.equal(ok.status, 200);
    assert.equal((await anon.post('/api/public/recipient/demoaanya0001/thank-you', { text: '   ' })).status, 400);
    assert.equal((await anon.post('/api/public/recipient/zzzzzzzzzz/thank-you', { text: 'hi' })).status, 404);
  });
  test('repeat and upgrade create a fresh draft starting tomorrow', async () => {
    const c = await demoUser();
    const again = (await c.post('/api/capsules/3/repeat', { mode: 'upgrade' })).data;
    assert.equal(again.status, 'draft');
    const t = (await fetch(base + '/api/bootstrap').then((r) => r.json())).today;
    assert.equal(again.stages[0].unlock_date, addDays(t, 1));
    assert.equal(again.budget, (await c.get('/api/capsules/3')).data.budget + 500);
  });
});

describe('admin', () => {
  test('product validation, soft delete keeps order history, stats include revenue', async () => {
    const a = await admin();
    assert.equal((await a.post('/api/admin/products', { name: '', price: 10, stock: 1, vendor_id: 1 })).status, 400);
    assert.equal((await a.post('/api/admin/products', { name: 'Bad', price: -5, stock: 1, vendor_id: 1 })).status, 400);
    const made = await a.post('/api/admin/products', { name: 'Test lantern', price: 349, stock: 12, vendor_id: 1, emoji: '🏮', tint: '#ffe9c2', tags: ['cozy', 'light'], blurb: 'A test product.' });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    const lantern = (await client().get('/api/products')).data.find((p) => p.name === 'Test lantern');
    assert.ok(lantern && lantern.tags.join() === 'cozy,light');
    assert.equal((await a.del('/api/admin/products/' + lantern.id)).status, 200);
    assert.ok(!(await client().get('/api/products')).data.some((p) => p.name === 'Test lantern'));
    const s = (await a.get('/api/admin/stats')).data;
    assert.ok(s.days.length === 14 && s.top.length > 0);
    const orders = (await a.get('/api/admin/orders')).data;
    assert.ok(orders.length >= 28);
    assert.equal((await a.patch('/api/admin/orders/' + orders[0].id + '/status', { status: 'teleported' })).status, 400);
  });
});

describe('demo controls', () => {
  test('reset restores the seed data and the clock', async () => {
    const c = client();
    await c.post('/api/demo/advance', { days: 5 });
    assert.equal((await c.post('/api/demo/reset')).status, 200);
    const b = (await c.get('/api/bootstrap')).data;
    assert.equal(b.clock_offset, 0);
    assert.equal((await client().get('/api/products')).data.length, 40);
    const u = await demoUser();
    assert.equal((await u.get('/api/capsules')).data.length, 3);
  });
  test('demo endpoints validate input and can be switched off', async () => {
    const c = client();
    assert.equal((await c.post('/api/demo/advance', { days: 'x' })).status, 400);
    assert.equal((await c.post('/api/demo/advance', { days: 100000 })).status, 400);
    const off = createApp({ dbFile: ':memory:', demo: false });
    const a = await off.listen(0);
    const r = await fetch(`http://127.0.0.1:${a.port}/api/demo/reset`, { method: 'POST', headers: { 'X-TC-Client': '1' } });
    assert.equal(r.status, 403);
    await off.close();
  });
});
