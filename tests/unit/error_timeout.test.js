// v0.17.0 작업 4: 오류 묶음 받기가 멈춰 있어도(안 끝나는 import) 약 8초 뒤에는 간단 카드로 넘어가고,
// 묶음은 나중에 와도 쓰인다. 시험 파일마다 따로 도는 프로세스라 grade.js 상태가 새로 시작한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureErrorData, hasErrorData, explain } from "../../src/grade.js";
import { ERRORS, ERROR_ALIASES, ERROR_VARIANTS } from "../../data/errors.js";

test("ensureErrorData: 안 끝나는 불러오기는 제한 시간 뒤 던지지 않고 끝난다(간단 카드로 남음)", async () => {
  let release;
  const load = () => new Promise((resolve) => { release = resolve; });   // 끝나지 않는 가짜 불러오기
  const t0 = Date.now();
  await assert.doesNotReject(ensureErrorData({ load, timeoutMs: 50 }));
  assert.ok(Date.now() - t0 >= 40, "제한 시간을 기다림");
  assert.equal(hasErrorData(), false);
  assert.equal(explain({ type: "TypeError", line: 2 }, "basic").title, "TypeError 오류");
  // 묶음이 뒤늦게 오면 다음 오류부터 정식 카드
  release({ ERRORS, ERROR_ALIASES, ERROR_VARIANTS });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(hasErrorData(), true);
});
