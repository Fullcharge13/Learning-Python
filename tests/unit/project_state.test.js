// v0.21.0 프로젝트 공방: 저장(save.projects)·보상·언어 묶임 (설계 docs/specs/2026-11-15-프로젝트-공방-설계.md §4-5·§4-6·§7)
import "./_guard_index.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROJECT_STEP_XP, PROJECT_DONE_XP, newProjects, cleanProjects, projectOpen, stepState, saveDraft, passStep,
  restartInLang, setProjectIndex, clearProjectIndex, projectIndex,
} from "../../src/projects/state.js";
import { newSave, migrate } from "../../src/save.js";
import { localDate } from "../../src/today.js";

const INDEX = [
  { id: "P1", need: 3, icon: "play", steps: 4, title: { ko: "가위바위보", en: "Rock Paper Scissors" }, blurb: { ko: "a", en: "b" } },
  { id: "P2", need: 5, icon: "star", steps: 3, title: { ko: "숫자", en: "Number" }, blurb: { ko: "a", en: "b" } },
];
setProjectIndex(INDEX);
const NOW = new Date(2026, 10, 15, 12, 0, 0);
const TODAY = localDate(NOW);

// 이정표·퀘스트 마감이 끼지 않는 저장(guard_state.test.js와 같은 방식)
function quietSave() {
  const s = newSave();
  s.streak.lastGoalDate = TODAY;
  s.streak.todayDate = TODAY;
  s.streak.days = 1; s.streak.best = 1;
  s.settings.dailyGoal = 30;
  s.quests = { date: TODAY, ids: [], progress: {}, done: [], chest: false };
  return s;
}
const pass = (s, step, code, opts = {}, lang = "ko", id = "P1") => passStep(s, id, lang, step, code, opts, NOW);

test("상수", () => {
  assert.equal(PROJECT_STEP_XP, 5);
  assert.equal(PROJECT_DONE_XP, 20);
});

test("newProjects 모양, newSave·migrate에 projects 칸", () => {
  assert.deepEqual(newProjects(), { v: 1, open: {}, done: {} });
  assert.deepEqual(newSave().projects, newProjects());
  assert.deepEqual(migrate({ xp: 3 }).projects, newProjects());   // 옛 저장(칸 없음) → 기본값
  assert.deepEqual(migrate({ projects: "broken" }).projects, newProjects());
});

test("cleanProjects: 망가진 값은 기본값, 모르는 id·이상한 칸은 버림", () => {
  assert.deepEqual(cleanProjects(undefined), newProjects());
  assert.deepEqual(cleanProjects([1, 2]), newProjects());
  const p = cleanProjects({
    v: 7,
    open: {
      P1: { lang: "en", step: 2, code: "x = 1", best: 2 },
      P2: { lang: "fr", step: -3, code: 5 },          // 이상한 lang → ko, 음수 step → 0, 코드가 글이 아님 → ""
      P9: { lang: "ko", step: 1, code: "" },           // 색인에 없는 id
      toString: { lang: "ko", step: 0, code: "" },
      __proto__x: 1,
    },
    done: { P1: { at: "2026-11-14", code: "print(1)", lang: "en" }, P2: "yes", P7: { at: "2026-11-14", code: "", lang: "ko" } },
  });
  assert.deepEqual(p.open.P1, { lang: "en", step: 2, code: "x = 1", best: 2 });
  assert.deepEqual(p.open.P2, { lang: "ko", step: 0, code: "", best: 0 });
  assert.deepEqual(Object.keys(p.open).sort(), ["P1", "P2"]);
  assert.deepEqual(p.done, { P1: { at: "2026-11-14", code: "print(1)", lang: "en" } });
  assert.equal(p.v, 1);
});

test("cleanProjects: step은 단계 수 안으로, best는 step 이상·단계 수 이하, 날짜가 아니면 null", () => {
  const p = cleanProjects({
    open: { P1: { lang: "ko", step: 99, code: "", best: 1 }, P2: { lang: "ko", step: 1.7, code: "", best: 50 } },
    done: { P2: { at: "어제", code: "c", lang: "ko" } },
  });
  assert.equal(p.open.P1.step, 3);   // P1은 4단계(0~3)
  assert.equal(p.open.P1.best, 3);
  assert.equal(p.open.P2.step, 1);
  assert.equal(p.open.P2.best, 3);
  assert.deepEqual(p.done.P2, { at: null, code: "c", lang: "ko" });
});

