TC.start({ page: "admin", title: "Admin dashboard", auth: "admin" }, async (main) => {
  const ui = TC.ui;
  const s = await TC.api.adminStats();
  const maxRev = Math.max(1, ...s.byOccasion.map((r) => r.revenue));

  main.innerHTML = `<div class="container">
    <div class="page-head"><h1 style="font-size:clamp(2rem,4.5vw,3.2rem)">Dashboard</h1><p class="muted">Store activity as of ${ui.esc(ui.fmtDate(s.today))}.</p></div>

    <div class="kpis" style="margin-bottom:26px">
      <div class="kpi"><div class="v">${s.ordersToday}</div><div class="l">Orders today</div></div>
      <div class="kpi"><div class="v">${s.ordersTotal}</div><div class="l">Orders in total</div></div>
      <div class="kpi"><div class="v">${ui.money(s.revenue)}</div><div class="l">Revenue</div></div>
      <div class="kpi"><div class="v">${s.activeCapsules}</div><div class="l">Capsules in progress</div></div>
    </div>

    <div class="split" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:24px">
      <div class="stack">
        <div class="panel"><h3>Revenue by occasion</h3>
          <div class="bars">${s.byOccasion.map((r) => `<div class="bar-row"><span>${ui.esc(r.name)}</span><span class="track"><i style="width:${Math.round((r.revenue / maxRev) * 100)}%"></i></span><span class="num">${ui.money(r.revenue)}</span></div>`).join("")}</div>
          <p class="small muted" style="margin:14px 0 0">Orders with no occasion are grouped as Other.</p></div>
        <div class="panel"><div class="row-between"><h3 style="margin:0">Recent orders</h3><a href="admin-orders.html">All orders</a></div>
          <div class="table-wrap" style="margin-top:14px"><table class="t"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>
            ${s.recent.map((o) => `<tr><td>#${o.id}</td><td>${ui.esc(o.customer || "")}</td><td>${ui.statusChip(o.status)}</td><td class="num">${ui.money(o.total)}</td></tr>`).join("")}
          </tbody></table></div></div>
      </div>
      <div class="stack">
        <div class="panel"><h3>Group capsules collecting money</h3>
          ${s.funding.length ? s.funding.map((f) => { const pct = Math.min(100, Math.round((f.raised / f.target) * 100)); return `<div style="margin-bottom:16px"><div class="row-between small"><strong>${ui.esc(f.title)}</strong><span class="muted">ends ${ui.esc(ui.fmtShort(f.deadline))}</span></div><div class="meter" style="margin:6px 0"><i style="width:${pct}%"></i></div><div class="small muted">${ui.money(f.raised)} of ${ui.money(f.target)}</div></div>`; }).join("") : `<p class="muted" style="margin:0">None right now.</p>`}
        </div>
        <div class="panel"><h3>Running low on stock</h3>
          ${s.lowStock.map((p) => `<div class="row-between small" style="padding:6px 0;border-bottom:1.5px dashed var(--line)"><span><span aria-hidden="true">${p.emoji}</span> ${ui.esc(p.name)}</span><span class="chip ${p.stock <= 5 ? "chip-red" : "chip-gold"}">${p.stock} left</span></div>`).join("")}
          <p style="margin:14px 0 0"><a href="admin-products.html">Manage products</a></p></div>
      </div>
    </div>
  </div>`;
});
