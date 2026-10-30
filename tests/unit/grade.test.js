import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, judge, explain } from "../../src/grade.js";
import { ERRORS } from "../../data/errors.js";

const ok = (stdout) => ({ stdout, stderr: "", error: null, missing: [] });

test("normalize", () => {
  assert.equal(normalize("a  \r\nb\n\n"), "a\nb");
  assert.equal(normalize(""), "");
  assert.equal(normalize(null), "");
});

test("judge_pass", () => {
  const tests = [{ stdin: "", expect: "1", public: true }, { stdin: "", expect: "2" }];
  assert.deepEqual(judge([ok("1\n"), ok("2  \n")], tests), { pass: true, failedIndex: -1 });
});

test("judge_hidden", () => {
  const tests = [{ stdin: "", expect: "1", public: true }, { stdin: "", expect: "2" }];
  const r = judge([ok("1\n"), ok("3\n")], tests);
  assert.equal(r.pass, false);
  assert.equal(r.failedIndex, 1);
  assert.equal(r.reason, "output");
  assert.equal("publicDiff" in r, false);
});

test("judge_public_diff", () => {
  const tests = [{ stdin: "", expect: "14000", public: true }, { stdin: "", expect: "2" }];
  const r = judge([ok("1400\n"), ok("2\n")], tests);
  assert.deepEqual(r, { pass: false, failedIndex: 0, reason: "output", publicDiff: { expected: "14000", actual: "1400" } });
});

test("judge_reasons", () => {
  const t = [{ expect: "1", public: true }];
  assert.equal(judge([{ stdout: "", error: { type: "NameError", line: 1, msg: "x" }, missing: [] }], t).reason, "error");
  assert.equal(judge([{ stdout: "1\n", error: null, missing: ["If"] }], t).reason, "missing");
  assert.equal(judge([{ stdout: "", error: null, missing: [], timeout: true }], t).reason, "timeout");
  // 결과가 빠지면 실패로 친다
  assert.equal(judge([], t).pass, false);
});

test("stdin", () => {
  // input 값이 모자란 실행(InputMissing)은 출력이 맞아도 오류로 실패
  const t = [{ stdin: "1", expect: "", public: true }, { stdin: "", expect: "" }];
  const r = judge([{ stdout: "", error: null, missing: [] }, { stdout: "", error: { type: "InputMissing", line: 1, msg: "" }, missing: [] }], t);
  assert.equal(r.pass, false);
  assert.equal(r.failedIndex, 1);
  assert.equal(r.reason, "error");
});

test("explain_unknown", () => {
  let r;
  assert.doesNotThrow(() => { r = explain({ type: "ZeroDivisionError", line: 2, msg: "division by zero" }, "basic"); });
  assert.match(r.body, /처음 보는 오류예요/);
  assert.equal(r.line, 2);
  assert.doesNotThrow(() => explain(null, undefined));
  assert.doesNotThrow(() => explain({}, "detective"));
});

test("explain_known_and_line", () => {
  const r = explain({ type: "NameError", line: 3, msg: "name 'prin' is not defined" }, "basic");
  assert.equal(r.line, 3);
  assert.match(r.body, /3/);
  assert.doesNotMatch(r.body, /\{line\}/);
  assert.ok(r.title.length > 0);
});

test("explain_detective", () => {
  const a = explain({ type: "TypeError", line: 1 }, "basic");
  const b = explain({ type: "TypeError", line: 1 }, "detective");
  assert.notEqual(a.body, b.body);
});

test("errors_table_complete", () => {
  for (const k of ["SyntaxError", "IndentationError", "NameError", "TypeError", "ValueError", "InputMissing", "Timeout", "OutputLimit", "_default"]) {
    assert.ok(ERRORS[k], k);
    assert.ok(ERRORS[k].title && ERRORS[k].body && ERRORS[k].detective, k);
  }
});

test("explain_no_line", () => {
  const r = explain({ type: "Timeout" }, "basic");
  assert.equal(r.line, null);
  assert.doesNotMatch(r.body, /\{line\}|undefined|null/);
});

