import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBadges, RULES } from "../../src/badges.js";
import { BADGES } from "../../data/badges.js";

function mkSave(over = {}) {
  return {
    saveVer: 1,
    current_chapter: 1, current_lesson: "1-1",
    completed_lessons: [], submission_logs: [], grading_results: {},
    weak_concepts: {}, review_queue: [], last_active_at: null,
    xp: 0, bytes: 0,
    streak: { days: 0, best: 0, lastGoalDate: null, todayDate: null, todayXp: 0 },
    freezes: 0,
    quests: { date: null, ids: [], progress: {}, done: [], chest: false },
    badges: [], outfits: ["basic"], outfit: "basic",
    stats: { lessons: 0, perfect: 0, hintfree: 0, fixed: 0, review_items: 0 },
    settings: { sound: true, dailyGoal: 20, name: "" },
    ...over,
  };
}
const stats = (o) => ({ lessons: 0, perfect: 0, hintfree: 0, fixed: 0, review_items: 0, ...o });

test("BADGES table: 13 ids (ledger 12 + streak100) with Korean name/desc", () => {
  assert.equal(BADGES.length, 13);
  assert.deepEqual(BADGES.map((b) => b.id), ["first_print", "ch1", "ch2", "ch3", "streak7", "streak30", "streak100",
    "fixer", "hintfree10", "perfectionist", "reviewer", "collector", "night_owl"]);
  for (const b of BADGES) {
    assert.match(b.name, /[가-힣]/);
    assert.match(b.desc, /[가-힣]/);
  }
});

test("empty save -> no badges", () => {
  assert.deepEqual(checkBadges(mkSave(), { hour: 12 }), []);
  assert.deepEqual(checkBadges(mkSave()), []);
});

test("badge_first_print: 1-1 completed -> ['first_print'], recheck -> []", () => {
  const s = mkSave({ completed_lessons: ["1-1"] });
  const got = checkBadges(s, { hour: 12 });
  assert.deepEqual(got, ["first_print"]);
  const s2 = { ...s, badges: [...s.badges, ...got] };
  assert.deepEqual(checkBadges(s2, { hour: 12 }), []);
});

test("night: lesson done 22:00-03:59 -> night_owl; 21 and 4 -> none", () => {
  const owl = (hour) => checkBadges(mkSave(), { hour, lessonDone: true }).includes("night_owl");
  assert.equal(owl(21), false);
  assert.equal(owl(22), true);
  assert.equal(owl(23), true);
  assert.equal(owl(0), true);
  assert.equal(owl(3), true);
  assert.equal(owl(4), false);
});

test("night_owl requires a lesson completed in this check (ruling)", () => {
  assert.deepEqual(checkBadges(mkSave(), { hour: 22 }), []);
  assert.deepEqual(checkBadges(mkSave(), { hour: 22, lessonDone: false }), []);
  assert.deepEqual(checkBadges(mkSave(), { hour: 3 }), []);
});

test("chapter badges from completed exam lessons", () => {
  const s = mkSave({ completed_lessons: ["1-1", "1-5", "2-5", "3-5"] });
  assert.deepEqual(checkBadges(s, { hour: 12 }), ["first_print", "ch1", "ch2", "ch3"]);
  assert.deepEqual(checkBadges(mkSave({ completed_lessons: ["1-4"] }), { hour: 12 }), []);
});

test("streak badges use streak.best", () => {
  assert.deepEqual(checkBadges(mkSave({ streak: { days: 0, best: 6 } }), { hour: 12 }), []);
  assert.deepEqual(checkBadges(mkSave({ streak: { days: 0, best: 7 } }), { hour: 12 }), ["streak7"]);
  assert.deepEqual(checkBadges(mkSave({ streak: { days: 30, best: 30 } }), { hour: 12 }), ["streak7", "streak30"]);
  assert.deepEqual(checkBadges(mkSave({ streak: { days: 99, best: 99 } }), { hour: 12 }), ["streak7", "streak30"]);
  assert.deepEqual(checkBadges(mkSave({ streak: { days: 100, best: 100 } }), { hour: 12 }), ["streak7", "streak30", "streak100"]);
});

test("streak100: already granted (by Task 2 milestone) -> not returned again", () => {
  const s = mkSave({ streak: { days: 100, best: 100 }, badges: ["streak7", "streak30", "streak100"] });
  assert.deepEqual(checkBadges(s, { hour: 12 }), []);
  const b = BADGES.find((x) => x.id === "streak100");
  assert.equal(b.name, "연속 100일");
  assert.equal(b.desc, "100일 연속으로 하루 목표를 채워요");
});

test("stat thresholds: fixed 5, hintfree 10, perfect 10, review_items 30", () => {
  const below = mkSave({ stats: stats({ fixed: 4, hintfree: 9, perfect: 9, review_items: 29 }) });
  assert.deepEqual(checkBadges(below, { hour: 12 }), []);
  const at = mkSave({ stats: stats({ fixed: 5, hintfree: 10, perfect: 10, review_items: 30 }) });
  assert.deepEqual(checkBadges(at, { hour: 12 }), ["fixer", "hintfree10", "perfectionist", "reviewer"]);
});

test("collector: 3 outfits besides basic (ruling)", () => {
  assert.deepEqual(checkBadges(mkSave({ outfits: ["basic", "casual", "chef"] }), { hour: 12 }), []);
  assert.deepEqual(checkBadges(mkSave({ outfits: ["basic", "casual", "chef", "uniform"] }), { hour: 12 }), ["collector"]);
});

test("does not mutate save", () => {
  const s = mkSave({ completed_lessons: ["1-1"] });
  const snap = JSON.stringify(s);
  checkBadges(s, { hour: 22, lessonDone: true });
  assert.equal(JSON.stringify(s), snap);
});

test("every BADGES id has a rule (and no extra rules)", () => {
  for (const b of BADGES) assert.equal(typeof RULES[b.id], "function", b.id);
  assert.deepEqual(Object.keys(RULES).sort(), BADGES.map((b) => b.id).sort());
});
