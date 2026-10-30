// 배지 판정 (설계서 5-5). 새로 얻은 id만 돌려줌
import { BADGES } from "../data/badges.js";

const done = (s, id) => (s.completed_lessons || []).includes(id);
const stat = (s, k) => (s.stats && s.stats[k]) || 0;

// ctx = { hour, lessonDone }: 밤 공부는 이번 검사에서 레슨을 끝냈고 22시~새벽 3시 59분일 때만
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
};

export function checkBadges(save, ctx = {}) {
  const have = new Set(save.badges || []);
  return BADGES.map((b) => b.id).filter((id) => !have.has(id) && RULES[id](save, ctx || {}));
}
