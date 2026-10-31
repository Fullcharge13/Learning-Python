import { test } from "node:test";
import assert from "node:assert/strict";
import { SAVE_KEY, SAVE_VER, newSave, migrate, load, loadEx, store, takeRefundNotice, refundNoticeText } from "../../src/save.js";

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

const LEDGER_SHAPE = {
  saveVer: 2,
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
  pending_refund: 0,
};

test("constants", () => {
  assert.equal(SAVE_KEY, "ria-python.save");
  assert.equal(SAVE_VER, 2);
});

test("new", () => {
  const s = newSave();
  assert.equal(s.saveVer, 2);
  assert.equal(s.xp, 0);
  assert.equal(s.bytes, 0);
  assert.equal(s.outfit, "basic");
});

test("new: exactly the ledger Save shape", () => {
  assert.deepEqual(newSave(), LEDGER_SHAPE);
});

test("new: returns independent objects", () => {
  const a = newSave();
  a.outfits.push("casual");
  a.streak.days = 5;
  const b = newSave();
  assert.deepEqual(b.outfits, ["basic"]);
  assert.equal(b.streak.days, 0);
});

test("migrate", () => {
  const s = migrate({ xp: 30 });
  assert.equal(s.saveVer, 2);
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
  assert.equal(s.saveVer, 2);
  assert.deepEqual(s.completed_lessons, ["1-1"]);
  assert.deepEqual(s.streak, { days: 3, best: 0, lastGoalDate: "2026-10-28", todayDate: null, todayXp: 0 });
  assert.deepEqual(s.settings, { sound: false, dailyGoal: 20, name: "" });
  assert.deepEqual(s.stats, LEDGER_SHAPE.stats);
  assert.deepEqual(s.quests, LEDGER_SHAPE.quests);
});