test("explain_somewhere: 줄 번호 없음 → 「코드 어딘가」", () => {
  const r = explain({ type: "NameError" }, "basic");
  assert.match(r.body, /코드 어딘가/);
  assert.doesNotMatch(r.body, /번째 줄/);
  assert.equal(r.line, null);
});

test("explain_alias: TabError → 들여쓰기, UnboundLocalError → 이름", () => {
  const ind = explain({ type: "IndentationError", line: 2 }, "basic");
  const tab = explain({ type: "TabError", line: 2 }, "basic");
  assert.equal(tab.body, ind.body);
  assert.match(tab.title, /TabError/);
  assert.doesNotMatch(tab.title, /IndentationError/);
  const nm = explain({ type: "NameError", line: 4 }, "detective");
  const ub = explain({ type: "UnboundLocalError", line: 4 }, "detective");
  assert.equal(ub.body, nm.body);
});

test("errors_clue_word: 기본 본문마다 「단서」", () => {
  for (const [k, v] of Object.entries(ERRORS)) assert.match(v.body, /단서/, k);
});

test("errors_name_quotes: NameError는 따옴표 없는 글자를 흔한 원인으로", () => {
  assert.match(ERRORS.NameError.body, /print\(안녕\)/);
  assert.match(ERRORS.NameError.body, /따옴표/);
});

test("timeout_seconds: {seconds} 자리 표시", () => {
  assert.match(ERRORS.Timeout.body, /\{seconds\}/);
  assert.match(ERRORS.Timeout.detective, /\{seconds\}/);
  assert.match(explain({ type: "Timeout" }, "basic").body, /3초/);
  const r = explain({ type: "Timeout" }, "detective", { seconds: 5 });
  assert.match(r.body, /5초/);
  assert.doesNotMatch(r.body, /\{seconds\}/);
});

test("output_limit: OutputLimit 설명", () => {
  const a = explain({ type: "OutputLimit", line: 2 }, "basic");
  const b = explain({ type: "OutputLimit", line: 2 }, "detective");
  assert.doesNotMatch(a.body, /처음 보는/);
  assert.notEqual(a.body, b.body);
  assert.match(a.body, /2번째 줄/);
});

test("alias_title: 제목은 실제 오류 이름, 본문은 부모 것", () => {
  const ub = explain({ type: "UnboundLocalError", line: 2 }, "basic");
  assert.match(ub.title, /UnboundLocalError/);
  assert.equal(ub.body, explain({ type: "NameError", line: 2 }, "basic").body);
});

test("grammar_all: 모든 오류 × 줄 있음/없음 × 기본/탐정 → 어색한 문형·자리 표시 없음", () => {
  const types = [...Object.keys(ERRORS).filter((k) => k !== "_default"), "TabError", "UnboundLocalError", "ZeroDivisionError"];
  for (const type of types) {
    for (const line of [null, 3]) {
      for (const outfit of ["basic", "detective"]) {
        const r = explain({ type, line }, outfit);
        const where = `${type}/${line}/${outfit}`;
        for (const text of [r.title, r.body]) {
          assert.doesNotMatch(text, /어딘가이/, where);
          assert.doesNotMatch(text, /어딘가 근처/, where);
          assert.doesNotMatch(text, /코드\S* 코드 어딘가/, where);
          assert.doesNotMatch(text, /[{}]|\[\[|\]\]/, where);
          assert.doesNotMatch(text, /undefined|null|NaN/, where);
          assert.doesNotMatch(text, /  /, where);
        }
        if (line === 3 && type !== "Timeout") assert.match(r.body, /3번째 줄/, where);
        if (line === null) assert.doesNotMatch(r.body, /줄 번호부터/, where);
      }
    }
  }
});

test("default_with_line: 줄 번호가 있으면 설계서 문구 그대로", () => {
  const r = explain({ type: "ZeroDivisionError", line: 2 }, "basic");
  assert.match(r.body, /처음 보는 오류예요\. 줄 번호부터 볼까요\?/);
});

test("value_wording: 숫자 사이 빈칸이나 소수점", () => {
  assert.match(ERRORS.ValueError.body, /숫자 사이 빈칸이나 소수점\(3\.5\)/);
  assert.doesNotMatch(ERRORS.ValueError.body, /빈칸이 섞이지 않았는지/);
});
