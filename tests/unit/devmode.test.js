// v0.11.1 개발자 모드(검수용): 따로 저장 칸, 학습 기록은 그대로, 잠금 판정은 한 곳(isDev)으로
import { test } from "node:test";
import assert from "node:assert/strict";
import { SAVE_KEY, newSave, loadEx } from "../../src/save.js";
import { RESUME_KEY, readResume, writeResume, clearResume } from "../../src/resume.js";
import {
  DEV_FLAG_KEY, DEV_SAVE_KEY, DEV_RESUME_KEY, keysFor, readDevFlag, writeDevFlag, loadSlot, storeSlot, setDevMode, markDev,
} from "../../src/devmode.js";
import { isDev, DEV_MARK, gateCompleted, mainLessonIds } from "../../src/devgate.js";
import { curriculum, lessonStateOf, courseJustFinished } from "../../src/curriculum.js";
import { advancedState } from "../../src/advanced.js";
import { pickDaily, ensureDaily, dailyStatus, dailyOpen } from "../../src/daily.js";
import { passedChapters, newGarden } from "../../src/garden/state.js";
import { gardenOrderOpen } from "../../src/quests.js";
import { checkBadges } from "../../src/badges.js";
import { finishLesson } from "../../src/finish.js";
import { ORDERS } from "../../data/garden.js";

// 모든 읽기·쓰기를 적어 두는 가짜 저장소
function spyStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  const log = [];
  return {
    m, log,
    getItem: (k) => { log.push(["get", k]); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { log.push(["set", k]); m.set(k, String(v)); },
    removeItem: (k) => { log.push(["del", k]); m.delete(k); },
  };
}

const ch = (n, tpl = 3) => ({
  id: n, title: `${n}장`,
  lessons: [1, 2, 3, 4, 5].map((k) => ({ id: `${n}-${k}`, chapter: n, title: `레슨 ${n}-${k}`, concepts: [`c${n}`], isExam: k === 5 })),
  advanced: [1, 2, 3].map((k) => ({ id: `${n}-A${k}`, chapter: n, title: `심화 ${n}-A${k}`, concepts: [`a${n}`] })),
  ...(tpl ? { templates: Array.from({ length: tpl }, (_, i) => ({ id: `${n}-T${i + 1}`, concept: `c${n}` })) } : {}),
});
const INDEX = Array.from({ length: 17 }, (_, i) => ch(i + 1));
const LESSONS = INDEX.flatMap((c) => c.lessons);
const dev = (over = {}) => ({ ...newSave(), ...over, [DEV_MARK]: true });

// ---- 저장 칸 ----
test("키: 개발자 모드 깃발·저장·이어 하기는 학습 기록 키와 따로", () => {
  assert.equal(DEV_FLAG_KEY, "ria-python.dev");
  assert.equal(DEV_SAVE_KEY, "ria-python.dev.save");
  assert.equal(DEV_RESUME_KEY, "ria-python.dev.resume");
  assert.deepEqual(keysFor(false), { save: SAVE_KEY, resume: RESUME_KEY });
  assert.deepEqual(keysFor(true), { save: DEV_SAVE_KEY, resume: DEV_RESUME_KEY });
  assert.equal(new Set([DEV_FLAG_KEY, DEV_SAVE_KEY, DEV_RESUME_KEY, SAVE_KEY, RESUME_KEY]).size, 5);
});

test("깃발: 없으면 꺼짐, 켜면 남고(새로고침 뒤에도), 끄면 지워짐. 저장소가 막혀도 던지지 않음", () => {
  const st = spyStore();
  assert.equal(readDevFlag(st), false);
  assert.equal(writeDevFlag(st, true), true);
  assert.equal(readDevFlag(st), true);
  assert.equal(st.m.get(DEV_FLAG_KEY), "1");
  writeDevFlag(st, false);
  assert.equal(readDevFlag(st), false);
  assert.equal(st.m.has(DEV_FLAG_KEY), false);
  const bad = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } };
  assert.equal(readDevFlag(bad), false);
  assert.equal(writeDevFlag(bad, true), false);
  assert.equal(readDevFlag(null), false);
});

