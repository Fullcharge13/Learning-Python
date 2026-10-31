// 작업 2: 하루 XP·연속 기록·보호권(rollDay) 시험 — 날짜는 언제나 문자열로 주입
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDailyXp, rollDay, applyMilestones, earnXp, isDate } from "../../src/rules.js";

function fixture(over = {}) {
  const base = {
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
  };
  return { ...base, ...over, streak: { ...base.streak, ...(over.streak || {}) } };
}

test("goal: 목표 20, 같은 날 10 + 10 → 연속 1, 다시 10 더해도 1", () => {
  const s0 = fixture();
  const s1 = addDailyXp(s0, 10, "2026-10-29");
  assert.equal(s1.streak.days, 0);
  assert.equal(s1.streak.todayXp, 10);
  const s2 = addDailyXp(s1, 10, "2026-10-29");
  assert.equal(s2.streak.days, 1);
  assert.equal(s2.streak.lastGoalDate, "2026-10-29");
  assert.equal(s2.streak.best, 1);
  const s3 = addDailyXp(s2, 10, "2026-10-29");
  assert.equal(s3.streak.days, 1);
  assert.equal(s3.streak.todayXp, 30);
  assert.equal(s3.xp, 30);
  // 원본 불변
  assert.equal(s0.xp, 0);
  assert.equal(s0.streak.todayXp, 0);
  assert.equal(s1.streak.days, 0);
});

test("goal_next_day: 어제 달성 → 오늘 달성하면 +1, 오늘 XP는 0부터", () => {
  const s0 = fixture({ xp: 50, streak: { days: 3, best: 3, lastGoalDate: "2026-10-28", todayDate: "2026-10-28", todayXp: 25 } });
  const s1 = addDailyXp(s0, 15, "2026-10-29");
  assert.equal(s1.streak.todayDate, "2026-10-29");
  assert.equal(s1.streak.todayXp, 15);
  assert.equal(s1.streak.days, 3);
  const s2 = addDailyXp(s1, 5, "2026-10-29");
  assert.equal(s2.streak.days, 4);
  assert.equal(s2.streak.best, 4);
  assert.equal(s2.xp, 70);
});

test("goal_gap: 마지막 달성이 이틀 전이면 달성 시 1부터", () => {
  const s0 = fixture({ streak: { days: 5, best: 9, lastGoalDate: "2026-10-27", todayDate: "2026-10-27", todayXp: 20 } });
  const s1 = addDailyXp(s0, 20, "2026-10-29");
  assert.equal(s1.streak.days, 1);
  assert.equal(s1.streak.best, 9);
});

test("goal_month_boundary: 10-31 달성 → 11-01 달성은 +1", () => {
  const s0 = fixture({ streak: { days: 2, best: 2, lastGoalDate: "2026-10-31", todayDate: "2026-10-31", todayXp: 20 } });
  const s1 = addDailyXp(s0, 20, "2026-11-01");
  assert.equal(s1.streak.days, 3);
});

test("midnight: 10-29 23:59 달성, 10-30 00:01 rollDay → 빠진 날 0, 기록 유지", () => {
  const s0 = addDailyXp(fixture({ streak: { days: 4, best: 4, lastGoalDate: "2026-10-28" } }), 20, "2026-10-29");
  assert.equal(s0.streak.days, 5);
  const r = rollDay(s0, "2026-10-30");
  assert.equal(r.usedFreezes, 0);
  assert.equal(r.broke, false);
  assert.equal(r.save.streak.days, 5);
  assert.equal(r.save.streak.lastGoalDate, "2026-10-29");
});

test("freeze1: 10-28 달성, 10-30 열기, 보호권 1 → 보호권 0, 기록 유지, usedFreezes 1", () => {
  const s0 = fixture({ freezes: 1, streak: { days: 6, best: 6, lastGoalDate: "2026-10-28" } });
  const r = rollDay(s0, "2026-10-30");
  assert.equal(r.usedFreezes, 1);
  assert.equal(r.broke, false);
  assert.equal(r.save.freezes, 0);
  assert.equal(r.save.streak.days, 6);
  assert.equal(r.save.streak.lastGoalDate, "2026-10-29"); // C7: 어제로 옮김
  // 같은 날 다시 열어도 보호권을 또 쓰지 않음
  const r2 = rollDay(r.save, "2026-10-30");
  assert.equal(r2.usedFreezes, 0);
  assert.equal(r2.broke, false);
  assert.equal(r2.save.streak.days, 6);
  // 원본 불변
  assert.equal(s0.freezes, 1);
  assert.equal(s0.streak.lastGoalDate, "2026-10-28");
});

