// 작업 8: 리아 교수 그림 시험
import { test } from "node:test";
import assert from "node:assert/strict";
import { riaSVG, OUTFIT_IDS, FACE_IDS } from "../../src/ria.js";

const OUTFITS = ["basic", "lab", "detective", "chef", "painter", "gardener", "rain", "camping", "astronaut"];
const FACES = ["smile", "joy", "sparkle", "think", "surprise", "worry", "cheer", "wink"];

test("ids: 공통 이름(ledger)과 같다", () => {
  assert.deepEqual([...OUTFIT_IDS], OUTFITS);
  assert.deepEqual([...FACE_IDS], FACES);
});

test("all_combos: 72개 조합 모두 <svg로 시작하고 같은 조합은 같은 결과", () => {
  let n = 0;
  for (const outfit of OUTFITS) {
    for (const face of FACES) {
      const a = riaSVG({ outfit, face });
      assert.ok(a.startsWith("<svg"), `${outfit}/${face}`);
      assert.ok(a.trimEnd().endsWith("</svg>"), `${outfit}/${face} 닫힘`);
      assert.equal(riaSVG({ outfit, face }), a, `${outfit}/${face} 결정적`);
      n++;
    }
  }
  assert.equal(n, 72);
});

test("all_combos: 의상과 표정이 실제로 그림을 바꾼다", () => {
  const outs = new Set(OUTFITS.map((outfit) => riaSVG({ outfit })));
  const faces = new Set(FACES.map((face) => riaSVG({ face })));
  assert.equal(outs.size, 9);
  assert.equal(faces.size, 8);
});

test("unknown: 없는 의상·표정 이름 → 기본 의상·미소로 그림", () => {
  assert.equal(riaSVG({ outfit: "bikini" }), riaSVG({ outfit: "basic" }));
  assert.equal(riaSVG({ face: "nope" }), riaSVG({ face: "smile" }));
  assert.equal(riaSVG(), riaSVG({ outfit: "basic", face: "smile", size: 160 }));
  assert.equal(riaSVG({ outfit: "toString" }), riaSVG({ outfit: "basic" }));
});

test("size: 너비가 size, 높이는 비율 유지", () => {
  const s = riaSVG({ size: 200 });
  assert.match(s, /width="200"/);
  assert.match(s, /height="260"/);
  assert.match(s, /viewBox="0 0 200 260"/);
});

// ---- 검토 반영: 접근성·움직임 고리·size 처리 ----
import { OUTFIT_KO, FACE_KO } from "../../src/ria.js";

test("a11y: 한국어 이름표·role·title", () => {
  assert.deepEqual(Object.keys(OUTFIT_KO), OUTFITS);
  assert.deepEqual(Object.keys(FACE_KO), FACES);
  assert.equal(OUTFIT_KO.detective, "탐정 코트");
  assert.equal(FACE_KO.smile, "미소");
  const s = riaSVG({ outfit: "detective", face: "smile" });
  assert.match(s, /role="img"/);
  assert.match(s, /aria-label="리아 교수, 미소, 탐정 코트"/);
  assert.match(s, /<title>리아 교수, 미소, 탐정 코트<\/title>/);
  assert.match(riaSVG({ outfit: "zzz", face: "zzz" }), /aria-label="리아 교수, 미소, 기본 재킷"/);
});

test("hooks: svg.ria > g.ria-body, 떠다니는 효과는 g.ria-fx", () => {
  for (const outfit of OUTFITS) for (const face of FACES) {
    const s = riaSVG({ outfit, face });
    assert.match(s, /^<svg [^>]*class="ria"/);
    assert.match(s, /<g class="ria-body">/);
    assert.equal(s.split('class="ria-body"').length, 2);
  }
  for (const face of ["joy", "sparkle", "think", "surprise", "worry", "cheer", "wink"])
    assert.match(riaSVG({ face }), /<g class="ria-fx">.+<\/g>/, face);
  assert.match(riaSVG({ outfit: "rain" }), /<g class="ria-fx">.+<\/g>/);
  assert.doesNotMatch(riaSVG(), /ria-fx/);
});

test("layer: 효과는 모자·헬멧보다 뒤에(위에) 그린다", () => {
  // 각 모자·헬멧에만 쓰는 색이 효과 묶음보다 앞에 나와야 한다
  const hatColor = { gardener: "#F2D48A", astronaut: "#E4EAF1", chef: "#DCE2E7" };
  for (const [outfit, col] of Object.entries(hatColor)) {
    for (const face of ["surprise", "sparkle", "think"]) {
      const s = riaSVG({ outfit, face });
      const fx = s.indexOf('class="ria-fx"');
      assert.ok(fx > 0, `${outfit}/${face}: 효과 있음`);
      assert.ok(s.lastIndexOf(col) < fx, `${outfit}/${face}: 효과가 모자 위`);
    }
  }
});

test("size: null·문자열·이상한 값 처리", () => {
  assert.equal(riaSVG(null), riaSVG());
  assert.match(riaSVG({ size: "200" }), /width="200" height="260"/);
  for (const bad of [-1, NaN, null, 0, "abc", Infinity])
    assert.match(riaSVG({ size: bad }), /width="160" height="208"/, String(bad));
  assert.match(riaSVG({ size: 1e308 }), /width="2048" height="2662.4"/);
  assert.match(riaSVG({ size: 0.5 }), /width="1" height="1.3"/);
  for (const size of ["200", -1, NaN, 1e308, null, undefined, {}, "x"])
    for (const face of FACES) {
      const s = riaSVG({ size, face, outfit: "astronaut" });
      assert.ok(!s.includes("undefined") && !s.includes("NaN"), `${size}/${face}`);
    }
  for (const outfit of OUTFITS) for (const face of FACES) {
    const s = riaSVG({ outfit, face });
    assert.ok(!s.includes("undefined") && !s.includes("NaN"), `${outfit}/${face}`);
  }
});
