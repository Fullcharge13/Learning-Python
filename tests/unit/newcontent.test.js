// v0.7.1 「새 내용」 점 (설계 docs/specs/2026-11-01-기초-보강-1-6장-설계.md 3절)
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasNewContent, lessonUpdated, markSeen } from "../../src/newcontent.js";
import { newSave, migrate, load, store } from "../../src/save.js";
import { finishLesson } from "../../src/finish.js";
import { lessonStub, advancedStub, buildLessonIndex } from "../../src/lessondata.js";
import { curriculum } from "../../src/curriculum.js";

const S12 = { id: "1-2", chapter: 1, title: "문자열", updated: "v0.7.1" };
const save = (over = {}) => ({ ...newSave(), ...over });

test("hasNewContent: 끝냄 + updated + 아직 안 봄 → 참", () => {
  assert.equal(hasNewContent(S12, save({ completed_lessons: ["1-1", "1-2"] })), true);
});

test("hasNewContent: 안 끝낸 레슨은 거짓", () => {
  assert.equal(hasNewContent(S12, save({ completed_lessons: ["1-1"] })), false);
});

test("hasNewContent: updated가 없거나 형식이 틀리면 거짓", () => {
  const s = save({ completed_lessons: ["1-2"] });
  assert.equal(hasNewContent({ id: "1-2" }, s), false);
  for (const bad of ["", "0.7.1", 71, true, null, {}]) assert.equal(hasNewContent({ id: "1-2", updated: bad }, s), false, String(bad));
});

test("hasNewContent: 같은 판을 이미 봤으면 거짓, 다른 판이면 다시 참", () => {
  assert.equal(hasNewContent(S12, save({ completed_lessons: ["1-2"], seen_updates: { "1-2": "v0.7.1" } })), false);
  assert.equal(hasNewContent({ ...S12, updated: "v0.8" }, save({ completed_lessons: ["1-2"], seen_updates: { "1-2": "v0.7.1" } })), true);
});

test("hasNewContent: 심화 레슨도 같은 규칙", () => {
  const a = { id: "1-A1", isAdvanced: true, updated: "v0.7.1" };
  assert.equal(hasNewContent(a, save({ completed_lessons: ["1-A1"] })), true);
  assert.equal(hasNewContent(a, save({ completed_lessons: ["1-A1"], seen_updates: { "1-A1": "v0.7.1" } })), false);
});

test("hasNewContent: 옛 저장(seen_updates 없음)·이상한 값에도 던지지 않음", () => {
  const old = { completed_lessons: ["1-2"] };
  assert.equal(hasNewContent(S12, old), true);
  assert.equal(hasNewContent(S12, { completed_lessons: ["1-2"], seen_updates: null }), true);
  assert.equal(hasNewContent(S12, null), false);
  assert.equal(hasNewContent(null, old), false);
});

test("lessonUpdated: 판 이름 글자만", () => {
  assert.equal(lessonUpdated({ updated: "v0.7.1" }), "v0.7.1");
  assert.equal(lessonUpdated({ updated: "v1.0" }), "v1.0");
  assert.equal(lessonUpdated({ updated: "v0.7.1 " }), null);
  assert.equal(lessonUpdated({}), null);
});

test("markSeen: updated가 있으면 기록, 없으면 같은 저장", () => {
  const s = save({ completed_lessons: ["1-2"] });
  const m = markSeen(s, S12);
  assert.deepEqual(m.seen_updates, { "1-2": "v0.7.1" });
  assert.deepEqual(s.seen_updates, {}, "원본은 바꾸지 않음");
  assert.equal(markSeen(s, { id: "1-1" }), s);
});

// ── 저장 ─────────────────────────────────────────────────────────────
test("save: 새 저장에 seen_updates {} — saveVer 그대로", () => {
  assert.deepEqual(newSave().seen_updates, {});
  assert.equal(newSave().saveVer, 2);
});

test("save: 옛 저장(칸 없음)은 {}로, 판 번호 그대로", () => {
  const m = migrate({ saveVer: 2, completed_lessons: ["1-1", "1-2"] });
  assert.deepEqual(m.seen_updates, {});
  assert.equal(m.saveVer, 2);
});

test("save: seen_updates 형 검사 — 객체가 아니면 {}, 글자가 아닌 값·위험한 키는 버림", () => {
  assert.deepEqual(migrate({ seen_updates: ["v0.7.1"] }).seen_updates, {});
  assert.deepEqual(migrate({ seen_updates: "x" }).seen_updates, {});
  const m = migrate(JSON.parse('{"seen_updates": {"1-2": "v0.7.1", "1-3": 5, "1-4": null, "__proto__": "v1", "x": "' + "v".repeat(40) + '"}}'));
  assert.deepEqual(m.seen_updates, { "1-2": "v0.7.1" });
  assert.equal(Object.getPrototypeOf(m.seen_updates), Object.prototype);
});

