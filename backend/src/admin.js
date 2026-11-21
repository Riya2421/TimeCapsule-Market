'use strict';
const { fail, str, addDays, isoDate } = require('./util');
const core = require('./core');
const catalog = require('./catalog');
const { needAdmin } = core;
const A = (fn) => (ctx, ...a) => { needAdmin(ctx); return fn(ctx, ...a); };

/* local calendar day of a stored UTC timestamp */
const localDay = (iso) => isoDate(new Date(iso));

const adminStats = A(({ db }) => {
  const t = core.today(db);
  const paid = db.all("SELECT * FROM orders WHERE status != 'cancelled'");
  const byOcc = {};
  paid.forEach((o) => { const k = o.occasion_id || 0; byOcc[k] = byOcc[k] || { occasion_id: k, orders: 0, revenue: 0 }; byOcc[k].orders++; byOcc[k].revenue += o.total; });
  const names = Object.fromEntries(db.all('SELECT id, name FROM occasions').map((o) => [o.id, o.name]));
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(t, -i);
    const rows = paid.filter((o) => localDay(o.created_at) === day);
    days.push({ day, revenue: rows.reduce((a, o) => a + o.total, 0), orders: rows.length });
  }
  const top = db.all(`SELECT oi.product_id, SUM(oi.qty) AS units FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled'
                      GROUP BY oi.product_id ORDER BY units DESC, oi.product_id LIMIT 6`).map((r) => ({ product: core.productById(db, r.product_id), units: r.units }));
  const users = Object.fromEntries(db.all('SELECT id, name FROM users').map((u) => [u.id, u.name]));
  const shape = require('./orders').orderShape;
  return {
    today: t,
    ordersToday: paid.filter((o) => localDay(o.created_at) === t).length,
    ordersTotal: paid.length,
    revenue: paid.reduce((a, o) => a + o.total, 0),
    activeCapsules: db.get("SELECT COUNT(*) AS n FROM capsules WHERE status IN ('confirmed','active')").n,
    funding: db.all("SELECT id, title, target_amount, funding_deadline FROM capsules WHERE status = 'funding' ORDER BY id").map((c) => ({ id: c.id, title: c.title, raised: core.raised(db, c.id), target: c.target_amount, deadline: c.funding_deadline })),
    byOccasion: Object.values(byOcc).map((r) => Object.assign(r, { name: r.occasion_id ? names[r.occasion_id] : 'Other (no occasion)' })).sort((a, b) => b.revenue - a.revenue),
    days, top,
    lowStock: core.withTags(db, db.all('SELECT * FROM products WHERE is_active = 1 AND stock <= 12 ORDER BY stock, id LIMIT 5')),
    recent: db.all('SELECT * FROM orders ORDER BY id DESC LIMIT 6').map((o) => Object.assign(shape(db, o), { customer: users[o.user_id] })),
  };
});

