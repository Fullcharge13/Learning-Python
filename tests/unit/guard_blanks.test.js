import { test } from "node:test";
import assert from "node:assert/strict";
import { fillBlanks, answerPicks, blankSpots } from "../../src/guard/blanks.js";

const START = "if a {0} b:\n    {1}\n";
const BLANKS = [
  { options: ["==", "!="], answer: 0 },
  { options: ["allow()", "block()"], answer: 0 },
];

test("blanks_fill: 고른 보기로 {n}을 채움", () => {
  assert.deepEqual(fillBlanks(START, BLANKS, [1, 0]), { code: "if a != b:\n    allow()\n", missing: [] });
});

test("blanks_missing: 고르지 않은 빈칸이 있으면 code는 null, missing에 번호", () => {
  assert.deepEqual(fillBlanks(START, BLANKS, [0, null]), { code: null, missing: [1] });
  assert.deepEqual(fillBlanks(START, BLANKS, []), { code: null, missing: [0, 1] });
});

test("blanks_out_of_range: 범위 밖·정수 아닌 값은 고르지 않은 것", () => {
  assert.deepEqual(fillBlanks("{0}", [{ options: ["a"], answer: 0 }], [5]), { code: null, missing: [0] });
  assert.deepEqual(fillBlanks("{0}", [{ options: ["a"], answer: 0 }], [-1]), { code: null, missing: [0] });
  assert.deepEqual(fillBlanks("{0}", [{ options: ["a"], answer: 0 }], [0.5]), { code: null, missing: [0] });
  assert.deepEqual(fillBlanks("{0}", [{ options: ["a"], answer: 0 }], [undefined]), { code: null, missing: [0] });
});

test("blanks_empty_option: 빈 문자열 보기도 고른 것으로 침", () => {
  const b = [{ options: ["", ".lower()"], answer: 0 }];
  assert.deepEqual(fillBlanks("s{0}", b, [0]), { code: "s", missing: [] });
});

test("blanks_escape: {{ }} 는 글자 중괄호", () => {
  assert.deepEqual(fillBlanks("x = {{1}}", [], []), { code: "x = {1}", missing: [] });
  assert.deepEqual(fillBlanks("d = {{'a': {0}}}", [{ options: ["1"], answer: 0 }], [0]), { code: "d = {'a': 1}", missing: [] });
});

test("blanks_answer_picks: 정답 번호 목록", () => {
  assert.deepEqual(answerPicks(BLANKS), [0, 0]);
  assert.deepEqual(answerPicks([{ options: ["a", "b"], answer: 1 }]), [1]);
});

test("blanks_spots: 빈칸 위치(줄 1부터, 열 0부터)", () => {
  assert.deepEqual(blankSpots(START), [{ n: 0, line: 1, col: 5 }, { n: 1, line: 2, col: 4 }]);
});

test("blanks_spots_escape: 이스케이프는 빈칸 아님, 같은 줄 뒤쪽 열은 원문 기준", () => {
  assert.deepEqual(blankSpots("x = {{1}}"), []);
  assert.deepEqual(blankSpots("{{a}} {0} {1}"), [{ n: 0, line: 1, col: 6 }, { n: 1, line: 1, col: 10 }]);
});
