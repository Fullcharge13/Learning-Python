// v0.14.0(판정 C81, 검토 I1·I2): 영어 사용자는 영어 장 파일을 미리 받아 둔다(오프라인). 이미 저장된 것은 다시 받지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { warmFiles } from "../../src/langwarm.js";

test("warmFiles: 저장 안 된 파일만 차례로 받고, 받은 수를 돌려준다", async () => {
  const stored = new Set(["lessons/en/ch1-aaaaaaaa.json"]);
  const got = [];
  const n = await warmFiles(["lessons/en/ch1-aaaaaaaa.json", "lessons/en/ch2-bbbbbbbb.json", "lessons/en/ch3-cccccccc.json"], {
    has: async (f) => stored.has(f),
    get: async (f) => { got.push(f); stored.add(f); return true; },
  });
  assert.deepEqual(got, ["lessons/en/ch2-bbbbbbbb.json", "lessons/en/ch3-cccccccc.json"]);
  assert.equal(n, 2);
});

test("warmFiles: 받기가 실패하면 거기서 멈춘다(오프라인·서버 오류 — 다음에 다시)", async () => {
  const got = [];
  const n = await warmFiles(["a", "b", "c"], {
    has: async () => false,
    get: async (f) => { got.push(f); return f !== "b"; },
  });
  assert.deepEqual(got, ["a", "b"]);
  assert.equal(n, 1);
});

test("warmFiles: has·get이 던져도 앱을 멈추지 않는다", async () => {
  const n = await warmFiles(["a"], { has: async () => { throw new Error("no caches"); }, get: async () => { throw new Error("x"); } });
  assert.equal(n, 0);
});