test("loadSlot(켬): 개발자 저장이 없으면 newSave() + 표시, 학습 기록 키는 읽지도 않음", () => {
  const real = JSON.stringify({ ...newSave(), xp: 999, completed_lessons: ["1-1"] });
  const st = spyStore({ [SAVE_KEY]: real });
  const r = loadSlot(st, true);
  assert.equal(r.readFailed, false);
  assert.equal(r.save.xp, 0);
  assert.deepEqual(r.save.completed_lessons, []);
  assert.equal(isDev(r.save), true);
  assert.ok(!st.log.some(([, k]) => k === SAVE_KEY), JSON.stringify(st.log));
});

test("loadSlot(끔): 학습 기록을 읽고 개발자 표시는 없음(혹시 섞여 들어와도 지움)", () => {
  const st = spyStore({ [SAVE_KEY]: JSON.stringify({ ...newSave(), xp: 30, [DEV_MARK]: true }) });
  const r = loadSlot(st, false);
  assert.equal(r.save.xp, 30);
  assert.equal(isDev(r.save), false);
  assert.ok(!(DEV_MARK in r.save));
});

test("storeSlot: 켜 있으면 개발자 키에만 쓰고, 꺼 있으면 표시를 뺀 저장을 학습 기록 키에", () => {
  const st = spyStore();
  assert.equal(storeSlot(st, { ...newSave(), xp: 5 }, true), true);
  assert.ok(st.m.has(DEV_SAVE_KEY) && !st.m.has(SAVE_KEY));
  assert.equal(JSON.parse(st.m.get(DEV_SAVE_KEY))[DEV_MARK], true);
  storeSlot(st, { ...newSave(), xp: 7, [DEV_MARK]: true }, false);
  const real = JSON.parse(st.m.get(SAVE_KEY));
  assert.equal(real.xp, 7);
  assert.ok(!(DEV_MARK in real), "학습 기록에는 개발자 표시가 들어가지 않음");
});

test("markDev: 켬 → 표시, 끔 → 표시 없음. 이미 맞으면 같은 객체", () => {
  const s = newSave();
  assert.equal(markDev(s, false), s);
  const d = markDev(s, true);
  assert.equal(isDev(d), true);
  assert.equal(markDev(d, true), d);
  assert.equal(isDev(markDev(d, false)), false);
  assert.ok(!(DEV_MARK in s), "원본은 그대로");
});

test("켬 → 활동(저장·이어 하기 여러 번) → 끔: 학습 기록·이어 하기 칸은 한 글자도 그대로이고 그동안 손대지 않음", () => {
  // 일부러 공백·모르는 칸이 든 원문(다시 쓰면 모양이 바뀌어 들킴)
  const realText = '{ "saveVer": 2,  "xp": 120, "bytes": 33, "completed_lessons": ["1-1","1-2"], "zz_unknown": {"a": 1} }';
  const resumeText = JSON.stringify({ v: 1, lessonId: "1-3", mode: "lesson", savedAt: 1 });
  const st = spyStore({ [SAVE_KEY]: realText, [RESUME_KEY]: resumeText });

  const before = loadSlot(st, false).save;            // 앱을 연 상태(꺼짐)
  st.log.length = 0;
  let r = setDevMode(st, true);
  assert.equal(readDevFlag(st), true);
  let s = r.save;
  for (let i = 0; i < 5; i++) {
    s = { ...s, xp: s.xp + 10, completed_lessons: [...s.completed_lessons, `${i + 1}-1`] };
    storeSlot(st, s, true);
  }
  const { resume } = keysFor(true);
  writeResume(st, { v: 1, lessonId: "17-3", savedAt: 2 }, resume);
  readResume(st, { key: resume, now: 3 });
  clearResume(st, resume);
  assert.ok(!st.log.some(([, k]) => k === SAVE_KEY || k === RESUME_KEY), "켜 있는 동안 학습 기록 키를 읽거나 쓰지 않음: " + JSON.stringify(st.log));

  r = setDevMode(st, false);
  assert.equal(st.m.get(SAVE_KEY), realText, "학습 기록 원문 그대로");
  assert.equal(st.m.get(RESUME_KEY), resumeText, "이어 하기 원문 그대로");
  assert.deepEqual(r.save, before, "끄면 학습 기록을 그대로 다시 읽음");
  assert.equal(isDev(r.save), false);
  assert.equal(readDevFlag(st), false);
  assert.ok(st.m.has(DEV_SAVE_KEY), "개발자 저장은 남겨 둠");
});

