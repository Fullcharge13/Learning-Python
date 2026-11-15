// v0.21.0 「프로젝트 공방」 프로젝트 화면: 단계 머리(n/m·목표) + 리아 안내·새 도구 카드 + 레슨 「직접 쓰기」(mountWrite) 재사용
// 설계 docs/specs/2026-11-15-프로젝트-공방-설계.md §4-4·§7. 저장·보상은 src/projects/state.js(passStep이 XP·퀘스트·배지까지)
// - 본문은 지금 언어의 프로젝트 파일(ctx.projects.load). 진행은 시작한 언어에 묶임 → 다른 언어면 먼저 고르기 창.
// - 통과하면 단계 창 → 다음 단계(코드는 내 코드에서 이어 감). 마지막 단계 → 완성 창 → 주고받기(play 화면).
// - 「모범 코드에서 이어 하기」: 그 단계 모범 답으로 넘어감(그 단계 XP 없음, passStep usedSolution).
// - 떠날 때(v0.20.1): #app에 묶음을 달지 않는다. 늦게 온 본문·창 결과는 S.destroyed·projectGen·개발자 칸으로 버린다.
import { isDev } from "../devgate.js";
import { BADGES } from "../../data/badges.js";
import { passedChapters } from "../garden/state.js";
import { stepState, saveDraft, passStep, restartInLang, projectOpen } from "../projects/state.js";
import { esc, icon, bar, dialog, riaSays, toast, codeBlock, celebrate } from "./dom.js";
import { mountWrite } from "./write.js";
import { t, tx, lang, tp } from "../i18n.js";

let projectGen = 0;

/** 다른 언어로 시작한 진행: 고르기 창. "switch"(그 언어로 바꿔 이어 하기) | "here"(이 언어로) | null */
function askLang(st) {
  const ko = st.langMismatch === "ko";
  // 검토 M6(a): 「이 언어」 대신 지금 언어 이름으로
  const en = lang() === "en";
  const here = st.resume ? (en ? t`영어로 이어서 (${st.resume.step + 1}단계)` : t`한국어로 이어서 (${st.resume.step + 1}단계)`)
    : (en ? t`영어로 처음부터` : t`한국어로 처음부터`);
  return dialog({
    title: ko ? t`이 프로젝트는 한국어로 시작했어요` : t`이 프로젝트는 영어로 시작했어요`,
    body: `<div class="pj-lang"><p>${ko ? t`한국어로 바꾸면 하던 곳에서 이어 해요. 이 언어로 하면 따로 만들고, 한국어 진행은 그대로 남아요.`
      : t`영어로 바꾸면 하던 곳에서 이어 해요. 이 언어로 하면 따로 만들고, 영어 진행은 그대로 남아요.`}</p></div>`,
    buttons: [
      { label: ko ? t`한국어로 바꿔 이어 하기` : t`영어로 바꿔 이어 하기`, value: "switch", kind: "primary" },
      { label: here, value: "here" },
      { label: tp("cancel", "그만두기"), value: null },
    ],
  });
}

