// v0.7 작업 1: 심화 레슨 엔진 (설계 docs/specs/2026-10-31-심화학습-설계.md 1절)
// 열림(장 평가 통과 즉시·선택), 진도·완주에서 제외, 보상, 배지, 복습, 옛 저장, 레슨 목록·장 파일
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLessonIndex, createLessonData, chaptersForConcepts, reviewPool } from "../../src/lessondata.js";
import {
  isAdvancedId, isAdvancedLesson, advancedOpen, advancedState, advancedIds, advancedCount, ADV_XP, ADV_BYTES,
} from "../../src/advanced.js";
import { curriculum, courseJustFinished, pathEndText } from "../../src/curriculum.js";
import { lessonReward } from "../../src/rules.js";
import { finishLesson } from "../../src/finish.js";
import { checkBadges } from "../../src/badges.js";
import { BADGES } from "../../data/badges.js";
import { newSave, migrate } from "../../src/save.js";
import { packResume, readResume, restoreSession, RESUME_KEY } from "../../src/resume.js";
import { newSession } from "../../src/session.js";
import { nextCard, current } from "../../src/lessonflow.js";

// ---- 작은 시험 레슨 ----
const lesson = (id, n, extra = {}) => ({
  id, chapter: n, title: `레슨 ${id}`, goal: `목표 ${id}`, summary: [`요약 ${id}`],
  cards: [{ say: `카드 ${id}`, code: "print(1)", out: "1" }],
  items: [
    { type: "choice", concept: `c${n}`, q: `문제 ${id}`, options: ["a", "b"], answer: 0 },
    { type: "write", concept: `w${id}`, task: `작성 ${id}`, tests: [] },
    { type: "check", concept: `c${n}`, q: "확인", options: ["a", "b"], answer: 1 },
  ],
  ...extra,
});
const mod = (n, { adv = true } = {}) => ({
  CHAPTER: { id: n, title: `${n}장` },
  LESSONS: [1, 2, 3, 4, 5].map((k) => lesson(`${n}-${k}`, n, k === 5 ? { isExam: true } : {})),
  ...(adv ? { ADVANCED: [1, 2, 3].map((k) => lesson(`${n}-A${k}`, n, { isAdvanced: true })) } : {}),
});
const IDX = buildLessonIndex([mod(1), mod(2), mod(3, { adv: false })]);
const mainIds = (n) => [1, 2, 3, 4, 5].map((k) => `${n}-${k}`);
const ALL_MAIN = [...mainIds(1), ...mainIds(2), ...mainIds(3)];

// ---- 데이터: 레슨 목록·장 파일 ----
test("adv_index: 심화 stub은 장의 advanced에, 본 과정 lessons에는 섞이지 않음", () => {
  const c1 = IDX[0];
  assert.deepEqual(c1.lessons.map((l) => l.id), mainIds(1));
  assert.deepEqual(c1.advanced.map((l) => l.id), ["1-A1", "1-A2", "1-A3"]);
  assert.deepEqual(c1.advanced[0], { id: "1-A1", chapter: 1, title: "레슨 1-A1", goal: "목표 1-A1", concepts: ["c1", "w1-A1"], isAdvanced: true });
  const text = JSON.stringify(IDX);
  assert.ok(!text.includes("작성 1-A1") && !text.includes("카드 1-A1"), "목록에 문제·카드 없음");
});

test("adv_index_optional: ADVANCED 없는 장은 advanced 칸 자체가 없음(목록 크기·기존 모양 그대로)", () => {
  assert.equal(IDX[2].id, 3);
  assert.ok(!("advanced" in IDX[2]));
  const empty = buildLessonIndex([{ ...mod(4, { adv: false }), ADVANCED: [] }]);
  assert.ok(!("advanced" in empty[0]));
});

test("adv_dev_mode: 개발판(modules)에서 심화 레슨 전체를 받고 장 번호를 앎", async () => {
  const d = createLessonData({ modules: [mod(1), mod(2)] });
  assert.equal(d.chapterOf("1-A2"), 1);
  const l = await d.getLesson("1-A2");
  assert.equal(l.id, "1-A2");
  assert.equal(l.items.length, 3);
  assert.deepEqual(d.lessons.map((x) => x.id), [...mainIds(1), ...mainIds(2)], "lessons는 본 과정만");
  assert.deepEqual(d.advanced.map((x) => x.id), ["1-A1", "1-A2", "1-A3", "2-A1", "2-A2", "2-A3"]);
  const ch = await d.getChapter(1);
  assert.equal(ch.ADVANCED.length, 3);
});

