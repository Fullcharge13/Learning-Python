// v0.22.0 레벨 셈·레벨업 선물 (설계 §5-1, §5-2)
// 기대값은 되도록 내보낸 상수·함수로 계산한다(작업 3에서 60·10·20·2를 바꿔도 몇 줄만 고치게).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_MAX, LEVEL_BASE, LEVEL_STEP, GIFT_BASE, GIFT_STEP,
  xpForLevel, levelOf, levelProgress, levelGift, levelTitle, applyLevels, newLevels, cleanLevels,
} from "../../src/levels.js";

const withXp = (xp, granted) => ({ xp, bytes: 0, levels: { granted, pending_welcome: 0, legacy: false } });

test("levels: 상수", () => {
  assert.equal(LEVEL_MAX, 30);
  for (const c of [LEVEL_BASE, LEVEL_STEP, GIFT_BASE, GIFT_STEP]) assert.ok(Number.isInteger(c) && c > 0);
});

test("levels: xpForLevel 닻 값", () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 30);
  assert.equal(xpForLevel(3), 70);
  assert.equal(xpForLevel(10), 630);
  // tests/flow.py _level_of가 이 곡선(LEVEL_BASE 30, LEVEL_STEP 10)을 그대로 베낀다 — 곡선을 바꾸면 그쪽도(작업 4 검토 M5)
  assert.equal(xpForLevel(13), 1020);
  assert.equal(xpForLevel(30), 4930);
});

test("levels: n→n+1 필요 XP = BASE + STEP × (n − 1)", () => {
  for (let n = 1; n < LEVEL_MAX; n++) {
    assert.equal(xpForLevel(n + 1) - xpForLevel(n), LEVEL_BASE + LEVEL_STEP * (n - 1));
  }
});

test("levels: levelOf 경계", () => {
  assert.equal(levelOf(29), 1);
  assert.equal(levelOf(30), 2);
  assert.equal(levelOf(69), 2);
  assert.equal(levelOf(70), 3);
  assert.equal(levelOf(4929), 29);
  assert.equal(levelOf(4930), 30);
  assert.equal(levelOf(99999), 30);
  assert.equal(levelOf(-5), 1);
  assert.equal(levelOf(NaN), 1);
  assert.equal(levelOf(undefined), 1);
  assert.equal(levelOf("30"), 1);
  for (let L = 1; L <= LEVEL_MAX; L++) {
    assert.equal(levelOf(xpForLevel(L)), L);
    if (L > 1) assert.equal(levelOf(xpForLevel(L) - 1), L - 1);
  }
});

test("levels: levelProgress", () => {
  assert.deepEqual(levelProgress(0), { level: 1, into: 0, need: xpForLevel(2) });
  assert.deepEqual(levelProgress(xpForLevel(2) + 5), { level: 2, into: 5, need: xpForLevel(3) - xpForLevel(2) });
  assert.deepEqual(levelProgress(xpForLevel(LEVEL_MAX)), { level: LEVEL_MAX, into: 0, need: 0 });
  assert.deepEqual(levelProgress(99999), { level: LEVEL_MAX, into: 0, need: 0 });
  assert.deepEqual(levelProgress(NaN), { level: 1, into: 0, need: xpForLevel(2) });
});

test("levels: levelGift = GIFT_BASE + GIFT_STEP × L", () => {
  assert.equal(levelGift(2), 14);
  assert.equal(levelGift(30), 70);
  for (let L = 2; L <= LEVEL_MAX; L++) assert.equal(levelGift(L), GIFT_BASE + GIFT_STEP * L);
});

test("levels: levelTitle 5레벨마다", () => {
  const want = ["새싹", "떡잎", "정원사", "탐험가", "연구원", "마스터 파이썬"];
  for (let L = 1; L <= LEVEL_MAX; L++) {
    const tier = Math.floor((L - 1) / 5);
    assert.deepEqual(levelTitle(L), { ko: want[tier], key: `level.title.${tier + 1}` });
  }
  assert.equal(levelTitle(0).ko, "새싹");
  assert.equal(levelTitle(99).ko, "마스터 파이썬");
});