test("개발자 저장은 껐다 켜도 이어짐", () => {
  const st = spyStore();
  let s = setDevMode(st, true).save;
  storeSlot(st, { ...s, xp: 50 }, true);
  setDevMode(st, false);
  s = setDevMode(st, true).save;
  assert.equal(s.xp, 50);
  assert.equal(isDev(s), true);
});

test("깨진 개발자 저장은 개발자 키 옆에 남기고 새로 시작(학습 기록 쪽 .broken은 건드리지 않음)", () => {
  const st = spyStore({ [DEV_SAVE_KEY]: "{oops" });
  const r = loadSlot(st, true);
  assert.equal(r.save.xp, 0);
  assert.equal(st.m.get(DEV_SAVE_KEY + ".broken"), "{oops");
  assert.ok(![...st.m.keys()].some((k) => k.startsWith(SAVE_KEY + ".")));
  // 기본 키 인자는 예전과 같음
  const st2 = spyStore({ [SAVE_KEY]: "{bad" });
  loadEx(st2);
  assert.equal(st2.m.get(SAVE_KEY + ".broken"), "{bad");
});

// ---- 잠금 판정 ----
test("isDev·gateCompleted: 개발자 저장이면 판정용 끝낸 목록에 본 과정 전부(저장 자체는 그대로)", () => {
  assert.equal(isDev(null), false);
  assert.equal(isDev(newSave()), false);
  assert.equal(isDev({ [DEV_MARK]: "yes" }), false, "참(true)만");
  assert.equal(mainLessonIds(INDEX).length, 85);
  const s = dev({ completed_lessons: ["1-A1"] });
  const g = gateCompleted(s, INDEX);
  assert.equal(g.length, 86);
  assert.ok(g.includes("17-5") && g.includes("1-A1"));
  assert.deepEqual(s.completed_lessons, ["1-A1"]);
  const n = { ...newSave(), completed_lessons: ["1-1"] };
  assert.deepEqual(gateCompleted(n, INDEX), ["1-1"]);
});

test("lessonStateOf: 꺼짐은 순서대로, 켜짐은 본 과정·심화 모두 열림. 끝낸 것은 done/perfect 그대로", () => {
  const off = { ...newSave(), completed_lessons: ["1-1"], grading_results: { "1-1": { perfect: true } } };
  assert.equal(lessonStateOf(INDEX, off, "1-1"), "perfect");
  assert.equal(lessonStateOf(INDEX, off, "1-2"), "open");
  assert.equal(lessonStateOf(INDEX, off, "17-3"), "locked");
  assert.equal(lessonStateOf(INDEX, off, "13-A1"), "locked");
  assert.equal(lessonStateOf(INDEX, off, "99-1"), "locked");
  const on = dev({ completed_lessons: ["2-2"], grading_results: { "2-2": { perfect: false } } });
  assert.equal(lessonStateOf(INDEX, on, "17-3"), "open");
  assert.equal(lessonStateOf(INDEX, on, "13-A1"), "open");
  assert.equal(lessonStateOf(INDEX, on, "2-2"), "done");
  assert.equal(lessonStateOf(INDEX, on, "99-1"), "locked", "없는 레슨은 켜도 잠김");
  assert.equal(advancedState(INDEX, on, "13-A1"), "open");
  assert.equal(advancedState(INDEX, { ...on, [DEV_MARK]: false }, "13-A1"), "locked");
});

test("curriculum(dev): 잠김 없음·심화 모두 열림, 완료 개수는 실제 기록만", () => {
  const c = curriculum({ chapters: INDEX, completed: [], currentId: "1-1", dev: true });
  const st = c.chapters.flatMap((x) => x.lessons.map((l) => l.status));
  assert.ok(!st.includes("locked"), st.join());
  assert.equal(c.chapters[0].lessons[0].status, "current");
  assert.ok(c.chapters.every((x) => x.advanced.every((l) => l.status === "open")));
  assert.equal(c.done, 0);
  assert.equal(c.advDone, 0);
  const off = curriculum({ chapters: INDEX, completed: [], currentId: "1-1" });
  assert.equal(off.chapters[16].lessons[2].status, "locked");
});

