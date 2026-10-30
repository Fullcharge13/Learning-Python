// 홈(학습 길): 상태 줄, 리아 인사와 이어 하기, 복습, 오늘의 퀘스트, 뱀처럼 이어지는 레슨 길
import { QUESTS } from "../../data/quests.js";
import { CONCEPTS } from "../../data/concepts.js";
import { riaSVG } from "../ria.js";
import { esc, icon, bar, riaSays, dialog, toast } from "./dom.js";
import { tabBar, bindTabs, statusBar } from "./nav.js";

const ROW = 112;          // 레슨 한 칸 높이
const W = 320;            // 길 폭
const NODE = 68;
const OFF = [0, 62, 88, 62, 0, -62, -88, -62];

function questCard(save) {
  const q = save.quests;
  const rows = (q.ids || []).map((id) => {
    const def = QUESTS.find((x) => x.id === id);
    if (!def) return "";
    const p = Math.min(def.goal, Math.max(0, (q.progress || {})[id] || 0));
    const done = (q.done || []).includes(id);
    return `<li class="quest${done ? " done" : ""}">
      <span class="q-ic">${icon(done ? "check" : "star")}</span>
      <div class="q-main">
        <span class="q-name">${esc(def.name)}${done ? '<span class="sr"> (완료)</span>' : ""}</span>
        ${bar(p, def.goal, "q-bar", def.name)}
      </div>
      <span class="q-num">${p}/${def.goal}</span>
      <span class="q-reward" aria-label="보상 ${def.reward}바이트">+${def.reward}</span>
    </li>`;
  }).join("");
  const opened = !!q.chest;
  return `<section class="panel quests" aria-labelledby="q-title">
    <h2 id="q-title">오늘의 퀘스트</h2>
    <ul class="quest-list">${rows}</ul>
    <p class="chest${opened ? " open" : ""}">${icon(opened ? "chestOpen" : "chest")}
      <span>${opened ? "보물상자를 열었어요 (+10바이트)" : "3개를 모두 끝내면 보물상자 +10바이트"}</span></p>
  </section>`;
}

function reviewCard(save) {
  const queue = save.review_queue || [];
  if (!queue.length) return "";
  const names = queue.slice(0, 3).map((c) => (CONCEPTS.find((x) => x.id === c) || { name: c }).name);
  return `<section class="panel review">
    <div class="review-text">
      <h2>복습할 개념 ${queue.length}개</h2>
      <p>${esc(names.join(", "))}${queue.length > 3 ? " 외" : ""}</p>
    </div>
    <button class="btn sun" id="review">${icon("review")}복습 5문제</button>
  </section>`;
}

function pathSection(ctx, chapter, startIndex, currentId) {
  const lessons = chapter.lessons;
  const H = lessons.length * ROW;
  const pts = lessons.map((l, i) => ({ x: W / 2 + OFF[(startIndex + i) % OFF.length], y: i * ROW + NODE / 2 + 6 }));
  const seg = (a, b) => `C ${a.x} ${a.y + ROW / 2} ${b.x} ${b.y - ROW / 2} ${b.x} ${b.y}`;
  let full = `M ${pts[0].x} ${pts[0].y - 30} L ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) full += " " + seg(pts[i - 1], pts[i]);
  // 끝낸 레슨까지(그리고 지금 레슨까지) 이어진 부분
  let reach = -1;
  lessons.forEach((l, i) => { const st = ctx.lessonState(l.id); if (st === "done" || st === "perfect" || l.id === currentId) reach = i; });
  let doneD = "";
  if (reach >= 0) {
    doneD = `M ${pts[0].x} ${pts[0].y - 30} L ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i <= reach; i++) doneD += " " + seg(pts[i - 1], pts[i]);
  }
  const nodes = lessons.map((l, i) => {
    const st = ctx.lessonState(l.id);
    const cur = l.id === currentId && st === "open";
    const p = pts[i];
    const glyph = st === "locked" ? icon("lock") : st === "perfect" ? icon("star", "fill") : st === "done" ? icon("check") : `<b>${esc(l.id)}</b>`;
    const stateKo = { locked: "잠김", open: cur ? "지금 할 레슨" : "열림", done: "완료", perfect: "실수 없이 완료" }[st];
    const side = p.x > W / 2 ? "left" : "right";
    return `<div class="node-wrap" style="left:${p.x - NODE / 2}px;top:${p.y - NODE / 2}px">
      <button class="node ${st}${cur ? " current" : ""}" data-lesson="${esc(l.id)}" aria-label="${esc(`${l.id} ${l.title}, ${stateKo}`)}">${glyph}</button>
      <span class="node-label">${l.isExam && !/평가/.test(l.title) ? '<em>장 평가</em>' : ""}${esc(l.title)}</span>
      ${cur ? `<span class="node-ria ${side}" aria-hidden="true">${riaSVG({ outfit: ctx.save.outfit, face: "cheer", size: 58 })}</span>` : ""}
    </div>`;
  }).join("");
  return `<section class="chapter" aria-label="${esc(`${chapter.id}장 ${chapter.title}`)}">
    <h2 class="chapter-title"><span class="ch-no">${chapter.id}장</span>${esc(chapter.title)}</h2>
    <div class="path" style="width:${W}px;height:${H}px">
      <svg class="snake" viewBox="0 ${-30} ${W} ${H + 30}" width="${W}" height="${H + 30}" aria-hidden="true">
        <path d="${full}" class="snake-bed"/>
        ${doneD ? `<path d="${doneD}" class="snake-body"/><path d="${doneD}" class="snake-scales"/>` : ""}
      </svg>
      ${nodes}
    </div>
  </section>`;
}

