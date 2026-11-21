TC.start({ page: "login", title: "Log in" }, async (main, user) => {
  const ui = TC.ui;
  const api = TC.api;
  const next = ui.param("next");
  const safeNext = next && /^[a-z0-9_-]+\.html(\?[^#]*)?$/i.test(next) ? next : "";
  const land = (u) => { location.href = safeNext || (u.role === "admin" ? "admin.html" : "index.html"); };
  if (user) { land(user); return; }
  let mode = "login";

  function render() {
    main.innerHTML = `<div class="container" style="max-width:980px">
      <div class="crumbs"><a href="index.html">Home</a> / ${mode === "login" ? "Log in" : "Create account"}</div>
      <div class="split" style="grid-template-columns:minmax(0,1fr) minmax(0,.8fr);gap:40px;margin-top:10px">
        <div class="panel">
          <div class="tabs" role="tablist" aria-label="Account">
            <button role="tab" aria-selected="${mode === "login"}" data-mode="login">Log in</button>
            <button role="tab" aria-selected="${mode === "register"}" data-mode="register">Create account</button>
          </div>
          <form id="f" novalidate style="margin-top:22px">
            ${mode === "register" ? `<div class="field"><label for="name">Full name</label><input class="input" id="name" autocomplete="name"></div>` : ""}
            <div class="field"><label for="email">Email</label><input class="input" id="email" type="email" autocomplete="email" required></div>
            <div class="field"><label for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required>
              ${mode === "register" ? `<span class="hint">At least 6 characters.</span>` : ""}</div>
            <p class="error-text" id="err" role="alert"></p>
            <button class="btn btn-lg btn-block" type="submit">${mode === "login" ? "Log in" : "Create account"}</button>
          </form>
        </div>
        <div class="stack">
          <h1 style="font-size:2.2rem">${mode === "login" ? "Welcome back" : "Start your first capsule"}</h1>
          <p class="lead">${mode === "login" ? "Your capsules, recipients and memory timeline are waiting." : "An account lets you save people, build capsules and get a reminder every year."}</p>
          <div class="panel-soft">
            <h3 style="font-size:1.05rem">Demo accounts</h3>
            <p class="small muted">For the practical demo. Click to fill the form.</p>
            <div class="row">
              <button class="btn btn-ink btn-sm" data-demo="user">Customer</button>
              <button class="btn btn-ink btn-sm" data-demo="admin">Admin</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    ui.$$("[data-mode]").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.mode; render(); }));
    ui.$$("[data-demo]").forEach((b) => b.addEventListener("click", () => {
      mode = "login"; render();
      ui.$("#email").value = b.dataset.demo === "admin" ? "admin@timecapsule.in" : "demo@timecapsule.in";
      ui.$("#pw").value = b.dataset.demo === "admin" ? "admin123" : "demo123";
      ui.$("#pw").focus();
    }));
    ui.$("#f").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = ui.$("#err"); err.textContent = "";
      try {
        const u = mode === "login"
          ? await api.login(ui.$("#email").value, ui.$("#pw").value)
          : await api.register({ name: ui.$("#name").value, email: ui.$("#email").value, password: ui.$("#pw").value });
        ui.flash(mode === "login" ? `Welcome back, ${u.name.split(" ")[0]}.` : "Account created.");
        land(u);
      } catch (ex) { err.textContent = ex.message; }
    });
  }
  render();
});
