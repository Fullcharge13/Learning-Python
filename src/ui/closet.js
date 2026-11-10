// 의상실: 10벌 미리보기, 바이트로 사기, 입기, 기록 보호권
import { OUTFITS } from "../../data/outfits.js";
import { buy } from "../shop.js";
import { buyFreeze, FREEZE_PRICE, FREEZE_MAX } from "../rules.js";
import { checkBadges } from "../badges.js";
import { riaSVG } from "../ria.js";
import { esc, icon, toast } from "./dom.js";
import { tabBar, bindTabs, gardenTabOf, statusBar } from "./nav.js";
import { t, tx } from "../i18n.js";

// 의상 표 글자(영어면 tx outfit.<id>.칸)
const oShort = (o) => tx(`outfit.${o.id}.short`, o.short);
// 칸 이름표: 영어 short는 대사 속에 들어가도록 소문자로 시작하므로, 홀로 쓰일 때만 첫 글자를 대문자로(v0.13.0)
const oLabel = (o) => { const s = oShort(o); return s.charAt(0).toUpperCase() + s.slice(1); };
const oName = (o) => tx(`outfit.${o.id}.name`, o.name);
const oDesc = (o) => (o.desc ? tx(`outfit.${o.id}.desc`, o.desc) : o.desc);

// 고른 옷의 미리보기·사기 단추가 상태 줄 아래·화면 안에 오게(QA 1). 동작 줄이기면 바로 이동
function bringStage(root) {
  const stage = root.querySelector(".closet .stage");
  if (!stage) return;
  const bar = root.querySelector(".status");
  const top = bar ? bar.getBoundingClientRect().bottom : 0;
  const r = stage.getBoundingClientRect();
  if (r.top >= top && r.bottom <= window.innerHeight) return;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: Math.max(0, window.scrollY + r.top - top - 8), behavior: reduce ? "auto" : "smooth" });
}

// 초점: 사기·입기·「입고 있어요」 단추, 없으면(잠김·바이트 모자람) 옷 이름
function focusAction(root) {
  let target = root.querySelector("#buy:not([disabled]), #wear, #worn");
  if (!target) {
    target = root.querySelector(".stage-info h2");
    if (target) target.setAttribute("tabindex", "-1");
  }
  if (target) target.focus({ preventScroll: true });
}

