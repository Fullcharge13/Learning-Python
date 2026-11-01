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

// 실제 레슨 표를 쓰는지: 코스 길이 = data/lessons/ch*.js 의 레슨 수, --lessons N 이면 앞의 N개
test("코스 길이는 실제 레슨 수, lessons 옵션은 앞 N개로 자름", async () => {
  const { readdirSync } = await import("node:fs");
  const dir = new URL("../../data/lessons/", import.meta.url);
  let total = 0;
  for (const f of readdirSync(dir).filter((x) => /^ch\d+\.js$/.test(x))) {
    total += (await import(new URL(f, dir).href)).LESSONS.length;
  }
  assert.ok(total >= 15);
  assert.equal(runSim(1).courseLength, total);
  assert.equal(runSim(1, { lessons: 15 }).courseLength, 15);
});

// v0.7 작업 1: 심화도 하는 학습자(장 평가를 끝내면 그 장 심화 3개를 먼저 함)
test("advanced 옵션: 심화를 끝내고, 본 과정 길이는 그대로, 같은 씨앗은 같은 결과", () => {
  const base = runSim(1);
  const a = runSim(1, { advanced: true });
  assert.deepEqual(a, runSim(1, { advanced: true }));
  assert.equal(a.courseLength, base.courseLength, "courseLength는 본 과정만");
  assert.ok(a.advancedDone > 0, `advancedDone=${a.advancedDone}`);
  assert.equal(base.advancedDone, 0);
  assert.ok(a.advancedTotal >= 18, "v0.7: 1~6장 심화 18개(데이터가 아직 없으면 자리 표시로)");
  assert.ok(Number.isFinite(a.bytesPerActiveDay) && a.bytesPerActiveDay > 0);
  // 심화는 그 장 평가 뒤에만
  for (const [id, day] of Object.entries(a.advancedDay)) {
    const n = id.split("-")[0];
    assert.ok(a.lessonDay[`${n}-5`] <= day, `${id} on day ${day} before ${n}-5`);
  }
});
