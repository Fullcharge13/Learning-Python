// v0.15 「경비실」 화면: 사건 카드(크로우·리아) + 코드 칸(빈칸 고르기 / 직접 쓰기) + 문과 시도 줄(재생) + 결과
// 설계: docs/specs/2026-11-12-경비실-설계.md §1 · 계획서 작업 7
// 판정은 py/guard.py(실행), 저장·보상·등급은 src/guard/state.js, 빈칸은 src/guard/blanks.js. 이 화면은 잇고 그리기만 한다.
// 실행 결과는 재생 전에 먼저 저장한다(재생 중 떠나도 남음). 경비실은 바이트를 직접 주지 않는다(XP만, state.js).
// v0.16.0 작업 2: 목록·등급은 색인(ctx.guard.index)으로. 사건 본문은 열 때 장 파일에서 받는다(ctx.guard.load(장)).
//   받는 동안 「사건을 불러오는 중…」, 실패하면 「사건을 불러오지 못했어요」+「다시 시도」. 늦게 온 응답은 실행 토큰으로 버린다.
import { isDev } from "../devgate.js";
import { BADGES } from "../../data/badges.js";
import { crowSVG } from "../guard/crow.js";
import { fillBlanks, optionOrder } from "../guard/blanks.js";
import { cleanGuard, markSeen, guardInput, guardConsistent, rankOf, applyGuardRun, incidentOpen, isField, basicLeft } from "../guard/state.js";
import { passedChapters } from "../garden/state.js";
import { sheet } from "./garden.js";
import { esc, icon, dialog, toast, riaSays, celebrate } from "./dom.js";
import { mountEditor } from "./editorslot.js";
import { errorPanel, waitForClues } from "./write.js";
import { SYMBOL_ORDER } from "../kbd.js";
import { t, tx } from "../i18n.js";
import { definedNames } from "../grade.js";
import { fileCardHTML } from "./guardfile.js";

const SYSTEM_ERRORS = new Set(["LoadError", "WorkerError", "NotReady"]);
const STEP_MS = 450;     // 재생 1배: 시도 한 칸(2배는 반)
const CODE_SAVE_MS = 500;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const RANK = { apprentice: () => t`견습 문지기`, keeper: () => t`문지기`, captain: () => t`경비 반장`, sheriff: () => t`텃밭 보안관` };
// 판정 4가지: 공격(expect block)·손님(expect allow) × 막음·들임
const VERD = {
  blocked: ["🛡", () => t`막았어요`],
  breached: ["❌", () => t`뚫렸어요`],
  wrong: ["⚠️", () => t`잘못 막았어요`],
  let: ["✅", () => t`들였어요`],
  none: ["⚪", () => t`판정 안 함`],   // v0.16.1: 손님 시도에서 allow()도 block()도 안 부름(공격 쪽은 그대로 breached)
};
const kindOf = (expect, verdict) => (expect === "block" ? (verdict === "block" ? "blocked" : "breached")
  : verdict === "block" ? "wrong" : verdict === "none" ? "none" : "let");
const POSE = { blocked: "shock", breached: "loot", wrong: "wait", let: "wait", none: "wait" };
// 화면에 보이는 시도 값: 글자는 따옴표로(빈 값·빈칸이 보이게)
const shown = (v) => (typeof v === "string" ? JSON.stringify(v) : String(v));
const txt = (inc, f) => tx(`guard.${inc.id}.${f}`, inc[f]);
// 사건마다 쓸 수 있는 이름
const NAMES = { script: ["attempt", "allow()", "block()"], loop: ["has_try()", "next_try()", "allow()", "block()"], func: ["def check(attempt):", "return True", "return False"] };

/** 보기 글자: 빈 보기("")는 이름표로(코드에는 빈 글자가 그대로 들어감) */
const optLabel = (o) => (o === "" ? t`(비워 두기)` : o);
/** v0.20.0: 응용 사건 꼬리표(목록·사건 카드) */
const fieldTag = () => `<span class="gd-field-tag" title="${esc(t`응용 사건`)}">${t`응용`}</span>`;

