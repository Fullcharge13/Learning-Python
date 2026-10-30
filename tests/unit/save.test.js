import { test } from "node:test";
import assert from "node:assert/strict";
import { SAVE_KEY, SAVE_VER, newSave, migrate, load, loadEx, store } from "../../src/save.js";

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

const LEDGER_SHAPE = {
  saveVer: 1,
  current_chapter: 1, current_lesson: "1-1",
  completed_lessons: [],
  submission_logs: [],
  grading_results: {},
  weak_concepts: {},
  review_queue: [],
  last_active_at: null,
  xp: 0, bytes: 0,
  streak: { days: 0, best: 0, lastGoalDate: null, todayDate: null, todayXp: 0 },
  freezes: 0,
  quests: { date: null, ids: [], progress: {}, done: [], chest: false },
  badges: [], outfits: ["basic"], outfit: "basic",
  stats: { lessons: 0, perfect: 0, hintfree: 0, fixed: 0, review_items: 0 },
  settings: { sound: true, dailyGoal: 20, name: "" },
};

test("constants", () => {
  assert.equal(SAVE_KEY, "ria-python.save");
  assert.equal(SAVE_VER, 1);
});

test("new", () => {
  const s = newSave();
  assert.equal(s.saveVer, 1);
  assert.equal(s.xp, 0);
  assert.equal(s.bytes, 0);
  assert.equal(s.outfit, "basic");
});

test("new: exactly the ledger Save shape", () => {
  assert.deepEqual(newSave(), LEDGER_SHAPE);
});

test("new: returns independent objects", () => {
  const a = newSave();
  a.outfits.push("lab");
  a.streak.days = 5;
  const b = newSave();
  assert.deepEqual(b.outfits, ["basic"]);
  assert.equal(b.streak.days, 0);
});

test("migrate", () => {
  const s = migrate({ xp: 30 });
  assert.equal(s.saveVer, 1);
  assert.equal(s.xp, 30);
  assert.equal(s.bytes, 0);
});

test("migrate: fills missing nested fields, keeps existing values", () => {
  const old = {
    xp: 12,
    completed_lessons: ["1-1"],
    streak: { days: 3, lastGoalDate: "2026-10-28" },
    settings: { sound: false },
  };
  const s = migrate(old);
  assert.equal(s.saveVer, 1);
  assert.deepEqual(s.completed_lessons, ["1-1"]);
  assert.deepEqual(s.streak, { days: 3, best: 0, lastGoalDate: "2026-10-28", todayDate: null, todayXp: 0 });
  assert.deepEqual(s.settings, { sound: false, dailyGoal: 20, name: "" });
  assert.deepEqual(s.stats, LEDGER_SHAPE.stats);
  assert.deepEqual(s.quests, LEDGER_SHAPE.quests);
});

test("migrate: full v1 save passes through unchanged", () => {
  const full = newSave();
  full.xp = 99;
  full.grading_results = { "1-1": { perfect: true, attempts: 1 } };
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(full))), full);
});

test("migrate: non-object input gives new save", () => {
  assert.deepEqual(migrate(null), newSave());
  assert.deepEqual(migrate([1, 2]), newSave());
  assert.deepEqual(migrate("x"), newSave());
});

test("load: missing key gives new save", () => {
  assert.deepEqual(load(fakeStorage()), newSave());
});

test("broken", () => {
  const st = fakeStorage({ [SAVE_KEY]: "{깨짐" });
  const s = load(st);
  assert.deepEqual(s, newSave());
  assert.equal(st.data[SAVE_KEY + ".broken"], "{깨짐");
});

test("load: storage getItem throws gives new save", () => {
  const st = { getItem() { throw new Error("denied"); }, setItem() {} };
  assert.deepEqual(load(st), newSave());
});

test("load: valid old save is migrated", () => {
  const st = fakeStorage({ [SAVE_KEY]: JSON.stringify({ xp: 30 }) });
  const s = load(st);
  assert.equal(s.saveVer, 1);
  assert.equal(s.xp, 30);
  assert.equal(s.bytes, 0);
});

