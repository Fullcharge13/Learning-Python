// v0.22.0 레벨 축하 한 줄(설계 §5-3): 레슨·매일 도전 결과 화면과 텃밭·경비실·공방 통과 창이 같이 쓴다.
// 새 창 없이 한 줄. 예: 「레벨 7! 떡잎이 됐어요 · +24바이트 · 새 상품 2개」
import { SHOP_ITEMS } from "../../data/shop.js";
import { levelTitle, LEVEL_MAX } from "../levels.js";
import { josa } from "../garden/state.js";
import { esc, icon } from "./dom.js";
import { t, tx, lang } from "../i18n.js";

const okLv = (v) => Number.isInteger(v) && v >= 1 && v <= LEVEL_MAX;

/** 레벨 이름(지금 언어). 열쇠는 단계 번호 level.title.1~6 */
export function levelName(L) {
  const { ko, key } = levelTitle(L);
  return tx(key, ko);
}

/** from < level <= to 에 열리는 상점 상품 수 */
export const newItemsCount = (from, to) => SHOP_ITEMS.filter((i) => from < i.level && i.level <= to).length;

/** 축하 한 줄 글(escape 전). levelUp이 없거나 모양이 틀리면 "" */
export function levelLineText(levelUp) {
  if (!levelUp || !okLv(levelUp.from) || !okLv(levelUp.to) || levelUp.to <= levelUp.from) return "";
  const { from, to } = levelUp;
  const bytes = Number.isInteger(levelUp.bytes) && levelUp.bytes > 0 ? levelUp.bytes : 0;
  const name = levelName(to);
  const items = newItemsCount(from, to);
  const parts = [t`레벨 ${to}! ${name}${lang() === "ko" ? josa(name, "이") : ""} 됐어요`];
  if (bytes) parts.push(t`+${bytes}바이트`);
  if (items) parts.push(t`새 상품 ${items}개`);
  return parts.join(" · ");
}

/** 축하 한 줄 HTML. levelUp이 null이면 "" */
export function levelLineHTML(levelUp) {
  const text = levelLineText(levelUp);
  return text ? `<p class="level-line">${icon("star")}<span>${esc(text)}</span></p>` : "";
}
