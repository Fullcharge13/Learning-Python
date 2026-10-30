import { test } from "node:test";
import assert from "node:assert/strict";
import { newSave } from "../../src/save.js";
import { finishLesson } from "../../src/finish.js";
import { lessonReward, reviewReward } from "../../src/rules.js";

const L11 = { id: "1-1", chapter: 1 };
const at = (h = 10) => new Date(2026, 9, 29, h, 0);
const base = (over = {}) => ({
  lesson: L11, mode: "lesson", perfect: true, accuracy: 1, marks: [["print", "right"]],
  write: { passed: true, hintUsed: false, solutionSeen: false, fixedError: false },
  itemsSolved: 7, reviewCorrect: 0, logs: [{ lesson: "1-1", item: 5, pass: true, at: "x" }],
  nextLessonId: "1-2", nextChapter: 1, ...over,
});

test("finish_first_lesson: 보상·진도·배지·통계", () => {
  const { save, result } = finishLesson(newSave(), base(), at());
  const r = lessonReward({ firstTime: true, perfect: true, hintFreeWrite: true, isExam: false });
  assert.equal(result.xp, r.xp);
  assert.equal(result.lessonBytes, r.bytes);
  assert.ok(save.completed_lessons.includes("1-1"));
  assert.deepEqual(save.grading_results["1-1"], { perfect: true, attempts: 1 });
  assert.equal(save.current_lesson, "1-2");
  assert.ok(save.badges.includes("first_print"));
  assert.ok(result.newBadges.includes("first_print"));
  assert.equal(save.stats.lessons, 1);
  assert.equal(save.stats.perfect, 1);
  assert.equal(save.stats.hintfree, 1);
  assert.equal(save.stats.items, 7);
  assert.equal(save.xp, r.xp);
  assert.equal(save.streak.days, 1); // 하루 목표 20
  assert.equal(result.streakUp, true);
  assert.equal(save.submission_logs.length, 1);
  assert.ok(save.last_active_at);
  assert.equal(save.quests.date, "2026-10-29");
  // 바이트 = 레슨 15 + 끝낸 퀘스트 보상 + 상자
  assert.equal(save.bytes, r.bytes + result.questBytes);
});

test("finish_replay: 다시 하기 보상은 rules.js 그대로, 기록 유지", () => {
  const first = finishLesson(newSave(), base(), at()).save;
  const { save, result } = finishLesson(first, base(), at(11));
  const r = lessonReward({ firstTime: false, perfect: true, hintFreeWrite: true, isExam: false });
  assert.equal(result.xp, r.xp);
  assert.equal(result.lessonBytes, r.bytes);
  assert.equal(result.firstTime, false);
  assert.deepEqual(save.grading_results["1-1"], { perfect: true, attempts: 2 });
  assert.equal(save.completed_lessons.filter((x) => x === "1-1").length, 1);
});

test("finish_not_perfect_hint: 실수·힌트 → 보너스 없음, 개념 표시", () => {
  const { save, result } = finishLesson(newSave(), base({
    perfect: false, marks: [["print", "wrong"], ["print", "hint"]],
    write: { passed: true, hintUsed: true, solutionSeen: false, fixedError: true },
  }), at());
  const r = lessonReward({ firstTime: true, perfect: false, hintFreeWrite: false, isExam: false });
  assert.equal(result.xp, r.xp);
  assert.equal(result.lessonBytes, r.bytes);
  assert.equal(save.weak_concepts.print, 3);
  assert.deepEqual(save.review_queue, ["print"]);
  assert.equal(save.stats.fixed, 1);
  assert.equal(save.stats.hintfree, 0);
});

test("finish_night_owl: 22시 레슨 완료 → 밤 공부", () => {
  const { result } = finishLesson(newSave(), base(), at(22));
  assert.ok(result.newBadges.includes("night_owl"));
});

test("finish_review: 복습 → reviewReward, 복습 통계, 완료 목록은 그대로", () => {
  const s0 = { ...newSave(), review_queue: ["print"], weak_concepts: { print: 2 } };
  const { save, result } = finishLesson(s0, base({
    lesson: { id: "review" }, mode: "review", marks: [["print", "right"]],
    write: null, reviewCorrect: 5, itemsSolved: 5, logs: [],
  }), at());
  assert.equal(result.xp, reviewReward().xp);
  assert.equal(result.lessonBytes, reviewReward().bytes);
  assert.equal(save.stats.review_items, 5);
  assert.equal(save.stats.lessons, 0);
  assert.deepEqual(save.completed_lessons, []);
  assert.equal(save.current_lesson, "1-1");
});

test("finish_pure: 받은 저장을 바꾸지 않음", () => {
  const s0 = newSave();
  const snap = JSON.stringify(s0);
  finishLesson(s0, base(), at());
  assert.equal(JSON.stringify(s0), snap);
});

import { applyGoalChange } from "../../src/finish.js";

test("finish_fixed_needs_no_solution: 정답을 보고 통과하면 오류 해결로 치지 않음", () => {
  const { save } = finishLesson(newSave(), base({
    write: { passed: true, hintUsed: true, solutionSeen: true, fixedError: true },
  }), at());
  assert.equal(save.stats.fixed, 0);
  assert.ok(!save.quests.progress.q_fixerr);
});

test("finish_total_bytes: 결과의 totalBytes = 저장 바이트 증가량(이정표 포함)", () => {
  const s0 = newSave();
  s0.streak = { days: 6, best: 6, lastGoalDate: "2026-10-28", todayDate: "2026-10-28", todayXp: 20 };
  const { save, result } = finishLesson(s0, base(), at());
  assert.equal(result.milestone, 7);
  assert.equal(result.milestoneBytes, 50);
  assert.equal(result.totalBytes, save.bytes - s0.bytes);
  assert.equal(result.totalBytes, result.lessonBytes + result.questBytes + result.milestoneBytes);
});

test("goal_change: 목표를 낮추면 오늘 이미 모은 XP로 그날이 인정됨", () => {
  const s0 = newSave();
  s0.streak = { days: 6, best: 6, lastGoalDate: "2026-10-28", todayDate: "2026-10-29", todayXp: 12 };
  const r = applyGoalChange(s0, 10, "2026-10-29");
  assert.equal(r.save.settings.dailyGoal, 10);
  assert.equal(r.save.streak.days, 7);
  assert.equal(r.streakUp, true);
  assert.equal(r.milestone, 7);
  assert.equal(r.save.bytes, s0.bytes + 50);
  assert.equal(r.save.xp, s0.xp);
});

test("goal_change_raise: 목표를 올리면 아무 일 없음", () => {
  const s0 = newSave();
  s0.streak = { days: 2, best: 2, lastGoalDate: "2026-10-28", todayDate: "2026-10-29", todayXp: 12 };
  const r = applyGoalChange(s0, 30, "2026-10-29");
  assert.equal(r.save.streak.days, 2);
  assert.equal(r.streakUp, false);
  assert.equal(r.milestone, null);
});
