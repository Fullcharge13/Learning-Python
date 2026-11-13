import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newGuard, cleanGuard, guardOpen, incidentOpen, guardNews, markSeen, guardInput, guardConsistent,
  applyGuardRun, RANK_IDS, rankOf, rankThresholds, setGuardIndex, guardIndex, clearGuardIndex,
} from "../../src/guard/state.js";
import { INCIDENTS, GUARD_XP } from "../../data/guard.js";
import { buildGuardIndex } from "../../src/guard/catalog.js";
import { newSave } from "../../src/save.js";
import { localDate } from "../../src/today.js";

const G = (id) => INCIDENTS.find((i) => i.id === id);
// 판정 G2-C3: 앱처럼 저장을 읽기 전에 색인을 넣는다
const FULL = buildGuardIndex(INCIDENTS);
setGuardIndex(FULL);
const NOW = new Date(2026, 10, 12, 12, 0, 0);

// 입력에서 엔진 결과 모양을 만든다 (verdict는 expect를 그대로 따름 = 모두 정답)
function perfectResult(input) {
  const events = input.tries.map((t, i) => ({ i, verdict: t.expect === "block" ? "block" : "allow", ok: true }));
  return resultOf(input, events);
}
function resultOf(input, events, stopped = null) {
  const stats = { attacks_blocked: 0, attacks_total: 0, guests_allowed: 0, guests_total: 0 };
  for (const t of input.tries) stats[t.expect === "block" ? "attacks_total" : "guests_total"]++;
  for (const e of events) if (e.ok) stats[input.tries[e.i].expect === "block" ? "attacks_blocked" : "guests_allowed"]++;
  const solved = !stopped && events.length === input.tries.length && events.every((e) => e.ok);
  return { events, stats, solved, stopped };
}
function failingResult(input) {
  const events = input.tries.map((t, i) => ({ i, verdict: "none", ok: t.expect !== "block" }));
  return resultOf(input, events);
}
// 이정표·퀘스트가 끼지 않는 저장: XP가 목표 근처에도 못 가고, 오늘 퀘스트는 모두 끝난 상태
function quietSave() {
  const s = newSave();
  s.streak.lastGoalDate = localDate(NOW);
  s.streak.todayDate = localDate(NOW);
  s.streak.days = 1; s.streak.best = 1;
  s.settings.dailyGoal = 30;
  s.quests = { date: localDate(NOW), ids: [], progress: {}, done: [], chest: false };
  return s;
}

test("newGuard 모양", () => {
  assert.deepEqual(newGuard(), { v: 1, solved: {}, code: {}, blanks: {}, seen: [], attempts: {}, runs: 0 });
  assert.deepEqual(cleanGuard(undefined), newGuard());
});

test("cleanGuard: 망가진 값", () => {
  const g = cleanGuard({ solved: "yes", blanks: { G1: [99, "x", 1], G99: [0] }, seen: [1, "G99", "G2"], attempts: { G1: -3 } });
  assert.deepEqual(g.solved, {});
  assert.deepEqual(g.blanks, { G1: [null, null, 1] });
  assert.deepEqual(g.seen, ["G2"]);
  assert.deepEqual(g.attempts, { G1: 0 });
});

test("cleanGuard: solved는 firstTry·how만, 모르는 id·이상한 how는 버림", () => {
  const g = cleanGuard({ solved: { G1: { firstTry: true, how: "blank", extra: 1 }, G2: { firstTry: true, how: "x" }, G99: { firstTry: true, how: "code" } }, code: { G1: "print(1)", G99: "x", G2: 5 } });
  assert.deepEqual(g.solved, { G1: { firstTry: true, how: "blank" } });
  assert.deepEqual(g.code, { G1: "print(1)" });
});

test("guardOpen / incidentOpen", () => {
  assert.equal(guardOpen(new Set([1, 2])), false);
  assert.equal(guardOpen(new Set([3])), true);
  assert.equal(incidentOpen(G("G4"), new Set([3, 4])), false);
  assert.equal(incidentOpen(G("G1"), new Set([3])), true);
});

test("guardNews: 열린 사건 중 seen에 없는 것", () => {
  const p = new Set([1, 2, 3]);
  assert.equal(guardNews(newGuard(), p), true);
  const open = INCIDENTS.filter((i) => incidentOpen(i, p)).map((i) => i.id);
  assert.equal(guardNews({ ...newGuard(), seen: open }, p), false);
  assert.equal(guardNews(newGuard(), new Set([1, 2])), false);
  assert.equal(markSeen(newGuard(), "G1").seen.join(), "G1");
  assert.equal(markSeen(markSeen(newGuard(), "G1"), "G1").seen.length, 1);
});

