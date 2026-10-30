// 직접 작성 문제: 입력창 + 기호 줄 + 「실행」·「제출」, 힌트 4단계, 정답 보기, 오류 설명
import { normalize, judge, explain } from "../grade.js";
import { riaSVG } from "../ria.js";
import { esc, icon, codeBlock } from "./dom.js";
import { createEditor } from "./editor.js";
import { missingMessage } from "../shuffle.js";
import { keyboardOpen, nextBaseHeight, SYMBOL_ORDER } from "../kbd.js";

const SYSTEM_ERRORS = new Set(["LoadError", "WorkerError", "NotReady"]);

function stdinOf(t) { return t && t.stdin != null ? String(t.stdin) : ""; }

export function mountWrite({ ctx, item, body, foot, onPass, onWrong, onHint, log, showCards }) {
  const tests = Array.isArray(item.tests) ? item.tests : [];
  const pub = tests.find((t) => t.public) || tests[0] || { stdin: "", expect: "" };
  const hints = Array.isArray(item.hints) ? item.hints : [];
  const st = { hintsShown: 0, solutionSeen: false, submits: 0, hadError: false, busy: false, destroyed: false };
  const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 문제 글 끝에 기대 출력이 그대로 붙어 있으면 아래 「기대 출력」 칸과 겹치므로 뺀다
  const exp = normalize(pub.expect);
  let task = String(item.task || "");
  if (exp && task.trimEnd().endsWith("\n" + exp)) task = task.trimEnd().slice(0, -(exp.length + 1));

  body.innerHTML = `<article class="item write">
    <button class="qtoggle" id="qtoggle" aria-expanded="false" aria-controls="taskblock">${icon("book")}<span>문제 보기</span></button>
    <div class="task-block" id="taskblock">
      <span class="tag code-tag">직접 써 보기</span>
      <h1 class="q">${esc(task)}</h1>
      <div class="expect">
        <p class="ex-label">기대 출력</p>
        <pre class="out">${esc(normalize(pub.expect))}</pre>
        ${stdinOf(pub) ? `<p class="stdin-note">${icon("send")}<span>입력하는 값: ${stdinOf(pub).split("\n").map((v) => `<code>${esc(v)}</code>`).join(" ")}</span></p>` : ""}
      </div>
    </div>
    <p class="py-chip" id="pychip" hidden></p>
    <div class="editor-box" id="ed"></div>
    <div class="help-row">
      <button class="btn ghost small" id="hint">${icon("bulb")}<span>힌트 <span id="hn">0</span>/${hints.length}</span></button>
      <button class="btn ghost small" id="sol">${icon("eye")}<span>정답 보기</span></button>
    </div>
    <ol class="hints" id="hints"></ol>
    <section class="console" id="console" aria-live="polite"></section>
    <section class="solution" id="solution" hidden></section>
  </article>`;

  foot.innerHTML = `<div class="dock">
    <div class="symwrap">
      <div class="symbols" role="toolbar" aria-label="기호 넣기">
        ${SYMBOL_ORDER.map((sy, i) => sy.act
          ? `<button class="sym word" data-s="${i}">${esc(sy.label)}</button>`
          : `<button class="sym mono" data-s="${i}" aria-label="${esc(sy.aria || sy.label)} 넣기">${esc(sy.label)}</button>`).join("")}
      </div>
      <span class="sym-more" aria-hidden="true">›</span>
    </div>
    <div class="dock-actions">
      <button class="btn ghost" id="run">${icon("play")}<span>실행</span></button>
      <button class="btn primary" id="submit">${icon("check")}<span>제출</span></button>
    </div>
  </div>`;
  foot.classList.add("has-dock");

  // 화면에 고정된 머리 줄과 아래 줄(기호·실행)이 가리는 높이: 커서를 이만큼 비켜서 보이게 함
  const header = document.querySelector(".lesson-top");
  const margins = () => {
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const top = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    const dockTop = foot.getBoundingClientRect().top;
    return { top: top + 8, bottom: Math.max(0, vh - dockTop) + 8 };
  };
  const ed = createEditor(body.querySelector("#ed"), { doc: item.starter || "", label: "코드 입력창. 여기에 Python 코드를 써요", margins });
  const consoleEl = body.querySelector("#console");
  const runBtn = foot.querySelector("#run");
  const subBtn = foot.querySelector("#submit");
  const chip = body.querySelector("#pychip");

  // ---- Python 준비 상태 ----
  function paintPy() {
    const { status, phase } = ctx.pyState();
    if (status === "ready") { chip.hidden = true; return; }
    chip.hidden = false;
    if (status === "error") {
      chip.className = "py-chip err";
      chip.innerHTML = `파이썬을 받지 못했어요. 인터넷 연결을 확인해 주세요. <button class="link" id="pyretry">다시 시도</button>`;
      chip.querySelector("#pyretry").addEventListener("click", () => { ctx.py.preload().catch(() => {}); });
    } else {
      chip.className = "py-chip";
      chip.innerHTML = `<span class="dot" aria-hidden="true"></span>${phase === "restart" ? "다시 준비 중" : "파이썬 준비 중"}`;
    }
  }
  paintPy();
  const offPy = ctx.onPy(paintPy);

  // ---- 기호 줄: 누를 때 입력창 초점(=화면 키보드)을 뺏지 않음 ----
  const keep = (e) => e.preventDefault();
  foot.querySelectorAll(".sym").forEach((b) => {
    b.addEventListener("mousedown", keep);
    b.addEventListener("pointerdown", keep);
    b.addEventListener("click", () => {
      const sy = SYMBOL_ORDER[+b.dataset.s];
      if (sy.act === "indent") ed.indent();
      else if (sy.act === "dedent") ed.dedent();
      else ed.insert(sy.ins, sy.back || 0);
    });
  });
  // 기호 줄이 화면 폭을 넘으면 오른쪽 끝에 흐림 + 화살표(끝까지 밀면 사라짐)
  const symRow = foot.querySelector(".symbols");
  const symWrap = foot.querySelector(".symwrap");
  const paintMore = () => symWrap.classList.toggle("more", symRow.scrollLeft + symRow.clientWidth < symRow.scrollWidth - 4);
  symRow.addEventListener("scroll", paintMore, { passive: true });

  // ---- 화면 키보드 위로 아래 줄 올리기 (visualViewport) ----
  // + 키보드가 열린 동안은 「간단 모드」(C30): 문제 글을 한 줄 단추로 접고 입력창이 남은 높이를 채움
  const vv = window.visualViewport;
  const qtoggle = body.querySelector("#qtoggle");
  const edBox = body.querySelector("#ed");
  let base = nextBaseHeight(null, vv ? vv.height : window.innerHeight, window.innerWidth);
  let compact = false;
  function setCompact(on, vh) {
    if (on !== compact) {
      compact = on;
      document.body.classList.toggle("kbd-compact", on);
      if (!on) {
        document.body.classList.remove("show-task");
        qtoggle.setAttribute("aria-expanded", "false");
        qtoggle.querySelector("span").textContent = "문제 보기";
      }
    }
    if (on) {
      const headH = header ? header.getBoundingClientRect().height : 0;
      const h = Math.max(88, Math.floor(vh - headH - foot.offsetHeight - qtoggle.offsetHeight - 32));
      edBox.style.setProperty("--edh", h + "px");
      window.scrollTo(0, 0);
      // 「문제 보기」를 열면 문제 글이 입력창 자리를 덮는 판으로 뜬다(키보드가 있으면 둘을 함께 둘 높이가 없음)
      const top = qtoggle.getBoundingClientRect().bottom + 4 + (vv ? vv.offsetTop : 0);
      const bottom = Math.max(0, window.innerHeight - foot.getBoundingClientRect().top);
      document.body.style.setProperty("--peek-top", Math.round(top) + "px");
      document.body.style.setProperty("--peek-bottom", Math.round(bottom) + "px");
    } else {
      edBox.style.removeProperty("--edh");
    }
  }
  function place() {
    const vh = vv ? vv.height : window.innerHeight;
    if (!ed.hasFocus()) base = nextBaseHeight(base, Math.max(vh, window.innerHeight), window.innerWidth);
    else if (base.width !== window.innerWidth) base = nextBaseHeight(base, window.innerHeight, window.innerWidth);
    const gap = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0;
    foot.style.transform = gap > 0 ? `translateY(${-gap}px)` : "";
    if (header) header.style.transform = vv && vv.offsetTop > 0 && compact ? `translateY(${vv.offsetTop}px)` : "";
    const open = keyboardOpen({ focused: ed.hasFocus(), vvHeight: vh, innerHeight: window.innerHeight, baseHeight: base.base });
    document.body.classList.toggle("kbd-open", open);
    setCompact(open, vh);
    paintMore();
    if (ed.hasFocus()) requestAnimationFrame(() => { if (!st.destroyed) ed.revealCursor(); });
  }
  if (vv) { vv.addEventListener("resize", place); vv.addEventListener("scroll", place); }
  window.addEventListener("resize", place);
  // 초점이 들어오고 나갈 때(키보드가 열리기 전후)도 다시 판정. 기호 줄·문제 보기 단추는 초점을 뺏지 않음
  const onFocus = () => place();
  const onBlur = () => setTimeout(() => { if (!st.destroyed) place(); }, 50);
  ed.view.contentDOM.addEventListener("focus", onFocus);
  ed.view.contentDOM.addEventListener("blur", onBlur);
  qtoggle.addEventListener("mousedown", keep);
  qtoggle.addEventListener("pointerdown", keep);
  qtoggle.addEventListener("click", () => {
    const show = !document.body.classList.contains("show-task");
    document.body.classList.toggle("show-task", show);
    qtoggle.setAttribute("aria-expanded", String(show));
    qtoggle.querySelector("span").textContent = show ? "문제 접기" : "문제 보기";
    place();
  });
  // 줄이 바뀔 때마다 커서 줄이 보이게
  ed.view.dom.addEventListener("keyup", () => { if (compact) ed.revealCursor(); });
  place();

  // ---- 출력 ----
  function errorHTML(err) {
    const ex = explain(err, ctx.save.outfit);
    const orig = err.type === "Timeout" ? "Timeout: 3초 안에 끝나지 않음"
      : `${err.type}${err.msg ? ": " + err.msg : ""}`;
    return `<div class="err-panel">
      <p class="err-orig mono" lang="en">${esc(orig)}${err.line ? ` <span lang="ko">(${err.line}번째 줄)</span>` : ""}</p>
      <h3>${icon("cross")}${esc(ex.title)}</h3>
      <p>${esc(ex.body)}</p>
    </div>`;
  }
  function riaLine(situation, sfx) {
    const l = ctx.say(situation);
    return `<div class="ria-row small"><div class="ria-wrap">${riaSVG({ outfit: ctx.save.outfit, face: l.face, size: 56 })}${sfx ? `<span class="sfx" aria-hidden="true">${esc(sfx)}</span>` : ""}</div><p class="bubble">${esc(l.text)}</p></div>`;
  }
  function showRunning() {
    consoleEl.innerHTML = riaLine("running", "타닥타닥");
  }
  function systemError(r) {
    consoleEl.innerHTML = `<div class="err-panel soft"><h3>파이썬이 아직 준비되지 않았어요</h3>
      <p>인터넷 연결을 확인하고 잠시 뒤 다시 눌러 주세요. 이번 실행은 제출 횟수에 들어가지 않아요.</p>
      <p class="err-orig mono" lang="en">${esc(r.error.type)}: ${esc(r.error.msg || "")}</p></div>`;
  }
  function setBusy(b) {
    st.busy = b;
    runBtn.disabled = b;
    subBtn.disabled = b;
    subBtn.setAttribute("aria-busy", String(b));
  }

  async function doRun() {
    if (st.busy) return;
    setBusy(true);
    ed.markLine(null);
    showRunning();
    try {
      const r = await ctx.py.run(ed.getCode(), stdinOf(pub), item.require || []);
      if (st.destroyed) return; // 화면을 떠난 뒤 도착한 결과는 버림
      if (r.error && SYSTEM_ERRORS.has(r.error.type)) { systemError(r); return; }
      const out = normalize(r.stdout);
      let html = `<p class="ex-label">실행 결과</p><pre class="out${out ? "" : " empty"}">${out ? esc(out) : "(출력 없음)"}</pre>`;
      if (r.error) {
        st.hadError = true;
        ed.markLine(r.error.line);
        ctx.sound.play("error");
        html += errorHTML(r.error) + riaLine("error", "어라?");
      }
      consoleEl.innerHTML = html;
    } finally { if (!st.destroyed) setBusy(false); }
  }

  async function doSubmit() {
    if (st.busy) return;
    setBusy(true);
    ed.markLine(null);
    showRunning();
    try {
      const code = ed.getCode();
      const results = [];
      for (const t of tests) {
        const r = await ctx.py.run(code, stdinOf(t), item.require || []);
        if (st.destroyed) return;
        if (r.error && SYSTEM_ERRORS.has(r.error.type)) { systemError(r); return; }
        results.push(r);
        if (r.error || r.timeout) break; // 오류는 첫 번째만 보여 줌
      }
      const v = judge(results, tests);
      st.submits++;
      log({ pass: v.pass });
      if (v.pass) {
        consoleEl.innerHTML = `<p class="pass-line">${icon("check")}시험 ${tests.length}개 모두 통과</p>`;
        onPass({ solutionSeen: st.solutionSeen, hintUsed: st.hintsShown > 0, hadError: st.hadError, firstSubmit: st.submits === 1 });
        return;
      }
      onWrong();
      const r = results[v.failedIndex] || {};
      let html = "";
      if (r.error) {
        st.hadError = true;
        ed.markLine(r.error.line, false);
        ctx.sound.play("error");
        html = (normalize(r.stdout) ? `<p class="ex-label">실행 결과</p><pre class="out">${esc(normalize(r.stdout))}</pre>` : "") + errorHTML(r.error) + riaLine("error", "어라?");
      } else if (v.reason === "missing") {
        ctx.sound.play("wrong");
        html = `<div class="err-panel soft"><h3>${icon("cross")}조건이 하나 남았어요</h3><p>${esc(missingMessage(r.missing))} 같은 결과를 그 방법으로 만들어 볼까요?</p></div>` + riaLine("wrong");
      } else {
        ctx.sound.play("wrong");
        if (v.publicDiff) {
          html = `<div class="diff"><div><p class="ex-label">기대 출력</p><pre class="out">${esc(v.publicDiff.expected)}</pre></div>
            <div><p class="ex-label bad">내 출력</p><pre class="out bad">${v.publicDiff.actual ? esc(v.publicDiff.actual) : "(출력 없음)"}</pre></div></div>
            <p class="result-explain">${icon("cross")}출력이 기대 출력과 달라요. 띄어쓰기와 기호까지 한 글자씩 비교해 봐요.</p>`;
        } else {
          const t = tests[v.failedIndex];
          const inp = stdinOf(t);
          html = `<div class="err-panel soft"><h3>${icon("cross")}다른 경우에서 결과가 달라요</h3><p>${inp ? `입력값이 ${esc(inp.split("\n").join(", "))}일 때` : `숨은 시험 ${v.failedIndex + 1}번에서`} 기대한 출력과 달라요. 입력이 바뀌어도 맞는 코드인지 확인해 봐요.</p></div>`;
        }
        html += riaLine("wrong");
      }
      html = `<p class="submit-count">제출 ${st.submits}번째 · 시험 ${tests.length}개 중 ${v.failedIndex}개 통과</p>` + html;
      consoleEl.innerHTML = html;
      if (st.submits >= 3 && !st.solutionSeen) revealSolution(true);
      // 틀린 까닭이 보이도록 설명 쪽으로 이동
      const room = window.innerHeight - 80 - 160; // style.css의 scroll-margin 위·아래와 같은 값
      consoleEl.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: consoleEl.offsetHeight < room ? "end" : "start" });
    } finally { if (!st.destroyed) setBusy(false); }
  }

  // ---- 힌트·정답 ----
  const hintBtn = body.querySelector("#hint");
  const hintList = body.querySelector("#hints");
  function showHint() {
    if (st.hintsShown >= hints.length) return;
    const i = st.hintsShown++;
    if (i === 0) onHint();
    // 리아 반응(힌트 대사, 상황별 직전 줄은 ctx.say가 피함)
    consoleEl.innerHTML = riaLine("hint", "");
    const h = hints[i];
    const isCode = i === hints.length - 1 && /[()"=]/.test(h);
    const li = document.createElement("li");
    li.className = "hint";
    li.innerHTML = `<span class="hint-no">힌트 ${i + 1}</span>${isCode ? codeBlock(h) : `<p>${esc(h)}</p>`}${i === 1 && showCards ? `<button class="link" data-cards>개념 카드 다시 보기</button>` : ""}`;
    hintList.appendChild(li);
    const cb = li.querySelector("[data-cards]");
    if (cb) cb.addEventListener("click", showCards);
    body.querySelector("#hn").textContent = String(st.hintsShown);
    if (st.hintsShown >= hints.length) hintBtn.disabled = true;
    // 새 힌트 바로 아래의 리아 반응까지 보이게(아래 줄에 가리지 않도록 scroll-margin 적용)
    consoleEl.scrollIntoView({ block: "nearest" });
  }
  hintBtn.addEventListener("click", showHint);

  const solEl = body.querySelector("#solution");
  function revealSolution(auto) {
    if (!st.solutionSeen) onHint();
    st.solutionSeen = true;
    solEl.hidden = false;
    solEl.innerHTML = `<h2>${auto ? "세 번 제출했으니 정답을 같이 볼까요?" : "정답과 해설"}</h2>
      ${codeBlock(item.solution || "")}
      ${item.explain ? `<p>${esc(item.explain)}</p>` : ""}
      <button class="btn ghost small" id="usesol">정답을 입력창에 넣기</button>`;
    solEl.querySelector("#usesol").addEventListener("click", () => { ed.setCode(item.solution || ""); ed.focus(); });
    body.querySelector("#sol").disabled = true;
    if (!auto) solEl.scrollIntoView({ block: "nearest" });
  }
  body.querySelector("#sol").addEventListener("click", () => revealSolution(false));

  runBtn.addEventListener("click", doRun);
  subBtn.addEventListener("click", doSubmit);

  return () => {
    st.destroyed = true;
    offPy();
    if (vv) { vv.removeEventListener("resize", place); vv.removeEventListener("scroll", place); }
    window.removeEventListener("resize", place);
    foot.style.transform = "";
    if (header) header.style.transform = "";
    document.body.classList.remove("kbd-compact", "show-task");
    document.body.style.removeProperty("--peek-top");
    document.body.style.removeProperty("--peek-bottom");
    foot.classList.remove("has-dock");
    document.body.classList.remove("kbd-open");
    ed.destroy();
  };
}
