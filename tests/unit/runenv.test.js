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
