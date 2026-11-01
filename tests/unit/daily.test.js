// v0.9 작업 2: 매일 도전 — 문제 고르기·진행 기록·보상·연속 기록 (판정 C53, C54)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dailyOpen, pickDaily, ensureDaily, dailyStatus, recordDaily, finishDaily, finishedItems, cleanDaily,
  DAILY_XP, DAILY_BYTES, DAILY_BONUS_BYTES, newDaily,
} from "../../src/daily.js";
import { newSave } from "../../src/save.js";
import { TEMPLATE_SEEDS } from "../../src/template.js";

const ch = (n, concepts, tplN = 4) => ({
  id: n, title: `${n}장`,
  lessons: [1, 2, 3, 4, 5].map((k) => ({ id: `${n}-${k}`, chapter: n, concepts: concepts[k - 1] || concepts[0], isExam: k === 5 })),
  ...(tplN ? { templates: Array.from({ length: tplN }, (_, i) => ({ id: `${n}-T${i + 1}`, concept: concepts[0][0] })) } : {}),
});
const INDEX = [
  ch(1, [["print"], ["string"], ["arith"], ["comment"], ["print", "arith"]]),
  ch(2, [["assign"], ["type"], ["input"], ["convert"], ["assign", "convert"]]),
  ch(3, [["if"], ["else"], ["elif"], ["compare"], ["if", "logic"]]),
  ch(4, [["def"], ["param"], ["return"], ["call"], ["def"]], 0),   // 틀 없는 장
];
const ids = (n) => [1, 2, 3, 4, 5].map((k) => `${n}-${k}`);
const save = (over = {}) => ({ ...newSave(), ...over });

test("상수: XP 15, 바이트 10, 7일마다 +20", () => {
  assert.equal(DAILY_XP, 15);
  assert.equal(DAILY_BYTES, 10);
  assert.equal(DAILY_BONUS_BYTES, 20);
});

test("열림: 1장 본 과정 5레슨을 모두 끝내야", () => {
  assert.equal(dailyOpen(INDEX, []), false);
  assert.equal(dailyOpen(INDEX, ["1-1", "1-2", "1-3", "1-4"]), false);
  assert.equal(dailyOpen(INDEX, ids(1)), true);
  assert.equal(dailyOpen([], ids(1)), false);
});

test("pickDaily: 터치 틀 2개(서로 다름) + 직접 작성 1개, 씨앗은 0~99", () => {
  const s = save({ completed_lessons: [...ids(1), ...ids(2)] });
  const p = pickDaily(INDEX, s, "2026-11-05");
  assert.equal(p.length, 3);
  assert.equal(p[0].kind, "tpl");
  assert.equal(p[1].kind, "tpl");
  assert.notEqual(p[0].id, p[1].id);
  assert.equal(p[2].kind, "write");
  for (const x of p.slice(0, 2)) assert.ok(Number.isInteger(x.seed) && x.seed >= 0 && x.seed < TEMPLATE_SEEDS);
  assert.ok(s.completed_lessons.includes(p[2].lesson));
});

test("pickDaily: 같은 날·같은 기록 → 같은 3문제, 날짜가 바뀌면 달라질 수 있음", () => {
  const s = save({ completed_lessons: [...ids(1), ...ids(2), "3-1"] });
  assert.deepEqual(pickDaily(INDEX, s, "2026-11-05"), pickDaily(INDEX, s, "2026-11-05"));
  const days = new Set();
  for (let d = 1; d <= 20; d++) days.add(JSON.stringify(pickDaily(INDEX, s, `2026-11-${String(d).padStart(2, "0")}`)));
  assert.ok(days.size > 10);
  // 끝낸 레슨 순서는 상관없음
  const r = save({ completed_lessons: [...s.completed_lessons].reverse() });
  assert.deepEqual(pickDaily(INDEX, r, "2026-11-05"), pickDaily(INDEX, s, "2026-11-05"));
});

