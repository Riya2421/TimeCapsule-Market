'use strict';
/* HTTP layer: a small router on node:http (no framework needed for ~65 endpoints), cookie sessions, CSRF guard,
   rate limiting, security headers, and a static file server for the front end. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const dbm = require('./db');
const seed = require('./seed');
const auth = require('./auth');
const core = require('./core');
const { HttpError, fail } = require('./util');
const { runScheduler } = require('./scheduler');
const { ROUTES } = require('../../assets/js/api-remote.js');

const svc = Object.assign({}, require('./catalog'), require('./account'), require('./capsules'), require('./orders'), require('./admin'));
ROUTES.forEach((r) => { if (typeof svc[r.name] !== 'function') throw new Error(`routes.js lists "${r.name}" but no service implements it`); });

const FRONT = path.resolve(dbm.ROOT, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const MAX_BODY = 200 * 1024;

/* ---------- route table -> matcher ---------- */
const compiled = ROUTES.map((r) => {
  const segs = r.path.split('/').filter(Boolean);
  return { r, segs, literals: segs.filter((s) => s[0] !== ':').length };
}).sort((a, b) => b.literals - a.literals); // literal paths win over :params (e.g. /capsules/from-quiz vs /capsules/:id)

function match(method, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  let pathExists = false;
  for (const c of compiled) {
    if (c.segs.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (c.segs[i][0] === ':') { try { params[c.segs[i].slice(1)] = decodeURIComponent(parts[i]); } catch (e) { ok = false; break; } }
      else if (c.segs[i] !== parts[i]) { ok = false; break; }
    }
    if (!ok) continue;
    pathExists = true;
    if (c.r.method === method) return { route: c.r, params };
  }
  return pathExists ? 'method' : null;
}

