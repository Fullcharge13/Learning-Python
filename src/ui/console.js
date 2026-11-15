// v0.21.0 「프로젝트 공방」 주고받기 화면(screen "play"): 완성작을 진짜 프로그램처럼 한 판 실행
// 설계 docs/specs/2026-11-15-프로젝트-공방-설계.md §4-3. 「멈췄다 다시 돌리기」는 src/projects/console.js(createSession)가 한다.
// - 실행 중에는 입력칸(읽기 전용)·「보내기」를 잠근다(처리 중에 보낸 답은 세션이 버림, 작업 2 이월). 입력칸은 disabled 대신
//   readOnly로 잠가 초점(아이폰 화면 키보드)을 유지한다.
// - 출력은 줄마다 「프로그램 출력」과 「내 답」으로 나눠 그린다(실행기는 답을 표준 출력에 다시 쓰지 않음).
// - 출력 앞부분이 달라지면(replaced) 처음부터 다시 그리고 안내 한 줄. 입력 50번 상한·시간 제한·오류는 친절한 한 줄 + 오류 카드 + 「다시 하기」.
// - 떠날 때(v0.20.1): 세션을 버리고, 늦게 온 결과는 S.destroyed·playGen·세션 대조로 버린다. #app에는 묶음을 달지 않는다.
import { cleanProjects } from "../projects/state.js";
import { createSession } from "../projects/console.js";
import { esc, icon } from "./dom.js";
import { errorPanel, waitForClues } from "./write.js";
import { t, lang } from "../i18n.js";

const SYSTEM_ERRORS = new Set(["LoadError", "WorkerError", "NotReady"]);
const NUMBER_ERR = /invalid literal for int\(\)|could not convert string to float/;
export const PLAY_MAX_INPUTS = 50;

let playGen = 0;

/** 오류 위에 붙일 쉬운 한 줄 */
function friendly(err) {
  if (err.type === "ValueError" && NUMBER_ERR.test(err.msg || "")) return t`숫자로 입력해야 해요. 「다시 하기」를 눌러 새 판을 시작해요.`;
  // 검토 M6(b): 이 화면에서는 코드를 못 고치므로 고칠 곳(공방의 「다시 만들기」)을 알려 줌
  if (err.type === "Timeout") return t`프로그램이 끝나지 않아요. 공방에서 이 작품을 누르고 「다시 만들기」로 코드를 고쳐 봐요.`;
  return t`프로그램이 오류로 멈췄어요. 아래 단서를 보고 「다시 하기」로 새 판을 시작해요.`;
}

