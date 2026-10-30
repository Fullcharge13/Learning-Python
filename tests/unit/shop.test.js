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

test("OUTFITS table: 9 ledger ids with spec prices", () => {
  const price = Object.fromEntries(OUTFITS.map((o) => [o.id, o.price]));
  assert.deepEqual(OUTFITS.map((o) => o.id),
    ["basic", "lab", "detective", "chef", "painter", "gardener", "rain", "camping", "astronaut"]);
  assert.deepEqual(price, { basic: null, lab: 100, detective: 180, chef: 180, painter: 180,
    gardener: 180, rain: 240, camping: 240, astronaut: null });
  for (const o of OUTFITS) assert.match(o.name, /[가-힣]/);
});

test("buy: 100 bytes buys lab -> 0 bytes, owned; again -> error; astronaut -> error", () => {
  const s0 = mkSave({ bytes: 100 });
  const s1 = buy(s0, "lab");
  assert.ok(!(s1 instanceof Error));
  assert.equal(s1.bytes, 0);
  assert.ok(s1.outfits.includes("lab"));
  assert.equal(s0.bytes, 100);
  assert.deepEqual(s0.outfits, ["basic"]);
  const again = buy({ ...s1, bytes: 500 }, "lab");
  assert.ok(again instanceof Error);
  const astro = buy(mkSave({ bytes: 9999 }), "astronaut");
  assert.ok(astro instanceof Error);
});

test("buy errors: insufficient bytes, unknown id, basic not for sale", () => {
  assert.ok(buy(mkSave({ bytes: 179 }), "chef") instanceof Error);
  assert.ok(buy(mkSave({ bytes: 99 }), "lab") instanceof Error);
  assert.ok(buy(mkSave({ bytes: 9999 }), "pirate") instanceof Error);
  assert.ok(buy(mkSave({ bytes: 9999 }), "basic") instanceof Error);
});

test("buy does not change the worn outfit", () => {
  const s = buy(mkSave({ bytes: 240 }), "rain");
  assert.equal(s.outfit, "basic");
  assert.equal(s.bytes, 0);
});
