TC.start({ page: "capsules", title: "My capsules", auth: "user" }, async (main, user) => {
  const ui = TC.ui;
  const api = TC.api;

  async function render() {
    const caps = await api.capsules();
    const groups = [
      ["In progress", caps.filter((c) => ["funding", "confirmed", "active"].includes(c.status))],
      ["Drafts", caps.filter((c) => c.status === "draft")],
      ["Completed", caps.filter((c) => c.status === "completed")],
      ["Cancelled", caps.filter((c) => c.status === "cancelled")],
    ].filter(([, l]) => l.length);

    main.innerHTML = `<div class="container">
      <div class="crumbs"><a href="index.html">Home</a> / My capsules</div>
      <div class="page-head row-between">
        <div><h1 style="font-size:clamp(2rem,4.5vw,3.2rem);margin-bottom:6px">My capsules</h1><p class="muted">Hi ${ui.esc(user.name.split(" ")[0])}. Everything you have built or paid for is here.</p></div>
        <a class="btn btn-lg" href="builder.html">New capsule</a>
      </div>
      ${groups.length ? groups.map(([title, list]) => `<section style="margin-bottom:30px"><h2 style="font-size:1.5rem">${title} <span class="muted" style="font-weight:600">(${list.length})</span></h2><div class="progress-list">${list.map(card).join("")}</div></section>`).join("")
        : ui.empty("📮", "No capsules yet", "Start from an occasion or take the quiz. It takes about two minutes.", `<div class="row" style="justify-content:center"><a class="btn" href="builder.html">Build a capsule</a><a class="btn btn-ink" href="quiz.html">Take the quiz</a></div>`)}
    </div>`;

    ui.$$("[data-repeat]", main).forEach((b) => b.addEventListener("click", async () => {
      const [id, mode] = b.dataset.repeat.split(":");
      const c = await ui.run(() => api.repeatCapsule(id, mode));
      if (c) { ui.flash(mode === "upgrade" ? "Upgraded copy created with a bigger budget." : "A fresh copy is ready. Check the dates."); location.href = "builder.html?id=" + c.id; }
    }));
    ui.$$("[data-del]", main).forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Delete this draft?")) return;
      if (await ui.run(() => api.deleteCapsule(b.dataset.del))) { ui.toast("Draft deleted."); render(); }
    }));
  }

  function card(c) {
    const opened = c.stages.filter((s) => s.status !== "locked").length;
    const next = c.stages.filter((s) => s.status === "locked").map((s) => s.unlock_date).sort()[0];
    const funding = c.status === "funding";
    const pct = c.target_amount ? Math.min(100, Math.round((c.raised / c.target_amount) * 100)) : 0;
    return `<article class="capsule-card" aria-label="${ui.esc(c.title)}">
      <div>
        <div class="row" style="margin-bottom:6px">${ui.statusChip(c.status)}${c.occasion ? `<span class="chip">${c.occasion.emoji} ${ui.esc(c.occasion.name)}</span>` : ""}${c.type === "group" ? `<span class="chip chip-gold">Group</span>` : ""}</div>
        <h3>${ui.esc(c.title)}</h3>
        <p class="small muted" style="margin:0">For ${ui.esc(c.recipient ? c.recipient.name : "nobody yet")} &middot; ${ui.plural(c.stages.length, "stage")} &middot; ${ui.money(c.status === "draft" ? c.totals.total : c.total_price || c.totals.total)}</p>
        <div class="stage-dots" aria-label="Stages">${c.stages.map((s) => `<span class="dot ${s.status !== "locked" ? "on" : ""}">${s.status !== "locked" ? "&#10003; " : ""}Stage ${s.stage_no}, ${ui.esc(ui.fmtShort(s.unlock_date))}</span>`).join("")}</div>
        ${funding ? `<div class="meter" style="margin-top:14px" role="progressbar" aria-valuemin="0" aria-valuemax="${c.target_amount}" aria-valuenow="${c.raised}" aria-label="Funding"><i style="width:${pct}%"></i></div>
          <p class="small" style="margin:6px 0 0"><strong>${ui.money(c.raised)}</strong> of ${ui.money(c.target_amount)} &middot; ends ${ui.esc(ui.fmtDate(c.funding_deadline))} (${ui.whenText(ui.daysTo(c.funding_deadline))})</p>` : ""}
        ${["confirmed", "active"].includes(c.status) && next ? `<p class="small" style="margin:10px 0 0">${opened} of ${c.stages.length} opened. Next opens ${ui.esc(ui.fmtDate(next))} (${ui.whenText(ui.daysTo(next))}).</p>` : ""}
        ${c.thank_you ? `<p class="small" style="margin:10px 0 0"><strong>${ui.esc(c.recipient ? c.recipient.name.split(" ")[0] : "They")} wrote:</strong> &ldquo;${ui.esc(c.thank_you)}&rdquo;</p>` : ""}
      </div>
      <div class="stack" style="min-width:170px">
        ${c.status === "draft" ? `<a class="btn btn-sm btn-block" href="builder.html?id=${c.id}">Continue building</a><button class="btn btn-ghost btn-sm btn-block" data-del="${c.id}">Delete draft</button>` : ""}
        ${funding ? `<a class="btn btn-sm btn-block" href="group.html?id=${c.id}">Group page</a>` : ""}
        ${c.order_id ? `<a class="btn btn-ink btn-sm btn-block" href="order.html?id=${c.order_id}">View order</a>` : ""}
        ${["confirmed", "active", "completed"].includes(c.status) ? `<a class="btn btn-ink btn-sm btn-block" href="recipient.html?t=${c.recipient_token}">Recipient's view</a>` : ""}
        ${c.status === "completed" ? `<button class="btn btn-sm btn-block" data-repeat="${c.id}:repeat">Repeat</button><button class="btn btn-ink btn-sm btn-block" data-repeat="${c.id}:upgrade">Upgrade</button>` : ""}
      </div>
    </article>`;
  }
  await render();
});