test("guardInput: 영어는 value_en, 숫자는 그대로", () => {
  assert.equal(guardInput(G("G5"), "en").tries[0].value, "order 1");
  assert.equal(guardInput(G("G5"), "ko").tries[0].value, "주문 1");
  assert.equal(typeof guardInput(G("G2"), "ko").tries[0].value, "number");
  assert.equal(guardInput(G("G1"), "ko").password, "sunflower77");
  assert.equal(guardInput(G("G1"), "ko").mode, "script");
});

test("guardConsistent: en 값으로 대조", () => {
  const inp = guardInput(G("G5"), "en");
  const res = perfectResult(inp);
  assert.equal(guardConsistent(inp, res), true);
  const bad = structuredClone(res); bad.stats.attacks_blocked += 1;
  assert.equal(guardConsistent(inp, bad), false);
  const more = structuredClone(res); more.events.push({ i: more.events.length, verdict: "block", ok: true });
  assert.equal(guardConsistent(inp, more), false);
  const lie = structuredClone(failingResult(inp)); lie.solved = true;
  assert.equal(guardConsistent(inp, lie), false);
  const skip = structuredClone(res); skip.events[1].i = 5;
  assert.equal(guardConsistent(inp, skip), false);
  assert.equal(guardConsistent(inp, null), false);
});

test("applyGuardRun: 첫 해결 → XP 5, firstTry, 바이트는 earnXp·tick이 보고한 것 외에 없음", () => {
  const inp = guardInput(G("G1"), "ko");
  const save = quietSave();
  const { save: s, outcome } = applyGuardRun(save, G("G1"), perfectResult(inp), "blank", NOW);
  assert.equal(outcome.solved, true);
  assert.equal(outcome.firstSolve, true);
  assert.equal(outcome.firstTry, true);
  assert.equal(outcome.xp, GUARD_XP);
  assert.equal(outcome.xp, 5);
  assert.deepEqual(s.guard.solved.G1, { firstTry: true, how: "blank" });
  assert.equal(s.guard.attempts.G1, 1);
  assert.equal(s.guard.runs, 1);
  assert.equal(s.xp, save.xp + 5);
  assert.equal(s.bytes, save.bytes);               // 이정표·퀘스트가 없는 저장이라 바이트 그대로
  assert.equal(outcome.milestone, null);
  assert.deepEqual(outcome.finished, []);
  assert.ok(outcome.newBadges.includes("guard_first"));
});

test("applyGuardRun: 바이트는 오직 earnXp 이정표·tick 퀘스트 보상으로만 (guard 자체는 주지 않음)", () => {
  const inp = guardInput(G("G1"), "ko");
  const save = newSave(); // 퀘스트·이정표가 낄 수 있는 새 저장
  const { save: s, outcome } = applyGuardRun(save, G("G1"), perfectResult(inp), "code", NOW);
  const milestoneBytes = outcome.milestone ? outcome.milestone.bytes ?? 0 : 0;
  const questBytes = s.bytes - save.bytes - milestoneBytes;
  assert.ok(questBytes >= 0);
  // 퀘스트가 끝나지 않았다면 이정표 외 바이트가 없어야 한다
  if (outcome.finished.length === 0) assert.equal(questBytes, 0);
});

test("applyGuardRun: 같은 사건 다시 → XP 0, solved 기록 그대로", () => {
  const inp = guardInput(G("G1"), "ko");
  const a = applyGuardRun(quietSave(), G("G1"), perfectResult(inp), "blank", NOW);
  const b = applyGuardRun(a.save, G("G1"), perfectResult(inp), "code", NOW);
  assert.equal(b.outcome.solved, true);
  assert.equal(b.outcome.firstSolve, false);
  assert.equal(b.outcome.xp, 0);
  assert.equal(b.save.xp, a.save.xp);
  assert.deepEqual(b.save.guard.solved.G1, { firstTry: true, how: "blank" });
  assert.equal(b.save.guard.attempts.G1, 2);
});

test("applyGuardRun: 실패 뒤 해결 → firstTry false", () => {
  const inp = guardInput(G("G1"), "ko");
  const a = applyGuardRun(quietSave(), G("G1"), failingResult(inp), "blank", NOW);
  assert.equal(a.outcome.solved, false);
  assert.equal(a.outcome.xp, 0);
  assert.equal(a.save.guard.attempts.G1, 1);
  assert.equal(a.save.guard.runs, 1);
  const b = applyGuardRun(a.save, G("G1"), perfectResult(inp), "blank", NOW);
  assert.equal(b.outcome.firstTry, false);
  assert.equal(b.outcome.xp, 5);
  assert.deepEqual(b.save.guard.solved.G1, { firstTry: false, how: "blank" });
});

