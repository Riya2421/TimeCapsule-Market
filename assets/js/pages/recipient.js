TC.start({ page: "recipient", title: "Your capsule" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;
  const tok = ui.param("t");
  const v = tok ? await api.recipientView(tok) : null;
  if (!v) {
    main.innerHTML = `<div class="container section">${ui.empty("✉️", "Nothing to open yet", "This link is not valid, or the capsule has not started. Check the email you were sent.", `<a class="btn" href="index.html">Go to the home page</a>`)}</div>`;
    return;
  }
  document.title = v.title + " | TimeCapsule Market";
  const opened = v.stages.filter((s) => s.status !== "locked");
  const next = v.stages.filter((s) => s.status === "locked").sort((a, b) => a.unlock_date.localeCompare(b.unlock_date))[0];
  const newest = opened.length ? opened[opened.length - 1].stage_no : 0;

  main.innerHTML = `<div class="container" style="max-width:860px">
    <div class="page-head" style="padding-top:36px">
      <span class="chip chip-gold">${v.occasion ? v.occasion.emoji + " " + ui.esc(v.occasion.name) : "A gift"}</span>
      <h1 style="font-size:clamp(2.2rem,5.5vw,4rem);margin:14px 0 10px">${ui.esc(v.title)}</h1>
      <p class="lead">For ${ui.esc(v.to.split(" ")[0])}, from ${ui.esc(v.from)}. It arrives in ${ui.plural(v.stages.length, "stage")}. Tap an envelope to open it.</p>
    </div>

    ${next ? `<div class="panel" style="margin-bottom:28px;display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between">
      <div><div class="small muted">Next stage opens</div><div class="countdown">${ui.esc(ui.fmtDate(next.unlock_date))}</div></div>
      <div class="chip chip-blue" style="font-size:1rem;padding:6px 16px">${ui.whenText(next.days_left)}</div></div>` : `<div class="panel" style="margin-bottom:28px;background:var(--ok-tint);border-color:var(--ok)"><strong>Every stage is open.</strong> Thank you for letting them surprise you.</div>`}

    <div class="tl">
      ${v.stages.map((s) => `<div class="tl-item"><span class="tl-date">Stage ${s.stage_no}: ${ui.esc(ui.fmtDate(s.unlock_date))}</span>
        ${ui.envelope({ to: "To " + v.to.split(" ")[0], what: s.status === "locked" ? "Sealed" : "Stage " + s.stage_no, date: s.unlock_date, locked: s.status === "locked", days: s.days_left, items: s.items, note: s.message, open: s.stage_no === newest })}</div>`).join("")}
    </div>

    ${v.notes_unlocked && v.notes.length ? `<section class="section" aria-labelledby="notes-h"><h2 id="notes-h">Notes from your friends</h2>
      <div class="wall">${v.notes.map((n) => `<div class="note-card"><q>${ui.esc(n.message)}</q><span class="by"><span>${ui.esc(n.name)}</span></span></div>`).join("")}</div></section>` : ""}

    ${opened.length ? `<section class="section" aria-labelledby="ty-h"><div class="panel" style="max-width:560px"><h3 id="ty-h">Say thank you</h3>
      ${v.thank_you ? `<p style="margin:0">You wrote: &ldquo;${ui.esc(v.thank_you)}&rdquo;</p>` : `<form id="ty" novalidate><div class="field"><label for="msg" class="sr-only">Your message</label><textarea class="input" id="msg" maxlength="300" placeholder="Write a few words to ${ui.esc(v.from.split(" ")[0])}."></textarea></div><p class="error-text" id="err" role="alert"></p><button class="btn" type="submit">Send thank-you</button></form>`}</div></section>` : ""}
  </div>`;

  ui.bindEnvelopes(main);
  const f = ui.$("#ty");
  if (f) f.addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await api.thankYou(tok, ui.$("#msg").value); ui.flash("Thank-you sent."); location.reload(); }
    catch (ex) { ui.$("#err").textContent = ex.message; }
  });
});
