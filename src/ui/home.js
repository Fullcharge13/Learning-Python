// 홈(학습 길): 상태 줄, 리아 인사와 이어 하기, 복습, 오늘의 퀘스트, 뱀처럼 이어지는 레슨 길
import { QUESTS } from "../../data/quests.js";
import { CONCEPTS } from "../../data/concepts.js";
import { riaSVG } from "../ria.js";
import { esc, icon, bar, riaSays, dialog, toast } from "./dom.js";
import { tabBar, bindTabs, statusBar } from "./nav.js";
import { pathEndText } from "../curriculum.js";
import { hasNewContent } from "../newcontent.js";

// 「새 내용」 점(v0.7.1): 노드 옆 작은 꼬리표. 누르기는 노드가 받는다(pointer-events: none, 노드 크기 그대로)
const NEW_LABEL = "새 내용 있음";
const newDot = (id, cls = "") => `<span class="new-dot${cls}" role="img" aria-label="${NEW_LABEL}" data-for="${esc(id)}">새 내용</span>`;

const ROW = 112;          // 레슨 한 칸 높이
const W = 320;            // 길 폭
const NODE = 68;
const OFF = [0, 62, 88, 62, 0, -62, -88, -62];
// 심화 가지(v0.7): 장 평가 노드 아래로 갈라지는 별 노드 3개
const BR = 124;           // 가지가 차지하는 높이(장 아래에 더함)
const STAR = 52;          // 별 노드 크기(터치 44px 이상)
const STAR_GAP = 66;      // 별 노드 사이(중심 간격)
const BR_DY = 150;        // 장 평가 노드 중심 → 별 줄 중심

/** 별 모양(채움·테두리는 CSS가 상태별로) + 가운데 번호 */
function starGlyph(k, st) {
  return `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" class="star-svg">
    <path d="M24 3.5l6.1 12.6 13.9 1.9-10.1 9.7 2.5 13.8L24 34.9 11.6 41.5l2.5-13.8L4 18l13.9-1.9z" class="star-shape"/>
    ${st === "locked" ? `<g class="star-lock" transform="translate(16.5 17)"><rect x="1" y="6" width="13" height="9.5" rx="2"/><path d="M4 6V4.2a3.5 3.5 0 0 1 7 0V6"/></g>`
      : `<text x="24" y="31" text-anchor="middle" class="star-no">${k}</text>`}
  </svg>`;
}

