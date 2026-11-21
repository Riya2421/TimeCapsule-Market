TC.start({ page: "occasions", title: "Product" }, async (main, user) => {
  const ui = TC.ui;
  const api = TC.api;
  const p = await api.product(ui.param("id"));
  if (!p) { main.innerHTML = `<div class="container section">${ui.empty("🔍", "Product not found", "It may have been removed.", `<a class="btn" href="occasions.html">Browse occasions</a>`)}</div>`; return; }
  document.title = p.name + " | TimeCapsule Market";
  const stockText = p.stock === 0 ? "Out of stock" : p.stock <= 12 ? `Only ${p.stock} left` : "In stock";
  const drafts = user ? (await api.capsules()).filter((c) => c.status === "draft" || c.status === "funding") : [];

  main.innerHTML = `<div class="container">
    <div class="crumbs"><a href="index.html">Home</a> / <a href="occasions.html">Occasions</a> / ${ui.esc(p.name)}</div>
    <div class="prod-hero">
      <div class="prod-art" style="--tint:${p.tint}" aria-hidden="true">${p.emoji}</div>
      <div class="stack">
        <h1 style="font-size:clamp(2rem,4vw,3rem)">${ui.esc(p.name)}</h1>
        <p class="lead" style="margin:0">${ui.esc(p.blurb)}</p>
        <div class="row">${p.tags.map((t) => `<span class="chip">${ui.esc(t)}</span>`).join("")}</div>
        <div class="row" style="gap:18px"><span class="price" style="font-size:2rem">${ui.money(p.price)}</span><span class="chip ${p.stock === 0 ? "chip-red" : p.stock <= 12 ? "chip-gold" : "chip-ok"}">${stockText}</span></div>
        <p class="small muted">Sold by ${ui.esc(p.vendor.shop_name)}, ${ui.esc(p.vendor.city)}</p>
        <hr class="divider">
        <div class="row">
          <div class="qty" aria-label="Quantity"><button type="button" id="minus" aria-label="Fewer">&minus;</button><span id="q" aria-live="polite">1</span><button type="button" id="plus" aria-label="More">+</button></div>
          <button class="btn btn-lg" id="add" ${p.stock === 0 ? "disabled" : ""}>Add to cart</button>
        </div>
        <div class="panel-soft" style="margin-top:8px">
          <h3 style="font-size:1.05rem">Put it in a capsule</h3>
          ${drafts.length ? `
            <div class="form-grid" style="margin-bottom:0">
              <div class="field"><label for="cap">Capsule</label><select class="input" id="cap">${drafts.map((c) => `<option value="${c.id}">${ui.esc(c.title)}</option>`).join("")}</select></div>
              <div class="field"><label for="stg">Stage</label><select class="input" id="stg"></select></div>
            </div>
            <button class="btn btn-ink" id="addcap">Add to this stage</button>`
            : `<p class="small muted" style="margin-bottom:12px">Open this item on a date you choose. Start a capsule with it as the first item.</p><button class="btn btn-ink" id="newcap">Start a capsule with this</button>`}
        </div>
        ${p.collections.length ? `<p class="small">Found in: ${p.collections.map((c) => `<a href="collection.html?id=${c.id}">${ui.esc(c.title)}</a>`).join(", ")}</p>` : ""}
      </div>
    </div>
    ${p.similar.length ? `<section class="section"><h2>Goes well with</h2><div class="grid" style="--cols:4">${p.similar.map((s) => ui.productTile(s)).join("")}</div></section>` : ""}
  </div>`;

  let qty = 1;
  const q = ui.$("#q");
  ui.$("#minus").addEventListener("click", () => { qty = Math.max(1, qty - 1); q.textContent = qty; });
  ui.$("#plus").addEventListener("click", () => { qty = Math.min(p.stock || 1, qty + 1); q.textContent = qty; });

  const needLogin = async () => {
    if (!(await api.me())) { location.href = "login.html?next=" + encodeURIComponent("product.html?id=" + p.id); return false; }
    return true;
  };
  ui.$("#add").addEventListener("click", async () => {
    if (!(await needLogin())) return;
    const ok = await ui.run(() => api.addProductToCart(p.id, qty));
    if (ok) { ui.toast(`${p.name} added to your cart.`); setTimeout(() => location.reload(), 700); }
  });

  const cap = ui.$("#cap");
  if (cap) {
    const fill = () => { const c = drafts.find((x) => x.id === Number(cap.value)); ui.$("#stg").innerHTML = c.stages.map((s) => `<option value="${s.stage_no}">Stage ${s.stage_no}, opens ${ui.esc(ui.fmtShort(s.unlock_date))}</option>`).join(""); };
    cap.addEventListener("change", fill); fill();
    ui.$("#addcap").addEventListener("click", async () => {
      const ok = await ui.run(() => api.addItem(cap.value, ui.$("#stg").value, p.id, qty));
      if (ok) { ui.flash(`${p.name} added to the capsule.`); location.href = "builder.html?id=" + cap.value; }
    });
  }
  const nc = ui.$("#newcap");
  if (nc) nc.addEventListener("click", async () => {
    if (!(await needLogin())) return;
    const c = await ui.run(() => api.newCapsule({}));
    if (!c) return;
    await ui.run(() => api.addItem(c.id, 1, p.id, qty));
    location.href = "builder.html?id=" + c.id;
  });
});