test("freeze2: 10-27 달성, 10-30 열기(이틀 빠짐), 보호권 2 → 0, 기록 유지", () => {
  const r = rollDay(fixture({ freezes: 2, streak: { days: 8, best: 8, lastGoalDate: "2026-10-27" } }), "2026-10-30");
  assert.equal(r.usedFreezes, 2);
  assert.equal(r.broke, false);
  assert.equal(r.save.freezes, 0);
  assert.equal(r.save.streak.days, 8);
  assert.equal(r.save.streak.lastGoalDate, "2026-10-29");
});

test("freeze_short: 10-27 달성, 10-30 열기(이틀 빠짐), 보호권 1 → 기록 0, broke true, 보호권 1 유지", () => {
  const s0 = fixture({ freezes: 1, streak: { days: 8, best: 8, lastGoalDate: "2026-10-27" } });
  const r = rollDay(s0, "2026-10-30");
  assert.equal(r.broke, true);
  assert.equal(r.save.streak.days, 0);
  assert.equal(r.save.freezes, 1); // 판정 5: 모자라면 보호권을 쓰지 않음
  assert.equal(r.usedFreezes, 0);
  assert.equal(r.save.streak.lastGoalDate, null); // C7
  assert.equal(r.save.streak.best, 8);
  assert.equal(s0.streak.days, 8);
});

test("no_goal_yet: lastGoalDate null → 변화 없음", () => {
  const s0 = fixture({ freezes: 2 });
  const r = rollDay(s0, "2026-10-30");
  assert.equal(r.usedFreezes, 0);
  assert.equal(r.broke, false);
  assert.equal(r.save.freezes, 2);
  assert.equal(r.save.streak.days, 0);
});

test("same_day_open: 오늘 달성한 뒤 같은 날 rollDay → 변화 없음", () => {
  const s0 = fixture({ freezes: 1, streak: { days: 2, best: 2, lastGoalDate: "2026-10-30" } });
  const r = rollDay(s0, "2026-10-30");
  assert.equal(r.usedFreezes, 0);
  assert.equal(r.broke, false);
  assert.equal(r.save.streak.days, 2);
});

test("dst_boundary: 3월 서머타임 주변 날짜(UTC 계산) — 03-08 달성, 03-09 열기 → 빠진 날 0", () => {
  const r = rollDay(fixture({ streak: { days: 1, best: 1, lastGoalDate: "2026-03-08" } }), "2026-03-09");
  assert.equal(r.usedFreezes, 0);
  assert.equal(r.broke, false);
});

// ---- 검토 판정 반영 ----

test("R1 goal_lowered: 목표 30에서 15 XP, 목표를 10으로 낮춘 뒤 +5 → 인정", () => {
  const s0 = fixture({ settings: { sound: true, dailyGoal: 30, name: "" } });
  const s1 = addDailyXp(s0, 15, "2026-10-29");
  assert.equal(s1.streak.days, 0);
  const s2 = addDailyXp({ ...s1, settings: { ...s1.settings, dailyGoal: 10 } }, 5, "2026-10-29");
  assert.equal(s2.streak.days, 1);
  assert.equal(s2.streak.lastGoalDate, "2026-10-29");
});

test("R1 zero_xp_credit: 이미 목표를 넘은 상태에서 0 XP → 인정", () => {
  const s0 = fixture({ settings: { sound: true, dailyGoal: 30, name: "" } });
  const s1 = addDailyXp(s0, 25, "2026-10-29");
  const s2 = addDailyXp({ ...s1, settings: { ...s1.settings, dailyGoal: 20 } }, 0, "2026-10-29");
  assert.equal(s2.streak.days, 1);
  const s3 = addDailyXp(s2, 0, "2026-10-29");
  assert.equal(s3.streak.days, 1);
});

test("R2 add_rolls_day: 보호권 2, 마지막 달성 10-27, 10-29에 +20 → days+1, 보호권 1", () => {
  const s0 = fixture({ freezes: 2, streak: { days: 5, best: 5, lastGoalDate: "2026-10-27", todayDate: "2026-10-27", todayXp: 20 } });
  const s1 = addDailyXp(s0, 20, "2026-10-29");
  assert.equal(s1.freezes, 1);
  assert.equal(s1.streak.days, 6);
  assert.equal(s1.streak.lastGoalDate, "2026-10-29");
});

