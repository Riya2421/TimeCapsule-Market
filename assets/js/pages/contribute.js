TC.start({ page: "contribute", title: "Chip in" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;
  const tok = ui.param("t");
  const g = tok ? await api.publicGroup(tok) : null;
  if (!g) {
    main.innerHTML = `<div class="container section">${ui.empty("🔗", "This link is not valid", "Ask the organiser to send the contribution link again.", `<a class="btn" href="index.html">Go to the home page</a>`)}</div>`;
    return;
  }
  document.title = `Chip in for ${g.title} | TimeCapsule Market`;
  let tab = "money";
  let amount = 0;
  let pickedItem = null;
  const me = await api.me();

  function render(done) {
    const remaining = Math.max(0, g.target - g.raised);
    const pct = g.target ? Math.min(100, Math.round((g.raised / g.target) * 100)) : 0;
    const open = g.status === "funding" && g.deadline >= api.today();
    const left = ui.daysTo(g.deadline);

    main.innerHTML = `<div class="container" style="max-width:1000px">
      <div class="page-head" style="padding-top:34px">
        <span class="chip chip-gold">${g.occasion ? g.occasion.emoji + " " + ui.esc(g.occasion.name) : "Group gift"}</span>
        <h1 style="font-size:clamp(2rem,5vw,3.6rem);margin:14px 0 10px">${ui.esc(g.organiser.split(" ")[0])} is putting together a gift for ${ui.esc(g.recipient_first_name)}.</h1>
        <p class="lead">${ui.esc(g.title)}. It arrives in ${ui.plural(g.stage_count, "stage")}, starting ${ui.esc(ui.fmtDate(g.first_unlock))}. What is inside stays a surprise.</p>
      </div>

      <div class="split" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px">
        <div class="stack">
          <div class="panel">
            <div class="meter ${g.raised >= g.target ? "done" : ""}" style="height:20px" role="progressbar" aria-valuemin="0" aria-valuemax="${g.target}" aria-valuenow="${g.raised}" aria-label="Funding progress"><i style="width:${pct}%"></i></div>
            <div class="row-between" style="margin-top:12px"><span><strong style="font-size:1.5rem;font-family:var(--font-display)">${ui.money(g.raised)}</strong> of ${ui.money(g.target)}</span>
              <span class="muted">${g.status === "funding" ? ui.money(remaining) + " to go" : g.status === "cancelled" ? "Funding ended" : "Fully funded"}</span></div>
            ${open ? `<p class="small muted" style="margin:10px 0 0">Closes ${ui.esc(ui.fmtDate(g.deadline))}, ${ui.whenText(left)}.</p>` : ""}
          </div>
          <div class="panel">
            <h3>Who has chipped in</h3>
            ${g.contributions.length ? `<div class="wall" style="grid-template-columns:1fr">${g.contributions.map((c) => `<div class="note-card"><q>${ui.esc(c.message || "Chipped in.")}</q><span class="by"><span>${ui.esc(c.name)}</span><span>${c.product ? "Added " + ui.esc(c.product.name) : ui.money(c.amount)}</span></span></div>`).join("")}</div>` : `<p class="muted" style="margin:0">You could be the first.</p>`}
          </div>
        </div>

        <div class="panel" id="formpanel">
          ${done ? `<div class="stack" style="text-align:center;padding:14px 0"><div style="font-size:3rem" aria-hidden="true">💌</div><h3>Thank you, ${ui.esc(done.name)}.</h3>
              <p class="muted">${done.confirmed ? "Your contribution completed the gift. The order has been placed." : "Your contribution is on the wall."}</p>
              <button class="btn btn-ink" id="again">Add another</button></div>`
          : !open ? `<h3>${g.status === "cancelled" ? "Funding has ended" : g.raised >= g.target ? "This gift is fully funded" : "The deadline has passed"}</h3><p class="muted" style="margin:0">Thanks for stopping by. This capsule is no longer taking contributions.</p>`
          : `
          <h3>Chip in</h3>
          <div class="tabs" role="tablist" aria-label="Contribution type">
            <button role="tab" aria-selected="${tab === "money"}" data-tab="money">Add money</button>
            <button role="tab" aria-selected="${tab === "item"}" data-tab="item">Add an item</button>
          </div>
          <form id="cf" novalidate style="margin-top:20px">
            <div class="field"><label for="nm">Your name</label><input class="input" id="nm" autocomplete="name" value="${me ? ui.esc(me.name) : ""}"></div>
            ${tab === "money" ? `
              <div class="field"><span class="label" id="amt-l">Amount</span>
                <div class="row" role="group" aria-labelledby="amt-l">${[100, 250, 500].filter((v) => v <= remaining).map((v) => `<button type="button" class="chip chip-btn" data-amt="${v}" aria-pressed="${amount === v}">${ui.money(v)}</button>`).join("")}<button type="button" class="chip chip-btn" data-amt="${remaining}" aria-pressed="${amount === remaining}">Cover the rest ${ui.money(remaining)}</button></div>
                <input class="input" id="amt" type="number" min="10" max="${remaining}" step="10" placeholder="Or enter an amount" value="${amount || ""}"></div>`
              : `
              <div class="field"><span class="label" id="item-l">Pick an item to add</span>
                <div class="stack" role="group" aria-labelledby="item-l">${g.gift_ideas.map((p) => `<button type="button" class="suggest-item" style="text-align:left;font:inherit;cursor:pointer;${pickedItem === p.id ? "border-color:var(--blue);background:var(--blue-tint)" : ""}" data-item="${p.id}" aria-pressed="${pickedItem === p.id}"><span class="em" aria-hidden="true">${p.emoji}</span><span><strong>${ui.esc(p.name)}</strong><br><span class="small muted">${ui.money(p.price)}</span></span></button>`).join("")}</div>
                <span class="hint">The item is added to the last stage. Its price counts toward your share.</span></div>`}
            <div class="field"><label for="msg">Message for ${ui.esc(g.recipient_first_name)}</label><textarea class="input" id="msg" maxlength="240" placeholder="They will read this when the first stage opens."></textarea></div>
            <p class="error-text" id="err" role="alert"></p>
            <button class="btn btn-lg btn-block" id="pay" type="submit">${tab === "money" ? "Pay and add to the wall" : "Add this item"}</button>
            <p class="small muted" style="margin:10px 0 0">Test mode: no money moves.</p>
          </form>`}
        </div>
      </div>
    </div>`;

    const again = ui.$("#again"); if (again) again.addEventListener("click", async () => { Object.assign(g, await api.publicGroup(tok)); amount = 0; pickedItem = null; render(); });
    ui.$$("[data-tab]", main).forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); }));
    ui.$$("[data-amt]", main).forEach((b) => b.addEventListener("click", () => { amount = Number(b.dataset.amt); ui.$("#amt").value = amount; ui.$$("[data-amt]", main).forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
    const amtEl = ui.$("#amt"); if (amtEl) amtEl.addEventListener("input", (e) => { amount = Number(e.target.value); ui.$$("[data-amt]", main).forEach((x) => x.setAttribute("aria-pressed", false)); });
    ui.$$("[data-item]", main).forEach((b) => b.addEventListener("click", () => { pickedItem = Number(b.dataset.item); ui.$$("[data-item]", main).forEach((x) => { const on = x === b; x.setAttribute("aria-pressed", on); x.style.borderColor = on ? "var(--blue)" : ""; x.style.background = on ? "var(--blue-tint)" : ""; }); }));

    const form = ui.$("#cf");
    if (form) form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = ui.$("#err"); err.textContent = "";
      const name = ui.$("#nm").value;
      if (tab === "item" && !pickedItem) { err.textContent = "Pick an item first."; return; }
      const btn = ui.$("#pay"); btn.disabled = true;
      try {
        const r = await api.contribute(tok, { name, amount, message: ui.$("#msg").value, product_id: tab === "item" ? pickedItem : null });
        Object.assign(g, await api.publicGroup(tok));
        amount = 0; pickedItem = null;
        render({ name: name.trim().split(" ")[0], confirmed: r.confirmed });
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    });
  }
  render();
});
