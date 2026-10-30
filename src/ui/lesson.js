// 레슨 화면: 개념 카드 → 터치 문제 → (직접 작성) → 재도전 → 이해도 확인 → 완료
// 진행 순서는 lessonflow.js 상태 기계가 정하고, 이 파일은 그리기와 채점만 한다.
import { startFlow, current, nextCard, answer, summary } from "../lessonflow.js";
import { riaSVG } from "../ria.js";
import { esc, icon, bar, codeBlock, dialog } from "./dom.js";
import { mountWrite } from "./write.js";
import { shuffleChoices, shuffleOrder, newSeed } from "../shuffle.js";

const TOUCH = new Set(["choice", "blank", "order", "check"]);
const GUARD_MS = 400;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 복습 묶음: review_queue 개념의 터치 문제 5개 */
function buildReview(ctx) {
  const queue = new Set(ctx.save.review_queue || []);
  const pool = [];
  for (const l of ctx.lessons) {
    for (const it of l.items) {
      if (TOUCH.has(it.type) && queue.has(it.concept)) pool.push({ ...it, type: it.type === "check" ? "choice" : it.type, from: l.id });
    }
  }
  return { id: "review", title: "복습", cards: [], items: shuffle(pool).slice(0, 5) };
}

function stdinNote(stdin) {
  if (stdin == null || stdin === "") return "";
  const vals = String(stdin).split("\n");
  return `<p class="stdin-note">${icon("send")}<span>입력하는 값: ${vals.map((v) => `<code>${esc(v)}</code>`).join(" ")}</span></p>`;
}