/** 시작 코드를 빈칸 단추와 고정 글자로({{ }}는 글자 { }) */
function startHTML(inc, picks) {
  return inc.start.split(/(\{\{|\}\}|\{\d+\})/).map((p) => {
    if (p === "{{" || p === "}}") return p[0];
    const m = /^\{(\d+)\}$/.exec(p);
    if (!m) return esc(p);
    const n = +m[1];
    const opt = inc.blanks[n]?.options[picks[n]];
    const on = opt !== undefined;
    return `<button class="gd-blank${on ? " on" : ""}" data-n="${n}" aria-label="${esc(t`빈칸 ${n + 1}: ${on ? optLabel(opt) : t`고르지 않음`}`)}">${on ? esc(optLabel(opt)) : "___"}</button>`;
  }).join("");
}
/** 직접 쓰기 처음 내용: 빈칸을 비운 시작 코드 */
const blankedStart = (inc) => inc.start.replace(/\{\{|\}\}|\{\d+\}/g, (m) => (m.length === 2 ? m[0] : "___"));

/** 직접 쓰기 처음 내용(판정 G3-C11): 정답 보기(데이터 번호 0)로 채운 코드, 안 되면 ___ 시작 코드 */
const startCode = (inc) => fillBlanks(inc.start, inc.blanks, inc.blanks.map(() => 0)).code ?? blankedStart(inc);