/* ---------- products ---------- */
const adminProducts = A(({ db }) => {
  const vend = Object.fromEntries(db.all('SELECT id, shop_name FROM vendors').map((v) => [v.id, v.shop_name]));
  return core.activeProducts(db).map((p) => Object.assign(p, { vendor: vend[p.vendor_id] }));
});
const adminVendors = A(({ db }) => db.all('SELECT * FROM vendors ORDER BY id'));
const adminSaveProduct = A(({ db }, p) => {
  p = p || {};
  const name = str(p.name, 120);
  if (!name) fail('Enter a product name.');
  const price = Number(p.price), stock = Number(p.stock);
  if (!Number.isInteger(price) || price <= 0 || price > 10000000) fail('Enter a price above zero, in whole rupees.');
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) fail('Stock must be a whole number, zero or more.');
  const tags = [...new Set((Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',')).map((t) => str(t, 40).toLowerCase()).filter(Boolean))].slice(0, 12);
  const vendor = db.get('SELECT id FROM vendors WHERE id = ?', Number(p.vendor_id) || db.get('SELECT MIN(id) AS id FROM vendors').id);
  if (!vendor) fail('Choose a vendor.');
  const tint = /^#[0-9a-f]{3,8}$/i.test(p.tint || '') ? p.tint : '#e6ebfd';
  return db.tx(() => {
    let id = Number(p.id) || null;
    if (id) {
      if (!db.get('SELECT id FROM products WHERE id = ? AND is_active = 1', id)) fail('Product not found.', 404);
      db.run('UPDATE products SET name=?, price=?, stock=?, emoji=?, blurb=?, vendor_id=?, tint=? WHERE id=?', name, price, stock, str(p.emoji, 16) || '🎁', str(p.blurb, 300), vendor.id, tint, id);
      db.run('DELETE FROM product_tags WHERE product_id = ?', id);
    } else {
      id = db.run('INSERT INTO products (name, price, stock, emoji, blurb, vendor_id, tint) VALUES (?,?,?,?,?,?,?)', name, price, stock, str(p.emoji, 16) || '🎁', str(p.blurb, 300), vendor.id, tint).id;
    }
    tags.forEach((t) => db.run('INSERT INTO product_tags (product_id, tag) VALUES (?,?)', id, t));
    return true;
  });
});
/* retired products stay in the database (old orders and finished capsules still point at them) but leave the shop */
const adminDeleteProduct = A(({ db }, id) => db.tx(() => {
  id = Number(id);
  const inUse = db.get(`SELECT i.id FROM stage_items i JOIN stages s ON s.id = i.stage_id JOIN capsules c ON c.id = s.capsule_id
                        WHERE i.product_id = ? AND c.status IN ('draft','funding','confirmed','active') LIMIT 1`, id);
  if (inUse) fail('This product is inside a live capsule. Set its stock to 0 instead of deleting it.');
  db.run('UPDATE products SET is_active = 0 WHERE id = ?', id);
  db.run('DELETE FROM collection_products WHERE product_id = ?', id);
  db.run('DELETE FROM cart_lines WHERE product_id = ?', id);
  return true;
}));

/* ---------- collections ---------- */
const adminCollections = A(({ db }) => catalog.collectionsList(db));
const adminSaveCollection = A(({ db }, c) => {
  c = c || {};
  const title = str(c.title, 120);
  if (!title) fail('Enter a collection title.');
  const ids = [...new Set((Array.isArray(c.productIds) ? c.productIds : []).map(Number))];
  if (ids.length < 2) fail('Pick at least two products for a collection.');
  return db.tx(() => {
    if (!db.get('SELECT id FROM occasions WHERE id = ?', Number(c.occasion_id))) fail('Choose an occasion.');
    ids.forEach((pid) => { if (!db.get('SELECT id FROM products WHERE id = ? AND is_active = 1', pid)) fail('One of those products no longer exists.'); });
    let id = Number(c.id) || null;
    if (id) {
      if (!db.get('SELECT id FROM collections WHERE id = ?', id)) fail('Collection not found.', 404);
      db.run('UPDATE collections SET occasion_id=?, title=?, blurb=? WHERE id=?', Number(c.occasion_id), title, str(c.blurb, 300), id);
      db.run('DELETE FROM collection_products WHERE collection_id = ?', id);
    } else id = db.run('INSERT INTO collections (occasion_id, title, blurb) VALUES (?,?,?)', Number(c.occasion_id), title, str(c.blurb, 300)).id;
    ids.forEach((pid, i) => db.run('INSERT INTO collection_products (collection_id, product_id, position) VALUES (?,?,?)', id, pid, i));
    return true;
  });
});
const adminDeleteCollection = A(({ db }, id) => { db.run('DELETE FROM collections WHERE id = ?', Number(id)); return true; });

