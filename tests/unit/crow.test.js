// v0.15.0 경비실: 크로우 그림 시험 (art/crow_sheet.svg → tools/crow_import.py → data/crow.js → src/guard/crow.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { crowSVG, CROW_POSES } from "../../src/guard/crow.js";

const POSES = ["wave", "wait", "shock", "loot", "cry", "rank"];

test("crow: 포즈 6개, 이름과 순서가 정해져 있다", () => {
  assert.deepEqual([...CROW_POSES], POSES);
});

test("crow: 포즈마다 <svg로 시작하고 role=img·이름표가 있다", () => {
  const outs = new Set();
  for (const pose of CROW_POSES) {
    const s = crowSVG({ pose });
    assert.ok(s.startsWith("<svg"), pose);
    assert.ok(s.endsWith("</svg>"), pose);
    assert.ok(s.includes('role="img"') && s.includes('aria-label="크로우"'), pose);
    assert.equal(crowSVG({ pose }), s, `${pose} 결정적`);
    outs.add(s);
  }
  assert.equal(outs.size, 6, "포즈마다 그림이 다르다");
});

test("crow: 모르는 포즈·빈 인자는 wave", () => {
  assert.equal(crowSVG({ pose: "???" }), crowSVG({ pose: "wave" }));
  assert.equal(crowSVG(), crowSVG({ pose: "wave", size: 120 }));
  assert.ok(crowSVG().includes('width="120"'));
});

test("crow: 모든 출력에 <text 없음", () => {
  for (const pose of CROW_POSES) assert.ok(!crowSVG({ pose }).includes("<text"), pose);
});

test("crow: data/crow.js는 15KB 이하", () => {
  const size = statSync(new URL("../../data/crow.js", import.meta.url)).size;
  assert.ok(size <= 15 * 1024, `${size} bytes`);
});
