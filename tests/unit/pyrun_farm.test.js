// v0.12 검토(C71): pyrun cleanFarm — 농장일지는 끝 2000「글자」(코드 포인트, 파이썬·state.js와 같은 셈)로 자른다
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFarm, FARM_JOURNAL, FARM_JOURNAL_MAX } from "../../src/pyrun.js";

const base = { events: [], state: {}, stopped: null, actions: 0 };

test("cleanFarm: 일지 자르기는 코드 포인트로(이모지 반쪽이 남지 않음)", () => {
  const emoji = "😀".repeat(FARM_JOURNAL_MAX);
  const out = cleanFarm({ ...base, files: { [FARM_JOURNAL]: emoji } }).files[FARM_JOURNAL];
  assert.equal(out, emoji, "2000글자(UTF-16 4000칸)는 그대로");
  const over = cleanFarm({ ...base, files: { [FARM_JOURNAL]: "가" + emoji } }).files[FARM_JOURNAL];
  assert.equal(over, emoji);
  assert.equal([...over].length, FARM_JOURNAL_MAX);
  const plain = cleanFarm({ ...base, files: { [FARM_JOURNAL]: "x".repeat(2500) } }).files[FARM_JOURNAL];
  assert.equal(plain.length, 2000);
  assert.equal(cleanFarm({ ...base, files: { [FARM_JOURNAL]: 3 } }).files[FARM_JOURNAL], "");
  assert.equal(cleanFarm(base).files, undefined);
});