test("save: 저장했다 불러도 그대로", () => {
  const data = {};
  const st = { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
  store(st, { ...newSave(), seen_updates: { "1-2": "v0.7.1" } });
  assert.deepEqual(load(st).seen_updates, { "1-2": "v0.7.1" });
});

// ── 끝낼 때 기록 (다시 하기·처음·이어 하기 모두 finishLesson을 지난다) ─────────
const at = new Date(2026, 10, 1, 10, 0);
const info = (lesson, over = {}) => ({
  lesson, mode: "lesson", perfect: false, accuracy: 1, marks: [], write: null,
  itemsSolved: 3, reviewCorrect: 0, logs: [], nextLessonId: null, nextChapter: null, ...over,
});

test("finish: 다시 하기로 끝내면 seen_updates[id] = updated → 점 사라짐", () => {
  const before = save({ completed_lessons: ["1-1", "1-2"], current_lesson: "1-3" });
  assert.equal(hasNewContent(S12, before), true);
  const { save: after, result } = finishLesson(before, info({ ...S12, cards: [], items: [] }), at);
  assert.equal(result.firstTime, false);
  assert.deepEqual(after.seen_updates, { "1-2": "v0.7.1" });
  assert.equal(hasNewContent(S12, after), false);
});

test("finish: 보강된 레슨을 처음 끝내도 기록 → 점이 뜨지 않음", () => {
  const { save: after, result } = finishLesson(save({ completed_lessons: ["1-1"] }), info(S12), at);
  assert.equal(result.firstTime, true);
  assert.equal(hasNewContent(S12, after), false);
});

test("finish: 복습은 기록하지 않음, updated 없는 레슨은 칸을 늘리지 않음", () => {
  const s = save({ completed_lessons: ["1-2"] });
  assert.deepEqual(finishLesson(s, info(S12, { mode: "review" }), at).save.seen_updates, {});
  assert.deepEqual(finishLesson(s, info({ id: "1-1", chapter: 1 }), at).save.seen_updates, {});
});

test("finish: 다시 하기 보상은 기존 규칙 그대로(updated와 무관)", () => {
  const s = save({ completed_lessons: ["1-1", "1-2"] });
  const a = finishLesson(s, info(S12), at).result;
  const b = finishLesson(s, info({ id: "1-2", chapter: 1 }), at).result;
  assert.equal(a.xp, b.xp);
  assert.equal(a.lessonBytes, b.lessonBytes);
});

// ── 레슨 목록 stub ───────────────────────────────────────────────────
test("lessondata: stub에 updated를 옮김(형식이 맞을 때만)", () => {
  assert.equal(lessonStub({ id: "1-2", title: "t", updated: "v0.7.1" }, 1).updated, "v0.7.1");
  assert.equal("updated" in lessonStub({ id: "1-2", title: "t" }, 1), false);
  assert.equal("updated" in lessonStub({ id: "1-2", title: "t", updated: 3 }, 1), false);
  assert.equal(advancedStub({ id: "1-A1", title: "t", updated: "v0.7.1" }, 1).updated, "v0.7.1");
  const idx = buildLessonIndex([{ CHAPTER: { id: 1, title: "c" }, LESSONS: [{ id: "1-1", title: "a" }, { id: "1-2", title: "b", updated: "v0.7.1" }] }]);
  assert.deepEqual(idx[0].lessons.map((l) => l.updated), [undefined, "v0.7.1"]);
});

// ── 설정 「학습 내용」 목록 ───────────────────────────────────────────
test("curriculum: seenUpdates를 주면 레슨마다 isNew", () => {
  const chapters = [{ id: 1, title: "c", lessons: [{ id: "1-1", title: "a" }, S12, { id: "1-3", title: "c", updated: "v0.7.1" }],
    advanced: [{ id: "1-A1", title: "x", updated: "v0.7.1" }] }];
  const c = curriculum({ chapters, completed: ["1-1", "1-2", "1-A1"], currentId: "1-3", seenUpdates: { "1-A1": "v0.7.1" } });
  assert.deepEqual(c.chapters[0].lessons.map((l) => l.isNew), [false, true, false]);
  assert.deepEqual(c.chapters[0].advanced.map((l) => l.isNew), [false]);
  // seenUpdates를 안 줘도(옛 부름) 동작
  const c2 = curriculum({ chapters, completed: ["1-2"], currentId: null });
  assert.equal(c2.chapters[0].lessons[1].isNew, true);
});
