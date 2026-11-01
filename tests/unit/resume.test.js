import { test } from "node:test";
import assert from "node:assert/strict";
import { startFlow, current, nextCard, answer } from "../../src/lessonflow.js";
import { newSession, touchResult, writePass, writeWrong, writeHint, logSubmit, finishInfo } from "../../src/session.js";
import { RESUME_KEY, RESUME_MAX_MS, packResume, readResume, writeResume, clearResume, restoreSession, hasProgress } from "../../src/resume.js";
import { finishLesson } from "../../src/finish.js";
import { newSave } from "../../src/save.js";

function memStore() {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const T0 = Date.UTC(2026, 10, 1, 3, 0);

// 카드 2장, choice 3개, write 1개, check 1개
function lesson(id = "1-2") {
  const ch = (n, c) => ({ type: "choice", id: n, concept: c, options: ["a", "b"], answer: 0 });
  return {
    id, chapter: 1, cards: [{ say: "1" }, { say: "2" }],
    items: [ch(1, "print"), ch(2, "string"), ch(3, "print"),
      { type: "write", concept: "string", tests: [] },
      { type: "check", concept: "print", options: ["a", "b"], answer: 0 }],
  };
}

// 화면 대신 같은 순수 함수로 끝까지 푼다. script: 문제 번호 → 답 차례(터치: true/false 목록, write: 동작 목록)
// interruptAt: 이 걸음 뒤에 저장 → JSON → 다시 읽어 이어 감(null이면 끊지 않음)
function play(L, interruptAt = null) {
  const store = memStore();
  let S = newSession(L);
  let W = null;                // 지금 write 문제의 화면 상태(힌트·제출 수 등)
  const touch = { 0: [false, true], 1: [true], 2: [false, false, true], 4: [false, true] };
  const writeScript = ["hint", "wrong", "pass"];
  let wpos = 0;
  const used = {};
  let steps = 0;
  const maybeInterrupt = () => {
    steps++;
    if (steps !== interruptAt) return;
    const cur = current(S.flow, L);
    const item = cur.kind === "item" && cur.item.type === "write" && W ? { index: cur.index, code: "print(1)", ...W } : null;
    assert.ok(writeResume(store, packResume({ lessonId: L.id, S, item, now: T0 })));
    const rec = readResume(store, { now: T0 + 60_000, exists: (id) => id === L.id });
    assert.ok(rec, "다시 읽힘");
    const back = restoreSession(rec, L);
    assert.ok(back, "레슨과 맞음");
    S = back;
    W = rec.item ? { hintsShown: rec.item.hintsShown, solutionSeen: rec.item.solutionSeen, submits: rec.item.submits, hadError: rec.item.hadError } : null;
  };
  for (let g = 0; g < 100; g++) {
    const cur = current(S.flow, L);
    if (cur.kind === "done") break;
    if (cur.kind === "card") { S.flow = nextCard(S.flow); maybeInterrupt(); continue; }
    if (cur.item.type === "write") {
      W = W || { hintsShown: 0, solutionSeen: false, submits: 0, hadError: false };
      const act = writeScript[wpos++];
      if (act === "hint") { W.hintsShown++; writeHint(S, cur); }
      else if (act === "wrong") { W.submits++; W.hadError = true; logSubmit(S, L.id, cur.index, false, "t"); writeWrong(S, cur); }
      else {
        W.submits++; logSubmit(S, L.id, cur.index, true, "t");
        const r = writePass(S, cur, { solutionSeen: W.solutionSeen, hintUsed: W.hintsShown > 0, hadError: W.hadError, firstSubmit: W.submits === 1 });
        S.flow = answer(S.flow, r.flowCorrect); W = null;
      }
      maybeInterrupt();
      continue;
    }
    const k = used[cur.index] = (used[cur.index] || 0);
    const ok = touch[cur.index][k];
    used[cur.index]++;
    touchResult(S, cur, ok, false);
    S.flow = answer(S.flow, ok);
    maybeInterrupt();
  }
  const info = finishInfo(S, L, false);
  return finishLesson(newSave(), { ...info, nextLessonId: "1-3", nextChapter: 1 }, new Date(T0));
}

test("resume: 어느 걸음에서 끊고 이어도 보상·저장이 끊지 않은 것과 같음", () => {
  const L = lesson();
  const whole = play(L);
  assert.ok(whole.result.xp > 0);
  for (let k = 1; k <= 14; k++) {
    const r = play(L, k);
    assert.deepEqual(r.result, whole.result, "걸음 " + k);
    assert.deepEqual(r.save, whole.save, "걸음 " + k);
  }
});

test("resume: write 문제 중간(힌트·틀린 제출 뒤)에 끊어도 정답 처리와 표시가 같음", () => {
  // 걸음 6·7이 write의 hint·wrong 뒤 (카드 2 + 첫 터치 3 = 5, 재도전은 write 뒤로 감)
  const L = lesson();
  const whole = play(L);
  for (const k of [6, 7]) assert.deepEqual(play(L, k).result, whole.result);
});

test("resume: 24시간이 지나면 버리고 칸을 지움", () => {
  const st = memStore();
  const S = newSession(lesson()); S.flow = nextCard(S.flow);
  writeResume(st, packResume({ lessonId: "1-2", S, item: null, now: T0 }));
  assert.ok(readResume(st, { now: T0 + RESUME_MAX_MS - 1, exists: () => true }));
  assert.equal(readResume(st, { now: T0 + RESUME_MAX_MS + 1, exists: () => true }), null);
  assert.equal(st.getItem(RESUME_KEY), null);
});

test("resume: 없는 레슨이면 버리고 칸을 지움", () => {
  const st = memStore();
  const S = newSession(lesson()); S.flow = nextCard(S.flow);
  writeResume(st, packResume({ lessonId: "1-2", S, item: null, now: T0 }));
  assert.equal(readResume(st, { now: T0, exists: () => false }), null);
  assert.equal(st.getItem(RESUME_KEY), null);
});

test("resume: 깨진 글·다른 모양은 null, 칸을 지움", () => {
  const st = memStore();
  st.setItem(RESUME_KEY, "{broken");
  assert.equal(readResume(st, { now: T0, exists: () => true }), null);
  assert.equal(st.getItem(RESUME_KEY), null);
  st.setItem(RESUME_KEY, JSON.stringify({ lessonId: "1-2", savedAt: T0 }));
  assert.equal(readResume(st, { now: T0, exists: () => true }), null);
});

test("resume: 저장소가 던져도 던지지 않음", () => {
  const bad = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } };
  assert.equal(readResume(bad, { now: T0, exists: () => true }), null);
  const S = newSession(lesson());
  assert.equal(writeResume(bad, packResume({ lessonId: "1-2", S, item: null, now: T0 })), false);
  assert.doesNotThrow(() => clearResume(bad));
  assert.equal(readResume(null, { now: T0, exists: () => true }), null);
});

