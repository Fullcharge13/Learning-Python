import { test } from "node:test";
import assert from "node:assert/strict";
import { keyboardOpen, nextBaseHeight, SYMBOL_ORDER } from "../../src/kbd.js";

test("kbd_ios: 레이아웃 높이 그대로, 보이는 높이만 줄면(아이폰 사파리) 키보드", () => {
  assert.equal(keyboardOpen({ focused: true, vvHeight: 345, innerHeight: 681, baseHeight: 681 }), true);
});

test("kbd_resize: 창 전체가 줄어도(안드로이드·시험 흉내) 기준 높이보다 150 넘게 작으면 키보드", () => {
  assert.equal(keyboardOpen({ focused: true, vvHeight: 345, innerHeight: 345, baseHeight: 681 }), true);
});

test("kbd_needs_focus_and_150: 초점 없음·차이 150 이하는 아님", () => {
  assert.equal(keyboardOpen({ focused: false, vvHeight: 345, innerHeight: 681, baseHeight: 681 }), false);
  assert.equal(keyboardOpen({ focused: true, vvHeight: 600, innerHeight: 681, baseHeight: 681 }), false);
  assert.equal(keyboardOpen({ focused: true, vvHeight: 531, innerHeight: 681, baseHeight: 681 }), false);
  assert.equal(keyboardOpen({ focused: true, vvHeight: 530, innerHeight: 681, baseHeight: 681 }), true);
});

test("kbd_base: 기준 높이는 같은 폭에서 가장 큰 값, 폭이 바뀌면(회전) 새로", () => {
  assert.equal(nextBaseHeight({ base: 681, width: 402 }, 345, 402).base, 681);
  assert.equal(nextBaseHeight({ base: 600, width: 402 }, 681, 402).base, 681);
  assert.deepEqual(nextBaseHeight({ base: 681, width: 402 }, 300, 874), { base: 300, width: 874 });
});

test("symbol_order: 자주 쓰는 순서 (C30)", () => {
  assert.deepEqual(SYMBOL_ORDER.map((s) => s.label), [":", "(", ")", '" "', "=", "+", "들여쓰기", "내어쓰기", "<", ">"]);
});
