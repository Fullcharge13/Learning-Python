// v0.9 작업 2: 매일 도전 「틀」 엔진 (판정 C54). 틀에 값을 바꿔 끼우고, 실행 결과로 정답·오답 보기를 정한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  instantiate, runList, judgeInstance, makeTemplateItem, placeholders,
  TEMPLATE_SEEDS, TEMPLATE_ATTEMPTS, ERROR_OPTION,
} from "../../src/template.js";

const CHOICE = {
  id: "1-T9", concept: "arith", type: "choice",
  q: "{A} 더하기 {B}는? 화면에 무엇이 출력될까요?",
  code: "print({A} + {B})",
  wrong: ["print({A} - {B})", 'print("{A}" + "{B}")'],
  vars: { A: { min: 10, max: 20 }, B: { min: 2, max: 5 } },
  explain: "{A} + {B} = {OUT}",
};
const BLANK = {
  id: "1-T8", concept: "arith", type: "blank",
  q: "{FOOD} {N}개를 {K}명이 나누고 남는 개수({OUT}개)가 나오게",
  code: "print({N} ___ {K})",
  chips: ["%", "//", "/"], answer: 0,
  vars: { FOOD: ["사탕", "귤"], N: { min: 13, max: 29 }, K: { min: 3, max: 6 } },
  explain: "나머지는 % 예요.",
};

test("상수: 씨앗 100개, 다시 만들기 5번", () => {
  assert.equal(TEMPLATE_SEEDS, 100);
  assert.equal(TEMPLATE_ATTEMPTS, 5);
});

