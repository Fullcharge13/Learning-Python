import { test } from "node:test";
import assert from "node:assert/strict";
import { pickQuests, tick, ensureQuests, gardenOrderOpen } from "../../src/quests.js";
import { ORDERS } from "../../data/garden.js";
import { QUESTS } from "../../data/quests.js";

// Save fixture per ledger (C3): built locally, no import of src/save.js
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

function dates(n, start = "2026-01-01") {
  const out = [];
  const d = new Date(start + "T00:00:00Z");
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

test("QUESTS table: 6 ledger ids + q_garden(v0.11), rewards 5/5/8/8/5/8/5", () => {
  assert.deepEqual(QUESTS.map((q) => q.id),
    ["q_lessons2", "q_xp20", "q_hintfree", "q_fixerr", "q_review3", "q_perfect", "q_garden"]);
  assert.deepEqual(QUESTS.map((q) => q.reward), [5, 5, 8, 8, 5, 8, 5]);
  assert.deepEqual(QUESTS.map((q) => q.key),
    ["lesson_done", "xp", "hintfree_pass", "fixed_error_pass", "review_item", "perfect_lesson", "garden_order"]);
  assert.deepEqual(QUESTS.map((q) => q.goal), [2, 20, 1, 1, 3, 1, 1]);
  for (const q of QUESTS) assert.ok(typeof q.name === "string" && q.name.length > 0);
  const g = QUESTS.find((q) => q.id === "q_garden");
  assert.equal(g.name, "텃밭 주문 1개 해내기");
  assert.equal(g.needs, "garden");
});

test("same_day: same date twice -> same result, 3 items, distinct", () => {
  const s = mkSave({ review_queue: ["assign"] });
  const a = pickQuests("2026-10-29", s);
  const b = pickQuests("2026-10-29", s);
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  assert.equal(new Set(a).size, 3);
  const ids = new Set(QUESTS.map((q) => q.id));
  for (const id of a) assert.ok(ids.has(id));
});

test("different dates give varied picks (not constant)", () => {
  const s = mkSave({ review_queue: ["assign"] });
  const seen = new Set(dates(30).map((d) => pickQuests(d, s).join(",")));
  assert.ok(seen.size > 3);
});

test("no_review: empty review_queue over 365 dates -> q_review3 never picked", () => {
  const s = mkSave({ review_queue: [] });
  let count = 0;
  for (const d of dates(365)) {
    const p = pickQuests(d, s);
    assert.equal(new Set(p).size, 3);
    if (p.includes("q_review3")) count++;
  }
  assert.equal(count, 0);
});

test("review quest can appear when review_queue is non-empty", () => {
  const s = mkSave({ review_queue: ["assign"] });
  assert.ok(dates(365).some((d) => pickQuests(d, s).includes("q_review3")));
});

function finishAll(save, today) {
  // drive every quest of the day to completion
  let s = save, chestSeen = 0;
  const ids = s.quests.ids;
  for (const id of ids) {
    const q = QUESTS.find((x) => x.id === id);
    const r = tick(s, q.key, today, q.goal);
    s = r.save;
    if (r.chest) chestSeen++;
  }
  return { s, chestSeen };
}

test("tick initializes today's quests when date differs, without mutating input", () => {
  const s0 = mkSave();
  const snap = JSON.stringify(s0);
  const r = tick(s0, "xp", "2026-10-29", 3);
  assert.equal(JSON.stringify(s0), snap);
  assert.equal(r.save.quests.date, "2026-10-29");
  assert.deepEqual(r.save.quests.ids, pickQuests("2026-10-29", s0));
  assert.equal(r.save.quests.chest, false);
});

test("tick: progress, finish once, reward added once", () => {
  const today = "2026-10-29";
  // choose a date state containing q_xp20 by setting quests explicitly
  const s0 = mkSave({ quests: { date: today, ids: ["q_xp20", "q_lessons2", "q_perfect"], progress: {}, done: [], chest: false } });
  let r = tick(s0, "xp", today, 15);
  assert.deepEqual(r.finished, []);
  assert.equal(r.save.quests.progress.q_xp20, 15);
  r = tick(r.save, "xp", today, 10);
  assert.deepEqual(r.finished, ["q_xp20"]);
  assert.equal(r.save.bytes, 5);
  assert.deepEqual(r.save.quests.done, ["q_xp20"]);
  r = tick(r.save, "xp", today, 10);
  assert.deepEqual(r.finished, []);
  assert.equal(r.save.bytes, 5);
  // unrelated event does nothing to bytes
  r = tick(r.save, "review_item", today);
  assert.equal(r.save.bytes, 5);
});

test("chest_once: all 3 done -> chest +10, more events same day add 0", () => {
  const today = "2026-10-29";
  const s0 = mkSave({ review_queue: ["assign"], quests: { date: today, ids: pickQuests(today, mkSave({ review_queue: ["assign"] })), progress: {}, done: [], chest: false } });
  const { s, chestSeen } = finishAll(s0, today);
  assert.equal(chestSeen, 1);
  assert.equal(s.quests.chest, true);
  const rewards = s0.quests.ids.reduce((a, id) => a + QUESTS.find((q) => q.id === id).reward, 0);
  assert.equal(s.bytes, rewards + 10);
  let t = s;
  for (const q of QUESTS) {
    const r = tick(t, q.key, today, 50);
    assert.equal(r.chest, false);
    assert.deepEqual(r.finished, []);
    t = r.save;
  }
  assert.equal(t.bytes, rewards + 10);
});

test("new day resets quests and chest", () => {
  const today = "2026-10-29";
  const s0 = mkSave({ quests: { date: "2026-10-28", ids: ["q_xp20"], progress: { q_xp20: 20 }, done: ["q_xp20"], chest: true } });
  const r = tick(s0, "lesson_done", today);
  assert.equal(r.save.quests.chest, false);
  assert.equal(r.save.quests.ids.length, 3);
  assert.equal(r.save.quests.date, today);
  assert.deepEqual(r.save.quests.ids, pickQuests(today, s0));
  assert.deepEqual(r.save.quests.done, []);
  assert.equal(r.save.quests.progress.q_xp20, undefined);
  assert.equal(r.save.bytes, 0);
});

test("pick is independent of pool size: non-review picks agree with/without queue", () => {
  for (const d of dates(365)) {
    const withQ = pickQuests(d, mkSave({ review_queue: ["assign"] }));
    const without = pickQuests(d, mkSave({ review_queue: [] }));
    const kept = withQ.filter((id) => id !== "q_review3");
    assert.deepEqual(without.slice(0, kept.length), kept);
  }
});

test("ensureQuests: stores today's list; same day queue change keeps ids", () => {
  const today = "2026-10-29";
  const s0 = mkSave({ review_queue: [] });
  const snap = JSON.stringify(s0);
  const s1 = ensureQuests(s0, today);
  assert.equal(JSON.stringify(s0), snap);
  assert.equal(s1.quests.date, today);
  assert.deepEqual(s1.quests.ids, pickQuests(today, s0));
  assert.equal(ensureQuests(s1, today), s1);
  const s2 = { ...s1, review_queue: ["assign"] };
  const r = tick(s2, "xp", today, 1);
  assert.deepEqual(r.save.quests.ids, s1.quests.ids);
});

test("ensureQuests: null or malformed quests for today are rebuilt", () => {
  const today = "2026-10-29";
  const expect = pickQuests(today, mkSave());
  for (const bad of [null, undefined, "x",
    { date: today },
    { date: today, ids: ["q_xp20"], done: [], chest: false },
    { date: today, ids: ["q_xp20"], progress: {}, chest: false },
    { date: today, ids: "q_xp20", progress: {}, done: [], chest: false }]) {
    const s = ensureQuests(mkSave({ quests: bad }), today);
    assert.deepEqual(s.quests.ids, expect);
    assert.deepEqual(s.quests.progress, {});
    assert.deepEqual(s.quests.done, []);
    assert.equal(s.quests.chest, false);
    const r = tick(mkSave({ quests: bad }), "xp", today, 1);
    assert.deepEqual(r.save.quests.ids, expect);
  }
});

test("amount must be finite and positive, else 0", () => {
  const today = "2026-10-29";
  const s0 = mkSave({ quests: { date: today, ids: ["q_xp20", "q_lessons2", "q_perfect"], progress: { q_xp20: 5 }, done: [], chest: false } });
  for (const bad of [NaN, -5, Infinity, 0, "7", null]) {
    const r = tick(s0, "xp", today, bad);
    assert.equal(r.save.quests.progress.q_xp20, 5, String(bad));
    assert.deepEqual(r.finished, []);
    assert.equal(r.save.bytes, 0);
  }
});

test("clock moved back (today < quests.date): stored quests kept, no chest", () => {
  const stored = { date: "2026-10-30", ids: ["q_xp20", "q_lessons2", "q_perfect"],
    progress: { q_lessons2: 1 }, done: ["q_xp20", "q_perfect"], chest: false };
  const s0 = mkSave({ quests: stored });
  assert.deepEqual(ensureQuests(s0, "2026-10-29").quests, stored);
  const r = tick(s0, "lesson_done", "2026-10-29", 1);
  assert.deepEqual(r.save.quests, stored);
  assert.equal(r.chest, false);
  assert.deepEqual(r.finished, []);
  assert.equal(r.save.bytes, 0);
});

test("clock-back window: stored date must be valid and at most 1 day ahead", () => {
  const today = "2026-10-29";
  const mk = (date) => mkSave({ quests: { date, ids: ["q_xp20", "q_lessons2", "q_perfect"],
    progress: { q_lessons2: 1 }, done: ["q_xp20"], chest: false } });
  const fresh = pickQuests(today, mkSave());
  // kept: exactly 1 day ahead
  const kept = mk("2026-10-30");
  assert.deepEqual(ensureQuests(kept, today).quests, kept.quests);
  // rebuilt: far future, invalid strings, impossible dates
  for (const bad of ["2027-01-01", "2026-10-31", "zzzz", "2026-13-01", "2026-02-30", "2026-1-30", ""]) {
    const s = ensureQuests(mk(bad), today);
    assert.equal(s.quests.date, today, bad);
    assert.deepEqual(s.quests.ids, fresh, bad);
    assert.deepEqual(s.quests.done, [], bad);
  }
});

test("wellFormed: ids must be exactly 3 distinct known quest ids", () => {
  const today = "2026-10-29";
  const fresh = pickQuests(today, mkSave());
  for (const ids of [[], ["nope"], ["q_xp20", "q_lessons2"], ["q_xp20", "q_xp20", "q_perfect"],
    ["q_xp20", "q_lessons2", "nope"], ["q_xp20", "q_lessons2", "q_perfect", "q_fixerr"]]) {
    const s = ensureQuests(mkSave({ quests: { date: today, ids, progress: {}, done: [], chest: false } }), today);
    assert.deepEqual(s.quests.ids, fresh, JSON.stringify(ids));
  }
  const ok = mkSave({ quests: { date: today, ids: ["q_xp20", "q_lessons2", "q_perfect"], progress: {}, done: [], chest: false } });
  assert.equal(ensureQuests(ok, today), ok);
});

test("non-finite stored progress counts as 0 when incrementing", () => {
  const today = "2026-10-29";
  for (const bad of ["3", NaN, null, Infinity, -4]) {
    const s0 = mkSave({ quests: { date: today, ids: ["q_xp20", "q_lessons2", "q_perfect"],
      progress: { q_xp20: bad }, done: [], chest: false } });
    const r = tick(s0, "xp", today, 5);
    assert.equal(r.save.quests.progress.q_xp20, 5, String(bad));
  }
});

// ---------------------------------------------------------------- v0.11 q_garden (설계 §3)

// v0.10까지의 뽑기(6개를 날짜 씨앗으로 섞고 복습 규칙 적용) — 텃밭이 잠긴 학습자는 이것과 똑같아야 한다
function oldPick(today, save) {
  const hashStr = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
  const mul = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rng = mul(hashStr(String(today)));
  const order = ["q_lessons2", "q_xp20", "q_hintfree", "q_fixerr", "q_review3", "q_perfect"];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const reviewEmpty = !save || !Array.isArray(save.review_queue) || save.review_queue.length === 0;
  return order.filter((id) => !(reviewEmpty && id === "q_review3")).slice(0, 3);
}

const garden = (idx, runs = 3) => ({ order: { idx, done: [], paid: [] }, runs });
const OPEN = (over = {}) => mkSave({ completed_lessons: ["1-1", "1-2", "1-3", "1-4", "1-5"], garden: garden(0), ...over });

test("q_garden: 텃밭이 잠겼거나(1장 평가 전) 텃밭을 한 번도 실행하지 않은 학습자는 365일 동안 한 번도 뽑히지 않고, 뽑기는 v0.10과 똑같음", () => {
  for (const s of [mkSave(), mkSave({ review_queue: ["assign"] }), mkSave({ completed_lessons: ["1-1", "1-2", "1-3", "1-4"] }),
    mkSave({ completed_lessons: ["2-5"], garden: garden(5) }),
    // 텃밭은 열렸지만 한 번도 실행하지 않은 학습자(C65): v0.10 숫자 그대로
    OPEN({ garden: garden(0, 0) }), OPEN({ garden: undefined }), OPEN({ garden: { order: { idx: 0 } } }),
    OPEN({ garden: garden(0, 0), review_queue: ["assign"] })]) {
    for (const d of dates(365)) {
      const p = pickQuests(d, s);
      assert.ok(!p.includes("q_garden"), d);
      assert.deepEqual(p, oldPick(d, s), d);
    }
  }
});

test("q_garden: 텃밭이 열리면 뽑힐 수 있음(대략 3/6~3/7의 날), 언제나 서로 다른 3개", () => {
  for (const s of [OPEN(), OPEN({ review_queue: ["assign"] })]) {
    let n = 0;
    for (const d of dates(700)) {
      const p = pickQuests(d, s);
      assert.equal(p.length, 3);
      assert.equal(new Set(p).size, 3);
      if (!s.review_queue.length) assert.ok(!p.includes("q_review3"));
      if (p.includes("q_garden")) n++;
    }
    assert.ok(n > 700 * 0.3 && n < 700 * 0.6, `뽑힌 날 ${n}/700`);
  }
});

test("q_garden: 열렸어도 지금 해낼 주문이 없으면 빠짐(주문을 다 끝냄 / 지금 주문의 장을 아직 안 끝냄)", () => {
  const all = OPEN({ garden: garden(ORDERS.length) });
  const waiting = OPEN({ garden: garden(ORDERS.findIndex((o) => o.need === 2)) });
  assert.equal(gardenOrderOpen(all), false);
  assert.equal(gardenOrderOpen(waiting), false);
  assert.equal(gardenOrderOpen(OPEN()), true);
  assert.equal(gardenOrderOpen(OPEN({ garden: undefined })), false, "garden 없는 옛 저장 = 실행 0번");
  assert.equal(gardenOrderOpen(OPEN({ garden: garden(0, 0) })), false, "실행 0번(C65)");
  assert.equal(gardenOrderOpen(OPEN({ garden: { order: { idx: 0 }, runs: "x" } })), false, "이상한 runs = 0번");
  assert.equal(gardenOrderOpen(OPEN({ garden: { order: { idx: "x" }, runs: 1 } })), true, "이상한 idx = 첫 주문");
  assert.equal(gardenOrderOpen(null), false);
  for (const d of dates(365)) {
    assert.ok(!pickQuests(d, all).includes("q_garden"));
    assert.ok(!pickQuests(d, waiting).includes("q_garden"));
  }
});

test("q_garden: 텃밭 열림 기준이 텃밭 화면(passedChapters, 장 평가 레슨)과 같음 + 실행 1번 이상 — 모든 장 평가 id가 「N-5」", async () => {
  const { passedChapters } = await import("../../src/garden/state.js");
  const { readdirSync } = await import("node:fs");
  const dir = new URL("../../data/lessons/", import.meta.url);
  const chapters = [];
  for (const f of readdirSync(dir).filter((x) => /^ch\d+\.js$/.test(x))) {
    const m = await import(new URL(f, dir).href);
    chapters.push({ id: m.CHAPTER.id, lessons: m.LESSONS });
  }
  for (const c of chapters) {
    const exam = c.lessons.find((l) => l.isExam) || c.lessons[c.lessons.length - 1];
    assert.equal(exam.id, `${c.id}-5`, `${c.id}장 평가 id`);
  }
  // 저장 몇 가지로 직접 대조: 열림 = 1장 통과 && 지금 주문의 장 통과
  const cases = [mkSave(), OPEN(), OPEN({ garden: garden(0, 0) }), OPEN({ garden: garden(4) }), OPEN({ completed_lessons: ["1-5", "2-5"], garden: garden(4) }),
    OPEN({ completed_lessons: ["1-5", "2-5", "3-5", "4-5", "5-5", "6-5", "7-5", "8-5"], garden: garden(20) })];
  for (const s of cases) {
    const passed = passedChapters(s, chapters);
    const o = ORDERS[s.garden?.order?.idx ?? 0];
    assert.equal(gardenOrderOpen(s), passed.has(1) && !!o && passed.has(o.need) && s.garden.runs > 0, JSON.stringify(s.completed_lessons));
  }
});

test("q_garden: tick(\"garden_order\")로 끝남, 보상 5바이트", () => {
  const today = "2026-11-05";
  const s = OPEN({ quests: { date: today, ids: ["q_garden", "q_xp20", "q_perfect"], progress: {}, done: [], chest: false } });
  const r = tick(s, "garden_order", today);
  assert.deepEqual(r.finished, ["q_garden"]);
  assert.equal(r.save.bytes, 5);
});
