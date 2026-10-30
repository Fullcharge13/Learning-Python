import { test } from "node:test";
import assert from "node:assert/strict";
import { localDate, daysSince } from "../../src/today.js";

test("today_pad: 한 자리 달·날은 0을 붙인다", () => {
  assert.equal(localDate(new Date(2026, 0, 5, 12, 0)), "2026-01-05");
  assert.equal(localDate(new Date(2026, 9, 29, 9, 0)), "2026-10-29");
});

test("today_local_midnight: 현지 23:59와 00:01은 다른 날", () => {
  assert.equal(localDate(new Date(2026, 9, 29, 23, 59)), "2026-10-29");
  assert.equal(localDate(new Date(2026, 9, 30, 0, 1)), "2026-10-30");
});

test("today_year_end", () => {
  assert.equal(localDate(new Date(2026, 11, 31, 23, 59, 59)), "2026-12-31");
  assert.equal(localDate(new Date(2027, 0, 1, 0, 0, 0)), "2027-01-01");
});

test("today_default_now: 인자가 없으면 지금", () => {
  assert.match(localDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test("days_since: 현지 날짜 차이, 잘못된 값은 null", () => {
  const now = new Date(2026, 9, 29, 8, 0);
  assert.equal(daysSince(new Date(2026, 9, 26, 23, 0).toISOString(), now), 3);
  assert.equal(daysSince(new Date(2026, 9, 29, 1, 0).toISOString(), now), 0);
  assert.equal(daysSince(null, now), null);
  assert.equal(daysSince("엉터리", now), null);
});