test("resume: 레슨 내용(문제 수·종류·카드 수)이 바뀌었으면 restoreSession은 null", () => {
  const L = lesson();
  const S = newSession(L); S.flow = nextCard(S.flow);
  const rec = JSON.parse(JSON.stringify(packResume({ lessonId: L.id, S, item: null, now: T0 })));
  assert.ok(restoreSession(rec, L));
  const L2 = lesson(); L2.items.splice(1, 1);
  assert.equal(restoreSession(rec, L2), null);
  const L3 = lesson(); L3.cards.push({ say: "3" });
  assert.equal(restoreSession(rec, L3), null);
  assert.equal(restoreSession(rec, lesson("1-3")), null);
});

test("resume: 진행이 있어야 저장할 가치가 있음", () => {
  const S = newSession(lesson());
  assert.equal(hasProgress(S.flow), false);
  assert.equal(hasProgress(nextCard(S.flow)), true);
});

test("resume: 기록 모양 — 칸 이름·초안·저장 시각", () => {
  const L = lesson();
  const S = newSession(L); S.flow = nextCard(S.flow);
  const rec = packResume({ lessonId: L.id, S, item: { index: 3, code: "print(2)", hintsShown: 1, solutionSeen: false, submits: 0, hadError: false }, now: T0 });
  assert.equal(RESUME_KEY, "ria-python.resume");
  assert.equal(rec.lessonId, "1-2");
  assert.equal(rec.mode, "lesson");
  assert.equal(rec.savedAt, T0);
  assert.equal(rec.item.code, "print(2)");
  assert.equal(rec.flow._lesson, undefined);   // 레슨 내용은 넣지 않음
  JSON.stringify(rec);
});
