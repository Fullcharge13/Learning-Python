// 상점의 꾸미기·편집기 색 탭(v0.22.0 설계 2026-11-17 §5-4). 목록 그리기와 사기·켜고 끄기.
// 견본(decoSwatch)은 ./decoart.js의 작은 그림(44×44). 편집기 색·경비실 테마 견본은 밝게·어둡게 두 벌.
// #app 묶음은 쓰지 않는다: 단추마다 묶고, 다시 그릴 때 innerHTML로 함께 사라진다(v0.20.1).
import { SHOP_ITEMS, DECO_SPACES } from "../../data/shop.js";
import { canBuy, buyItem, setDeco, owns } from "../shop.js";
import { cleanDeco, decoSpaceOf } from "../deco.js";
import { esc, icon, toast } from "./dom.js";
import { decoSwatch } from "./decoart.js";
import { t } from "../i18n.js";

const NAMES = {
  ed_paper: () => t`종이`, ed_forest: () => t`숲`, ed_sea: () => t`바다`, ed_night: () => t`밤하늘`,
  gd_fence: () => t`울타리`, gd_flowers: () => t`꽃길`, gd_greenhouse: () => t`온실`,
  gu_night: () => t`야간 근무`, gu_control: () => t`관제실`,
  ws_wood: () => t`나무 받침`, ws_metal: () => t`금속 받침`,
};
const SPACES = { garden: () => t`텃밭`, guard: () => t`경비실`, workshop: () => t`공방` };

/** 꾸미기·편집기 색 이름(화면 글자) */
export const decoName = (id) => (NAMES[id] ? NAMES[id]() : id);

/** 견본 그림(svg 글자, 44×44): ./decoart.js(작업 6에서 색 견본을 진짜 그림으로) */
export { decoSwatch };

// 스위치 설명: 꾸미기는 공간 제목(「텃밭」 등)을 읽어 준다(검토 M3). 편집기 색 탭은 탭 이름으로 충분
function itemHTML(s, item) {
  const id = item.id;
  const name = decoName(id);
  const c = canBuy(s, id);
  let state, action = "";
  if (owns(s, id)) {
    const on = cleanDeco(s.deco).on[item.kind] === id;
    state = `<span class="si-state own">${icon("check")}${t`가지고 있음`}</span>`;
    const desc = SPACES[item.kind] ? ` aria-describedby="shop-sp-${item.kind}"` : "";
    action = `<button class="switch" role="switch" data-on="${id}" aria-checked="${on}" aria-labelledby="si-n-${id}"${desc}><span></span></button>`;
  } else if (c.reason === "level") {
    state = `<p class="lock-note si-lock">${icon("lock")}${esc(t`Lv ${c.needLevel}에 열려요`)}</p>`;
  } else {
    const short = c.reason === "bytes";
    state = `<span class="si-state">${icon("byte")}${esc(t`${item.price}바이트`)}</span>`
      + (short ? `<span class="si-need">${esc(t`${item.price - Math.max(0, s.bytes || 0)}바이트 더 모으면 살 수 있어요`)}</span>` : "");
    action = `<button class="btn sun si-buy" data-buy="${id}" aria-label="${esc(`${name}, ${t`${item.price}바이트로 사기`}`)}"${short ? " disabled" : ""}>${t`사기`}</button>`;
  }
  return `<li class="shop-item" data-id="${id}">
    <span class="si-swatch">${decoSwatch(id)}</span>
    <div class="si-text"><b class="si-name" id="si-n-${id}">${esc(name)}</b>${state}</div>${action}</li>`;
}

const list = (s, items) => `<ul class="shop-list">${items.map((i) => itemHTML(s, i)).join("")}</ul>`;

/** 탭 본문. tab: "deco"(텃밭·경비실·공방) | "color"(편집기) */
export function decoPanelHTML(s, tab) {
  if (tab === "color") {
    return `<p class="muted shop-note">${t`코드 편집기의 글자 색이에요. 모두 끄면 지금 색 그대로예요.`}</p>
      ${list(s, SHOP_ITEMS.filter((i) => i.kind === "editor"))}`;
  }
  return `<p class="muted shop-note">${t`한 곳에 하나씩 켤 수 있어요. 산 것은 언제든 켜고 꺼요.`}</p>
    ${DECO_SPACES.filter((sp) => SPACES[sp]).map((sp) => `<h2 class="shop-space" id="shop-sp-${sp}">${esc(SPACES[sp]())}</h2>
      ${list(s, SHOP_ITEMS.filter((i) => i.kind === sp))}`).join("")}`;
}

/** 사기·켜고 끄기. repaint(focusSel): 다시 그리고 그 단추에 초점 */
export function bindDeco(root, ctx, repaint) {
  root.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.buy;
    const r = buyItem(ctx.save, id);
    if (r instanceof Error) { toast(r.message); return; }
    ctx.commit(r);
    ctx.sound.play("buy");
    toast(t`샀어요: ${decoName(id)}`);
    repaint(`[data-on="${id}"]`);
  }));
  root.querySelectorAll("[data-on]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.on;
    const sp = decoSpaceOf(id);
    const r = setDeco(ctx.save, sp, cleanDeco(ctx.save.deco).on[sp] === id ? null : id);
    if (r instanceof Error) { toast(r.message); return; }
    ctx.commit(r);
    repaint(`[data-on="${id}"]`);
  }));
}
