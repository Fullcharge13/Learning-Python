// 작업 8: 리아 교수 그림 시험 (v0.12.4: #리아_이미지_세트2 — art/ria_set2_sheet.svg에서 tools/ria_set2_import.py로 만든 data/ria_set2.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import { riaSVG, OUTFIT_IDS, FACE_IDS, RIA_COLORS, RIA_SET, RIA_VIEWBOX } from "../../src/ria.js";
import { OUTFITS as OUTFIT_TABLE } from "../../data/outfits.js";

const OUTFITS = ["basic", "casual", "whitecoat", "hoodie", "gym", "chef", "explorer", "uniform", "wizard", "graduate"];
const FACES = ["smile", "joy", "sparkle", "think", "surprise", "worry", "cheer", "wink"];

test("ids: 공통 이름(ledger)과 같다", () => {
  assert.deepEqual([...OUTFIT_IDS], OUTFITS);
  assert.deepEqual([...FACE_IDS], FACES);
});

test("all_combos: 80개 조합 모두 <svg로 시작하고 같은 조합은 같은 결과", () => {
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
  assert.equal(n, 80);
});

test("all_combos: 의상과 표정이 실제로 그림을 바꾼다", () => {
  const outs = new Set(OUTFITS.map((outfit) => riaSVG({ outfit })));
  const faces = new Set(FACES.map((face) => riaSVG({ face })));
  assert.equal(outs.size, 10);
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
  assert.match(s, /viewBox="166 -6 354 460"/);
  assert.equal(RIA_VIEWBOX, "166 -6 354 460");
});

test("set2: 지금 쓰는 그림은 #리아_이미지_세트2, 칸 배경 네모 없음", () => {
  assert.equal(RIA_SET, "set2");
  for (const outfit of OUTFITS) for (const face of FACES) {
    const s = riaSVG({ outfit, face });
    assert.doesNotMatch(s, /<rect x="150" y="30" width="380" height="440"/, `${outfit}/${face}: 칸 배경`);
    assert.doesNotMatch(s, /#fffdf6/i, `${outfit}/${face}: 칸 배경색`);
  }
});

// ---- 검토 반영: 접근성·움직임 고리·size 처리 ----
import { OUTFIT_KO, FACE_KO } from "../../src/ria.js";

test("a11y: 한국어 이름표·role·title", () => {
  assert.deepEqual(Object.keys(OUTFIT_KO), OUTFITS);
  assert.deepEqual(Object.keys(FACE_KO), FACES);
  for (const o of OUTFIT_TABLE) assert.equal(OUTFIT_KO[o.id], o.short, o.id + ": 의상 표 short와 같음");
  assert.equal(FACE_KO.smile, "미소");
  const s = riaSVG({ outfit: "wizard", face: "smile" });
  assert.match(s, /role="img"/);
  assert.match(s, /aria-label="리아 교수, 미소, 마법사 망토"/);
  assert.match(s, /<title>리아 교수, 미소, 마법사 망토<\/title>/);
  assert.match(riaSVG({ outfit: "zzz", face: "zzz" }), /aria-label="리아 교수, 미소, 기본복장"/);
});

test("hooks: svg.ria > g.ria-body, 떠다니는 효과는 g.ria-fx", () => {
  for (const outfit of OUTFITS) for (const face of FACES) {
    const s = riaSVG({ outfit, face });
    assert.match(s, /^<svg [^>]*class="ria"/);
    assert.match(s, /<g class="ria-body">/);
    assert.match(s, /<title>/);
    assert.equal(s.split('class="ria-body"').length, 2);
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
      const s = riaSVG({ size, face, outfit: "wizard" });
      assert.ok(!s.includes("undefined") && !s.includes("NaN"), `${size}/${face}`);
    }
  for (const outfit of OUTFITS) for (const face of FACES) {
    const s = riaSVG({ outfit, face });
    assert.ok(!s.includes("undefined") && !s.includes("NaN"), `${outfit}/${face}`);
  }
});

// ---- v0.6 다시 그리기 ----
test("v0.6 palette: 모든 의상 × 표정이 알려진 색만 쓴다", () => {
  const known = new Set(RIA_COLORS.map((c) => c.toUpperCase()));
  for (const outfit of OUTFITS) for (const face of FACES) {
    const s = riaSVG({ outfit, face });
    for (const c of s.match(/#[0-9A-Fa-f]{3,8}\b/g) || []) assert.ok(known.has(c.toUpperCase()), `${outfit}/${face}: ${c}`);
    for (const m of s.matchAll(/(?:fill|stroke)="([^"]+)"/g)) assert.ok(m[1] === "none" || known.has(m[1].toUpperCase()), `${outfit}/${face}: ${m[1]}`);
  }
});

test("v0.6 safe svg: id·defs·text·외부 참조 없음, 숫자는 모두 유한", () => {
  for (const outfit of OUTFITS) for (const face of FACES) {
    const s = riaSVG({ outfit, face });
    assert.doesNotMatch(s, /\sid=|<defs|<text|<image|href=|url\(|<script/i, `${outfit}/${face}`);
    assert.doesNotMatch(s, /python/i, `${outfit}/${face}: 상표 글자 없음`);
    for (const m of s.matchAll(/="([^"]*)"/g)) assert.doesNotMatch(m[1], /NaN|undefined|Infinity/, `${outfit}/${face}`);
    const nums = s.match(/-?\d+(\.\d+)?/g).map(Number);
    assert.ok(nums.every(Number.isFinite));
  }
});

test("v0.6 python logo guard: 파이썬 로고의 파랑·노랑 짝(#3776AB/#4B8BBE + #FFD43B/#FFE873)을 함께 쓰지 않음", () => {
  for (const outfit of OUTFITS) {
    const s = riaSVG({ outfit }).toUpperCase();
    assert.ok(!(/#3776AB|#4B8BBE|#306998/.test(s)), outfit);
  }
});

test("set2 companions: 기본·마법사 그림에만 뱀 친구(초록)가 있다", () => {
  const SNAKE = "#6fcf5a";
  const has = (o) => riaSVG({ outfit: o }).toLowerCase().includes(SNAKE);
  assert.ok(has("basic"));
  assert.ok(has("wizard"));
  for (const o of OUTFITS.filter((x) => x !== "basic" && x !== "wizard")) assert.ok(!has(o), o);
});

test("v0.6 size budget: 한 장이 너무 크지 않다", () => {
  for (const outfit of OUTFITS) for (const face of FACES)
    assert.ok(riaSVG({ outfit, face }).length < 26000, `${outfit}/${face}: ${riaSVG({ outfit, face }).length}`);
});