test("매일 도전(dev): 새 저장에서도 열리고, 모든 장의 틀·직접 작성에서 고름. 저장의 끝낸 목록은 그대로", () => {
  const s = dev();
  assert.equal(dailyOpen(INDEX, s.completed_lessons), false, "dailyOpen 자체는 받은 목록만 봄");
  const tplCh = new Set(), writeCh = new Set();
  for (let d = 1; d <= 120; d++) {
    const day = `2026-${String(1 + (d % 12)).padStart(2, "0")}-${String(1 + (d % 28)).padStart(2, "0")}`;
    const p = pickDaily(INDEX, s, day);
    assert.equal(p.length, 3, day);
    p.filter((x) => x.kind === "tpl").forEach((x) => tplCh.add(x.chapter));
    p.filter((x) => x.kind === "write").forEach((x) => writeCh.add(x.chapter));
  }
  assert.ok(tplCh.size >= 15 && tplCh.has(17), [...tplCh].join());
  assert.ok(writeCh.size >= 12, [...writeCh].join());
  const e = ensureDaily(s, "2026-11-05", INDEX);
  assert.equal(e.daily.picks.length, 3);
  assert.deepEqual(e.completed_lessons, []);
  assert.equal(isDev(e), true);
  assert.equal(dailyStatus(e, "2026-11-05", INDEX).state, "new");
  // 꺼진 새 저장은 그대로 잠김
  assert.equal(pickDaily(INDEX, newSave(), "2026-11-05"), null);
  assert.equal(dailyStatus(newSave(), "2026-11-05", INDEX).state, "locked");
});

test("텃밭(dev): 통과한 장 = 모든 장, q_garden 조건도 같은 기준", () => {
  assert.deepEqual([...passedChapters(dev(), INDEX)], INDEX.map((c) => c.id));
  assert.deepEqual([...passedChapters(newSave(), INDEX)], []);
  const g = (idx, runs) => ({ ...newGarden(), order: { idx, done: [], paid: [] }, runs });
  assert.equal(gardenOrderOpen(dev({ garden: g(0, 1) })), true);
  assert.equal(gardenOrderOpen(dev({ garden: g(ORDERS.length - 1, 1) })), true, "9장 주문도 기다림 없음");
  assert.equal(gardenOrderOpen(dev({ garden: g(0, 0) })), false, "실행 0번은 그대로(C65)");
  assert.equal(gardenOrderOpen(dev({ garden: g(ORDERS.length, 1) })), false, "남은 주문 없음");
  assert.equal(gardenOrderOpen({ ...newSave(), garden: g(0, 1) }), false, "꺼짐: 1장 평가 필요");
});

test("열어 주기만으로 배지·과정 완주가 생기지 않음(실제로 한 것만)", () => {
  const s = dev();
  assert.deepEqual(checkBadges(s, { advancedIds: INDEX.flatMap((c) => c.advanced.map((l) => l.id)) }), []);
  assert.equal(courseJustFinished({ chapters: INDEX, completed: s.completed_lessons, firstTime: true, lessonId: "17-5" }), false);
  const lesson = { id: "17-3", chapter: 17, title: "x", items: [] };
  const { save } = finishLesson(s, { lesson, mode: "lesson", accuracy: 1, logs: [], marks: [], nextLessonId: "1-1", nextChapter: 1, advancedIds: [] }, new Date("2026-11-05T12:00:00"));
  assert.deepEqual(save.completed_lessons, ["17-3"]);
  assert.ok(!save.badges.includes("ch1") && !save.badges.includes("first_print"), save.badges.join());
  assert.equal(isDev(save), true, "개발자 표시는 저장이 바뀌어도 따라감");
});

test("LESSONS 고정값 확인", () => { assert.equal(LESSONS.length, 85); });