test("pickDaily: 틀은 본 과정을 다 끝낸 장에서만, 직접 작성은 끝낸 레슨에서만", () => {
  // 1장 전부 + 2장 일부(2-1, 2-2) + 3장 전부를 끝냄 → 틀은 1·3장, 쓰기는 끝낸 레슨
  const done = [...ids(1), "2-1", "2-2", ...ids(3)];
  const s = save({ completed_lessons: done });
  for (let d = 1; d <= 28; d++) {
    const p = pickDaily(INDEX, s, `2026-11-${String(d).padStart(2, "0")}`);
    for (const x of p.slice(0, 2)) assert.ok(/^[13]-T/.test(x.id), x.id);
    assert.ok(done.includes(p[2].lesson), p[2].lesson);
  }
});

test("pickDaily: 1장 전에는 null, 틀 있는 장이 하나도 없으면 null", () => {
  assert.equal(pickDaily(INDEX, save({ completed_lessons: ["1-1"] }), "2026-11-05"), null);
  const noTpl = INDEX.map((c) => ({ ...c, templates: undefined }));
  assert.equal(pickDaily(noTpl, save({ completed_lessons: ids(1) }), "2026-11-05"), null);
});

test("pickDaily: 틀이 하나뿐이면 같은 틀을 두 번 쓰지 않음 → 터치 1 + 작성 1", () => {
  const one = [ch(1, [["print"], ["string"], ["arith"], ["comment"], ["print"]], 1)];
  const p = pickDaily(one, save({ completed_lessons: ids(1) }), "2026-11-05");
  assert.equal(p.length, 2);
  assert.deepEqual(p.map((x) => x.kind), ["tpl", "write"]);
});

test("pickDaily 가중: 복습 개념이 든 장의 틀이 약 3배 더 자주", () => {
  const s = save({ completed_lessons: [...ids(1), ...ids(2), ...ids(3)], review_queue: ["elif"] });
  const count = { 1: 0, 2: 0, 3: 0 };
  let writes3 = 0, writes = 0;
  for (let d = 0; d < 600; d++) {
    const date = new Date(Date.UTC(2026, 0, 1) + d * 86400000).toISOString().slice(0, 10);
    const p = pickDaily(INDEX, s, date);
    count[p[0].id[0]]++;
    writes++;
    if (p[2].lesson.startsWith("3-")) writes3++;
  }
  // 첫 틀: 3장 비중 3/5 = 0.6 (1·2장은 각 0.2)
  assert.ok(count[3] / 600 > 0.5 && count[3] / 600 < 0.7, JSON.stringify(count));
  assert.ok(count[1] / 600 > 0.12 && count[1] / 600 < 0.28, JSON.stringify(count));
  // 직접 작성: elif가 든 레슨(3-3) 하나만 ×3 → 3/17
  const p33 = (() => { let n = 0; for (let d = 0; d < 600; d++) { const date = new Date(Date.UTC(2026, 0, 1) + d * 86400000).toISOString().slice(0, 10); if (pickDaily(INDEX, s, date)[2].lesson === "3-3") n++; } return n / 600; })();
  assert.ok(p33 > 0.1 && p33 < 0.26, `3-3 비율 ${p33}`);
  assert.ok(writes3 > 0);
});

test("ensureDaily: 열리기 전에는 저장 그대로, 열리면 오늘 문제를 저장에 고정", () => {
  const s0 = save({ completed_lessons: ["1-1"] });
  assert.equal(ensureDaily(s0, "2026-11-05", INDEX), s0);
  const s1 = ensureDaily(save({ completed_lessons: ids(1) }), "2026-11-05", INDEX);
  assert.equal(s1.daily.date, "2026-11-05");
  assert.equal(s1.daily.picks.length, 3);
  assert.deepEqual(s1.daily.done, []);
  // 같은 날 다시: 그대로(같은 객체). 오늘 2장을 더 끝내도 오늘 문제는 바뀌지 않음
  assert.equal(ensureDaily(s1, "2026-11-05", INDEX), s1);
  const more = { ...s1, completed_lessons: [...ids(1), ...ids(2)] };
  assert.equal(ensureDaily(more, "2026-11-05", INDEX), more);
  // 다음 날: 새로
  const s2 = ensureDaily({ ...s1, daily: { ...s1.daily, done: [0] } }, "2026-11-06", INDEX);
  assert.equal(s2.daily.date, "2026-11-06");
  assert.deepEqual(s2.daily.done, []);
});

