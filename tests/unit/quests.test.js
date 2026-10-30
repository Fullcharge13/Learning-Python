import { test } from "node:test";
import assert from "node:assert/strict";
import { pickQuests, tick, ensureQuests } from "../../src/quests.js";
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

test("QUESTS table: 6 ledger ids, rewards 5/5/8/8/5/8", () => {
  assert.deepEqual(QUESTS.map((q) => q.id),
    ["q_lessons2", "q_xp20", "q_hintfree", "q_fixerr", "q_review3", "q_perfect"]);
  assert.deepEqual(QUESTS.map((q) => q.reward), [5, 5, 8, 8, 5, 8]);
  assert.deepEqual(QUESTS.map((q) => q.key),
    ["lesson_done", "xp", "hintfree_pass", "fixed_error_pass", "review_item", "perfect_lesson"]);
  assert.deepEqual(QUESTS.map((q) => q.goal), [2, 20, 1, 1, 3, 1]);
  for (const q of QUESTS) assert.ok(typeof q.name === "string" && q.name.length > 0);
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
