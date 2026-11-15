// v0.21.0 「프로젝트 공방」 목록·진열장 화면 + 홈의 공방 카드 (설계 docs/specs/2026-11-15-프로젝트-공방-설계.md §4-4)
// 목록·진열장은 색인(ctx.projects.index)과 저장(save.projects)만 본다. 본문은 프로젝트 화면(project.js)·주고받기(console.js)가 받는다.
// 이 화면은 #app에 묶음을 달지 않는다(단추마다 단다 — 화면을 바꾸면 요소째 사라짐). 창을 기다린 뒤에는 떠났는지 본다.
import { isDev } from "../devgate.js";
import { passedChapters } from "../garden/state.js";
import { cleanProjects, projectOpen } from "../projects/state.js";
import { esc, icon, dialog, riaSays, toast } from "./dom.js";
import { t, lang, tp } from "../i18n.js";

let workshopGen = 0;

const nameOf = (e) => (e.title && (e.title[lang()] || e.title.ko)) || e.id;
const blurbOf = (e) => (e.blurb && (e.blurb[lang()] || e.blurb.ko)) || "";

/** 프로젝트마다 지금 상태: locked | new | progress | done (+ 진행 중 단계 step) */
export function workshopRows(ctx) {
  const index = (ctx.projects && ctx.projects.index) || [];
  const passed = passedChapters(ctx.save, ctx.chapters);
  const dev = isDev(ctx.save);
  const p = cleanProjects(ctx.save.projects);
  return index.map((e) => {
    const open = p.open[e.id];
    const state = !projectOpen(e, passed, dev) ? "locked" : p.done[e.id] ? "done" : open ? "progress" : "new";
    return { entry: e, state, step: open ? open.step : 0, done: p.done[e.id] || null };
  });
}

/** 홈 카드: 3장 전에는 잠김 글만(누를 곳 없음), 열리면 「들어가기」 */
export function workshopCard(ctx) {
  const rows = workshopRows(ctx);
  if (!rows.length) return "";
  const first = Math.min(...rows.map((r) => r.entry.need));
  if (rows.every((r) => r.state === "locked")) {
    return `<section class="panel workshop-card locked" aria-labelledby="wsc-title">
      <span class="wsc-ic" aria-hidden="true">${icon("lock")}</span>
      <div class="wsc-text"><h2 id="wsc-title">${t`프로젝트 공방`}</h2><p>${esc(t`${first}장을 끝내면 첫 프로젝트가 열려요`)}</p></div>
    </section>`;
  }
  const done = rows.filter((r) => r.state === "done").length;
  const cur = rows.find((r) => r.state === "progress");
  const note = esc(cur ? t`만드는 중: ${nameOf(cur.entry)} ${cur.step + 1}/${cur.entry.steps}단계` : t`완성한 작품 ${done}/${rows.length}`);
  return `<section class="panel workshop-card" aria-labelledby="wsc-title">
    <span class="wsc-ic" aria-hidden="true">${icon("code")}</span>
    <div class="wsc-text"><h2 id="wsc-title">${t`프로젝트 공방`}</h2><p>${note}</p></div>
    <button class="btn primary wsc-go" id="workshop">${t`들어가기`}</button>
  </section>`;
}

export function bindWorkshopCard(root, ctx) {
  const b = root.querySelector("#workshop");
  if (b) b.addEventListener("click", () => ctx.show("workshop"));
}

function stateText(r) {
  if (r.state === "locked") return `${icon("lock")}<span>${esc(t`${r.entry.need}장을 끝내면 열려요`)}</span>`;
  if (r.state === "done") return `${icon("check")}<span>${t`완성`}</span>`;
  if (r.state === "progress") return `<span>${esc(t`만드는 중 ${r.step + 1}/${r.entry.steps}단계`)}</span>`;
  return `<span>${esc(t`새 작품 · ${r.entry.steps}단계`)}</span>`;
}