test("ensureDaily: 오늘 문제가 지금 내용에 없는 틀·레슨을 가리키면 다시 고름(끝낸 날은 그대로)", () => {
  const s1 = ensureDaily(save({ completed_lessons: ids(1) }), "2026-11-05", INDEX);
  const bad = { ...s1, daily: { ...s1.daily, picks: [{ kind: "tpl", id: "1-T99", chapter: 1, seed: 1 }, ...s1.daily.picks.slice(1)] } };
  const fixed = ensureDaily(bad, "2026-11-05", INDEX);
  assert.deepEqual(fixed.daily.picks, s1.daily.picks);
  const doneBad = { ...bad, daily: { ...bad.daily, done: [0, 1, 2], last_done_date: "2026-11-05" } };
  assert.equal(ensureDaily(doneBad, "2026-11-05", INDEX), doneBad);
});

test("finishedItems: 맞힘·세 번 틀림·직접 작성 제출 끝", () => {
  const flow = { _items: ["choice", "blank", "write"], solved: { 0: true }, gaveUp: [1], attempts: { 0: 1, 1: 3, 2: 1 } };
  assert.deepEqual(finishedItems(flow), [0, 1, 2]);
  assert.deepEqual(finishedItems({ _items: ["choice", "write"], solved: {}, gaveUp: [], attempts: { 0: 1 } }), []);
});

test("recordDaily: 푼 문제 번호를 합치고(중복 없음), 개념 점수를 바로 반영", () => {
  let s = ensureDaily(save({ completed_lessons: ids(1) }), "2026-11-05", INDEX);
  s = recordDaily(s, "2026-11-05", [1], [["arith", "wrong"]]);
  assert.deepEqual(s.daily.done, [1]);
  assert.equal(s.weak_concepts.arith, 2);
  assert.deepEqual(s.review_queue, ["arith"]);
  s = recordDaily(s, "2026-11-05", [1, 0], []);
  assert.deepEqual(s.daily.done, [0, 1]);
  // 날짜가 다른 기록(자정을 넘긴 화면)은 진행만 무시
  const t = recordDaily(s, "2026-11-06", [2], []);
  assert.deepEqual(t.daily.done, [0, 1]);
});

test("dailyStatus: 잠김 / 새로 / 하는 중 / 완료, 도전 n일째", () => {
  assert.equal(dailyStatus(save(), "2026-11-05", INDEX).state, "locked");
  let s = ensureDaily(save({ completed_lessons: ids(1) }), "2026-11-05", INDEX);
  assert.deepEqual(dailyStatus(s, "2026-11-05", INDEX), { state: "new", done: 0, total: 3, streak: 0 });
  s = recordDaily(s, "2026-11-05", [0], []);
  assert.equal(dailyStatus(s, "2026-11-05", INDEX).state, "partial");
  s = { ...s, daily: { ...s.daily, streak: 4, last_done_date: "2026-11-04" } };
  assert.equal(dailyStatus(s, "2026-11-05", INDEX).streak, 4, "어제까지 이어진 기록은 오늘도 보임");
  assert.equal(dailyStatus(s, "2026-11-07", INDEX).streak, 0, "하루 이상 빠지면 0");
  s = { ...s, daily: { ...s.daily, done: [0, 1, 2], streak: 5, last_done_date: "2026-11-05" } };
  assert.equal(dailyStatus(s, "2026-11-05", INDEX).state, "done");
});

