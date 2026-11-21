TC.start({ page: "home", title: "Gifts that unfold over time" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;
  const t = api.today();
  const plus = (n) => ui.addDays(t, n);
  const occasions = await api.occasions();
  const cols = await api.collections();
  const group = await api.publicGroup("kabirgroup2026");

  const sample = [
    { to: "To Aanya, new flat", what: "Day 1: the first evening", date: plus(1), open: true, items: [{ emoji: "🍵", name: "Ceramic tea mug set" }, { emoji: "🕯️", name: "Scented candle trio" }], note: "Open this one first. A cup for your first evening in your own place." },
    { to: "To Aanya, new flat", what: "One month later", date: plus(31), items: [{ emoji: "✨", name: "Fairy light string" }], note: "A month in. Light these and sit down for a minute." },
    { to: "To Aanya, new flat", what: "One year later", date: plus(366), locked: true, days: 365 },
  ];

  main.innerHTML = `
  <div class="container">
    <section class="hero" aria-labelledby="h">
      <div>
        <h1 id="h">Send a gift that keeps arriving.</h1>
        <p class="lead">Pick an occasion, split the gift into stages, and choose the date each stage opens. Friends can chip in through one link.</p>
        <div class="cta">
          <a class="btn btn-lg" href="builder.html">Build a capsule</a>
          <a class="btn btn-lg btn-ink" href="quiz.html">Take the gift quiz</a>
        </div>
        <p class="hero-note">Try it: tap an envelope to see what a capsule for a new flat could hold.</p>
      </div>
      <div class="tl" id="hero-tl">
        ${sample.map((s) => `<div class="tl-item"><span class="tl-date">${ui.esc(ui.fmtDate(s.date))}</span>${ui.envelope(s)}</div>`).join("")}
      </div>
    </section>
  </div>

  <section class="section container" aria-labelledby="occ-h">
    <div class="row-between" style="margin-bottom:22px">
      <h2 id="occ-h" style="margin:0">Start from the moment</h2>
      <a href="occasions.html">See all collections</a>
    </div>
    <div class="stamp-grid on-white">${occasions.map((o) => ui.stampCard(o)).join("")}</div>
  </section>

  <section class="section container" aria-labelledby="how-h">
    <h2 id="how-h">How a capsule works</h2>
    <div class="steps">
      <div class="step"><h3>Choose the moment</h3><p>Pick an occasion, or answer six quick questions about the person and get a bundle within your budget.</p></div>
      <div class="step"><h3>Split it into stages</h3><p>Put items into stages and pick a date for each one. A card goes with every stage.</p></div>
      <div class="step"><h3>Pay, or share the cost</h3><p>Pay yourself, or send one link so friends can add money, an item or a message.</p></div>
    </div>
  </section>

  ${group ? `
  <section class="section container" aria-labelledby="grp-h">
    <div class="split" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:48px">
      <div>
        <h2 id="grp-h">Gifting is better together</h2>
        <p class="lead">One link for the whole group. Everyone adds what they can, and the capsule is ordered once the target is met.</p>
        <div class="panel" style="margin-top:20px">
          <div class="row-between"><strong>${ui.esc(group.title)}</strong>${ui.statusChip(group.status)}</div>
          <div class="meter" style="margin:14px 0 8px" role="progressbar" aria-valuemin="0" aria-valuemax="${group.target}" aria-valuenow="${group.raised}" aria-label="Funding progress"><i style="width:${Math.min(100, Math.round((group.raised / group.target) * 100))}%"></i></div>
          <div class="row-between small"><span><strong>${ui.money(group.raised)}</strong> raised of ${ui.money(group.target)}</span><span class="muted">Ends ${ui.esc(ui.fmtDate(group.deadline))}</span></div>
        </div>
        <p style="margin-top:18px"><a class="btn btn-ink" href="contribute.html?t=${group.id ? "kabirgroup2026" : ""}">See the contribution page</a></p>
      </div>
      <div class="wall" aria-label="Messages from friends">
        ${group.contributions.slice(0, 4).map((c) => `<div class="note-card"><q>${ui.esc(c.message)}</q><span class="by"><span>${ui.esc(c.name)}</span><span>${ui.money(c.amount)}</span></span></div>`).join("")}
      </div>
    </div>
  </section>` : ""}

  <section class="section container" aria-labelledby="pop-h">
    <h2 id="pop-h">Popular collections</h2>
    <div class="grid" style="--cols:3">${cols.slice(0, 6).map((c) => ui.collectionCard(c)).join("")}</div>
  </section>

  <section class="section container">
    <div class="panel" style="background:var(--ink);color:#fff;border-color:var(--ink);display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between">
      <div><h2 style="color:#fff;margin:0 0 6px">Remember it next year</h2><p style="margin:0;color:#dfe4fa;max-width:34em">Every finished capsule goes on your memory timeline. A year later we remind you, and you can repeat it or upgrade it in one click.</p></div>
      <a class="btn btn-red btn-lg" href="timeline.html">Open my timeline</a>
    </div>
  </section>`;

  ui.bindEnvelopes(main);
});
