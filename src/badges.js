// 배지 판정 (설계서 5-5). 새로 얻은 id만 돌려줌
import { BADGES } from "../data/badges.js";
import { isAdvancedId } from "./advanced.js";

const done = (s, id) => (s.completed_lessons || []).includes(id);
const stat = (s, k) => (s.stats && s.stats[k]) || 0;

// ctx = { hour, lessonDone, advancedIds }: 밤 공부는 이번 검사에서 레슨을 끝냈고 22시~새벽 3시 59분일 때만.
// 「깊이 파는 사람」(advancedAll)은 지금 과정에 있는 심화 전부(레슨 목록의 심화 id = ctx.advancedIds)를 끝냈을 때.
//   v0.7에는 1~6장 심화 18개뿐이라 그 18개로 받을 수 있다. 한 번 받은 배지는 뒤 판에서 심화가 늘어도 그대로 남는다.
export const RULES = {
  first_print: (s) => done(s, "1-1"),
  ch1: (s) => done(s, "1-5"),
  ch2: (s) => done(s, "2-5"),
  ch3: (s) => done(s, "3-5"),
  streak7: (s) => ((s.streak && s.streak.best) || 0) >= 7,
  streak30: (s) => ((s.streak && s.streak.best) || 0) >= 30,
  streak100: (s) => ((s.streak && s.streak.best) || 0) >= 100,
  fixer: (s) => stat(s, "fixed") >= 5,
  hintfree10: (s) => stat(s, "hintfree") >= 10,
  perfectionist: (s) => stat(s, "perfect") >= 10,
  reviewer: (s) => stat(s, "review_items") >= 30,
  collector: (s) => (s.outfits || []).filter((o) => o !== "basic").length >= 3,
  night_owl: (s, ctx) => ctx.lessonDone === true && typeof ctx.hour === "number" && (ctx.hour >= 22 || ctx.hour < 4),
  advanced1: (s) => (s.completed_lessons || []).some(isAdvancedId),
  advancedAll: (s, ctx) => Array.isArray(ctx.advancedIds) && ctx.advancedIds.length > 0 && ctx.advancedIds.every((id) => done(s, id)),
};

export function checkBadges(save, ctx = {}) {
  const have = new Set(save.badges || []);
  return BADGES.map((b) => b.id).filter((id) => !have.has(id) && RULES[id](save, ctx || {}));
}
