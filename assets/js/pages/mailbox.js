TC.start({ page: "mailbox", title: "Demo mailbox" }, async (main) => {
  const ui = TC.ui;
  const mails = await TC.api.mailbox();
  const kind = { unlock: "Stage opened", reminder: "Yearly reminder", funding: "Group funding", thanks: "Thank-you", info: "Notice" };

  main.innerHTML = `<div class="container" style="max-width:860px">
    <div class="crumbs"><a href="index.html">Home</a> / Demo mailbox</div>
    <div class="page-head"><h1 style="font-size:clamp(2rem,4.5vw,3.2rem)">Demo mailbox</h1>
      <p class="lead">The real site would send these emails with Nodemailer. Here they appear in this list so you can see what the scheduler does.</p></div>
    ${mails.length ? `<div class="stack">${mails.map((m) => `<article class="panel-soft">
      <div class="row-between"><span class="chip chip-blue">${kind[m.kind] || "Notice"}</span><span class="small muted">${ui.esc(ui.fmtDate(m.date))}</span></div>
      <h3 style="margin:10px 0 4px;font-size:1.1rem">${ui.esc(m.subject)}</h3>
      <p class="small muted" style="margin:0 0 8px">To: ${ui.esc(m.to)}</p>
      <p style="margin:0 0 12px">${ui.esc(m.body)}</p>
      ${m.link ? `<a class="btn btn-ink btn-sm" href="${ui.esc(m.link)}">Open the link</a>` : ""}</article>`).join("")}</div>`
      : ui.empty("📭", "No emails yet", "Move the demo clock forward from the footer. When a stage opens, its email shows up here.", `<a class="btn" href="capsules.html">My capsules</a>`)}
  </div>`;
});
