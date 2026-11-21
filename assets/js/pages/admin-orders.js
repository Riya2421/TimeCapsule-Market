TC.start({ page: "admin-orders", title: "Orders and reports", auth: "admin" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;
  let tab = ["orders", "schedule", "reports"].includes(ui.param("tab")) ? ui.param("tab") : "orders";
  let filter = "all";
  const statuses = ["placed", "packed", "shipped", "delivered", "cancelled"];

  async function render() {
    main.innerHTML = `<div class="container">
      <div class="page-head"><h1 style="font-size:clamp(2rem,4.5vw,3.2rem)">Orders and reports</h1></div>
      <div class="tabs" role="tablist" aria-label="Section" style="margin-bottom:24px">
        ${[["orders", "Orders"], ["schedule", "Capsule schedule"], ["reports", "Reports"]].map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-tab="${k}">${l}</button>`).join("")}
      </div><div id="body"></div></div>`;
    ui.$$("[data-tab]", main).forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); }));
    if (tab === "orders") await ordersTab(); else if (tab === "schedule") await scheduleTab(); else await reportsTab();
  }

  async function ordersTab() {
    const all = await api.adminOrders();
    const list = all.filter((o) => filter === "all" || o.status === filter);
    const body = ui.$("#body");
    body.innerHTML = `<div class="row" style="margin-bottom:16px" role="group" aria-label="Filter by status">
        ${["all", ...statuses].map((s) => `<button class="chip chip-btn" data-f="${s}" aria-pressed="${filter === s}">${s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}${s === "all" ? ` (${all.length})` : ` (${all.filter((o) => o.status === s).length})`}</button>`).join("")}
      </div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>What</th><th>Payment</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
      ${list.map((o) => `<tr><td><a href="order.html?id=${o.id}">#${o.id}</a></td><td>${ui.esc(o.customer || "")}</td><td>${ui.esc(ui.fmtShort(o.created_at))}</td>
        <td>${o.capsule_id ? `<span class="chip chip-blue">Capsule</span> ${ui.esc(o.capsule_title || "")}` : `${o.items.length} ${o.items.length === 1 ? "product" : "products"}${o.occasion ? " &middot; " + ui.esc(o.occasion) : ""}`}</td>
        <td>${ui.esc(o.payment.mode)} ${ui.statusChip(o.payment.status)}</td><td class="num">${ui.money(o.total)}</td>
        <td><label class="sr-only" for="s-${o.id}">Status of order ${o.id}</label><select class="input" style="width:auto;padding:4px 8px" id="s-${o.id}" data-status="${o.id}">${statuses.map((s) => `<option ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("") || `<tr><td colspan="7" class="muted">No orders with this status.</td></tr>`}
      </tbody></table></div>`;
    ui.$$("[data-f]", body).forEach((b) => b.addEventListener("click", () => { filter = b.dataset.f; render(); }));
    ui.$$("[data-status]", body).forEach((s) => s.addEventListener("change", async () => { if (await ui.run(() => api.adminSetOrderStatus(s.dataset.status, s.value))) { ui.toast(`Order #${s.dataset.status} is now ${s.value}.`); } }));
  }

  async function scheduleTab() {
    const caps = await api.adminCapsules();
    ui.$("#body").innerHTML = `<p class="muted" style="margin-top:0;max-width:46em">The daily job opens each stage on its date, dispatches its delivery and emails the recipient. Use the demo clock in the footer to see it run.</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>Capsule</th><th>Owner</th><th>For</th><th>Status</th><th>Stages</th><th class="num">Total</th></tr></thead><tbody>
      ${caps.map((c) => `<tr><td><strong>${ui.esc(c.title)}</strong> ${c.type === "group" ? `<span class="chip chip-gold">Group</span>` : ""}</td><td>${ui.esc(c.owner)}</td><td>${ui.esc(c.recipient)}</td><td>${ui.statusChip(c.status)}</td>
        <td>${c.stages.map((s) => `<div class="small">${s.stage_no}. ${ui.esc(ui.fmtShort(s.unlock_date))} ${ui.statusChip(s.status)}</div>`).join("")}</td><td class="num">${ui.money(c.total)}</td></tr>`).join("")}
      </tbody></table></div>`;
  }

  async function reportsTab() {
    const s = await api.adminStats();
    const body = ui.$("#body");
    const maxDay = Math.max(1, ...s.days.map((d) => d.revenue));
    const maxOcc = Math.max(1, ...s.byOccasion.map((r) => r.revenue));
    const maxU = Math.max(1, ...s.top.map((t) => t.units));
    const W = 640, H = 200, pad = 28, bw = (W - pad) / s.days.length;
    body.innerHTML = `<div class="stack">
      <div class="panel"><h3>Revenue, last 14 days</h3>
        <svg viewBox="0 0 ${W} ${H + 26}" width="100%" role="img" aria-label="Bar chart of daily revenue for the last 14 days. Highest day ${ui.money(maxDay)}.">
          <line x1="${pad}" y1="${H}" x2="${W}" y2="${H}" stroke="#101a3b" stroke-width="1.5"/>
          <text x="0" y="12" font-size="11" fill="#69708f">${ui.money(maxDay)}</text><text x="0" y="${H}" font-size="11" fill="#69708f">0</text>
          ${s.days.map((d, i) => { const h = Math.round((d.revenue / maxDay) * (H - 20)); const x = pad + i * bw + 4; return `<g><rect x="${x}" y="${H - h}" width="${bw - 8}" height="${h}" rx="3" fill="#2b4be0"><title>${ui.fmtShort(d.day)}: ${ui.money(d.revenue)}, ${d.orders} orders</title></rect>${i % 2 === 0 ? `<text x="${x + (bw - 8) / 2}" y="${H + 16}" font-size="10" text-anchor="middle" fill="#69708f">${ui.fmtShort(d.day)}</text>` : ""}</g>`; }).join("")}
        </svg></div>
      <div class="split" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px">
        <div class="panel"><h3>Sales by occasion</h3><div class="bars">${s.byOccasion.map((r) => `<div class="bar-row"><span>${ui.esc(r.name)}</span><span class="track"><i style="width:${Math.round((r.revenue / maxOcc) * 100)}%"></i></span><span class="num">${ui.money(r.revenue)}</span></div>`).join("")}</div></div>
        <div class="panel"><h3>Best-selling products</h3><div class="bars">${s.top.map((t) => `<div class="bar-row"><span>${t.product.emoji} ${ui.esc(t.product.name)}</span><span class="track"><i style="width:${Math.round((t.units / maxU) * 100)}%;background:var(--red)"></i></span><span class="num">${t.units} sold</span></div>`).join("")}</div></div>
      </div></div>`;
  }
  await render();
});