export function render(root, ctx, params = {}) {
  const gen = ++playGen;
  const id = params.id;
  const S = { destroyed: false, session: null, body: null, log: [], need: null, turn: 0, busy: true };
  const alive = (sess) => !S.destroyed && gen === playGen && (sess === undefined || sess === S.session);
  const entry = ((ctx.projects && ctx.projects.index) || []).find((e) => e.id === id);
  const done = cleanProjects(ctx.save.projects).done[id];
  const title = entry ? (entry.title[lang()] || entry.title.ko) : String(id || "");

  root.innerHTML = `<div class="screen play" data-state="loading" data-turn="0">
    <header class="g-top pl-top">
      <button class="icon-btn" id="pl-back" aria-label="${t`공방으로 돌아가기`}">${icon("back")}</button>
      <h1>${esc(title)}</h1>
      <button class="icon-btn" id="pl-restart" aria-label="${t`처음부터 다시`}" disabled>${icon("review")}</button>
    </header>
    <main class="g-main pl-main">
      <p class="pl-prompt" id="pl-prompt" hidden></p>
      <p class="pl-files" id="pl-files" hidden>${icon("book")}<span>${t`이 작품의 파일은 한 판 동안만 남아요. 다시 하면 처음 파일로 돌아가요.`}</span></p>
      <section class="pl-term" aria-labelledby="pl-term-t">
        <h2 class="sr" id="pl-term-t">${t`실행 화면`}</h2>
        <div class="pl-log mono" id="pl-log" aria-live="polite"></div>
      </section>
      <div class="pl-msg" id="pl-msg" role="status"></div>
    </main>
    <footer class="pl-foot" id="pl-foot">
      <form class="pl-form" id="pl-form" autocomplete="off">
        <label class="sr" for="pl-input">${t`내 답`}</label>
        <input id="pl-input" class="pl-input mono" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off"
          enterkeyhint="send" maxlength="500" placeholder="${esc(t`여기에 답을 써요`)}" readonly>
        <button class="btn primary" id="pl-send" type="submit" disabled>${icon("send")}<span>${t`보내기`}</span></button>
      </form>
      <button class="btn sun wide" id="pl-again" type="button" hidden>${icon("review")}<span>${t`다시 하기`}</span></button>
    </footer>
  </div>`;
  const $ = (s) => root.querySelector(s);
  const scr = $(".screen.play");
  const logEl = $("#pl-log");
  const msgEl = $("#pl-msg");
  const form = $("#pl-form");
  const input = $("#pl-input");
  const send = $("#pl-send");
  const again = $("#pl-again");
  const foot = $("#pl-foot");

  function setState(st) {
    scr.dataset.state = st;
    const need = st === "need";
    S.busy = !need;
    input.readOnly = !need;
    send.disabled = !need;
    input.setAttribute("aria-disabled", String(!need));
    form.hidden = !(need || st === "running" || st === "loading");
    again.hidden = !["done", "error", "limit"].includes(st);
    $("#pl-restart").disabled = st === "loading" || st === "failed" || !S.session;
  }
  function paintLog(note = "") {
    logEl.innerHTML = S.log.map((s) => (s.in !== undefined
      ? `<span class="pl-in"><span class="sr">${t`내 답:`} </span>${esc(s.in)}</span>\n`
      : `<span class="pl-out">${esc(s.out)}</span>`)).join("")
      + (S.need && S.need.prompt ? `<span class="pl-ask">${esc(S.need.prompt)}</span>` : "")
      + (S.need ? `<span class="pl-caret" aria-hidden="true">▌</span>` : "");
    if (note) msgEl.innerHTML = note;
  }
  /** 새 출력·안내가 보이게(아래 고정 입력 줄·위 머리에 가리지 않게 — style.css scroll-margin). 오류 카드가 길면 그 위쪽부터 */
  function scrollEnd() {
    requestAnimationFrame(() => {
      if (!alive()) return;
      const target = msgEl.firstElementChild || logEl.lastElementChild || logEl;
      target.scrollIntoView({ block: "nearest" });
    });
  }

  /** 세션 한 번의 결과(Frame)를 그린다. answer: 이번에 보낸 답(시작·다시 하기면 undefined) */
  async function apply(sess, frame, answer) {
    if (!alive(sess) || !frame || frame.stale) return;
    S.turn += 1;
    let note = "";
    if (frame.limit) {
      S.need = null;
      paintLog();
      msgEl.innerHTML = `<p class="pl-line pl-limit">${icon("cross")}<span>${esc(t`한 판이 너무 길어요. 입력을 ${PLAY_MAX_INPUTS}번 받아서 멈췄어요. 「다시 하기」로 새 판을 시작해요.`)}</span></p>`;
      scr.dataset.turn = String(S.turn);
      setState("limit");
      return;
    }
    if (answer !== undefined) S.log.push({ in: answer });
    if (frame.replaced) {
      // 출력 앞부분이 앞 실행과 달라짐(프로그램이 스스로 무작위 씨앗·시각을 바꿈 등): 처음부터 다시 보여 준다
      const answers = sess.inputs;
      S.log = [{ out: frame.output }];
      note = `<p class="pl-line pl-note">${icon("review")}<span>${esc(t`출력이 앞과 달라져서 처음부터 다시 보여 줘요.`)}${answers.length ? ` ${esc(t`지금까지 한 답: ${answers.map((a) => `「${a}」`).join(", ")}`)}` : ""}</span></p>`;
    } else if (frame.appended) {
      S.log.push({ out: frame.appended });
    }
    S.need = frame.need;
    msgEl.innerHTML = "";
    const err = frame.error;
    if (err && SYSTEM_ERRORS.has(err.type)) {
      paintLog(note);
      msgEl.innerHTML += `<div class="err-panel soft"><h3>${t`파이썬이 아직 준비되지 않았어요`}</h3><p>${t`인터넷 연결을 확인하고 「다시 하기」를 눌러 주세요.`}</p></div>`;
      scr.dataset.turn = String(S.turn);
      setState("error");
      return;
    }
    if (err) {
      paintLog(note);
      ctx.sound.play("error");
      setState("running");   // 단서를 기다리는 동안도 잠금
      await waitForClues(msgEl);
      if (!alive(sess)) return;
      msgEl.innerHTML = note + `<p class="pl-line pl-friendly">${icon("bulb")}<span>${esc(friendly(err))}</span></p>` + errorPanel(err, ctx.save.outfit);
      scr.dataset.turn = String(S.turn);
      setState("error");
      scrollEnd();
      return;
    }
    paintLog(note);
    if (!frame.need) msgEl.innerHTML += `<p class="pl-line pl-end">${icon("check")}<span>${t`프로그램이 끝났어요. 한 판 더 할까요?`}</span></p>`;
    scr.dataset.turn = String(S.turn);
    setState(frame.need ? "need" : "done");
    scrollEnd();
  }

  /** 실행기 부름(거부·예외도 오류 결과로) */
  const run = (code, stdin, opts) => Promise.resolve()
    .then(() => ctx.py.run(code, stdin, [], opts))
    .catch((e) => ({ stdout: "", stderr: "", error: { type: "WorkerError", msg: String((e && e.message) || e) } }));

  async function begin(restart) {
    const sess = S.session;
    if (!sess) return;
    S.log = [];
    S.need = null;
    msgEl.innerHTML = "";
    paintLog();
    setState("running");
    const frame = await (restart ? sess.restart() : sess.start());
    await apply(sess, frame);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (S.busy || !S.session || scr.dataset.state !== "need") return;
    const sess = S.session;
    const text = input.value;
    input.value = "";
    setState("running");
    const frame = await sess.answer(text);
    await apply(sess, frame, Array.from(text).slice(0, 500).join(""));
  }

  async function load() {
    if (!done || !entry) {
      setState("failed");
      msgEl.innerHTML = `<p class="pl-line pl-limit">${t`아직 완성하지 않은 작품이에요.`}</p>`;
      return;
    }
    setState("loading");
    logEl.innerHTML = `<span class="pl-out">${t`작품을 불러오는 중…`}</span>`;
    let body = null;
    try {
      body = await ctx.projects.load(id, done.lang);   // 진열장의 완성작은 만든 언어 그대로
    } catch (e) {
      if (!alive()) return;
      console.warn(e);
      setState("failed");
      logEl.innerHTML = "";
      msgEl.innerHTML = `<div class="err-panel soft"><p role="alert">${t`작품을 불러오지 못했어요`}</p><button class="btn primary" id="pl-retry">${t`다시 시도`}</button></div>`;
      $("#pl-retry").addEventListener("click", load);
      return;
    }
    if (!alive()) return;
    S.body = body;
    const prompt = $("#pl-prompt");
    prompt.innerHTML = `${icon("send")}<span>${esc(body.play && body.play.prompt ? body.play.prompt : t`프로그램이 물으면 아래에 답을 써요`)}</span>`;
    prompt.hidden = false;
    $("#pl-files").hidden = !(body.play && body.play.files);
    S.session = createSession({ code: done.code, run, maxInputs: PLAY_MAX_INPUTS, files: (body.play && body.play.files) || null });
    begin(false);
  }

  form.addEventListener("submit", onSubmit);
  again.addEventListener("click", () => { if (S.session && !["running", "loading"].includes(scr.dataset.state)) begin(true); });
  $("#pl-restart").addEventListener("click", () => { if (S.session && !["running", "loading"].includes(scr.dataset.state)) begin(true); });
  $("#pl-back").addEventListener("click", () => ctx.show("workshop"));
  // 화면 키보드 위로 입력 줄 올리기(경비실·텃밭과 같음)
  const vv = window.visualViewport;
  const place = () => {
    const gap = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0;
    foot.style.transform = gap > 0 ? `translateY(${-gap}px)` : "";
  };
  if (vv) { vv.addEventListener("resize", place); vv.addEventListener("scroll", place); }
  load();

  return () => {
    S.destroyed = true;
    S.session = null;   // 세션을 버림: 늦게 온 실행 결과는 alive(sess)에서 걸러짐
    if (vv) { vv.removeEventListener("resize", place); vv.removeEventListener("scroll", place); }
  };
}
