import { test } from "node:test";
import assert from "node:assert/strict";
import { buy } from "../../src/shop.js";
import { OUTFITS } from "../../data/outfits.js";

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

const NEW_IDS = ["basic", "casual", "whitecoat", "hoodie", "gym", "chef", "explorer", "uniform", "wizard", "graduate"];

test("OUTFITS table: v0.6 10벌, 설계서 가격·얻는 법", () => {
  const price = Object.fromEntries(OUTFITS.map((o) => [o.id, o.price]));
  assert.deepEqual(OUTFITS.map((o) => o.id), NEW_IDS);
  assert.deepEqual(price, { basic: null, casual: 100, whitecoat: 180, hoodie: 180, gym: 180, chef: 180,
    explorer: 240, uniform: 240, wizard: 300, graduate: null });
  assert.equal(OUTFITS.find((o) => o.id === "basic").unlock, "start");
  assert.equal(OUTFITS.find((o) => o.id === "graduate").unlock, "streak30");
  for (const o of OUTFITS) {
    assert.match(o.name, /[가-힣]/, o.id);
    assert.match(o.short, /^[가-힣 ·]+$/, o.id + " short: 조사 없이 대사에 들어가는 짧은 이름");
    assert.ok(typeof o.desc === "string" && /[가-힣]/.test(o.desc) && o.desc.length <= 30, o.id + " desc");
    assert.ok(!/python/i.test(o.name + o.short + o.desc), o.id + ": 상표 이름 안 씀");
  }
  assert.equal(new Set(OUTFITS.map((o) => o.desc)).size, OUTFITS.length, "설명은 모두 다름");
  assert.equal(OUTFITS.find((o) => o.id === "basic").desc, "언제나 친절한 리아 교수!");
});

test("buy: 100 bytes buys casual -> 0 bytes, owned; again -> error; graduate -> error", () => {
  const s0 = mkSave({ bytes: 100 });
  const s1 = buy(s0, "casual");
  assert.ok(!(s1 instanceof Error));
  assert.equal(s1.bytes, 0);
  assert.ok(s1.outfits.includes("casual"));
  assert.equal(s0.bytes, 100);
  assert.deepEqual(s0.outfits, ["basic"]);
  const again = buy({ ...s1, bytes: 500 }, "casual");
  assert.ok(again instanceof Error);
  const grad = buy(mkSave({ bytes: 9999 }), "graduate");
  assert.ok(grad instanceof Error);
});

test("buy errors: insufficient bytes, unknown/old id, basic not for sale", () => {
  assert.ok(buy(mkSave({ bytes: 179 }), "chef") instanceof Error);
  assert.ok(buy(mkSave({ bytes: 99 }), "casual") instanceof Error);
  assert.ok(buy(mkSave({ bytes: 299 }), "wizard") instanceof Error);
  assert.ok(buy(mkSave({ bytes: 9999 }), "pirate") instanceof Error);
  assert.ok(buy(mkSave({ bytes: 9999 }), "lab") instanceof Error);
  assert.ok(buy(mkSave({ bytes: 9999 }), "basic") instanceof Error);
});

test("buy does not change the worn outfit", () => {
  const s = buy(mkSave({ bytes: 300 }), "wizard");
  assert.equal(s.outfit, "basic");
  assert.equal(s.bytes, 0);
});

test("voice: 탐정 말투(detective)는 탐험가 의상 하나에만 (판정 C42)", () => {
  assert.deepEqual(OUTFITS.filter((o) => o.voice).map((o) => [o.id, o.voice]), [["explorer", "detective"]]);
});
