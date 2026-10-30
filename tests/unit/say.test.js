import { test } from "node:test";
import assert from "node:assert/strict";
import { LINES, FALLBACK_LINE } from "../../data/lines.js";
import { OUTFITS } from "../../data/outfits.js";
import { say } from "../../src/say.js";

const SITUATIONS = [
  "greet", "correct", "combo", "wrong", "running", "error", "hint",
  "lesson_done", "streak_up", "streak_broken", "outfit_bought", "welcome_back",
];
const FACES = ["smile", "joy", "sparkle", "think", "surprise", "worry", "cheer", "wink"];

// 씨앗 고정 난수(mulberry32) — 시험 결과가 매번 같도록
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("no_repeat: 같은 상황 100번 → 연달아 같은 줄 0회", () => {
  for (const s of SITUATIONS) {
    const rng = seeded(7);
    let last = null;
    let repeats = 0;
    for (let i = 0; i < 100; i++) {
      const r = say(s, { name: "민지", streak: 3, xp: 20, outfit: "실험복" }, rng, last);
      if (r.index === last) repeats++;
      last = r.index;
    }
    assert.equal(repeats, 0, `${s}에서 연속 반복`);
  }
});

test("no_repeat: rng가 항상 같은 칸을 가리켜도 직전 줄은 피함", () => {
  const r = say("greet", {}, () => 0, 0);
  assert.notEqual(r.index, 0);
});

test("all_situations: 12종 모두 3줄 이상, 표정 이름이 8종 안에 있음", () => {
  assert.deepEqual(Object.keys(LINES).sort(), [...SITUATIONS].sort());
  for (const s of SITUATIONS) {
    assert.ok(LINES[s].length >= 3, `${s} 줄 수 ${LINES[s].length}`);
    for (const l of LINES[s]) {
      assert.equal(typeof l.text, "string");
      assert.ok(FACES.includes(l.face), `${s}: 모르는 표정 ${l.face}`);
    }
  }
});

test("lines: 말풍선에 들어가는 길이(60자 이하), 알려진 자리 표시만 씀", () => {
  for (const s of SITUATIONS) {
    for (const l of LINES[s]) {
      const filled = l.text.replace(/\{name\}/g, "가나다").replace(/\{\w+\}/g, "00");
      assert.ok(filled.length <= 60, `${s}: 너무 김 (${filled.length}) ${l.text}`);
      for (const m of l.text.matchAll(/\{(\w+)\}/g)) {
        assert.ok(["name", "streak", "xp", "outfit"].includes(m[1]), `${s}: 모르는 자리 표시 ${m[0]}`);
      }
    }
  }
});

test("name_blank: 이름 없음 → {name}이나 빈 호칭이 남지 않음", () => {
  let sawNameLine = false;
  for (const s of SITUATIONS) {
    LINES[s].forEach((l, i) => {
      if (l.text.includes("{name}")) sawNameLine = true;
      // 해당 줄을 정확히 고르도록 rng를 맞춤
      const rng = () => (i + 0.5) / LINES[s].length;
      for (const vars of [{}, { name: "" }, { name: "   " }]) {
        const r = say(s, { streak: 2, xp: 10, outfit: "실험복", ...vars }, rng, null);
        assert.equal(r.index, i);
        assert.ok(!/\{\w*\}/.test(r.text), `자리 표시 남음: ${r.text}`);
        assert.ok(!/(^|[\s,.!?])님[,\s!?.]/.test(r.text) && !/^님/.test(r.text), `빈 호칭 남음: ${r.text}`);
        assert.ok(!/^[\s,]/.test(r.text) && !/\s{2,}/.test(r.text), `공백 어긋남: ${r.text}`);
      }
    });
  }
  assert.ok(sawNameLine, "{name}을 쓰는 줄이 하나 이상 있어야 함");
});

test("name_form: {name}은 줄 맨 앞 「{name}님, 」 꼴로 한 번만 (빼도 조사가 남지 않게)", () => {
  for (const s of SITUATIONS) {
    for (const l of LINES[s]) {
      if (!l.text.includes("{name}")) continue;
      assert.match(l.text, /^\{name\}님, /, `${s}: ${l.text}`);
      assert.equal(l.text.split("{name}").length, 2, `${s}: {name} 두 번 이상`);
    }
  }
});

test("name_filled: 이름이 있으면 「이름님」으로 들어감", () => {
  const s = "greet";
  const i = LINES[s].findIndex((l) => l.text.includes("{name}"));
  assert.ok(i >= 0);
  const r = say(s, { name: "민지" }, () => (i + 0.5) / LINES[s].length, null);
  assert.ok(r.text.includes("민지님"), r.text);
});

test("placeholders: {streak}·{xp} 채움", () => {
  for (const [s, key, val] of [["streak_up", "streak", 12], ["lesson_done", "xp", 35]]) {
    const i = LINES[s].findIndex((l) => l.text.includes(`{${key}}`));
    assert.ok(i >= 0, `${s}에 {${key}} 줄 없음`);
    const r = say(s, { [key]: val }, () => (i + 0.5) / LINES[s].length, null);
    assert.equal(r.index, i);
    assert.ok(r.text.includes(String(val)), r.text);
  }
});

