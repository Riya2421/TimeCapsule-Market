'use strict';
const { fail, addDays, daysBetween, validDate, token, str, posInt } = require('./util');
const core = require('./core');
const catalog = require('./catalog');
const { CFG, needUser, ownCapsule, needDraft, view } = core;

/* ---------- recipients ---------- */
const RFIELDS = ['name', 'relation', 'interests', 'birthday', 'email', 'address'];
const RMAX = { name: 80, relation: 60, interests: 200, birthday: 10, email: 190, address: 300 };

const recipients = (ctx) => ctx.db.all('SELECT * FROM recipients WHERE user_id = ? ORDER BY id', needUser(ctx).id);
function saveRecipient(ctx, r) {
  const u = needUser(ctx), db = ctx.db;
  if (!r || !str(r.name, 80)) fail("Enter the recipient's name.");
  if (r.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(r.email).trim())) fail('Enter a valid email address for the recipient.');
  if (r.birthday && !validDate(String(r.birthday))) fail('Enter the birthday as a valid date.');
  const v = {};
  RFIELDS.forEach((k) => { v[k] = str(r[k], RMAX[k]); });
  if (r.id) {
    const ex = db.get('SELECT id FROM recipients WHERE id = ? AND user_id = ?', Number(r.id), u.id);
    if (!ex) fail('Recipient not found.', 404);
    db.run(`UPDATE recipients SET ${RFIELDS.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, ...RFIELDS.map((k) => v[k]), ex.id);
    return db.get('SELECT * FROM recipients WHERE id = ?', ex.id);
  }
  const { id } = db.run(`INSERT INTO recipients (user_id, ${RFIELDS.join(', ')}) VALUES (?, ${RFIELDS.map(() => '?').join(', ')})`, u.id, ...RFIELDS.map((k) => v[k]));
  return db.get('SELECT * FROM recipients WHERE id = ?', id);
}
function deleteRecipient(ctx, id) {
  const u = needUser(ctx), db = ctx.db;
  const own = db.get('SELECT id FROM recipients WHERE id = ? AND user_id = ?', Number(id), u.id);
  if (!own) return true;
  if (db.get("SELECT id FROM capsules WHERE recipient_id = ? AND status NOT IN ('completed','cancelled')", own.id)) fail('This recipient has a capsule in progress. Finish or cancel it first.');
  db.run('DELETE FROM recipients WHERE id = ?', own.id);
  return true;
}
function checkRecipient(ctx, id) {
  if (id === null || id === undefined || id === '') return null;
  const r = ctx.db.get('SELECT id FROM recipients WHERE id = ? AND user_id = ?', Number(id), ctx.user.id);
  if (!r) fail('Recipient not found.', 404);
  return r.id;
}
function checkOccasion(ctx, id) {
  if (id === null || id === undefined || id === '') return null;
  const o = ctx.db.get('SELECT id FROM occasions WHERE id = ?', Number(id));
  if (!o) fail('That occasion does not exist.', 404);
  return o.id;
}

/* ---------- building blocks ---------- */
function insertCapsule(ctx, f) {
  const db = ctx.db;
  return db.run(`INSERT INTO capsules (owner_id, recipient_id, occasion_id, title, type, status, recipient_token, gift_wrap, budget, created_at)
                 VALUES (?,?,?,?,?,'draft',?,?,?,?)`,
    ctx.user.id, f.recipient_id || null, f.occasion_id || null, str(f.title, 120) || 'Untitled capsule', f.type || 'solo', token(), f.gift_wrap ? 1 : 0, f.budget === undefined ? 2000 : f.budget, core.today(db)).id;
}
function insertStage(db, capsuleId, unlock, message) {
  const no = db.get('SELECT COALESCE(MAX(stage_no), 0) + 1 AS n FROM stages WHERE capsule_id = ?', capsuleId).n;
  const id = db.run('INSERT INTO stages (capsule_id, stage_no, unlock_date, message) VALUES (?,?,?,?)', capsuleId, no, unlock, message || '').id;
  return { id, stage_no: no };
}
function stageOf(db, capsuleId, stageNo) {
  const s = db.get('SELECT * FROM stages WHERE capsule_id = ? AND stage_no = ?', capsuleId, Number(stageNo));
  if (!s) fail('That stage does not exist.', 404);
  return s;
}
function addItemTo(db, capsuleId, stageNo, productId, qty) {
  const p = core.liveProduct(db, productId);
  if (!p) fail('That product does not exist.', 404);
  const s = stageOf(db, capsuleId, stageNo);
  const q0 = posInt(qty === undefined ? 1 : qty);
  const ex = db.get('SELECT id, qty FROM stage_items WHERE stage_id = ? AND product_id = ?', s.id, p.id);
  const q = (ex ? ex.qty : 0) + q0;
  if (q > p.stock) fail(`Only ${p.stock} of "${p.name}" in stock.`);
  if (ex) db.run('UPDATE stage_items SET qty = ? WHERE id = ?', q, ex.id);
  else db.run('INSERT INTO stage_items (stage_id, product_id, qty) VALUES (?,?,?)', s.id, p.id, q);
}
/* total quantity per product across all stages (what the order will contain) */
function aggregate(db, capsuleId) {
  return db.all(`SELECT i.product_id, SUM(i.qty) AS qty, p.price FROM stage_items i JOIN stages s ON s.id = i.stage_id JOIN products p ON p.id = i.product_id
                 WHERE s.capsule_id = ? GROUP BY i.product_id, p.price ORDER BY i.product_id`, capsuleId);
}
function checkReady(db, c) {
  const t = core.totals(db, c.id, c.gift_wrap, c.budget);
  if (!t.count) fail('Add at least one item to the capsule first.');
  if (!c.recipient_id) fail('Choose who the capsule is for.');
  const r = db.get('SELECT address FROM recipients WHERE id = ?', c.recipient_id);
  if (!r || !r.address) fail('Add a delivery address for the recipient.');
  if (db.get('SELECT s.id FROM stages s WHERE s.capsule_id = ? AND NOT EXISTS (SELECT 1 FROM stage_items i WHERE i.stage_id = s.id)', c.id)) fail('Every stage needs at least one item. Remove empty stages or add items to them.');
  const tm = addDays(core.today(db), 1);
  if (db.get('SELECT id FROM stages WHERE capsule_id = ? AND (unlock_date < ?)', c.id, tm)) fail('Every stage needs an unlock date from tomorrow onward.');
  return t;
}

const PLAN3 = (t, msgs) => [[addDays(t, 1), msgs[0]], [addDays(t, 30), msgs[1]], [addDays(t, 365), msgs[2]]];

/* ---------- public API ---------- */
const capsules = (ctx) => ctx.db.all('SELECT * FROM capsules WHERE owner_id = ? ORDER BY id DESC', needUser(ctx).id).map((c) => view(ctx.db, c));
const capsule = (ctx, id) => view(ctx.db, ownCapsule(ctx, id, false));

function newCapsule(ctx, o) {
  needUser(ctx);
  o = o || {};
  const db = ctx.db;
  return db.tx(() => {
    const occ = checkOccasion(ctx, o.occasion_id);
    const occRow = occ ? db.get('SELECT name FROM occasions WHERE id = ?', occ) : null;
    const id = insertCapsule(ctx, { occasion_id: occ, recipient_id: checkRecipient(ctx, o.recipient_id), title: o.title || (occRow ? occRow.name + ' capsule' : 'My capsule') });
    insertStage(db, id, addDays(core.today(db), 1), 'Open this one first.');
    return view(db, core.capsuleRow(db, id));
  });
}
function buildFromQuiz(ctx, answers, o) {
  needUser(ctx);
  o = o || {};
  const db = ctx.db;
  return db.tx(() => {
    const a = catalog.cleanAnswers(answers);
    const budget = a.budget || 2500;
    const picked = catalog.pickBundle(catalog.scoreWith(db, a), budget);
    const occ = checkOccasion(ctx, a.occasion_id);
    const occRow = occ ? db.get('SELECT name FROM occasions WHERE id = ?', occ) : null;
    const id = insertCapsule(ctx, { title: o.title || (occRow ? occRow.name + ' capsule' : 'My capsule'), occasion_id: occ, budget, recipient_id: checkRecipient(ctx, o.recipient_id) });
    const n = Math.max(1, Math.min(3, picked.length));
    const plan = PLAN3(core.today(db), ['Open this one first. It is the start of something.', 'A month later. Hope the days have been kind.', 'A year on. Look how far you have come.']);
    for (let i = 0; i < n; i++) insertStage(db, id, plan[i][0], plan[i][1]);
    picked.forEach((p, i) => addItemTo(db, id, (i % n) + 1, p.id, 1));
    return view(db, core.capsuleRow(db, id));
  });
}
function capsuleFromCollection(ctx, collectionId) {
  needUser(ctx);
  const db = ctx.db;
  return db.tx(() => {
    const col = catalog.collectionsList(db).find((c) => c.id === Number(collectionId));
    if (!col) fail('That collection does not exist.', 404);
    const prods = col.products.filter((p) => p.stock > 0);
    const budget = Math.ceil((prods.reduce((a, p) => a + p.price, 0) + 300) / 500) * 500;
    const id = insertCapsule(ctx, { occasion_id: col.occasion_id, title: col.title, budget });
    const n = Math.max(1, Math.min(3, prods.length));
    const plan = PLAN3(core.today(db), ['Open this one first.', 'A month later.', 'One year on.']);
    for (let i = 0; i < n; i++) insertStage(db, id, plan[i][0], plan[i][1]);
    prods.forEach((p, i) => addItemTo(db, id, (i % n) + 1, p.id, 1));
    return view(db, core.capsuleRow(db, id));
  });
}

function updateCapsule(ctx, id, patch) {
  const db = ctx.db;
  return db.tx(() => {
    const c = ownCapsule(ctx, id, true); needDraft(c);
    patch = patch || {};
    const set = {};
    if ('title' in patch) set.title = str(patch.title, 120) || 'Untitled capsule';
    if ('occasion_id' in patch) set.occasion_id = checkOccasion(ctx, patch.occasion_id);
    if ('recipient_id' in patch) set.recipient_id = checkRecipient(ctx, patch.recipient_id);
    if ('gift_wrap' in patch) set.gift_wrap = patch.gift_wrap === true || patch.gift_wrap === 'true' || patch.gift_wrap === 1 ? 1 : 0;
    if ('budget' in patch) set.budget = Math.min(10000000, Math.max(0, Math.floor(Number(patch.budget)) || 0));
    if ('type' in patch) { if (!['solo', 'group'].includes(patch.type)) fail('Choose solo or group.'); set.type = patch.type; }
    const keys = Object.keys(set);
    if (keys.length) db.run(`UPDATE capsules SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, ...keys.map((k) => set[k]), c.id);
    return view(db, core.capsuleRow(db, c.id));
  });
}
function addStage(ctx, id) {
  const db = ctx.db;
  return db.tx(() => {
    const c = ownCapsule(ctx, id, true); needDraft(c);
    const n = db.get('SELECT COUNT(*) AS n FROM stages WHERE capsule_id = ?', c.id).n;
    if (n >= CFG.MAX_STAGES) fail(`A capsule can have up to ${CFG.MAX_STAGES} stages.`);
    const last = db.get('SELECT MAX(unlock_date) AS d FROM stages WHERE capsule_id = ?', c.id).d || core.today(db);
    insertStage(db, c.id, addDays(last, 30), '');
    return view(db, c);
  });
}
function removeStage(ctx, id, stageNo) {
  const db = ctx.db;
  return db.tx(() => {
    const c = ownCapsule(ctx, id, true); needDraft(c);
    if (db.get('SELECT COUNT(*) AS n FROM stages WHERE capsule_id = ?', c.id).n <= 1) fail('A capsule needs at least one stage.');
    db.run('DELETE FROM stages WHERE capsule_id = ? AND stage_no = ?', c.id, Number(stageNo));
    db.all('SELECT id FROM stages WHERE capsule_id = ? ORDER BY stage_no', c.id).forEach((s, i) => db.run('UPDATE stages SET stage_no = ? WHERE id = ?', i + 1, s.id));
    return view(db, c);
  });
}
function updateStage(ctx, id, stageNo, patch) {
  const db = ctx.db;
  return db.tx(() => {
    const c = ownCapsule(ctx, id, true); needDraft(c);
    const s = stageOf(db, c.id, stageNo);
    patch = patch || {};
    if ('unlock_date' in patch) {
      if (!validDate(patch.unlock_date)) fail('Pick a valid unlock date.');
      if (patch.unlock_date < addDays(core.today(db), 1)) fail('Pick an unlock date from tomorrow onward.');
      db.run('UPDATE stages SET unlock_date = ? WHERE id = ?', patch.unlock_date, s.id);
    }
    if ('message' in patch) db.run('UPDATE stages SET message = ? WHERE id = ?', str(patch.message, 400), s.id);
    return view(db, c);
  });
}
function addItem(ctx, id, stageNo, productId, qty) {
  const db = ctx.db;
  return db.tx(() => {
    const c = ownCapsule(ctx, id, true); needDraft(c);
    addItemTo(db, c.id, stageNo, productId, qty || 1);
    return view(db, c);
  });
}
function setItemQty(ctx, id, stageNo, productId, qty) {
  const db = ctx.db;
  return db.tx(() => {
    const c = ownCapsule(ctx, id, true); needDraft(c);
    const s = stageOf(db, c.id, stageNo);
    const it = db.get('SELECT id FROM stage_items WHERE stage_id = ? AND product_id = ?', s.id, Number(productId));
    if (!it) fail('That item is not in this stage.');
    const q = Number(qty);
    if (!Number.isInteger(q)) fail('Enter a valid quantity.');
    if (q <= 0) db.run('DELETE FROM stage_items WHERE id = ?', it.id);
    else {
      const p = core.productById(db, productId);
      if (q > p.stock) fail(`Only ${p.stock} of "${p.name}" in stock.`);
      if (q > 50) fail('Enter a valid quantity.');
      db.run('UPDATE stage_items SET qty = ? WHERE id = ?', q, it.id);
    }
    return view(db, c);
  });
}
function moveItem(ctx, id, fromStage, productId, toStage) {
  const db = ctx.db;
  return db.tx(() => {
    const c = ownCapsule(ctx, id, true); needDraft(c);
    const a = db.get('SELECT * FROM stages WHERE capsule_id = ? AND stage_no = ?', c.id, Number(fromStage));
    const b = db.get('SELECT * FROM stages WHERE capsule_id = ? AND stage_no = ?', c.id, Number(toStage));
    const it = a && db.get('SELECT * FROM stage_items WHERE stage_id = ? AND product_id = ?', a.id, Number(productId));
    if (!it || !b) fail('Could not move that item.');
    if (a.id !== b.id) {
      const ex = db.get('SELECT id FROM stage_items WHERE stage_id = ? AND product_id = ?', b.id, it.product_id);
      if (ex) { db.run('UPDATE stage_items SET qty = qty + ? WHERE id = ?', it.qty, ex.id); db.run('DELETE FROM stage_items WHERE id = ?', it.id); }
      else db.run('UPDATE stage_items SET stage_id = ? WHERE id = ?', b.id, it.id);
    }
    return view(db, c);
  });
}
function deleteCapsule(ctx, id) {
  const c = ownCapsule(ctx, id, true);
  if (c.status !== 'draft') fail('Only drafts can be deleted.');
  ctx.db.run('DELETE FROM capsules WHERE id = ?', c.id);
  return true;
}
function startFunding(ctx, id, deadline) {
  const db = ctx.db;
  return db.tx(() => {
    const c = ownCapsule(ctx, id, true);
    if (c.status !== 'draft') fail('This capsule has already started.');
    if (c.type !== 'group') fail('Switch the capsule to a group capsule first.');
    const t = checkReady(db, c);
    const today = core.today(db);
    if (!validDate(deadline) || deadline <= today) fail('Pick a funding deadline after today.');
    const first = db.get('SELECT MIN(unlock_date) AS d FROM stages WHERE capsule_id = ?', c.id).d;
    if (deadline >= first) fail('The funding deadline must be before the first stage unlocks.');
    db.run("UPDATE capsules SET status = 'funding', funding_deadline = ?, target_amount = ?, share_token = ? WHERE id = ?", deadline, t.total, token(), c.id);
    db.run('DELETE FROM cart_lines WHERE capsule_id = ?', c.id);
    return view(db, core.capsuleRow(db, c.id));
  });
}
function cancelCapsule(ctx, id) {
  const db = ctx.db;
  return db.tx(() => {
    const c = ownCapsule(ctx, id, true);
    if (c.status !== 'funding') fail('Only a capsule that is collecting money can be cancelled.');
    db.run("UPDATE capsules SET status = 'cancelled' WHERE id = ?", c.id);
    db.run('UPDATE contributions SET refunded = 1 WHERE capsule_id = ?', c.id);
    return view(db, core.capsuleRow(db, c.id));
  });
}
function repeatCapsule(ctx, id, mode) {
  const db = ctx.db;
  return db.tx(() => {
    const src = ownCapsule(ctx, id, true);
    const stages = core.stagesOf(db, src.id);
    if (!stages.length) fail('That capsule has no stages to repeat.');
    const newId = insertCapsule(ctx, {
      title: str(src.title + ' (again)', 120), occasion_id: src.occasion_id, recipient_id: src.recipient_id,
      budget: mode === 'upgrade' ? (src.budget || 2000) + 500 : src.budget, gift_wrap: !!src.gift_wrap, type: src.type === 'group' ? 'group' : 'solo',
    });
    const shift = daysBetween(stages[0].unlock_date, addDays(core.today(db), 1));
    stages.forEach((s) => {
      const ns = insertStage(db, newId, addDays(s.unlock_date, shift), s.message);
      s.items.forEach((i) => {
        const p = core.liveProduct(db, i.product_id);
        if (p && p.stock >= i.qty) db.run('INSERT INTO stage_items (stage_id, product_id, qty) VALUES (?,?,?)', ns.id, p.id, i.qty);
      });
    });
    return view(db, core.capsuleRow(db, newId));
  });
}

module.exports = {
  recipients, saveRecipient, deleteRecipient, capsules, capsule, newCapsule, buildFromQuiz, capsuleFromCollection, updateCapsule, addStage, removeStage, updateStage,
  addItem, setItemQty, moveItem, deleteCapsule, startFunding, cancelCapsule, repeatCapsule,
  /* shared with orders.js */ checkReady, aggregate, addItemTo, insertStage,
};