test("R2 add_rolls_day_break: 보호권 0, 마지막 달성 10-26, 10-29에 +10 (목표 미달) → 기록 0", () => {
  const s0 = fixture({ streak: { days: 5, best: 5, lastGoalDate: "2026-10-26", todayDate: "2026-10-26", todayXp: 20 } });
  const s1 = addDailyXp(s0, 10, "2026-10-29");
  assert.equal(s1.streak.days, 0);
  assert.equal(s1.streak.lastGoalDate, null);
  assert.equal(s1.streak.best, 5);
});

test("R2 rollDay_idempotent: 두 번 불러도 결과 같음", () => {
  const s0 = fixture({ freezes: 2, streak: { days: 5, best: 5, lastGoalDate: "2026-10-27" } });
  const a = rollDay(s0, "2026-10-29").save;
  const b = rollDay(a, "2026-10-29");
  assert.deepEqual(b.save, a);
  assert.equal(b.usedFreezes, 0);
});

test("R3 isDate", () => {
  assert.equal(isDate("2026-10-29"), true);
  assert.equal(isDate("2024-02-29"), true);
  for (const bad of ["2026/10/29", "", "2026-02-30", undefined, null, "2026-1-5", 20261029]) assert.equal(isDate(bad), false, String(bad));
});

test("R3 invalid_today_throws: rollDay·addDailyXp·earnXp", () => {
  const s0 = fixture({ streak: { days: 1, best: 1, lastGoalDate: "2026-10-28" } });
  for (const bad of ["2026/10/29", "", "2026-02-30", undefined]) {
    assert.throws(() => rollDay(s0, bad), Error, String(bad));
    assert.throws(() => addDailyXp(s0, 5, bad), Error, String(bad));
    assert.throws(() => earnXp(s0, 5, bad), Error, String(bad));
  }
});

test("R3 invalid_stored_lastGoalDate: null처럼 취급 — 보호권·기록 그대로", () => {
  for (const bad of ["2026/10/29", "", "2026-02-30", undefined]) {
    const s0 = fixture({ freezes: 2, streak: { days: 4, best: 4, lastGoalDate: bad } });
    const r = rollDay(s0, "2026-10-30");
    assert.equal(r.usedFreezes, 0, String(bad));
    assert.equal(r.broke, false);
    assert.equal(r.save.freezes, 2);
    assert.equal(r.save.streak.days, 4);
    assert.equal(r.save.streak.lastGoalDate, bad);
  }
});

test("R4 future_lastGoalDate: 시계를 뒤로 돌림 → rollDay 변화 없음, addDailyXp는 이미 센 날로 봄", () => {
  const s0 = fixture({ freezes: 1, streak: { days: 3, best: 3, lastGoalDate: "2026-10-30", todayDate: "2026-10-30", todayXp: 25 } });
  const r = rollDay(s0, "2026-10-29");
  assert.equal(r.usedFreezes, 0);
  assert.equal(r.broke, false);
  assert.deepEqual(r.save, s0);
  const s1 = addDailyXp(s0, 30, "2026-10-29");
  assert.equal(s1.streak.days, 3);
  assert.equal(s1.streak.lastGoalDate, "2026-10-30");
  assert.equal(s1.freezes, 1);
  assert.equal(s1.xp, 30);
});

test("R6 bad_xp: 음수·NaN → 0으로 취급", () => {
  const s0 = fixture({ xp: 10 });
  for (const bad of [-5, NaN, Infinity, undefined, "7"]) {
    const s1 = addDailyXp(s0, bad, "2026-10-29");
    assert.equal(s1.xp, 10, String(bad));
    assert.equal(s1.streak.todayXp, 0, String(bad));
  }
});

test("R8 new_object: 변화 없는 경로도 새 객체", () => {
  const s0 = fixture();
  const r = rollDay(s0, "2026-10-29");
  assert.notEqual(r.save, s0);
  assert.notEqual(r.save.streak, s0.streak);
  const s1 = fixture({ freezes: 1, streak: { days: 2, best: 2, lastGoalDate: "2026-10-29" } });
  const r1 = rollDay(s1, "2026-10-29");
  assert.notEqual(r1.save, s1);
});

// ---- 판정 9: 연속 기록 이정표 ----
function at(days, best, extra = {}) {
  return fixture({ ...extra, streak: { days, best, lastGoalDate: "2026-10-28", todayDate: "2026-10-28", todayXp: 20 } });
}