test("adv_split_mode: 배포판은 장 파일의 ADVANCED에서 심화 레슨을 꺼냄", async () => {
  const body = mod(2);
  const d = createLessonData({
    index: buildLessonIndex([mod(1), mod(2)]), files: { 1: "lessons/ch1-11111111.json", 2: "lessons/ch2-22222222.json" },
    base: "https://x.test/", fetch: async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) }),
  });
  const l = await d.getLesson("2-A3");
  assert.equal(l.id, "2-A3");
  assert.equal(l.isAdvanced, true);
  assert.equal(await d.getLesson("2-A9"), null);
});

test("adv_split_old_file: ADVANCED 없는 장 파일도 그대로 받음", async () => {
  const body = mod(3, { adv: false });
  const d = createLessonData({
    index: buildLessonIndex([body]), files: { 3: "lessons/ch3-33333333.json" },
    base: "https://x.test/", fetch: async () => ({ ok: true, status: 200, json: async () => body }),
  });
  const ch = await d.getChapter(3);
  assert.deepEqual(ch.ADVANCED, []);
  assert.equal((await d.getLesson("3-2")).id, "3-2");
});

// ---- 열림 규칙 ----
test("adv_ids: N-Ak 모양 알아보기", () => {
  assert.ok(isAdvancedId("1-A1") && isAdvancedId("17-A3"));
  assert.ok(!isAdvancedId("1-1") && !isAdvancedId("A1") && !isAdvancedId("1-A") && !isAdvancedId(null));
  assert.ok(isAdvancedLesson({ id: "2-A1" }) && isAdvancedLesson({ id: "x", isAdvanced: true }));
  assert.ok(!isAdvancedLesson({ id: "2-1" }) && !isAdvancedLesson(null));
});

test("adv_unlock: 장 평가 전 잠김, 통과하면 세 개 함께 열림(순서 없음)", () => {
  const before = mainIds(1).slice(0, 4);
  assert.equal(advancedOpen(IDX[0], before), false);
  for (const k of [1, 2, 3]) assert.equal(advancedState(IDX, { completed_lessons: before, grading_results: {} }, `1-A${k}`), "locked");
  const after = mainIds(1);
  assert.equal(advancedOpen(IDX[0], after), true);
  const s = { completed_lessons: [...after, "1-A3"], grading_results: { "1-A3": { perfect: true } } };
  assert.equal(advancedState(IDX, s, "1-A1"), "open");
  assert.equal(advancedState(IDX, s, "1-A2"), "open");
  assert.equal(advancedState(IDX, s, "1-A3"), "perfect");
  assert.equal(advancedState(IDX, { ...s, grading_results: {} }, "1-A3"), "done");
  assert.equal(advancedState(IDX, s, "2-A1"), "locked", "다른 장 심화는 그 장 평가 전이면 잠김");
  assert.equal(advancedState(IDX, s, "1-2"), null, "본 과정 레슨은 이 함수 몫이 아님");
  assert.equal(advancedState(IDX, s, "9-A1"), null, "없는 심화");
});

test("adv_count_ids: 장마다 n/3, 전체 id 목록", () => {
  assert.deepEqual(advancedCount(IDX[0], ["1-A1", "1-A3", "2-A1"]), { done: 2, total: 3 });
  assert.deepEqual(advancedCount(IDX[2], ["1-A1"]), { done: 0, total: 0 });
  assert.deepEqual(advancedIds(IDX), ["1-A1", "1-A2", "1-A3", "2-A1", "2-A2", "2-A3"]);
});

// ---- 진도·완주: 심화는 선택 ----
test("adv_progress: 학습 내용의 본 과정 개수·지금 레슨은 심화와 무관, 심화는 따로", () => {
  const done = [...mainIds(1), "1-A1", "1-A2"];
  const c = curriculum({ chapters: IDX, completed: done, currentId: "2-1" });
  assert.equal(c.total, 15, "본 과정 레슨만");
  assert.equal(c.done, 5, "심화 완료는 본 과정 완료 수에 안 들어감");
  assert.deepEqual(c.current, { id: "2-1", title: "레슨 2-1" });
  assert.equal(c.chapters[0].done, 5);
  assert.equal(c.chapters[0].total, 5);
  assert.deepEqual(c.chapters[0].advanced.map((l) => l.status), ["done", "done", "open"]);
  assert.equal(c.chapters[0].advDone, 2);
  assert.equal(c.chapters[0].advTotal, 3);
  assert.deepEqual(c.chapters[1].advanced.map((l) => l.status), ["locked", "locked", "locked"]);
  assert.equal(c.chapters[2].advTotal, 0);
  assert.deepEqual(c.chapters[2].advanced, []);
  assert.equal(c.advDone, 2);
  assert.equal(c.advTotal, 6);
  assert.equal(c.chapters[1].lessons[0].status, "current", "심화를 건너뛰어도 다음 장은 열림");
});

