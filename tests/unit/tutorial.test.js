import { test } from "node:test";
import assert from "node:assert/strict";
import { pyStringLiteral, tutorialCode, shouldShowTutorial } from "../../src/tutorial.js";
import { newSave } from "../../src/save.js";

test("pyStringLiteral: 기본 문구와 이스케이프", () => {
  assert.equal(pyStringLiteral("안녕하세요!"), '"안녕하세요!"');
  assert.equal(pyStringLiteral('a"b'), '"a\\"b"');
  assert.equal(pyStringLiteral("a\\b"), '"a\\\\b"');
  assert.equal(pyStringLiteral("a\nb"), '"ab"');
  assert.equal(pyStringLiteral("a\r\nb"), '"ab"');
  assert.equal(pyStringLiteral(""), '""');
});

test("pyStringLiteral: 30자(코드 포인트)로 자름", () => {
  assert.equal(pyStringLiteral("a".repeat(31)), '"' + "a".repeat(30) + '"');
  assert.equal(pyStringLiteral("가".repeat(31)), '"' + "가".repeat(30) + '"');
  const emoji = "😀".repeat(31); // UTF-16으로는 62칸
  assert.equal(pyStringLiteral(emoji), '"' + "😀".repeat(30) + '"');
});

test("pyStringLiteral: 코드 끼워 넣기는 한 문자열 안의 글자일 뿐", () => {
  assert.equal(pyStringLiteral('"); import os #'), '"\\"); import os #"');
  assert.equal(tutorialCode('"); import os #'), 'print("\\"); import os #")');
  // 줄바꿈을 빼고 자른 뒤 이스케이프: 자르기 전에 줄바꿈을 빼서 30자를 채움
  assert.equal(pyStringLiteral("\n".repeat(5) + "a".repeat(30)), '"' + "a".repeat(30) + '"');
});

test("tutorialCode", () => {
  assert.equal(tutorialCode("안녕하세요!"), 'print("안녕하세요!")');
});

test("shouldShowTutorial: 개발자 모드면 항상 false, 아니면 tutorial이 null일 때만", () => {
  const s = newSave();
  assert.equal(shouldShowTutorial(s, { dev: false }), true);
  assert.equal(shouldShowTutorial(s, { dev: true }), false);
  assert.equal(shouldShowTutorial({ ...s, tutorial: "done" }, { dev: false }), false);
  assert.equal(shouldShowTutorial({ ...s, tutorial: "skipped" }, { dev: false }), false);
  assert.equal(shouldShowTutorial({ ...s, tutorial: undefined }, { dev: false }), true);
});

test("pyStringLiteral: NUL과 짝 없는 서로게이트는 뺀다(이모지는 유지)", () => {
  assert.equal(pyStringLiteral("a\0b"), '"ab"');
  assert.equal(pyStringLiteral("a\ud800b"), '"ab"');
  assert.equal(pyStringLiteral("a\udc00b"), '"ab"');
  assert.equal(pyStringLiteral("a\ud83d"), '"a"');
  assert.equal(pyStringLiteral("😀\ud800😀"), '"😀😀"');
});

test("shouldShowTutorial: 저장이 없으면 false", () => {
  assert.equal(shouldShowTutorial(null, { dev: false }), false);
  assert.equal(shouldShowTutorial(undefined, { dev: false }), false);
});
