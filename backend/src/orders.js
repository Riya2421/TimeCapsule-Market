'use strict';
const { fail, token, txnRef, str, posInt } = require('./util');
const core = require('./core');
const caps = require('./capsules');
const { runScheduler } = require('./scheduler');
const { needUser, ownCapsule, view } = core;

/* ---------- cart (stored per user) ---------- */
function cartView(ctx) {
  const db = ctx.db, u = needUser(ctx);
  const lines = db.all('SELECT * FROM cart_lines WHERE user_id = ? ORDER BY id', u.id).map((l) => {
    if (l.type === 'capsule') {
      const c = db.get("SELECT * FROM capsules WHERE id = ? AND owner_id = ? AND status = 'draft'", l.capsule_id, u.id);
      if (!c) return null;
      const v = view(db, c);
      return { idx: l.id, type: 'capsule', capsule: v, amount: v.totals.total };
    }
    const p = core.liveProduct(db, l.product_id);
    if (!p) return null;
    return { idx: l.id, type: 'product', product: p, qty: l.qty, occasion_id: l.occasion_id || null, amount: p.price * l.qty };
  }).filter(Boolean);
  return { lines, subtotal: lines.reduce((a, l) => a + l.amount, 0), count: lines.length };
}
const cart = (ctx) => cartView(ctx);
const cartCount = (db, userId) => (userId ? cartView({ db, user: { id: userId } }).lines.length : 0);

function addProductToCart(ctx, productId, qty, occasionId) {
  const db = ctx.db, u = needUser(ctx);
  return db.tx(() => {
    const p = core.liveProduct(db, productId);
    if (!p) fail('That product does not exist.', 404);
    const ex = db.get("SELECT id, qty FROM cart_lines WHERE user_id = ? AND type = 'product' AND product_id = ?", u.id, p.id);
    const q = (ex ? ex.qty : 0) + posInt(qty === undefined ? 1 : qty);
    if (q > p.stock) fail(`Only ${p.stock} of "${p.name}" in stock.`);
    const occ = occasionId && db.get('SELECT id FROM occasions WHERE id = ?', Number(occasionId));
    if (ex) db.run('UPDATE cart_lines SET qty = ? WHERE id = ?', q, ex.id);
    else db.run("INSERT INTO cart_lines (user_id, type, product_id, qty, occasion_id) VALUES (?, 'product', ?, ?, ?)", u.id, p.id, q, occ ? occ.id : null);
    return cartView(ctx);
  });
}
function addCapsuleToCart(ctx, id) {
  const db = ctx.db;
  return db.tx(() => {
    const c = ownCapsule(ctx, id, true);
    if (c.status !== 'draft') fail('This capsule has already started.');
    if (c.type === 'group') fail('Group capsules are paid by contributions. Start group funding instead.');
    caps.checkReady(db, c);
    if (!db.get("SELECT id FROM cart_lines WHERE user_id = ? AND type = 'capsule' AND capsule_id = ?", ctx.user.id, c.id))
      db.run("INSERT INTO cart_lines (user_id, type, capsule_id) VALUES (?, 'capsule', ?)", ctx.user.id, c.id);
    return cartView(ctx);
  });
}
function ownLine(ctx, idx) {
  const l = ctx.db.get('SELECT * FROM cart_lines WHERE id = ? AND user_id = ?', Number(idx), needUser(ctx).id);
  if (!l) fail('That cart line does not exist.', 404);
  return l;
}
function setCartQty(ctx, idx, qty) {
  const db = ctx.db;
  return db.tx(() => {
    const l = ownLine(ctx, idx);
    if (l.type !== 'product') fail('That cart line does not exist.', 404);
    const q = Number(qty);
    if (!Number.isInteger(q)) fail('Enter a valid quantity.');
    if (q <= 0) db.run('DELETE FROM cart_lines WHERE id = ?', l.id);
    else {
      const p = core.liveProduct(db, l.product_id);
      if (!p) fail('That product does not exist.', 404);
      if (q > p.stock) fail(`Only ${p.stock} of "${p.name}" in stock.`);
      if (q > 50) fail('Enter a valid quantity.');
      db.run('UPDATE cart_lines SET qty = ? WHERE id = ?', q, l.id);
    }
    return cartView(ctx);
  });
}
function removeCartLine(ctx, idx) {
  const l = ownLine(ctx, idx);
  ctx.db.run('DELETE FROM cart_lines WHERE id = ?', l.id);
  return cartView(ctx);
}