test("applyGuardRun: 대조 실패 결과 → 저장 변화 없음(attempts 포함)", () => {
  const inp = guardInput(G("G1"), "ko");
  const res = perfectResult(inp); res.stats.attacks_blocked += 1;
  const save = quietSave();
  const before = structuredClone(save);
  const out = applyGuardRun(save, G("G1"), res, "blank", NOW);
  assert.equal(out.outcome.solved, false);
  assert.equal(out.outcome.xp, 0);
  assert.deepEqual(out.save, before);
  const unknown = applyGuardRun(save, { ...G("G1"), id: "G99" }, perfectResult(inp), "blank", NOW);
  assert.deepEqual(unknown.save, before);
  assert.deepEqual(save, before); // 입력 저장을 바꾸지 않음
});

test("applyGuardRun: 에러로 멈춘 결과는 해결 아님", () => {
  const inp = guardInput(G("G1"), "ko");
  const res = perfectResult(inp); res.solved = false; res.stopped = "error"; res.events = res.events.slice(0, 2);
  const r = resultOf(inp, res.events, "error");
  assert.equal(applyGuardRun(quietSave(), G("G1"), r, "blank", NOW).outcome.solved, false);
});

test("rankOf 경계", () => {
  assert.deepEqual(RANK_IDS, ["apprentice", "keeper", "captain", "sheriff"]);
  const mk = (n) => ({ ...newGuard(), solved: Object.fromEntries(INCIDENTS.slice(0, n).map((i) => [i.id, { firstTry: true, how: "code" }])) });
  const N = INCIDENTS.length, th = rankThresholds(N);   // 사건 수에 따라 0·⌈N/3⌉·⌈2N/3⌉·N (지금 21개: 0·7·14·21)
  assert.equal(rankOf(mk(0)), "apprentice");
  assert.equal(rankOf(mk(1)), "apprentice");
  assert.equal(rankOf(mk(th.keeper - 1)), "apprentice");
  assert.equal(rankOf(mk(th.keeper)), "keeper");
  assert.equal(rankOf(mk(th.captain - 1)), "keeper");
  assert.equal(rankOf(mk(th.captain)), "captain");
  assert.equal(rankOf(mk(N - 1)), "captain");
  assert.equal(rankOf(mk(N)), "sheriff");
});

const INHERITED = ["toString", "valueOf", "constructor", "hasOwnProperty", "__proto__"];

test("cleanGuard·migrate: 상속 이름 id는 모든 칸에서 버림(예외 없음)", async () => {
  const { migrate } = await import("../../src/save.js");
  const entry = { firstTry: true, how: "code" };
  const raw = JSON.parse(JSON.stringify({ guard: { solved: {}, blanks: {}, attempts: {}, code: {}, seen: INHERITED } }));
  for (const k of INHERITED) {
    Object.defineProperty(raw.guard.solved, k, { value: entry, enumerable: true, configurable: true, writable: true });
    Object.defineProperty(raw.guard.blanks, k, { value: [1], enumerable: true, configurable: true, writable: true });
    Object.defineProperty(raw.guard.attempts, k, { value: 3, enumerable: true, configurable: true, writable: true });
    Object.defineProperty(raw.guard.code, k, { value: "x", enumerable: true, configurable: true, writable: true });
  }
  for (const g of [cleanGuard(raw.guard), migrate(raw).guard]) {
    assert.deepEqual(Object.keys(g.solved), []);
    assert.deepEqual(Object.keys(g.blanks), []);
    assert.deepEqual(Object.keys(g.attempts), []);
    assert.deepEqual(Object.keys(g.code), []);
    assert.deepEqual(g.seen, []);
    assert.equal(rankOf(g), "apprentice");
  }
  assert.doesNotThrow(() => migrate(JSON.parse('{"guard":{"blanks":{"toString":[1]}}}')));
  assert.deepEqual(cleanGuard(JSON.parse('{"solved":{"valueOf":{"firstTry":true,"how":"code"}},"seen":["toString"]}')), newGuard());
});

