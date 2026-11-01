import { test } from "node:test";
import assert from "node:assert/strict";
import { shuffleChoices, shuffleOrder, requireKo, missingMessage } from "../../src/shuffle.js";

test("shuffle_all_perms: 씨앗을 바꾸면 3개 보기의 6가지 순서가 모두 나옴", () => {
  const opts = ["a", "b", "c"];
  const seen = new Set();
  for (let seed = 0; seed < 300; seed++) seen.add(shuffleChoices(opts, 0, seed).options.join(""));
  assert.equal(seen.size, 6);
});

test("shuffle_remap: 바꾼 정답 번호는 같은 글자를 가리킴", () => {
  const opts = ["정답", "오답1", "오답2", "오답3"];
  for (let seed = 0; seed < 200; seed++) {
    for (let ans = 0; ans < opts.length; ans++) {
      const r = shuffleChoices(opts, ans, seed);
      assert.equal(r.options[r.answer], opts[ans]);
      assert.deepEqual([...r.options].sort(), [...opts].sort());
      assert.deepEqual(r.order.map((i) => opts[i]), r.options);
    }
  }
});

test("shuffle_stable: 같은 씨앗 → 같은 결과", () => {
  assert.deepEqual(shuffleChoices(["a", "b", "c", "d"], 2, 42), shuffleChoices(["a", "b", "c", "d"], 2, 42));
});

test("shuffle_answer_spread: 정답 0이 여러 자리로 퍼짐", () => {
  const pos = new Set();
  for (let seed = 0; seed < 100; seed++) pos.add(shuffleChoices(["x", "y", "z"], 0, seed).answer);
  assert.equal(pos.size, 3);
});

test("order_differs: 순서 문제 섞기는 저장된 순서와 다름 (C23)", () => {
  const lines = ["a", "b", "c"];
  for (let seed = 0; seed < 200; seed++) {
    const p = shuffleOrder(lines, seed);
    assert.notDeepEqual(p.map((i) => lines[i]), lines);
    assert.deepEqual([...p].sort(), [0, 1, 2]);
  }
  assert.deepEqual(shuffleOrder(["only"], 1), [0]);
});

test("require_ko: 조건 이름을 한국어로 (C26)", () => {
  assert.equal(requireKo("If"), "if 문");
  assert.equal(requireKo("BoolOp"), "and/or");
  assert.equal(requireKo("Mult"), "곱하기 *");
  assert.equal(requireKo("Add"), "더하기 +");
  assert.equal(requireKo("Call:type"), "type()");
  assert.equal(requireKo("Call:int"), "int()");
  assert.equal(requireKo("Name:x"), "변수 x");
  assert.equal(requireKo("Whatever"), "Whatever");
  assert.equal(missingMessage(["If"]), "정답은 나왔지만 이번 문제는 if 문을 써서 풀어야 해요.");
  assert.equal(missingMessage(["If", "Call:int"]), "정답은 나왔지만 이번 문제는 if 문, int()를 써서 풀어야 해요.");
});

test("requireKo: Comment·Elif·Else (판정 C44)", () => {
  assert.equal(requireKo("Comment"), "# 주석");
  assert.equal(requireKo("Elif"), "elif");
  assert.equal(requireKo("Else"), "else");
  assert.equal(missingMessage(["Comment"]), "정답은 나왔지만 이번 문제는 # 주석을 써서 풀어야 해요.");
  assert.equal(missingMessage(["Elif"]), "정답은 나왔지만 이번 문제는 elif를 써서 풀어야 해요.");
  assert.equal(missingMessage(["Else"]), "정답은 나왔지만 이번 문제는 else를 써서 풀어야 해요.");
});

test("missingMessage: SelfCall·FormatSpec·TripleStr (판정 C45)", () => {
  assert.equal(missingMessage(["SelfCall"]), "정답은 나왔지만 이번 문제는 함수 안에서 자기 자신을 다시 불러서 풀어야 해요.");
  assert.equal(missingMessage(["FormatSpec"]), "정답은 나왔지만 이번 문제는 f-문자열 안에 :로 서식(자릿수·정렬)을 넣어서 풀어야 해요.");
  assert.equal(missingMessage(["TripleStr"]), "정답은 나왔지만 이번 문제는 큰따옴표 세 개(\"\"\")로 여러 줄 문자열을 써서 풀어야 해요.");
  // 다른 조건과 섞이면: 「…을 써서」 다음에 문장형 조건을 잇는다
  assert.equal(missingMessage(["If", "SelfCall"]),
    "정답은 나왔지만 이번 문제는 if 문을 써서, 함수 안에서 자기 자신을 다시 불러서 풀어야 해요.");
  assert.equal(missingMessage(["FormatSpec", "Call:int", "TripleStr"]),
    "정답은 나왔지만 이번 문제는 int()를 써서, f-문자열 안에 :로 서식(자릿수·정렬)을 넣어서, 큰따옴표 세 개(\"\"\")로 여러 줄 문자열을 써서 풀어야 해요.");
  // 짧은 이름(다른 곳에서 쓸 때)
  assert.equal(requireKo("SelfCall"), "재귀 호출");
  assert.equal(requireKo("FormatSpec"), "f-문자열 서식");
  assert.equal(requireKo("TripleStr"), "세 따옴표 문자열");
});
