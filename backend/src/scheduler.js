'use strict';
/* The daily job from the report. Safe to run as often as you like: every step moves state forward once. */
const { addDays } = require('./util');
const core = require('./core');

function runScheduler(db) {
  return db.tx(() => {
    const t = core.today(db);
    const events = [];
    const ev = (e, ownerId) => events.push(Object.assign(e, { owner_id: ownerId }));

    /* 1. group funding that missed its deadline: cancel and refund */
    db.all("SELECT * FROM capsules WHERE status = 'funding' AND funding_deadline < ?", t).forEach((c) => {
      if (core.raised(db, c.id) >= c.target_amount) return;
      db.run("UPDATE capsules SET status = 'cancelled' WHERE id = ?", c.id);
      db.run('UPDATE contributions SET refunded = 1 WHERE capsule_id = ?', c.id);
      const owner = db.get('SELECT email FROM users WHERE id = ?', c.owner_id);
      core.email(db, c.owner_id, owner.email, `Funding ended for "${c.title}"`, 'The target was not reached by the deadline, so every contribution is being refunded.', 'group.html?id=' + c.id, 'funding');
      ev({ type: 'funding_failed', capsule_id: c.id, title: c.title }, c.owner_id);
    });

    /* 2. unlock and deliver stages, complete capsules */
    db.all("SELECT * FROM capsules WHERE status IN ('confirmed','active') ORDER BY id").forEach((c) => {
      const rcp = c.recipient_id ? db.get('SELECT name, email FROM recipients WHERE id = ?', c.recipient_id) : null;
      const order = db.get('SELECT id FROM orders WHERE capsule_id = ? ORDER BY id LIMIT 1', c.id);
      let status = c.status;
      db.all('SELECT * FROM stages WHERE capsule_id = ? ORDER BY stage_no', c.id).forEach((s) => {
        let st = s.status;
        const setDelivery = (v) => { if (order) db.run('UPDATE deliveries SET status = ? WHERE order_id = ? AND stage_id = ?', v, order.id, s.id); };
        if (st === 'locked' && s.unlock_date <= t) {
          st = 'unlocked';
          db.run("UPDATE stages SET status = 'unlocked' WHERE id = ?", s.id);
          setDelivery('dispatched');
          status = 'active';
          core.email(db, c.owner_id, rcp ? rcp.email || rcp.name : 'recipient', `Stage ${s.stage_no} of "${c.title}" has opened`, 'Something is on its way to you. Open the link to see what is inside.', 'recipient.html?t=' + c.recipient_token, 'unlock');
          ev({ type: 'unlock', capsule_id: c.id, title: c.title, stage_no: s.stage_no }, c.owner_id);
        }
        if (st === 'unlocked' && s.unlock_date <= addDays(t, -2)) {
          db.run("UPDATE stages SET status = 'delivered' WHERE id = ?", s.id);
          setDelivery('delivered');
        }
      });
      if (status !== c.status) db.run('UPDATE capsules SET status = ? WHERE id = ?', status, c.id);
      const left = db.get("SELECT COUNT(*) AS n FROM stages WHERE capsule_id = ? AND status != 'delivered'", c.id).n;
      const total = db.get('SELECT COUNT(*) AS n FROM stages WHERE capsule_id = ?', c.id).n;
      if (total && !left) {
        db.run("UPDATE capsules SET status = 'completed', completed_at = ? WHERE id = ?", t, c.id);
        db.run('INSERT INTO memory_events (user_id, capsule_id, event_date, reminder_date) VALUES (?,?,?,?)', c.owner_id, c.id, t, addDays(t, 365));
        ev({ type: 'completed', capsule_id: c.id, title: c.title }, c.owner_id);
      }
      if (order) {
        const d = db.get("SELECT COUNT(*) AS n, SUM(status = 'delivered') AS done, SUM(status != 'pending') AS moving FROM deliveries WHERE order_id = ?", order.id);
        const o = db.get('SELECT status FROM orders WHERE id = ?', order.id);
        if (o.status !== 'cancelled') {
          if (d.n && d.done === d.n) db.run("UPDATE orders SET status = 'delivered' WHERE id = ?", order.id);
          else if (d.moving > 0 && o.status !== 'delivered') db.run("UPDATE orders SET status = 'shipped' WHERE id = ?", order.id);
        }
      }
    });

    /* 3. yearly reminders */
    db.all('SELECT * FROM memory_events WHERE notified = 0 AND reminder_date <= ? ORDER BY id', t).forEach((m) => {
      db.run('UPDATE memory_events SET notified = 1 WHERE id = ?', m.id);
      const c = db.get('SELECT title FROM capsules WHERE id = ?', m.capsule_id);
      const u = db.get('SELECT email FROM users WHERE id = ?', m.user_id);
      core.email(db, m.user_id, u.email, `A year ago you sent "${c.title}"`, 'Repeat it, or upgrade it with something new.', 'timeline.html', 'reminder');
      ev({ type: 'reminder', capsule_id: m.capsule_id, title: c.title }, m.user_id);
    });
    return events;
  });
}

module.exports = { runScheduler };
