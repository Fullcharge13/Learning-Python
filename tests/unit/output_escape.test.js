// v0.19.2 작업 2 출력 보안 점검(docs/security/2026-11-14-출력-점검표.md): HTML 글자를 만드는 함수에
// 공격 글자를 넣으면 글자 그대로(escape) 나와야 한다. 화면(DOM) 없이 만든 HTML 글자를 바로 본다.
import "./_guard_index.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, riaSays, codeBlock, filesNote, stdinNote, cardExample, bar } from "../../src/ui/dom.js";
import { errorPanel } from "../../src/ui/write.js";
import { stepperHTML, argChips, condLabel } from "../../src/ui/garden.js";
import { chartsHTML } from "../../src/chart.js";
import { render as farmSVG } from "../../src/garden/view.js";
import { newGarden, runInput } from "../../src/garden/state.js";
import { riaSVG } from "../../src/ria.js";
import { crowSVG } from "../../src/guard/crow.js";
import { badgeArt } from "../../src/ui/badges.js";
import { statusBar } from "../../src/ui/nav.js";
import { migrate } from "../../src/save.js";
import { importCompare } from "../../src/importsave.js";
import { useErrorData } from "../../src/grade.js";

// 공격 글자(계획 작업 2 Step 2)
export const ATTACKS = [
  '<img src=x onerror="window.__xss=1">',
  '"><svg onload=window.__xss=1>',
  "</textarea><b>x</b>",
  '" onmouseover="window.__xss=1',
];

// 공격 글자가 escape 없이 들어갔을 때만 남는 조각. escape됐으면 < 와 " 가 &lt; &quot; 로 바뀌어 이 조각이 없다
const RAW = ["<img src=x", "<svg onload", "<b>x</b>", "</textarea>", 'onmouseover="window', 'onerror="window'];
function assertInert(html, what) {
  for (const r of RAW) assert.ok(!String(html).includes(r), `${what}: raw ${r}`);
}

test("점검 도우미: escape하지 않은 공격 글자는 잡는다", () => {
  for (const a of ATTACKS) assert.throws(() => assertInert(`<p title="${a}">${a}</p>`, "raw"));
});

test("esc: & < > \" ' 다섯 글자 모두(속성 따옴표 안에서도 안전)", () => {
  assert.equal(esc(`<a href="x" title='y'>&</a>`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(0), "0");
  for (const a of ATTACKS) assert.doesNotMatch(esc(a), /[<>"']/);
});

test("dom.js 도우미: 말풍선·코드·파일·입력값·예제 칸·진행 막대 이름표", () => {
  for (const a of ATTACKS) {
    assertInert(riaSays({ outfit: a, face: a, text: a, sfx: a }), "riaSays");
    assertInert(codeBlock(a), "codeBlock");
    assertInert(filesNote({ [a]: a }), "filesNote");
    assertInert(stdinNote(`${a}\n${a}`), "stdinNote");
    assertInert(cardExample({ code: a, out: a, stdin: a, files: { [a]: a } }), "cardExample");
    assertInert(bar(1, 2, "", a), "bar label");
    assert.ok(riaSays({ text: a }).includes(esc(a)), "말풍선 글자는 escape해서 그대로");
  }
});

test("오류 카드(errorPanel): 파이썬 오류의 종류·원문 메시지·한글 메시지", async () => {
  useErrorData(await import("../../data/errors.js"));
  for (const a of ATTACKS) {
    for (const err of [
      { type: "ValueError", line: 2, msg: a },
      { type: a, line: 1, msg: "m" },
      { type: "ValueError", line: null, msg: `한글 ${a}` },   // 한글이 있으면 err-own 칸에도 그대로 나옴
      { type: "NameError", line: 1, msg: `name '${a}' is not defined` },
    ]) {
      const html = errorPanel(err, "basic");
      assertInert(html, `errorPanel ${JSON.stringify(err)}`);
      assert.ok(html.includes(esc(err.msg)) || html.includes(esc(err.type)), "원문이 escape된 글자로 보임");
    }
    assertInert(errorPanel({ type: "ValueError", line: 1, msg: "x" }, "basic", { title: a, text: a }), "errorPanel over");
  }
});

test("그래프(chartsHTML): 학습자 코드가 정한 제목·축·이름·선 이름", () => {
  for (const a of ATTACKS) {
    const html = chartsHTML([
      { kind: "bar", labels: [a, "b"], values: [1, 2], title: a, xlabel: a, ylabel: a },
      { kind: "line", labels: [a, "b"], series: [{ name: a, values: [1, 2] }, { name: "y", values: [2, 1] }] },
    ]);
    assertInert(html, "chartsHTML");
    assert.match(html, /<svg class="chart-svg"/);
  }
});

test("텃밭 그림(view.render): 파이의 말(print)·방향 열쇠·작물 칸", () => {
  const st = runInput(newGarden());
  for (const a of ATTACKS) {
    const html = farmSVG(st, { say: a, facing: a, fx: { t: a, x: 0, y: 0, crop: a } });
    assertInert(html, "farmSVG");
  }
});

test("텃밭 숫자 고르기(stepperHTML): 저장 가져오기의 조건 숫자가 글자여도 그대로", () => {
  for (const a of ATTACKS) {
    const html = stepperHTML("g-step", a, 0, 20);
    assertInert(html, "stepperHTML");
    assert.ok(html.includes(esc(a)), "숫자 칸에 글자 그대로");
  }
});

test("텃밭 노드 값 단추 글(argChips·condLabel)은 글자로 돌려준다(그리는 쪽이 esc)", () => {
  for (const a of ATTACKS) {
    const n = { id: a, kind: "if", args: { cond: { var: a, op: a, num: a } } };
    const chips = argChips(n);
    assert.equal(chips[0].text, `${a} ${a} ${a}`);
    assert.ok(condLabel({ store: { crop: a, op: a, num: a } }).includes(a));
  }
});

test("그림 생성기(riaSVG·crowSVG·badgeArt): 모르는 id는 기본값으로", () => {
  for (const a of ATTACKS) {
    assertInert(riaSVG({ outfit: a, face: a, size: a }), "riaSVG");
    assertInert(crowSVG({ pose: a, size: a }), "crowSVG");
    assertInert(badgeArt(a, true, 64), "badgeArt");
  }
});

test("저장 가져오기: 숫자 칸이 글자여도 상태 줄·확인 창 요약은 숫자", () => {
  for (const a of ATTACKS) {
    const raw = {
      saveVer: 2, completed_lessons: [a], xp: a, bytes: a, streak: { days: a, best: a, todayXp: a, todayDate: a },
      settings: { name: a, dailyGoal: a, lang: a }, outfit: a, outfits: [a], review_queue: [a], badges: [a],
    };
    const s = migrate(raw);
    assertInert(statusBar(s), "statusBar");
    const cmp = importCompare(migrate({}), s);
    assertInert(cmp.summary, "importCompare");
    assert.equal(s.outfit, "basic");
    assert.equal(s.settings.name, a, "이름은 글자 그대로 남는다(그리는 곳이 esc)");
  }
});
