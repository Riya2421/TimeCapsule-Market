TC.start({ page: "cart", title: "Checkout", auth: "user" }, async (main, user) => {
  const ui = TC.ui;
  const api = TC.api;
  const cart = await api.cart();
  if (!cart.lines.length) { location.replace("cart.html"); return; }
  const capsules = cart.lines.filter((l) => l.type === "capsule");
  const loose = cart.lines.filter((l) => l.type === "product");
  const hasCapsule = capsules.length > 0;

  const methods = [
    { id: "upi", label: "UPI", hint: "Pay with any UPI app. Simulated in test mode." },
    { id: "card", label: "Credit or debit card", hint: "Use the test card 4242 4242 4242 4242." },
    { id: "netbanking", label: "Net banking", hint: "Choose a bank on the next screen. Simulated." },
    { id: "cod", label: "Cash on delivery", hint: hasCapsule ? "Not available when a capsule is in the cart." : "Pay when the order arrives.", disabled: hasCapsule },
  ];

  main.innerHTML = `<div class="container">
    <div class="crumbs"><a href="index.html">Home</a> / <a href="cart.html">Cart</a> / Checkout</div>
    <div class="page-head"><h1 style="font-size:clamp(2rem,4.5vw,3.2rem)">Checkout</h1></div>
    <form id="co" novalidate>
      <div class="split">
        <div class="stack">
          <div class="panel">
            <h3>Contact</h3>
            <div class="form-grid">
              <div class="field"><label for="name">Full name</label><input class="input" id="name" value="${ui.esc(user.name)}" required autocomplete="name"></div>
              <div class="field"><label for="phone">Phone</label><input class="input" id="phone" type="tel" inputmode="numeric" placeholder="10-digit mobile number" autocomplete="tel"></div>
            </div>
          </div>

          ${loose.length ? `<div class="panel"><h3>Delivery address for products</h3>
            <div class="field" style="margin:0"><label for="addr">Address</label><textarea class="input" id="addr" placeholder="House number, street, area, city, PIN code" autocomplete="street-address"></textarea><span class="error-text" id="addr-err" role="alert"></span></div></div>` : ""}

          ${hasCapsule ? `<div class="panel"><h3>Capsule deliveries</h3>
            <p class="small muted">Each stage is delivered to the recipient on its opening date.</p>
            ${capsules.map((l) => `<div class="stack" style="margin-bottom:12px"><strong>${ui.esc(l.capsule.title)}</strong>
              <div class="small">To ${ui.esc(l.capsule.recipient.name)}, ${ui.esc(l.capsule.recipient.address)}</div>
              ${l.capsule.stages.map((s) => `<div class="small muted">Stage ${s.stage_no}: ${ui.esc(ui.fmtDate(s.unlock_date))}</div>`).join("")}</div>`).join("")}</div>` : ""}

          <div class="panel">
            <h3>Payment</h3>
            <div class="stack" role="radiogroup" aria-label="Payment method">
              ${methods.map((m, i) => `<label class="line-item" style="grid-template-columns:24px 1fr;cursor:${m.disabled ? "not-allowed" : "pointer"};opacity:${m.disabled ? ".5" : 1}">
                <input type="radio" name="mode" value="${m.id}" ${m.disabled ? "disabled" : ""} ${i === 0 ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--blue)">
                <span><strong>${m.label}</strong><br><span class="small muted">${m.hint}</span></span></label>`).join("")}
            </div>
            <div class="field" id="cardbox" style="margin:16px 0 0" hidden><label for="card">Card number</label><input class="input" id="card" inputmode="numeric" placeholder="4242 4242 4242 4242" autocomplete="cc-number"></div>
            <p class="small muted" style="margin:14px 0 0">Test mode: no money moves and no real card is charged.</p>
          </div>
        </div>

        <aside class="panel sticky" aria-label="Order summary">
          <h3>Your order</h3>
          <div class="stack small">
            ${cart.lines.map((l) => `<div class="row-between"><span>${l.type === "capsule" ? "Capsule: " + ui.esc(l.capsule.title) : ui.esc(l.product.name) + " &times; " + l.qty}</span><span>${ui.money(l.amount)}</span></div>`).join("")}
          </div>
          <div class="sum-row total" style="margin-top:14px"><span>Total</span><span>${ui.money(cart.subtotal)}</span></div>
          <p class="error-text" id="err" role="alert" style="margin:12px 0 0"></p>
          <button class="btn btn-lg btn-block" id="pay" type="submit" style="margin-top:14px">Pay ${ui.money(cart.subtotal)}</button>
        </aside>
      </div>
    </form>
  </div>`;

  const radios = ui.$$("input[name=mode]", main);
  const toggleCard = () => { ui.$("#cardbox").hidden = ui.$("input[name=mode]:checked").value !== "card"; };
  radios.forEach((r) => r.addEventListener("change", toggleCard));

  ui.$("#co").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = ui.$("#err"); err.textContent = "";
    const btn = ui.$("#pay"); btn.disabled = true; btn.textContent = "Processing payment…";
    try {
      const res = await api.placeOrder({
        name: ui.$("#name").value, phone: ui.$("#phone").value,
        address: ui.$("#addr") ? ui.$("#addr").value : "",
        mode: ui.$("input[name=mode]:checked").value, cardNumber: ui.$("#card").value,
      });
      ui.flash(res.length > 1 ? `Payment received. ${res.length} orders placed.` : "Payment received. Your order is placed.");
      location.href = "order.html?id=" + res[0].id;
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false; btn.textContent = "Pay " + ui.money(cart.subtotal);
      err.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
});
