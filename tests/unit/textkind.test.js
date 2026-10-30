import { test } from "node:test";
import assert from "node:assert/strict";
import { isCodey } from "../../src/textkind.js";

test("codey_multiline: 줄바꿈이 있는 보기(여러 줄 출력)는 코드 글꼴", () => {
  assert.equal(isCodey("3\n2\n1"), true);
  assert.equal(isCodey("안녕\n반가워"), true);
});

test("codey_code: 코드 기호가 있으면 코드 글꼴, 보통 문장은 아님", () => {
  assert.equal(isCodey('print("hi")'), true);
  assert.equal(isCodey("a = 3"), true);
  assert.equal(isCodey("버스가 와요"), false);
  assert.equal(isCodey("3줄"), false);
  assert.equal(isCodey(""), false);
  assert.equal(isCodey(undefined), false);
});
