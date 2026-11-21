TC.start({ page: "capsules", title: "Capsule builder", auth: "user" }, async (main, user) => {
  const ui = TC.ui;
  const api = TC.api;
  const cfg = TC.CONFIG;
  const id = ui.param("id");
  const occasions = await api.occasions();

  /* ---------- no capsule yet: choose the occasion ---------- */
  if (!id) {
    const occParam = ui.param("occasion");
    if (occParam) {
      const c = await ui.run(() => api.newCapsule({ occasion_id: occParam }));
      if (c) { location.replace("builder.html?id=" + c.id); return; }
    }
    main.innerHTML = `<div class="container">
      <div class="crumbs"><a href="index.html">Home</a> / Build a capsule</div>
      <div class="page-head"><h1 style="font-size:clamp(2rem,4.5vw,3.4rem)">What is the occasion?</h1>
        <p class="lead">Pick one to start. You can change it later. Prefer suggestions? <a href="quiz.html">Take the gift quiz</a> instead.</p></div>
      <div class="stamp-grid on-white">${occasions.map((o) => ui.stampCard(o, "builder.html?occasion=" + o.id)).join("")}</div>
      <p style="margin-top:28px"><button class="btn btn-ink" id="blank">Start without an occasion</button></p>
    </div>`;
    ui.$("#blank").addEventListener("click", async () => { const c = await ui.run(() => api.newCapsule({})); if (c) location.href = "builder.html?id=" + c.id; });
    return;
  }

  let cap = await api.capsule(id);
  if (cap.status === "funding") { location.replace("group.html?id=" + id); return; }
  if (cap.status !== "draft") {
    main.innerHTML = `<div class="container section">${ui.empty("🔒", "This capsule is already paid for", "Paid capsules cannot be edited. You can view its progress or start a repeat of it.", `<a class="btn" href="capsules.html">My capsules</a>`)}</div>`;
    return;
  }
  let recipients = await api.recipients();
  const today = api.today();
  const tomorrow = ui.addDays(today, 1);
  let sugCache = "";

  function defaultDeadline() {
    const first = cap.stages.map((s) => s.unlock_date).sort()[0];
    const want = ui.addDays(today, 7);
    const lastOk = ui.addDays(first, -1);
    return want < lastOk ? want : lastOk;
  }
  let deadline = null;

  function stagePicker(prefix, pid) {
    return `<span class="small muted">Add to stage</span>${cap.stages.map((s) => `<button class="num-btn" data-add="${pid}" data-stage="${s.stage_no}" aria-label="Add to stage ${s.stage_no}">${s.stage_no}</button>`).join("")}`;
  }
  function suggestItem(p, extra) {
    return `<div class="suggest-item"><span class="em" aria-hidden="true">${p.emoji}</span><span><strong>${ui.esc(p.name)}</strong><br><span class="small muted">${ui.money(p.price)}${extra ? " &middot; " + extra : ""}</span></span><div class="acts">${stagePicker("s", p.id)}</div></div>`;
  }

  function render() {
    const T = cap.totals;
    const over = T.items > T.budget && T.budget > 0;
    const pct = T.budget ? Math.min(100, Math.round((T.items / T.budget) * 100)) : 0;
    const first = cap.stages.map((s) => s.unlock_date).sort()[0];
    if (!deadline) deadline = defaultDeadline();
    const isGroup = cap.type === "group";

    main.innerHTML = `<div class="container wide">
      <div class="crumbs"><a href="index.html">Home</a> / <a href="capsules.html">My capsules</a> / Builder</div>
      <div class="page-head row-between">
        <div><h1 style="font-size:clamp(2rem,4vw,3rem);margin-bottom:6px">Build your capsule</h1>
        <p class="muted">Put items into stages. Each stage opens on its own date, with a card from you.</p></div>
        ${ui.statusChip("draft")}
      </div>

      <div class="builder">
        <aside class="stack" aria-label="Capsule details">
          <div class="panel">
            <h3>Who is it for?</h3>
            <div class="field"><label for="title">Capsule name</label><input class="input" id="title" value="${ui.esc(cap.title)}" maxlength="80"></div>
            <div class="field"><label for="rcp">Recipient</label>
              <select class="input" id="rcp">
                <option value="">Choose a person</option>
                ${recipients.map((r) => `<option value="${r.id}" ${cap.recipient_id === r.id ? "selected" : ""}>${ui.esc(r.name)}${r.relation ? " (" + ui.esc(r.relation) + ")" : ""}</option>`).join("")}
                <option value="new">Add a new person…</option>
              </select>
              ${cap.recipient ? `<span class="hint">${cap.recipient.address ? "Delivers to: " + ui.esc(cap.recipient.address) : "No address saved yet. Edit this person under Saved recipients."}</span>` : ""}
            </div>
            <div class="field"><label for="occ">Occasion</label>
              <select class="input" id="occ"><option value="">None</option>${occasions.map((o) => `<option value="${o.id}" ${cap.occasion_id === o.id ? "selected" : ""}>${o.emoji} ${ui.esc(o.name)}</option>`).join("")}</select></div>
            <div class="field" style="margin-bottom:0"><label for="budget">Budget for gift items (₹)</label>
              <input class="input" id="budget" type="number" min="0" step="100" value="${cap.budget}"><span class="hint">Handling and gift wrap are added on top.</span></div>
          </div>
          <div class="panel-soft">
            <h3 style="font-size:1.05rem">Suggested for ${cap.recipient ? ui.esc(cap.recipient.name.split(" ")[0]) : "this occasion"}</h3>
            <div class="suggest" id="sug"><span class="small muted">Loading suggestions…</span></div>
            <hr class="divider">
            <div class="field" style="margin-bottom:10px"><label for="find">Find any product</label><input class="input" id="find" type="search" placeholder="Try tea, lamp or journal"></div>
            <div class="suggest" id="found"></div>
          </div>
        </aside>

        <section aria-label="Stages">
          ${cap.stages.map((s) => {
            const d = ui.daysTo(s.unlock_date);
            return `<div class="stage" data-stage="${s.stage_no}">
              <div class="stage-head">
                <h3>Stage ${s.stage_no}</h3>
                <div class="row">
                  <label class="small" for="d-${s.stage_no}">Opens on</label>
                  <input class="input" style="width:auto" type="date" id="d-${s.stage_no}" data-date="${s.stage_no}" min="${tomorrow}" value="${s.unlock_date}">
                  <span class="small muted">${ui.whenText(d)}</span>
                </div>
                ${cap.stages.length > 1 ? `<button class="btn btn-ghost btn-sm" data-rm-stage="${s.stage_no}">Remove stage</button>` : ""}
              </div>
              <div class="stage-body">
                ${s.items.length ? s.items.map((i) => `
                  <div class="line-item">
                    <span class="em" aria-hidden="true">${i.product.emoji}</span>
                    <div><strong>${ui.esc(i.product.name)}</strong><div class="small muted">${ui.money(i.product.price)} each
                      ${cap.stages.length > 1 ? ` &middot; <select class="input" style="width:auto;padding:2px 6px;font-size:.85rem" data-move="${s.stage_no}:${i.product_id}" aria-label="Move ${ui.esc(i.product.name)} to another stage"><option value="">Move to…</option>${cap.stages.filter((x) => x.stage_no !== s.stage_no).map((x) => `<option value="${x.stage_no}">Stage ${x.stage_no}</option>`).join("")}</select>` : ""}</div></div>
                    <div class="qty"><button data-qty="${s.stage_no}:${i.product_id}:${i.qty - 1}" aria-label="Fewer">&minus;</button><span>${i.qty}</span><button data-qty="${s.stage_no}:${i.product_id}:${i.qty + 1}" aria-label="More">+</button></div>
                    <div class="row" style="gap:6px"><span class="price">${ui.money(i.product.price * i.qty)}</span><button class="btn btn-ghost btn-sm" data-qty="${s.stage_no}:${i.product_id}:0" aria-label="Remove ${ui.esc(i.product.name)}">Remove</button></div>
                  </div>`).join("") : `<p class="muted small" style="margin:0">Nothing here yet. Add items from the suggestions on the left.</p>`}
                <div class="field" style="margin:0"><label for="m-${s.stage_no}">Message card for this stage</label>
                  <textarea class="input" id="m-${s.stage_no}" data-msg="${s.stage_no}" maxlength="400" placeholder="Write what you want them to read when this stage opens.">${ui.esc(s.message)}</textarea></div>
              </div>
            </div>`;
          }).join("")}
          <p style="margin-top:16px"><button class="btn btn-ink" id="addstage" ${cap.stages.length >= cfg.MAX_STAGES ? "disabled" : ""}>Add another stage</button>
          <span class="small muted" style="margin-left:10px">Up to ${cfg.MAX_STAGES} stages</span></p>
        </section>

        <aside class="stack sticky" aria-label="Summary">
          <div class="panel">
            <h3>Budget</h3>
            <div class="meter ${over ? "over" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="${T.budget}" aria-valuenow="${T.items}" aria-label="Gift items against budget"><i style="width:${pct}%"></i></div>
            <div class="row-between small" style="margin-top:8px"><span><strong>${ui.money(T.items)}</strong> of ${ui.money(T.budget)}</span>
              <span class="${over ? "error-text" : "muted"}">${over ? ui.money(T.items - T.budget) + " over budget" : ui.money(T.remaining) + " left"}</span></div>
            <hr class="divider">
            <div class="sum-row"><span>Gift items (${T.count})</span><span>${ui.money(T.items)}</span></div>
            <div class="sum-row"><label class="toggle" style="font-weight:500"><input type="checkbox" id="wrap" ${cap.gift_wrap ? "checked" : ""}> Gift wrap (${ui.money(cfg.GIFT_WRAP)} per stage)</label><span>${ui.money(T.wrap)}</span></div>
            <div class="sum-row"><span>Stage handling (${cap.stages.length} &times; ${ui.money(cfg.STAGE_FEE)})</span><span>${ui.money(T.fee)}</span></div>
            <div class="sum-row total"><span>Total</span><span>${ui.money(T.total)}</span></div>
          </div>
          <div class="panel">
            <h3>Who pays?</h3>
            <div class="tabs" role="tablist" aria-label="Payment type">
              <button role="tab" aria-selected="${!isGroup}" data-type="solo">I will pay</button>
              <button role="tab" aria-selected="${isGroup}" data-type="group">Group</button>
            </div>
            ${isGroup ? `
              <div class="field" style="margin-top:16px"><label for="dl">Funding deadline</label>
                <input class="input" type="date" id="dl" min="${tomorrow}" max="${ui.addDays(first, -1)}" value="${deadline}">
                <span class="hint">Friends can contribute until this day. It has to be before the first stage opens on ${ui.esc(ui.fmtDate(first))}.</span></div>
              <button class="btn btn-lg btn-block" id="go">Start group funding</button>
              <p class="small muted" style="margin:10px 0 0">You get a link to share. The order is placed once ${ui.money(T.total)} is collected.</p>`
              : `<p class="small muted" style="margin:14px 0 16px">You pay at checkout. Delivery for each stage is scheduled for its opening date.</p>
              <button class="btn btn-lg btn-block" id="go">Add to cart</button>`}
          </div>
          <button class="btn btn-ghost btn-block" id="del">Delete this draft</button>
        </aside>
      </div>

      <dialog id="rdlg" aria-labelledby="rdt">
        <form method="dialog" id="rform" novalidate>
          <h3 id="rdt">Add a person</h3>
          <div class="form-grid">
            <div class="field"><label for="r-name">Name</label><input class="input" id="r-name" required></div>
            <div class="field"><label for="r-rel">Relation</label><input class="input" id="r-rel" placeholder="Friend, sister, boss"></div>
            <div class="field"><label for="r-email">Email</label><input class="input" id="r-email" type="email" placeholder="They get the unlock emails here"></div>
            <div class="field"><label for="r-int">Interests</label><input class="input" id="r-int" placeholder="tea, books, travel"></div>
            <div class="field full"><label for="r-addr">Delivery address</label><textarea class="input" id="r-addr"></textarea></div>
          </div>
          <p class="error-text" id="r-err" role="alert"></p>
          <div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-ink" id="r-cancel">Cancel</button><button class="btn" id="r-save" type="submit">Save person</button></div>
        </form>
      </dialog>
    </div>`;
    bind();
    refreshSuggestions();
  }

  /* ---------- suggestions ---------- */
  async function refreshSuggestions() {
    const box = ui.$("#sug");
    if (!box) return;
    const tags = cap.recipient ? cap.recipient.interests.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
    const res = await api.suggest({ tags, occasion_id: cap.occasion_id, budget: cap.budget || 99999 });
    const have = new Set(cap.stages.flatMap((s) => s.items.map((i) => i.product_id)));
    const list = res.ranked.filter((r) => !have.has(r.product.id)).slice(0, 5);
    box.innerHTML = list.length ? list.map((r) => suggestItem(r.product, r.matched.length ? "matches " + r.matched.map(ui.esc).join(", ") : "fits the occasion")).join("") : `<span class="small muted">No more suggestions. Use the search below.</span>`;
  }

  /* ---------- events ---------- */
  const mutate = async (fn) => {
    const r = await ui.run(fn);
    if (r) cap = r;
    render();
  };
  function bind() {
    const $ = ui.$;
    $("#title").addEventListener("change", (e) => mutate(() => api.updateCapsule(cap.id, { title: e.target.value.trim() || "Untitled capsule" })));
    $("#occ").addEventListener("change", (e) => mutate(() => api.updateCapsule(cap.id, { occasion_id: e.target.value ? Number(e.target.value) : null })));
    $("#budget").addEventListener("change", (e) => mutate(() => api.updateCapsule(cap.id, { budget: e.target.value })));
    $("#wrap").addEventListener("change", (e) => mutate(() => api.updateCapsule(cap.id, { gift_wrap: e.target.checked })));
    $("#rcp").addEventListener("change", (e) => {
      if (e.target.value === "new") { $("#rdlg").showModal(); e.target.value = cap.recipient_id || ""; return; }
      mutate(() => api.updateCapsule(cap.id, { recipient_id: e.target.value ? Number(e.target.value) : null }));
    });
    ui.$$("[data-date]").forEach((el) => el.addEventListener("change", () => mutate(() => api.updateStage(cap.id, el.dataset.date, { unlock_date: el.value }))));
    ui.$$("[data-msg]").forEach((el) => el.addEventListener("change", () => mutate(() => api.updateStage(cap.id, el.dataset.msg, { message: el.value }))));
    ui.$$("[data-qty]").forEach((el) => el.addEventListener("click", () => { const [s, p, q] = el.dataset.qty.split(":"); mutate(() => api.setItemQty(cap.id, s, p, Number(q))); }));
    ui.$$("[data-move]").forEach((el) => el.addEventListener("change", () => { if (!el.value) return; const [s, p] = el.dataset.move.split(":"); mutate(() => api.moveItem(cap.id, s, p, el.value)); }));
    ui.$$("[data-rm-stage]").forEach((el) => el.addEventListener("click", () => mutate(() => api.removeStage(cap.id, el.dataset.rmStage))));
    $("#addstage").addEventListener("click", () => mutate(() => api.addStage(cap.id)));
    ui.$$("[data-type]").forEach((el) => el.addEventListener("click", () => { if (el.dataset.type !== cap.type) mutate(() => api.updateCapsule(cap.id, { type: el.dataset.type })); }));
    const dl = $("#dl"); if (dl) dl.addEventListener("change", (e) => { deadline = e.target.value; });
    main.addEventListener("click", addHandler);

    $("#find").addEventListener("input", debounce(async (e) => {
      const q = e.target.value.trim();
      const box = $("#found");
      if (!q) { box.innerHTML = ""; return; }
      const list = (await api.products({ q })).slice(0, 5);
      box.innerHTML = list.length ? list.map((p) => suggestItem(p)).join("") : `<span class="small muted">Nothing matches "${ui.esc(q)}".</span>`;
    }, 200));

    $("#go").addEventListener("click", async () => {
      if (cap.type === "group") {
        const c = await ui.run(() => api.startFunding(cap.id, deadline));
        if (c) { ui.flash("Group funding started. Share the link with friends."); location.href = "group.html?id=" + c.id; }
      } else {
        const ok = await ui.run(() => api.addCapsuleToCart(cap.id));
        if (ok) location.href = "cart.html";
      }
    });
    $("#del").addEventListener("click", async () => {
      if (!confirm("Delete this draft capsule?")) return;
      if (await ui.run(() => api.deleteCapsule(cap.id))) { ui.flash("Draft deleted."); location.href = "capsules.html"; }
    });

    /* new recipient dialog */
    const dlg = $("#rdlg");
    $("#r-cancel").addEventListener("click", () => dlg.close());
    $("#rform").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#r-err"); err.textContent = "";
      try {
        const r = await api.saveRecipient({ name: $("#r-name").value, relation: $("#r-rel").value, email: $("#r-email").value, interests: $("#r-int").value, address: $("#r-addr").value });
        recipients = await api.recipients();
        cap = await api.updateCapsule(cap.id, { recipient_id: r.id });
        dlg.close(); render(); ui.toast(`${r.name} saved.`);
      } catch (ex) { err.textContent = ex.message; }
    });
  }
  async function addHandler(e) {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    main.removeEventListener("click", addHandler);
    const r = await ui.run(() => api.addItem(cap.id, b.dataset.stage, b.dataset.add, 1));
    if (r) { cap = r; ui.toast("Added to stage " + b.dataset.stage + "."); }
    render();
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  render();
});
