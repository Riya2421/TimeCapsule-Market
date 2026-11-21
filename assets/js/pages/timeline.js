TC.start({ page: "timeline", title: "Memory timeline", auth: "user" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;
  const rows = await api.timeline();

  const byYear = {};
  rows.forEach((r) => { const y = r.capsule.stages[0].unlock_date.slice(0, 4); (byYear[y] = byYear[y] || []).push(r); });
  const years = Object.keys(byYear).sort().reverse();
  const rots = [-1.6, 1.2, -0.8, 1.8];

  main.innerHTML = `<div class="container">
    <div class="crumbs"><a href="index.html">Home</a> / Memory timeline</div>
    <div class="page-head"><h1 style="font-size:clamp(2rem,4.5vw,3.2rem)">Memory timeline</h1>
      <p class="lead">Every capsule you have sent. A year after the last stage, we remind you so you can send it again, or send something better.</p></div>
    ${rows.length ? years.map((y) => `
      <div class="year-mark">${y}</div>
      <div class="grid" style="--cols:3">
        ${byYear[y].map((r, i) => polaroid(r, rots[i % rots.length])).join("")}
      </div>`).join("")
      : ui.empty("🗓️", "Nothing on the timeline yet", "A capsule appears here once it is paid for. Completed ones get a yearly reminder.", `<a class="btn" href="builder.html">Build a capsule</a>`)}
  </div>`;

  function polaroid(r, rot) {
    const c = r.capsule;
    const first = c.stages[0].items[0];
    const done = c.status === "completed";
    const ev = r.event;
    return `<article class="polaroid" style="--rot:${rot}deg">
      <div class="pic" style="--tint:${first ? first.product.tint : "#e6ebfd"}" aria-hidden="true">${first ? first.product.emoji : "🎁"}</div>
      <p>${ui.esc(c.title)}</p>
      <div class="small muted">For ${ui.esc(c.recipient ? c.recipient.name : "someone")} &middot; ${c.occasion ? ui.esc(c.occasion.name) : ""}</div>
      <div class="small" style="margin:6px 0">${ui.esc(ui.fmtShort(c.stages[0].unlock_date))} to ${ui.esc(ui.fmtDate(c.stages[c.stages.length - 1].unlock_date))}</div>
      <div class="row" style="margin-bottom:10px">${ui.statusChip(c.status)}${ev ? `<span class="chip chip-gold">${ev.notified ? "Reminder sent" : "Reminder " + ui.esc(ui.fmtShort(ev.reminder_date))}</span>` : ""}</div>
      ${done ? `<div class="row"><button class="btn btn-sm" data-repeat="${c.id}:repeat">Repeat</button><button class="btn btn-ink btn-sm" data-repeat="${c.id}:upgrade">Upgrade</button></div>`
        : `<a class="btn btn-ink btn-sm" href="capsules.html">See progress</a>`}
    </article>`;
  }

  ui.$$("[data-repeat]", main).forEach((b) => b.addEventListener("click", async () => {
    const [id, mode] = b.dataset.repeat.split(":");
    const c = await ui.run(() => api.repeatCapsule(id, mode));
    if (c) { ui.flash(mode === "upgrade" ? "Upgraded copy created with a bigger budget." : "A fresh copy is ready. Check the dates."); location.href = "builder.html?id=" + c.id; }
  }));
});