export function render(root, ctx, params = {}) {
  let sel = params.sel || ctx.save.outfit;
  let line = params.line || null;

  function paint(after = null) {
    const s = ctx.save;
    const o = OUTFITS.find((x) => x.id === sel) || OUTFITS[0];
    const own = s.outfits.includes(o.id);
    const wearing = s.outfit === o.id;
    let action;
    // 「입고 있어요」는 초점을 받을 수 있게 aria-disabled(산 뒤·입은 뒤 초점이 여기로, QA 3)
    if (wearing) action = `<button class="btn ghost wide is-off" id="worn" aria-disabled="true">${t`입고 있어요`}</button>`;
    else if (own) action = `<button class="btn primary wide" id="wear">${t`입기`}</button>`;
    else if (o.price == null) action = `<p class="lock-note">${icon("lock")}${t`30일 연속 기록 보상`}</p>`;
    else action = `<button class="btn sun wide" id="buy"${s.bytes < o.price ? " disabled" : ""}>${icon("byte")}<span>${t`${o.price}바이트로 사기`}</span></button>
      ${s.bytes < o.price ? `<p class="muted center">${t`${o.price - Math.max(0, s.bytes)}바이트 더 모으면 살 수 있어요`}</p>` : ""}`;
    root.innerHTML = `<div class="screen closet with-tabs">
      ${statusBar(s)}
      <main>
        <h1 class="page-title">${t`의상실`}</h1>
        <section class="stage" aria-labelledby="stage-name">
          <div class="ria-wrap big">${riaSVG({ outfit: o.id, face: wearing ? "smile" : "sparkle", size: 170 })}</div>
          <div class="stage-info">
            <h2 id="stage-name">${esc(oName(o))}</h2>
            ${o.desc ? `<p class="muted outfit-desc">${esc(t`「${oDesc(o)}」`)}</p>` : ""}
            ${o.voice === "detective" ? `<p class="muted">${t`입으면 오류 설명이 탐정 말투로 바뀌어요`}</p>` : ""}
            ${line ? `<p class="bubble">${esc(line)}</p>` : ""}
            ${action}
          </div>
        </section>
        <ul class="outfit-grid" aria-label="${esc(t`의상 목록`)}">${OUTFITS.map((x) => {
          const owned = s.outfits.includes(x.id);
          const tag = s.outfit === x.id ? t`입는 중` : owned ? t`보유` : x.price == null ? t`30일 연속 기록 보상` : t`${x.price}바이트`;
          return `<li><button class="outfit${x.id === sel ? " sel" : ""}${owned ? " owned" : ""}" data-o="${x.id}" aria-pressed="${x.id === sel}" aria-label="${esc(`${oLabel(x)}, ${tag}`)}">
            ${riaSVG({ outfit: x.id, face: "smile", size: 74 })}
            <span class="o-name">${esc(oLabel(x))}</span>
            <span class="o-tag${owned ? " own" : ""}">${!owned && x.price == null ? icon("lock") : ""}${esc(tag)}</span>
          </button></li>`;
        }).join("")}</ul>
        <section class="panel freeze">
          <div class="freeze-text">
            <h2>${icon("shield")}${t`기록 보호권`} <b>${s.freezes}/${FREEZE_MAX}</b></h2>
            <p>${t`목표를 못 채운 날, 다음에 열 때 자동으로 써서 연속 기록을 지켜요.`}</p>
          </div>
          <button class="btn ghost" id="freeze"${s.freezes >= FREEZE_MAX || s.bytes < FREEZE_PRICE ? " disabled" : ""}>${s.freezes >= FREEZE_MAX ? t`가득 찼어요` : t`${FREEZE_PRICE}바이트`}</button>
        </section>
      </main>
      ${tabBar("closet", gardenTabOf(ctx))}
    </div>`;
    bindTabs(root, ctx);
    root.querySelectorAll("[data-o]").forEach((b) => b.addEventListener("click", () => { sel = b.dataset.o; line = null; paint("pick"); }));
    const wear = root.querySelector("#wear");
    if (wear) wear.addEventListener("click", () => {
      ctx.commit({ ...ctx.save, outfit: o.id });
      line = ctx.say("outfit_bought", { outfit: oShort(o) }).text;
      paint("focus");
    });
    const buyBtn = root.querySelector("#buy");
    if (buyBtn) buyBtn.addEventListener("click", () => {
      const r = buy(ctx.save, o.id);
      if (r instanceof Error) { toast(r.message); return; }
      let next = { ...r, outfit: o.id };
      const got = checkBadges(next, { hour: new Date().getHours(), lessonDone: false });
      if (got.length) { next = { ...next, badges: [...next.badges, ...got] }; toast(t`새 배지: ${tx("badge.collector.name", "의상 수집가")}`); }
      ctx.commit(next);
      ctx.sound.play("buy");
      line = ctx.say("outfit_bought", { outfit: oShort(o) }).text;
      paint("focus");
    });
    root.querySelector("#freeze").addEventListener("click", () => {
      const r = buyFreeze(ctx.save);
      if (r instanceof Error) { toast(r.message); return; }
      ctx.commit(r);
      ctx.sound.play("buy");
      toast(t`기록 보호권을 샀어요 (${r.freezes}/${FREEZE_MAX})`);
      paint();
      const fz = root.querySelector("#freeze");
      if (fz && !fz.disabled) fz.focus({ preventScroll: true });
    });
    if (after === "pick") { focusAction(root); bringStage(root); }
    else if (after === "focus") focusAction(root);
  }
  paint();
}
