// v0.12.1 앱 전체 QA 고침 — 저장 가져오기 검사, 하루 목표 바꾸기(내일부터), 깨진 저장 안내, migrate 타입 복구
import "./_guard_index.js";   // 판정 G2-C3: 저장을 읽기 전에 경비실 색인
import { test } from "node:test";
import assert from "node:assert/strict";
import { newSave, migrate, loadEx, SAVE_KEY, takeBrokenNotice, BROKEN_NOTICE_TEXT } from "../../src/save.js";
import { checkImport, importCompare, NOT_SAVE_TEXT } from "../../src/importsave.js";
import { applyGoalChange } from "../../src/finish.js";
import { addDailyXp, rollDay, goalFor } from "../../src/rules.js";

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

// ---- 2. 저장 가져오기 검사 ----
test("import: 아무 JSON이나(알 수 없는 키만, 배열, 숫자) 저장 파일이 아님", () => {
  for (const raw of [{ hello: "world", xp: "lots" }, { xp: 5 }, { foo: 1 }, [1, 2], 3, "x", null, {}]) {
    const r = checkImport(raw);
    assert.equal(r.ok, false, JSON.stringify(raw));
  }
  assert.equal(NOT_SAVE_TEXT.startsWith("리아와 파이썬! 저장 파일이 아니에요"), true);
});

test("import: saveVer 숫자 또는 completed_lessons 배열 + 아는 키 하나 이상이면 받음", () => {
  assert.equal(checkImport({ saveVer: 2, xp: 10 }).ok, true);
  assert.equal(checkImport({ completed_lessons: ["1-1"], xp: 10 }).ok, true);
  assert.equal(checkImport({ completed_lessons: [] }).ok, true);   // completed_lessons 자체가 아는 키
  assert.equal(checkImport(newSave()).ok, true);
  assert.equal(checkImport({ saveVer: "2", xp: 10 }).ok, false);  // saveVer가 숫자가 아님
  assert.equal(checkImport({ saveVer: 2 }).ok, false);             // saveVer 말고 아는 키가 없음
  assert.equal(checkImport({ completed_lessons: "1-1", xp: 3 }).ok, false);
});

test("import: 지금보다 끝낸 레슨이 적으면 그 수를 알림", () => {
  const cur = { ...newSave(), completed_lessons: ["1-1", "1-2", "1-3"], xp: 90 };
  const next = { ...newSave(), completed_lessons: ["1-1"], xp: 20 };
  const c = importCompare(cur, next);
  assert.equal(c.fewerLessons, 2);
  assert.equal(c.warn, "지금보다 끝낸 레슨이 2개 적어요");
  const same = importCompare(cur, { ...cur, xp: 100 });
  assert.equal(same.fewerLessons, 0);
  assert.equal(same.warn, null);
  assert.match(c.summary, /끝낸 레슨 1개, XP 20/);
});

// ---- 4. 하루 목표 바꾸기는 내일부터 ----
const T = "2026-10-29";
const TOMORROW = "2026-10-30";

test("goal: 오늘 15 XP, 20→10 → 오늘 연속 기록 그대로, 목표는 내일부터 10", () => {
  const s0 = newSave();
  s0.streak = { days: 6, best: 6, lastGoalDate: "2026-10-28", todayDate: T, todayXp: 15 };
  const r = applyGoalChange(s0, 10, T);
  assert.equal(r.save.streak.days, 6);
  assert.equal(r.save.streak.lastGoalDate, "2026-10-28");
  assert.equal(r.streakUp, false);
  assert.equal(r.milestone, null);
  assert.equal(r.save.bytes, s0.bytes);
  assert.equal(r.save.settings.dailyGoal, 20);                       // 오늘은 옛 목표
  assert.deepEqual(r.save.goal_pending, { value: 10, from: TOMORROW });
  assert.equal(goalFor(r.save, T), 20);
  assert.equal(goalFor(r.save, TOMORROW), 10);
  // 오늘 0 XP를 더해도(다른 경로) 인정되지 않음
  const s1 = addDailyXp(r.save, 0, T);
  assert.equal(s1.streak.days, 6);
  // 오늘 5 더 모아 20 → 옛 목표로 인정
  const s2 = addDailyXp(r.save, 5, T);
  assert.equal(s2.streak.days, 7);
});

