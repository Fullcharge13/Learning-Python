// v0.5 E3 차트: 비교(채점)·글 설명·SVG 그리기
import { test } from "node:test";
import assert from "node:assert/strict";
import { chartMismatch, chartText, chartSVG, chartsHTML, cleanCharts, sameNumber } from "../../src/chart.js";
import { judge } from "../../src/grade.js";

const bar = { kind: "bar", labels: ["사과", "배"], values: [3, 5] };

test("숫자 비교: 3 == 3.0, 0.1 + 0.2 == 0.3, 3 != 3.01", () => {
  assert.equal(sameNumber(3, 3.0), true);
  assert.equal(sameNumber(0.1 + 0.2, 0.3), true);
  assert.equal(sameNumber(3, 3.01), false);
  assert.equal(sameNumber(1e30, 1e30 * (1 + 1e-12)), true);
  assert.equal(sameNumber("3", 3), false);
});

test("같은 그래프면 통과(값은 수로, 이름은 글자로 비교)", () => {
  assert.equal(chartMismatch(bar, [{ kind: "bar", labels: ["사과", "배"], values: [3.0, 5.0] }]), null);
  assert.equal(chartMismatch({ kind: "line", labels: [2024, 2025], values: [1, 2] },
    [{ kind: "line", labels: ["2024", "2025"], values: [1, 2] }]), null);
});

test("적힌 칸만 비교한다(기대에 title이 없으면 학습자 제목은 자유)", () => {
  assert.equal(chartMismatch(bar, [{ ...bar, title: "내 제목" }]), null);
  assert.equal(chartMismatch({ ...bar, title: "과일" }, [{ ...bar, title: "과일 " }]), null);
  assert.match(chartMismatch({ ...bar, title: "과일" }, [bar]), /제목이 달라요/);
  assert.match(chartMismatch({ ...bar, xlabel: "이름" }, [{ ...bar, xlabel: "과일" }]), /가로축 이름이 달라요/);
  assert.match(chartMismatch({ ...bar, ylabel: "개수" }, [bar]), /세로축 이름이 달라요/);
});

test("다른 점마다 쉬운 말", () => {
  assert.match(chartMismatch(bar, []), /그래프가 그려지지 않았어요/);
  assert.match(chartMismatch(bar, [bar, bar]), /그래프 개수가 달라요/);
  assert.match(chartMismatch(bar, [{ ...bar, kind: "line" }]), /종류가 달라요/);
  assert.match(chartMismatch(bar, [{ ...bar, labels: ["배", "사과"] }]), /이름.*달라요/);
  assert.match(chartMismatch(bar, [{ ...bar, values: [3, 6] }]), /그래프 값이 달라요/);
  assert.match(chartMismatch(bar, [{ ...bar, values: [3] }]), /그래프 값이 달라요/);
});

test("기대가 목록이면 그림 수와 차례까지 비교", () => {
  const line = { kind: "line", labels: ["a"], values: [1] };
  assert.equal(chartMismatch([bar, line], [bar, line]), null);
  assert.match(chartMismatch([bar, line], [line, bar]), /종류가 달라요/);
  assert.match(chartMismatch([bar, line], [bar]), /개수가 달라요/);
});

test("judge: 출력과 차트를 둘 다 맞혀야 통과", () => {
  const tests = [{ stdin: "", expect: "끝", public: true, chart: bar }];
  const good = { stdout: "끝\n", error: null, missing: [], charts: [bar] };
  assert.deepEqual(judge([good], tests), { pass: true, failedIndex: -1 });
  const wrongVals = { ...good, charts: [{ ...bar, values: [3, 4] }] };
  const r = judge([wrongVals], tests);
  assert.equal(r.pass, false);
  assert.equal(r.reason, "chart");
  assert.match(r.chartWhy, /그래프 값이 달라요/);
  assert.equal(judge([{ ...good, stdout: "x" }], tests).reason, "output");
  assert.equal(judge([{ ...good, charts: undefined }], tests).reason, "chart");
  // chart가 없는 시험은 그림이 있어도 출력만 본다
  assert.equal(judge([good], [{ stdin: "", expect: "끝", public: true }]).pass, true);
});

test("글 설명: 종류·제목·이름과 값", () => {
  assert.equal(chartText(bar), "막대 그래프: 사과 3, 배 5");
  assert.equal(chartText({ kind: "line", labels: ["월", "화"], values: [1.5, 0.1 + 0.2], title: "기온", xlabel: "요일", ylabel: "도" }),
    "꺾은선 그래프 「기온」(가로축 요일, 세로축 도): 월 1.5, 화 0.3");
});

test("SVG: 막대 수만큼 막대, 글자는 이스케이프, 그림은 읽기 프로그램에서 숨기고 설명은 보임", () => {
  const svg = chartSVG({ kind: "bar", labels: ["<a>", "b", "c"], values: [1, -2, 3], title: "t&t" });
  assert.equal((svg.match(/class="c-bar"/g) || []).length, 3);
  assert.match(svg, /&lt;a&gt;/);
  assert.match(svg, /t&amp;t/);
  assert.doesNotMatch(svg, /<a>/);
  assert.match(svg, /aria-hidden="true"/);
  const line = chartSVG({ kind: "line", labels: ["a", "b"], values: [1, 2] });
  assert.equal((line.match(/class="c-line"/g) || []).length, 1);
  assert.equal((line.match(/class="c-dot"/g) || []).length, 2);
  const html = chartsHTML([bar]);
  assert.match(html, /<figure class="chart"/);
  assert.match(html, /<figcaption class="chart-desc">막대 그래프: 사과 3, 배 5<\/figcaption>/);
  assert.equal(chartsHTML([]), "");
  assert.equal(chartsHTML(null), "");
  // 값이 모두 같거나 0이어도 NaN 없이 그린다
  for (const values of [[0, 0], [5, 5], [-1, -1]]) {
    assert.doesNotMatch(chartSVG({ kind: "bar", labels: ["a", "b"], values }), /NaN|Infinity/);
  }
});

test("이름이 많거나 길면 줄여서 겹치지 않게", () => {
  const labels = Array.from({ length: 24 }, (_, i) => `${i + 1}시`);
  const svg = chartSVG({ kind: "line", labels, values: labels.map((_, i) => i) });
  const shown = (svg.match(/class="c-xl"/g) || []).length;
  assert.ok(shown < 24 && shown >= 4, shown);
  const long = chartSVG({ kind: "bar", labels: ["아주아주아주아주긴이름", "b", "c", "d", "e", "f"], values: [1, 2, 3, 4, 5, 6] });
  assert.match(long, /…/);
  // 값이 모두 양수면 세로축은 0에서 시작(음수 눈금 없음)
  assert.doesNotMatch(chartSVG({ kind: "bar", labels: ["a", "b"], values: [1, 2] }), />-/);
});

test("cleanCharts: 작업자 결과를 믿지 않고 모양을 다듬는다", () => {
  assert.deepEqual(cleanCharts(undefined), []);
  assert.deepEqual(cleanCharts([{ kind: "pie", labels: [], values: [] }, bar, 3]), [bar]);
  assert.deepEqual(cleanCharts([{ ...bar, title: 5 }]), [{ ...bar, title: "5" }]);
  assert.equal(cleanCharts([bar, bar, bar, bar]).length, 3);
});