const NOW = (d, h = 20) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00`);

test("finishDaily: XP 15·바이트 10, 도전 1일째, 하루 목표·연속 기록·XP 퀘스트에 반영", () => {
  let s = ensureDaily(save({ completed_lessons: ids(1) }), "2026-11-05", INDEX);
  s = { ...s, settings: { ...s.settings, dailyGoal: 10 } };
  s = recordDaily(s, "2026-11-05", [0, 1, 2], []);
  const { save: out, result } = finishDaily(s, { itemsSolved: 3, logs: [] }, NOW("2026-11-05"));
  assert.equal(result.mode, "daily");
  assert.equal(result.xp, 15);
  assert.equal(result.lessonBytes, 10);
  assert.equal(result.bonusBytes, 0);
  assert.equal(result.dailyStreak, 1);
  assert.equal(out.xp, 15);
  assert.equal(out.streak.todayXp, 15);
  assert.equal(out.streak.days, 1, "하루 목표 10을 채워 연속 기록 1일");
  assert.equal(result.streakUp, true);
  assert.equal(out.daily.streak, 1);
  assert.equal(out.daily.best, 1);
  assert.equal(out.daily.last_done_date, "2026-11-05");
  assert.deepEqual(out.daily.done, [0, 1, 2]);
  assert.equal(out.stats.items, 3);
  // 바이트 = 도전 10 + 퀘스트(있으면)
  assert.equal(out.bytes, 10 + result.questBytes);
  assert.equal(result.totalBytes, out.bytes);
  if (out.quests.ids.includes("q_xp20")) assert.equal(out.quests.progress.q_xp20, 15);
  // 퀘스트 「레슨 2개」에는 세지 않음
  assert.ok(!(out.quests.progress.q_lessons2 > 0));
  assert.equal(out.stats.lessons, 0);
});

test("finishDaily: 같은 날 두 번은 보상 없음", () => {
  let s = ensureDaily(save({ completed_lessons: ids(1) }), "2026-11-05", INDEX);
  const a = finishDaily(s, {}, NOW("2026-11-05")).save;
  const b = finishDaily(a, {}, NOW("2026-11-05"));
  assert.equal(b.result.xp, 0);
  assert.equal(b.save.xp, a.xp);
  assert.equal(b.save.bytes, a.bytes);
  assert.equal(b.save.daily.streak, 1);
});

function playDays(dates) {
  let s = save({ completed_lessons: ids(1) });
  const results = [];
  for (const d of dates) {
    s = ensureDaily(s, d, INDEX);
    const r = finishDaily(s, {}, NOW(d));
    s = r.save;
    results.push(r.result);
  }
  return { s, results };
}

test("도전 연속: 이어진 날 +1, 하루라도 빠지면 1부터, best는 유지", () => {
  const { s, results } = playDays(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-05", "2026-11-06"]);
  assert.deepEqual(results.map((r) => r.dailyStreak), [1, 2, 3, 1, 2]);
  assert.equal(s.daily.best, 3);
});

test("도전 7일째마다 +20바이트(7, 14일째)", () => {
  const dates = Array.from({ length: 15 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10));
  const { results } = playDays(dates);
  results.forEach((r, i) => {
    const day = i + 1;
    assert.equal(r.bonusBytes, day % 7 === 0 ? DAILY_BONUS_BYTES : 0, `day ${day}`);
    assert.ok(r.totalBytes >= DAILY_BYTES + r.bonusBytes);
  });
});

test("finishDaily: 자정을 넘겨 끝내면 도전 날짜(어제)로 기록, 오늘 도전은 남음", () => {
  let s = ensureDaily(save({ completed_lessons: ids(1) }), "2026-11-05", INDEX);
  const { save: out } = finishDaily(s, {}, NOW("2026-11-06", 0));
  assert.equal(out.daily.last_done_date, "2026-11-05");
  const t = ensureDaily(out, "2026-11-06", INDEX);
  assert.equal(dailyStatus(t, "2026-11-06", INDEX).state, "new");
  assert.equal(dailyStatus(t, "2026-11-06", INDEX).streak, 1);
});

test("cleanDaily: 깨진 값은 기본값으로(저장 옮기기)", () => {
  assert.deepEqual(cleanDaily(undefined), newDaily());
  assert.deepEqual(cleanDaily("x"), newDaily());
  const c = cleanDaily({ date: "2026-13-40", picks: [{ kind: "tpl", id: "1-T1", chapter: 1, seed: 500 }, { kind: "evil" }],
    done: [0, 0, 7, -1, "1", 2], streak: -3, best: 2.7, last_done_date: 5, extra: 1 });
  assert.equal(c.date, null);
  assert.deepEqual(c.picks, []);
  assert.deepEqual(c.done, [0, 2]);
  assert.equal(c.streak, 0);
  assert.equal(c.best, 2);
  assert.equal(c.last_done_date, null);
  const good = { date: "2026-11-05", picks: [{ kind: "tpl", id: "1-T1", chapter: 1, seed: 5 }, { kind: "tpl", id: "1-T2", chapter: 1, seed: 0 },
    { kind: "write", lesson: "1-3", chapter: 1 }], done: [1], streak: 3, best: 9, last_done_date: "2026-11-04" };
  assert.deepEqual(cleanDaily(good), good);
});