test("levels: 한 레벨 오름 → 선물 바이트를 더함", () => {
  const prev = withXp(xpForLevel(2) - 1, 1);
  const next = { ...prev, xp: xpForLevel(2) };
  const r = applyLevels(prev, next);
  assert.deepEqual(r.levelUp, { from: 1, to: 2, bytes: levelGift(2) });
  assert.equal(r.save.bytes, levelGift(2));
  assert.equal(r.save.levels.granted, 2);
  assert.equal(next.levels.granted, 1); // 원본은 그대로
});

test("levels: 두 레벨을 한 번에", () => {
  const r = applyLevels(withXp(20, 1), withXp(80, 1));
  assert.deepEqual(r.levelUp, { from: 1, to: 3, bytes: 14 + 16 });
  assert.equal(r.save.bytes, 30);
  assert.equal(r.save.levels.granted, 3);
});

test("levels: 같은 선물을 두 번 주지 않음", () => {
  const r = applyLevels(withXp(xpForLevel(3), 3), withXp(xpForLevel(3) + 30, 3));
  assert.equal(r.levelUp, null);
  assert.equal(r.save.bytes, 0);
  // granted가 이미 높으면(예: 받은 뒤) 그 레벨까지는 다시 주지 않음
  const r2 = applyLevels(withXp(xpForLevel(2), 5), withXp(xpForLevel(5), 5));
  assert.equal(r2.levelUp, null);
});

test("levels: 최고 레벨 뒤", () => {
  const r = applyLevels(withXp(xpForLevel(30), 30), withXp(xpForLevel(30) + 500, 30));
  assert.equal(r.levelUp, null);
});

test("levels: levels 칸이 없는 저장도 지나간 레벨 선물은 주지 않음", () => {
  const r = applyLevels({ xp: xpForLevel(5), bytes: 0 }, { xp: xpForLevel(6), bytes: 0 });
  assert.deepEqual(r.levelUp, { from: 5, to: 6, bytes: levelGift(6) });
  assert.equal(r.save.levels.granted, 6);
});

test("levels: newLevels·cleanLevels", () => {
  assert.deepEqual(newLevels(), { granted: 1, pending_welcome: 0, legacy: false });
  const L13 = xpForLevel(13);
  // 망가진 levels: legacy = xp > 0(기존 학습자가 원래 8벌 예외를 잃지 않게, 판정)
  assert.deepEqual(cleanLevels("x", L13), { granted: 13, pending_welcome: 0, legacy: true });
  assert.deepEqual(cleanLevels(null, L13), { granted: 13, pending_welcome: 0, legacy: true });
  assert.deepEqual(cleanLevels({ granted: -1 }, L13), { granted: 13, pending_welcome: 0, legacy: true });
  assert.deepEqual(cleanLevels({ granted: 2.5, pending_welcome: -3, legacy: "y" }, L13), { granted: 13, pending_welcome: 0, legacy: true });
  assert.deepEqual(cleanLevels("x", 0), { granted: 1, pending_welcome: 0, legacy: false });
  assert.equal(cleanLevels({ granted: 13, legacy: false }, L13).legacy, false, "바른 false는 그대로");
  assert.deepEqual(cleanLevels({ granted: 99 }, L13).granted, LEVEL_MAX);
  // 바른 값은 그대로(지금 레벨보다 낮은 granted도 — applyLevels가 이전 XP의 레벨부터 셈)
  assert.deepEqual(cleanLevels({ granted: 14, pending_welcome: 120, legacy: true }, L13), { granted: 14, pending_welcome: 120, legacy: true });
  assert.equal(cleanLevels({ granted: 3 }, L13).granted, 3);
});
