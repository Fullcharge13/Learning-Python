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

// v0.22.0: 새 의상 3벌(new1~3) 자리. 이름·그림은 작업 7에서 정한다(id는 그대로)
const NEW_IDS = ["basic", "casual", "whitecoat", "hoodie", "gym", "chef", "explorer", "uniform", "wizard", "graduate", "new1", "new2", "new3"];
const PLACEHOLDER = new Set(["new1", "new2", "new3"]);

test("OUTFITS table: v0.6 10벌 + v0.22.0 새 의상 3벌, 설계서 가격·얻는 법", () => {
  const price = Object.fromEntries(OUTFITS.map((o) => [o.id, o.price]));
  assert.deepEqual(OUTFITS.map((o) => o.id), NEW_IDS);
  assert.deepEqual(price, { basic: null, casual: 100, whitecoat: 180, hoodie: 180, gym: 180, chef: 180,
    explorer: 240, uniform: 240, wizard: 300, graduate: null, new1: 300, new2: 360, new3: 400 });
  assert.equal(OUTFITS.find((o) => o.id === "basic").unlock, "start");
  assert.equal(OUTFITS.find((o) => o.id === "graduate").unlock, "streak30");
  for (const o of OUTFITS) {
    assert.match(o.name, /[가-힣]/, o.id);
    // 자리 이름(「새 의상 1」)만 숫자를 허용 — 작업 7에서 진짜 이름으로 바꾸면 이 예외를 지운다
    assert.match(o.short, PLACEHOLDER.has(o.id) ? /^[가-힣 ·0-9]+$/ : /^[가-힣 ·]+$/, o.id + " short: 조사 없이 대사에 들어가는 짧은 이름");
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
  const s = buy(mkSave({ bytes: 300, levels: { granted: 1, pending_welcome: 0, legacy: true } }), "wizard"); // v0.22.0: Lv20 상품이라 legacy 저장으로
  assert.equal(s.outfit, "basic");
  assert.equal(s.bytes, 0);
});

test("voice: 탐정 말투(detective)는 탐험가 의상 하나에만 (판정 C42)", () => {
  assert.deepEqual(OUTFITS.filter((o) => o.voice).map((o) => [o.id, o.voice]), [["explorer", "detective"]]);
});

// ---- v0.22.0 상점: 레벨·legacy 사기 규칙, 꾸미기 (설계 2026-11-17 §5-4, §5-5) ----
import { canBuy, buyItem, owns, setDeco } from "../../src/shop.js";
import { SHOP_ITEMS } from "../../data/shop.js";
import { xpForLevel } from "../../src/levels.js";

const ORIGINAL_8 = ["casual", "whitecoat", "hoodie", "gym", "chef", "explorer", "uniform", "wizard"];
// 설계서 §5-4 표 그대로: [id, kind, level, price]
const TABLE_5_4 = [
  ["casual", "outfit", 1, 100], ["ed_paper", "editor", 1, 60],
  ["hoodie", "outfit", 3, 180], ["gd_fence", "garden", 3, 80],
  ["gym", "outfit", 5, 180], ["ed_forest", "editor", 5, 100],
  ["chef", "outfit", 8, 180], ["gu_night", "guard", 8, 120],
  ["whitecoat", "outfit", 10, 180], ["ws_wood", "workshop", 10, 120],
  ["explorer", "outfit", 13, 240], ["gd_flowers", "garden", 13, 140],
  ["uniform", "outfit", 15, 240], ["ed_sea", "editor", 15, 150],
  ["new1", "outfit", 18, 300], ["gu_control", "guard", 18, 180],
  ["wizard", "outfit", 20, 300], ["ws_metal", "workshop", 20, 180],
  ["new2", "outfit", 23, 360], ["ed_night", "editor", 23, 200],
  ["gd_greenhouse", "garden", 26, 240],
  ["new3", "outfit", 28, 400],
];
const atLv = (L, over = {}) => mkSave({ xp: xpForLevel(L), levels: { granted: L, pending_welcome: 0, legacy: false }, ...over });
const legacyAt = (L, over = {}) => atLv(L, { levels: { granted: L, pending_welcome: 0, legacy: true }, ...over });

test("shop: SHOP_ITEMS는 설계서 §5-4 표의 (kind, level, price)와 같다", () => {
  const got = SHOP_ITEMS.map((i) => [i.id, i.kind, i.level, i.price]);
  const sortKey = (r) => r[0];
  assert.deepEqual([...got].sort((a, b) => sortKey(a).localeCompare(sortKey(b))), [...TABLE_5_4].sort((a, b) => sortKey(a).localeCompare(sortKey(b))));
});

test("shop: id는 겹치지 않고, 의상 행은 OUTFITS에 있고 값이 같다, level은 1~30", () => {
  const ids = SHOP_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const i of SHOP_ITEMS) {
    assert.ok(["outfit", "garden", "guard", "workshop", "editor"].includes(i.kind), i.id);
    assert.ok(Number.isInteger(i.level) && i.level >= 1 && i.level <= 30, i.id);
    assert.ok(Number.isInteger(i.price) && i.price > 0, i.id);
    if (i.kind === "outfit") {
      const o = OUTFITS.find((x) => x.id === i.id);
      assert.ok(o, i.id + ": OUTFITS에 있음");
      assert.equal(o.price, i.price, i.id + ": 의상실 값과 같음");
    }
  }
  assert.deepEqual(SHOP_ITEMS.filter((i) => i.legacyFree).map((i) => i.id).sort(), [...ORIGINAL_8].sort());
  assert.ok(!SHOP_ITEMS.some((i) => i.id === "basic" || i.id === "graduate"));
});

