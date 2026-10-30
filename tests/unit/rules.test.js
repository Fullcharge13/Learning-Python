// 작업 2: 보상·보호권 구매·취약 개념 규칙 시험
import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonReward, reviewReward, buyFreeze, markConcept } from "../../src/rules.js";

// 공통 Save 모양(ledger C3) — src/save.js를 import하지 않고 직접 만든다
function fixture(over = {}) {
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

test("reward: 첫 완료·실수 없음·힌트 없이 → {xp 20, bytes 15}", () => {
  assert.deepEqual(lessonReward({ firstTime: true, perfect: true, hintFreeWrite: true, isExam: false }), { xp: 20, bytes: 15 });
});
test("reward: 평가 첫 완료 → {xp 30, bytes 10}", () => {
  assert.deepEqual(lessonReward({ firstTime: true, perfect: false, hintFreeWrite: false, isExam: true }), { xp: 30, bytes: 10 });
});
test("reward(C24): 다시 하기·실수 없음·힌트 없이 → {xp 10, bytes 0} (보너스 없음)", () => {
  assert.deepEqual(lessonReward({ firstTime: false, perfect: true, hintFreeWrite: true, isExam: false }), { xp: 10, bytes: 0 });
  assert.deepEqual(lessonReward({ firstTime: false, perfect: false, hintFreeWrite: false, isExam: false }), { xp: 10, bytes: 0 });
});
test("reward(C24): 평가 다시 하기 → {xp 15, bytes 0}", () => {
  assert.deepEqual(lessonReward({ firstTime: false, perfect: true, hintFreeWrite: true, isExam: true }), { xp: 15, bytes: 0 });
  assert.deepEqual(lessonReward({ firstTime: false, perfect: false, hintFreeWrite: false, isExam: true }), { xp: 15, bytes: 0 });
});
test("reward: 첫 완료 기본(보너스 없음) → {xp 10, bytes 10}", () => {
  assert.deepEqual(lessonReward({ firstTime: true, perfect: false, hintFreeWrite: false, isExam: false }), { xp: 10, bytes: 10 });
});
test("reward(C24): 복습 한 판 → {xp 10, bytes 0}", () => {
  assert.deepEqual(reviewReward(), { xp: 10, bytes: 0 });
});

test("freeze_cap: 보호권 2개에서 구매 → 오류, 바이트 그대로", () => {
  const s = fixture({ bytes: 500, freezes: 2 });
  const r = buyFreeze(s);
  assert.ok(r instanceof Error);
  assert.equal(s.bytes, 500);
  assert.equal(s.freezes, 2);
});
test("freeze_buy: 200바이트 → 보호권 1, 바이트 0, 원본은 그대로", () => {
  const s = fixture({ bytes: 200, freezes: 0 });
  const r = buyFreeze(s);
  assert.ok(!(r instanceof Error));
  assert.equal(r.bytes, 0);
  assert.equal(r.freezes, 1);
  assert.equal(s.bytes, 200);
  assert.equal(s.freezes, 0);
});
test("freeze_poor: 199바이트 → 오류, 그대로", () => {
  const s = fixture({ bytes: 199 });
  const r = buyFreeze(s);
  assert.ok(r instanceof Error);
  assert.equal(s.bytes, 199);
  assert.equal(s.freezes, 0);
});

test("concept: wrong(2, 목록) → right(1) → right(0, 빠짐) → right(0)", () => {
  const s0 = fixture();
  const s1 = markConcept(s0, "assign", "wrong");
  assert.equal(s1.weak_concepts.assign, 2);
  assert.deepEqual(s1.review_queue, ["assign"]);
  const s2 = markConcept(s1, "assign", "right");
  assert.equal(s2.weak_concepts.assign, 1);
  assert.deepEqual(s2.review_queue, ["assign"]);
  const s3 = markConcept(s2, "assign", "right");
  assert.equal(s3.weak_concepts.assign, 0);
  assert.deepEqual(s3.review_queue, []);
  const s4 = markConcept(s3, "assign", "right");
  assert.equal(s4.weak_concepts.assign, 0);
  assert.deepEqual(s4.review_queue, []);
  // 원본 불변
  assert.deepEqual(s0.weak_concepts, {});
  assert.deepEqual(s0.review_queue, []);
  assert.equal(s1.weak_concepts.assign, 2);
});
test("concept: hint +1 두 번 → 2에서 목록에 한 번만 올라감", () => {
  let s = fixture();
  s = markConcept(s, "if", "hint");
  assert.deepEqual(s.review_queue, []);
  s = markConcept(s, "if", "hint");
  assert.deepEqual(s.review_queue, ["if"]);
  s = markConcept(s, "if", "wrong");
  assert.equal(s.weak_concepts.if, 4);
  assert.deepEqual(s.review_queue, ["if"]);
});

test("R7 hasOwn: 프로토타입 이름의 개념도 정상 집계, 이상한 결과는 오류", () => {
  const s0 = fixture();
  const s1 = markConcept(s0, "constructor", "wrong");
  assert.equal(s1.weak_concepts.constructor, 2);
  assert.deepEqual(s1.review_queue, ["constructor"]);
  const s2 = markConcept(s0, "toString", "hint");
  assert.equal(s2.weak_concepts.toString, 1);
  assert.throws(() => markConcept(s0, "x", "toString"), Error);
  assert.throws(() => markConcept(s0, "x", "__proto__"), Error);
  assert.throws(() => markConcept(s0, "x", "oops"), Error);
});

test("R8 new_object: 실패하지 않는 경로는 언제나 새 객체", () => {
  const s0 = fixture({ weak_concepts: { a: 0 } });
  const s1 = markConcept(s0, "a", "right");
  assert.notEqual(s1, s0);
  assert.notEqual(s1.review_queue, s0.review_queue);
  assert.notEqual(s1.weak_concepts, s0.weak_concepts);
});
