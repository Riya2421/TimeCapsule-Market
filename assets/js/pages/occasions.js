TC.start({ page: "occasions", title: "Occasions" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;
  const slug = ui.param("o");
  const maxB = Number(ui.param("max")) || 0;
  const occasions = await api.occasions();
  const occ = slug ? await api.occasion(slug) : null;
  const list = await api.collections({ occasion_id: occ ? occ.id : undefined, maxBudget: maxB || undefined });
  const saved = api.wishlistIds();

  const url = (o, max) => "occasions.html?" + [o ? "o=" + o : "", max ? "max=" + max : ""].filter(Boolean).join("&");
  const budgets = [[0, "Any budget"], [1500, "Up to ₹1,500"], [2500, "Up to ₹2,500"], [4000, "Up to ₹4,000"]];

  main.innerHTML = `<div class="container">
    <div class="crumbs"><a href="index.html">Home</a> / ${occ ? `<a href="occasions.html">Occasions</a> / ${ui.esc(occ.name)}` : "Occasions"}</div>
    ${occ ? `
      <div class="occ-band" style="--st:${occ.color};--st-ink:${occ.ink}">
        <span class="big" aria-hidden="true">${occ.emoji}</span>
        <div style="flex:1;min-width:220px"><h1>${ui.esc(occ.name)}</h1><p>${ui.esc(occ.tagline)}</p></div>
        <button class="btn btn-lg" id="start" style="background:#fff;color:#101a3b;border-color:#fff">Build a capsule for this</button>
      </div>` : `
      <div class="page-head"><h1 style="font-size:clamp(2rem,4.5vw,3.4rem)">Shop by occasion</h1><p class="lead">Every moment has a collection. Open one, or start a capsule from scratch.</p></div>
      <div class="stamp-grid on-white" style="margin-bottom:40px">${occasions.map((o) => ui.stampCard(o)).join("")}</div>`}
    <div class="row-between" style="margin:30px 0 18px">
      <h2 style="margin:0">${occ ? "Collections" : "All collections"} <span class="muted" style="font-weight:600">(${list.length})</span></h2>
      <div class="row" role="group" aria-label="Budget filter">
        ${budgets.map(([v, l]) => `<a class="chip chip-btn" href="${url(slug, v)}" aria-pressed="${v === maxB}" style="text-decoration:none">${l}</a>`).join("")}
      </div>
    </div>
    ${list.length ? `<div class="grid" style="--cols:3">${list.map((c) => ui.collectionCard(c, saved.includes(c.id))).join("")}</div>`
      : ui.empty("🔍", "No collections in this budget", "Try a higher budget, or build your own capsule item by item.", `<a class="btn" href="${url(slug, 0)}">Show every budget</a>`)}
    ${occ ? `<div class="row" style="margin-top:34px"><span class="muted">Other occasions:</span>${occasions.filter((o) => o.id !== occ.id).map((o) => `<a class="chip" href="occasions.html?o=${o.slug}" style="text-decoration:none">${o.emoji} ${ui.esc(o.name)}</a>`).join("")}</div>` : ""}
  </div>`;

  const start = ui.$("#start");
  if (start) start.addEventListener("click", async () => {
    if (!(await api.me())) { location.href = "login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search); return; }
    const c = await ui.run(() => api.newCapsule({ occasion_id: occ.id }));
    if (c) location.href = "builder.html?id=" + c.id;
  });
});