test("goal: 다음 날은 새 목표 10으로 셈(10 XP에 인정), 날 넘김에서 설정으로 옮김", () => {
  const s0 = newSave();
  s0.streak = { days: 6, best: 6, lastGoalDate: T, todayDate: T, todayXp: 25 };
  const r = applyGoalChange(s0, 10, T);
  const s1 = addDailyXp(r.save, 10, TOMORROW);
  assert.equal(s1.streak.days, 7);
  assert.equal(s1.streak.lastGoalDate, TOMORROW);
  const rolled = rollDay(r.save, TOMORROW).save;
  assert.equal(rolled.settings.dailyGoal, 10);
  assert.equal(rolled.goal_pending, null);
  // 아직 오늘이면 옮기지 않음
  assert.deepEqual(rollDay(r.save, T).save.goal_pending, { value: 10, from: TOMORROW });
});

test("goal: 올리는 것도 내일부터(오늘은 옛 목표 20으로 인정)", () => {
  const s0 = newSave();
  s0.streak = { days: 2, best: 2, lastGoalDate: "2026-10-28", todayDate: T, todayXp: 12 };
  const r = applyGoalChange(s0, 30, T);
  assert.equal(r.save.settings.dailyGoal, 20);
  assert.deepEqual(r.save.goal_pending, { value: 30, from: TOMORROW });
  const s1 = addDailyXp(r.save, 8, T);          // 20 → 옛 목표 달성
  assert.equal(s1.streak.days, 3);
  const s2 = addDailyXp(s1, 20, TOMORROW);      // 내일은 30이 필요 → 20으로는 인정 안 됨
  assert.equal(s2.streak.days, 3);
  assert.equal(s2.streak.lastGoalDate, T);
  assert.equal(addDailyXp(s2, 10, TOMORROW).streak.days, 4);
});

test("goal: 지금 목표를 다시 고르면 예약을 지움", () => {
  const s0 = newSave();
  const r = applyGoalChange(s0, 10, T);
  const back = applyGoalChange(r.save, 20, T);
  assert.equal(back.save.goal_pending, null);
  assert.equal(back.save.settings.dailyGoal, 20);
});

test("goal: migrate가 goal_pending을 지킴/이상하면 null", () => {
  assert.deepEqual(migrate({ xp: 1, goal_pending: { value: 10, from: TOMORROW } }).goal_pending, { value: 10, from: TOMORROW });
  for (const bad of [{ value: 15, from: TOMORROW }, { value: 10, from: "내일" }, "10", [10], 10, { value: "10", from: TOMORROW }]) {
    assert.equal(migrate({ xp: 1, goal_pending: bad }).goal_pending, null, JSON.stringify(bad));
  }
  assert.equal(migrate({ xp: 1 }).goal_pending, null);   // 옛 저장
  assert.equal(newSave().goal_pending, null);
});

// ---- 5. 깨진 저장 안내 ----
test("broken: loadEx가 남긴 칸 이름을 알려 줌", () => {
  const st = fakeStorage({ [SAVE_KEY]: "{깨짐" });
  const r = loadEx(st);
  assert.equal(r.brokenKey, SAVE_KEY + ".broken");
  assert.equal(st.data[r.brokenKey], "{깨짐");
  const st2 = fakeStorage({ [SAVE_KEY]: "{둘", [SAVE_KEY + ".broken"]: "{하나" });
  assert.equal(loadEx(st2).brokenKey, SAVE_KEY + ".broken.1");
  assert.equal(loadEx(fakeStorage({ [SAVE_KEY]: "[1]" })).brokenKey, SAVE_KEY + ".broken");
  assert.equal(loadEx(fakeStorage({ [SAVE_KEY]: '{"xp":3}' })).brokenKey, null);
  assert.equal(loadEx(fakeStorage()).brokenKey, null);
});

