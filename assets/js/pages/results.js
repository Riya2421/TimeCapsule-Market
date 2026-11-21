TC.start({ page: "quiz", title: "Your gift matches" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;
  let answers = null;
  try { answers = JSON.parse(sessionStorage.getItem("tc_quiz") || "null"); } catch (e) { /* ignore */ }
  if (!answers) { location.replace("quiz.html"); return; }

  const [res, occ] = await Promise.all([api.suggest(answers), answers.occasion_id ? api.occasion(answers.occasion_id) : null]);
  const user = await api.me();
  const pct = Math.min(100, Math.round((res.sum / res.budget) * 100));

  main.innerHTML = `<div class="container">
    <div class="crumbs"><a href="index.html">Home</a> / <a href="quiz.html">Gift quiz</a> / Results</div>
    <div class="page-head">
      <h1 style="font-size:clamp(2rem,4.5vw,3.4rem)">Your matches</h1>
      <div class="row" style="margin-top:12px">
        ${answers.tags.map((t) => `<span class="chip chip-blue">${ui.esc(t)}</span>`).join("")}
        ${occ ? `<span class="chip chip-gold">${occ.emoji} ${ui.esc(occ.name)}</span>` : ""}
        <span class="chip">Budget ${ui.money(res.budget)}</span>
        <a class="small" href="quiz.html">Change answers</a>
      </div>
    </div>

    <div class="split">
      <div>
        <h2>Ranked by match</h2>
        <p class="small muted">Each product scores 3 points for every interest it matches, 2 points if it belongs to a ${occ ? ui.esc(occ.name.toLowerCase()) : "chosen"} collection, and 1 point if its price fits your budget.</p>
        <div class="grid" style="--cols:3">
          ${res.ranked.slice(0, 9).map((r) => ui.productTile(r.product, { badge: "Match " + r.score, sub: `<span class="score-line">3&times;${r.T} + 2&times;${r.O} + ${r.B} = <strong>${r.score}</strong></span>${r.matched.length ? " &middot; " + r.matched.map(ui.esc).join(", ") : ""}` })).join("")}
        </div>
      </div>

      <aside class="panel sticky" aria-label="Suggested capsule">
        <h3>Suggested capsule</h3>
        ${res.picked.length ? `
          <div>${res.picked.map((p) => `<div class="pick-row"><span class="em" aria-hidden="true">${p.emoji}</span><span>${ui.esc(p.name)}</span><span class="price">${ui.money(p.price)}</span></div>`).join("")}</div>
          <div class="meter ${res.sum > res.budget ? "over" : ""}" style="margin:14px 0 8px" role="progressbar" aria-valuemin="0" aria-valuemax="${res.budget}" aria-valuenow="${res.sum}" aria-label="Budget used"><i style="width:${pct}%"></i></div>
          <div class="row-between small"><span><strong>${ui.money(res.sum)}</strong> of ${ui.money(res.budget)}</span><span class="muted">${ui.money(res.budget - res.sum)} left</span></div>
          <p class="small muted" style="margin:12px 0 16px">We fill the capsule from the top match down and skip anything that would go over your budget. You can change everything in the builder.</p>
          <button class="btn btn-lg btn-block" id="build">Build this capsule</button>`
          : ui.empty("🤔", "Nothing fits yet", "Try a higher budget or different answers.", `<a class="btn" href="quiz.html">Retake the quiz</a>`)}
      </aside>
    </div>
  </div>`;

  const b = ui.$("#build");
  if (b) b.addEventListener("click", async () => {
    if (!user) { location.href = "login.html?next=results.html"; return; }
    const c = await ui.run(() => api.buildFromQuiz(answers, {}));
    if (c) { ui.flash("Capsule created from your quiz answers."); location.href = "builder.html?id=" + c.id; }
  });
});
