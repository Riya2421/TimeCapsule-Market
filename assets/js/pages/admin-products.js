TC.start({ page: "admin-products", title: "Products", auth: "admin" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;
  let q = "";
  const vendors = await api.adminVendors();

  async function render() {
    const all = await api.adminProducts();
    const list = all.filter((p) => !q || (p.name + " " + p.tags.join(" ")).toLowerCase().includes(q.toLowerCase()));
    main.innerHTML = `<div class="container">
      <div class="page-head row-between">
        <div><h1 style="font-size:clamp(2rem,4.5vw,3.2rem);margin-bottom:6px">Products and tags</h1><p class="muted">Tags power the gift quiz. A product that shares more tags with the answers ranks higher.</p></div>
        <button class="btn btn-lg" id="add">Add a product</button>
      </div>
      <div class="field" style="max-width:360px"><label for="q" class="sr-only">Search products</label><input class="input" id="q" type="search" placeholder="Search by name or tag" value="${ui.esc(q)}"></div>
      <div class="table-wrap"><table class="t">
        <thead><tr><th>Product</th><th>Vendor</th><th>Tags</th><th class="num">Price</th><th class="num">Stock</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${list.map((p) => `<tr>
          <td><span aria-hidden="true">${p.emoji}</span> <strong>${ui.esc(p.name)}</strong></td>
          <td>${ui.esc(p.vendor || "")}</td>
          <td>${p.tags.map((t) => `<span class="chip" style="margin:0 4px 4px 0">${ui.esc(t)}</span>`).join("")}</td>
          <td class="num">${ui.money(p.price)}</td>
          <td class="num"><span class="chip ${p.stock === 0 ? "chip-red" : p.stock <= 12 ? "chip-gold" : "chip-ok"}">${p.stock}</span></td>
          <td style="white-space:nowrap"><button class="btn btn-ink btn-sm" data-edit="${p.id}">Edit</button> <button class="btn btn-ghost btn-sm" data-del="${p.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">No products match.</td></tr>`}
        </tbody></table></div>

      <dialog id="dlg" aria-labelledby="dt">
        <form method="dialog" id="pf" novalidate>
          <h3 id="dt">Add a product</h3><input type="hidden" id="pid">
          <div class="form-grid">
            <div class="field full"><label for="n">Name</label><input class="input" id="n"></div>
            <div class="field"><label for="pr">Price (₹)</label><input class="input" id="pr" type="number" min="1"></div>
            <div class="field"><label for="st">Stock</label><input class="input" id="st" type="number" min="0"></div>
            <div class="field"><label for="em">Emoji</label><input class="input" id="em" maxlength="4" placeholder="🎁"></div>
            <div class="field"><label for="vn">Vendor</label><select class="input" id="vn">${vendors.map((v) => `<option value="${v.id}">${ui.esc(v.shop_name)}</option>`).join("")}</select></div>
            <div class="field full"><label for="tg">Tags</label><input class="input" id="tg" placeholder="cozy, tea, home"><span class="hint">Separate with commas. Use the same words as the quiz answers.</span></div>
            <div class="field full"><label for="bl">Short description</label><input class="input" id="bl"></div>
          </div>
          <p class="error-text" id="err" role="alert"></p>
          <div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-ink" id="cancel">Cancel</button><button class="btn" type="submit">Save product</button></div>
        </form>
      </dialog>
    </div>`;

    const dlg = ui.$("#dlg");
    const open = (p) => {
      ui.$("#dt").textContent = p ? "Edit product" : "Add a product";
      ui.$("#pid").value = p ? p.id : "";
      ui.$("#n").value = p ? p.name : ""; ui.$("#pr").value = p ? p.price : ""; ui.$("#st").value = p ? p.stock : "";
      ui.$("#em").value = p ? p.emoji : ""; ui.$("#vn").value = p ? p.vendor_id : vendors[0].id; ui.$("#tg").value = p ? p.tags.join(", ") : ""; ui.$("#bl").value = p ? p.blurb : "";
      ui.$("#err").textContent = ""; dlg.showModal();
    };
    ui.$("#add").addEventListener("click", () => open(null));
    ui.$$("[data-edit]", main).forEach((b) => b.addEventListener("click", () => open(all.find((p) => p.id === Number(b.dataset.edit)))));
    ui.$$("[data-del]", main).forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Delete this product?")) return;
      if (await ui.run(() => api.adminDeleteProduct(b.dataset.del))) { ui.toast("Product deleted."); render(); }
    }));
    ui.$("#cancel").addEventListener("click", () => dlg.close());
    ui.$("#q").addEventListener("input", (e) => { q = e.target.value; const pos = e.target.selectionStart; render().then(() => { const el = ui.$("#q"); el.focus(); el.setSelectionRange(pos, pos); }); });
    ui.$("#pf").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const id = ui.$("#pid").value;
        const old = id ? all.find((p) => p.id === Number(id)) : null;
        await api.adminSaveProduct({ id: id ? Number(id) : undefined, name: ui.$("#n").value, price: ui.$("#pr").value, stock: ui.$("#st").value, emoji: ui.$("#em").value, vendor_id: ui.$("#vn").value, tags: ui.$("#tg").value, blurb: ui.$("#bl").value, tint: old ? old.tint : undefined });
        dlg.close(); ui.toast("Product saved."); render();
      } catch (ex) { ui.$("#err").textContent = ex.message; }
    });
  }
  await render();
});