test("cleanProjects: kept(다른 언어 진행)도 다듬음", () => {
  const p = cleanProjects({ open: { P1: { lang: "en", step: 0, code: "", kept: { ko: { step: 2, code: "a" }, en: { step: 1, code: "b" }, fr: {} } } } });
  assert.deepEqual(p.open.P1.kept, { ko: { step: 2, code: "a" } });   // 지금 언어(en)와 같은 칸·모르는 언어는 버림
  const q = cleanProjects({ open: { P1: { lang: "en", step: 0, code: "", kept: "x" } } });
  assert.equal(q.open.P1.kept, undefined);
});

test("cleanProjects: 색인 없이도 던지지 않음(저장 읽기 순서와 상관없이)", () => {
  clearProjectIndex();
  try {
    const p = cleanProjects({ open: { P1: { lang: "ko", step: 2, code: "c" }, bad: {} } });
    assert.deepEqual(p.open, { P1: { lang: "ko", step: 2, code: "c", best: 2 } });
    assert.throws(() => projectIndex(), /setProjectIndex/);
  } finally {
    setProjectIndex(INDEX);
  }
});

test("projectOpen: 필요한 장 통과 또는 개발자 모드", () => {
  assert.equal(projectOpen(INDEX[0], [1, 2]), false);
  assert.equal(projectOpen(INDEX[0], [1, 2, 3]), true);
  assert.equal(projectOpen(INDEX[0], new Set([3])), true);
  assert.equal(projectOpen(INDEX[1], [3]), false);
  assert.equal(projectOpen(INDEX[1], [], true), true);
});

test("stepState: 처음·이어 하기·다른 언어", () => {
  const s = quietSave();
  assert.deepEqual(stepState(s, "P1", "ko"), { step: 0, code: "", langMismatch: null, resume: null });
  const s2 = saveDraft(s, "P1", "ko", 0, "me = input()");
  assert.deepEqual(stepState(s2, "P1", "ko"), { step: 0, code: "me = input()", langMismatch: null, resume: null });
  assert.deepEqual(stepState(s2, "P1", "en"), { step: 0, code: "me = input()", langMismatch: "ko", resume: null });
  assert.equal(s.projects.open.P1, undefined, "saveDraft는 원본 저장을 바꾸지 않음");
});

test("saveDraft: 지금 단계·같은 언어일 때만, 아니면 저장 그대로", () => {
  let s = saveDraft(quietSave(), "P1", "ko", 0, "a");
  const before = structuredClone(s);
  assert.deepEqual(saveDraft(s, "P1", "ko", 2, "b").projects, before.projects, "다른 단계");
  assert.deepEqual(saveDraft(s, "P1", "en", 0, "b").projects, before.projects, "다른 언어");
  assert.deepEqual(saveDraft(s, "P9", "ko", 0, "b").projects, before.projects, "모르는 id");
  s = saveDraft(s, "P1", "ko", 0, "b");
  assert.equal(s.projects.open.P1.code, "b");
});

test("passStep: 첫 통과 XP 5, 다음 단계로 코드가 이어짐, XP는 earnXp·퀘스트 xp 길로", () => {
  const s0 = quietSave();
  s0.quests = { date: TODAY, ids: ["q_xp20", "q_hintfree", "q_fixerr"], progress: {}, done: [], chest: false };
  const r = pass(s0, 0, "me = input()\nprint(me)");
  assert.equal(r.xp, PROJECT_STEP_XP);
  assert.equal(r.completed, false);
  assert.deepEqual(r.save.projects.open.P1, { lang: "ko", step: 1, code: "me = input()\nprint(me)", best: 1 });
  assert.equal(r.save.xp, s0.xp + PROJECT_STEP_XP);
  assert.equal(r.save.streak.todayXp, s0.streak.todayXp + PROJECT_STEP_XP);
  assert.equal(r.save.quests.progress.q_xp20, PROJECT_STEP_XP);
  assert.equal(s0.xp, 0, "원본 저장은 그대로");
  assert.deepEqual(stepState(r.save, "P1", "ko"), { step: 1, code: "me = input()\nprint(me)", langMismatch: null, resume: null });
});

