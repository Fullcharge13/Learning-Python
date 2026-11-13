import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBadges, RULES } from "../../src/badges.js";
import { BADGES } from "../../data/badges.js";
import { setGuardIndex, guardIndex } from "../../src/guard/state.js";
import { buildGuardIndex } from "../../src/guard/catalog.js";
import { INCIDENTS } from "../../data/guard.js";

// 판정 G2-C3: 앱처럼 색인을 먼저 넣는다
const FULL = buildGuardIndex(INCIDENTS);
setGuardIndex(FULL);

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

test("BADGES table: 17 ids (ledger 12 + streak100 + v0.7 심화 2 + v0.15 경비실 2) with Korean name/desc", () => {
  assert.equal(BADGES.length, 17);
  assert.deepEqual(BADGES.map((b) => b.id), ["first_print", "ch1", "ch2", "ch3", "streak7", "streak30", "streak100",
    "fixer", "hintfree10", "perfectionist", "reviewer", "collector", "night_owl", "advanced1", "advancedAll", "guard_first", "guard_perfect"]);
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

test("every badge has its own art (no '?' fallback), incl. v0.7 심화 2개", async () => {
  const { badgeArt } = await import("../../src/ui/badges.js");
  for (const b of BADGES) {
    const svg = badgeArt(b.id, true);
    assert.ok(!/>\?<\/text>/.test(svg), `${b.id} uses fallback art`);
  }
});

test("guard_perfect 그림 글자는 색인 수(45/45, v0.16) — 색인이 바뀌면 따라 바뀜", async () => {
  const { badgeArt } = await import("../../src/ui/badges.js");
  assert.ok(badgeArt("guard_perfect", true).includes(`>${FULL.length}/${FULL.length}</text>`));
  assert.equal(FULL.length, 45);
  setGuardIndex(FULL.slice(0, 3));
  try {
    assert.ok(badgeArt("guard_perfect", true).includes(">3/3</text>"));
  } finally {
    setGuardIndex(FULL);
  }
});

test("badge_guard_first: 경비실 사건 하나 해결", () => {
  assert.deepEqual(checkBadges(mkSave(), {}), []);
  assert.deepEqual(checkBadges(mkSave({ guard: { solved: { G1: { firstTry: false, how: "code" } } } }), {}), ["guard_first"]);
});

test("badge_guard_perfect: 색인의 사건 모두 첫 실행(firstTry)일 때만", () => {
  const ids = guardIndex().map((e) => e.id);
  const last = ids[ids.length - 1];
  const solved = Object.fromEntries(ids.map((id) => [id, { firstTry: true, how: "blank" }]));
  assert.deepEqual(checkBadges(mkSave({ guard: { solved } }), {}), ["guard_first", "guard_perfect"]);
  solved[last].firstTry = false;
  assert.deepEqual(checkBadges(mkSave({ guard: { solved } }), {}), ["guard_first"]);
  delete solved[last];
  assert.ok(!checkBadges(mkSave({ guard: { solved } }), {}).includes("guard_perfect"));
});

test("badge_guard_perfect: 색인 3개짜리 — 셋 모두 firstTry면 받고, 하나 빠지면 아님, 이미 가진 배지는 그대로", () => {
  setGuardIndex(FULL.slice(0, 3));
  try {
    const ids = FULL.slice(0, 3).map((e) => e.id);
    const solved = Object.fromEntries(ids.map((id) => [id, { firstTry: true, how: "blank" }]));
    assert.equal(RULES.guard_perfect(mkSave({ guard: { solved } })), true);
    assert.ok(checkBadges(mkSave({ guard: { solved } }), {}).includes("guard_perfect"));
    delete solved[ids[2]];
    assert.equal(RULES.guard_perfect(mkSave({ guard: { solved } })), false);
    // 이미 받은 배지는 다시 주지도 뺏지도 않음(checkBadges는 새 것만)
    const had = mkSave({ guard: { solved }, badges: ["guard_first", "guard_perfect"] });
    assert.deepEqual(checkBadges(had, {}), []);
    assert.deepEqual(had.badges, ["guard_first", "guard_perfect"]);
  } finally {
    setGuardIndex(FULL);
  }
});