test("shop: 레벨이 모자라면 reason level과 needLevel", () => {
  assert.deepEqual(canBuy(atLv(1, { bytes: 9999 }), "hoodie"), { ok: false, reason: "level", needLevel: 3 });
  assert.deepEqual(canBuy(atLv(9, { bytes: 9999 }), "gd_flowers"), { ok: false, reason: "level", needLevel: 13 });
  const r = buyItem(atLv(1, { bytes: 9999 }), "hoodie");
  assert.ok(r instanceof Error);
  assert.equal(r.reason, "level");
  assert.deepEqual(canBuy(atLv(3, { bytes: 180 }), "hoodie"), { ok: true, reason: null, needLevel: 3 });
});

test("shop: legacy 저장은 마법사 망토(Lv20)를 Lv1에서 바이트만으로 산다. new1은 레벨 제한", () => {
  const s = legacyAt(1, { bytes: 300 });
  assert.equal(canBuy(s, "wizard").ok, true);
  const r = buyItem(s, "wizard");
  assert.ok(!(r instanceof Error), String(r));
  assert.equal(r.bytes, 0);
  assert.ok(r.outfits.includes("wizard"));
  assert.deepEqual(canBuy(legacyAt(1, { bytes: 9999 }), "new1"), { ok: false, reason: "level", needLevel: 18 });
  assert.equal(canBuy(legacyAt(1, { bytes: 9999 }), "ed_forest").reason, "level", "꾸미기도 legacy 예외 없음");
  for (const id of ORIGINAL_8) assert.equal(canBuy(legacyAt(1, { bytes: 9999 }), id).ok, true, id);
});

test("shop: 새 저장은 원래 8벌에도 레벨 제한", () => {
  assert.deepEqual(canBuy(atLv(1, { bytes: 9999 }), "wizard"), { ok: false, reason: "level", needLevel: 20 });
  assert.equal(canBuy(atLv(19, { bytes: 9999 }), "wizard").reason, "level");
  assert.equal(canBuy(atLv(20, { bytes: 9999 }), "wizard").ok, true);
  assert.equal(canBuy(atLv(1, { bytes: 9999 }), "casual").ok, true, "Lv1 상품은 바로");
  // levels 칸이 없는 저장(옮기기 전 모양)은 legacy가 아닌 것으로 본다(옮기기는 save.js가 함)
  assert.equal(canBuy(mkSave({ xp: 0, bytes: 9999 }), "wizard").reason, "level");
});