test("adv_course_done: 완주(C39)는 본 과정만 — 심화 안 해도 완주, 심화 첫 완료는 완주 아님", () => {
  // 다음 장 예정이 없게 4~17장까지 채운 과정
  const mods = Array.from({ length: 17 }, (_, i) => mod(i + 1, { adv: i < 2 }));
  const idx = buildLessonIndex(mods);
  const main = idx.flatMap((c) => c.lessons.map((l) => l.id));
  assert.equal(courseJustFinished({ chapters: idx, completed: main, firstTime: true, lessonId: "17-5" }), true);
  assert.equal(courseJustFinished({ chapters: idx, completed: main.slice(0, -1).concat("1-A1"), firstTime: true, lessonId: "1-A1" }), false);
  assert.equal(courseJustFinished({ chapters: idx, completed: [...main, "1-A1"], firstTime: true, lessonId: "1-A1" }), false,
    "본 과정을 다 끝낸 뒤 심화를 처음 끝내도 「과정 완주!」가 다시 나오지 않음");
  assert.equal(pathEndText({ chapters: idx, completed: main }), "과정을 모두 끝냈어요! 복습으로 실력을 다져요");
});

// ---- 보상 ----
test("adv_reward: 처음 15·15 + 보통 레슨과 같은 보너스, 다시 하기는 기존 규칙", () => {
  assert.equal(ADV_XP, 15);
  assert.equal(ADV_BYTES, 15);
  assert.deepEqual(lessonReward({ firstTime: true, perfect: false, hintFreeWrite: false, isAdvanced: true }), { xp: 15, bytes: 15 });
  assert.deepEqual(lessonReward({ firstTime: true, perfect: true, hintFreeWrite: true, isAdvanced: true }), { xp: 25, bytes: 20 });
  assert.deepEqual(lessonReward({ firstTime: false, perfect: true, hintFreeWrite: true, isAdvanced: true }), { xp: 10, bytes: 0 });
  // 보통 레슨은 그대로
  assert.deepEqual(lessonReward({ firstTime: true, perfect: false, hintFreeWrite: false }), { xp: 10, bytes: 10 });
});

const at = (h = 10) => new Date(2026, 10, 2, h, 0);
const saveAfter = (done) => {
  const s = newSave();
  return { ...s, completed_lessons: done, current_lesson: "2-1", current_chapter: 2 };
};
const info = (l, over = {}) => ({
  lesson: l, mode: "lesson", perfect: false, accuracy: 0.8, marks: [], write: { passed: true, hintUsed: true, solutionSeen: false, fixedError: false },
  itemsSolved: 3, reviewCorrect: 0, logs: [], nextLessonId: "2-1", nextChapter: 2, advancedIds: advancedIds(IDX), ...over,
});

test("adv_finish: 첫 완료 +15 XP·+15 바이트, 지금 레슨·장은 그대로, 진도에 기록", () => {
  const s0 = saveAfter(mainIds(1));
  const { save, result } = finishLesson(s0, info(lesson("1-A1", 1, { isAdvanced: true })), at());
  assert.equal(result.xp, 15);
  assert.equal(result.lessonBytes, 15);
  assert.equal(result.firstTime, true);
  assert.ok(save.completed_lessons.includes("1-A1"));
  assert.equal(save.current_lesson, "2-1");
  assert.equal(save.current_chapter, 2);
  assert.equal(save.stats.lessons, 1, "퀘스트·통계는 레슨처럼 셈");
  assert.equal(save.streak.todayXp, 15, "하루 목표에도 들어감");
});

test("adv_finish_id_only: isAdvanced 표시가 빠져도 id 모양으로 심화 보상", () => {
  const { result } = finishLesson(saveAfter(mainIds(1)), info({ id: "1-A2", chapter: 1 }), at());
  assert.equal(result.xp, 15);
  assert.equal(result.lessonBytes, 15);
});

test("adv_finish_replay: 다시 하기는 XP 10·바이트 0", () => {
  const s0 = saveAfter([...mainIds(1), "1-A1"]);
  const { result } = finishLesson(s0, info(lesson("1-A1", 1, { isAdvanced: true }), { perfect: true }), at());
  assert.equal(result.firstTime, false);
  assert.equal(result.xp, 10);
  assert.equal(result.lessonBytes, 0);
});

test("adv_quest: 심화 완료도 lesson_done 퀘스트를 채움", () => {
  let s0 = saveAfter(mainIds(1));
  const { save } = finishLesson(s0, info(lesson("1-A1", 1, { isAdvanced: true })), at());
  const q = save.quests;
  if (q.ids.includes("q_lessons2")) assert.equal(q.progress.q_lessons2, 1);
  assert.ok(q.ids.includes("q_xp20") ? q.progress.q_xp20 >= 15 : true);
});

