// v0.17.0 작업 3: 오류 안내(data/errors.js)는 따로 받는 묶음. 자료가 없을 때의 간단 카드와 ensureErrorData.
// 이 파일은 일부러 useErrorData를 먼저 부르지 않는다(시험 파일마다 따로 도는 프로세스라 상태가 새로 시작).
import { test } from "node:test";
import assert from "node:assert/strict";
import { explain, hasErrorData, ensureErrorData, useErrorData } from "../../src/grade.js";
import { setLang, usePack } from "../../src/i18n.js";
import { readFileSync } from "node:fs";

test("자료가 없으면 간단 카드: 종류 + 줄 번호", () => {
  assert.equal(hasErrorData(), false);
  const r = explain({ type: "TypeError", line: 3, msg: "can only concatenate str (not \"int\") to str" }, "basic");
  assert.equal(r.title, "TypeError 오류");
  assert.equal(r.body, "3번째 줄 근처를 살펴보세요");
  assert.equal(r.line, 3);
});

test("자료가 없고 줄 번호가 없으면 「코드를 살펴보세요」", () => {
  for (const e of [{ type: "TypeError", line: null }, { type: "TypeError" }, { type: "TypeError", line: 0 }]) {
    const r = explain(e, "explorer");
    assert.equal(r.title, "TypeError 오류");
    assert.equal(r.body, "코드를 살펴보세요");
    assert.equal(r.line, null);
  }
});

test("자료가 없어도 던지지 않는다(null·빈 오류·의상 이름 무엇이든)", () => {
  assert.doesNotThrow(() => explain(null, undefined));
  assert.doesNotThrow(() => explain({}, "explorer"));
  assert.equal(explain({}, "basic").title, "오류", "종류를 모르면 「오류」");
});

test("영어판도 같은 두 줄", () => {
  const en = JSON.parse(readFileSync(new URL("../../i18n/en/ui.lesson.json", import.meta.url), "utf8"));
  const data = JSON.parse(readFileSync(new URL("../../i18n/en/data.json", import.meta.url), "utf8"));
  usePack("en", { ui: en, data });
  setLang("en");
  try {
    const a = explain({ type: "NameError", line: 5 }, "basic");
    assert.equal(a.title, "NameError error");
    assert.equal(a.body, "Take a look near line 5");
    const b = explain({ type: "NameError" }, "basic");
    assert.equal(b.body, "Take a look at your code");
    assert.doesNotMatch(a.title + a.body + b.body, /[가-힣]/);
  } finally { setLang("ko"); }
});

test("묶음을 못 받아도 ensureErrorData는 던지지 않고 끝난다(간단 카드로 남음)", async () => {
  globalThis.RIA_CHUNKS = { errors: "js/errors-zzzzzzzz.js" };   // location이 없는 node → 받기 실패
  try {
    await assert.doesNotReject(ensureErrorData());
    assert.equal(hasErrorData(), false);
    assert.equal(explain({ type: "TypeError", line: 2 }, "basic").title, "TypeError 오류");
  } finally { delete globalThis.RIA_CHUNKS; }
});

test("ensureErrorData: 개발판(이름표 없음)은 data/errors.js를 받아 쓴다 → 정식 카드", async () => {
  await ensureErrorData();
  assert.equal(hasErrorData(), true);
  const r = explain({ type: "TypeError", line: 3, msg: "x" }, "basic");
  assert.notEqual(r.title, "TypeError 오류");
  await ensureErrorData();   // 두 번째는 바로 끝
});

test("useErrorData(모듈)로 직접 넣어도 된다", async () => {
  useErrorData(await import("../../data/errors.js"));
  assert.equal(hasErrorData(), true);
});