test("outfit_short: 모든 의상에 short 이름이 있음 (C16)", () => {
  assert.equal(OUTFITS.length, 9);
  for (const o of OUTFITS) {
    assert.equal(typeof o.short, "string", o.id);
    assert.ok(o.short.length > 0 && o.short.length <= 8, `${o.id}: ${o.short}`);
  }
});

test("placeholders_outfit: 실제 의상 short 이름 9개 × {outfit} 줄 전부", () => {
  const s = "outfit_bought";
  const idx = LINES[s].map((l, i) => (l.text.includes("{outfit}") ? i : -1)).filter((i) => i >= 0);
  assert.ok(idx.length >= 1);
  for (const o of OUTFITS) {
    for (const i of idx) {
      const r = say(s, { outfit: o.short }, () => (i + 0.5) / LINES[s].length, null);
      assert.equal(r.index, i);
      assert.ok(r.text.includes(o.short), r.text);
      assert.ok(!/\{\w*\}/.test(r.text), r.text);
      assert.ok(r.text.length <= 60, r.text);
    }
  }
});

test("vars_missing: vars {} → 자리 표시가 빠진 줄은 건너뜀, 남는 괄호·문장부호·「일」 시작 없음", () => {
  for (const s of SITUATIONS) {
    for (let k = 0; k < 20; k++) {
      const rng = seeded(100 + k);
      for (const vars of [{}, undefined, null]) {
        const r = say(s, vars, rng, null);
        assert.ok(!/[{}]/.test(r.text), `${s}: ${r.text}`);
        assert.ok(!/^[\s,.!?…·]/.test(r.text), `${s}: ${r.text}`);
        assert.ok(!/^일/.test(r.text), `${s}: ${r.text}`);
        assert.ok(!/(^|\s)(XP|일)[\s.!,]/.test(r.text.replace(/\d+ ?(XP|일)/g, "")), `${s}: 숫자 없는 단위 ${r.text}`);
      }
    }
  }
  // 자리 표시가 필요한 줄만 있는 경우를 흉내: xp가 없으면 {xp} 줄은 절대 안 나옴
  for (let k = 0; k < 50; k++) {
    const r = say("lesson_done", {}, seeded(k), null);
    assert.ok(!LINES.lesson_done[r.index]?.text.includes("{xp}"), r.text);
  }
});

test("one_pass: 이름 속 $&·{xp}는 그대로 글자로 들어감 (다시 바꾸지 않음)", () => {
  const s = "greet";
  const i = LINES[s].findIndex((l) => l.text.includes("{name}"));
  const r = say(s, { name: "$&{xp}", xp: 5 }, () => (i + 0.5) / LINES[s].length, null);
  assert.ok(r.text.startsWith("$&{xp}님, "), r.text);
});

test("rng_guard: NaN·음수·1 이상 → 범위 안 줄", () => {
  for (const v of [NaN, -1, -0.5, 1, 1.5, Infinity]) {
    for (const last of [null, 0, 2]) {
      const r = say("wrong", {}, () => v, last);
      assert.ok(Number.isInteger(r.index) && r.index >= 0 && r.index < LINES.wrong.length, `${v}: ${r.index}`);
      assert.notEqual(r.index, last);
      assert.equal(typeof r.text, "string");
    }
  }
});

test("banned: 고친 문구와 피할 표현이 남지 않음", () => {
  const all = Object.values(LINES).flat().map((l) => l.text).join("\n");
  for (const bad of ["오늘부터 1일", "입고", "고마워요", "힌트예요", "한 끗", "충분할 거예요", "빨간 줄", "금방 끝나요", "비워 뒀어요", "조건을 먼저", "갱신"]) {
    assert.ok(!all.includes(bad), `남은 표현: ${bad}`);
  }
});

test("streak_one: {streak}=1이어도 자연스러움 (「1일 연속」 꼴 없음)", () => {
  LINES.streak_up.forEach((l, i) => {
    const r = say("streak_up", { streak: 1 }, () => (i + 0.5) / LINES.streak_up.length, null);
    assert.ok(!/1일 연속/.test(r.text), r.text);
  });
});

test("fallback: 모르는 상황 → 오류 없이 중립 대사, 표정 smile", () => {
  const r = say("no_such_situation", { name: "민지" }, seeded(1), null);
  assert.equal(typeof r.text, "string");
  assert.ok(r.text.length > 0);
  assert.equal(r.face, FALLBACK_LINE.face);
  assert.equal(r.text, FALLBACK_LINE.text);
  assert.equal(r.index, -1);
});

test("deterministic: 같은 씨앗 → 같은 결과", () => {
  const a = say("correct", {}, seeded(42), null);
  const b = say("correct", {}, seeded(42), null);
  assert.deepEqual(a, b);
});