test("passStep: usedSolution이면 그 단계 XP 0(진행은 넘어감)", () => {
  const r = pass(quietSave(), 0, "sol", { usedSolution: true });
  assert.equal(r.xp, 0);
  assert.equal(r.save.xp, 0);
  assert.equal(r.save.projects.open.P1.step, 1);
});

test("passStep: 지금 단계가 아니거나 다른 언어·모르는 id면 아무것도 안 함", () => {
  const s = pass(quietSave(), 0, "a").save;
  for (const [step, lang, id] of [[0, "ko", "P1"], [2, "ko", "P1"], [1, "en", "P1"], [0, "ko", "P9"]]) {
    const r = passStep(s, id, lang, step, "x", {}, NOW);
    assert.equal(r.xp, 0, `${id} ${lang} ${step}`);
    assert.equal(r.completed, false);
    assert.deepEqual(r.save.projects, s.projects);
    assert.equal(r.save.xp, s.xp);
  }
});

test("passStep: 마지막 단계 → 완성 +20, done에 완성작, open에서 빠짐", () => {
  let s = quietSave();
  let total = 0;
  for (let k = 0; k < 3; k++) {
    const r = pass(s, k, "code" + k);
    total += r.xp;
    s = r.save;
  }
  const r = pass(s, 3, "final code");
  assert.equal(r.completed, true);
  assert.equal(r.xp, PROJECT_STEP_XP + PROJECT_DONE_XP);
  assert.equal(total + r.xp, 4 * PROJECT_STEP_XP + PROJECT_DONE_XP);
  assert.deepEqual(r.save.projects.done.P1, { at: TODAY, code: "final code", lang: "ko" });
  assert.equal(r.save.projects.open.P1, undefined);
  assert.equal(r.save.xp, 4 * PROJECT_STEP_XP + PROJECT_DONE_XP);
});

test("passStep: 마지막 단계를 모범 코드로 넘겨도 완성 XP는 받음(그 단계 XP만 0)", () => {
  let s = quietSave();
  for (let k = 0; k < 3; k++) s = pass(s, k, "c").save;
  const r = pass(s, 3, "sol", { usedSolution: true });
  assert.equal(r.completed, true);
  assert.equal(r.xp, PROJECT_DONE_XP);
});

test("passStep: 이미 완성한 프로젝트를 다시 만들면 XP 없음, 진열장 코드만 새것으로", () => {
  let s = quietSave();
  for (let k = 0; k < 4; k++) s = pass(s, k, "v1").save;
  const xp = s.xp;
  for (let k = 0; k < 4; k++) {
    const r = pass(s, k, "v2");
    assert.equal(r.xp, 0, "step " + k);
    s = r.save;
  }
  assert.equal(s.xp, xp);
  assert.equal(s.projects.done.P1.code, "v2");
});

test("restartInLang: 다른 언어로 처음부터, 앞 언어 진행은 kept에 남김, 받은 XP는 다시 안 줌", () => {
  let s = quietSave();
  s = pass(s, 0, "ko0").save;
  s = pass(s, 1, "ko1").save;
  s = saveDraft(s, "P1", "ko", 2, "ko draft");
  const xp = s.xp;
  const r0 = restartInLang(s, "P1", "en");
  assert.deepEqual(r0.projects.open.P1, { lang: "en", step: 0, code: "", best: 2, kept: { ko: { step: 2, code: "ko draft" } } });
  assert.deepEqual(stepState(r0, "P1", "en"), { step: 0, code: "", langMismatch: null, resume: null });
  assert.deepEqual(stepState(r0, "P1", "ko"), { step: 0, code: "", langMismatch: "en", resume: { step: 2 } });
  // 영어로 다시 1·2단계: 이미 XP를 받은 단계라 0, 3단계(처음)는 5
  let t = pass(r0, 0, "en0", {}, "en");
  assert.equal(t.xp, 0);
  t = pass(t.save, 1, "en1", {}, "en");
  assert.equal(t.xp, 0);
  t = pass(t.save, 2, "en2", {}, "en");
  assert.equal(t.xp, PROJECT_STEP_XP);
  assert.equal(t.save.xp, xp + PROJECT_STEP_XP);
  // 다시 한국어로: kept에 남겨 둔 한국어 진행(2단계 초안)에서 이어 하고, 영어 진행이 kept로(검토 I2, §7 지우지 않음)
  const back = restartInLang(t.save, "P1", "ko");
  assert.deepEqual(back.projects.open.P1, { lang: "ko", step: 2, code: "ko draft", best: 3, kept: { en: { step: 3, code: "en2" } } });
  assert.deepEqual(stepState(back, "P1", "ko"), { step: 2, code: "ko draft", langMismatch: null, resume: null });
  assert.deepEqual(stepState(back, "P1", "en"), { step: 2, code: "ko draft", langMismatch: "ko", resume: { step: 3 } });
  // 또 영어로: 영어 3단계 진행이 돌아오고 한국어는 다시 kept에
  const again = restartInLang(back, "P1", "en");
  assert.deepEqual(again.projects.open.P1, { lang: "en", step: 3, code: "en2", best: 3, kept: { ko: { step: 2, code: "ko draft" } } });
});

