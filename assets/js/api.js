/* ==========================================================================
   TC.api: front-end mock of the backend.
   Everything lives in localStorage. Every function is async and returns plain
   JSON, with the same shape the Express + MySQL backend will return, so
   replacing this file with fetch('/api/...') calls is the only change the
   pages need later.
   ========================================================================== */
window.TC = window.TC || {};

TC.api = (function () {
  const KEY = "tc_db_v1";
  const DAY = 86400000;
  const CFG = TC.CONFIG;
  let db = null;
  let memoryOnly = false;

  /* ---------- small helpers ---------- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return isoDate(d); };
  const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / DAY);
  const token = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  const nextId = (arr) => arr.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
  const fail = (msg) => { throw new Error(msg); };

  function now() { return new Date(Date.now() + ((db && db.clock_offset) || 0) * DAY); }
  function today() { return isoDate(now()); }
  function stamp() { return now().toISOString(); }

  /* ---------- persistence ---------- */
  function save() {
    if (memoryOnly) return;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { memoryOnly = true; }
  }
  function load() {
    if (db) return db;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { db = JSON.parse(raw); return db; }
    } catch (e) { memoryOnly = true; }
    db = buildSeed();
    save();
    return db;
  }
  function reset() {
    db = buildSeed();
    save();
  }

  /* ---------- seed ---------- */
  function rng(seed) { // mulberry32, so the demo data is the same every time
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildSeed() {
    const S = TC.SEED;
    const t0 = isoDate(new Date());
    const d = {
      clock_offset: 0,
      session_user_id: null,
      occasions: clone(S.occasions),
      vendors: clone(S.vendors),
      products: clone(S.products),
      collections: clone(S.collections),
      quiz: clone(S.quiz),
      users: clone(S.users).concat([
        { id: 3, name: "Priya Nair", email: "priya@example.com", password: "x", role: "customer" },
        { id: 4, name: "Rohan Gupta", email: "rohan@example.com", password: "x", role: "customer" },
        { id: 5, name: "Sneha Iyer", email: "sneha@example.com", password: "x", role: "customer" },
        { id: 6, name: "Vikram Rao", email: "vikram@example.com", password: "x", role: "customer" },
      ]),
      recipients: [
        { id: 1, user_id: 1, name: "Aanya Sharma", relation: "Friend", interests: "tea, books, cozy", birthday: "2003-03-14", email: "aanya@example.com", address: "Flat 4B, Lotus Residency, Sector 21, Dwarka, New Delhi 110075" },
        { id: 2, user_id: 1, name: "Mrs. Meera Mehta", relation: "Mother", interests: "cooking, classic", birthday: "1972-08-02", email: "meera@example.com", address: "12 Civil Lines, Jaipur 302006" },
        { id: 3, user_id: 1, name: "Kabir Anand", relation: "Friend (abroad)", interests: "music, travel, tech", birthday: "2002-11-30", email: "kabir@example.com", address: "Room 305, Maple House, 14 Queen St, Toronto M5H 2N2" },
      ],
      capsules: [],
      contributions: [],
      orders: [],
      memory_events: [],
      wishlist: [{ id: 1, user_id: 1, collection_id: 8 }],
      cart: { lines: [] },
      outbox: [],
    };
    const P = (id) => d.products.find((p) => p.id === id);
    const stage = (cid, no, unlock, status, msg, items) => ({
      id: cid * 10 + no, capsule_id: cid, stage_no: no, unlock_date: unlock, status, message: msg,
      items: items.map(([pid, qty], i) => ({ id: cid * 100 + no * 10 + i, product_id: pid, qty })),
    });

    // Capsule 1: solo, already active (two stages opened, one still sealed)
    d.capsules.push({
      id: 1, owner_id: 1, recipient_id: 1, occasion_id: 1, title: "Welcome home, Aanya", type: "solo", status: "active",
      share_token: null, recipient_token: "demoaanya0001", target_amount: 0, funding_deadline: null, gift_wrap: true, budget: 2500,
      created_at: addDays(t0, -42), thank_you: "", completed_at: null,
      stages: [
        stage(1, 1, addDays(t0, -40), "delivered", "Open this one first. A cup for the first evening in your own place.", [[1, 1]]),
        stage(1, 2, addDays(t0, -10), "unlocked", "A month in. Light a candle and sit down for a minute.", [[2, 1], [9, 1]]),
        stage(1, 3, addDays(t0, 325), "locked", "One year in. Look how this place has become yours.", [[14, 1]]),
      ],
    });
    // Capsule 2: group, still collecting money
    d.capsules.push({
      id: 2, owner_id: 1, recipient_id: 3, occasion_id: 4, title: "Kabir's first year abroad", type: "group", status: "funding",
      share_token: "kabirgroup2026", recipient_token: "demokabir0002", target_amount: 0, funding_deadline: addDays(t0, 9), gift_wrap: false, budget: 3000,
      created_at: addDays(t0, -5), thank_you: "", completed_at: null,
      stages: [
        stage(2, 1, addDays(t0, 14), "locked", "Something from home to start the winter.", [[7, 1], [38, 1]]),
        stage(2, 2, addDays(t0, 120), "locked", "Halfway through the first year. Keep going.", [[12, 1], [13, 1]]),
      ],
    });
    // Capsule 3: completed last year, reminder due soon
    d.capsules.push({
      id: 3, owner_id: 1, recipient_id: 2, occasion_id: 5, title: "Mummy and Papa's 25th", type: "solo", status: "completed",
      share_token: null, recipient_token: "demomeera0003", target_amount: 0, funding_deadline: null, gift_wrap: true, budget: 3000,
      created_at: addDays(t0, -380), thank_you: "Best surprise we have had in years. Thank you, beta.", completed_at: addDays(t0, -355),
      stages: [
        stage(3, 1, addDays(t0, -375), "delivered", "Twenty-five years. We start with the little things.", [[29, 1]]),
        stage(3, 2, addDays(t0, -365), "delivered", "For the pages that are still blank.", [[30, 1], [14, 1]]),
      ],
    });
    // Capsule totals and order for capsules 1 and 3 (capsule 2 is not paid for yet)
    const tot = (c) => {
      let items = 0;
      c.stages.forEach((s) => s.items.forEach((i) => { items += P(i.product_id).price * i.qty; }));
      return items + (c.gift_wrap ? CFG.GIFT_WRAP : 0) * c.stages.length + CFG.STAGE_FEE * c.stages.length;
    };
    d.capsules.forEach((c) => { c.total_price = tot(c); });
    d.capsules[1].target_amount = d.capsules[1].total_price;

    const mkOrder = (id, userId, capsule, created, items, status, occasionId, mode) => {
      const lines = items.map(([pid, qty]) => ({ product_id: pid, qty, price: P(pid).price }));
      const goods = lines.reduce((a, l) => a + l.price * l.qty, 0);
      let extra = 0;
      if (capsule) extra = (capsule.gift_wrap ? CFG.GIFT_WRAP : 0) * capsule.stages.length + CFG.STAGE_FEE * capsule.stages.length;
      return {
        id, user_id: userId, capsule_id: capsule ? capsule.id : null, occasion_id: capsule ? capsule.occasion_id : occasionId || null,
        total: goods + extra, status, created_at: created + "T10:00:00.000Z",
        address: capsule ? "" : "Home address on file", items: lines,
        payment: { mode: mode || "upi", status: "success", txn_ref: "rzp_test_" + id.toString().padStart(6, "0") },
        deliveries: capsule ? capsule.stages.map((s, i) => ({
          id: id * 10 + i, stage_id: s.id, address: d.recipients.find((r) => r.id === capsule.recipient_id).address,
          scheduled_date: s.unlock_date, status: s.status === "locked" ? "pending" : s.status === "unlocked" ? "dispatched" : "delivered",
        })) : [],
      };
    };
    const capItems = (c) => { const m = {}; c.stages.forEach((s) => s.items.forEach((i) => { m[i.product_id] = (m[i.product_id] || 0) + i.qty; })); return Object.entries(m).map(([k, v]) => [Number(k), v]); };
    d.orders.push(mkOrder(1, 1, d.capsules[0], d.capsules[0].created_at, capItems(d.capsules[0]), "shipped"));
    d.orders.push(mkOrder(2, 1, d.capsules[2], d.capsules[2].created_at, capItems(d.capsules[2]), "delivered"));

    // Group contributions for capsule 2
    const c2 = (id, name, amount, message, daysAgo, pid) => ({ id, capsule_id: 2, contributor_name: name, amount, message, product_id: pid || null, txn_ref: "rzp_test_c" + id, created_at: addDays(t0, -daysAgo) + "T12:00:00.000Z", refunded: false });
    d.contributions.push(
      c2(1, "Aarav", 600, "You will do great there. Call us on Sundays.", 4),
      c2(2, "Ishita", 500, "Winters are tough, but chai helps. Miss you!", 3),
      c2(3, "Dev", 400, "Do not forget our cricket group. Come back soon.", 2)
    );

    // Memory event for the completed capsule: reminder is due in 10 days
    d.memory_events.push({ id: 1, user_id: 1, capsule_id: 3, event_date: addDays(t0, -355), reminder_date: addDays(t0, 10), notified: false });

    // Extra orders so the admin dashboard has something to show
    const r = rng(7);
    const buyers = [1, 3, 4, 5, 6];
    for (let i = 0; i < 26; i++) {
      const daysAgo = Math.floor(r() * 45);
      const occ = 1 + Math.floor(r() * 8);
      const n = 1 + Math.floor(r() * 3);
      const items = [];
      for (let k = 0; k < n; k++) items.push([1 + Math.floor(r() * d.products.length), 1 + Math.floor(r() * 2)]);
      const st = daysAgo > 10 ? "delivered" : daysAgo > 4 ? "shipped" : daysAgo > 1 ? "packed" : "placed";
      d.orders.push(mkOrder(3 + i, buyers[Math.floor(r() * buyers.length)], null, addDays(t0, -daysAgo), items, st, occ, ["upi", "card", "cod", "netbanking"][Math.floor(r() * 4)]));
    }
    return d;
  }

  /* ---------- lookups ---------- */
  const P = (id) => db.products.find((p) => p.id === Number(id));
  const user = () => db.users.find((u) => u.id === db.session_user_id) || null;
  const safeUser = (u) => (u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null);
  function needUser() { const u = user(); if (!u) fail("Please log in first."); return u; }
  function needAdmin() { const u = needUser(); if (u.role !== "admin") fail("Admin access only."); return u; }
  function needCapsule(id) {
    const c = db.capsules.find((x) => x.id === Number(id));
    if (!c) fail("That capsule does not exist.");
    return c;
  }
  function ownCapsule(id) {
    const u = needUser();
    const c = needCapsule(id);
    if (c.owner_id !== u.id && u.role !== "admin") fail("That capsule belongs to someone else.");
    return c;
  }

  function totals(c) {
    let items = 0, count = 0;
    c.stages.forEach((s) => s.items.forEach((i) => { const p = P(i.product_id); items += (p ? p.price : 0) * i.qty; count += i.qty; }));
    const n = c.stages.length;
    const wrap = c.gift_wrap ? CFG.GIFT_WRAP * n : 0;
    const fee = CFG.STAGE_FEE * n;
    return { items, count, wrap, fee, total: items + wrap + fee, budget: c.budget || 0, remaining: (c.budget || 0) - items };
  }
  function raised(c) { return db.contributions.filter((x) => x.capsule_id === c.id && !x.refunded).reduce((a, x) => a + x.amount, 0); }

  function view(c) {
    const out = clone(c);
    out.totals = totals(c);
    out.raised = c.type === "group" ? raised(c) : 0;
    out.recipient = clone(db.recipients.find((r) => r.id === c.recipient_id) || null);
    out.occasion = clone(db.occasions.find((o) => o.id === c.occasion_id) || null);
    out.owner = safeUser(db.users.find((u) => u.id === c.owner_id));
    const ord = db.orders.find((o) => o.capsule_id === c.id);
    out.order_id = ord ? ord.id : null;
    out.stages.forEach((s) => s.items.forEach((i) => { i.product = clone(P(i.product_id)); }));
    out.stages.sort((a, b) => a.stage_no - b.stage_no);
    return out;
  }

  function email(to, subject, body, link, kind) {
    db.outbox.unshift({ id: nextId(db.outbox), to, subject, body, link: link || null, kind: kind || "info", date: stamp() });
  }

  /* ---------- scheduler (the daily job from the report) ---------- */
  function runScheduler() {
    const t = today();
    const events = [];
    db.capsules.forEach((c) => {
      const rcp = db.recipients.find((r) => r.id === c.recipient_id);
      if (c.status === "funding" && c.funding_deadline < t && raised(c) < c.target_amount) {
        c.status = "cancelled";
        db.contributions.filter((x) => x.capsule_id === c.id).forEach((x) => { x.refunded = true; });
        email(db.users.find((u) => u.id === c.owner_id).email, `Funding ended for "${c.title}"`, "The target was not reached by the deadline, so every contribution is being refunded.", "group.html?id=" + c.id, "funding");
        events.push({ type: "funding_failed", capsule_id: c.id, title: c.title });
      }
      if (c.status !== "confirmed" && c.status !== "active") return;
      const order = db.orders.find((o) => o.capsule_id === c.id);
      c.stages.forEach((s) => {
        const del = order && order.deliveries.find((x) => x.stage_id === s.id);
        if (s.status === "locked" && s.unlock_date <= t) {
          s.status = "unlocked";
          if (del) del.status = "dispatched";
          c.status = "active";
          email(rcp ? rcp.email || rcp.name : "recipient", `Stage ${s.stage_no} of "${c.title}" has opened`, "Something is on its way to you. Open the link to see what is inside.", "recipient.html?t=" + c.recipient_token, "unlock");
          events.push({ type: "unlock", capsule_id: c.id, title: c.title, stage_no: s.stage_no });
        }
        if (s.status === "unlocked" && s.unlock_date <= addDays(t, -2)) {
          s.status = "delivered";
          if (del) del.status = "delivered";
        }
      });
      if (c.stages.length && c.stages.every((s) => s.status === "delivered")) {
        c.status = "completed";
        c.completed_at = t;
        db.memory_events.push({ id: nextId(db.memory_events), user_id: c.owner_id, capsule_id: c.id, event_date: t, reminder_date: addDays(t, 365), notified: false });
        events.push({ type: "completed", capsule_id: c.id, title: c.title });
      }
      if (order) {
        const all = order.deliveries.every((x) => x.status === "delivered");
        const some = order.deliveries.some((x) => x.status !== "pending");
        if (all) order.status = "delivered";
        else if (some && order.status !== "delivered") order.status = "shipped";
      }
    });
    db.memory_events.forEach((m) => {
      if (!m.notified && m.reminder_date <= t) {
        m.notified = true;
        const c = db.capsules.find((x) => x.id === m.capsule_id);
        const u = db.users.find((x) => x.id === m.user_id);
        email(u.email, `A year ago you sent "${c.title}"`, "Repeat it, or upgrade it with something new.", "timeline.html", "reminder");
        events.push({ type: "reminder", capsule_id: c.id, title: c.title });
      }
    });
    save();
    return events;
  }

  /* ---------- quiz scoring: Score = 3T + 2O + B ---------- */
  function score(answers) {
    const tags = answers.tags || [];
    const occ = answers.occasion_id || null;
    const budget = answers.budget || 0;
    const inOcc = new Set();
    if (occ) db.collections.filter((c) => c.occasion_id === Number(occ)).forEach((c) => c.productIds.forEach((id) => inOcc.add(id)));
    return db.products.filter((p) => p.stock > 0).map((p) => {
      const matched = tags.filter((t, i) => tags.indexOf(t) === i && p.tags.includes(t));
      const T = matched.length;
      const O = inOcc.has(p.id) ? 1 : 0;
      const B = budget && p.price <= budget ? 1 : 0;
      return { product: clone(p), T, O, B, score: 3 * T + 2 * O + B, matched };
    }).sort((a, b) => b.score - a.score || a.product.price - b.product.price || a.product.id - b.product.id);
  }

  /* greedy fill: highest score first, skip anything that would break the budget, at most 6 items */
  function pickBundle(ranked, budget) {
    const picked = [];
    let sum = 0;
    for (const r of ranked) {
      if (r.T === 0 && r.O === 0) continue;
      if (picked.length >= 6) break;
      if (sum + r.product.price <= budget) { picked.push(r.product); sum += r.product.price; }
    }
    return picked;
  }

  /* ---------- capsule building ---------- */
  function newCapsule(owner, fields) {
    const c = Object.assign({
      id: nextId(db.capsules), owner_id: owner.id, recipient_id: null, occasion_id: null, title: "Untitled capsule",
      type: "solo", status: "draft", share_token: null, recipient_token: token(), target_amount: 0, funding_deadline: null,
      gift_wrap: false, budget: 2000, created_at: today(), thank_you: "", completed_at: null, total_price: 0, stages: [],
    }, fields);
    db.capsules.push(c);
    return c;
  }
  function newStage(c, unlock, message) {
    const no = c.stages.reduce((m, s) => Math.max(m, s.stage_no), 0) + 1;
    const s = { id: c.id * 10 + no + Math.floor(Math.random() * 1000) * 1000, capsule_id: c.id, stage_no: no, unlock_date: unlock, status: "locked", message: message || "", items: [] };
    c.stages.push(s);
    return s;
  }
  function needDraft(c) {
    if (c.status !== "draft" && !(c.status === "funding")) fail("This capsule is already paid for, so it cannot be changed.");
  }
  function addItem(c, stageNo, productId, qty) {
    const p = P(productId);
    if (!p) fail("That product does not exist.");
    const s = c.stages.find((x) => x.stage_no === Number(stageNo));
    if (!s) fail("That stage does not exist.");
    const ex = s.items.find((i) => i.product_id === p.id);
    const q = (ex ? ex.qty : 0) + (qty || 1);
    if (q > p.stock) fail(`Only ${p.stock} of "${p.name}" in stock.`);
    if (ex) ex.qty = q;
    else s.items.push({ id: Date.now() + Math.floor(Math.random() * 1000), product_id: p.id, qty: q });
  }
  function aggregate(c) {
    const m = {};
    c.stages.forEach((s) => s.items.forEach((i) => { m[i.product_id] = (m[i.product_id] || 0) + i.qty; }));
    return Object.entries(m).map(([k, v]) => ({ product_id: Number(k), qty: v, price: P(k).price }));
  }
  function takeStock(lines) {
    lines.forEach((l) => {
      const p = P(l.product_id);
      if (!p || p.stock < l.qty) fail(`"${p ? p.name : "A product"}" no longer has enough stock.`);
    });
    lines.forEach((l) => { P(l.product_id).stock -= l.qty; });
  }
  function confirmCapsule(c, mode, txn, addressFallback) {
    const lines = aggregate(c);
    takeStock(lines);
    const rcp = db.recipients.find((r) => r.id === c.recipient_id);
    const t = totals(c);
    c.total_price = t.total;
    c.status = "confirmed";
    const id = nextId(db.orders);
    const order = {
      id, user_id: c.owner_id, capsule_id: c.id, occasion_id: c.occasion_id, total: t.total, status: "placed", created_at: stamp(),
      address: rcp ? rcp.address : addressFallback || "", items: lines,
      payment: { mode, status: "success", txn_ref: txn },
      deliveries: c.stages.map((s, i) => ({ id: id * 10 + i, stage_id: s.id, address: rcp ? rcp.address : addressFallback || "", scheduled_date: s.unlock_date, status: "pending" })),
    };
    db.orders.push(order);
    return order;
  }
  function checkReady(c) {
    const t = totals(c);
    if (!t.count) fail("Add at least one item to the capsule first.");
    if (!c.recipient_id) fail("Choose who the capsule is for.");
    const rcp = db.recipients.find((r) => r.id === c.recipient_id);
    if (!rcp || !rcp.address) fail("Add a delivery address for the recipient.");
    if (c.stages.some((s) => !s.items.length)) fail("Every stage needs at least one item. Remove empty stages or add items to them.");
    const tm = addDays(today(), 1);
    if (c.stages.some((s) => !s.unlock_date || s.unlock_date < tm)) fail("Every stage needs an unlock date from tomorrow onward.");
    return t;
  }

  /* ---------- cart ---------- */
  function cartView() {
    const lines = db.cart.lines.map((l, idx) => {
      if (l.type === "capsule") {
        const c = db.capsules.find((x) => x.id === l.capsule_id);
        if (!c || c.status !== "draft") return null;
        const v = view(c);
        return { idx, type: "capsule", capsule: v, amount: v.totals.total };
      }
      const p = P(l.product_id);
      if (!p) return null;
      return { idx, type: "product", product: clone(p), qty: l.qty, occasion_id: l.occasion_id || null, amount: p.price * l.qty };
    }).filter(Boolean);
    return { lines, subtotal: lines.reduce((a, l) => a + l.amount, 0), count: lines.length };
  }

  /* ======================= public API ======================= */
  const api = {
    boot() { load(); return runScheduler(); },
    resetDemo() { reset(); return true; },

    /* clock (demo only) */
    today() { load(); return today(); },
    clockOffset() { load(); return db.clock_offset; },
    advanceDays(n) { load(); db.clock_offset += Number(n); return runScheduler(); },
    resetClock() { load(); db.clock_offset = 0; save(); return []; },

    /* auth */
    async me() { load(); return safeUser(user()); },
    async login(emailAddr, password) {
      load();
      const u = db.users.find((x) => x.email.toLowerCase() === String(emailAddr).trim().toLowerCase());
      if (!u || u.password !== password) fail("That email and password do not match.");
      db.session_user_id = u.id; save();
      return safeUser(u);
    },
    async register({ name, email: em, password, phone }) {
      load();
      if (!name || !em || !password) fail("Fill in your name, email and password.");
      if (password.length < 6) fail("Use a password with at least 6 characters.");
      if (db.users.some((x) => x.email.toLowerCase() === em.trim().toLowerCase())) fail("An account with this email already exists. Log in instead.");
      const u = { id: nextId(db.users), name: name.trim(), email: em.trim(), password, phone: phone || "", role: "customer" };
      db.users.push(u); db.session_user_id = u.id; save();
      return safeUser(u);
    },
    async logout() { load(); db.session_user_id = null; save(); return true; },

    /* catalogue */
    async occasions() { load(); return clone(db.occasions); },
    async occasion(slugOrId) {
      load();
      return clone(db.occasions.find((o) => o.slug === slugOrId || o.id === Number(slugOrId)) || null);
    },
    async collections({ occasion_id, maxBudget } = {}) {
      load();
      return db.collections.filter((c) => !occasion_id || c.occasion_id === Number(occasion_id)).map((c) => {
        const prods = c.productIds.map(P).filter(Boolean);
        const total = prods.reduce((a, p) => a + p.price, 0);
        return Object.assign(clone(c), { products: clone(prods), total, occasion: clone(db.occasions.find((o) => o.id === c.occasion_id)) });
      }).filter((c) => !maxBudget || c.total <= maxBudget);
    },
    async collection(id) {
      load();
      const all = await api.collections();
      return all.find((c) => c.id === Number(id)) || null;
    },
    async products({ q, tag } = {}) {
      load();
      return clone(db.products.filter((p) => (!q || (p.name + " " + p.tags.join(" ")).toLowerCase().includes(q.toLowerCase())) && (!tag || p.tags.includes(tag))));
    },
    async product(id) {
      load();
      const p = P(id);
      if (!p) return null;
      const out = clone(p);
      out.vendor = clone(db.vendors.find((v) => v.id === p.vendor_id));
      out.collections = db.collections.filter((c) => c.productIds.includes(p.id)).map((c) => ({ id: c.id, title: c.title }));
      out.similar = clone(db.products.filter((x) => x.id !== p.id && x.tags.some((t) => p.tags.includes(t))).slice(0, 4));
      return out;
    },

    /* quiz */
    async quiz() { load(); return clone(db.quiz); },
    async score(answers) { load(); return score(answers); },
    async suggest(answers) {
      load();
      const ranked = score(answers);
      const picked = pickBundle(ranked, answers.budget || 2500);
      return { ranked: ranked.filter((r) => r.T > 0 || r.O > 0).slice(0, 12), picked, sum: picked.reduce((a, p) => a + p.price, 0), budget: answers.budget || 2500 };
    },
    async buildFromQuiz(answers, { title, recipient_id } = {}) {
      load();
      const u = needUser();
      const budget = answers.budget || 2500;
      const picked = pickBundle(score(answers), budget);
      const occ = db.occasions.find((o) => o.id === Number(answers.occasion_id));
      const c = newCapsule(u, { title: title || (occ ? occ.name + " capsule" : "My capsule"), occasion_id: occ ? occ.id : null, budget, recipient_id: recipient_id || null });
      const n = Math.max(1, Math.min(3, picked.length));
      const t = today();
      const plan = [[addDays(t, 1), "Open this one first. It is the start of something."], [addDays(t, 30), "A month later. Hope the days have been kind."], [addDays(t, 365), "A year on. Look how far you have come."]];
      for (let i = 0; i < n; i++) newStage(c, plan[i][0], plan[i][1]);
      picked.forEach((p, i) => addItem(c, (i % n) + 1, p.id, 1));
      save();
      return view(c);
    },

    /* recipients */
    async recipients() { load(); const u = needUser(); return clone(db.recipients.filter((r) => r.user_id === u.id)); },
    async saveRecipient(r) {
      load();
      const u = needUser();
      if (!r.name || !r.name.trim()) fail("Enter the recipient's name.");
      if (r.id) {
        const ex = db.recipients.find((x) => x.id === r.id && x.user_id === u.id);
        if (!ex) fail("Recipient not found.");
        Object.assign(ex, r);
        save(); return clone(ex);
      }
      const rec = Object.assign({ id: nextId(db.recipients), user_id: u.id, relation: "", interests: "", birthday: "", email: "", address: "" }, r);
      db.recipients.push(rec); save();
      return clone(rec);
    },
    async deleteRecipient(id) {
      load(); const u = needUser();
      if (db.capsules.some((c) => c.recipient_id === Number(id) && !["completed", "cancelled"].includes(c.status))) fail("This recipient has a capsule in progress. Finish or cancel it first.");
      db.recipients = db.recipients.filter((r) => !(r.id === Number(id) && r.user_id === u.id)); save(); return true;
    },

    /* capsules */
    totalsOf: (c) => totals(c),
    async capsules() { load(); const u = needUser(); return db.capsules.filter((c) => c.owner_id === u.id).map(view).sort((a, b) => b.id - a.id); },
    async capsule(id) { load(); return view(ownCapsule(id)); },
    async newCapsule({ occasion_id, recipient_id, title } = {}) {
      load();
      const u = needUser();
      const occ = db.occasions.find((o) => o.id === Number(occasion_id));
      const c = newCapsule(u, { occasion_id: occ ? occ.id : null, recipient_id: recipient_id || null, title: title || (occ ? occ.name + " capsule" : "My capsule") });
      const t = today();
      newStage(c, addDays(t, 1), "Open this one first.");
      save();
      return view(c);
    },
    async capsuleFromCollection(collection_id) {
      load();
      const u = needUser();
      const col = db.collections.find((x) => x.id === Number(collection_id));
      if (!col) fail("That collection does not exist.");
      const prods = col.productIds.map(P).filter((p) => p && p.stock > 0);
      const budget = Math.ceil((prods.reduce((a, p) => a + p.price, 0) + 300) / 500) * 500;
      const c = newCapsule(u, { occasion_id: col.occasion_id, title: col.title, budget });
      const n = Math.max(1, Math.min(3, prods.length));
      const t = today();
      const plan = [[addDays(t, 1), "Open this one first."], [addDays(t, 30), "A month later."], [addDays(t, 365), "One year on."]];
      for (let i = 0; i < n; i++) newStage(c, plan[i][0], plan[i][1]);
      prods.forEach((p, i) => addItem(c, (i % n) + 1, p.id, 1));
      save();
      return view(c);
    },
    async updateCapsule(id, patch) {
      load();
      const c = ownCapsule(id);
      needDraft(c);
      ["title", "occasion_id", "recipient_id", "gift_wrap", "budget"].forEach((k) => { if (k in patch) c[k] = patch[k]; });
      if ("type" in patch && c.status === "draft") c.type = patch.type;
      if ("budget" in patch) c.budget = Math.max(0, Number(patch.budget) || 0);
      save(); return view(c);
    },
    async addStage(id) {
      load();
      const c = ownCapsule(id); needDraft(c);
      if (c.stages.length >= CFG.MAX_STAGES) fail(`A capsule can have up to ${CFG.MAX_STAGES} stages.`);
      const last = c.stages.map((s) => s.unlock_date).sort().pop() || today();
      newStage(c, addDays(last, 30), "");
      save(); return view(c);
    },
    async removeStage(id, stageNo) {
      load();
      const c = ownCapsule(id); needDraft(c);
      if (c.stages.length <= 1) fail("A capsule needs at least one stage.");
      c.stages = c.stages.filter((s) => s.stage_no !== Number(stageNo));
      c.stages.sort((a, b) => a.stage_no - b.stage_no).forEach((s, i) => { s.stage_no = i + 1; });
      save(); return view(c);
    },
    async updateStage(id, stageNo, patch) {
      load();
      const c = ownCapsule(id); needDraft(c);
      const s = c.stages.find((x) => x.stage_no === Number(stageNo));
      if (!s) fail("That stage does not exist.");
      if ("unlock_date" in patch) s.unlock_date = patch.unlock_date;
      if ("message" in patch) s.message = String(patch.message).slice(0, 400);
      save(); return view(c);
    },
    async addItem(id, stageNo, productId, qty) {
      load();
      const c = ownCapsule(id); needDraft(c);
      addItem(c, stageNo, productId, qty || 1);
      save(); return view(c);
    },
    async setItemQty(id, stageNo, productId, qty) {
      load();
      const c = ownCapsule(id); needDraft(c);
      const s = c.stages.find((x) => x.stage_no === Number(stageNo));
      const it = s && s.items.find((i) => i.product_id === Number(productId));
      if (!it) fail("That item is not in this stage.");
      if (qty <= 0) s.items = s.items.filter((i) => i !== it);
      else {
        const p = P(productId);
        if (qty > p.stock) fail(`Only ${p.stock} of "${p.name}" in stock.`);
        it.qty = qty;
      }
      save(); return view(c);
    },
    async moveItem(id, fromStage, productId, toStage) {
      load();
      const c = ownCapsule(id); needDraft(c);
      const a = c.stages.find((x) => x.stage_no === Number(fromStage));
      const b = c.stages.find((x) => x.stage_no === Number(toStage));
      const it = a && a.items.find((i) => i.product_id === Number(productId));
      if (!it || !b) fail("Could not move that item.");
      a.items = a.items.filter((i) => i !== it);
      const ex = b.items.find((i) => i.product_id === it.product_id);
      if (ex) ex.qty += it.qty; else b.items.push(it);
      save(); return view(c);
    },
    async deleteCapsule(id) {
      load();
      const c = ownCapsule(id);
      if (c.status !== "draft") fail("Only drafts can be deleted.");
      db.capsules = db.capsules.filter((x) => x !== c);
      db.cart.lines = db.cart.lines.filter((l) => !(l.type === "capsule" && l.capsule_id === c.id));
      save(); return true;
    },
    async startFunding(id, deadline) {
      load();
      const c = ownCapsule(id);
      if (c.status !== "draft") fail("This capsule has already started.");
      if (c.type !== "group") fail("Switch the capsule to a group capsule first.");
      const t = checkReady(c);
      if (!deadline || deadline <= today()) fail("Pick a funding deadline after today.");
      const firstUnlock = c.stages.map((s) => s.unlock_date).sort()[0];
      if (deadline >= firstUnlock) fail("The funding deadline must be before the first stage unlocks.");
      c.status = "funding"; c.funding_deadline = deadline; c.target_amount = t.total; c.share_token = token();
      db.cart.lines = db.cart.lines.filter((l) => !(l.type === "capsule" && l.capsule_id === c.id));
      save(); return view(c);
    },
    async cancelCapsule(id) {
      load();
      const c = ownCapsule(id);
      if (!["funding"].includes(c.status)) fail("Only a capsule that is collecting money can be cancelled.");
      c.status = "cancelled";
      db.contributions.filter((x) => x.capsule_id === c.id).forEach((x) => { x.refunded = true; });
      save(); return view(c);
    },
    async repeatCapsule(id, mode) {
      load();
      const u = needUser();
      const src = ownCapsule(id);
      const c = newCapsule(u, { title: src.title + " (again)", occasion_id: src.occasion_id, recipient_id: src.recipient_id, budget: mode === "upgrade" ? (src.budget || 2000) + 500 : src.budget, gift_wrap: src.gift_wrap, type: src.type === "group" ? "group" : "solo" });
      const t = today();
      const shift = daysBetween(src.stages[0].unlock_date, addDays(t, 1));
      src.stages.forEach((s) => {
        const ns = newStage(c, addDays(s.unlock_date, shift), s.message);
        s.items.forEach((i) => { const p = P(i.product_id); if (p && p.stock >= i.qty) ns.items.push({ id: Date.now() + Math.floor(Math.random() * 100000), product_id: i.product_id, qty: i.qty }); });
      });
      save(); return view(c);
    },

    /* cart */
    async cart() { load(); needUser(); return cartView(); },
    cartCount() { load(); return db.session_user_id ? cartView().lines.length : 0; },
    async addProductToCart(productId, qty, occasionId) {
      load(); needUser();
      const p = P(productId);
      if (!p) fail("That product does not exist.");
      const ex = db.cart.lines.find((l) => l.type === "product" && l.product_id === p.id);
      const q = (ex ? ex.qty : 0) + (qty || 1);
      if (q > p.stock) fail(`Only ${p.stock} of "${p.name}" in stock.`);
      if (ex) ex.qty = q; else db.cart.lines.push({ type: "product", product_id: p.id, qty: q, occasion_id: occasionId || null });
      save(); return cartView();
    },
    async addCapsuleToCart(id) {
      load();
      const c = ownCapsule(id);
      if (c.type === "group") fail("Group capsules are paid by contributions. Start group funding instead.");
      checkReady(c);
      if (!db.cart.lines.some((l) => l.type === "capsule" && l.capsule_id === c.id)) db.cart.lines.push({ type: "capsule", capsule_id: c.id });
      save(); return cartView();
    },
    async setCartQty(idx, qty) {
      load(); needUser();
      const l = db.cart.lines[idx];
      if (!l || l.type !== "product") fail("That cart line does not exist.");
      if (qty <= 0) db.cart.lines.splice(idx, 1);
      else {
        const p = P(l.product_id);
        if (qty > p.stock) fail(`Only ${p.stock} of "${p.name}" in stock.`);
        l.qty = qty;
      }
      save(); return cartView();
    },
    async removeCartLine(idx) { load(); needUser(); db.cart.lines.splice(idx, 1); save(); return cartView(); },

    /* checkout */
    async placeOrder({ address, name, phone, mode, cardNumber }) {
      load();
      const u = needUser();
      const cv = cartView();
      if (!cv.lines.length) fail("Your cart is empty.");
      const hasLoose = cv.lines.some((l) => l.type === "product");
      if (hasLoose && (!address || address.trim().length < 10)) fail("Enter a full delivery address for the products in your cart.");
      if (!["upi", "card", "netbanking", "cod"].includes(mode)) fail("Choose a payment method.");
      if (mode === "card") {
        const digits = String(cardNumber || "").replace(/\s/g, "");
        if (digits.length < 12) fail("Enter a valid card number. Test card: 4242 4242 4242 4242.");
        if (digits.endsWith("0002")) fail("The test card was declined. Try 4242 4242 4242 4242.");
      }
      const txn = "rzp_test_" + token().slice(0, 10);
      const snapshot = clone(db);
      const created = [];
      try {
        cv.lines.filter((l) => l.type === "capsule").forEach((l) => {
          const c = db.capsules.find((x) => x.id === l.capsule.id);
          checkReady(c);
          created.push(confirmCapsule(c, mode, txn, address));
        });
        const loose = cv.lines.filter((l) => l.type === "product");
        if (loose.length) {
          const lines = loose.map((l) => ({ product_id: l.product.id, qty: l.qty, price: l.product.price }));
          takeStock(lines);
          const id = nextId(db.orders);
          const o = { id, user_id: u.id, capsule_id: null, occasion_id: loose[0].occasion_id, total: lines.reduce((a, l) => a + l.price * l.qty, 0), status: "placed", created_at: stamp(), address: `${name || u.name}, ${address}${phone ? " (" + phone + ")" : ""}`, items: lines, payment: { mode, status: mode === "cod" ? "pending" : "success", txn_ref: txn }, deliveries: [] };
          db.orders.push(o); created.push(o);
        }
      } catch (e) { db = snapshot; throw e; }
      db.cart.lines = [];
      runScheduler();
      save();
      return created.map((o) => ({ id: o.id, total: o.total, capsule_id: o.capsule_id, txn_ref: txn }));
    },
    async orders() { load(); const u = needUser(); return clone(db.orders.filter((o) => o.user_id === u.id)).sort((a, b) => b.id - a.id); },
    async order(id) {
      load();
      const u = needUser();
      const o = db.orders.find((x) => x.id === Number(id));
      if (!o || (o.user_id !== u.id && u.role !== "admin")) fail("That order was not found.");
      const out = clone(o);
      out.items.forEach((i) => { i.product = clone(P(i.product_id)); });
      out.siblings = db.orders.filter((x) => x.payment.txn_ref === o.payment.txn_ref && x.id !== o.id).map((x) => x.id);
      if (o.capsule_id) {
        out.capsule = view(db.capsules.find((c) => c.id === o.capsule_id));
        out.deliveries.forEach((d) => { d.stage = out.capsule.stages.find((s) => s.id === d.stage_id); });
      }
      return out;
    },

    /* group funding: organiser side */
    async group(id) {
      load();
      const c = ownCapsule(id);
      if (c.type !== "group") fail("This is not a group capsule.");
      const v = view(c);
      v.contributions = clone(db.contributions.filter((x) => x.capsule_id === c.id)).sort((a, b) => b.id - a.id);
      return v;
    },
    async topUp(id, amount) {
      load();
      const c = ownCapsule(id);
      return api.contribute(c.share_token, { name: user().name + " (organiser)", amount, message: "Topped up the rest." });
    },

    /* group funding: public side (no login needed) */
    async publicGroup(tok) {
      load();
      const c = db.capsules.find((x) => x.share_token && x.share_token === tok);
      if (!c) return null;
      const v = view(c);
      const rcp = v.recipient ? v.recipient.name.split(" ")[0] : "them";
      return {
        id: c.id, title: c.title, status: c.status, occasion: v.occasion, organiser: v.owner.name, recipient_first_name: rcp,
        target: c.target_amount, raised: v.raised, deadline: c.funding_deadline, stage_count: c.stages.length,
        first_unlock: c.stages.map((s) => s.unlock_date).sort()[0],
        contributions: clone(db.contributions.filter((x) => x.capsule_id === c.id && !x.refunded)).sort((a, b) => b.id - a.id).map((x) => ({ id: x.id, name: x.contributor_name, amount: x.amount, message: x.message, product: x.product_id ? clone(P(x.product_id)) : null, created_at: x.created_at })),
        gift_ideas: clone(db.products.filter((p) => p.stock > 0 && p.price <= Math.max(300, c.target_amount - v.raised)).sort((a, b) => a.price - b.price).slice(0, 6)),
      };
    },
    async contribute(tok, { name, amount, message, product_id }) {
      load();
      const c = db.capsules.find((x) => x.share_token && x.share_token === tok);
      if (!c) fail("This contribution link is not valid.");
      if (c.status !== "funding") fail(c.status === "cancelled" ? "Funding for this capsule has ended." : "This capsule is already fully funded.");
      if (c.funding_deadline < today()) fail("The funding deadline has passed.");
      if (!name || !name.trim()) fail("Enter your name so the group knows who contributed.");
      let amt = Number(amount);
      let pid = null;
      const remaining = c.target_amount - raised(c);
      if (product_id) {
        const p = P(product_id);
        if (!p || p.stock < 1) fail("That item is out of stock.");
        pid = p.id; amt = p.price;
        // item contributions raise the target and the raised amount equally
        const last = c.stages.slice().sort((a, b) => b.stage_no - a.stage_no)[0];
        addItem(c, last.stage_no, p.id, 1);
        c.target_amount += p.price;
      } else {
        if (!Number.isFinite(amt) || amt < 10) fail("The smallest contribution is ₹10.");
        if (amt > remaining) fail(`The capsule only needs ₹${remaining.toLocaleString("en-IN")} more. Enter that amount or less.`);
      }
      db.contributions.push({ id: nextId(db.contributions), capsule_id: c.id, contributor_name: name.trim(), amount: amt, message: String(message || "").slice(0, 240), product_id: pid, txn_ref: "rzp_test_" + token().slice(0, 8), created_at: stamp(), refunded: false });
      let confirmed = false;
      if (raised(c) >= c.target_amount) {
        confirmCapsule(c, "group", "rzp_test_grp" + c.id);
        const owner = db.users.find((u) => u.id === c.owner_id);
        email(owner.email, `"${c.title}" is fully funded`, "The target was reached. Your order has been placed and the first stage is scheduled.", "group.html?id=" + c.id, "funding");
        confirmed = true;
        runScheduler();
      }
      save();
      return { ok: true, confirmed, raised: raised(c), target: c.target_amount };
    },

    /* recipient side */
    async recipientView(tok) {
      load();
      const c = db.capsules.find((x) => x.recipient_token === tok);
      if (!c || !["confirmed", "active", "completed"].includes(c.status)) return null;
      const v = view(c);
      const t = today();
      return {
        title: c.title, occasion: v.occasion, from: v.owner.name, to: v.recipient ? v.recipient.name : "you", thank_you: c.thank_you, status: c.status,
        today: t,
        stages: v.stages.map((s) => ({
          stage_no: s.stage_no, unlock_date: s.unlock_date, status: s.status, days_left: daysBetween(t, s.unlock_date),
          message: s.status === "locked" ? "" : s.message,
          items: s.status === "locked" ? [] : s.items.map((i) => ({ name: i.product.name, emoji: i.product.emoji, qty: i.qty })),
        })),
        notes: c.type === "group" ? clone(db.contributions.filter((x) => x.capsule_id === c.id && x.message && !x.refunded)).map((x) => ({ name: x.contributor_name, message: x.message })) : [],
        notes_unlocked: c.stages.some((s) => s.status !== "locked"),
      };
    },
    async thankYou(tok, text) {
      load();
      const c = db.capsules.find((x) => x.recipient_token === tok);
      if (!c) fail("This link is not valid.");
      if (!text || !text.trim()) fail("Write a few words first.");
      c.thank_you = text.trim().slice(0, 300);
      const owner = db.users.find((u) => u.id === c.owner_id);
      email(owner.email, `A thank-you for "${c.title}"`, c.thank_you, "capsules.html", "thanks");
      save(); return true;
    },

    /* timeline, wishlist, mailbox */
    async timeline() {
      load();
      const u = needUser();
      const caps = db.capsules.filter((c) => c.owner_id === u.id && ["confirmed", "active", "completed"].includes(c.status)).map(view);
      return caps.sort((a, b) => (b.stages[0].unlock_date).localeCompare(a.stages[0].unlock_date)).map((c) => ({
        capsule: c, event: clone(db.memory_events.find((m) => m.capsule_id === c.id) || null),
      }));
    },
    async wishlist() {
      load();
      const u = needUser();
      const ids = db.wishlist.filter((w) => w.user_id === u.id).map((w) => w.collection_id);
      const all = await api.collections();
      return all.filter((c) => ids.includes(c.id));
    },
    wishlistIds() { load(); return db.session_user_id ? db.wishlist.filter((w) => w.user_id === db.session_user_id).map((w) => w.collection_id) : []; },
    async toggleWishlist(collection_id) {
      load();
      const u = needUser();
      const i = db.wishlist.findIndex((w) => w.user_id === u.id && w.collection_id === Number(collection_id));
      if (i >= 0) db.wishlist.splice(i, 1); else db.wishlist.push({ id: nextId(db.wishlist), user_id: u.id, collection_id: Number(collection_id) });
      save(); return i < 0;
    },
    async mailbox() { load(); return clone(db.outbox); },

    /* admin */
    async adminStats() {
      load(); needAdmin();
      const t = today();
      const paid = db.orders.filter((o) => o.status !== "cancelled");
      const byOcc = {};
      paid.forEach((o) => { const k = o.occasion_id || 0; byOcc[k] = byOcc[k] || { occasion_id: k, orders: 0, revenue: 0 }; byOcc[k].orders++; byOcc[k].revenue += o.total; });
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const day = addDays(t, -i);
        days.push({ day, revenue: paid.filter((o) => o.created_at.slice(0, 10) === day).reduce((a, o) => a + o.total, 0), orders: paid.filter((o) => o.created_at.slice(0, 10) === day).length });
      }
      const units = {};
      paid.forEach((o) => o.items.forEach((i) => { units[i.product_id] = (units[i.product_id] || 0) + i.qty; }));
      const top = Object.entries(units).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => ({ product: clone(P(id)), units: n }));
      return {
        today: t,
        ordersToday: paid.filter((o) => o.created_at.slice(0, 10) === t).length,
        ordersTotal: paid.length,
        revenue: paid.reduce((a, o) => a + o.total, 0),
        activeCapsules: db.capsules.filter((c) => ["confirmed", "active"].includes(c.status)).length,
        funding: db.capsules.filter((c) => c.status === "funding").map((c) => ({ id: c.id, title: c.title, raised: raised(c), target: c.target_amount, deadline: c.funding_deadline })),
        byOccasion: Object.values(byOcc).map((r) => Object.assign(r, { name: r.occasion_id ? db.occasions.find((o) => o.id === r.occasion_id).name : "Other (no occasion)" })).sort((a, b) => b.revenue - a.revenue),
        days, top,
        lowStock: clone(db.products.filter((p) => p.stock <= 12).sort((a, b) => a.stock - b.stock).slice(0, 5)),
        recent: clone(db.orders.slice().sort((a, b) => b.id - a.id).slice(0, 6)).map((o) => Object.assign(o, { customer: (db.users.find((u) => u.id === o.user_id) || {}).name })),
      };
    },
    async adminProducts() { load(); needAdmin(); return clone(db.products).map((p) => Object.assign(p, { vendor: (db.vendors.find((v) => v.id === p.vendor_id) || {}).shop_name })); },
    async adminVendors() { load(); needAdmin(); return clone(db.vendors); },
    async adminSaveProduct(p) {
      load(); needAdmin();
      if (!p.name || !p.name.trim()) fail("Enter a product name.");
      const price = Number(p.price), stock = Number(p.stock);
      if (!(price > 0)) fail("Enter a price above zero.");
      if (!(stock >= 0)) fail("Stock cannot be negative.");
      const tags = (Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",")).map((t) => t.trim().toLowerCase()).filter(Boolean);
      const rec = { name: p.name.trim(), price, stock, tags, emoji: p.emoji || "🎁", blurb: p.blurb || "", vendor_id: Number(p.vendor_id) || db.vendors[0].id, tint: p.tint || "#e6ebfd" };
      if (p.id) { const ex = db.products.find((x) => x.id === Number(p.id)); Object.assign(ex, rec); }
      else db.products.push(Object.assign({ id: nextId(db.products) }, rec));
      save(); return true;
    },
    async adminDeleteProduct(id) {
      load(); needAdmin();
      const inUse = db.capsules.some((c) => ["draft", "funding", "confirmed", "active"].includes(c.status) && c.stages.some((s) => s.items.some((i) => i.product_id === Number(id))));
      if (inUse) fail("This product is inside a live capsule. Set its stock to 0 instead of deleting it.");
      db.products = db.products.filter((p) => p.id !== Number(id));
      db.collections.forEach((c) => { c.productIds = c.productIds.filter((x) => x !== Number(id)); });
      db.cart.lines = db.cart.lines.filter((l) => !(l.type === "product" && l.product_id === Number(id)));
      save(); return true;
    },
    async adminCollections() { load(); needAdmin(); return api.collections(); },
    async adminSaveCollection(c) {
      load(); needAdmin();
      if (!c.title || !c.title.trim()) fail("Enter a collection title.");
      if (!c.productIds || c.productIds.length < 2) fail("Pick at least two products for a collection.");
      const rec = { occasion_id: Number(c.occasion_id), title: c.title.trim(), blurb: c.blurb || "", productIds: c.productIds.map(Number) };
      if (c.id) Object.assign(db.collections.find((x) => x.id === Number(c.id)), rec);
      else db.collections.push(Object.assign({ id: nextId(db.collections) }, rec));
      save(); return true;
    },
    async adminDeleteCollection(id) { load(); needAdmin(); db.collections = db.collections.filter((c) => c.id !== Number(id)); db.wishlist = db.wishlist.filter((w) => w.collection_id !== Number(id)); save(); return true; },
    async adminSaveQuizOption(qid, opt) {
      load(); needAdmin();
      const q = db.quiz.find((x) => x.id === Number(qid));
      if (!q) fail("Question not found.");
      if (!opt.text || !opt.text.trim()) fail("Enter the answer text.");
      if (opt.id) {
        const o = q.options.find((x) => x.id === Number(opt.id));
        o.text = opt.text.trim(); if (o.tag !== undefined || opt.tag) o.tag = (opt.tag || "").trim().toLowerCase();
      } else {
        const newId = db.quiz.reduce((m, qq) => Math.max(m, ...qq.options.map((o) => o.id)), 0) + 1;
        const o = { id: newId, text: opt.text.trim() };
        const sample = q.options[0] || {};
        if ("tag" in sample) o.tag = (opt.tag || "").trim().toLowerCase();
        else if ("occasion_id" in sample) o.occasion_id = Number(opt.occasion_id) || 1;
        else if ("budget" in sample) o.budget = Number(opt.budget) || 1500;
        q.options.push(o);
      }
      save(); return true;
    },
    async adminDeleteQuizOption(qid, oid) {
      load(); needAdmin();
      const q = db.quiz.find((x) => x.id === Number(qid));
      if (q.options.length <= 2) fail("A question needs at least two answers.");
      q.options = q.options.filter((o) => o.id !== Number(oid));
      save(); return true;
    },
    async adminOrders() {
      load(); needAdmin();
      return clone(db.orders).sort((a, b) => b.id - a.id).map((o) => Object.assign(o, {
        customer: (db.users.find((u) => u.id === o.user_id) || {}).name,
        occasion: o.occasion_id ? db.occasions.find((x) => x.id === o.occasion_id).name : "",
        capsule_title: o.capsule_id ? (db.capsules.find((c) => c.id === o.capsule_id) || {}).title : "",
      }));
    },
    async adminSetOrderStatus(id, status) {
      load(); needAdmin();
      if (!["placed", "packed", "shipped", "delivered", "cancelled"].includes(status)) fail("Unknown status.");
      const o = db.orders.find((x) => x.id === Number(id));
      o.status = status;
      if (status === "delivered") o.deliveries.forEach((d) => { if (d.status === "dispatched") d.status = "delivered"; });
      save(); return true;
    },
    async adminCapsules() {
      load(); needAdmin();
      return db.capsules.map(view).map((c) => ({ id: c.id, title: c.title, status: c.status, type: c.type, owner: c.owner.name, recipient: c.recipient ? c.recipient.name : "", stages: c.stages.map((s) => ({ stage_no: s.stage_no, unlock_date: s.unlock_date, status: s.status })), total: c.totals.total }));
    },
  };
  return api;
})();
