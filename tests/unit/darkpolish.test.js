// v0.19.0 작업 4: 어둡게 전용 마무리(스위치·노드 눌림)와 텃밭 그림 색 ↔ CSS 이름표 일치
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../../src/style.css", import.meta.url), "utf8");
const view = fs.readFileSync(new URL("../../src/garden/view.js", import.meta.url), "utf8");
const norm = (s) => s.replace(/\s+/g, " ");

function rootVar(name) {
  const root = css.match(/:root\s*\{([^}]*)\}/)[1];
  return root.match(new RegExp("--" + name + ":\\s*(#[0-9a-fA-F]{6})"))[1].toUpperCase();
}
function ruleBody(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp("(?:^|[},/]\\s*|\\*/\\s*)(?:[^{};]*,\\s*)?" + esc + "\\s*(?:,[^{}]*)?\\{([^}]*)\\}", "m"));
  assert.ok(m, "no rule: " + selector);
  return m[1];
}
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const darkVar = (name) => css.match(new RegExp('\\[data-theme="dark"\\] \\{[^}]*--' + name + ":\\s*(#[0-9a-fA-F]{6})"))[1].toUpperCase();
const bg = (sel) => ruleBody(sel).match(/background:\s*(#[0-9a-fA-F]{6})/)[1].toUpperCase();

test("텃밭 그림의 말풍선 색(COL.card·COL.ink)은 :root --card·--ink와 같다(밝게 픽셀 그대로)", () => {
  const col = (k) => view.match(new RegExp("\\b" + k + ': "(#[0-9a-fA-F]{6})"'))[1].toUpperCase();
  assert.equal(col("card"), rootVar("card"));
  assert.equal(col("ink"), rootVar("ink"));
});

test("어둡게 스위치: 꺼짐·켜짐 트랙이 카드·판 바탕과 3:1 이상", () => {
  const card = darkVar("card"), paper = darkVar("paper");
  const off = bg('[data-theme="dark"] .switch span');
  const on = bg('[data-theme="dark"] .switch[aria-checked="true"] span');
  for (const b of [card, paper]) {
    assert.ok(ratio(off, b) >= 3, `off ${off} vs ${b} = ${ratio(off, b).toFixed(2)}`);
    assert.ok(ratio(on, b) >= 3, `on ${on} vs ${b} = ${ratio(on, b).toFixed(2)}`);
  }
});

test("어둡게 개발자 모드 스위치 켜짐은 남색이 아닌 보이는 색(밝게 .panel.devmode 규칙을 이김)", () => {
  const sel = '[data-theme="dark"] .panel.devmode .switch[aria-checked="true"] span';
  const on = bg(sel);
  assert.ok(ratio(on, darkVar("card")) >= 3, `devmode on ${on}`);
  assert.ok(ratio(on, darkVar("card")) >= 3 && on !== darkVar("navy"));
});

test("어둡게 .node:active는 그림자 없음(밝게 규칙과 같게)", () => {
  assert.match(norm(css), /\[data-theme="dark"\] \.node:active \{ box-shadow: none;? \}/);
});
