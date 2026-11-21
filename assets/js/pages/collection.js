TC.start({ page: "occasions", title: "Collection" }, async (main, user) => {
  const ui = TC.ui;
  const api = TC.api;
  const col = await api.collection(ui.param("id"));
  if (!col) { main.innerHTML = `<div class="container section">${ui.empty("🔍", "Collection not found", "It may have been removed.", `<a class="btn" href="occasions.html">Browse occasions</a>`)}</div>`; return; }
  document.title = col.title + " | TimeCapsule Market";
  const o = col.occasion;
  let saved = api.wishlistIds().includes(col.id);

  main.innerHTML = `<div class="container">
    <div class="crumbs"><a href="index.html">Home</a> / <a href="occasions.html">Occasions</a> / <a href="occasions.html?o=${o.slug}">${ui.esc(o.name)}</a> / ${ui.esc(col.title)}</div>
    <div class="occ-band" style="--st:${o.color};--st-ink:${o.ink}">
      <span class="big" aria-hidden="true">${o.emoji}</span>
      <div style="flex:1;min-width:220px"><h1>${ui.esc(col.title)}</h1><p>${ui.esc(col.blurb)}</p></div>
    </div>
    <div class="split" style="margin-top:30px">
      <div>
        <h2>What is inside</h2>
        <div class="grid" style="--cols:3">${col.products.map((p) => ui.productTile(p, { sub: ui.esc(p.blurb) })).join("")}</div>
      </div>
      <aside class="panel sticky" aria-label="Bundle summary">
        <h3>${col.products.length} items</h3>
        <div class="stack">
          ${col.products.map((p) => `<div class="row-between small"><span><span aria-hidden="true">${p.emoji}</span> ${ui.esc(p.name)}</span><span>${ui.money(p.price)}</span></div>`).join("")}
        </div>
        <hr class="divider">
        <div class="row-between"><strong>Bundle total</strong><span class="price" style="font-size:1.5rem">${ui.money(col.total)}</span></div>
        <p class="small muted" style="margin:10px 0 16px">Stage handling of ${ui.money(TC.CONFIG.STAGE_FEE)} per stage is added when you build a capsule.</p>
        <div class="stack">
          <button class="btn btn-block btn-lg" id="capsule">Customise as a capsule</button>
          <button class="btn btn-ink btn-block" id="cart">Add the whole bundle to cart</button>
          <button class="btn btn-ghost btn-block" id="save" aria-pressed="${saved}">${saved ? "Saved for later" : "Save for later"}</button>
        </div>
      </aside>
    </div>
  </div>`;

  const needLogin = async () => {
    if (!(await api.me())) { location.href = "login.html?next=" + encodeURIComponent("collection.html?id=" + col.id); return false; }
    return true;
  };
  ui.$("#capsule").addEventListener("click", async () => {
    if (!(await needLogin())) return;
    const c = await ui.run(() => api.capsuleFromCollection(col.id));
    if (c) location.href = "builder.html?id=" + c.id;
  });
  ui.$("#cart").addEventListener("click", async () => {
    if (!(await needLogin())) return;
    const ok = await ui.run(async () => { for (const p of col.products) await api.addProductToCart(p.id, 1, col.occasion_id); return true; });
    if (ok) { ui.flash(`Added ${col.products.length} items to your cart.`); location.href = "cart.html"; }
  });
  ui.$("#save").addEventListener("click", async (e) => {
    if (!(await needLogin())) return;
    saved = await ui.run(() => api.toggleWishlist(col.id));
    e.target.textContent = saved ? "Saved for later" : "Save for later";
    e.target.setAttribute("aria-pressed", saved);
    ui.toast(saved ? "Saved to your collections." : "Removed from saved collections.");
  });
});