test("applyGuardRun·markSeen: 상속 이름 id는 저장 그대로", () => {
  const inp = guardInput(G("G1"), "ko");
  const save = quietSave();
  const before = structuredClone(save);
  for (const k of INHERITED) {
    assert.deepEqual(applyGuardRun(save, { ...G("G1"), id: k }, perfectResult(inp), "code", NOW).save, before);
    assert.deepEqual(markSeen(newGuard(), k).seen, []);
  }
});

// ---- v0.16.0 작업 2: 색인 ----

test("rankThresholds: 사건 수 N에서 0·⌈N/3⌉·⌈2N/3⌉·N", () => {
  assert.deepEqual(rankThresholds(12), { apprentice: 0, keeper: 4, captain: 8, sheriff: 12 });
  assert.deepEqual(rankThresholds(45), { apprentice: 0, keeper: 15, captain: 30, sheriff: 45 });
  assert.deepEqual(rankThresholds(6), { apprentice: 0, keeper: 2, captain: 4, sheriff: 6 });
});

test("guardIndex: 넣은 색인 그대로(장 순서·id·보기 수)", () => {
  assert.deepEqual(guardIndex().map((e) => e.id), INCIDENTS.map((i) => i.id));
  assert.deepEqual(guardIndex().find((e) => e.id === "G1").blanks, G("G1").blanks.map((b) => b.options.length));
  assert.ok(guardIndex().every((e) => !("tries" in e) && !("solution" in e)));
});

test("cleanGuard는 색인 보기 수로 다듬고 옛 고르기를 지킴", () => {
  const g = cleanGuard({ blanks: { G1: [0, 1, 2], G3: [0, 9, 1] } });
  assert.deepEqual(g.blanks.G1, [0, 1, 2]);
  assert.deepEqual(g.blanks.G3, [0, null, 1]);
});

test("guardInput: files가 있으면 그대로 넘김", () => {
  const files = { "log.txt": "a\nb" };
  const inc = { id: "GX", mode: "script", tries: [{ value: "a", expect: "allow" }], files };
  assert.deepEqual(guardInput(inc, "ko"), { mode: "script", tries: [{ value: "a", expect: "allow" }], files });
  assert.equal("files" in guardInput(G("G2"), "ko"), false);
});

test("색인 없이 부르면 분명한 오류(모든 id를 모른다고 보고 기록을 지우지 않음, 판정 G2-C3)", () => {
  clearGuardIndex();
  try {
    const raw = { solved: { G1: { firstTry: true, how: "blank" } } };
    assert.throws(() => cleanGuard(raw), /guard index/);
    assert.throws(() => guardNews(newGuard(), new Set([3])), /guard index/);
    assert.throws(() => rankOf(raw), /guard index/);
    assert.throws(() => guardIndex(), /guard index/);
    assert.throws(() => applyGuardRun(quietSave(), G("G1"), perfectResult(guardInput(G("G1"), "ko")), "blank", NOW), /guard index/);
    assert.throws(() => markSeen(newGuard(), "G1"), /guard index/);
    assert.throws(() => setGuardIndex([]), /setGuardIndex/);
    assert.throws(() => setGuardIndex(null), /setGuardIndex/);
    assert.throws(() => setGuardIndex([{ id: "G1" }]), /setGuardIndex/);
  } finally {
    setGuardIndex(FULL);
  }
  assert.deepEqual(cleanGuard({ solved: { G1: { firstTry: true, how: "blank" } } }).solved, { G1: { firstTry: true, how: "blank" } });
});

test("색인을 바꾸면 등급·새 소식이 그 색인을 따름", () => {
  const three = ["G1", "G2", "G3"].map((id) => FULL.find((e) => e.id === id));
  setGuardIndex(three);
  try {
    assert.deepEqual(guardIndex().map((e) => e.id), ["G1", "G2", "G3"]);
    const solved = { G1: { firstTry: true, how: "blank" } };
    assert.equal(rankOf({ solved }), "keeper");   // ⌈3/3⌉ = 1
    assert.equal(guardNews({ seen: ["G1", "G2"] }, new Set([3, 4, 5])), true);   // G3
    assert.equal(guardNews({ seen: ["G1", "G2", "G3"] }, new Set([3, 4, 5])), false); // G4는 색인에 없음
    assert.deepEqual(cleanGuard({ seen: ["G1", "G4"] }).seen, ["G1"]);
  } finally {
    setGuardIndex(FULL);
  }
});

test("applyGuardRun: 둘째 인자는 받은 사건 본문(시도 목록이 있어야 결과를 대조)", () => {
  const inp = guardInput(G("G1"), "ko");
  assert.throws(() => applyGuardRun(quietSave(), "G1", perfectResult(inp), "blank", NOW), TypeError);
});
