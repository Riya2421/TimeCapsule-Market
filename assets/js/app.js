/* ==========================================================================
   TC.ui: shared layout and helpers. Every page calls TC.start(...).
   ========================================================================== */
window.TC = window.TC || {};

TC.ui = (function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (s) => (s ? parse(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
  const fmtShort = (s) => (s ? parse(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
  const param = (k) => new URLSearchParams(location.search).get(k);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

  const pad2 = (n) => String(n).padStart(2, "0");
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const daysTo = (s) => Math.round((parse(s) - parse(TC.api.today())) / 86400000);
  function whenText(days) {
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days === -1) return "yesterday";
    if (days > 0) return days < 60 ? `in ${days} days` : days < 700 ? `in ${Math.round(days / 30)} months` : `in ${(days / 365).toFixed(1)} years`;
    return Math.abs(days) < 60 ? `${Math.abs(days)} days ago` : `${Math.round(Math.abs(days) / 30)} months ago`;
  }

  /* ---------- toast + flash ---------- */
  function toast(msg, ms) {
    let wrap = $(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; wrap.setAttribute("role", "status"); document.body.appendChild(wrap); }
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), ms || 3200);
  }
  function flash(msg) { try { const a = JSON.parse(sessionStorage.getItem("tc_flash") || "[]"); a.push(msg); sessionStorage.setItem("tc_flash", JSON.stringify(a)); } catch (e) { /* ignore */ } }
  function showFlash() {
    try {
      const a = JSON.parse(sessionStorage.getItem("tc_flash") || "[]");
      sessionStorage.removeItem("tc_flash");
      a.forEach((m, i) => setTimeout(() => toast(m, 4200), i * 400));
    } catch (e) { /* ignore */ }
  }
  /* run an action; show the error as a toast instead of crashing */
  async function run(fn, onError) {
    try { return await fn(); } catch (e) { if (onError) onError(e); else toast(e.message || "Something went wrong."); return undefined; }
  }

  /* ---------- svg bits ---------- */
  const logo = `<svg viewBox="0 0 34 34" aria-hidden="true"><rect x="1.5" y="1.5" width="31" height="31" rx="7" fill="#2b4be0" stroke="#101a3b" stroke-width="2"/><circle cx="17" cy="17" r="9" fill="#fff" stroke="#101a3b" stroke-width="2"/><path d="M17 11.5V17l3.6 2.2" fill="none" stroke="#e63946" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  function postmark(date) {
    const d = date ? parse(date) : new Date();
    const mon = d.toLocaleDateString("en-IN", { month: "short" }).replace(".", "").toUpperCase();
    return `<svg class="postmark" viewBox="0 0 86 56" aria-hidden="true"><circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="28" cy="28" r="17" fill="none" stroke="currentColor" stroke-width="1"/><text x="28" y="26" text-anchor="middle" font-size="9">${mon}</text><text x="28" y="38" text-anchor="middle" font-size="12">${d.getDate()}</text><path d="M54 17h30M54 28h30M54 39h30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  }

  /* ---------- components ---------- */
  function stampCard(o, href) {
    return `<a class="stamp" href="${href || "occasions.html?o=" + o.slug}" style="--st:${o.color};--st-ink:${o.ink}">
      <span class="stamp-art" aria-hidden="true">${o.emoji}</span>
      <span class="stamp-name">${esc(o.name)}</span>
      <span class="stamp-sub">${esc(o.tagline)}</span>
    </a>`;
  }
  function productTile(p, o) {
    o = o || {};
    return `<a class="ptile" href="product.html?id=${p.id}">
      <span class="ptile-art" style="--tint:${p.tint}" aria-hidden="true">${p.emoji}${o.badge ? `<span class="match chip chip-gold">${esc(o.badge)}</span>` : ""}</span>
      <span class="meta"><h3>${esc(p.name)}</h3><span class="price">${money(p.price)}</span></span>
      ${o.sub ? `<span class="small muted">${o.sub}</span>` : ""}
    </a>`;
  }
  function collectionCard(c, saved) {
    const o = c.occasion || {};
    const emojis = (c.products || []).slice(0, 4).map((p) => p.emoji).join(" ");
    const from = (c.products || []).length ? Math.min.apply(null, c.products.map((p) => p.price)) : 0;
    return `<a class="ccard" href="collection.html?id=${c.id}" style="--st:${o.color || "#2b4be0"};--st-ink:${o.ink || "#fff"}">
      <span class="ccard-art" aria-hidden="true">${emojis}</span>
      <span class="ccard-body">
        <span class="chip chip-blue">${esc(o.name || "")}${saved ? " &middot; saved" : ""}</span>
        <h3>${esc(c.title)}</h3>
        <span class="small muted">${esc(c.blurb || "")}</span>
        <span class="row-between small" style="margin-top:auto"><span>${(c.products || []).length} items from ${money(from)}</span><span class="price">${money(c.total)}</span></span>
      </span>
    </a>`;
  }
  function envelope(o) {
    const locked = !!o.locked;
    const items = (o.items || []).map((i) => `<li><span aria-hidden="true">${i.emoji}</span> ${esc(i.name)}${i.qty > 1 ? ` &times; ${i.qty}` : ""}</li>`).join("");
    const letter = locked
      ? `<h4>Sealed until ${esc(fmtDate(o.date))}</h4><p class="note">${o.days != null ? esc(`That is ${whenText(o.days)}. `) : ""}The surprise inside stays hidden until then.</p>`
      : `<h4>${esc(o.what || "")}</h4>${items ? `<ul>${items}</ul>` : ""}${o.note ? `<p class="note">&ldquo;${esc(o.note)}&rdquo;</p>` : ""}`;
    return `<div class="env${locked ? " locked" : ""}${o.open ? " open" : ""}" role="button" tabindex="0" aria-expanded="${o.open ? "true" : "false"}" aria-label="${esc((o.what || "Capsule stage") + ". " + (locked ? "Sealed" : "Press to open"))}">
      <div class="env-body">
        <div class="env-face">${postmark(o.date)}<span class="to">${esc(o.to || "")}</span><span class="what">${esc(o.what || "")}</span></div>
        <div class="env-letter">${letter}</div>
      </div>
      <div class="env-flap"><svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,0 100,0 50,60" fill="#dfe5fa" stroke="#101a3b" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg></div>
    </div>`;
  }
  function bindEnvelopes(root) {
    $$(".env", root).forEach((e) => {
      const toggle = () => { e.classList.toggle("open"); e.setAttribute("aria-expanded", e.classList.contains("open") ? "true" : "false"); };
      e.addEventListener("click", toggle);
      e.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
    });
  }
  function empty(icon, title, text, actionHtml) {
    return `<div class="empty"><div class="big" aria-hidden="true">${icon}</div><h3>${esc(title)}</h3><p class="muted">${esc(text)}</p>${actionHtml || ""}</div>`;
  }
  function statusChip(status) {
    const map = { draft: ["chip", "Draft"], funding: ["chip-gold", "Collecting money"], confirmed: ["chip-blue", "Paid, waiting for first stage"], active: ["chip-ok", "In progress"], completed: ["chip-ok", "Completed"], cancelled: ["chip-red", "Cancelled"], placed: ["chip-blue", "Placed"], packed: ["chip-gold", "Packed"], shipped: ["chip-blue", "Shipped"], delivered: ["chip-ok", "Delivered"], pending: ["chip", "Pending"], dispatched: ["chip-blue", "Dispatched"], locked: ["chip", "Sealed"], unlocked: ["chip-ok", "Opened"] };
    const m = map[status] || ["chip", status];
    return `<span class="chip ${m[0]}">${esc(m[1])}</span>`;
  }

  /* ---------- page chrome ---------- */
  const NAV = [
    { key: "occasions", href: "occasions.html", label: "Occasions" },
    { key: "quiz", href: "quiz.html", label: "Gift quiz" },
    { key: "capsules", href: "capsules.html", label: "My capsules" },
    { key: "timeline", href: "timeline.html", label: "Memory timeline" },
  ];
  const ADMIN_NAV = [
    { key: "admin", href: "admin.html", label: "Dashboard" },
    { key: "admin-products", href: "admin-products.html", label: "Products" },
    { key: "admin-collections", href: "admin-collections.html", label: "Collections and quiz" },
    { key: "admin-orders", href: "admin-orders.html", label: "Orders and reports" },
  ];

  function header(page, user, admin) {
    const nav = (admin ? ADMIN_NAV : NAV).map((n) => `<a href="${n.href}"${n.key === page ? ' aria-current="page"' : ""}>${n.label}</a>`).join("");
    const cartCount = TC.api.cartCount();
    const right = admin
      ? `<span class="admin-badge">Admin</span><a class="btn btn-ink btn-sm" href="index.html">View store</a><button class="btn btn-ghost btn-sm" data-logout>Log out</button>`
      : `${user && user.role === "admin" ? `<a class="btn btn-ink btn-sm" href="admin.html">Admin</a>` : ""}
         <a class="cart-link" href="cart.html" aria-label="Cart, ${cartCount} items">Cart <span class="badge" data-zero="${cartCount === 0}">${cartCount}</span></a>
         ${user ? `<button class="btn btn-ghost btn-sm" data-logout>Log out</button>` : `<a class="btn btn-ink btn-sm" href="login.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}">Log in</a>`}`;
    return `<div class="airmail" aria-hidden="true"></div>
      <header class="site-header"><div class="container bar">
        <a class="brand" href="${admin ? "admin.html" : "index.html"}">${logo}<span>TimeCapsule <b>Market</b></span></a>
        <button class="nav-toggle" aria-expanded="false" aria-controls="nav">Menu</button>
        <nav class="nav" id="nav" aria-label="Main">${nav}</nav>
        <div class="bar-right">${right}</div>
      </div></header>`;
  }

  function footer() {
    const off = TC.api.clockOffset();
    return `<footer class="site-footer"><div class="container">
      <div class="cols">
        <div><h4>TimeCapsule Market</h4><p>Gifts that unfold over time. Shop by occasion, split a gift into stages, and let friends chip in through one link.</p></div>
        <div><h4>Shop</h4><ul><li><a href="occasions.html">All occasions</a></li><li><a href="quiz.html">Gift quiz</a></li><li><a href="builder.html">Build a capsule</a></li></ul></div>
        <div><h4>Your account</h4><ul><li><a href="capsules.html">My capsules</a></li><li><a href="recipients.html">Saved recipients</a></li><li><a href="saved.html">Saved collections</a></li><li><a href="mailbox.html">Demo mailbox</a></li></ul></div>
      </div>
      <div class="demo-clock" role="group" aria-label="Demo controls">
        <span><strong>Demo clock:</strong> today is ${esc(fmtDate(TC.api.today()))}${off ? ` (+${off} days)` : ""}</span>
        <button class="btn btn-sm btn-ink" data-clock="1">+1 day</button>
        <button class="btn btn-sm btn-ink" data-clock="7">+7 days</button>
        <button class="btn btn-sm btn-ink" data-clock="30">+30 days</button>
        <button class="btn btn-sm btn-ink" data-clock="reset">Reset clock</button>
        <button class="btn btn-sm btn-ink" data-reset-data>Reset demo data</button>
      </div>
      <p class="small" style="margin:18px 0 0;opacity:.75">College practical prototype. Payments are simulated and no real orders are placed.</p>
    </div></footer>`;
  }

  function bindChrome() {
    const tog = $(".nav-toggle");
    if (tog) tog.addEventListener("click", () => { const n = $("#nav"); n.classList.toggle("open"); tog.setAttribute("aria-expanded", n.classList.contains("open")); });
    $$("[data-logout]").forEach((b) => b.addEventListener("click", async () => { await TC.api.logout(); flash("You are logged out."); location.href = "index.html"; }));
    $$("[data-clock]").forEach((b) => b.addEventListener("click", async () => {
      const v = b.dataset.clock;
      let events = [];
      try { events = v === "reset" ? (await TC.api.resetClock(), []) : await TC.api.advanceDays(Number(v)); } catch (e) { toast(e.message); return; }
      flash(v === "reset" ? "Demo clock reset to today." : `Moved ${v} day${v === "1" ? "" : "s"} ahead.`);
      eventsToFlash(events);
      location.reload();
    }));
    const rd = $("[data-reset-data]");
    if (rd) rd.addEventListener("click", async () => { if (confirm("Reset all demo data? Your changes will be lost.")) { try { await TC.api.resetDemo(); } catch (e) { toast(e.message); return; } flash("Demo data reset."); location.href = "index.html"; } });
  }
  function eventsToFlash(events) {
    const unlocks = events.filter((e) => e.type === "unlock").length;
    if (unlocks) flash(`${plural(unlocks, "stage")} opened and emailed. See the demo mailbox.`);
    events.filter((e) => e.type === "completed").forEach((e) => flash(`"${e.title}" is complete. It is on your memory timeline.`));
    events.filter((e) => e.type === "reminder").forEach((e) => flash(`Yearly reminder sent for "${e.title}".`));
    events.filter((e) => e.type === "funding_failed").forEach((e) => flash(`Funding ended for "${e.title}". Contributions are refunded.`));
  }

  return { addDays, daysTo, showFlash, $, $$, esc, money, fmtDate, fmtShort, param, plural, whenText, toast, flash, run, logo, postmark, stampCard, productTile, collectionCard, envelope, bindEnvelopes, empty, statusChip, header, footer, bindChrome, eventsToFlash };
})();

/* ---------- page bootstrap ----------
   TC.start({ page, title, auth: 'user' | 'admin' | null }, async (main, user) => { ... }) */
TC.start = async function (opts, fn) {
  const ui = TC.ui;
  const events = await TC.api.boot();
  const user = await TC.api.me();
  const here = location.pathname.split("/").pop() + location.search;
  if (opts.auth && !user) { location.replace("login.html?next=" + encodeURIComponent(here)); return; }
  if (opts.auth === "admin" && user.role !== "admin") { ui.flash("That page is for store admins only."); location.replace("index.html"); return; }

  document.title = (opts.title ? opts.title + " | " : "") + "TimeCapsule Market";
  const main = document.getElementById("main");
  main.insertAdjacentHTML("beforebegin", ui.header(opts.page, user, opts.auth === "admin"));
  main.insertAdjacentHTML("afterend", ui.footer());
  ui.bindChrome();
  ui.eventsToFlash(events);
  ui.showFlash();

  try {
    await fn(main, user);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="container section">${ui.empty("😕", "This page could not load", e.message || "Something went wrong. Reload the page or reset the demo data from the footer.", `<a class="btn" href="index.html">Back to home</a>`)}</div>`;
  }
};