export function render(root, ctx) {
  const gen = ++workshopGen;
  const S = { destroyed: false };
  const alive = () => !S.destroyed && gen === workshopGen;
  const rows = workshopRows(ctx);
  const shelf = rows.filter((r) => r.done);
  root.innerHTML = `<div class="screen workshop">
    <header class="g-top ws-top">
      <button class="icon-btn" id="ws-back" aria-label="${t`돌아가기`}">${icon("back")}</button>
      <h1>${t`프로젝트 공방`}</h1><span></span>
    </header>
    <main class="g-main ws-main">
      ${riaSays({ outfit: ctx.save.outfit, face: "cheer", size: 64, cls: "small", text: t`배운 것으로 진짜 프로그램을 만들어 봐요! 한 단계씩 코드를 더하면 작품이 완성돼요.` })}
      <section class="panel ws-panel" aria-labelledby="ws-list-t">
        <h2 id="ws-list-t">${icon("code")}<span>${t`작품 목록`}</span></h2>
        <ul class="ws-list">${rows.map((r) => `<li><button class="ws-item ${r.state}" data-id="${esc(r.entry.id)}">
          <span class="ws-ic" aria-hidden="true">${icon(r.state === "locked" ? "lock" : r.entry.icon)}</span>
          <span class="ws-text"><b class="ws-name">${esc(nameOf(r.entry))}</b><small class="ws-blurb">${esc(blurbOf(r.entry))}</small>
          <small class="ws-state">${stateText(r)}</small></span></button></li>`).join("")}</ul>
      </section>
      <section class="panel ws-shelf" aria-labelledby="ws-shelf-t">
        <h2 id="ws-shelf-t">${icon("star")}<span>${t`진열장`}</span></h2>
        ${shelf.length ? `<ul class="ws-shelf-list">${shelf.map((r) => `<li class="ws-shelf-item">
            <span class="ws-ic" aria-hidden="true">${icon(r.entry.icon)}</span>
            <span class="ws-text"><b class="ws-name">${esc(nameOf(r.entry))}</b><small class="ws-blurb">${esc(blurbOf(r.entry))}</small></span>
            <button class="btn sun small ws-play" data-id="${esc(r.entry.id)}" aria-label="${esc(t`${nameOf(r.entry)} 실행`)}">${icon("play")}<span>${t`실행`}</span></button>
          </li>`).join("")}</ul>`
          : `<p class="muted ws-empty">${t`아직 완성한 작품이 없어요. 첫 작품을 만들면 여기에 놓여요.`}</p>`}
      </section>
    </main>
  </div>`;

  root.querySelector("#ws-back").addEventListener("click", () => ctx.show("home"));
  root.querySelectorAll(".ws-play").forEach((b) => b.addEventListener("click", () => ctx.show("play", { id: b.dataset.id })));
  root.querySelectorAll(".ws-item").forEach((b) => b.addEventListener("click", async () => {
    const r = rows.find((x) => x.entry.id === b.dataset.id);
    if (!r || document.querySelector(".modal-back")) return;
    if (r.state === "locked") { toast(t`${r.entry.need}장을 끝내면 열려요`); return; }
    if (r.state !== "done") { ctx.show("project", { id: r.entry.id }); return; }
    // 완성한 작품: 한 판 하기 또는 처음부터 다시 만들기(다시 만들면 XP는 없고 진열장 코드만 바뀜)
    const v = await dialog({
      title: nameOf(r.entry),
      body: `<p>${t`완성한 작품이에요. 한 판 할까요, 처음부터 다시 만들어 볼까요? 다시 만들면 XP는 없고 진열장 코드만 새것으로 바뀌어요.`}</p>`,
      buttons: [{ label: t`한 판 하기`, value: "play", kind: "primary" }, { label: t`다시 만들기`, value: "remake" }, { label: tp("cancel", "그만두기"), value: null }],
    });
    if (!alive() || !v) return;
    ctx.show(v === "play" ? "play" : "project", { id: r.entry.id });
  }));

  return () => {
    S.destroyed = true;
    document.querySelectorAll(".modal-back").forEach((m) => m.remove());
  };
}
