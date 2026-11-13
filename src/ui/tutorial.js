// 첫 사용 튜토리얼(v0.18.0): 리아 카드 4장 + 마지막에 진짜 코드 한 줄 실행. 설계 docs/specs/2026-11-13-첫-사용-튜토리얼-설계.md §3-2.
// 코드 편집기 묶음은 쓰지 않는다(입력칸은 plain <input>). 입력은 tutorialCode가 안전한 문자열 리터럴로 만들고, 결과는 textContent로만 그린다.
import { riaSVG } from "../ria.js";
import { esc } from "./dom.js";
import { t } from "../i18n.js";
import { tutorialCode, TUTORIAL_MAX } from "../tutorial.js";

const CARDS = [
  () => t`반가워요! 하루 10분, 첫 코드부터 같이 해요.`,
  () => t`레슨은 설명 카드를 읽고, 고르기·빈칸을 풀고, 마지막에 직접 코드를 써요. 틀려도 괜찮아요. 힌트가 있어요.`,
  () => t`문제를 풀면 XP와 바이트가 쌓여요. 바이트로 제 옷을 고를 수 있고, 1장을 끝내면 「파이의 텃밭」과 경비실이 열려요.`,
  () => t`이제 진짜 코드를 실행해 볼까요? 따옴표 안의 글자를 바꿔도 돼요.`,
];
const LAST = CARDS.length - 1;

export function render(root, ctx, params = {}) {
  const replay = !!(params && params.replay);
  let step = 0;
  let phase = "idle"; // idle | running | ok | err
  let value = t`안녕하세요!`;
  let alive = true;
  let ended = false;

  const face = () => (phase === "ok" ? "joy" : step === LAST ? "wink" : "smile");

  function end(kind, then) {
    if (ended) return;
    ended = true;
    if (!replay) ctx.commit({ ...ctx.save, tutorial: kind });
    if (then === "lesson") ctx.show("lesson", { id: "1-1" });
    else ctx.show("home");
  }

  function paintLast(card) {
    const status = ctx.pyState().status;
    const failed = status === "error" && phase !== "ok";
    const waiting = status !== "ready" && !failed && phase !== "ok";
    card.querySelector(".tut-code").hidden = failed;
    card.querySelector(".tut-load").hidden = !waiting;
    card.querySelector(".tut-fail").hidden = !failed;
    card.querySelector("#tut-run").hidden = failed || waiting;
    card.querySelector("#tut-run").disabled = phase === "running" || status !== "ready";
    card.querySelector(".tut-after").hidden = !(phase === "ok" || failed || waiting); // 엔진을 기다리는 동안에도 「홈으로」(설계 §3-2)
    const les = card.querySelector("#tut-lesson");
    if (les) les.hidden = phase !== "ok";
    card.querySelector("#tut-ok").hidden = phase !== "ok";
    const bar = card.querySelector(".load-bar");
    if (bar) bar.dataset.state = status;
  }

  async function run(card) {
    if (phase === "running") return;
    phase = "running";
    paintLast(card);
    const out = card.querySelector("#tut-out");
    let ok = false;
    let text = "";
    try {
      const r = await ctx.py.run(tutorialCode(card.querySelector("#tut-input").value));
      ok = !!r && !r.error && !r.timeout;
      text = ok ? String(r.stdout || "").replace(/\r?\n$/, "") : "";
    } catch { ok = false; }
    if (!alive) return;
    out.hidden = false;
    out.textContent = ok ? text : t`다시 실행해 볼까요?`;
    phase = ok ? "ok" : "err";
    const bubble = root.querySelector(".tut-ria");
    if (bubble) bubble.innerHTML = riaSVG({ outfit: ctx.save.outfit, face: face(), size: 96 });
    paintLast(card);
  }

  function draw() {
    const last = step === LAST;
    root.innerHTML = `<main class="screen tutorial">
      <header class="tut-top">
        <div class="tut-dots" role="img" aria-label="${esc(t`${CARDS.length}장 중 ${step + 1}장`)}">${CARDS.map((_, i) => `<span class="${i === step ? "on" : ""}"></span>`).join("")}</div>
        <button class="btn ghost small" id="tut-skip">${t`건너뛰기`}</button>
      </header>
      <section class="tut-card">
        <div class="tut-ria ria-wrap">${riaSVG({ outfit: ctx.save.outfit, face: face(), size: 96 })}</div>
        <p class="bubble center" data-autofocus tabindex="-1">${esc(CARDS[step]())}</p>
        ${last ? `<div class="tut-code"><code class="code tut-line"><span>print("</span><input id="tut-input" type="text" maxlength="${TUTORIAL_MAX}" value="${esc(value)}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${esc(t`따옴표 안의 글자`)}"><span>")</span></code></div>
        <div class="tut-load" aria-live="polite"><div class="load-bar" data-state="loading"><span></span></div><p class="load-text">${t`파이썬 준비 중…`}</p></div>
        <p class="tut-fail bubble center" id="tut-fail" role="status" hidden>${t`지금은 파이썬을 받지 못했어요. 1-1에서 바로 해 볼 수 있어요`}</p>
        <button class="btn primary wide" id="tut-run" hidden>${t`▶ 실행`}</button>
        <pre class="out tut-out" id="tut-out" aria-live="polite" hidden></pre>
        <p class="tut-success" id="tut-ok" role="status" hidden>${t`첫 코드 성공! 🎉`}</p>
        <div class="tut-after" hidden>
          ${replay ? "" : `<button class="btn primary wide" id="tut-lesson" hidden>${t`1-1 시작하기`}</button>`}
          <button class="btn ghost wide" id="tut-home">${t`홈으로`}</button>
        </div>` : ""}
      </section>
      ${last ? "" : `<footer class="tut-foot"><button class="btn primary wide" id="tut-next">${t`다음`}</button></footer>`}
    </main>`;
    const card = root.querySelector(".tut-card");
    root.querySelector("#tut-skip").addEventListener("click", () => end("skipped", "home"));
    if (last) {
      const input = card.querySelector("#tut-input");
      input.addEventListener("input", () => { value = input.value; });
      card.querySelector("#tut-run").addEventListener("click", () => run(card));
      card.querySelector("#tut-home").addEventListener("click", () => end("done", "home"));
      const les = card.querySelector("#tut-lesson");
      if (les) les.addEventListener("click", () => end("done", "lesson"));
      paintLast(card);
    } else {
      root.querySelector("#tut-next").addEventListener("click", () => { step++; phase = "idle"; draw(); });
    }
    const b = root.querySelector("[data-autofocus]");
    if (b) b.focus({ preventScroll: true });
  }

  draw();
  const off = ctx.onPy(() => {
    const card = root.querySelector(".tut-card");
    if (alive && step === LAST && card) paintLast(card);
  });
  return () => { alive = false; off(); };
}