const parseCookies = (h) => Object.fromEntries(String(h || '').split(';').map((p) => p.trim()).filter(Boolean).map((p) => { const i = p.indexOf('='); return [p.slice(0, i), p.slice(i + 1)]; }));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError('That request is too large.', 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function createApp(opts = {}) {
  const db = dbm.open(opts.dbFile);
  if (!db.hasSchema()) seed.init(db);
  const demo = opts.demo !== undefined ? !!opts.demo : process.env.DEMO !== '0';
  const secureCookie = opts.secureCookie !== undefined ? opts.secureCookie : process.env.COOKIE_SECURE === '1';
  const trustProxy = process.env.TRUST_PROXY === '1';
  const apiLimit = auth.limiter(opts.rateLimit || 900, 60 * 1000);

  const baseHeaders = {
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  function send(res, status, body, headers) {
    const h = Object.assign({}, baseHeaders, headers);
    res.writeHead(status, h);
    res.end(body);
  }
  function json(res, status, data, extra) {
    send(res, status, JSON.stringify(data === undefined ? null : data), Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra));
  }

  /* ---------- request context ---------- */
  function makeCtx(req, res) {
    const cookies = parseCookies(req.headers.cookie);
    const tok = cookies.tc_sid || '';
    const setCookies = [];
    const cookie = (v, maxAge) => `tc_sid=${v}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`;
    const ctx = {
      db,
      ip: (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown',
      user: auth.userForSession(db, tok),
      setCookies,
      startSession(userId) {
        auth.destroySession(db, tok); // a new session id on every login stops session fixation
        setCookies.push(cookie(auth.createSession(db, userId), Math.floor(auth.SESSION_MS / 1000)));
      },
      endSession() { auth.destroySession(db, tok); setCookies.push(cookie('', 0)); },
    };
    return ctx;
  }
  const reply = (res, ctx, data, status = 200) => json(res, status, data, ctx.setCookies.length ? { 'Set-Cookie': ctx.setCookies } : undefined);

  /* events from the scheduler are returned only to the person they belong to */
  const mine = (events, ctx) => (ctx.user ? events.filter((e) => e.owner_id === ctx.user.id).map(({ owner_id, ...rest }) => rest) : []);

  /* ---------- /api ---------- */
  async function api(req, res, url) {
    const method = req.method;
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return json(res, 405, { error: 'Method not allowed.' });

    // CSRF: browsers cannot add a custom header cross-site without a CORS preflight, which this server never approves
    if (method !== 'GET' && method !== 'HEAD') {
      if (req.headers['x-tc-client'] !== '1') return json(res, 403, { error: 'Request blocked.' });
      const origin = req.headers.origin;
      if (origin && (() => { try { return new URL(origin).host !== req.headers.host; } catch (e) { return true; } })()) return json(res, 403, { error: 'Request blocked.' });
    }
    const ctx = makeCtx(req, res);
    apiLimit(ctx.ip);

    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (pathname === '/api/health' && method === 'GET') return json(res, 200, { ok: true });

    if (pathname === '/api/bootstrap' && method === 'GET') {
      const events = mine(runScheduler(db), ctx);
      const u = ctx.user;
      return reply(res, ctx, {
        user: core.safeUser(u), today: core.today(db), clock_offset: core.clockOffset(db), demo,
        cart_count: u ? svc.cartCount(db, u.id) : 0, wishlist_ids: svc.wishlistIds(db, u && u.id), events,
      });
    }

    if (pathname.startsWith('/api/demo/') && method === 'POST') {
      if (!demo) return json(res, 403, { error: 'Demo controls are switched off on this server.' });
      let body = {};
      const raw = await readBody(req);
      if (raw) { try { body = JSON.parse(raw); } catch (e) { fail('Send valid JSON.'); } }
      if (pathname === '/api/demo/advance') {
        const n = Number(body.days);
        if (!Number.isInteger(n) || n < 1 || n > 800) fail('Choose between 1 and 800 days.');
        core.setClockOffset(db, core.clockOffset(db) + n);
        const events = mine(runScheduler(db), ctx);
        return reply(res, ctx, { clock_offset: core.clockOffset(db), events });
      }
      if (pathname === '/api/demo/reset-clock') { core.setClockOffset(db, 0); return reply(res, ctx, { clock_offset: 0 }); }
      if (pathname === '/api/demo/reset') { seed.reset(db); return reply(res, ctx, { ok: true }); }
      return json(res, 404, { error: 'Not found.' });
    }

    const m = match(method === 'HEAD' ? 'GET' : method, pathname);
    if (!m) return json(res, 404, { error: 'Not found.' });
    if (m === 'method') return json(res, 405, { error: 'Method not allowed.' });

    let body = {};
    if (method !== 'GET' && method !== 'HEAD') {
      const raw = await readBody(req);
      if (raw) {
        if (!/^application\/json/i.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'Send JSON.' });
        try { body = JSON.parse(raw); } catch (e) { fail('Send valid JSON.'); }
        if (body === null || typeof body !== 'object' || Array.isArray(body)) fail('Send a JSON object.');
      }
    }
    const query = Object.fromEntries(url.searchParams);
    const { route, params } = m;
    const src = method === 'GET' || method === 'HEAD' ? query : body;
    const argv = route.args.map((name) => {
      if (name === route.bodyArg) return src;
      return params[name] !== undefined ? params[name] : src[name];
    });
    const out = svc[route.name](ctx, ...argv);
    return reply(res, ctx, out);
  }

  /* ---------- static front end ---------- */
  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, 'Bad request'); }
    if (rel.includes('\0')) return send(res, 400, 'Bad request');
    if (rel === '/') rel = '/index.html';
    if (rel === '/assets/js/config.js') return send(res, 200, 'window.TC_BACKEND = true;\n', { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
    const clean = path.posix.normalize(rel).replace(/^\/+/, '');
    const abs = path.resolve(FRONT, clean);
    const insideFront = abs === FRONT || abs.startsWith(FRONT + path.sep);
    // only the page shells in the project root and the assets folder are public: never backend/, data, or dotfiles
    const allowed = /^[A-Za-z0-9_-]+\.html$/.test(clean) || /^assets\/[A-Za-z0-9_./-]+$/.test(clean);
    if (!insideFront || !allowed || clean.split('/').some((s) => s.startsWith('.') || s === '..')) return send(res, 404, 'Not found');
    const type = MIME[path.extname(abs).toLowerCase()];
    if (!type) return send(res, 404, 'Not found');
    fs.readFile(abs, (err, buf) => {
      if (err) return send(res, 404, 'Not found');
      const h = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
      if (type.startsWith('text/html')) h['Content-Security-Policy'] = CSP;
      send(res, 200, req.method === 'HEAD' ? undefined : buf, h);
    });
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const done = (e) => {
      if (res.headersSent) { res.end(); return; }
      if (e instanceof HttpError) return json(res, e.status, { error: e.message });
      if (e && /UNIQUE|constraint/i.test(String(e.message))) return json(res, 409, { error: 'That conflicts with something that already exists.' });
      console.error(`[${new Date().toISOString()}] ${req.method} ${url.pathname}`, e);
      json(res, 500, { error: 'Something went wrong on our side. Please try again.' });
    };
    try {
      if (url.pathname.startsWith('/api/') || url.pathname === '/api') Promise.resolve(api(req, res, url)).catch(done);
      else serveStatic(req, res, url);
    } catch (e) { done(e); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;

  /* the daily job: also runs on startup, on every bootstrap, and after the demo clock moves */
  runScheduler(db);
  const timer = setInterval(() => { try { runScheduler(db); } catch (e) { console.error('scheduler failed', e); } }, 10 * 60 * 1000);
  timer.unref();

  return {
    server, db, demo,
    listen(port = 0, host = '127.0.0.1') { return new Promise((resolve) => server.listen(port, host, () => resolve(server.address()))); },
    close() { clearInterval(timer); return new Promise((resolve) => server.close(() => { db.close(); resolve(); })); },
  };
}

module.exports = { createApp };