test("cap", () => {
  const st = fakeStorage();
  const s = newSave();
  for (let i = 0; i < 60; i++) s.submission_logs.push({ lesson: "1-1", item: i, pass: true, at: "t" });
  store(st, s);
  const back = load(st);
  assert.equal(back.submission_logs.length, 50);
  assert.equal(back.submission_logs[0].item, 10);
  assert.equal(back.submission_logs[49].item, 59);
});

test("store: round trip", () => {
  const st = fakeStorage();
  const s = newSave();
  s.xp = 42; s.outfits.push("lab");
  store(st, s);
  assert.deepEqual(load(st), s);
});

// ---- review fixes (C1–C3, I1–I2, M1–M4) ----

test("C1: valid JSON that is not a plain object is kept in .broken", () => {
  for (const text of ["null", "42", '"x"', "[1,2]"]) {
    const st = fakeStorage({ [SAVE_KEY]: text });
    assert.deepEqual(load(st), newSave(), text);
    assert.equal(st.data[SAVE_KEY + ".broken"], text, text);
  }
});

test("C2: wrong-typed fields fall back to defaults", () => {
  const s = migrate({
    streak: null, settings: null, xp: "30", bytes: "abc",
    completed_lessons: {}, grading_results: null,
    outfit: 5, settings_x: 1, freezes: Infinity,
  });
  assert.deepEqual(s.streak, LEDGER_SHAPE.streak);
  assert.deepEqual(s.settings, LEDGER_SHAPE.settings);
  assert.equal(s.xp, 30);
  assert.equal(s.bytes, 0);
  assert.deepEqual(s.completed_lessons, []);
  assert.deepEqual(s.grading_results, {});
  assert.equal(s.outfit, "basic");
  assert.equal(s.freezes, 0);
});

test("C2: xp 'abc' → 0, nested types guarded", () => {
  const s = migrate({ xp: "abc", streak: { days: "3", todayXp: "x" }, settings: { sound: "yes", name: 7 } });
  assert.equal(s.xp, 0);
  assert.equal(s.streak.days, 3);
  assert.equal(s.streak.todayXp, 0);
  assert.equal(s.settings.sound, true);
  assert.equal(s.settings.name, "");
});

test("C2: null-default fields accept any value", () => {
  const s = migrate({ last_active_at: "2026-10-29T10:00:00Z", streak: { lastGoalDate: "2026-10-28" } });
  assert.equal(s.last_active_at, "2026-10-29T10:00:00Z");
  assert.equal(s.streak.lastGoalDate, "2026-10-28");
});

test("I1: loadEx reports readFailed only when getItem throws", () => {
  const throwing = { getItem() { throw new Error("denied"); }, setItem() {} };
  const a = loadEx(throwing);
  assert.equal(a.readFailed, true);
  assert.deepEqual(a.save, newSave());
  const b = loadEx(fakeStorage({ [SAVE_KEY]: "{깨짐" }));
  assert.equal(b.readFailed, false);
  assert.deepEqual(b.save, newSave());
  const c = loadEx(fakeStorage({ [SAVE_KEY]: JSON.stringify({ xp: 7 }) }));
  assert.equal(c.readFailed, false);
  assert.equal(c.save.xp, 7);
  const d = loadEx(fakeStorage());
  assert.equal(d.readFailed, false);
});

test("I2: __proto__ / constructor / prototype keys are not copied", () => {
  const raw = JSON.parse('{"xp":1,"__proto__":{"polluted":true},"constructor":1,"prototype":2,"streak":{"__proto__":{"p":1},"days":2}}');
  const s = migrate(raw);
  assert.equal(Object.getPrototypeOf(s), Object.prototype);
  assert.equal(Object.getPrototypeOf(s.streak), Object.prototype);
  assert.equal(s.polluted, undefined);
  assert.equal(s.streak.p, undefined);
  assert.equal(Object.hasOwn(s, "constructor"), false);
  assert.equal(Object.hasOwn(s, "prototype"), false);
  assert.equal(s.xp, 1);
  assert.equal(s.streak.days, 2);
  const st = fakeStorage({ [SAVE_KEY]: '{"__proto__":{"polluted":true}}' });
  const l = load(st);
  assert.equal(Object.getPrototypeOf(l), Object.prototype);
  assert.equal({}.polluted, undefined);
});

