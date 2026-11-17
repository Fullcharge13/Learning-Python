// v0.22.0 레벨 축하 한 줄(설계 §5-3): 레슨·매일 도전 결과 화면과 텃밭·경비실·공방 통과 창이 같이 쓴다.
// 새 창 없이 한 줄. 이름 단계가 바뀌면 「레벨 6! 떡잎이 됐어요 · +22바이트」, 같은 단계 안이면 「레벨 3으로 올랐어요! · +16바이트 · 새 상품 2개」(검토 I1)
import { SHOP_ITEMS } from "../../data/shop.js";
import { levelTitle, LEVEL_MAX } from "../levels.js";
import { josa } from "../josa.js";
import { esc, icon } from "./dom.js";
import { t, tx, lang } from "../i18n.js";

const okLv = (v) => Number.isInteger(v) && v >= 1 && v <= LEVEL_MAX;

/** 레벨 이름(지금 언어). 열쇠는 단계 번호 level.title.1~6 */
export function levelName(L) {
  const { ko, key } = levelTitle(L);
  return tx(key, ko);
}

/** from < level <= to 에 열리는 상점 상품 수. legacy(기존 학습자)는 원래 8벌을 이미 레벨과 상관없이 사므로 뺀다(검토 M2) */
export const newItemsCount = (from, to, legacy = false) =>
  SHOP_ITEMS.filter((i) => from < i.level && i.level <= to && !(legacy && i.legacyFree)).length;

/** 축하 한 줄 글(escape 전). levelUp이 없거나 모양이 틀리면 "". save: legacy를 보려고(없어도 됨) */
export function levelLineText(levelUp, save = null) {
  if (!levelUp || !okLv(levelUp.from) || !okLv(levelUp.to) || levelUp.to <= levelUp.from) return "";
  const { from, to } = levelUp;
  const bytes = Number.isInteger(levelUp.bytes) && levelUp.bytes > 0 ? levelUp.bytes : 0;
  const ko = lang() === "ko";
  const items = newItemsCount(from, to, !!(save && save.levels && save.levels.legacy === true));
  // 이름은 5레벨마다 바뀐다. 바뀐 때만 「…이 됐어요」(여러 레벨이 한 번에 단계를 넘어도 바뀐 것)
  const tierUp = levelTitle(from).key !== levelTitle(to).key;
  const name = levelName(to);
  const parts = [tierUp ? t`레벨 ${to}! ${name}${ko ? josa(name, "이") : ""} 됐어요` : t`레벨 ${to}${ko ? josa(String(to), "으로") : ""} 올랐어요!`];
  if (bytes) parts.push(t`+${bytes}바이트`);
  if (items) parts.push(t`새 상품 ${items}개`);
  return parts.join(" · ");
}

/** 축하 한 줄 HTML. levelUp이 null이면 "" */
export function levelLineHTML(levelUp, save = null) {
  const text = levelLineText(levelUp, save);
  return text ? `<p class="level-line">${icon("star")}<span>${esc(text)}</span></p>` : "";
}
