// v0.16.1 작업 3: 새 오류 종류 7개와 같은 종류 안 원인별 변형(설계서 §2-4).
// 대표 메시지는 실제 Pyodide 3.14 문구 — tests/grader_browser.py test_error_variants_real_engine가 같은 문구를 엔진에서 다시 뽑아 맞춘다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { explain, codeNames } from "../../src/grade.js";
import { readFileSync } from "node:fs";
import { setLang, usePack } from "../../src/i18n.js";
import { ERRORS, ERROR_VARIANTS } from "../../data/errors.js";

const NEW_TYPES = {
  IndexError: "list index out of range",
  KeyError: "'a'",
  AttributeError: "'str' object has no attribute 'foo'",
  FileNotFoundError: "[Errno 44] No such file or directory: 'nope.txt'",
  ZeroDivisionError: "division by zero",
  JSONDecodeError: "Expecting property name enclosed in double quotes: line 1 column 2 (char 1)",
  RecursionError: "maximum recursion depth exceeded",
};

test("new_types: 종류마다 자기 항목(기본·탐정), 줄 번호 있음/없음", () => {
  for (const [type, msg] of Object.entries(NEW_TYPES)) {
    assert.ok(ERRORS[type], type);
    for (const f of ["title", "body", "detective"]) assert.ok(ERRORS[type][f], `${type}.${f}`);
    for (const outfit of ["basic", "explorer"]) {
      const r = explain({ type, line: 3, msg }, outfit);
      const want = outfit === "explorer" ? ERRORS[type].detective : ERRORS[type].body;
      assert.equal(r.body, want.replace(/\[\[|\]\]/g, "").replace(/\{line\}/g, "3"), `${type}/${outfit}`);
      assert.equal(r.title, ERRORS[type].title.replace("{type}", type), type);
      assert.match(r.body, /단서/, type);
      assert.match(r.body, /3번째 줄/, type);
      assert.notEqual(r.body, explain({ type: "NoSuchError", line: 3 }, outfit).body, type);
      const n = explain({ type, line: null, msg }, outfit);
      assert.doesNotMatch(n.body, /[{}]|\[\[|\]\]|undefined|null|번째 줄|어딘가이|어딘가 근처/, `${type}/none`);
    }
  }
});