test("M1: newer saveVer is not downgraded", () => {
  assert.equal(migrate({ saveVer: 3, xp: 1 }).saveVer, 3);
  assert.equal(migrate({ saveVer: 0 }).saveVer, 1);
});

test("M2: successive corruptions keep every broken copy", () => {
  const st = fakeStorage({ [SAVE_KEY]: "{one" });
  load(st);
  st.data[SAVE_KEY] = "{two";
  load(st);
  st.data[SAVE_KEY] = "{three";
  load(st);
  assert.equal(st.data[SAVE_KEY + ".broken"], "{one");
  assert.equal(st.data[SAVE_KEY + ".broken.1"], "{two");
  assert.equal(st.data[SAVE_KEY + ".broken.2"], "{three");
});

test("M2: after .broken.5 is used, .broken.5 is overwritten", () => {
  const init = { [SAVE_KEY + ".broken"]: "b0" };
  for (let i = 1; i <= 5; i++) init[`${SAVE_KEY}.broken.${i}`] = "b" + i;
  init[SAVE_KEY] = "{new";
  const st = fakeStorage(init);
  load(st);
  assert.equal(st.data[SAVE_KEY + ".broken"], "b0");
  assert.equal(st.data[SAVE_KEY + ".broken.4"], "b4");
  assert.equal(st.data[SAVE_KEY + ".broken.5"], "{new");
  assert.equal(st.data[SAVE_KEY + ".broken.6"], undefined);
});

test("M3: migrate result shares no references with input", () => {
  const raw = { completed_lessons: ["1-1"], grading_results: { "1-1": { perfect: true, attempts: 1 } }, streak: { days: 1 }, quests: { ids: ["q_xp20"], progress: { q_xp20: 5 } }, extra: { a: 1 } };
  const s = migrate(raw);
  s.completed_lessons.push("1-2");
  s.grading_results["1-1"].attempts = 9;
  s.quests.ids.push("x");
  s.quests.progress.q_xp20 = 0;
  s.extra.a = 2;
  assert.deepEqual(raw.completed_lessons, ["1-1"]);
  assert.equal(raw.grading_results["1-1"].attempts, 1);
  assert.deepEqual(raw.quests.ids, ["q_xp20"]);
  assert.equal(raw.quests.progress.q_xp20, 5);
  assert.equal(raw.extra.a, 1);
});

test("M4: store returns true on success, false when setItem throws", () => {
  assert.equal(store(fakeStorage(), newSave()), true);
  const full = { getItem: () => null, setItem() { throw new Error("QuotaExceededError"); } };
  assert.equal(store(full, newSave()), false);
});

// ---- final review: value ranges ----

test("range: freezes clamped to integer 0..2", () => {
  assert.equal(migrate({ freezes: 99 }).freezes, 2);
  assert.equal(migrate({ freezes: -1 }).freezes, 0);
  assert.equal(migrate({ freezes: 1.7 }).freezes, 1);
  assert.equal(migrate({ freezes: 2 }).freezes, 2);
});

test("range: xp/bytes/streak/stats are non-negative integers", () => {
  const s = migrate({
    xp: -3, bytes: -5,
    streak: { days: -2, best: 4.9 },
    stats: { lessons: -1, perfect: 2.5, hintfree: "3", fixed: -0.5, review_items: 7 },
  });
  assert.equal(s.xp, 0);
  assert.equal(s.bytes, 0);
  assert.equal(s.streak.days, 0);
  assert.equal(s.streak.best, 4);
  assert.deepEqual(s.stats, { lessons: 0, perfect: 2, hintfree: 3, fixed: 0, review_items: 7 });
  assert.equal(migrate({ xp: 30.9, bytes: 120 }).xp, 30);
  assert.equal(migrate({ bytes: 120 }).bytes, 120);
});

test("range: weak_concepts keeps only finite numbers >= 0", () => {
  assert.deepEqual(migrate({ weak_concepts: { a: "abc", b: 3 } }).weak_concepts, { b: 3 });
  assert.deepEqual(
    migrate({ weak_concepts: { a: -1, b: 0, c: Infinity, d: null, e: 2, f: "2" } }).weak_concepts,
    { b: 0, e: 2 },
  );
});