const isCodey = (s) => /[()"'=+*<>#]|print/.test(s);

export function render(root, ctx, params = {}) {
  const review = !!params.review;
  const lesson = review ? buildReview(ctx) : ctx.lessonById(params.id);
  if (!lesson || !lesson.items.length) { ctx.show("home"); return; }

  const S = {
    flow: startFlow(lesson), combo: 0, marks: [], logs: [], marked: {},
    write: null, reviewCorrect: 0, itemsSolved: 0, guardUntil: 0, onContinue: null, cleanupItem: null,
  };

  root.innerHTML = `<div class="screen lesson">
    <header class="lesson-top">
      <button class="icon-btn" id="quit" aria-label="레슨 그만하기">${icon("close")}</button>
      <div class="lesson-progress">${bar(0, 100, "lp-bar", "레슨 진행")}</div>
      <span class="lesson-tag">${esc(review ? "복습" : lesson.id)}</span>
    </header>
    <main class="lesson-body" id="body"></main>
    <footer class="lesson-foot" id="foot"></footer>
    <section class="result" id="result" role="status" aria-live="polite" hidden></section>
  </div>`;
  const body = root.querySelector("#body");
  const foot = root.querySelector("#foot");
  const result = root.querySelector("#result");
  const progEl = root.querySelector(".lp-bar");

  function setProgress() {
    const p = Math.round(summary(S.flow).progress * 100);
    progEl.setAttribute("aria-valuenow", String(p));
    progEl.setAttribute("aria-valuemax", "100");
    progEl.setAttribute("aria-valuetext", `${p}%`);
    progEl.firstElementChild.style.width = p + "%";
  }

  function mark(index, concept, outcome) {
    if (!concept) return;
    const key = index + ":" + outcome;
    if (S.marked[key]) return;
    S.marked[key] = true;
    S.marks.push([concept, outcome]);
  }

  // ---- 결과 패널 ----
  function openResult({ ok, flowCorrect, title, text, answerHTML = "", situation, sfx, onContinue }) {
    const line = ctx.say(situation);
    result.className = "result " + (ok ? "ok" : "bad");
    result.innerHTML = `<div class="result-scroll">
      <div class="result-head">
        <span class="result-ic">${icon(ok ? "check" : "cross")}</span>
        <h2>${esc(title)}</h2>
      </div>
      ${answerHTML}
      ${text ? `<p class="result-explain">${esc(text)}</p>` : ""}
      <div class="ria-row small">
        <div class="ria-wrap${ok ? " jump" : ""}">${riaSVG({ outfit: ctx.save.outfit, face: line.face, size: 64 })}<span class="sfx" aria-hidden="true">${esc(sfx)}</span></div>
        <p class="bubble">${esc(line.text)}</p>
      </div>
    </div>
    <button class="btn ${ok ? "primary" : "coral"} wide" id="cont">계속</button>`;
    result.hidden = false;
    document.body.classList.add("result-open");
    S.guardUntil = performance.now() + GUARD_MS;
    S.onContinue = () => {
      result.hidden = true;
      document.body.classList.remove("result-open");
      if (onContinue) onContinue();
      else { S.flow = answer(S.flow, flowCorrect); step(); }
    };
    const btn = result.querySelector("#cont");
    btn.addEventListener("click", () => {
      if (performance.now() < S.guardUntil) return; // 입력 보호
      const f = S.onContinue; S.onContinue = null;
      if (f) f();
    });
    requestAnimationFrame(() => btn.focus({ preventScroll: true }));
  }

  // 터치 문제 채점 결과
  function judged(cur, ok, answerHTML) {
    // 같은 문제를 두 번 채점하지 않음(빠른 두 번 누르기 등)
    if (S.judged) return;
    S.judged = true;
    const actBtn = foot.querySelector("#act");
    if (actBtn) actBtn.disabled = true;
    const it = cur.item;
    if (ok) {
      S.combo++;
      S.itemsSolved++;
      if (review) S.reviewCorrect++;
      if (cur.attempt === 1) mark(cur.index, it.concept, "right");
    } else {
      S.combo = 0;
      mark(cur.index, it.concept, "wrong");
    }
    const combo = ok && S.combo >= 3 && S.combo % 3 === 0;
    ctx.sound.play(ok ? (combo ? "combo" : "correct") : "wrong");
    openResult({
      ok, flowCorrect: ok,
      title: ok ? (combo ? `${S.combo}연속 정답!` : "정답이에요") : "아쉬워요",
      text: it.explain || "",
      answerHTML: ok ? "" : answerHTML,
      situation: ok ? (combo ? "combo" : "correct") : "wrong",
      sfx: ok ? (combo ? "척척!" : "딩동!") : "어라?",
    });
  }

  function footButton(label, { disabled = false, kind = "primary" } = {}) {
    foot.innerHTML = `<button class="btn ${kind} wide" id="act"${disabled ? " disabled" : ""}>${esc(label)}</button>`;
    return foot.querySelector("#act");
  }

  // ---- 카드 ----
  function renderCard(cur) {
    const c = cur.card;
    const first = cur.index === 0;
    body.innerHTML = `<article class="card-view">
      ${first && lesson.goal ? `<p class="goal-line">${icon("book")}<span>오늘의 목표: ${esc(lesson.goal)}</span></p>` : ""}
      <h1 class="lesson-title">${esc(lesson.title)}</h1>
      <div class="ria-row">
        <div class="ria-wrap">${riaSVG({ outfit: ctx.save.outfit, face: first ? "smile" : "think", size: 84 })}</div>
        <p class="bubble">${esc(c.say)}</p>
      </div>
      ${c.code ? `<div class="example"><p class="ex-label">예제</p>${codeBlock(c.code)}${stdinNote(c.stdin)}
        ${c.out != null ? `<p class="ex-label">실행 결과</p><pre class="out">${esc(c.out)}</pre>` : ""}</div>` : ""}
    </article>`;
    const b = footButton(cur.index + 1 < lesson.cards.length ? "다음 카드" : "문제 풀기");
    b.addEventListener("click", () => { S.flow = nextCard(S.flow); step(); });
  }

  // ---- 문제 머리 ----
  function itemHead(cur) {
    const it = cur.item;
    const tag = cur.retry ? `<span class="tag retry">${icon("review")}다시 풀기</span>`
      : it.type === "check" ? `<span class="tag check">이해도 확인</span>`
      : review && it.from ? `<span class="tag">${esc(it.from)} 복습</span>` : "";
    return `${tag}<h1 class="q">${esc(it.q || (it.type === "order" ? "줄을 차례대로 눌러 코드를 완성해 보세요." : "답을 골라 보세요."))}</h1>
      ${it.code && it.type !== "blank" ? codeBlock(it.code) : ""}${stdinNote(it.stdin)}`;
  }

  function renderChoice(cur) {
    const orig = cur.item;
    const sh = shuffleChoices(orig.options, orig.answer, newSeed()); // 이번 풀이 동안 고정 (C26)
    const it = { ...orig, options: sh.options, answer: sh.answer };
    let pick = -1;
    body.innerHTML = `<article class="item">${itemHead(cur)}
      <div class="options" role="radiogroup" aria-label="보기">${it.options.map((o, i) =>
        `<button class="opt${isCodey(o) ? " mono" : ""}" role="radio" aria-checked="false" data-i="${i}"><span class="opt-key" aria-hidden="true">${i + 1}</span><span class="opt-text">${esc(o)}</span></button>`).join("")}</div>
    </article>`;
    const act = footButton("확인", { disabled: true });
    body.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      pick = +b.dataset.i;
      body.querySelectorAll(".opt").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      act.disabled = false;
    }));
    act.addEventListener("click", () => {
      if (pick < 0) return;
      judged(cur, pick === it.answer, `<p class="answer">정답: <span class="${isCodey(it.options[it.answer]) ? "mono" : ""}">${esc(it.options[it.answer])}</span></p>`);
    });
  }

  function renderBlank(cur) {
    const orig = cur.item;
    const sh = shuffleChoices(orig.chips, orig.answer, newSeed());
    const it = { ...orig, chips: sh.options, answer: sh.answer };
    let pick = -1;
    const parts = String(it.code || "___").split("___");
    const codeHTML = () => `<pre class="code blank-code"><code>${parts.map((p, i) => esc(p) + (i < parts.length - 1
      ? `<span class="slot${pick >= 0 ? " filled" : ""}">${pick >= 0 ? esc(it.chips[pick]) : "    "}</span>` : "")).join("")}</code></pre>`;
    body.innerHTML = `<article class="item">${itemHead(cur)}
      <div id="bc">${codeHTML()}</div>
      <div class="chips" role="radiogroup" aria-label="빈칸에 넣을 조각">${it.chips.map((c, i) =>
        `<button class="chip mono" role="radio" aria-checked="false" data-i="${i}">${esc(c)}</button>`).join("")}</div>
    </article>`;
    const act = footButton("확인", { disabled: true });
    body.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
      pick = +b.dataset.i;
      body.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      body.querySelector("#bc").innerHTML = codeHTML();
      act.disabled = false;
    }));
    act.addEventListener("click", () => {
      if (pick < 0) return;
      const filled = parts.join(it.chips[it.answer]);
      judged(cur, pick === it.answer, `<p class="answer">정답</p>${codeBlock(filled)}`);
    });
  }

  function renderOrder(cur) {
    const it = cur.item;
    const order = shuffleOrder(it.lines, newSeed());
    const chosen = [];
    body.innerHTML = `<article class="item">${itemHead(cur)}
      <p class="ex-label">내가 만든 코드 <small>(누르면 빠져요)</small></p>
      <ol class="order-answer" id="oa" aria-label="고른 순서"></ol>
      <p class="ex-label">줄 조각 <small>(누른 순서대로 들어가요)</small></p>
      <div class="order-pool" id="op">${order.map((li) =>
        `<button class="line mono" data-li="${li}">${esc(it.lines[li])}</button>`).join("")}</div>
    </article>`;
    const act = footButton("확인", { disabled: true });
    const oa = body.querySelector("#oa");
    const paint = () => {
      oa.innerHTML = chosen.length ? chosen.map((li, k) =>
        `<li><button class="line mono placed" data-k="${k}" aria-label="${esc(`${k + 1}번째 줄 빼기: ${it.lines[li]}`)}">${esc(it.lines[li])}</button></li>`).join("")
        : `<li class="empty">아래 조각을 눌러 보세요</li>`;
      body.querySelectorAll("#op .line").forEach((b) => {
        const used = chosen.includes(+b.dataset.li);
        b.disabled = used;
        b.classList.toggle("used", used);
      });
      oa.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { chosen.splice(+b.dataset.k, 1); paint(); }));
      act.disabled = chosen.length !== it.lines.length;
    };
    body.querySelectorAll("#op .line").forEach((b) => b.addEventListener("click", () => {
      const li = +b.dataset.li;
      if (!chosen.includes(li)) { chosen.push(li); paint(); }
    }));
    paint();
    act.addEventListener("click", () => {
      if (chosen.length !== it.lines.length) return;
      // 순서 문제는 정답 순서가 하나뿐이라 저장된 순서와 비교한다(C23)
      const ok = chosen.map((li) => it.lines[li]).join("\n") === it.lines.join("\n");
      judged(cur, ok, `<p class="answer">정답 순서</p>${codeBlock(it.lines.join("\n"))}${it.expect != null ? `<p class="ex-label">실행 결과</p><pre class="out">${esc(it.expect)}</pre>` : ""}`);
    });
  }

  function renderWriteItem(cur) {
    S.cleanupItem = mountWrite({
      ctx, item: cur.item, lesson, body, foot,
      onPass({ solutionSeen, hintUsed, hadError, firstSubmit }) {
        const w = S.write || { passed: false, hintUsed: false, solutionSeen: false, fixedError: false };
        S.write = { passed: true, hintUsed: w.hintUsed || hintUsed, solutionSeen: w.solutionSeen || solutionSeen, fixedError: w.fixedError || hadError };
        const it = cur.item;
        if (hintUsed || solutionSeen) mark(cur.index, it.concept, "hint");
        if (firstSubmit && !hintUsed && !solutionSeen) mark(cur.index, it.concept, "right");
        const clean = !solutionSeen;
        if (clean) { S.combo++; S.itemsSolved++; } else S.combo = 0;
        ctx.sound.play("correct");
        openResult({
          ok: true, flowCorrect: clean && firstSubmit,
          title: solutionSeen ? "통과했어요" : hadError ? "단서를 따라 고쳐서 통과!" : "통과했어요!",
          text: (solutionSeen ? "정답을 보고 통과했어요. 다음에 혼자 다시 써 보면 금방 익숙해져요. " : "") + (it.explain || ""),
          situation: "correct", sfx: "딩동!",
          onContinue: () => { S.cleanupItem && S.cleanupItem(); S.cleanupItem = null; S.flow = answer(S.flow, clean && firstSubmit); step(); },
        });
      },
      onWrong() {
        S.combo = 0;
        mark(cur.index, cur.item.concept, "wrong");
      },
      onHint() { mark(cur.index, cur.item.concept, "hint"); },
      log(entry) { S.logs.push({ lesson: lesson.id, item: cur.index, pass: !!entry.pass, at: new Date().toISOString() }); },
      showCards() { showCardsModal(); },
    });
  }

  function showCardsModal() {
    dialog({
      title: "개념 카드 다시 보기",
      body: (lesson.cards || []).map((c) => `<p>${esc(c.say)}</p>${c.code ? codeBlock(c.code) : ""}${c.out != null ? `<pre class="out">${esc(c.out)}</pre>` : ""}`).join(""),
      buttons: [{ label: "닫기", value: true, kind: "primary" }],
    });
  }

  function finishLesson() {
    const sum = summary(S.flow);
    const res = ctx.finish({
      lesson, mode: review ? "review" : "lesson", perfect: sum.perfect, accuracy: sum.accuracy,
      marks: S.marks, write: S.write, itemsSolved: S.itemsSolved, reviewCorrect: S.reviewCorrect, logs: S.logs,
    });
    ctx.sound.play("done");
    ctx.show("done", { result: res, lesson: review ? null : lesson, sum });
  }

  function step() {
    S.judged = false;
    setProgress();
    const cur = current(S.flow);
    body.scrollTop = 0;
    window.scrollTo(0, 0);
    if (cur.kind === "done") { finishLesson(); return; }
    if (cur.kind === "card") { renderCard(cur); }
    else {
      const t = cur.item.type;
      if (t === "choice" || t === "check") renderChoice(cur);
      else if (t === "blank") renderBlank(cur);
      else if (t === "order") renderOrder(cur);
      else if (t === "write") renderWriteItem(cur);
      else { S.flow = answer(S.flow, true); step(); return; }
    }
    const h = body.querySelector("h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  root.querySelector("#quit").addEventListener("click", async () => {
    const ok = await dialog({
      title: "레슨을 그만둘까요?",
      body: "<p>지금까지 푼 내용은 저장되지 않아요. 다음에 이 레슨을 처음부터 다시 해요.</p>",
      buttons: [{ label: "계속 풀기", value: false, kind: "primary" }, { label: "그만두기", value: true }],
    });
    if (ok) ctx.show("home");
  });

  const onKey = (e) => {
    if (e.key === "Enter" && !result.hidden && S.onContinue && performance.now() >= S.guardUntil) {
      if (document.activeElement && document.activeElement.id === "cont") return; // 버튼 자체 클릭으로 처리
      e.preventDefault();
      const f = S.onContinue; S.onContinue = null; f();
    }
  };
  document.addEventListener("keydown", onKey);
  step();
  return () => {
    document.removeEventListener("keydown", onKey);
    document.body.classList.remove("result-open");
    if (S.cleanupItem) S.cleanupItem();
  };
}