test("restartInLang: 몇 번을 오가도 어느 언어 진행도 지워지지 않음", () => {
  let s = quietSave();
  s = pass(s, 0, "k0").save;                       // ko 1단계
  s = restartInLang(s, "P1", "en");
  s = pass(s, 0, "e0", {}, "en").save;
  s = pass(s, 1, "e1", {}, "en").save;             // en 2단계
  for (let n = 0; n < 3; n++) {
    s = restartInLang(s, "P1", "ko");
    assert.equal(s.projects.open.P1.step, 1);
    assert.equal(s.projects.open.P1.code, "k0");
    assert.deepEqual(s.projects.open.P1.kept, { en: { step: 2, code: "e1" } });
    s = restartInLang(s, "P1", "en");
    assert.equal(s.projects.open.P1.step, 2);
    assert.equal(s.projects.open.P1.code, "e1");
    assert.deepEqual(s.projects.open.P1.kept, { ko: { step: 1, code: "k0" } });
  }
});

test("restartInLang: 같은 언어로 부르면 그 언어만 처음부터(다른 언어 kept는 그대로)", () => {
  let s = quietSave();
  s = pass(s, 0, "k0").save;
  s = restartInLang(s, "P1", "en");
  s = pass(s, 0, "e0", {}, "en").save;
  s = restartInLang(s, "P1", "en");
  assert.deepEqual(s.projects.open.P1, { lang: "en", step: 0, code: "", best: 1, kept: { ko: { step: 1, code: "k0" } } });
});

test("완성 뒤에도 다른 언어 진행은 남음", () => {
  let s = quietSave();
  s = pass(s, 0, "k0").save;
  s = restartInLang(s, "P1", "en");
  for (let k = 0; k < 4; k++) s = pass(s, k, "e" + k, {}, "en").save;
  assert.ok(s.projects.done.P1);
  assert.deepEqual(s.projects.open.P1, { lang: "ko", step: 1, code: "k0", best: 4 });
  assert.deepEqual(stepState(s, "P1", "ko"), { step: 1, code: "k0", langMismatch: null, resume: null });
});

test("restartInLang: 진행이 없으면 그 언어로 새로 시작, 모르는 id는 그대로", () => {
  const s = quietSave();
  assert.deepEqual(restartInLang(s, "P1", "en").projects.open.P1, { lang: "en", step: 0, code: "", best: 0 });
  assert.deepEqual(restartInLang(s, "P9", "en").projects, s.projects);
});

test("passStep: 색인이 없으면 분명한 오류", () => {
  clearProjectIndex();
  try {
    assert.throws(() => pass(quietSave(), 0, "x"), /setProjectIndex/);
  } finally {
    setProjectIndex(INDEX);
  }
});

test("setProjectIndex: 모양이 틀리면 던짐", () => {
  assert.throws(() => setProjectIndex([]), /project index/);
  assert.throws(() => setProjectIndex([{ id: "P1", need: 3, steps: 0 }]), /project index/);
  assert.throws(() => setProjectIndex([{ id: "X1", need: 3, steps: 2 }]), /project index/);
  setProjectIndex(INDEX);
  assert.equal(projectIndex().length, 2);
});
