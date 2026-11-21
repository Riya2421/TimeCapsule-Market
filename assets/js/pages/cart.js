TC.start({ page: "cart", title: "Cart", auth: "user" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;

  async function render() {
    const cart = await api.cart();
    if (!cart.lines.length) {
      main.innerHTML = `<div class="container"><div class="crumbs"><a href="index.html">Home</a> / Cart</div>
        ${ui.empty("🛒", "Your cart is empty", "Start a capsule or add something from a collection.", `<div class="row" style="justify-content:center"><a class="btn" href="builder.html">Build a capsule</a><a class="btn btn-ink" href="occasions.html">Browse occasions</a></div>`)}</div>`;
      return;
    }
    main.innerHTML = `<div class="container">
      <div class="crumbs"><a href="index.html">Home</a> / Cart</div>
      <div class="page-head"><h1 style="font-size:clamp(2rem,4.5vw,3.2rem)">Your cart</h1></div>
      <div class="split">
        <div class="stack">
          ${cart.lines.map((l) => (l.type === "capsule" ? capsuleLine(l) : productLine(l))).join("")}
        </div>
        <aside class="panel sticky" aria-label="Order summary">
          <h3>Summary</h3>
          <div class="sum-row"><span>${ui.plural(cart.count, "line")}</span><span>${ui.money(cart.subtotal)}</span></div>
          <div class="sum-row"><span>Delivery</span><span>Free</span></div>
          <div class="sum-row total"><span>Total</span><span>${ui.money(cart.subtotal)}</span></div>
          <a class="btn btn-lg btn-block" style="margin-top:18px" href="checkout.html">Go to checkout</a>
        </aside>
      </div>
    </div>`;
    ui.$$("[data-remove]", main).forEach((b) => b.addEventListener("click", async () => { await ui.run(() => api.removeCartLine(Number(b.dataset.remove))); await render(); refreshBadge(); }));
    ui.$$("[data-q]", main).forEach((b) => b.addEventListener("click", async () => { const [i, q] = b.dataset.q.split(":").map(Number); await ui.run(() => api.setCartQty(i, q)); await render(); refreshBadge(); }));
  }
  function refreshBadge() {
    const n = api.cartCount();
    const b = ui.$(".cart-link .badge");
    if (b) { b.textContent = n; b.dataset.zero = n === 0; }
  }

  function productLine(l) {
    const p = l.product;
    return `<div class="line-item" style="background:var(--surface);border-color:var(--ink);padding:14px">
      <span class="em" aria-hidden="true" style="font-size:2.2rem">${p.emoji}</span>
      <div><a href="product.html?id=${p.id}"><strong>${ui.esc(p.name)}</strong></a><div class="small muted">${ui.money(p.price)} each</div></div>
      <div class="qty"><button data-q="${l.idx}:${l.qty - 1}" aria-label="Fewer">&minus;</button><span>${l.qty}</span><button data-q="${l.idx}:${l.qty + 1}" aria-label="More">+</button></div>
      <div class="row" style="gap:6px"><span class="price">${ui.money(l.amount)}</span><button class="btn btn-ghost btn-sm" data-remove="${l.idx}" aria-label="Remove ${ui.esc(p.name)}">Remove</button></div>
    </div>`;
  }
  function capsuleLine(l) {
    const c = l.capsule;
    return `<div class="panel">
      <div class="row-between" style="align-items:flex-start">
        <div><span class="chip chip-blue">Capsule</span><h3 style="margin:8px 0 2px">${ui.esc(c.title)}</h3>
        <p class="small muted" style="margin:0">For ${ui.esc(c.recipient ? c.recipient.name : "someone")} &middot; ${ui.plural(c.stages.length, "stage")}</p></div>
        <span class="price" style="font-size:1.4rem">${ui.money(l.amount)}</span>
      </div>
      <hr class="divider">
      <div class="stack">
        ${c.stages.map((s) => `<div class="small"><strong>Stage ${s.stage_no}</strong> opens ${ui.esc(ui.fmtDate(s.unlock_date))}: ${s.items.map((i) => `<span aria-hidden="true">${i.product.emoji}</span> ${ui.esc(i.product.name)}${i.qty > 1 ? " &times; " + i.qty : ""}`).join(", ")}</div>`).join("")}
      </div>
      <div class="small muted" style="margin-top:12px">Items ${ui.money(c.totals.items)} &middot; Wrap ${ui.money(c.totals.wrap)} &middot; Handling ${ui.money(c.totals.fee)}</div>
      <div class="row" style="margin-top:14px"><a class="btn btn-ink btn-sm" href="builder.html?id=${c.id}">Edit capsule</a><button class="btn btn-ghost btn-sm" data-remove="${l.idx}">Remove from cart</button></div>
    </div>`;
  }
  await render();
});