/* ---------- stock + orders ---------- */
function takeStock(db, lines) {
  lines.forEach((l) => {
    const r = db.run('UPDATE products SET stock = stock - ? WHERE id = ? AND is_active = 1 AND stock >= ?', l.qty, l.product_id, l.qty);
    if (!r.changes) {
      const p = core.productById(db, l.product_id);
      fail(`"${p ? p.name : 'A product'}" no longer has enough stock.`);
    }
  });
}
function insertOrder(db, o, lines) {
  const id = db.run(`INSERT INTO orders (user_id, capsule_id, occasion_id, total, status, created_at, address, pay_mode, pay_status, txn_ref) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    o.user_id, o.capsule_id || null, o.occasion_id || null, o.total, 'placed', core.stamp(db), o.address, o.mode, o.pay_status, o.txn_ref).id;
  lines.forEach((l) => db.run('INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?,?,?,?)', id, l.product_id, l.qty, l.price));
  return id;
}
/* capsule -> order: reserves stock, freezes the price, schedules one delivery per stage */
function confirmCapsule(db, c, mode, txn, addressFallback) {
  const lines = caps.aggregate(db, c.id);
  takeStock(db, lines);
  const rcp = c.recipient_id ? db.get('SELECT address FROM recipients WHERE id = ?', c.recipient_id) : null;
  const addr = rcp ? rcp.address : addressFallback || '';
  const t = core.totals(db, c.id, c.gift_wrap, c.budget);
  db.run("UPDATE capsules SET status = 'confirmed', total_price = ? WHERE id = ?", t.total, c.id);
  const id = insertOrder(db, { user_id: c.owner_id, capsule_id: c.id, occasion_id: c.occasion_id, total: t.total, address: addr, mode, pay_status: 'success', txn_ref: txn }, lines);
  db.all('SELECT id, unlock_date FROM stages WHERE capsule_id = ? ORDER BY stage_no', c.id)
    .forEach((s) => db.run('INSERT INTO deliveries (order_id, stage_id, address, scheduled_date, status) VALUES (?,?,?,?,?)', id, s.id, addr, s.unlock_date, 'pending'));
  return { id, total: t.total, capsule_id: c.id };
}

function placeOrder(ctx, body) {
  const db = ctx.db, u = needUser(ctx);
  const { address, name, phone, mode, cardNumber } = body || {};
  return db.tx(() => {
    const cv = cartView(ctx);
    if (!cv.lines.length) fail('Your cart is empty.');
    const loose = cv.lines.filter((l) => l.type === 'product');
    const withCapsule = cv.lines.some((l) => l.type === 'capsule');
    if (loose.length && (!address || String(address).trim().length < 10)) fail('Enter a full delivery address for the products in your cart.');
    if (!['upi', 'card', 'netbanking', 'cod'].includes(mode)) fail('Choose a payment method.');
    if (mode === 'cod' && withCapsule) fail('Cash on delivery is not available for capsules. Choose another payment method.');
    if (mode === 'card') {
      const digits = String(cardNumber || '').replace(/\s/g, '');
      if (!/^\d{12,19}$/.test(digits)) fail('Enter a valid card number. Test card: 4242 4242 4242 4242.');
      if (digits.endsWith('0002')) fail('The test card was declined. Try 4242 4242 4242 4242.');
    }
    const txn = txnRef();
    const created = [];
    cv.lines.filter((l) => l.type === 'capsule').forEach((l) => {
      const c = core.capsuleRow(db, l.capsule.id);
      caps.checkReady(db, c);
      created.push(confirmCapsule(db, c, mode, txn, address));
    });
    if (loose.length) {
      const lines = loose.map((l) => ({ product_id: l.product.id, qty: l.qty, price: l.product.price }));
      takeStock(db, lines);
      const total = lines.reduce((a, l) => a + l.price * l.qty, 0);
      const addr = str(`${str(name, 80) || u.name}, ${str(address, 300)}${phone ? ' (' + str(phone, 20) + ')' : ''}`, 400);
      const id = insertOrder(db, { user_id: u.id, occasion_id: loose[0].occasion_id, total, address: addr, mode, pay_status: mode === 'cod' ? 'pending' : 'success', txn_ref: txn }, lines);
      created.push({ id, total, capsule_id: null });
    }
    db.run('DELETE FROM cart_lines WHERE user_id = ?', u.id);
    runScheduler(db);
    return created.map((o) => ({ id: o.id, total: o.total, capsule_id: o.capsule_id, txn_ref: txn }));
  });
}

function orderShape(db, o) {
  return {
    id: o.id, user_id: o.user_id, capsule_id: o.capsule_id, occasion_id: o.occasion_id, total: o.total, status: o.status, created_at: o.created_at, address: o.address,
    items: db.all('SELECT product_id, qty, price FROM order_items WHERE order_id = ? ORDER BY id', o.id),
    payment: { mode: o.pay_mode, status: o.pay_status, txn_ref: o.txn_ref },
    deliveries: db.all('SELECT id, stage_id, address, scheduled_date, status FROM deliveries WHERE order_id = ? ORDER BY id', o.id),
  };
}
const orders = (ctx) => ctx.db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', needUser(ctx).id).map((o) => orderShape(ctx.db, o));
function order(ctx, id) {
  const db = ctx.db, u = needUser(ctx);
  const o = db.get('SELECT * FROM orders WHERE id = ?', Number(id));
  if (!o || (o.user_id !== u.id && u.role !== 'admin')) fail('That order was not found.', 404);
  const out = orderShape(db, o);
  out.items.forEach((i) => { i.product = core.productById(db, i.product_id); });
  out.siblings = db.all('SELECT id FROM orders WHERE txn_ref = ? AND id != ? ORDER BY id', o.txn_ref, o.id).map((r) => r.id);
  if (o.capsule_id) {
    out.capsule = view(db, core.capsuleRow(db, o.capsule_id));
    out.deliveries.forEach((d) => { d.stage = out.capsule.stages.find((s) => s.id === d.stage_id); });
  }
  return out;
}

/* ---------- group funding ---------- */
const contribShape = (c) => ({ id: c.id, capsule_id: c.capsule_id, contributor_name: c.contributor_name, amount: c.amount, message: c.message, product_id: c.product_id, txn_ref: c.txn_ref, created_at: c.created_at, refunded: !!c.refunded });
function group(ctx, id) {
  const c = ownCapsule(ctx, id, false);
  if (c.type !== 'group') fail('This is not a group capsule.');
  const v = view(ctx.db, c);
  v.contributions = ctx.db.all('SELECT * FROM contributions WHERE capsule_id = ? ORDER BY id DESC', c.id).map(contribShape);
  return v;
}
function topUp(ctx, id, amount) {
  const c = ownCapsule(ctx, id, true);
  if (!c.share_token) fail('This capsule is not collecting money.');
  return contribute(ctx, c.share_token, { name: ctx.user.name + ' (organiser)', amount, message: 'Topped up the rest.' });
}
const byShareToken = (db, tok) => (typeof tok === 'string' && tok.length >= 8 && tok.length <= 40 ? db.get('SELECT * FROM capsules WHERE share_token = ?', tok) : null);

function publicGroup({ db }, tok) {
  const c = byShareToken(db, tok);
  if (!c) return null;
  const v = view(db, c);
  const raised = v.raised;
  return {
    id: c.id, title: c.title, status: c.status, occasion: v.occasion, organiser: v.owner.name, recipient_first_name: v.recipient ? v.recipient.name.split(' ')[0] : 'them',
    target: c.target_amount, raised, deadline: c.funding_deadline, stage_count: v.stages.length, first_unlock: v.stages.map((s) => s.unlock_date).sort()[0],
    contributions: db.all('SELECT * FROM contributions WHERE capsule_id = ? AND refunded = 0 ORDER BY id DESC', c.id).map((x) => ({
      id: x.id, name: x.contributor_name, amount: x.amount, message: x.message, product: x.product_id ? core.productById(db, x.product_id) : null, created_at: x.created_at,
    })),
    gift_ideas: core.activeProducts(db).filter((p) => p.stock > 0 && p.price <= Math.max(300, c.target_amount - raised)).sort((a, b) => a.price - b.price).slice(0, 6),
  };
}
function contribute(ctx, tok, body) {
  const db = ctx.db;
  const { name, amount, message, product_id } = body || {};
  return db.tx(() => {
    const c = byShareToken(db, tok);
    if (!c) fail('This contribution link is not valid.', 404);
    if (c.status !== 'funding') fail(c.status === 'cancelled' ? 'Funding for this capsule has ended.' : 'This capsule is already fully funded.');
    if (c.funding_deadline < core.today(db)) fail('The funding deadline has passed.');
    const who = str(name, 80);
    if (!who) fail('Enter your name so the group knows who contributed.');
    const remaining = c.target_amount - core.raised(db, c.id);
    let amt = Number(amount), pid = null, target = c.target_amount;
    if (product_id) {
      const p = core.liveProduct(db, product_id);
      if (!p || p.stock < 1) fail('That item is out of stock.');
      pid = p.id; amt = p.price;
      /* an item raises the target and the raised amount by the same price; it goes into the last stage */
      const last = db.get('SELECT stage_no FROM stages WHERE capsule_id = ? ORDER BY stage_no DESC LIMIT 1', c.id);
      caps.addItemTo(db, c.id, last.stage_no, p.id, 1);
      target += p.price;
      db.run('UPDATE capsules SET target_amount = ? WHERE id = ?', target, c.id);
    } else {
      const min = Math.min(10, remaining);
      if (!Number.isInteger(amt) || amt < min) fail(`The smallest contribution is ₹${min.toLocaleString('en-IN')}. Enter a whole number of rupees.`);
      if (amt > remaining) fail(`The capsule only needs ₹${remaining.toLocaleString('en-IN')} more. Enter that amount or less.`);
    }
    db.run('INSERT INTO contributions (capsule_id, contributor_name, amount, message, product_id, txn_ref, created_at) VALUES (?,?,?,?,?,?,?)', c.id, who, amt, str(message, 240), pid, txnRef(), core.stamp(db));
    const raised = core.raised(db, c.id);
    let confirmed = false;
    if (raised >= target) {
      confirmCapsule(db, core.capsuleRow(db, c.id), 'group', 'rzp_test_grp' + c.id, '');
      const owner = db.get('SELECT email FROM users WHERE id = ?', c.owner_id);
      core.email(db, c.owner_id, owner.email, `"${c.title}" is fully funded`, 'The target was reached. Your order has been placed and the first stage is scheduled.', 'group.html?id=' + c.id, 'funding');
      confirmed = true;
      runScheduler(db);
    }
    return { ok: true, confirmed, raised, target };
  });
}

/* ---------- recipient side (link with a private token, no login) ---------- */
function recipientView({ db }, tok) {
  const c = typeof tok === 'string' && tok.length >= 8 && tok.length <= 40 ? db.get('SELECT * FROM capsules WHERE recipient_token = ?', tok) : null;
  if (!c || !['confirmed', 'active', 'completed'].includes(c.status)) return null;
  const v = view(db, c);
  const t = core.today(db);
  const unlocked = v.stages.some((s) => s.status !== 'locked');
  return {
    title: c.title, occasion: v.occasion, from: v.owner.name, to: v.recipient ? v.recipient.name : 'you', thank_you: c.thank_you, status: c.status, today: t,
    stages: v.stages.map((s) => ({
      stage_no: s.stage_no, unlock_date: s.unlock_date, status: s.status, days_left: require('./util').daysBetween(t, s.unlock_date),
      message: s.status === 'locked' ? '' : s.message,
      items: s.status === 'locked' ? [] : s.items.map((i) => ({ name: i.product.name, emoji: i.product.emoji, qty: i.qty })),
    })),
    /* friends' notes stay sealed until the first stage opens, so the surprise is not spoiled by reading the API */
    notes: c.type === 'group' && unlocked ? db.all("SELECT contributor_name AS name, message FROM contributions WHERE capsule_id = ? AND message != '' AND refunded = 0 ORDER BY id", c.id) : [],
    notes_unlocked: unlocked,
  };
}
function thankYou({ db }, tok, text) {
  const c = typeof tok === 'string' && tok.length >= 8 && tok.length <= 40 ? db.get('SELECT * FROM capsules WHERE recipient_token = ?', tok) : null;
  if (!c || !['confirmed', 'active', 'completed'].includes(c.status)) fail('This link is not valid.', 404);
  const msg = str(text, 300);
  if (!msg) fail('Write a few words first.');
  db.tx(() => {
    db.run('UPDATE capsules SET thank_you = ? WHERE id = ?', msg, c.id);
    const owner = db.get('SELECT email FROM users WHERE id = ?', c.owner_id);
    core.email(db, c.owner_id, owner.email, `A thank-you for "${c.title}"`, msg, 'capsules.html', 'thanks');
  });
  return true;
}

module.exports = { cart, cartCount, addProductToCart, addCapsuleToCart, setCartQty, removeCartLine, placeOrder, orders, order, group, topUp, publicGroup, contribute, recipientView, thankYou, orderShape };