test("shop: bytes·owned·notsold 이유", () => {
  assert.deepEqual(canBuy(atLv(20, { bytes: 299 }), "wizard"), { ok: false, reason: "bytes", needLevel: 20 });
  assert.equal(canBuy(atLv(20, { bytes: 9999, outfits: ["basic", "wizard"] }), "wizard").reason, "owned");
  assert.equal(canBuy(atLv(1, { bytes: 9999, outfits: ["basic"] }), "basic").reason, "notsold");
  assert.equal(canBuy(atLv(30, { bytes: 9999 }), "graduate").reason, "notsold");
  assert.equal(canBuy(atLv(30, { bytes: 9999 }), "pirate").reason, "notsold");
  assert.equal(canBuy(atLv(30, { bytes: 9999 }), "__proto__").reason, "notsold");
  const owned = atLv(30, { bytes: 9999, deco: { owned: ["gd_fence"], on: { garden: null, guard: null, workshop: null, editor: null } } });
  assert.equal(canBuy(owned, "gd_fence").reason, "owned");
  // 가진 것은 레벨이 모자라도 「가지고 있음」(owned가 level보다 먼저)
  assert.equal(canBuy(atLv(1, { outfits: ["basic", "wizard"] }), "wizard").reason, "owned");
  const e = buyItem(atLv(1, { bytes: 50 }), "casual");
  assert.ok(e instanceof Error);
  assert.equal(e.reason, "bytes");
});

test("shop: 꾸미기를 사면 deco.owned에 들어가고 켜지지는 않는다, 원본 불변", () => {
  const s = atLv(3, { bytes: 100 });
  const r = buyItem(s, "gd_fence");
  assert.ok(!(r instanceof Error), String(r));
  assert.equal(r.bytes, 20);
  assert.deepEqual(r.deco.owned, ["gd_fence"]);
  assert.equal(r.deco.on.garden, null);
  assert.deepEqual(r.outfits, ["basic"]);
  assert.equal(s.bytes, 100);
  assert.equal(s.deco, undefined);
  assert.ok(owns(r, "gd_fence"));
  assert.ok(!owns(s, "gd_fence"));
  assert.ok(owns(s, "basic"));
  assert.ok(!owns(s, "nope"));
});

test("shop: buy는 buyItem을 그대로 부른다(의상실용)", () => {
  const a = buy(legacyAt(1, { bytes: 300 }), "wizard");
  const b = buyItem(legacyAt(1, { bytes: 300 }), "wizard");
  assert.deepEqual(a, b);
  assert.equal(buy(atLv(1, { bytes: 9999 }), "wizard").reason, "level");
});

test("shop: 가진 상품은 레벨과 상관없음 — 가진 꾸미기는 Lv1에서도 setDeco로 켠다", () => {
  const s = atLv(1, { deco: { owned: ["gd_greenhouse"], on: { garden: null, guard: null, workshop: null, editor: null } } });
  const r = setDeco(s, "garden", "gd_greenhouse");
  assert.ok(!(r instanceof Error), String(r));
  assert.equal(r.deco.on.garden, "gd_greenhouse");
  assert.equal(s.deco.on.garden, null, "원본 불변");
  const off = setDeco(r, "garden", null);
  assert.equal(off.deco.on.garden, null);
  assert.deepEqual(off.deco.owned, ["gd_greenhouse"], "끄도 가진 것은 그대로");
});

test("shop: setDeco는 가지지 않은 것, 다른 공간의 id, 모르는 공간을 거절", () => {
  const s = atLv(30, { deco: { owned: ["gd_fence", "ed_sea"], on: { garden: null, guard: null, workshop: null, editor: null } } });
  assert.ok(setDeco(s, "garden", "gd_flowers") instanceof Error, "가지지 않음");
  assert.equal(setDeco(s, "garden", "gd_flowers").reason, "notowned", "검토 M1: canBuy의 owned(이미 가짐)와 다른 이름");
  assert.equal(setDeco(s, "editor", "gd_fence").reason, "space");
  assert.ok(setDeco(s, "editor", "gd_fence") instanceof Error, "다른 공간");
  assert.ok(setDeco(s, "garden", "casual") instanceof Error, "의상");
  assert.ok(setDeco(s, "kitchen", null) instanceof Error, "모르는 공간");
  assert.ok(setDeco(s, "__proto__", null) instanceof Error);
  assert.equal(setDeco(s, "editor", "ed_sea").deco.on.editor, "ed_sea");
  assert.equal(setDeco(mkSave(), "guard", null).deco.on.guard, null, "deco 없는 저장도 끌 수 있음");
});
