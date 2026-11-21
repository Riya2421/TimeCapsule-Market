TC.start({ page: "admin-collections", title: "Collections and quiz", auth: "admin" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;
  let tab = ui.param("tab") === "quiz" ? "quiz" : "collections";
  const occasions = await api.occasions();

  async function render() {
    main.innerHTML = `<div class="container">
      <div class="page-head"><h1 style="font-size:clamp(2rem,4.5vw,3.2rem)">Collections and quiz</h1></div>
      <div class="tabs" role="tablist" aria-label="Section" style="margin-bottom:24px">
        <button role="tab" aria-selected="${tab === "collections"}" data-tab="collections">Collections</button>
        <button role="tab" aria-selected="${tab === "quiz"}" data-tab="quiz">Gift quiz</button>
      </div>
      <div id="body"></div>
    </div>`;
    ui.$$("[data-tab]", main).forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); }));
    if (tab === "collections") await collectionsTab(); else await quizTab();
  }

  /* ---------- collections ---------- */
  async function collectionsTab() {
    const cols = await api.adminCollections();
    const prods = await api.adminProducts();
    const body = ui.$("#body");
    body.innerHTML = `<div class="row-between" style="margin-bottom:16px"><p class="muted" style="margin:0">Collections are the curated bundles shown under each occasion.</p><button class="btn" id="add">Add a collection</button></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Collection</th><th>Occasion</th><th class="num">Items</th><th class="num">Bundle total</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${cols.map((c) => `<tr><td><strong>${ui.esc(c.title)}</strong><div class="small muted">${ui.esc(c.blurb)}</div></td><td>${c.occasion.emoji} ${ui.esc(c.occasion.name)}</td><td class="num">${c.products.length}</td><td class="num">${ui.money(c.total)}</td>
        <td style="white-space:nowrap"><button class="btn btn-ink btn-sm" data-edit="${c.id}">Edit</button> <button class="btn btn-ghost btn-sm" data-del="${c.id}">Delete</button></td></tr>`).join("")}
      </tbody></table></div>
      <dialog id="dlg" aria-labelledby="dt"><form method="dialog" id="cf" novalidate>
        <h3 id="dt">Add a collection</h3><input type="hidden" id="cid">
        <div class="form-grid">
          <div class="field full"><label for="t">Title</label><input class="input" id="t"></div>
          <div class="field"><label for="oc">Occasion</label><select class="input" id="oc">${occasions.map((o) => `<option value="${o.id}">${ui.esc(o.name)}</option>`).join("")}</select></div>
          <div class="field"><label for="bl">Short description</label><input class="input" id="bl"></div>
          <div class="field full"><span class="label">Products in this collection</span>
            <div style="max-height:240px;overflow:auto;border:1.5px solid var(--line);border-radius:10px;padding:8px;display:grid;gap:4px" id="plist">
              ${prods.map((p) => `<label style="display:flex;gap:10px;align-items:center;padding:4px 6px;cursor:pointer"><input type="checkbox" value="${p.id}" style="width:18px;height:18px;accent-color:var(--blue)"> <span aria-hidden="true">${p.emoji}</span> ${ui.esc(p.name)} <span class="muted small" style="margin-left:auto">${ui.money(p.price)}</span></label>`).join("")}
            </div></div>
        </div>
        <p class="error-text" id="err" role="alert"></p>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-ink" id="cancel">Cancel</button><button class="btn" type="submit">Save collection</button></div>
      </form></dialog>`;
    const dlg = ui.$("#dlg");
    const open = (c) => {
      ui.$("#dt").textContent = c ? "Edit collection" : "Add a collection";
      ui.$("#cid").value = c ? c.id : ""; ui.$("#t").value = c ? c.title : ""; ui.$("#oc").value = c ? c.occasion_id : occasions[0].id; ui.$("#bl").value = c ? c.blurb : "";
      const ids = c ? c.productIds : [];
      ui.$$("#plist input").forEach((i) => { i.checked = ids.includes(Number(i.value)); });
      ui.$("#err").textContent = ""; dlg.showModal();
    };
    ui.$("#add").addEventListener("click", () => open(null));
    ui.$$("[data-edit]", body).forEach((b) => b.addEventListener("click", () => open(cols.find((c) => c.id === Number(b.dataset.edit)))));
    ui.$$("[data-del]", body).forEach((b) => b.addEventListener("click", async () => { if (!confirm("Delete this collection?")) return; await ui.run(() => api.adminDeleteCollection(b.dataset.del)); ui.toast("Collection deleted."); render(); }));
    ui.$("#cancel").addEventListener("click", () => dlg.close());
    ui.$("#cf").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const id = ui.$("#cid").value;
        await api.adminSaveCollection({ id: id ? Number(id) : undefined, title: ui.$("#t").value, occasion_id: ui.$("#oc").value, blurb: ui.$("#bl").value, productIds: ui.$$("#plist input:checked").map((i) => Number(i.value)) });
        dlg.close(); ui.toast("Collection saved."); render();
      } catch (ex) { ui.$("#err").textContent = ex.message; }
    });
  }

  /* ---------- quiz ---------- */
  async function quizTab() {
    const quiz = await api.quiz();
    const body = ui.$("#body");
    const kindOf = (o) => ("tag" in o ? "tag" : "occasion_id" in o ? "occasion" : "budget" in o ? "budget" : "tag");
    body.innerHTML = `<p class="muted" style="margin-top:0;max-width:44em">Each answer carries a tag. When a customer picks it, products with that tag score higher. Occasion and budget answers are fixed to the occasion list and a price limit.</p>
      <div class="stack">${quiz.map((q) => `<div class="panel"><h3>${ui.esc(q.question)}</h3>
        <div class="stack">${q.options.map((o) => `<div class="row" style="gap:10px">
          <label class="sr-only" for="t-${o.id}">Answer text</label><input class="input" style="flex:2;min-width:180px" id="t-${o.id}" value="${ui.esc(o.text)}" data-q="${q.id}" data-o="${o.id}" data-f="text">
          ${kindOf(o) === "tag" ? `<label class="sr-only" for="g-${o.id}">Tag</label><input class="input" style="flex:1;min-width:120px" id="g-${o.id}" value="${ui.esc(o.tag || "")}" placeholder="tag" data-q="${q.id}" data-o="${o.id}" data-f="tag">` : `<span class="chip" style="min-width:130px;justify-content:center">${kindOf(o) === "occasion" ? "Occasion " + o.occasion_id : "Budget " + ui.money(o.budget)}</span>`}
          <button class="btn btn-ghost btn-sm" data-del="${q.id}:${o.id}" aria-label="Delete answer ${ui.esc(o.text)}">Delete</button></div>`).join("")}</div>
        ${kindOf(q.options[0]) === "tag" ? `<div class="row" style="margin-top:14px;gap:10px"><input class="input" style="flex:2;min-width:180px" id="nt-${q.id}" placeholder="New answer"><input class="input" style="flex:1;min-width:120px" id="ng-${q.id}" placeholder="tag"><button class="btn btn-ink btn-sm" data-new="${q.id}">Add answer</button></div>` : ""}
      </div>`).join("")}</div>`;

    ui.$$("[data-f]", body).forEach((el) => el.addEventListener("change", async () => {
      const q = quiz.find((x) => x.id === Number(el.dataset.q));
      const o = q.options.find((x) => x.id === Number(el.dataset.o));
      const text = ui.$("#t-" + o.id).value;
      const g = ui.$("#g-" + o.id);
      const ok = await ui.run(() => api.adminSaveQuizOption(q.id, { id: o.id, text, tag: g ? g.value : undefined }));
      if (ok) ui.toast("Saved."); else render();
    }));
    ui.$$("[data-del]", body).forEach((b) => b.addEventListener("click", async () => { const [q, o] = b.dataset.del.split(":"); if (await ui.run(() => api.adminDeleteQuizOption(q, o))) { ui.toast("Answer deleted."); render(); } }));
    ui.$$("[data-new]", body).forEach((b) => b.addEventListener("click", async () => {
      const q = b.dataset.new;
      const ok = await ui.run(() => api.adminSaveQuizOption(q, { text: ui.$("#nt-" + q).value, tag: ui.$("#ng-" + q).value }));
      if (ok) { ui.toast("Answer added."); render(); }
    }));
  }
  await render();
});