export function render(root, ctx, params = {}) {
  const gen = ++projectGen;
  const dev0 = !!ctx.dev;
  const id = params.id;
  const entry = ((ctx.projects && ctx.projects.index) || []).find((e) => e.id === id);
  const S = { destroyed: false, token: 0, body: null, step: 0, busy: false, cleanupItem: null };
  const alive = () => !S.destroyed && gen === projectGen && !!ctx.dev === dev0;
  if (!entry || !projectOpen(entry, passedChapters(ctx.save, ctx.chapters), isDev(ctx.save))) {
    setTimeout(() => { if (alive()) ctx.show("workshop"); }, 0);
    return () => { S.destroyed = true; };
  }
  const title = (entry.title && (entry.title[lang()] || entry.title.ko)) || id;

  root.innerHTML = `<div class="screen lesson project" data-state="loading">
    <header class="lesson-top">
      <button class="icon-btn" id="pj-back" aria-label="${t`공방으로 돌아가기`}">${icon("back")}</button>
      <div class="lesson-progress">${bar(0, entry.steps, "lp-bar", t`프로젝트 진행`)}</div>
      <span class="lesson-tag" id="pj-step"></span>
    </header>
    <main class="lesson-body" id="body">
      <section class="pj-head" id="pj-head" aria-live="polite"></section>
      <div id="pj-write"></div>
    </main>
    <footer class="lesson-foot" id="foot"></footer>
  </div>`;
  const $ = (s) => root.querySelector(s);
  const scr = $(".screen.project");
  const head = $("#pj-head");
  const writeEl = $("#pj-write");
  const foot = $("#foot");
  const setState = (st) => { scr.dataset.state = st; };

  function dropItem() {
    if (S.cleanupItem) { const c = S.cleanupItem; S.cleanupItem = null; try { c(); } catch (e) { console.error(e); } }
    writeEl.innerHTML = "";
    foot.innerHTML = "";
  }
  function paintStep(n) {
    $("#pj-step").textContent = t`${n + 1}/${entry.steps}단계`;
    const pb = $(".lp-bar");
    pb.setAttribute("aria-valuenow", String(n));
    pb.firstElementChild.style.width = `${Math.round((n / entry.steps) * 100)}%`;
  }

  // ---- 불러오기 ----
  async function load() {
    const my = ++S.token;
    const mine = () => alive() && my === S.token;
    dropItem();
    setState("loading");
    $("#pj-step").textContent = "";
    head.innerHTML = `<h1 class="pj-title">${esc(title)}</h1><p class="g-msg" role="status">${t`작품을 불러오는 중…`}</p>`;
    const st = stepState(ctx.save, id, lang());
    if (st.langMismatch) {
      setState("lang");
      const v = await askLang(st);
      if (!mine()) return;
      if (v === "switch") {
        // 언어를 바꾸면 setLanguage가 이 화면을 새로 그린다. 못 바꾸면(인터넷 없음 등) 공방으로
        if (!(await ctx.setLanguage(st.langMismatch)) && mine()) ctx.show("workshop");
        return;
      }
      if (v !== "here") { ctx.show("workshop"); return; }
      ctx.commit(restartInLang(ctx.save, id, lang()));
    }
    let body;
    try {
      body = await ctx.projects.load(id, lang());
    } catch (e) {
      if (!mine()) return;
      console.warn(e);
      setState("failed");
      const stale = !!(e && e.stale) || !!(ctx.swChanged && ctx.swChanged());
      head.innerHTML = `<h1 class="pj-title">${esc(title)}</h1><div class="err-panel soft"><p role="alert">${stale ? t`새 판이 나왔어요. 눌러서 새로 고쳐요` : t`작품을 불러오지 못했어요`}</p>
        <button class="btn primary" id="pj-retry">${stale ? t`새로 고치기` : t`다시 시도`}</button></div>`;
      $("#pj-retry").addEventListener("click", () => (stale ? location.reload() : load()));
      return;
    }
    if (!mine()) return;
    S.body = body;
    showStep();
  }

  // ---- 단계 ----
  function toolHTML(tool) {
    return `<section class="panel pj-tool" aria-labelledby="pj-tool-t"><h2 id="pj-tool-t">${icon("bulb")}<span>${esc(tool.title)}</span></h2>
      <p>${esc(tool.body)}</p>${codeBlock(tool.code || "")}</section>`;
  }
  function showStep() {
    dropItem();
    const body = S.body;
    const st = stepState(ctx.save, id, lang());
    if (st.langMismatch) { load(); return; }   // 그새 다른 언어로 묶임(다른 탭 등)
    S.step = Math.min(st.step, body.steps.length - 1);
    const step = body.steps[S.step];
    const code = st.code || (S.step === 0 ? step.starter || "" : body.steps[S.step - 1].solution || "");
    paintStep(S.step);
    setState("ready");
    head.innerHTML = `<h1 class="pj-title">${esc(title)}</h1>`
      + (S.step === 0 ? riaSays({ outfit: ctx.save.outfit, face: "smile", text: body.intro, size: 56, cls: "small" }) : "")
      + `<p class="goal-line pj-goal">${icon("path")}<span>${esc(t`${S.step + 1}단계`)} · ${esc(step.goal)}</span></p>`
      + (step.tool ? toolHTML(step.tool) : "");
    const item = { type: "write", task: step.task, tests: step.tests, require: step.require, hints: step.hints, solution: step.solution, explain: step.explain, starter: "" };
    S.cleanupItem = mountWrite({
      ctx, item, body: writeEl, foot, initial: { code },
      flushOnDestroy: true,
      // 검토 M3: 단추 글에 XP를 잃는다는 것을, M2: 정답 칸에 「정답을 보면 XP 없음」을
      useSolution: { label: t`모범 코드에서 이어 하기 (이 단계 XP 없음)`, note: t`정답을 보면 이 단계 XP는 없어요`, onUse: (sol) => passed(sol, true, true) },
      onState(w) {
        if (!alive()) return;
        const next = saveDraft(ctx.save, id, lang(), S.step, w.code);
        if (next !== ctx.save) ctx.commit(next);
      },
      // 검토 M2: 정답을 본 뒤의 통과는 모범 코드를 쓴 것과 같이(그 단계 XP 없음)
      onPass({ code: mine, solutionSeen }) { passed(mine, !!solutionSeen); },
      onWrong() {},
      onHint() {},
      log() {},
      showCards: step.tool ? () => dialog({ title: step.tool.title, body: `<p>${esc(step.tool.body)}</p>${codeBlock(step.tool.code || "")}`, buttons: [{ label: t`닫기`, value: true, kind: "primary" }] }) : null,
    });
  }

  async function passed(code, usedSolution, viaButton = false) {
    if (S.busy || !alive() || typeof code !== "string") return;
    S.busy = true;
    const n = S.step;
    const r = passStep(ctx.save, id, lang(), n, code, { usedSolution }, new Date());
    if (r.save === ctx.save) { S.busy = false; showStep(); return; }   // 지금 단계가 아님(다른 곳에서 바뀜): 다시 맞춤
    ctx.commit(r.save);
    dropItem();
    ctx.sound.play(r.completed ? "done" : "correct");
    const say = (text, face) => riaSays({ outfit: ctx.save.outfit, face, text, size: 64 });
    let v;
    if (r.completed) {
      v = await dialog({
        title: t`완성!`,
        body: `<div class="pj-done">${say(S.body.finale, "joy")}
          <p class="g-done-xp">${icon("xp")}<span>${esc(r.xp ? `XP +${r.xp}` : t`이미 완성한 작품이라 XP는 없어요`)}</span></p>
          <p class="pj-shelf-note">${icon("star")}<span>${t`진열장에 놓았어요. 언제든 다시 실행할 수 있어요.`}</span></p></div>`,
        buttons: [{ label: t`한 판 해 보기`, value: "play", kind: "primary" }, { label: t`공방으로`, value: "list" }],
      });
    } else {
      const xpLine = usedSolution ? t`정답을 봤으니 이 단계 XP는 없어요` : r.xp ? `XP +${r.xp}` : t`이미 XP를 받은 단계예요`;
      v = await dialog({
        title: viaButton ? t`모범 코드로 넘어가요` : t`${n + 1}단계 통과!`,
        body: `<div class="pj-pass">${say(S.body.steps[n].explain || ctx.say("correct").text, viaButton ? "smile" : "joy")}
          <p class="g-done-xp">${icon("xp")}<span>${esc(xpLine)}</span></p></div>`,
        buttons: [{ label: t`다음 단계`, value: "next", kind: "primary" }],
      });
    }
    if (!alive()) return;
    S.busy = false;
    if (r.milestone) await celebrate({ outfit: ctx.save.outfit, milestone: r.milestone });
    if (!alive()) return;
    const names = r.newBadges.map((b) => BADGES.find((x) => x.id === b)).filter(Boolean).map((b) => tx(`badge.${b.id}.name`, b.name));
    if (names.length) toast(t`새 배지를 받았어요: ${names.join(", ")}`);
    if (r.completed) { ctx.show(v === "play" ? "play" : "workshop", { id, from: "project" }); return; }
    showStep();
    window.scrollTo(0, 0);
  }

  $("#pj-back").addEventListener("click", () => { if (!document.querySelector(".modal-back")) ctx.show("workshop"); });
  load();

  return () => {
    dropItem();   // 남은 초안을 먼저 저장(flushOnDestroy) — alive()가 아직 참일 때
    S.destroyed = true;
    S.token++;
    document.querySelectorAll(".modal-back").forEach((m) => m.remove());
  };
}