test("M7: 6 → 7일 달성하면 +50바이트, 한 번만", () => {
  const s0 = at(6, 6, { bytes: 3 });
  const r = earnXp(s0, 20, "2026-10-29");
  assert.equal(r.save.streak.days, 7);
  assert.equal(r.milestone, 7);
  assert.equal(r.save.bytes, 53);
  const r2 = earnXp(r.save, 20, "2026-10-29");
  assert.equal(r2.milestone, null);
  assert.equal(r2.save.bytes, 53);
});

test("M7_again: 끊긴 뒤 다시 7일 (best ≥ 7) → 보상 없음", () => {
  const s0 = at(6, 12, { bytes: 0 });
  const r = earnXp(s0, 20, "2026-10-29");
  assert.equal(r.save.streak.days, 7);
  assert.equal(r.milestone, null);
  assert.equal(r.save.bytes, 0);
});

test("M30: 30일 → graduate(졸업 가운) 의상, 중복 없음", () => {
  const r = earnXp(at(29, 29), 20, "2026-10-29");
  assert.equal(r.milestone, 30);
  assert.deepEqual(r.save.outfits, ["basic", "graduate"]);
  const r2 = applyMilestones(at(29, 29, { outfits: ["basic", "graduate"] }), { ...r.save });
  assert.deepEqual(r2.save.outfits, ["basic", "graduate"]);
});

test("M100: 100일 → streak100 배지, 중복 없음", () => {
  const r = earnXp(at(99, 99), 20, "2026-10-29");
  assert.equal(r.milestone, 100);
  assert.deepEqual(r.save.badges, ["streak100"]);
  const r2 = applyMilestones(at(99, 99, { badges: ["streak100"] }), { ...r.save, badges: ["streak100"] });
  assert.deepEqual(r2.save.badges, ["streak100"]);
});

test("M_none: 이정표 아님 → milestone null, 원본 불변", () => {
  const s0 = at(3, 3);
  const r = earnXp(s0, 20, "2026-10-29");
  assert.equal(r.milestone, null);
  assert.equal(r.save.streak.days, 4);
  assert.equal(s0.streak.days, 3);
  assert.deepEqual(r.save.outfits, ["basic"]);
});

// ---- 재검토 후속 ----

test("F1 future_far: 저장된 달성일이 오늘보다 2일 이상 뒤 → 없는 것으로 취급, 목표 달성 시 1부터, best 유지", () => {
  const s0 = fixture({ freezes: 2, streak: { days: 6, best: 9, lastGoalDate: "2026-11-05", todayDate: "2026-11-05", todayXp: 25 } });
  const r = rollDay(s0, "2026-10-29");
  assert.equal(r.usedFreezes, 0);
  assert.equal(r.broke, false);
  assert.equal(r.save.freezes, 2);
  const s1 = addDailyXp(s0, 20, "2026-10-29");
  assert.equal(s1.streak.days, 1);
  assert.equal(s1.streak.lastGoalDate, "2026-10-29");
  assert.equal(s1.streak.best, 9);
  assert.equal(s1.freezes, 2);
});

test("F1 future_one_day: 저장 10-30 / 오늘 10-29 → 이미 센 날, 변화 없음", () => {
  const s0 = fixture({ freezes: 1, streak: { days: 4, best: 4, lastGoalDate: "2026-10-30", todayDate: "2026-10-30", todayXp: 25 } });
  const r = rollDay(s0, "2026-10-29");
  assert.deepEqual(r.save, s0);
  const s1 = addDailyXp(s0, 20, "2026-10-29");
  assert.equal(s1.streak.days, 4);
  assert.equal(s1.streak.lastGoalDate, "2026-10-30");
  assert.equal(s1.freezes, 1);
});

test("F2 bad_goal: dailyGoal이 10/20/30이 아니면 20으로", () => {
  for (const bad of [undefined, "abc", 0, 15, null, "20"]) {
    const settings = { sound: true, name: "" };
    if (bad !== undefined) settings.dailyGoal = bad;
    const s0 = fixture({ settings });
    const s1 = addDailyXp(s0, 19, "2026-10-29");
    assert.equal(s1.streak.days, 0, String(bad));
    const s2 = addDailyXp(s1, 1, "2026-10-29");
    assert.equal(s2.streak.days, 1, String(bad));
  }
  // 정상 값은 그대로
  const s10 = addDailyXp(fixture({ settings: { sound: true, dailyGoal: 10, name: "" } }), 10, "2026-10-29");
  assert.equal(s10.streak.days, 1);
});