export function render(root, ctx, params = {}) {
  const passed = passedChapters(ctx.save, ctx.chapters);
  const LIST = ctx.guard.index;   // 색인(본문 없음)
  const open = LIST.filter((i) => incidentOpen(i, passed, ctx.save.guard, isDev(ctx.save)));
  const G = () => cleanGuard(ctx.save.guard);
  const first = open.find((i) => i.id === params.id) || open.find((i) => !G().solved[i.id]) || open[0] || LIST[0];
  // entry: 지금 사건의 색인 칸, inc: 받은 본문(받기 전·실패면 null)
  const S = { entry: first, inc: null, picks: [], mode: "blank", state: "idle", speed: 1, skip: false, wake: null, token: 0, ed: null, edWait: null, codeTimer: null, last: null, destroyed: false };

  root.innerHTML = `<div class="screen guard" data-state="idle"><header class="g-top gd-head"><button class="icon-btn" id="gd-back" aria-label="${t`돌아가기`}">${icon("back")}</button>
      <div class="gd-title"><h1>${t`경비실`}</h1><p class="gd-rank" id="gd-rank"></p></div>
      <button class="btn ghost small" id="gd-list" aria-haspopup="dialog">${icon("book")}<span>${t`사건 목록`}</span></button>
    </header>
    <main class="g-main">
      <section class="panel gd-card" id="gd-card" aria-labelledby="gd-title"></section>
      <section class="panel gd-code" id="gd-code" aria-labelledby="gd-code-t"></section>
      <section class="panel gd-gate" aria-labelledby="gd-gate-t">
        <h2 id="gd-gate-t">${icon("guard")}<span>${t`문과 시도`}</span></h2>
        <div class="gd-door"><div class="gd-crow2" id="gd-crow2"></div><p class="gd-at mono" id="gd-at" aria-hidden="true"></p><span class="gd-post" aria-hidden="true">${icon("shield")}</span></div>
        <ol class="gd-tries" id="gd-tries" aria-label="${t`시도 줄`}"></ol>
      </section>
      <div id="gd-result" class="g-result gd-result" role="status" aria-live="polite"></div>
    </main>
    <footer class="g-foot">
      <div class="symwrap" id="gd-syms" hidden>
        <div class="symbols" role="toolbar" aria-label="${t`기호 넣기`}">
          ${SYMBOL_ORDER.map((sy, i) => sy.act
            ? `<button class="sym word" data-s="${i}" data-act="${esc(sy.act)}"${sy.aria ? ` aria-label="${esc(sy.aria)}"` : ""}>${esc(sy.label)}</button>`
            : `<button class="sym mono" data-s="${i}" aria-label="${esc(t`${sy.aria || sy.label} 넣기`)}">${esc(sy.label)}</button>`).join("")}
        </div>
      </div>
      <p class="py-chip" id="gd-py" hidden></p>
      <div class="gd-actions">
        <button class="btn ghost" id="gd-speed" hidden>${t`${1}배`}</button>
        <button class="btn sun" id="gd-skip" hidden>${icon("skip")}<span>${t`건너뛰기`}</span></button>
        <button class="btn primary" id="gd-run">${icon("play")}<span>${t`실행`}</span></button>
      </div>
    </footer>
  </div>`;

  const $ = (s) => root.querySelector(s);
  const scr = $(".screen.guard");
  const cardEl = $("#gd-card");
  const codeEl = $("#gd-code");
  const triesEl = $("#gd-tries");
  const resultEl = $("#gd-result");
  const runBtn = $("#gd-run");
  const foot = $(".g-foot");

  const saveG = (g) => ctx.commit({ ...ctx.save, guard: g });
  const setCrow = (pose) => { $("#gd-crow2").innerHTML = crowSVG({ pose, size: 64 }); };

  // ---- 머리·카드 ----
  // v0.20.0: 머리 줄은 기본 사건만 「해결」로 세고, 응용은 「사건 파일 m/n」(응용이 없으면 생략)
  const BASIC = LIST.filter((i) => !isField(i));
  const FIELD = LIST.filter(isField);
  function paintHead() {
    const g = G();
    const done = (list) => list.filter((i) => g.solved[i.id]).length;
    $("#gd-rank").textContent = `${RANK[rankOf(g)]()} · ${t`${done(BASIC)}/${BASIC.length} 해결`}`
      + (FIELD.length ? ` · ${t`사건 파일 ${done(FIELD)}/${FIELD.length}`}` : "");
  }
  /** 본문을 받는 동안·못 받았을 때의 카드(제목은 색인에서). 코드 칸·시도 줄은 비운다.
   *  stale(새 판이 나와 옛 장 파일이 없음): 다시 시도 대신 「새로 고치기」(lesson.js와 같은 글·동작) */
  function paintPending(failed, stale = false) {
    const e = S.entry;
    cardEl.innerHTML = `<h2 id="gd-title">${esc(txt(e, "title"))}</h2>`
      + (failed
        ? `<div class="err-panel soft gd-loadfail"><p role="alert">${stale ? t`새 판이 나왔어요. 눌러서 새로 고쳐요` : t`사건을 불러오지 못했어요`}</p>${stale
          ? `<button class="btn primary" id="gd-refresh">${t`새로 고치기`}</button>`
          : `<button class="btn primary" id="gd-retry">${t`다시 시도`}</button>`}</div>`
        : `<p class="g-msg gd-loading" role="status">${t`사건을 불러오는 중…`}</p>`);
    codeEl.innerHTML = "";
    codeEl.hidden = true;   // 본문이 없으면 코드 칸은 숨김(빈 판만 남지 않게)
    triesEl.innerHTML = "";
  }
  function paintCard(lose = false) {
    const inc = S.inc;
    cardEl.innerHTML = `<div class="gd-crow-row"><div class="gd-crow">${crowSVG({ pose: lose ? inc.crow.lose : inc.crow.intro, size: 84 })}</div><p class="bubble gd-say">${esc(txt(inc, lose ? "crowLose" : "crowIntro"))}</p></div><p class="gd-tags"><span class="gd-tag ${inc.tag}">${inc.tag === "prevent" ? t`예방` : t`대응`}</span><span class="gd-id">${inc.id}</span>${isField(inc) ? fieldTag() : ""}</p>
      <h2 id="gd-title">${esc(txt(inc, "title"))}</h2>
      ${riaSays({ outfit: ctx.save.outfit, face: "smile", text: txt(inc, "ria"), size: 56, cls: "small" })}
      <p class="gd-brief">${esc(txt(inc, "brief"))}</p>
      <p class="gd-concept">${icon("bulb")}<span><b>${t`개념 한 줄`}</b> ${esc(txt(inc, "concept"))}</span></p>`
      + (isField(inc) && inc.file && G().solved[inc.id]
        ? `<button class="btn ghost small gd-fileview" id="gd-fileview" aria-haspopup="dialog">${icon("book")}<span>${t`사건 파일 보기`}</span></button>` : "");
  }
  /** 해결한 응용 사건: 처음 해결 창과 같은 사건 파일 카드를 창으로 */
  async function showFile() {
    const inc = S.inc;
    if (!inc || !inc.file) return;
    await dialog({ title: t`사건 파일`, body: fileCardHTML(inc), buttons: [{ label: t`좋아요`, value: true, kind: "primary" }] });
    if (!S.destroyed) $("#gd-fileview")?.focus({ preventScroll: true });
  }

  // ---- 코드 칸 ----
  function flushCode() {
    if (S.codeTimer) { clearTimeout(S.codeTimer); S.codeTimer = null; }
    if (!S.ed) return;
    const g = G();
    const code = S.ed.getCode();
    if (g.code[S.inc.id] !== code) saveG({ ...g, code: { ...g.code, [S.inc.id]: code } });
  }
  function dropEditor() {
    flushCode();
    S.edWait = null;
    if (S.ed) { S.ed.destroy(); S.ed = null; }
  }
  function paintCode() {
    dropEditor();
    const inc = S.inc;
    const solved = !!G().solved[inc.id];
    if (!solved) S.mode = "blank";
    const code = S.mode === "code";
    codeEl.innerHTML = `<div class="g-prog-head"><h2 id="gd-code-t">${icon("code")}<span>${code ? t`직접 쓰기` : t`빈칸 고르기`}</span></h2>
        ${solved ? `<button class="btn ghost small" id="gd-mode">${code ? t`빈칸 고르기` : t`직접 쓰기`}</button>` : ""}</div>
      <p class="g-mode-note">${t`쓸 수 있는 것:`} ${[...NAMES[inc.mode], ...(inc.password !== undefined ? ["password"] : [])].map((n) => `<code>${esc(n)}</code>`).join(" ")}</p>
      ${code ? '<div class="editor-box gd-editor" id="gd-ed"></div>' : `<pre class="code gd-start">${startHTML(inc, S.picks)}</pre>`}`;
    $("#gd-syms").hidden = !code;
    if (code) {
      // v0.17.0: 편집기 묶음이 오기 전에는 시작 코드 글자 + 「준비 중」, 「실행」·기호 줄은 꺼 둠
      const slot = $("#gd-ed");
      S.edWait = slot;
      mountEditor(slot, {
        doc: G().code[inc.id] ?? startCode(inc),
        label: t`경비실 코드 입력창. 여기에 Python 코드를 써요`,
        margins: () => ({ top: $(".g-top").getBoundingClientRect().bottom + 8, bottom: window.innerHeight - foot.getBoundingClientRect().top + 8 }),
        onChange: () => {
          S.ed.markLine(null);
          if (S.codeTimer) clearTimeout(S.codeTimer);
          S.codeTimer = setTimeout(flushCode, CODE_SAVE_MS);
        },
      }).then((ed) => {
        if (S.destroyed || S.edWait !== slot) { ed.destroy(); return; }
        S.edWait = null;
        S.ed = ed;
        paintPy();
      });
    }
    paintPy();
  }
  async function pickBlank(n) {
    const b = S.inc.blanks[n];
    const inc = S.inc;
    const v = await sheet({
      title: t`빈칸 ${n + 1} 고르기`,
      html: `<ul class="g-pick">${optionOrder(inc.id, n, b.options.length).map((k) => [b.options[k], k]).map(([o, k]) => `<li><button class="g-pick-btn${S.picks[n] === k ? " on" : ""}" data-v="${k}" aria-label="${esc(optLabel(o))}"><code class="gd-opt">${esc(optLabel(o))}</code></button></li>`).join("")}</ul>`,
    });
    if (v == null || S.destroyed || S.inc !== inc || S.state !== "idle") return;
    S.picks = S.picks.map((p, i) => (i === n ? +v : p));
    const g = G();
    saveG({ ...g, blanks: { ...g.blanks, [inc.id]: S.picks } });
    $(".gd-start").innerHTML = startHTML(inc, S.picks);
    $(`.gd-blank[data-n="${n}"]`)?.focus({ preventScroll: true });
  }

  // ---- 시도 줄 ----
  /** ev: 판정한 시도들, stopped: 그 뒤는 판정 안 함(오류), now: 문 앞에 온 칸 */
  function paintTries(ev = [], stopped = false, now = -1) {
    const inc = S.inc;
    triesEl.innerHTML = guardInput(inc).tries.map((tr, i) => {
      const e = ev[i];
      const k = e ? kindOf(tr.expect, e.verdict) : null;
      const cls = e ? (e.ok ? " ok" : k === "none" ? " none" : " bad") : stopped ? " skip" : "";
      const twice = !!(e && e.twice);
      const lab = t`시도 ${i + 1}: ${shown(tr.value)}` + (k ? ` · ${VERD[k][1]()}` : "") + (twice ? ` · ${t`2번`}` : "");
      return `<li><button class="gd-try${cls}${i === now ? " now" : ""}" data-i="${i}" aria-label="${esc(lab)}"><span class="gd-v mono">${esc(shown(tr.value))}</span><span class="gd-mark" aria-hidden="true">${k ? VERD[k][0] : stopped ? "·" : ""}</span>${twice ? `<span class="gd-twice" aria-hidden="true">${t`2번`}</span>` : ""}</button></li>`;
    }).join("");
  }
  function showWhy(i) {
    const w = $("#gd-why");
    if (!S.last || !w) return;
    const inc = S.inc;
    const tr = guardInput(inc).tries[i];
    const e = S.last.ev[i];
    const k = e && kindOf(tr.expect, e.verdict);
    w.hidden = false;
    const notes = [e && e.verdict === "none" ? t`이 시도에서 allow()도 block()도 부르지 않았어요` : "",
      e && e.twice ? t`이 시도에서 판정을 두 번 했어요 — 첫 번째만 셌어요` : ""].filter(Boolean);
    w.innerHTML = notes.map((n) => `<span class="gd-why-note">${esc(n)}</span><br>`).join("") + `<b class="mono">${esc(shown(tr.value))}</b> · ${tr.expect === "block" ? t`공격` : t`손님`} · ${k ? `${VERD[k][0]} ${esc(VERD[k][1]())}` : t`판정하지 않았어요`}<br>${esc(tx(`guard.${inc.id}.why.${i}`, inc.tries[i].why))}`;
    triesEl.querySelectorAll(".gd-try.sel").forEach((b) => b.classList.remove("sel"));
    triesEl.querySelector(`[data-i="${i}"]`)?.classList.add("sel");
    // 아래에 고정된 「실행」 줄(.g-foot)에 가리지 않게, 줄 높이만큼 아래 여백을 두고 보여 준다
    const foot = $(".g-foot");
    w.style.scrollMarginBottom = `${(foot ? foot.offsetHeight : 0) + 12}px`;
    w.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
  }

  // ---- 상태 ----
  function paintPy() {
    const { status, phase } = ctx.pyState();
    const noEd = S.mode === "code" && !S.ed;   // 직접 쓰기인데 편집기가 아직 안 옴(v0.17.0)
    runBtn.disabled = S.state !== "idle" || status !== "ready" || noEd;
    root.querySelectorAll("#gd-syms .sym").forEach((b) => { b.disabled = noEd; });
    const chip = $("#gd-py");
    chip.hidden = status === "ready";
    if (status === "ready") return;
    chip.className = status === "error" ? "py-chip err" : "py-chip";
    chip.innerHTML = status === "error" ? `${t`파이썬을 받지 못했어요. 인터넷 연결을 확인해 주세요.`} <button class="link" id="gd-pyretry">${t`다시 시도`}</button>`
      : `<span class="dot" aria-hidden="true"></span>${phase === "restart" ? t`다시 준비 중` : t`파이썬 준비 중`}`;
    chip.querySelector("#gd-pyretry")?.addEventListener("click", () => { ctx.py.preload().catch(() => {}); });
  }
  const offPy = ctx.onPy(paintPy);
  function setState(st) {
    S.state = st;
    scr.dataset.state = st;
    $("#gd-speed").hidden = $("#gd-skip").hidden = st !== "replay";
    codeEl.inert = st !== "idle";
    paintPy();
  }
  /** 재생을 멈추고 이 실행의 남은 그리기를 버린다(사건을 바꾸거나 떠날 때) */
  function cancelRun() {
    S.token++;
    S.skip = true;
    if (S.wake) S.wake();
  }

  /** 사건 열기: 재생·결과를 비우고 그 장 파일에서 본문을 받는다. 그사이 다른 사건을 열면(토큰이 바뀜) 늦은 응답은 버린다 */
  function openIncident(entry) {
    cancelRun();
    dropEditor();
    const token = S.token;
    S.entry = entry;
    S.inc = null;
    S.mode = "blank";
    S.last = null;
    S.picks = [];
    resultEl.innerHTML = "";
    $("#gd-at").textContent = "";
    setCrow("wait");
    setState("loading");
    paintHead();
    paintPending(false);
    const mine = () => !S.destroyed && token === S.token;
    ctx.guard.load(entry.need).then((list) => {
      if (!mine()) return;
      const inc = list.find((i) => i.id === entry.id);
      if (inc) showIncident(inc);
      else failed(new Error(`guard incident ${entry.id} is not in chapter ${entry.need}`));
    }, (e) => { if (mine()) failed(e); });
  }
  function failed(e) {
    console.warn(e);
    setState("failed");
    paintPending(true, !!(e && e.stale) || !!(ctx.swChanged && ctx.swChanged()));
    $("#gd-refresh, #gd-retry")?.focus();
  }
  /** 받은 본문으로 카드·코드 칸·시도 줄을 그리고, 처음 본 사건이면 본 것으로 */
  function showIncident(inc) {
    S.inc = inc;
    const g = G();
    S.picks = inc.blanks.map((_, k) => g.blanks[inc.id]?.[k] ?? null);
    if (!g.seen.includes(inc.id)) saveG(markSeen(g, inc.id));
    setState("idle");
    codeEl.hidden = false;
    paintCard();
    paintCode();
    paintTries();
  }

  // ---- 실행·재생 ----
  function sleep(ms) {
    return new Promise((res) => {
      const tm = setTimeout(() => { S.wake = null; res(); }, ms);
      S.wake = () => { clearTimeout(tm); S.wake = null; res(); };
    });
  }
  async function replay(ev, token) {
    setState("replay");
    S.skip = false;
    const tries = guardInput(S.inc).tries;
    const at = $("#gd-at");
    for (let k = 0; k < ev.length; k++) {
      if (S.skip || S.destroyed || token !== S.token) return;
      const per = STEP_MS / S.speed;
      paintTries(ev.slice(0, k), false, k);
      at.textContent = shown(tries[k].value);
      at.classList.remove("walk");
      void at.offsetWidth;   // 같은 움직임을 다시 걸기
      at.classList.add("walk");
      await sleep(per * 0.6);
      if (S.skip || S.destroyed || token !== S.token) return;
      paintTries(ev.slice(0, k + 1), false, k);
      setCrow(POSE[kindOf(tries[k].expect, ev[k].verdict)]);
      await sleep(per * 0.4);
    }
  }
  function shake(n) {
    const b = $(`.gd-blank[data-n="${n}"]`);
    if (!b) return;
    b.classList.remove("gd-shake");
    void b.offsetWidth;
    b.classList.add("gd-shake");
    b.focus({ preventScroll: true });
    b.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
  }

  async function doRun() {
    if (S.state !== "idle") return;
    if (S.mode === "code" && !S.ed) return;   // 편집기를 기다리는 중
    if (ctx.pyState().status !== "ready") { paintPy(); return; }
    const inc = S.inc;
    let code;
    const how = S.mode === "code" ? "code" : "blank";
    if (how === "code") {
      flushCode();
      code = S.ed.getCode();
      S.ed.markLine(null);
    } else {
      const f = fillBlanks(inc.start, inc.blanks, S.picks);
      if (!f.code) {
        ctx.sound.play("error");
        resultEl.innerHTML = `<p class="g-msg warn">${icon("cross")}<span>${t`빈칸을 모두 골라요`}</span></p>`;
        shake(f.missing[0]);
        return;
      }
      code = f.code;
    }
    const token = ++S.token;
    S.last = null;
    setState("running");
    paintTries();
    setCrow("wait");
    resultEl.innerHTML = `<p class="g-msg">${t`크로우가 문 앞에 왔어요…`}</p>`;
    const input = guardInput(inc);
    let r;
    try {
      // 파일 사건(G25 등): 엔진은 files를 guard 안이 아니라 따로 받아 실행 폴더에 써 둔다(tests/guard_incidents.py와 같은 모양)
      r = await ctx.py.run(code, "", [], input.files ? { guard: input, files: input.files } : { guard: input });
    } catch (e) {
      r = { error: { type: "WorkerError", msg: String(e && e.message || e) } };
    }
    const mine = () => !S.destroyed && token === S.token;
    if (r.error && SYSTEM_ERRORS.has(r.error.type)) {
      if (!mine()) return;
      setState("idle");
      resultEl.innerHTML = `<div class="err-panel soft"><h3>${t`파이썬이 아직 준비되지 않았어요`}</h3><p>${t`인터넷 연결을 확인하고 잠시 뒤 다시 눌러 주세요.`}</p></div>`;
      return;
    }
    // 저장 먼저(재생 중 떠나도 남음). 결과 대조가 틀리면 applyGuardRun이 저장을 그대로 돌려준다
    const ok = !!r.guard && guardConsistent(input, r.guard);
    const ap = applyGuardRun(ctx.save, inc, r.guard, how, new Date());
    if (ap.save !== ctx.save) ctx.commit(ap.save);
    const out = ap.outcome;
    const solvedNote = () => { if (out.firstSolve) toast(t`「${txt(inc, "title")}」 사건 해결! XP +${out.xp}`); };
    if (!mine()) { solvedNote(); return; }
    const ev = ok ? r.guard.events : [];
    if (ev.length && !reduced()) await replay(ev, token);
    if (!mine()) { solvedNote(); return; }

    const err = r.error || null;
    const stopped = ok && r.guard.stopped === "error";
    S.last = { ev };
    paintTries(ev, stopped || !ok);
    $("#gd-at").textContent = "";
    const breached = ev.some((e, i) => kindOf(input.tries[i].expect, e.verdict) === "breached");
    setCrow(out.solved ? inc.crow.lose : breached ? "loot" : "wait");
    paintHead();
    if (out.solved) paintCard(true);
    if (out.firstSolve) paintCode();   // 「직접 쓰기」 단추가 생김
    if (err && S.ed && err.line) S.ed.markLine(err.line, false);
    if (err) {   // 오류 안내 묶음이 아직이면 「단서 찾는 중…」(v0.17.0)
      await waitForClues(resultEl);
      if (!mine()) { solvedNote(); return; }
    }
    const st = ok ? r.guard.stats : null;
    resultEl.innerHTML = (out.solved ? `<p class="g-msg gd-win">${icon("check")}<span>${t`사건 해결!`}</span></p>`
        + (/\beval\s*\(/.test(code) ? `<p class="g-msg warn gd-eval">${icon("cross")}<span>${t`eval은 입력을 코드로 실행해요. JSON은 json.loads로 읽어요`}</span></p>` : "")
      : !ok && !err ? `<p class="g-msg warn">${t`실행 결과를 확인하지 못했어요`}</p>` : "")
      + (st ? `<p class="gd-stats">${t`막은 공격 ${st.attacks_blocked}/${st.attacks_total} · 들인 손님 ${st.guests_allowed}/${st.guests_total}`}</p>
        <p class="gd-why" id="gd-why">${t`칸을 누르면 「왜?」를 볼 수 있어요.`}</p>` : "")
      + (err ? errorPanel(err, ctx.save.outfit, null, how === "code" ? { starterNames: definedNames(inc.start) } : {}) : "");
    ctx.sound.play(out.solved ? "correct" : "error");
    setState("idle");
    if (out.firstSolve) await solvedDialog(inc, out);
    else if (!out.solved) (resultEl.querySelector(".err-panel") || resultEl).scrollIntoView({ block: err ? "start" : "nearest", behavior: reduced() ? "auto" : "smooth" });   // 오류 카드 위쪽이 보이게
  }

  /** 처음 해결: 텃밭 주문 완료와 같은 모양(창 → 이정표 축하 → 새 배지 알림) */
  async function solvedDialog(inc, out) {
    ctx.sound.play("done");
    await dialog({
      title: t`사건 해결!`,
      body: `<div class="gd-done g-done-body"><div class="gd-crow-row"><div class="gd-crow">${crowSVG({ pose: inc.crow.lose, size: 64 })}</div><p class="bubble gd-say">${esc(txt(inc, "crowLose"))}</p></div>${riaSays({ outfit: ctx.save.outfit, face: "joy", text: t`「${txt(inc, "title")}」 사건을 해결했어요. 문을 잘 지켰어요!`, size: 64 })}
        <p class="g-done-xp">${icon("xp")}<span>XP +${out.xp}</span></p>${fileCardHTML(inc)}</div>`,
      buttons: [{ label: t`좋아요`, value: true, kind: "primary" }],
    });
    if (S.destroyed) return;
    if (!runBtn.disabled) runBtn.focus({ preventScroll: true });
    if (out.milestone) await celebrate({ outfit: ctx.save.outfit, milestone: out.milestone });
    const names = out.newBadges.map((id) => BADGES.find((x) => x.id === id)).filter(Boolean).map((b) => tx(`badge.${b.id}.name`, b.name));
    if (names.length) toast(t`새 배지를 받았어요: ${names.join(", ")}`);
  }

  async function openList() {
    const g = G();
    const id = await sheet({
      title: t`사건 목록`,
      html: `<ul class="g-pick">${LIST.map((i) => {
        const on = incidentOpen(i, passed, ctx.save.guard, isDev(ctx.save));
        // 응용: 장을 끝냈는데 기본이 남았으면 남은 수(v0.20.0)
        const lock = !passed.has(i.need) ? t`${i.need}장을 끝내면 열려요` : t`기본 사건 3개를 풀면 열려요 · ${basicLeft(i, ctx.save.guard)}개 남음`;
        const note = !on ? `${icon("lock")}${esc(lock)}` : g.solved[i.id] ? `${icon("check")}${t`해결`}` : "";
        const field = isField(i);
        return `<li><button class="g-pick-btn gd-item${i.id === S.entry.id ? " on" : ""}${field ? " field" : ""}" data-g="${i.id}"${on ? ` data-v="${i.id}"` : " disabled"}>
          <span>${field ? icon("book") : ""}${i.id} · ${esc(txt(i, "title"))}${field ? ` ${fieldTag()}` : ""}</span><small>${note}</small></button></li>`;
      }).join("")}</ul>`,
    });
    if (!id || S.destroyed) return;
    const e = LIST.find((i) => i.id === id);
    if (e) openIncident(e);
    window.scrollTo({ top: 0 });
  }

  // ---- 누르기 ----
  const modalOpen = () => !!document.querySelector(".modal-back");
  // v0.20.1: #app은 화면이 바뀌어도 그대로라 떠날 때 이 묶음을 꼭 뗀다(남으면 떠난 화면이 먼저 눌림을 받음)
  const onRootClick = (e) => {
    if (modalOpen()) return;
    if (e.target.closest("#gd-retry") && S.state === "failed") { openIncident(S.entry); return; }
    if (e.target.closest("#gd-fileview") && S.state === "idle") { showFile(); return; }
    if (e.target.closest("#gd-refresh") && S.state === "failed") { location.reload(); return; }
    const b = e.target.closest(".gd-blank");
    if (b && S.state === "idle") { pickBlank(+b.dataset.n); return; }
    const c = e.target.closest(".gd-try");
    if (c && S.state === "idle") { showWhy(+c.dataset.i); return; }
    if (e.target.closest("#gd-mode") && S.state === "idle") {
      flushCode();
      S.mode = S.mode === "code" ? "blank" : "code";
      paintCode();
    }
  };
  root.addEventListener("click", onRootClick);
  const keep = (e) => e.preventDefault();
  root.querySelectorAll(".sym").forEach((b) => {
    b.addEventListener("mousedown", keep);
    b.addEventListener("pointerdown", keep);
    b.addEventListener("click", () => {
      if (!S.ed || S.state !== "idle") return;
      const sy = SYMBOL_ORDER[+b.dataset.s];
      if (sy.act === "newline") S.ed.newline();
      else if (sy.act === "indent") S.ed.indent();
      else if (sy.act === "dedent") S.ed.dedent();
      else S.ed.insert(sy.ins, sy.back || 0);
    });
  });
  $("#gd-back").addEventListener("click", () => ctx.show("garden", { from: params.from }));
  $("#gd-list").addEventListener("click", () => { if (!modalOpen()) openList(); });
  runBtn.addEventListener("click", doRun);
  $("#gd-skip").addEventListener("click", () => { S.skip = true; if (S.wake) S.wake(); });
  const speedBtn = $("#gd-speed");
  speedBtn.setAttribute("aria-label", t`재생 속도 ${1}배, 누르면 ${2}배`);
  speedBtn.addEventListener("click", () => {
    S.speed = S.speed === 1 ? 2 : 1;
    speedBtn.textContent = t`${S.speed}배`;
    speedBtn.setAttribute("aria-label", t`재생 속도 ${S.speed}배, 누르면 ${S.speed === 1 ? 2 : 1}배`);
  });
  // 화면 키보드 위로 아래 줄 올리기(텃밭과 같음)
  const vv = window.visualViewport;
  const place = () => {
    const gap = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0;
    foot.style.transform = gap > 0 ? `translateY(${-gap}px)` : "";
  };
  if (vv) { vv.addEventListener("resize", place); vv.addEventListener("scroll", place); }

  openIncident(first);

  return () => {
    S.destroyed = true;
    root.removeEventListener("click", onRootClick);
    cancelRun();
    dropEditor();
    offPy();
    if (vv) { vv.removeEventListener("resize", place); vv.removeEventListener("scroll", place); }
    document.querySelectorAll(".modal-back").forEach((m) => m.remove());
  };
}
