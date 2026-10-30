import { test } from "node:test";
import assert from "node:assert/strict";
import { ERRORS } from "../../data/errors.js";

// 판정 C26: 오류 설명은 문자열을 「문자열」로 부른다. 「한 글자」(철자 한 자)는 그대로 허용.
test("errors_term_string: 「글자」 대신 「문자열」", () => {
  for (const [k, v] of Object.entries(ERRORS)) {
    for (const field of ["title", "body", "detective"]) {
      const text = String(v[field] || "").replace(/한 글자/g, "");
      assert.doesNotMatch(text, /글자/, `${k}.${field}`);
    }
  }
  assert.match(ERRORS.TypeError.body, /문자열/);
});

test("errors_particle: 「문자열(print(안녕)처럼)가」 같은 조사 오류 없음", () => {
  for (const [k, v] of Object.entries(ERRORS)) {
    for (const field of ["body", "detective"]) {
      const text = String(v[field] || "");
      assert.doesNotMatch(text, /문자열(\([^)]*\)[^)]*\))?가/, `${k}.${field}`);
    }
  }
});
