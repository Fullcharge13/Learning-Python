// v0.20.0 작업 6: 응용 사건의 사건 파일 카드(src/ui/guardfile.js). 화면(DOM) 없이 만든 HTML 글자를 본다.
// 카드 글은 데이터에서 오므로 모두 esc(v0.19.2 출력 점검, tests/unit/output_escape.test.js 방식).
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileCardHTML } from "../../src/ui/guardfile.js";
import { setLang, usePack } from "../../src/i18n.js";
import { INCIDENTS } from "../../data/guard.js";

afterEach(() => { setLang("ko"); usePack("en", null); });

const G46 = INCIDENTS.find((i) => i.id === "G46");
const inc = (file) => ({ id: "GX", need: 3, tier: "field", file });
const count = (s, sub) => s.split(sub).length - 1;

test("fileCardHTML: 데이터 글을 esc", () => {
  const html = fileCardHTML(inc({
    attack: 'MFA "피로" 공격<b>x</b>',
    alias: '"><svg onload=alert(1)>',
    real: "<img src=x onerror=alert(1)>",
    todo: "</textarea><b>x</b>",
    search: ["<img src=x>", '" onmouseover="alert(1)'],
  }));
  assert.ok(!html.includes("<img"), "raw <img");
  assert.ok(html.includes("&lt;img"), "escaped <img");
  assert.ok(!html.includes("<svg onload"), "raw <svg onload");
  assert.ok(!html.includes("<b>x</b>"), "raw <b>");
  assert.ok(!html.includes("</textarea>"), "raw </textarea>");
  assert.ok(!html.includes('onmouseover="alert'), "raw attribute break");
  assert.ok(html.includes("&quot;피로&quot;"), "attack quote escaped");
});

test("fileCardHTML: 영어에서 attack==alias면 한 번", () => {
  usePack("en", { ui: {}, data: { "guard.G46.file.attack": "MFA fatigue" } });
  setLang("en");
  const en = fileCardHTML(G46);
  assert.equal(count(en, "MFA fatigue"), 1, en);
  setLang("ko");
  const ko = fileCardHTML(G46);
  assert.equal(count(ko, G46.file.attack), 2, "한국어: 공격 이름 + 검색어 꼬리표(같은 말)");   // 검색어 0번이 공격 이름과 같음
  assert.ok(ko.includes("MFA fatigue"), "한국어면 원어 줄도");
  assert.ok(ko.includes("MFA 피로 공격"));
});

test("fileCardHTML: file 없으면 빈 글", () => {
  assert.equal(fileCardHTML({ id: "G1", need: 3 }), "");
  assert.equal(fileCardHTML(null), "");
});

test("fileCardHTML: 검색어 수만큼 꼬리표, a 태그 없음", () => {
  for (const n of [1, 2, 3]) {
    const html = fileCardHTML(inc({ attack: "가", alias: "a", real: "r", todo: "t", search: ["s1", "s2", "s3"].slice(0, n) }));
    assert.equal(count(html, 'class="gd-file-kw"'), n, html);
    assert.doesNotMatch(html, /<a[\s>]/);
  }
  const html = fileCardHTML(G46);
  assert.match(html, /class="gd-file"/);
  for (const s of ["사건 파일", "현실에서는", "나를 지키려면", "더 찾아볼 말", G46.file.real, G46.file.todo]) assert.ok(html.includes(s), s);
});

test("fileCardHTML: 영어 열쇠 글(real·todo·search)", () => {
  usePack("en", {
    ui: { "사건 파일": "Case file", "현실에서는": "In real life", "나를 지키려면": "To protect yourself", "더 찾아볼 말": "Search terms" },
    data: { "guard.G46.file.attack": "MFA fatigue", "guard.G46.file.real": "REAL-EN", "guard.G46.file.todo": "TODO-EN",
      "guard.G46.file.search.0": "S0-EN", "guard.G46.file.search.1": "S1-EN" },
  });
  setLang("en");
  const html = fileCardHTML(G46);
  for (const s of ["Case file", "In real life", "To protect yourself", "Search terms", "REAL-EN", "TODO-EN", "S0-EN", "S1-EN"]) assert.ok(html.includes(s), s);
  assert.doesNotMatch(html, /[가-힣]/);
});