test("adv_review_queue: 심화 개념도 틀리면 복습 목록에 들어감", () => {
  const { save } = finishLesson(saveAfter(mainIds(1)),
    info(lesson("1-A1", 1, { isAdvanced: true }), { marks: [["adv_concept", "wrong"]] }), at());
  assert.deepEqual(save.review_queue, ["adv_concept"]);
});

// ---- 배지 ----
test("adv_badges_table: 배지 15개, 새 배지 2개 이름", () => {
  assert.equal(BADGES.length, 15);
  const b1 = BADGES.find((b) => b.id === "advanced1");
  const b2 = BADGES.find((b) => b.id === "advancedAll");
  assert.equal(b1.name, "심화 첫걸음");
  assert.equal(b2.name, "깊이 파는 사람");
});

test("adv_badge_first: 심화 하나 끝내면 advanced1", () => {
  const { result } = finishLesson(saveAfter(mainIds(1)), info(lesson("1-A1", 1, { isAdvanced: true })), at());
  assert.ok(result.newBadges.includes("advanced1"));
  assert.ok(!result.newBadges.includes("advancedAll"));
  assert.deepEqual(checkBadges({ ...newSave(), completed_lessons: mainIds(1) }, {}).filter((b) => b.startsWith("adv")), []);
});

test("adv_badge_all: 지금 과정에 있는 심화 전부(목록의 심화 stub 전부)를 끝내야 advancedAll", () => {
  const ids = advancedIds(IDX);
  const s = { ...newSave(), completed_lessons: [...mainIds(1), ...mainIds(2), ...ids.slice(0, -1)] };
  assert.ok(!checkBadges(s, { advancedIds: ids }).includes("advancedAll"));
  const { result } = finishLesson(s, info(lesson("2-A3", 2, { isAdvanced: true })), at());
  assert.ok(result.newBadges.includes("advancedAll"));
  // 심화 목록을 모르면(빈 목록) 주지 않음
  const full = { ...newSave(), completed_lessons: [...ids] };
  assert.ok(!checkBadges(full, {}).includes("advancedAll"));
  assert.ok(!checkBadges(full, { advancedIds: [] }).includes("advancedAll"));
});

// ---- 복습 ----
test("adv_review_concepts: 끝낸 심화의 개념이 든 장만 받음", () => {
  assert.deepEqual(chaptersForConcepts(IDX, ["w1-A2"], []), [], "아직 안 한 심화의 개념만으로는 장을 받지 않음");
  assert.deepEqual(chaptersForConcepts(IDX, ["w1-A2"], ["1-A2"]), [1]);
  assert.deepEqual(chaptersForConcepts(IDX, ["c2"], []), [2], "본 과정 개념은 그대로");
});

test("adv_review_pool: 복습 문제는 본 과정 + 끝낸 심화에서만, check는 choice로", () => {
  const chs = [mod(1), mod(2)];
  const pool = reviewPool(chs, ["c1", "w1-A1"], ["1-A1"]);
  const from = [...new Set(pool.map((p) => p.from))].sort();
  assert.deepEqual(from, ["1-1", "1-2", "1-3", "1-4", "1-5", "1-A1"], "1-A2·1-A3(안 끝냄) 빠짐");
  assert.ok(pool.every((p) => p.type !== "check" && p.type !== "write"));
  assert.ok(pool.some((p) => p.from === "1-A1" && p.concept === "c1"));
});

// ---- 이어 하기(C44) ----
test("adv_resume: 심화 레슨도 이어 하기 기록·되살리기", () => {
  const l = lesson("1-A1", 1, { isAdvanced: true });
  const S = newSession(l);
  S.flow = nextCard(S.flow);
  assert.equal(current(S.flow).kind, "item");
  const store = new Map();
  const st = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  st.setItem(RESUME_KEY, JSON.stringify(packResume({ lessonId: "1-A1", S, now: 1000 })));
  const rec = readResume(st, { now: 2000, exists: (id) => id === "1-A1" });
  assert.equal(rec.lessonId, "1-A1");
  const S2 = restoreSession(rec, l);
  assert.ok(S2);
  assert.equal(S2.flow.cardPos, 1);
});

// ---- 옛 저장 ----
test("adv_old_save: 심화 진도가 없는 옛 저장도 그대로 열림(saveVer 그대로)", () => {
  const old = { ...newSave(), completed_lessons: mainIds(1), current_lesson: "2-1" };
  const m = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(m.saveVer, newSave().saveVer);
  assert.deepEqual(m.completed_lessons, mainIds(1));
  assert.equal(advancedState(IDX, m, "1-A1"), "open");
  assert.equal(advancedState(IDX, m, "2-A1"), "locked");
  const c = curriculum({ chapters: IDX, completed: m.completed_lessons, currentId: "2-1" });
  assert.equal(c.advDone, 0);
  assert.equal(c.done, 5);
});
