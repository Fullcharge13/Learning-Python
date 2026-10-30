// 작업 12: 바이트 경제 시뮬레이션이 같은 씨앗에서 같은 결과를 내고, 숫자가 깨지지 않는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSim } from "../sim/economy.js";

const NUM_KEYS = ["bytesPerActiveDay", "freezesUsed", "streakBroken", "finalStreak", "outfitsOwned", "activeDays"];

test("같은 씨앗 → 같은 결과", () => {
  const a = runSim(1);
  const b = runSim(1);
  assert.deepEqual(a, b);
});

test("숫자에 NaN이 없고 범위가 맞음", () => {
  const r = runSim(1);
  for (const k of NUM_KEYS) {
    assert.equal(typeof r[k], "number", k);
    assert.ok(Number.isFinite(r[k]), `${k}=${r[k]}`);
  }
  assert.ok(r.firstOutfitDay === null || (Number.isInteger(r.firstOutfitDay) && r.firstOutfitDay >= 1 && r.firstOutfitDay <= 30));
  assert.equal(r.activeDays, 26); // 30일 중 4일 빠짐(빠짐 3번, 그중 1번은 이틀)
  assert.ok(r.bytesPerActiveDay > 0);
  assert.ok(Array.isArray(r.milestones));
});

test("다른 씨앗은 다른 결과를 낼 수 있음", () => {
  const rs = [1, 2, 3, 4].map((s) => JSON.stringify(runSim(s)));
  assert.ok(new Set(rs).size > 1);
});
