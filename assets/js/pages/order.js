TC.start({ page: "capsules", title: "Order", auth: "user" }, async (main) => {
  const ui = TC.ui;
  const api = TC.api;
  const o = await api.order(ui.param("id"));
  document.title = `Order #${o.id} | TimeCapsule Market`;
  const flow = ["placed", "packed", "shipped", "delivered"];
  const at = o.status === "cancelled" ? -1 : flow.indexOf(o.status);
  const modeName = { upi: "UPI", card: "Card", netbanking: "Net banking", cod: "Cash on delivery", group: "Group contributions" }[o.payment.mode] || o.payment.mode;

  main.innerHTML = `<div class="container">
    <div class="crumbs"><a href="index.html">Home</a> / <a href="capsules.html">My capsules</a> / Order #${o.id}</div>
    <div class="page-head row-between">
      <div><h1 style="font-size:clamp(2rem,4.5vw,3.2rem);margin-bottom:6px">Order #${o.id}</h1>
        <p class="muted">Placed ${ui.esc(ui.fmtDate(o.created_at))}</p></div>
      ${ui.statusChip(o.status)}
    </div>

    <div class="panel" style="margin-bottom:22px">
      <h3>Status</h3>
      <div class="stage-dots" role="list" aria-label="Order progress">
        ${flow.map((f, i) => `<span class="dot ${i <= at ? "on" : ""}" role="listitem">${i <= at ? "&#10003; " : ""}${f[0].toUpperCase() + f.slice(1)}</span>`).join("")}
      </div>
      ${o.siblings.length ? `<p class="small muted" style="margin:14px 0 0">This payment also covered ${o.siblings.map((s) => `<a href="order.html?id=${s}">order #${s}</a>`).join(", ")}.</p>` : ""}
    </div>

    <div class="split">
      <div class="stack">
        ${o.capsule ? `
          <div class="panel">
            <div class="row-between"><h3 style="margin:0">${ui.esc(o.capsule.title)}</h3><a class="btn btn-ink btn-sm" href="capsules.html">Open in My capsules</a></div>
            <p class="small muted">For ${ui.esc(o.capsule.recipient.name)}. Each stage is delivered on its opening date.</p>
            <div class="stack">
              ${o.deliveries.map((d) => `<div class="line-item" style="grid-template-columns:1fr auto;align-items:start">
                <div><strong>Stage ${d.stage.stage_no}</strong> opens ${ui.esc(ui.fmtDate(d.scheduled_date))} <span class="small muted">(${ui.whenText(ui.daysTo(d.scheduled_date))})</span>
                  <div class="small" style="margin-top:4px">${d.stage.items.map((i) => `<span aria-hidden="true">${i.product.emoji}</span> ${ui.esc(i.product.name)}${i.qty > 1 ? " &times; " + i.qty : ""}`).join(", ")}</div>
                  ${d.stage.message ? `<div class="small muted" style="margin-top:4px">Card: &ldquo;${ui.esc(d.stage.message)}&rdquo;</div>` : ""}</div>
                ${ui.statusChip(d.status)}</div>`).join("")}
            </div>
          </div>` : `
          <div class="panel"><h3>Items</h3>
            ${o.items.map((i) => `<div class="pick-row"><span class="em" aria-hidden="true">${i.product.emoji}</span><span>${ui.esc(i.product.name)} &times; ${i.qty}</span><span class="price">${ui.money(i.price * i.qty)}</span></div>`).join("")}
          </div>`}
      </div>
      <aside class="stack">
        <div class="panel">
          <h3>Payment</h3>
          <div class="sum-row"><span>Method</span><span>${ui.esc(modeName)}</span></div>
          <div class="sum-row"><span>Status</span><span>${ui.statusChip(o.payment.status)}</span></div>
          <div class="sum-row"><span>Reference</span><span class="small">${ui.esc(o.payment.txn_ref)}</span></div>
          <div class="sum-row total"><span>Total</span><span>${ui.money(o.total)}</span></div>
        </div>
        ${o.address ? `<div class="panel-soft"><h3 style="font-size:1.05rem">Delivery address</h3><p class="small" style="margin:0">${ui.esc(o.address)}</p></div>` : ""}
        ${o.capsule && o.capsule.type === "group" ? `<a class="btn btn-ink btn-block" href="group.html?id=${o.capsule.id}">See the group page</a>` : ""}
      </aside>
    </div>
  </div>`;
});