test("broken: 안내는 한 번(takeBrokenNotice가 깃발을 내림)", () => {
  const s = { ...newSave(), broken_notice: SAVE_KEY + ".broken" };
  const r = takeBrokenNotice(s);
  assert.equal(r.key, SAVE_KEY + ".broken");
  assert.equal(r.save.broken_notice, null);
  assert.equal(takeBrokenNotice(r.save).key, null);
  assert.match(BROKEN_NOTICE_TEXT, /저장을 읽지 못해 새로 시작했어요/);
  assert.match(BROKEN_NOTICE_TEXT, /설정 → 저장 가져오기/);
});

test("broken: migrate는 우리 칸 이름만 받음", () => {
  assert.equal(migrate({ xp: 1, broken_notice: SAVE_KEY + ".broken.3" }).broken_notice, SAVE_KEY + ".broken.3");
  assert.equal(migrate({ xp: 1, broken_notice: "ria-python.dev.save.broken" }).broken_notice, "ria-python.dev.save.broken");
  for (const bad of ["other", 5, { a: 1 }, "ria-python.save"]) assert.equal(migrate({ xp: 1, broken_notice: bad }).broken_notice, null);
});

// ---- 6. migrate 타입 복구 ----
test("types: QA 값 {xp:'lots'} → 숫자 0, {completed_lessons:'1-1'} → []", () => {
  const a = migrate({ xp: "lots" });
  assert.equal(a.xp, 0);
  assert.equal(typeof a.xp, "number");
  const b = migrate({ completed_lessons: "1-1" });
  assert.deepEqual(b.completed_lessons, []);
});

test("types: 배열 안의 이상한 값·통계 칸·날짜 칸도 고침", () => {
  const s = migrate({
    completed_lessons: ["1-1", 5, null, "1-1", { a: 1 }, "1-2"],
    review_queue: ["print", 3, null],
    badges: ["first_print", 7],
    submission_logs: [{ lesson: "1-1" }, "x", 3],
    stats: { lessons: "many", items: "lots", perfect: 2 },
    streak: { lastGoalDate: 12345, todayDate: { d: 1 }, todayXp: "lots" },
    quests: { date: 5, ids: ["q_xp", 3], progress: { q_xp: "lots", q_l: 2 }, done: [1, "q_xp"], chest: "yes" },
    grading_results: { "1-1": { perfect: true }, "1-2": "x" },
    current_lesson: 3, current_chapter: "two",
  });
  assert.deepEqual(s.completed_lessons, ["1-1", "1-2"]);
  assert.deepEqual(s.review_queue, ["print"]);
  assert.deepEqual(s.badges, ["first_print"]);
  assert.deepEqual(s.submission_logs, [{ lesson: "1-1" }]);
  assert.equal(s.stats.lessons, 0);
  assert.equal(s.stats.items, 0);
  assert.equal(s.stats.perfect, 2);
  assert.equal(s.streak.lastGoalDate, null);
  assert.equal(s.streak.todayDate, null);
  assert.equal(s.streak.todayXp, 0);
  assert.equal(s.quests.date, null);
  assert.deepEqual(s.quests.ids, ["q_xp"]);
  assert.deepEqual(s.quests.progress, { q_l: 2 });
  assert.deepEqual(s.quests.done, ["q_xp"]);
  assert.equal(s.quests.chest, false);
  assert.deepEqual(s.grading_results, { "1-1": { perfect: true } });
  assert.equal(s.current_lesson, "1-1");
  assert.equal(s.current_chapter, 1);
});
