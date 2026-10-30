import { test } from "node:test";
import assert from "node:assert/strict";
import { startFlow, current, nextCard, answer, summary, MAX_ATTEMPTS } from "../../src/lessonflow.js";

// 개념 카드 1장, 터치 문제 5개(번호 1~5), 이해도 확인 1문
function lesson() {
  const items = [1, 2, 3, 4, 5].map((n) => ({ type: "choice", id: n, concept: "print", options: ["a", "b"], answer: 0 }));
  items.push({ type: "check", id: "check", concept: "print", options: ["a", "b"], answer: 0 });
  return { id: "1-1", cards: [{ say: "c" }], items };
}

function label(cur) {
  if (cur.kind === "done") return "done";
  if (cur.kind === "card") return "card";
  if (cur.item.type === "check") return "check";
  return String(cur.item.id) + (cur.retry ? "(재)" : "");
}

// wrongs: { 문제 id: 틀릴 횟수 }
function play(wrongs = {}) {
  let s = startFlow(lesson());
  const seq = [];
  const left = { ...wrongs };
  for (let guard = 0; guard < 50; guard++) {
    const cur = current(s);
    const l = label(cur);
    if (l === "done") { seq.push(l); break; }
    if (cur.kind === "card") { s = nextCard(s); continue; }
    seq.push(l);
    const id = cur.item.id;
    const wrong = (left[id] || 0) > 0;
    if (wrong) left[id]--;
    s = answer(s, !wrong);
  }
  return { s, seq };
}

test("flow_cards_first: 처음은 카드, 넘기면 문제", () => {
  let s = startFlow(lesson());
  assert.equal(current(s).kind, "card");
  assert.equal(s.phase, "cards");
  s = nextCard(s);
  assert.equal(current(s).kind, "item");
  assert.equal(s.phase, "items");
});

test("flow_retry_order: 2번 오답 → 1,2,3,4,5,2(재),check,done", () => {
  const { s, seq } = play({ 2: 1 });
  assert.deepEqual(seq, ["1", "2", "3", "4", "5", "2(재)", "check", "done"]);
  assert.equal(s.phase, "done");
  const sum = summary(s);
  assert.equal(sum.perfect, false);
  assert.equal(sum.done, true);
});

test("flow_phase_names: 재도전 중에는 retry, 확인 문제는 check", () => {
  let s = startFlow(lesson());
  s = nextCard(s);
  const phases = [];
  const wrongOnce = { 2: 1 };
  while (current(s).kind !== "done") {
    phases.push(s.phase);
    const id = current(s).item.id;
    const w = wrongOnce[id] > 0;
    if (w) wrongOnce[id]--;
    s = answer(s, !w);
  }
  assert.deepEqual(phases, ["items", "items", "items", "items", "items", "retry", "check"]);
  assert.equal(s.phase, "done");
});

test("flow_perfect: 모두 맞히면 perfect true", () => {
  const { s, seq } = play({});
  assert.deepEqual(seq, ["1", "2", "3", "4", "5", "check", "done"]);
  const sum = summary(s);
  assert.equal(sum.perfect, true);
  assert.equal(sum.firstTry, 6);
  assert.equal(sum.total, 6);
});

test("flow_retry_again: 재도전에서 또 틀리면 한 번 더 뒤로", () => {
  const { seq } = play({ 2: 2 });
  assert.deepEqual(seq, ["1", "2", "3", "4", "5", "2(재)", "2(재)", "check", "done"]);
});

test("flow_retry_limit: 같은 문제는 최대 3번", () => {
  assert.equal(MAX_ATTEMPTS, 3);
  const { s, seq } = play({ 2: 10 });
  assert.deepEqual(seq, ["1", "2", "3", "4", "5", "2(재)", "2(재)", "check", "done"]);
  const sum = summary(s);
  assert.equal(sum.perfect, false);
  assert.equal(sum.done, true);
  assert.deepEqual(sum.gaveUp, [1]); // 문제 배열 번호
});

test("flow_check_wrong: 확인 문제를 틀리면 확인 문제를 다시", () => {
  const { s, seq } = play({ check: 1 });
  assert.deepEqual(seq, ["1", "2", "3", "4", "5", "check", "check", "done"]);
  assert.equal(summary(s).perfect, false);
});

test("flow_write_not_requeued: 직접 작성 문제는 다시 넣지 않지만 perfect는 false", () => {
  const l = lesson();
  l.items.splice(5, 0, { type: "write", id: "w", concept: "print" });
  let s = nextCard(startFlow(l));
  const seq = [];
  while (current(s).kind !== "done") {
    const it = current(s).item;
    seq.push(String(it.id));
    s = answer(s, it.id !== "w");
  }
  assert.deepEqual(seq, ["1", "2", "3", "4", "5", "w", "check"]);
  assert.equal(summary(s).perfect, false);
});

test("flow_pure: answer는 받은 상태를 바꾸지 않음", () => {
  const s0 = nextCard(startFlow(lesson()));
  const snap = JSON.stringify(s0);
  answer(s0, false);
  assert.equal(JSON.stringify(s0), snap);
});

test("flow_progress: 진행률은 0에서 1로", () => {
  let s = startFlow(lesson());
  assert.equal(summary(s).progress, 0);
  s = nextCard(s);
  while (current(s).kind !== "done") s = answer(s, true);
  assert.equal(summary(s).progress, 1);
});

test("flow_no_cards_no_check: 복습처럼 카드·확인 문제 없는 묶음", () => {
  const items = [1, 2, 3].map((n) => ({ type: "choice", id: n }));
  let s = startFlow({ id: "review", cards: [], items });
  assert.equal(current(s).kind, "item");
  s = answer(s, false);
  s = answer(s, true);
  s = answer(s, true);
  assert.equal(current(s).retry, true);
  s = answer(s, true);
  assert.equal(current(s).kind, "done");
});
