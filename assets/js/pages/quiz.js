TC.start({ page: "quiz", title: "Gift quiz" }, async (main) => {
  const ui = TC.ui;
  const quiz = await TC.api.quiz();
  let step = 0;
  const picked = {}; // question id -> option id
  try { Object.assign(picked, JSON.parse(sessionStorage.getItem("tc_quiz_picks") || "{}")); } catch (e) { /* ignore */ }

  function render() {
    const q = quiz[step];
    const pct = Math.round((step / quiz.length) * 100);
    main.innerHTML = `<div class="container" style="max-width:760px">
      <div class="crumbs"><a href="index.html">Home</a> / Gift quiz</div>
      <div class="quiz-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${quiz.length}" aria-valuenow="${step}" aria-label="Quiz progress"><i style="width:${pct}%"></i></div>
      <p class="small muted" style="margin:12px 0 4px">Question ${step + 1} of ${quiz.length}</p>
      <h1 style="font-size:clamp(1.8rem,4vw,2.8rem);margin-bottom:24px">${ui.esc(q.question)}</h1>
      <div class="opt-grid" role="group" aria-label="${ui.esc(q.question)}">
        ${q.options.map((o) => `<button class="opt" data-id="${o.id}" aria-pressed="${picked[q.id] === o.id}">${ui.esc(o.text)}</button>`).join("")}
      </div>
      <div class="row-between" style="margin-top:28px">
        <button class="btn btn-ghost" id="back" ${step === 0 ? "disabled" : ""}>Back</button>
        <button class="btn btn-lg" id="next" ${picked[q.id] ? "" : "disabled"}>${step === quiz.length - 1 ? "Show my gifts" : "Next"}</button>
      </div>
    </div>`;
    ui.$$(".opt", main).forEach((b) => b.addEventListener("click", () => {
      picked[q.id] = Number(b.dataset.id);
      sessionStorage.setItem("tc_quiz_picks", JSON.stringify(picked));
      ui.$$(".opt", main).forEach((x) => x.setAttribute("aria-pressed", x === b));
      ui.$("#next").disabled = false;
    }));
    ui.$("#back").addEventListener("click", () => { step--; render(); });
    ui.$("#next").addEventListener("click", () => {
      if (step < quiz.length - 1) { step++; render(); return; }
      const answers = { tags: [], occasion_id: null, budget: 0, labels: [] };
      quiz.forEach((qq) => {
        const o = qq.options.find((x) => x.id === picked[qq.id]);
        if (!o) return;
        if (o.tag) answers.tags.push(o.tag);
        if (o.occasion_id) answers.occasion_id = o.occasion_id;
        if (o.budget) answers.budget = o.budget;
      });
      sessionStorage.setItem("tc_quiz", JSON.stringify(answers));
      location.href = "results.html";
    });
    const first = ui.$(".opt", main); if (first && !picked[q.id]) first.focus({ preventScroll: true });
  }
  render();
});