test("instantiate: 같은 씨앗 → 같은 값, 자리 표시가 모두 채워짐", () => {
  const a = instantiate(CHOICE, 7);
  const b = instantiate(CHOICE, 7);
  assert.deepEqual(a, b);
  assert.ok(a.vals.A >= 10 && a.vals.A <= 20 && Number.isInteger(a.vals.A));
  assert.ok(a.vals.B >= 2 && a.vals.B <= 5);
  assert.equal(a.code, `print(${a.vals.A} + ${a.vals.B})`);
  assert.deepEqual(a.wrong, [`print(${a.vals.A} - ${a.vals.B})`, `print("${a.vals.A}" + "${a.vals.B}")`]);
  assert.ok(!/\{[A-Z]/.test(a.code + a.wrong.join("")));
  assert.ok(a.q.includes(String(a.vals.A)));
  // {OUT}은 실행한 뒤에 채운다
  assert.ok(a.explain.includes("{OUT}"));
});

test("instantiate: 씨앗·시도마다 값이 달라질 수 있고, 목록 값은 목록 안에서", () => {
  const seen = new Set();
  for (let s = 0; s < 100; s++) {
    const i = instantiate(BLANK, s);
    assert.ok(["사탕", "귤"].includes(i.vals.FOOD));
    seen.add(JSON.stringify(i.vals));
  }
  assert.ok(seen.size > 30);
  assert.notDeepEqual(instantiate(BLANK, 3, 0).vals, instantiate(BLANK, 3, 1).vals);
});

test("instantiate: f-문자열 중괄호는 그대로, 대문자 이름만 바꿈", () => {
  const t = { ...CHOICE, code: 'print(f"{{A} * 2}개")', wrong: ['print("{{A} * 2}개")', 'print(f"{A} * 2개")'] };
  const i = instantiate(t, 0);
  assert.equal(i.code, `print(f"{${i.vals.A} * 2}개")`);
  assert.equal(i.wrong[0], `print("{${i.vals.A} * 2}개")`);
});

test("placeholders: 글에 쓰인 대문자 자리 표시 이름", () => {
  assert.deepEqual(placeholders('print(f"{x}{A}") {OUT} {B_2}').sort(), ["A", "B_2", "OUT"]);
});

test("runList: choice는 [정답 코드, 오답 코드…], blank는 칩을 넣은 코드", () => {
  const c = instantiate(CHOICE, 1);
  assert.deepEqual(runList(c), [c.code, ...c.wrong]);
  const b = instantiate(BLANK, 1);
  assert.deepEqual(runList(b), b.chips.map((ch) => b.code.split("___").join(ch)));
});

const ok = (out) => ({ stdout: out + "\n", error: null });
const err = (type = "TypeError") => ({ stdout: "", error: { type, line: 1, msg: "x" } });

test("judgeInstance choice: 출력이 보기, 정답은 0번, {OUT} 채움", () => {
  const i = instantiate(CHOICE, 2);
  const j = judgeInstance(i, [ok("15"), ok("9"), ok("123")]);
  assert.equal(j.ok, true);
  assert.equal(j.item.type, "choice");
  assert.deepEqual(j.item.options, ["15", "9", "123"]);
  assert.equal(j.item.answer, 0);
  assert.equal(j.item.code, i.code);
  assert.equal(j.item.concept, "arith");
  assert.ok(j.item.explain.endsWith("= 15"));
});

test("judgeInstance choice: 오답 코드의 오류는 「오류가 나요」 보기", () => {
  const i = instantiate(CHOICE, 2);
  const j = judgeInstance(i, [ok("15"), err(), ok("123")]);
  assert.equal(j.ok, true);
  assert.equal(j.item.options[1], ERROR_OPTION);
});

test("judgeInstance choice: 보기가 겹치면 dup(다시 만들기), 정답이 오류면 broken", () => {
  const i = instantiate(CHOICE, 2);
  assert.deepEqual(judgeInstance(i, [ok("15"), ok("15"), ok("1")]).why, "dup");
  assert.deepEqual(judgeInstance(i, [ok("15"), err(), err("NameError")]).why, "dup");
  assert.deepEqual(judgeInstance(i, [err(), ok("1"), ok("2")]).why, "answer-error");
  assert.deepEqual(judgeInstance(i, [ok("1\n2"), ok("1"), ok("2")]).why, "multiline");
  assert.deepEqual(judgeInstance(i, [ok(""), ok("1"), ok("2")]).why, "empty");
  assert.deepEqual(judgeInstance(i, [ok("가".repeat(16)), ok("1"), ok("2")]).why, "wide");
  // 줄 끝 공백·끝 줄바꿈은 같은 출력(grade.normalize)
  assert.deepEqual(judgeInstance(i, [ok("15  "), ok("15"), ok("1")]).why, "dup");
});

test("judgeInstance blank: 정답 칩만 그 출력, 나머지는 다른 출력이나 오류", () => {
  const i = instantiate(BLANK, 4);
  const j = judgeInstance(i, [ok("2"), ok("4"), ok("4.5")]);
  assert.equal(j.ok, true);
  assert.equal(j.item.type, "blank");
  assert.deepEqual(j.item.chips, ["%", "//", "/"]);
  assert.equal(j.item.answer, 0);
  assert.ok(j.item.q.includes("(2개)"));
  assert.ok(judgeInstance(i, [ok("2"), err(), err()]).ok, "오답 칩 둘 다 오류여도 됨");
  assert.equal(judgeInstance(i, [ok("3"), ok("3"), ok("4.5")]).why, "dup");
  assert.equal(judgeInstance(i, [err(), ok("3"), ok("4.5")]).why, "answer-error");
});

test("makeTemplateItem: 실행기로 보기를 만들고, 겹치면 다음 시도로", async () => {
  const runs = [];
  // 첫 시도는 보기가 겹치게, 둘째 시도부터 정상
  const run = async (code, stdin) => {
    runs.push(code);
    if (runs.length <= 3) return ok("same");
    const m = code.match(/print\((\d+) ([-+]) (\d+)\)/);
    if (m) return ok(String(m[2] === "+" ? +m[1] + +m[3] : m[1] - m[3]));
    return ok(code.replace(/\D/g, ""));
  };
  const it = await makeTemplateItem(CHOICE, 5, run);
  assert.ok(it);
  assert.equal(runs.length, 6);
  assert.equal(it.attempt, 1);
  assert.equal(it.seed, 5);
  assert.equal(it.tpl, "1-T9");
  assert.equal(new Set(it.options).size, 3);
});

test("makeTemplateItem: 다섯 번 다 실패하면 null, 실행기 예외도 null", async () => {
  assert.equal(await makeTemplateItem(CHOICE, 0, async () => ok("same")), null);
  assert.equal(await makeTemplateItem(CHOICE, 0, async () => { throw new Error("worker"); }), null);
});

test("makeTemplateItem: stdin도 값을 바꿔 끼워 실행기에 넘김", async () => {
  const t = { ...CHOICE, stdin: "{A}\n{B}" };
  let got = null;
  await makeTemplateItem(t, 3, async (code, stdin) => { got = stdin; return ok(String(Math.random())); });
  const i = instantiate(t, 3);
  assert.equal(got, `${i.vals.A}\n${i.vals.B}`);
});