test("new_types_no_answer_code: 정답 코드를 적지 않는다(코드 모양 글자 없음)", () => {
  for (const type of Object.keys(NEW_TYPES))
    for (const f of ["body", "detective"]) assert.doesNotMatch(ERRORS[type][f], /=\s*\S|\bdef \w+\(|\.get\([^)]*,/, `${type}.${f}`);
});

// 변형: [type, 대표 메시지(실제 엔진), 기대 키, 같은 종류의 기본 항목으로 남아야 하는 메시지]
const CASES = [
  ["TypeError", "A.f() takes 0 positional arguments but 1 was given", "TypeError_self"],
  ["TypeError", "A.f() takes 1 positional argument but 2 were given", "TypeError_self"],
  ["TypeError", "'<=' not supported between instances of 'list' and 'set'", "TypeError_compare"],
  ["TypeError", "'<' not supported between instances of 'int' and 'str'", "TypeError_compare"],
  ["TypeError", "argument of type 'NoneType' is not a container or iterable", "TypeError_container"],
  ["TypeError", "argument of type 'int' is not a container or iterable", "TypeError_container"],
  ["TypeError", "'NoneType' object is not iterable", "TypeError_container"],
  ["TypeError", "'int' object is not callable", "TypeError_call"],
  ["TypeError", "'str' object is not callable", "TypeError_call"],
  ["NameError", "name 're' is not defined", "NameError_import"],
  ["NameError", "name 'json' is not defined", "NameError_import"],
  ["NameError", "name 'csv' is not defined", "NameError_import"],
  ["NameError", "name 'urlparse' is not defined", "NameError_import"],
  ["NameError", "name 'parse_qs' is not defined", "NameError_import"],
  ["SyntaxError", "invalid syntax. Maybe you meant '==' or ':=' instead of '='?", "SyntaxError_eq"],
];

test("variants_table: 모양과 열쇠", () => {
  // 7개. NameError_starter는 NameError_import보다 앞(시작 코드에 있던 이름이면 import 안내보다 그쪽이 더 정확한 단서)
  assert.deepEqual(ERROR_VARIANTS.map((v) => v.key).sort(),
    ["NameError_import", "NameError_starter", "SyntaxError_eq", "TypeError_call", "TypeError_compare", "TypeError_container", "TypeError_self"]);
  const ks = ERROR_VARIANTS.map((v) => v.key);
  assert.ok(ks.indexOf("NameError_starter") < ks.indexOf("NameError_import"));
  for (const v of ERROR_VARIANTS) {
    assert.equal(typeof v.type, "string");
    assert.equal(typeof v.pattern, "string");
    assert.doesNotThrow(() => new RegExp(v.pattern), v.key);
    assert.ok(ERRORS[v.key], v.key);
    for (const f of ["title", "body", "detective"]) assert.ok(ERRORS[v.key][f], `${v.key}.${f}`);
    assert.match(ERRORS[v.key].body, /단서/, v.key);
    assert.match(ERRORS[v.key].body, /\{line\}번째 줄/, v.key);
  }
});

test("variants_pick: 대표 메시지 → 그 변형, 첫 일치", () => {
  for (const [type, msg, key] of CASES) {
    for (const outfit of ["basic", "explorer"]) {
      const r = explain({ type, line: 3, msg }, outfit);
      const e = ERRORS[key];
      const want = (outfit === "explorer" ? e.detective : e.body).replace(/\[\[|\]\]/g, "").replace(/\{line\}/g, "3");
      assert.equal(r.body, want, `${msg}/${outfit}`);
      assert.equal(r.title, e.title.replace("{type}", type), msg);
      assert.notEqual(r.body, explain({ type, line: 3, msg: "zzz" }, outfit).body, msg);
    }
  }
});

test("variants_fallback: 무늬가 안 맞거나 메시지가 없으면 기본 항목", () => {
  for (const [type, msg] of [["TypeError", "can only concatenate str (not \"int\") to str"], ["NameError", "name 'prin' is not defined"],
    ["SyntaxError", "'(' was never closed"], ["TypeError", ""], ["NameError", undefined], ["SyntaxError", null]]) {
    const r = explain({ type, line: 2, msg }, "basic");
    assert.equal(r.body, ERRORS[type].body.replace(/\[\[|\]\]/g, "").replace(/\{line\}/g, "2"), String(msg));
  }
  // 다른 종류의 메시지는 변형을 고르지 않는다
  assert.equal(explain({ type: "ValueError", line: 2, msg: "name 're' is not defined" }, "basic").body,
    ERRORS.ValueError.body.replace(/\{line\}/g, "2"));
  // 별칭: UnboundLocalError는 NameError 변형을 따른다(메시지가 달라 기본 NameError)
  assert.equal(explain({ type: "UnboundLocalError", line: 2, msg: "cannot access local variable 'x' where it is not associated with a value" }, "basic").body,
    explain({ type: "NameError", line: 2 }, "basic").body);
});

test("variants_no_line: 줄 번호 없이도 깨끗하다", () => {
  for (const [type, msg, key] of CASES) {
    for (const outfit of ["basic", "explorer"]) {
      const r = explain({ type, line: null, msg }, outfit);
      assert.doesNotMatch(r.body, /[{}]|\[\[|\]\]|undefined|null|번째 줄|어딘가이|어딘가 근처/, `${key}/${outfit}`);
      assert.match(r.body, /코드 어딘가/, key);
    }
  }
});

test("name_starter: 시작 코드에 있던 이름이면 NameError_starter", () => {
  const e = { type: "NameError", line: 4, msg: "name 'common' is not defined" };
  const r = explain(e, "basic", { starterNames: ["common", "attempt"] });
  assert.equal(r.body, ERRORS.NameError_starter.body.replace(/\[\[|\]\]/g, "").replace(/\{line\}/g, "4"));
  assert.equal(explain(e, "explorer", { starterNames: ["common"] }).body,
    ERRORS.NameError_starter.detective.replace(/\[\[|\]\]/g, "").replace(/\{line\}/g, "4"));
  // 목록이 없거나 비었거나 그 이름이 없으면 기본 NameError
  const base = explain(e, "basic").body;
  assert.equal(base, ERRORS.NameError.body.replace(/\{line\}/g, "4"));
  assert.equal(explain(e, "basic", { starterNames: [] }).body, base);
  assert.equal(explain(e, "basic", { starterNames: ["other"] }).body, base);
  assert.equal(explain(e, "basic", { seconds: 3 }).body, base);
  // 시작 코드 이름이 import 이름이어도(import re 줄을 지움) 시작 코드 안내가 먼저
  assert.equal(explain({ type: "NameError", line: 1, msg: "name 're' is not defined" }, "basic", { starterNames: ["re"] }).title,
    ERRORS.NameError_starter.title.replace("{type}", "NameError"));
  // 이름이 없는 메시지·다른 종류는 영향 없음
  assert.equal(explain({ type: "TypeError", line: 4, msg: "name 'common' is not defined" }, "basic", { starterNames: ["common"] }).body,
    ERRORS.TypeError.body.replace(/\{line\}/g, "4"));
});

test("codeNames: 시작 코드에서 이름(식별자)만 뽑는다", () => {
  const names = codeNames("import re\ncommon = [\"password\", 123456]  # secret\ndef check(attempt):\n    return {0}\nprint('hello world')");
  for (const n of ["re", "common", "check", "attempt", "print"]) assert.ok(names.includes(n), n);
  for (const n of ["password", "secret", "hello", "world", "0"]) assert.ok(!names.includes(n), n);
  assert.deepEqual(codeNames(""), []);
  assert.deepEqual(codeNames(null), []);
  assert.equal(new Set(names).size, names.length);
});

test("english: 변형·새 종류도 영어 항목으로 나온다", () => {
  const EN = JSON.parse(readFileSync(new URL("../../i18n/en/data.json", import.meta.url), "utf8"));
  const UI = JSON.parse(readFileSync(new URL("../../i18n/en/ui.lesson.json", import.meta.url), "utf8"));
  usePack("en", { ui: UI, data: EN });
  setLang("en");
  try {
    for (const [type, msg, key] of CASES) {
      const r = explain({ type, line: 3, msg }, "basic");
      assert.equal(r.body, EN[`error.${key}.body`].replace(/\[\[|\]\]/g, "").replace(/\{line\}/g, "3"), key);
      assert.doesNotMatch(r.body, /[가-힣]/);
    }
    for (const [type, msg] of Object.entries(NEW_TYPES)) {
      const r = explain({ type, line: null, msg }, "explorer");
      assert.match(r.body, /somewhere in your code/, type);
      assert.doesNotMatch(r.body, /[가-힣]|\{line\}|\[\[/, type);
    }
    assert.equal(explain({ type: "NameError", line: 2, msg: "name 'c' is not defined" }, "basic", { starterNames: ["c"] }).title,
      EN["error.NameError_starter.title"].replace("{type}", "NameError"));
  } finally { setLang("ko"); }
});
