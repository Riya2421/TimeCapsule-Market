'use strict';
const { fail } = require('./util');
const core = require('./core');

/* ---------- occasions ---------- */
const occasions = ({ db }) => db.all('SELECT * FROM occasions ORDER BY id');
const occasion = ({ db }, slugOrId) =>
  db.get('SELECT * FROM occasions WHERE slug = ? OR id = ?', String(slugOrId), Number(slugOrId) || -1);

/* ---------- collections ---------- */
function collectionsList(db, { occasion_id, maxBudget } = {}) {
  const cols = db.all('SELECT * FROM collections ORDER BY id').filter((c) => !occasion_id || c.occasion_id === Number(occasion_id));
  const occs = Object.fromEntries(db.all('SELECT * FROM occasions').map((o) => [o.id, o]));
  const links = db.all('SELECT collection_id, product_id FROM collection_products ORDER BY position');
  const prods = Object.fromEntries(core.activeProducts(db).map((p) => [p.id, p]));
  return cols.map((c) => {
    const productIds = links.filter((l) => l.collection_id === c.id).map((l) => l.product_id);
    const products = productIds.map((id) => prods[id]).filter(Boolean);
    return { id: c.id, occasion_id: c.occasion_id, title: c.title, blurb: c.blurb, productIds, products, total: products.reduce((a, p) => a + p.price, 0), occasion: occs[c.occasion_id] };
  }).filter((c) => !maxBudget || c.total <= Number(maxBudget));
}
const collections = ({ db }, q) => collectionsList(db, q || {});
const collection = ({ db }, id) => collectionsList(db).find((c) => c.id === Number(id)) || null;

/* ---------- products ---------- */
function products({ db }, { q, tag } = {}) {
  const needle = q ? String(q).toLowerCase() : '';
  return core.activeProducts(db).filter((p) => (!needle || (p.name + ' ' + p.tags.join(' ')).toLowerCase().includes(needle)) && (!tag || p.tags.includes(tag)));
}
function product({ db }, id) {
  const p = core.liveProduct(db, id);
  if (!p) return null;
  p.vendor = db.get('SELECT * FROM vendors WHERE id = ?', p.vendor_id);
  p.collections = db.all('SELECT c.id, c.title FROM collections c JOIN collection_products cp ON cp.collection_id = c.id WHERE cp.product_id = ? ORDER BY c.id', p.id);
  p.similar = core.activeProducts(db).filter((x) => x.id !== p.id && x.tags.some((t) => p.tags.includes(t))).slice(0, 4);
  return p;
}

/* ---------- quiz ---------- */
function quizList(db) {
  const qs = db.all('SELECT id, question FROM quiz_questions ORDER BY position, id');
  const opts = db.all('SELECT * FROM quiz_options ORDER BY position, id');
  return qs.map((q) => ({
    id: q.id, question: q.question,
    options: opts.filter((o) => o.question_id === q.id).map((o) => {
      const out = { id: o.id, text: o.label };
      if (o.tag !== null) out.tag = o.tag; else if (o.occasion_id !== null) out.occasion_id = o.occasion_id; else if (o.budget !== null) out.budget = o.budget;
      return out;
    }),
  }));
}
const quiz = ({ db }) => quizList(db);

/* Score = 3T + 2O + B
   T = number of the chosen tags the product carries, O = 1 if it sits in a collection of the chosen occasion, B = 1 if price <= budget */
function cleanAnswers(a) {
  a = a || {};
  const tags = Array.isArray(a.tags) ? a.tags.filter((t) => typeof t === 'string').slice(0, 20).map((t) => t.trim().toLowerCase()) : [];
  const occ = Number(a.occasion_id) || null;
  const budget = Number(a.budget);
  return { tags, occasion_id: occ, budget: Number.isFinite(budget) && budget > 0 ? Math.floor(budget) : 0 };
}
function scoreWith(db, answers) {
  const { tags, occasion_id: occ, budget } = cleanAnswers(answers);
  const inOcc = new Set();
  if (occ) db.all('SELECT cp.product_id FROM collection_products cp JOIN collections c ON c.id = cp.collection_id WHERE c.occasion_id = ?', occ).forEach((r) => inOcc.add(r.product_id));
  return core.activeProducts(db).filter((p) => p.stock > 0).map((p) => {
    const matched = tags.filter((t, i) => tags.indexOf(t) === i && p.tags.includes(t));
    const T = matched.length, O = inOcc.has(p.id) ? 1 : 0, B = budget && p.price <= budget ? 1 : 0;
    return { product: p, T, O, B, score: 3 * T + 2 * O + B, matched };
  }).sort((a, b) => b.score - a.score || a.product.price - b.product.price || a.product.id - b.product.id);
}
/* greedy fill: highest score first, skip anything that would break the budget, at most 6 items */
function pickBundle(ranked, budget) {
  const picked = []; let sum = 0;
  for (const r of ranked) {
    if (r.T === 0 && r.O === 0) continue;
    if (picked.length >= 6) break;
    if (sum + r.product.price <= budget) { picked.push(r.product); sum += r.product.price; }
  }
  return picked;
}
const score = ({ db }, answers) => scoreWith(db, answers);
function suggest({ db }, answers) {
  const budget = cleanAnswers(answers).budget || 2500;
  const ranked = scoreWith(db, answers);
  const picked = pickBundle(ranked, budget);
  return { ranked: ranked.filter((r) => r.T > 0 || r.O > 0).slice(0, 12), picked, sum: picked.reduce((a, p) => a + p.price, 0), budget };
}

module.exports = { occasions, occasion, collections, collection, collectionsList, products, product, quiz, quizList, score, suggest, scoreWith, pickBundle, cleanAnswers };
