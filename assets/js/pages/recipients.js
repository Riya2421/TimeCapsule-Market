TC.start({ page: "capsules", title: "Saved recipients", auth: "user" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;

  function nextBirthday(b) {
    if (!b) return null;
    const t = api.today();
    const [, m, d] = b.split("-");
    let date = `${t.slice(0, 4)}-${m}-${d}`;
    if (date < t) date = `${Number(t.slice(0, 4)) + 1}-${m}-${d}`;
    return { date, days: ui.daysTo(date) };
  }

  async function render() {
    const list = await api.recipients();
    main.innerHTML = `<div class="container">
      <div class="crumbs"><a href="index.html">Home</a> / <a href="capsules.html">My capsules</a> / Recipients</div>
      <div class="page-head row-between">
        <div><h1 style="font-size:clamp(2rem,4.5vw,3.2rem);margin-bottom:6px">Saved recipients</h1><p class="muted">People you send capsules to. Their interests shape the suggestions in the builder.</p></div>
        <button class="btn btn-lg" id="add">Add a person</button>
      </div>
      ${list.length ? `<div class="grid" style="--cols:3">${list.map((r) => {
        const bd = nextBirthday(r.birthday);
        return `<article class="panel">
          <div class="row-between"><h3 style="margin:0">${ui.esc(r.name)}</h3>${r.relation ? `<span class="chip">${ui.esc(r.relation)}</span>` : ""}</div>
          ${bd && bd.days <= 45 ? `<p style="margin:10px 0 0"><span class="chip chip-gold">Birthday ${ui.whenText(bd.days)}</span></p>` : ""}
          <div class="stack small" style="margin-top:12px">
            ${r.interests ? `<div><span class="muted">Interests:</span> ${ui.esc(r.interests)}</div>` : ""}
            ${r.email ? `<div><span class="muted">Email:</span> ${ui.esc(r.email)}</div>` : ""}
            ${r.birthday ? `<div><span class="muted">Birthday:</span> ${ui.esc(ui.fmtDate(r.birthday).replace(/ \d{4}$/, ""))}</div>` : ""}
            <div><span class="muted">Address:</span> ${r.address ? ui.esc(r.address) : "Not saved yet"}</div>
          </div>
          <div class="row" style="margin-top:16px"><button class="btn btn-ink btn-sm" data-edit="${r.id}">Edit</button><button class="btn btn-ghost btn-sm" data-del="${r.id}">Delete</button></div>
        </article>`;
      }).join("")}</div>` : ui.empty("👤", "No one saved yet", "Add a person once and reuse them for every capsule.", "")}

      <dialog id="dlg" aria-labelledby="dt">
        <form method="dialog" id="rf" novalidate>
          <h3 id="dt">Add a person</h3>
          <input type="hidden" id="rid">
          <div class="form-grid">
            <div class="field"><label for="n">Name</label><input class="input" id="n"></div>
            <div class="field"><label for="rel">Relation</label><input class="input" id="rel" placeholder="Friend, sister, boss"></div>
            <div class="field"><label for="em">Email</label><input class="input" id="em" type="email"><span class="hint">Unlock emails go here.</span></div>
            <div class="field"><label for="bd">Birthday</label><input class="input" id="bd" type="date"></div>
            <div class="field full"><label for="int">Interests</label><input class="input" id="int" placeholder="tea, books, travel"><span class="hint">Separate with commas.</span></div>
            <div class="field full"><label for="ad">Delivery address</label><textarea class="input" id="ad"></textarea></div>
          </div>
          <p class="error-text" id="err" role="alert"></p>
          <div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-ink" id="cancel">Cancel</button><button class="btn" type="submit">Save</button></div>
        </form>
      </dialog>
    </div>`;

    const dlg = ui.$("#dlg");
    const open = (r) => {
      ui.$("#dt").textContent = r ? "Edit " + r.name : "Add a person";
      ui.$("#rid").value = r ? r.id : "";
      ui.$("#n").value = r ? r.name : ""; ui.$("#rel").value = r ? r.relation : ""; ui.$("#em").value = r ? r.email : "";
      ui.$("#bd").value = r ? r.birthday : ""; ui.$("#int").value = r ? r.interests : ""; ui.$("#ad").value = r ? r.address : "";
      ui.$("#err").textContent = "";
      dlg.showModal();
    };
    ui.$("#add").addEventListener("click", () => open(null));
    ui.$$("[data-edit]", main).forEach((b) => b.addEventListener("click", () => open(list.find((r) => r.id === Number(b.dataset.edit)))));
    ui.$$("[data-del]", main).forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Delete this person?")) return;
      if (await ui.run(() => api.deleteRecipient(b.dataset.del)) !== undefined) { ui.toast("Person deleted."); render(); }
    }));
    ui.$("#cancel").addEventListener("click", () => dlg.close());
    ui.$("#rf").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const id = ui.$("#rid").value;
        await api.saveRecipient({ id: id ? Number(id) : undefined, name: ui.$("#n").value, relation: ui.$("#rel").value, email: ui.$("#em").value, birthday: ui.$("#bd").value, interests: ui.$("#int").value, address: ui.$("#ad").value });
        dlg.close(); ui.toast("Saved."); render();
      } catch (ex) { ui.$("#err").textContent = ex.message; }
    });
  }
  await render();
});
