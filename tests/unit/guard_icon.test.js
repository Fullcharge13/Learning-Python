// v0.15.1 경비실 아이콘: 사용자가 고른 Bootstrap Icons shield-check(MIT)를 `guard`로. 옷장의 `shield`는 그대로.
import { test } from "node:test";
import assert from "node:assert/strict";
import { icon } from "../../src/ui/dom.js";

test("guard 아이콘: shield-check 두 길을 1.5배로 키워 면으로 칠함", () => {
  const s = icon("guard");
  assert.match(s, /viewBox="0 0 24 24"/);
  assert.match(s, /<g transform="scale\(1\.5\)" fill="currentColor" stroke="none">/);
  assert.match(s, /d="M5\.338 1\.59a61 61 0 0 0-2\.837\.856/);
  assert.match(s, /d="M10\.854 5\.146a\.5\.5 0 0 1 0 \.708l-3 3/);
});

test("shield 아이콘(기록 보호권)은 그대로", () => {
  assert.match(icon("shield"), /d="M12 3l7\.5 3v5\.5c0 4\.5-3\.3 8-7\.5 9\.5/);
  assert.doesNotMatch(icon("shield"), /M5\.338/);
});