/* ---------- quiz ---------- */
const adminSaveQuizOption = A(({ db }, qid, opt) => db.tx(() => {
  opt = opt || {};
  const q = db.get('SELECT id FROM quiz_questions WHERE id = ?', Number(qid));
  if (!q) fail('Question not found.', 404);
  const label = str(opt.text, 120);
  if (!label) fail('Enter the answer text.');
  const tag = str(opt.tag, 40).toLowerCase();
  if (opt.id) {
    const o = db.get('SELECT * FROM quiz_options WHERE id = ? AND question_id = ?', Number(opt.id), q.id);
    if (!o) fail('Answer not found.', 404);
    db.run('UPDATE quiz_options SET label = ? WHERE id = ?', label, o.id);
    if (o.tag !== null) { if (!tag) fail('Enter a tag for this answer.'); db.run('UPDATE quiz_options SET tag = ? WHERE id = ?', tag, o.id); }
    return true;
  }
  const sample = db.get('SELECT * FROM quiz_options WHERE question_id = ? ORDER BY position, id LIMIT 1', q.id) || { tag: '' };
  const pos = db.get('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM quiz_options WHERE question_id = ?', q.id).p;
  if (sample.tag !== null) {
    if (!tag) fail('Enter a tag for this answer.');
    db.run('INSERT INTO quiz_options (question_id, position, label, tag) VALUES (?,?,?,?)', q.id, pos, label, tag);
  } else if (sample.occasion_id !== null) {
    const occ = db.get('SELECT id FROM occasions WHERE id = ?', Number(opt.occasion_id) || 1);
    if (!occ) fail('Choose an occasion.');
    db.run('INSERT INTO quiz_options (question_id, position, label, occasion_id) VALUES (?,?,?,?)', q.id, pos, label, occ.id);
  } else {
    const b = Number(opt.budget) || 1500;
    if (!Number.isInteger(b) || b <= 0) fail('Enter a budget above zero.');
    db.run('INSERT INTO quiz_options (question_id, position, label, budget) VALUES (?,?,?,?)', q.id, pos, label, b);
  }
  return true;
}));
const adminDeleteQuizOption = A(({ db }, qid, oid) => db.tx(() => {
  const n = db.get('SELECT COUNT(*) AS n FROM quiz_options WHERE question_id = ?', Number(qid)).n;
  if (n <= 2) fail('A question needs at least two answers.');
  db.run('DELETE FROM quiz_options WHERE id = ? AND question_id = ?', Number(oid), Number(qid));
  return true;
}));

/* ---------- orders and capsules ---------- */
const adminOrders = A(({ db }) => {
  const shape = require('./orders').orderShape;
  const users = Object.fromEntries(db.all('SELECT id, name FROM users').map((u) => [u.id, u.name]));
  const occ = Object.fromEntries(db.all('SELECT id, name FROM occasions').map((o) => [o.id, o.name]));
  const caps = Object.fromEntries(db.all('SELECT id, title FROM capsules').map((c) => [c.id, c.title]));
  return db.all('SELECT * FROM orders ORDER BY id DESC').map((o) => Object.assign(shape(db, o), {
    customer: users[o.user_id], occasion: o.occasion_id ? occ[o.occasion_id] : '', capsule_title: o.capsule_id ? caps[o.capsule_id] : '',
  }));
});
const adminSetOrderStatus = A(({ db }, id, status) => db.tx(() => {
  if (!['placed', 'packed', 'shipped', 'delivered', 'cancelled'].includes(status)) fail('Unknown status.');
  const o = db.get('SELECT id FROM orders WHERE id = ?', Number(id));
  if (!o) fail('Order not found.', 404);
  db.run('UPDATE orders SET status = ? WHERE id = ?', status, o.id);
  if (status === 'delivered') db.run("UPDATE deliveries SET status = 'delivered' WHERE order_id = ? AND status = 'dispatched'", o.id);
  return true;
}));
const adminCapsules = A(({ db }) => db.all('SELECT * FROM capsules ORDER BY id').map((c) => core.view(db, c)).map((c) => ({
  id: c.id, title: c.title, status: c.status, type: c.type, owner: c.owner.name, recipient: c.recipient ? c.recipient.name : '',
  stages: c.stages.map((s) => ({ stage_no: s.stage_no, unlock_date: s.unlock_date, status: s.status })), total: c.totals.total,
})));

module.exports = { adminStats, adminProducts, adminVendors, adminSaveProduct, adminDeleteProduct, adminCollections, adminSaveCollection, adminDeleteCollection, adminSaveQuizOption, adminDeleteQuizOption, adminOrders, adminSetOrderStatus, adminCapsules };