/** 장 평가 노드(ex, ey) 아래 심화 가지: 이어 주는 점선(SVG 안)과 별 노드들(HTML) */
function advBranch(ctx, chapter, ex, ey) {
  const adv = chapter.advanced || [];
  if (!adv.length) return { links: "", nodes: "" };
  const span = (adv.length - 1) * STAR_GAP;
  const cx = Math.min(Math.max(ex, span / 2 + STAR / 2 + 8), W - span / 2 - STAR / 2 - 8);
  const sy = ey + BR_DY;
  const states = adv.map((l) => ctx.lessonState(l.id));
  const opened = states.some((st) => st !== "locked");
  const doneN = states.filter((st) => st === "done" || st === "perfect").length;
  const links = adv.map((l, i) => {
    const x = cx - span / 2 + i * STAR_GAP;
    return `<path d="M ${ex} ${ey} C ${ex} ${ey + 70} ${x} ${sy - 80} ${x} ${sy - STAR / 2}" class="adv-link${opened ? " open" : ""}"/>`;
  }).join("");
  const stars = adv.map((l, i) => {
    const st = states[i];
    const k = String(l.id).split("-A")[1] || String(i + 1);
    const x = cx - span / 2 + i * STAR_GAP;
    const stateKo = { locked: "잠김, 장 평가를 통과하면 열려요", open: "열림", done: "완료", perfect: "실수 없이 완료" }[st];
    const fresh = hasNewContent(l, ctx.save);
    return `<button class="star-node ${st}" style="left:${x - STAR / 2}px;top:${sy - STAR / 2}px" data-lesson="${esc(l.id)}"
      aria-label="${esc(`심화 ${l.id} ${l.title}, ${stateKo}${fresh ? `, ${NEW_LABEL}` : ""}`)}">${starGlyph(k, st)}</button>${fresh
      ? `<span class="new-dot-at" style="left:${x + STAR / 2 - 14}px;top:${sy - STAR / 2 - 10}px">${newDot(l.id, " star")}</span>` : ""}`;
  }).join("");
  const cap = `<span class="adv-cap${opened ? " open" : ""}" style="top:${sy + STAR / 2 + 6}px">심화 ${doneN}/${adv.length}${opened ? "" : " · 장 평가 뒤 열림"}</span>`;
  return { links, nodes: stars + cap };
}

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
  const hasAdv = (chapter.advanced || []).length > 0;
  const H = lessons.length * ROW + (hasAdv ? BR : 0);
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
    const fresh = hasNewContent(l, ctx.save);
    return `<div class="node-wrap" style="left:${p.x - NODE / 2}px;top:${p.y - NODE / 2}px">
      <button class="node ${st}${cur ? " current" : ""}" data-lesson="${esc(l.id)}" aria-label="${esc(`${l.id} ${l.title}, ${stateKo}${fresh ? `, ${NEW_LABEL}` : ""}`)}">${glyph}</button>
      ${fresh ? newDot(l.id) : ""}
      <span class="node-label">${l.isExam && !/평가/.test(l.title) ? '<em>장 평가</em>' : ""}${esc(l.title)}</span>
      ${cur ? `<span class="node-ria ${side}" aria-hidden="true">${riaSVG({ outfit: ctx.save.outfit, face: "cheer", size: 58 })}</span>` : ""}
    </div>`;
  }).join("");
  const last = pts[pts.length - 1];
  const br = hasAdv ? advBranch(ctx, chapter, last.x, last.y) : { links: "", nodes: "" };
  const advAll = hasAdv && chapter.advanced.every((l) => ["done", "perfect"].includes(ctx.lessonState(l.id)));
  return `<section class="chapter" aria-label="${esc(`${chapter.id}장 ${chapter.title}`)}">
    <h2 class="chapter-title"><span class="ch-no">${chapter.id}장</span>${esc(chapter.title)}${advAll ? `<span class="ch-star" title="심화 모두 완료">${icon("star", "fill")}<span class="sr">심화 모두 완료</span></span>` : ""}</h2>
    <div class="path" style="width:${W}px;height:${H}px">
      <svg class="snake" viewBox="0 ${-30} ${W} ${H + 30}" width="${W}" height="${H + 30}" aria-hidden="true">
        ${br.links}
        <path d="${full}" class="snake-bed"/>
        ${doneD ? `<path d="${doneD}" class="snake-body"/><path d="${doneD}" class="snake-scales"/>` : ""}
      </svg>
      ${nodes}
      ${br.nodes}
    </div>
  </section>`;
}

export function render(root, ctx) {
  const save = ctx.save;
  const currentId = ctx.currentLessonId();
  const cur = currentId ? ctx.lessonById(currentId) : null;
  const notice = ctx.takeNotice ? ctx.takeNotice() : null; // 환불 안내가 있으면 그날 인사보다 먼저(판정 C42)
  const special = notice ? null : ctx.takeGreeting();
  const line = notice || ctx.say(special || "greet");
  const allDone = ctx.lessons.length > 0 && ctx.lessons.every((l) => save.completed_lessons.includes(l.id));
  let start = 0;
  const sections = ctx.chapters.map((c) => { const html = pathSection(ctx, c, start, currentId); start += c.lessons.length; return html; }).join("");
  root.innerHTML = `<div class="screen home with-tabs">
    ${statusBar(save)}
    <main>
      <h1 class="sr">학습 길</h1>
      <section class="hello">
        ${riaSays({ outfit: save.outfit, face: line.face, text: line.text, size: 92, cls: notice ? "refund-notice" : "" })}
        ${cur && !allDone ? `<button class="btn primary wide" id="continue">${icon("play")}<span>${save.completed_lessons.length ? "이어서 하기" : "첫 레슨 시작"} · ${esc(cur.id)} ${esc(cur.title)}</span></button>` : ""}
        ${allDone ? `<p class="all-done">준비된 레슨을 모두 끝냈어요. 다시 풀거나 복습하며 XP를 모아 봐요.</p>` : ""}
      </section>
      ${reviewCard(save)}
      ${questCard(save)}
      ${sections || '<p class="panel">레슨을 불러오지 못했어요. 새로고침해 주세요.</p>'}
      <p class="path-end">${esc(pathEndText({ chapters: ctx.chapters, completed: save.completed_lessons }))}</p>
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
    if (st === "locked") { toast(b.classList.contains("star-node") ? "장 평가를 통과하면 심화 레슨이 열려요." : "앞 레슨을 끝내면 열려요."); return; }
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
