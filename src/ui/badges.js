// 배지 진열장 + 학습 통계
import { BADGES } from "../../data/badges.js";
import { CONCEPTS } from "../../data/concepts.js";
import { esc } from "./dom.js";
import { tabBar, bindTabs, gardenTabOf, statusBar } from "./nav.js";
import { t, tx, tp } from "../i18n.js";
import { basicIndex, fieldIndex } from "../guard/state.js";

// 글자가 말인 배지 그림은 함수(그릴 때 지금 언어로)
const ART = {
  first_print: ["teal", ">_"], ch1: ["teal", () => t`1장`], ch2: ["teal", () => t`2장`], ch3: ["teal", () => t`3장`],
  streak7: ["coral", () => t`7일`], streak30: ["coral", () => t`30일`], streak100: ["coral", "100"],
  fixer: ["navy", "fix"], hintfree10: ["navy", "10"], perfectionist: ["sun", "★"],
  reviewer: ["navy", "30"], collector: ["sun", () => t`3벌`], night_owl: ["navy", "☾"],
  advanced1: ["teal", "A+"], advancedAll: ["sun", "A★"],   // v0.7 심화
  guard_first: ["teal", "✓"], guard_perfect: ["sun", () => { const n = basicIndex().length; return `${n}/${n}`; }],   // v0.15 경비실(v0.16: 색인 수, v0.20: 기본 수, 예 45/45)
  guard_files: ["teal", () => { const n = fieldIndex().length; return `${n}/${n}`; }],   // v0.20.0 응용 사건 파일
};
const COL = { teal: ["#1F9E93", "#12756D"], coral: ["#F08A5D", "#C4512F"], navy: ["#3C5170", "#1F2B3D"], sun: ["#FFD43B", "#C99A00"] };

/** 코드로 그린 배지. 얻기 전에는 회색 실루엣 */
export function badgeArt(id, earned, size = 64) {
  const [c, g] = Object.hasOwn(ART, id) ? ART[id] : ["navy", "?"];   // 가져온 저장의 배지 id가 "constructor" 같은 글자여도
  const glyph = typeof g === "function" ? g() : g;
  const [fill, edge] = earned ? COL[c] : ["#E4DCCB", "#C9BEA6"];
  const ink = earned ? (c === "sun" ? "#3A2E00" : "#FFFFFF") : "#9A8F78";
  const fs = glyph.length >= 5 ? 12 : glyph.length >= 3 ? 15 : glyph.length === 2 ? 17 : 22;   // 「45/45」는 안쪽 원에 들게 작게
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" class="badge-art${earned ? "" : " locked"}">
    <path d="M20 40 L14 60 L24 55 L28 62 L32 44 Z M44 40 L50 60 L40 55 L36 62 L32 44 Z" fill="${edge}" opacity="${earned ? 1 : 0.6}"/>
    <path d="M32 3 L39 7.5 L47.5 7.5 L51 15 L57.5 20.5 L55.5 29 L58 37 L51.5 42.5 L48.5 50.5 L40 50.5 L32 55 L24 50.5 L15.5 50.5 L12.5 42.5 L6 37 L8.5 29 L6.5 20.5 L13 15 L16.5 7.5 L25 7.5 Z" fill="${fill}" stroke="${edge}" stroke-width="2.5" stroke-linejoin="round" ${earned ? "" : 'stroke-dasharray="4 3"'}/>
    <circle cx="32" cy="29" r="17" fill="none" stroke="${earned ? "rgba(255,255,255,.55)" : "#D3C8B0"}" stroke-width="1.5"/>
    <text x="32" y="${29 + fs * 0.36}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-weight="700" font-size="${fs}" fill="${ink}">${esc(glyph)}</text>
  </svg>`;
}

export function render(root, ctx) {
  const s = ctx.save;
  const have = new Set(s.badges || []);
  const st = s.stats || {};
  const weak = Object.entries(s.weak_concepts || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const n = (v) => Math.max(0, Number(v) || 0);
  // 본 과정과 심화(v0.7)는 따로 센다
  const doneSet = new Set(s.completed_lessons || []);
  const mainDone = ctx.lessons.filter((l) => doneSet.has(l.id)).length;
  const advIds = ctx.advancedIds ? ctx.advancedIds() : [];
  const advTotal = advIds.length;
  const advDone = advIds.filter((id) => doneSet.has(id)).length;
  root.innerHTML = `<div class="screen badges with-tabs">
    ${statusBar(s)}
    <main>
      <h1 class="page-title">${t`배지`} <small>${have.size}/${BADGES.length}</small></h1>
      <ul class="badge-grid">${BADGES.map((b) => {
        const e = have.has(b.id);
        return `<li class="badge${e ? " earned" : ""}">
          ${badgeArt(b.id, e)}
          <span class="b-name">${esc(tx(`badge.${b.id}.name`, b.name))}</span>
          <span class="b-desc">${e ? t`얻었어요` : esc(tx(`badge.${b.id}.desc`, b.desc))}</span>
        </li>`;
      }).join("")}</ul>
      <section class="panel">
        <h2>${t`학습 기록`}</h2>
        <dl class="stat-grid">
          <div><dt>${t`끝낸 레슨`}</dt><dd>${n(mainDone)}<small>/${ctx.lessons.length}</small></dd></div>
          ${advTotal ? `<div><dt>${t`끝낸 심화`}</dt><dd>${n(advDone)}<small>/${advTotal}</small></dd></div>` : ""}
          <div><dt>${t`맞힌 문제`}</dt><dd>${n(st.items)}</dd></div>
          <div><dt>${t`실수 없는 레슨`}</dt><dd>${n(st.perfect)}</dd></div>
          <div><dt>${t`힌트 없이 통과`}</dt><dd>${n(st.hintfree)}</dd></div>
          <div><dt>${t`오류 고쳐 통과`}</dt><dd>${n(st.fixed)}</dd></div>
          <div><dt>${t`복습 문제`}</dt><dd>${n(st.review_items)}</dd></div>
          <div><dt>${t`최고 연속 기록`}</dt><dd>${n(s.streak.best)}<small class="unit">${tp("unit-day", "일", s.streak.best)}</small></dd></div>
          <div><dt>${t`모은 XP`}</dt><dd>${n(s.xp)}</dd></div>
        </dl>
        <h3>${t`자주 틀린 개념`}</h3>
        ${weak.length ? `<ol class="weak">${weak.map(([id]) => `<li>${esc(tx(`concept.${id}.name`, (CONCEPTS.find((c) => c.id === id) || { name: id }).name))}</li>`).join("")}</ol>`
          : `<p class="muted">${t`아직 없어요. 틀린 문제가 생기면 여기에 모여요.`}</p>`}
      </section>
    </main>
    ${tabBar("badges", gardenTabOf(ctx))}
  </div>`;
  bindTabs(root, ctx);
}
