TC.start({ page: "capsules", title: "Saved collections", auth: "user" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;

  async function render() {
    const list = await api.wishlist();
    main.innerHTML = `<div class="container">
      <div class="crumbs"><a href="index.html">Home</a> / <a href="capsules.html">My capsules</a> / Saved collections</div>
      <div class="page-head"><h1 style="font-size:clamp(2rem,4.5vw,3.2rem)">Saved collections</h1><p class="muted">Collections you saved for later.</p></div>
      ${list.length ? `<div class="grid" style="--cols:3">${list.map((c) => `<div class="stack">${ui.collectionCard(c)}<button class="btn btn-ghost btn-sm" data-rm="${c.id}">Remove from saved</button></div>`).join("")}</div>`
        : ui.empty("🔖", "Nothing saved yet", "Open a collection and choose Save for later.", `<a class="btn" href="occasions.html">Browse occasions</a>`)}
    </div>`;
    ui.$$("[data-rm]", main).forEach((b) => b.addEventListener("click", async () => {
      await ui.run(() => api.toggleWishlist(b.dataset.rm));
      ui.toast("Removed from saved collections.");
      render();
    }));
  }
  await render();
});
