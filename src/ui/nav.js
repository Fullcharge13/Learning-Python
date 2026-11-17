// 아래 탭 줄과 위 상태 줄 (홈·배지·의상실·설정에서 같이 씀)
import { isDev } from "../devgate.js";
import { icon, esc, bar, toast } from "./dom.js";
import { localDate } from "../today.js";
import { gardenTab, passedChapters } from "../garden/state.js";
import { guardNews } from "../guard/state.js";
import { t, tp } from "../i18n.js";
import { levelProgress } from "../levels.js";
import { levelName } from "./levelline.js";

// v0.12.5: 「텃밭」 칸(학습과 배지 사이). 텃밭 화면 안에서는 탭 줄을 그리지 않는다(레슨처럼 몰입 화면)
// 이름은 그릴 때마다 지금 언어로
const TABS = () => [
  ["home", t`학습`, "path"],
  ["garden", t`텃밭`, "sprout"],
  ["badges", t`배지`, "badge"],
  ["closet", t`의상실`, "hanger"],
  ["settings", t`설정`, "gear"],
];

/** 텃밭 칸 상태: "locked" | "news" | "open" */
export function gardenTabOf(ctx) {
  const passed = passedChapters(ctx.save, ctx.chapters);
  const tab = gardenTab(ctx.save.garden, passed);
  // v0.15: 경비실 새 사건도 같은 칸의 점으로 알린다(잠김이면 그대로)
  return tab === "open" && guardNews(ctx.save.guard, passed, isDev(ctx.save)) ? "news" : tab;
}

export function tabBar(active, garden = "open") {
  return `<nav class="tabbar" aria-label="${esc(t`화면 이동`)}">${TABS().map(([id, label, ic]) => {
    const g = id === "garden" ? garden : "open";
    const aria = g === "locked" ? ` aria-label="${esc(t`${label}, 잠김, 1장을 끝내면 열려요`)}" data-locked="1"`
      : g === "news" ? ` aria-label="${esc(t`${label}, 새 소식 있음`)}"` : "";
    const badge = g === "locked" ? `<span class="tab-lock" aria-hidden="true">${icon("lock")}</span>`
      : g === "news" ? '<span class="tab-dot" aria-hidden="true"></span>' : "";
    return `<button class="tab${id === active ? " on" : ""}${g === "locked" ? " locked" : ""}" data-go="${id}"${aria}${id === active ? ' aria-current="page"' : ""}><span class="tab-ic">${icon(ic)}${badge}</span><span>${esc(label)}</span></button>`;
  }).join("")}</nav>`;
}

export function bindTabs(root, ctx) {
  const here = root.querySelector('.tabbar [aria-current="page"]')?.dataset.go || "home";
  root.querySelectorAll(".tabbar [data-go]").forEach((b) => b.addEventListener("click", () => {
    if (b.getAttribute("aria-current") === "page") return;
    if (b.dataset.locked) { toast(t`텃밭은 1장을 끝내면 열려요.`); return; }
    ctx.show(b.dataset.go, b.dataset.go === "garden" ? { from: here } : {});
  }));
}

/** 연속 기록·바이트·XP와 오늘 목표 */
export function statusBar(save) {
  const goal = [10, 20, 30].includes(save.settings.dailyGoal) ? save.settings.dailyGoal : 20;
  const todayXp = save.streak.todayDate === localToday() ? Math.max(0, save.streak.todayXp || 0) : 0;
  const met = todayXp >= goal;
  return `<header class="status">
    <div class="stats-row">
      <span class="stat flame${save.streak.days > 0 ? " lit" : ""}"><span aria-hidden="true" class="stat-in">${icon("flame")}<b>${save.streak.days}</b><small>${tp("unit-day", "일", save.streak.days)}</small></span><span class="sr">${t`연속 기록 ${save.streak.days}일`}</span></span>
      <span class="stat byte"><span aria-hidden="true" class="stat-in">${icon("byte")}<b>${Math.max(0, save.bytes)}</b><small>${t`바이트`}</small></span><span class="sr">${t`바이트 ${Math.max(0, save.bytes)}`}</span></span>
      <span class="stat xp"><span aria-hidden="true" class="stat-in">${icon("xp")}<b>${Math.max(0, save.xp)}</b><small>XP</small></span><span class="sr">XP ${Math.max(0, save.xp)}</span></span>
    </div>
    <div class="goal with-lv${met ? " met" : ""}">
      <span class="goal-label">${met ? t`오늘 목표 달성` : t`오늘 목표`} <b>${Math.min(todayXp, 999)}/${goal} XP</b></span>
      ${bar(todayXp, goal, "goal-bar", t`오늘 목표 XP`)}
      ${levelStat(save)}
    </div>
  </header>`;
}

// v0.22.0(설계 §5-3): XP 바로 아래(목표 줄 끝)에 「Lv 7」과 다음 레벨까지의 막대. 최고 레벨이면 막대가 다 참
function levelStat(save) {
  const p = levelProgress(save.xp);
  const name = levelName(p.level);
  const top = p.need === 0;
  const sr = top ? t`레벨 ${p.level} ${name}, 가장 높은 레벨` : t`레벨 ${p.level} ${name}, 다음 레벨까지 ${p.need - p.into} XP`;
  return `<span class="stat lv"><span aria-hidden="true" class="stat-in"><b>Lv ${p.level}</b>${bar(top ? 1 : p.into, top ? 1 : p.need, "lv-bar")}</span><span class="sr">${esc(sr)}</span></span>`;
}

function localToday() { return localDate(); }