test("migrate: full current (v2) save passes through unchanged", () => {
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
  assert.equal(s.saveVer, 2);
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
  s.xp = 42; s.outfits.push("casual");
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
  assert.equal(migrate({ saveVer: 0 }).saveVer, 2);
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

// ---- v0.6 의상 교체: saveVer 1 → 2 (설계 2026-10-31 §2) ----
import { OUTFITS } from "../../data/outfits.js";

const v1 = (outfits, outfit = "basic", over = {}) => ({ ...JSON.parse(JSON.stringify(LEDGER_SHAPE)), saveVer: 1, outfits, outfit, ...over });

test("v2 rename rows: lab→whitecoat, chef→chef, camping→explorer, astronaut→graduate", () => {
  for (const [oldId, newId] of [["lab", "whitecoat"], ["chef", "chef"], ["camping", "explorer"], ["astronaut", "graduate"]]) {
    const s = migrate(v1(["basic", oldId], oldId, { bytes: 7 }));
    assert.deepEqual(s.outfits, ["basic", newId], oldId);
    assert.equal(s.outfit, newId, oldId + " 입은 옷도 새 id로");
    assert.equal(s.bytes, 7, oldId + " 환불 없음");
    assert.equal(s.saveVer, 2);
  }
});

test("v2 refund rows: detective·painter·gardener 180, rain 240, worn one falls back to basic", () => {
  for (const [oldId, price] of [["detective", 180], ["painter", 180], ["gardener", 180], ["rain", 240]]) {
    const s = migrate(v1(["basic", oldId], oldId, { bytes: 5 }));
    assert.deepEqual(s.outfits, ["basic"], oldId);
    assert.equal(s.bytes, 5 + price, oldId);
    assert.equal(s.outfit, "basic", oldId);
  }
});

test("v2 refund sum: all nine old outfits → 780 bytes back, 5 owned", () => {
  const all = ["basic", "lab", "detective", "chef", "painter", "gardener", "rain", "camping", "astronaut"];
  const s = migrate(v1(all, "painter", { bytes: 20 }));
  assert.equal(s.bytes, 20 + 180 + 180 + 180 + 240);
  assert.deepEqual(s.outfits, ["basic", "whitecoat", "chef", "explorer", "graduate"]);
  assert.equal(s.outfit, "basic");
});

test("v2 dedupe: old id + its new pair (and repeats) → one, refunds counted once", () => {
  const s = migrate(v1(["basic", "lab", "whitecoat", "lab", "rain", "rain", "basic"], "whitecoat"));
  assert.deepEqual(s.outfits, ["basic", "whitecoat"]);
  assert.equal(s.bytes, 240);
  assert.equal(s.outfit, "whitecoat");
});

test("v2 unknown ids: dropped without refund, never crash; basic always owned", () => {
  const s = migrate(v1(["pirate", 7, null, "lab", "__proto__"], "pirate", { bytes: 3 }));
  assert.deepEqual(s.outfits, ["basic", "whitecoat"]);
  assert.equal(s.outfit, "basic");
  assert.equal(s.bytes, 3);
  const e = migrate(v1([], 42));
  assert.deepEqual(e.outfits, ["basic"]);
  assert.equal(e.outfit, "basic");
});

test("v2: worn outfit not owned → basic; owned new outfit kept", () => {
  assert.equal(migrate(v1(["basic"], "chef")).outfit, "basic");
  assert.equal(migrate({ saveVer: 2, outfits: ["basic", "wizard"], outfit: "wizard" }).outfit, "wizard");
  assert.equal(migrate({ saveVer: 2, outfits: ["basic"], outfit: "wizard" }).outfit, "basic");
});

test("v2: save without saveVer is treated as v1 (refunds apply)", () => {
  const s = migrate({ outfits: ["basic", "gardener", "camping"], outfit: "camping", bytes: 1 });
  assert.deepEqual(s.outfits, ["basic", "explorer"]);
  assert.equal(s.outfit, "explorer");
  assert.equal(s.bytes, 181);
});

test("v2: a v2 save with old/unknown ids loads, no refund (refunds only from v1)", () => {
  const s = migrate({ saveVer: 2, outfits: ["basic", "rain", "future_x", "gym"], outfit: "future_x", bytes: 10 });
  assert.deepEqual(s.outfits, ["basic", "gym"]);
  assert.equal(s.outfit, "basic");
  assert.equal(s.bytes, 10);
});

test("v2 idempotent: migrating twice gives the same save, bytes not refunded twice", () => {
  const all = ["basic", "lab", "detective", "chef", "painter", "gardener", "rain", "camping", "astronaut", "zzz"];
  const once = migrate(v1(all, "lab", { bytes: 11 }));
  const twice = migrate(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
  assert.equal(twice.bytes, 11 + 780);
});

test("v2: every owned id after migrate is in the outfit table", () => {
  const ids = new Set(OUTFITS.map((o) => o.id));
  const s = migrate(v1(["basic", "lab", "detective", "camping", "astronaut", "x"], "x"));
  for (const id of s.outfits) assert.ok(ids.has(id), id);
  assert.ok(ids.has(s.outfit));
});

test("v2 load: old v1 text in storage is migrated; broken text still kept in .broken", () => {
  const st = fakeStorage({ [SAVE_KEY]: JSON.stringify(v1(["basic", "lab", "rain"], "rain", { bytes: 0, xp: 50 })) });
  const s = load(st);
  assert.equal(s.saveVer, 2);
  assert.equal(s.xp, 50);
  assert.deepEqual(s.outfits, ["basic", "whitecoat"]);
  assert.equal(s.outfit, "basic");
  assert.equal(s.bytes, 240);
  const br = fakeStorage({ [SAVE_KEY]: '{"saveVer":1,"outfits":["lab"' });
  assert.deepEqual(load(br), newSave());
  assert.equal(br.data[SAVE_KEY + ".broken"], '{"saveVer":1,"outfits":["lab"');
});

test("v2: newer saveVer (3) is not downgraded and still loads", () => {
  const s = migrate({ saveVer: 3, outfits: ["basic", "hologram"], outfit: "hologram" });
  assert.equal(s.saveVer, 3);
  assert.equal(s.outfit, "basic");
});

// ---- 판정 C42: 환불 안내는 한 번만 ----
test("C42 refund notice: v1 환불 금액을 pending_refund에 남기고, 다시 옮겨도 늘지 않음", () => {
  const s = migrate(v1(["basic", "detective", "rain"], "detective", { bytes: 2 }));
  assert.equal(s.pending_refund, 420);
  assert.equal(s.bytes, 422);
  const again = migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(again.pending_refund, 420);
  assert.equal(again.bytes, 422);
  assert.equal(migrate(v1(["basic", "lab"], "lab")).pending_refund, 0, "환불 없으면 0");
  assert.equal(newSave().pending_refund, 0);
});

test("C42 refund notice: take는 한 번만 금액을 돌려주고 깃발(0)을 남긴다", () => {
  const s = migrate(v1(["basic", "painter"], "basic"));
  const r1 = takeRefundNotice(s);
  assert.equal(r1.bytes, 180);
  assert.equal(r1.save.pending_refund, 0);
  assert.equal(s.pending_refund, 180, "원본 불변");
  assert.equal(r1.save.bytes, s.bytes, "바이트는 이미 들어가 있음 — 다시 더하지 않음");
  const r2 = takeRefundNotice(r1.save);
  assert.equal(r2.bytes, 0);
  assert.equal(r2.save, r1.save, "보여 줄 것 없으면 같은 저장");
  // 저장 → 다시 읽기(새로 고침)해도 다시 나오지 않음
  const st = fakeStorage();
  store(st, r1.save);
  assert.equal(takeRefundNotice(load(st)).bytes, 0);
});

test("C42 refund notice: 이상한 값은 0으로", () => {
  for (const bad of [-5, "abc", null, 1.7, Infinity]) assert.ok(migrate({ saveVer: 2, pending_refund: bad }).pending_refund >= 0, String(bad));
  assert.equal(migrate({ saveVer: 2, pending_refund: -5 }).pending_refund, 0);
  assert.equal(migrate({ saveVer: 2, pending_refund: 1.7 }).pending_refund, 1);
  assert.equal(takeRefundNotice(migrate({ saveVer: 2, pending_refund: "x" })).bytes, 0);
});

test("C42 refund notice text", () => {
  assert.equal(refundNoticeText(780), "없어진 옷 값 780바이트를 돌려 드렸어요. 새 옷도 구경해 보세요!");
});
