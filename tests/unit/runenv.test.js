// v0.4 작업 1: write 문제의 실행 환경(가상 파일·연습 서버) 고르기와 파일 보기
import { test } from "node:test";
import assert from "node:assert/strict";
import { runEnv } from "../../src/ui/write.js";
import { filesNote } from "../../src/ui/dom.js";

test("시험의 files가 문제의 files보다 앞선다, server는 문제 것", () => {
  const server = { "https://ria.example/a": { status: 200, body: "x" } };
  const item = { files: { "m.txt": "문제" }, server };
  assert.deepEqual(runEnv(item, { stdin: "" }), { files: { "m.txt": "문제" }, server });
  assert.deepEqual(runEnv(item, { files: { "m.txt": "시험" } }), { files: { "m.txt": "시험" }, server });
  assert.deepEqual(runEnv({}, { stdin: "" }), { files: null, server: null });
});

test("파일 보기는 이름과 내용을 이스케이프해 보여 준다", () => {
  assert.equal(filesNote(undefined), "");
  const h = filesNote({ "a<b>.txt": "1 < 2" });
  assert.match(h, /a&lt;b&gt;\.txt/);
  assert.match(h, /1 &lt; 2/);
});

// v0.5 E3·판정 C38: 그래프 보기와 카드 예제
import { chartNote, cardExample } from "../../src/ui/dom.js";

test("chartNote: 그림이 있으면 이름표 + 그림 + 글 설명, 없으면 빈 글", () => {
  assert.equal(chartNote(undefined), "");
  assert.equal(chartNote([]), "");
  const h = chartNote({ kind: "bar", labels: ["a"], values: [1] }, "기대 그래프");
  assert.match(h, /기대 그래프/);
  assert.match(h, /<svg class="chart-svg"/);
  assert.match(h, /막대 그래프: a 1/);
});

test("카드 예제: 보통 카드는 실행 결과와 그래프, show_only 카드는 코드와 「실행 안 함」만", () => {
  const normal = cardExample({ say: "s", code: "print(1)", out: "1", chart: { kind: "line", labels: ["x"], values: [2] } });
  assert.match(normal, /실행 결과/);
  assert.match(normal, /꺾은선 그래프: x 2/);
  const only = cardExample({ say: "s", code: "import matplotlib.pyplot as plt\nplt.show()", show_only: true });
  assert.match(only, /실제 컴퓨터용 코드\(여기서는 실행 안 함\)/);
  assert.match(only, /matplotlib/);
  assert.doesNotMatch(only, /실행 결과|class="out"/);
  assert.equal(cardExample({ say: "s" }), "");
});
