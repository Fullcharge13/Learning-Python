// 아래 탭 줄과 위 상태 줄 (홈·배지·의상실·설정에서 같이 씀)
import { icon, esc, bar } from "./dom.js";
import { localDate } from "../today.js";

const TABS = [
  ["home", "학습", "path"],
  ["badges", "배지", "badge"],
  ["closet", "의상실", "hanger"],
  ["settings", "설정", "gear"],
];

export function tabBar(active) {
  return `<nav class="tabbar" aria-label="화면 이동">${TABS.map(([id, label, ic]) =>
    `<button class="tab${id === active ? " on" : ""}" data-go="${id}"${id === active ? ' aria-current="page"' : ""}>${icon(ic)}<span>${esc(label)}</span></button>`).join("")}</nav>`;
}

export function bindTabs(root, ctx) {
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => {
    if (b.getAttribute("aria-current") === "page") return;
    ctx.show(b.dataset.go);
  }));
}

/** 연속 기록·바이트·XP와 오늘 목표 */
export function statusBar(save) {
  const goal = [10, 20, 30].includes(save.settings.dailyGoal) ? save.settings.dailyGoal : 20;
  const todayXp = save.streak.todayDate === localToday() ? Math.max(0, save.streak.todayXp || 0) : 0;
  const met = todayXp >= goal;
  return `<header class="status">
    <div class="stats-row">
      <span class="stat flame${save.streak.days > 0 ? " lit" : ""}"><span aria-hidden="true" class="stat-in">${icon("flame")}<b>${save.streak.days}</b><small>일</small></span><span class="sr">연속 기록 ${save.streak.days}일</span></span>
      <span class="stat byte"><span aria-hidden="true" class="stat-in">${icon("byte")}<b>${Math.max(0, save.bytes)}</b><small>바이트</small></span><span class="sr">바이트 ${Math.max(0, save.bytes)}</span></span>
      <span class="stat xp"><span aria-hidden="true" class="stat-in">${icon("xp")}<b>${Math.max(0, save.xp)}</b><small>XP</small></span><span class="sr">XP ${Math.max(0, save.xp)}</span></span>
    </div>
    <div class="goal${met ? " met" : ""}">
      <span class="goal-label">${met ? "오늘 목표 달성" : "오늘 목표"} <b>${Math.min(todayXp, 999)}/${goal} XP</b></span>
      ${bar(todayXp, goal, "goal-bar", "오늘 목표 XP")}
    </div>
  </header>`;
}

function localToday() { return localDate(); }
