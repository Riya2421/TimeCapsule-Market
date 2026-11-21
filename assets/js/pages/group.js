TC.start({ page: "capsules", title: "Group capsule", auth: "user" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;
  const id = ui.param("id");

  async function render() {
    const g = await api.group(id);
    document.title = g.title + " | TimeCapsule Market";
    const remaining = Math.max(0, g.target_amount - g.raised);
    const pct = g.target_amount ? Math.min(100, Math.round((g.raised / g.target_amount) * 100)) : 0;
    const funding = g.status === "funding";
    const base = location.href.replace(/[^/]*$/, "");
    const link = base + "contribute.html?t=" + g.share_token;
    const daysLeft = ui.daysTo(g.funding_deadline);
    const wa = "https://wa.me/?text=" + encodeURIComponent(`Chip in for "${g.title}": ${link}`);

    main.innerHTML = `<div class="container">
      <div class="crumbs"><a href="index.html">Home</a> / <a href="capsules.html">My capsules</a> / ${ui.esc(g.title)}</div>
      <div class="page-head row-between">
        <div><h1 style="font-size:clamp(2rem,4.5vw,3.2rem);margin-bottom:6px">${ui.esc(g.title)}</h1>
          <p class="muted">Group capsule for ${ui.esc(g.recipient ? g.recipient.name : "")}${g.occasion ? " &middot; " + ui.esc(g.occasion.name) : ""}</p></div>
        ${ui.statusChip(g.status)}
      </div>

      ${g.status === "cancelled" ? `<div class="panel" style="border-color:var(--red);margin-bottom:22px"><h3>Funding ended</h3><p style="margin:0">The target was not reached, so every contribution has been refunded.</p></div>` : ""}
      ${["confirmed", "active", "completed"].includes(g.status) ? `<div class="panel" style="background:var(--ok-tint);border-color:var(--ok);margin-bottom:22px"><h3 style="color:var(--ok)">Fully funded</h3><p style="margin:0 0 12px">The target was reached and the order is placed. Each stage will open on its date.</p><div class="row">${g.order_id ? `<a class="btn btn-sm" href="order.html?id=${g.order_id}">View order</a>` : ""}<a class="btn btn-ink btn-sm" href="capsules.html">My capsules</a></div></div>` : ""}

      <div class="split">
        <div class="stack">
          <div class="panel">
            <div class="row-between"><h3 style="margin:0">Funding progress</h3>${funding ? `<span class="chip ${daysLeft <= 2 ? "chip-red" : "chip-gold"}">Ends ${ui.esc(ui.fmtDate(g.funding_deadline))} (${ui.whenText(daysLeft)})</span>` : ""}</div>
            <div class="meter ${g.raised >= g.target_amount ? "done" : ""}" style="margin:16px 0 10px;height:20px" role="progressbar" aria-valuemin="0" aria-valuemax="${g.target_amount}" aria-valuenow="${g.raised}" aria-label="Funding progress"><i style="width:${pct}%"></i></div>
            <div class="row-between"><span><strong style="font-size:1.4rem;font-family:var(--font-display)">${ui.money(g.raised)}</strong> raised of ${ui.money(g.target_amount)}</span><span class="muted">${remaining ? ui.money(remaining) + " to go" : "Target reached"}</span></div>
          </div>

          <div class="panel">
            <h3>Contribution wall</h3>
            ${g.contributions.filter((c) => !c.refunded).length ? `<div class="wall">${g.contributions.filter((c) => !c.refunded).map((c) => `<div class="note-card"><q>${ui.esc(c.message || "Chipped in.")}</q><span class="by"><span>${ui.esc(c.contributor_name)}</span><span>${c.product_id ? "Item" : ui.money(c.amount)}</span></span></div>`).join("")}</div>`
              : `<p class="muted" style="margin:0">No contributions yet. Share the link to get started.</p>`}
          </div>

          <div class="panel">
            <h3>Stages</h3>
            <div class="stack">${g.stages.map((s) => `<div class="small"><strong>Stage ${s.stage_no}</strong> opens ${ui.esc(ui.fmtDate(s.unlock_date))}: ${s.items.map((i) => `<span aria-hidden="true">${i.product.emoji}</span> ${ui.esc(i.product.name)}${i.qty > 1 ? " &times; " + i.qty : ""}`).join(", ")}</div>`).join("")}</div>
          </div>
        </div>

        <aside class="stack">
          ${funding ? `
          <div class="panel">
            <h3>Share with friends</h3>
            <p class="small muted">Anyone with this link can contribute. They do not need an account, and they will not see what is inside.</p>
            <div class="field"><label for="lnk" class="sr-only">Contribution link</label><input class="input" id="lnk" readonly value="${ui.esc(link)}"></div>
            <div class="row"><button class="btn btn-sm" id="copy">Copy link</button><a class="btn btn-ink btn-sm" href="${ui.esc(wa)}" target="_blank" rel="noopener">Share on WhatsApp</a><a class="btn btn-ghost btn-sm" href="contribute.html?t=${g.share_token}">Preview page</a></div>
          </div>
          <div class="panel">
            <h3>Cover the rest yourself</h3>
            <p class="small muted">Pay the remaining ${ui.money(remaining)} to confirm the capsule now.</p>
            <button class="btn btn-block" id="topup" ${remaining ? "" : "disabled"}>Top up ${ui.money(remaining)}</button>
            <hr class="divider">
            <button class="btn btn-ghost btn-block" id="cancel">Cancel and refund everyone</button>
          </div>` : ""}
        </aside>
      </div>
    </div>`;

    const copy = ui.$("#copy");
    if (copy) copy.addEventListener("click", async () => {
      const inp = ui.$("#lnk");
      try { await navigator.clipboard.writeText(inp.value); } catch (e) { inp.select(); document.execCommand("copy"); }
      ui.toast("Link copied.");
    });
    const top = ui.$("#topup");
    if (top) top.addEventListener("click", async () => {
      if (!confirm(`Pay ${ui.money(remaining)} now to confirm this capsule? (Test mode)`)) return;
      const r = await ui.run(() => api.topUp(g.id, remaining));
      if (r) { ui.flash(r.confirmed ? "Fully funded. Your order is placed." : "Top-up received."); location.reload(); }
    });
    const cancel = ui.$("#cancel");
    if (cancel) cancel.addEventListener("click", async () => {
      if (!confirm("Cancel this capsule? All contributions will be refunded.")) return;
      if (await ui.run(() => api.cancelCapsule(g.id))) { ui.flash("Capsule cancelled. Contributions refunded."); location.reload(); }
    });
  }
  await render();
});