export function render(root, ctx) {
  const save = ctx.save;
  const currentId = ctx.currentLessonId();
  const cur = currentId ? ctx.lessonById(currentId) : null;
  const special = ctx.takeGreeting();
  const line = ctx.say(special || "greet");
  const allDone = ctx.lessons.length > 0 && ctx.lessons.every((l) => save.completed_lessons.includes(l.id));
  let start = 0;
  const sections = ctx.chapters.map((c) => { const html = pathSection(ctx, c, start, currentId); start += c.lessons.length; return html; }).join("");
  root.innerHTML = `<div class="screen home with-tabs">
    ${statusBar(save)}
    <main>
      <h1 class="sr">학습 길</h1>
      <section class="hello">
        ${riaSays({ outfit: save.outfit, face: line.face, text: line.text, size: 92 })}
        ${cur && !allDone ? `<button class="btn primary wide" id="continue">${icon("play")}<span>${save.completed_lessons.length ? "이어서 하기" : "첫 레슨 시작"} · ${esc(cur.id)} ${esc(cur.title)}</span></button>` : ""}
        ${allDone ? `<p class="all-done">준비된 레슨을 모두 끝냈어요. 다시 풀거나 복습하며 XP를 모아 봐요.</p>` : ""}
      </section>
      ${reviewCard(save)}
      ${questCard(save)}
      ${sections || '<p class="panel">레슨을 불러오지 못했어요. 새로고침해 주세요.</p>'}
      <p class="path-end">다음 장은 준비 중이에요</p>
    </main>
    ${tabBar("home")}
  </div>`;
  bindTabs(root, ctx);
  const go = root.querySelector("#continue");
  if (go) go.addEventListener("click", () => ctx.show("lesson", { id: currentId }));
  const rv = root.querySelector("#review");
  if (rv) rv.addEventListener("click", () => ctx.show("lesson", { review: true }));
  root.querySelectorAll("[data-lesson]").forEach((b) => b.addEventListener("click", async () => {
    const id = b.dataset.lesson;
    const st = ctx.lessonState(id);
    if (st === "locked") { toast("앞 레슨을 끝내면 열려요."); return; }
    if (st === "done" || st === "perfect") {
      const l = ctx.lessonById(id);
      const ok = await dialog({
        title: `${id} ${l.title} 다시 하기`,
        body: `<p>끝낸 레슨도 다시 풀 수 있어요. 다시 하기는 XP만 조금 받고 바이트는 없어요.</p>`,
        buttons: [{ label: "그만두기", value: false }, { label: "다시 풀기", value: true, kind: "primary" }],
      });
      if (!ok) return;
    }
    ctx.show("lesson", { id });
  }));
  // 지금 레슨이 화면 안에 오게
  const curNode = root.querySelector(".node.current");
  if (curNode && ctx.save.completed_lessons.length > 2) curNode.scrollIntoView({ block: "center" });
}
