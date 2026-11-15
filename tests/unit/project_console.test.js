// v0.21.0 한 판 이어 가기: 멈췄다 다시 돌리기 (가짜 run으로 시험)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession } from "../../src/projects/console.js";

// 가짜 run: 호출 기록을 남기고, script(code, stdin, opts)가 결과를 돌려줌
function fakeRun(script) {
  const calls = [];
  const run = async (code, stdin, opts) => { calls.push({ code, stdin: [...stdin], opts }); return script(stdin, opts, calls.length); };
  run.calls = calls;
  return run;
}
const ask = (stdout, prompt) => ({ stdout, stderr: "", error: null, missing: [], charts: [], need_input: { prompt } });
const end = (stdout) => ({ stdout, stderr: "", error: null, missing: [], charts: [] });
// 가위바위보 두 판짜리 흉내
const rps = (stdin) => stdin.length === 0 ? ask("시작\n", "첫 번째: ")
  : stdin.length === 1 ? ask("시작\n첫: " + stdin[0] + "\n", "두 번째: ")
  : end("시작\n첫: " + stdin[0] + "\n둘: " + stdin[1] + "\n끝\n");

test("console: 첫 실행이 입력을 요구", async () => {
  const run = fakeRun(rps);
  const s = createSession({ code: "X", run, seed: 7 });
  const f = await s.start();
  assert.equal(f.output, "시작\n");
  assert.equal(f.appended, "시작\n");
  assert.deepEqual(f.need, { prompt: "첫 번째: " });
  assert.equal(f.done, false);
  assert.equal(f.error, null);
  assert.equal(f.limit, false);
  assert.equal(f.replaced, false);
  assert.equal(run.calls[0].code, "X");
  assert.deepEqual(run.calls[0].stdin, []);
  assert.equal(run.calls[0].opts.interactive, true);
});

test("console: 답하면 모든 답으로 다시 실행", async () => {
  const run = fakeRun(rps);
  const s = createSession({ code: "X", run, seed: 7 });
  await s.start();
  const f1 = await s.answer("가위");
  assert.deepEqual(run.calls[1].stdin, ["가위"]);
  assert.equal(f1.appended, "첫: 가위\n");
  assert.deepEqual(f1.need, { prompt: "두 번째: " });
  const f2 = await s.answer("바위");
  assert.deepEqual(run.calls[2].stdin, ["가위", "바위"]);
  assert.equal(f2.done, true);
  assert.equal(f2.need, null);
  assert.equal(f2.appended, "둘: 바위\n끝\n");
  assert.deepEqual(s.inputs, ["가위", "바위"]);
});

test("console: 답에 줄바꿈이 있어도 한 칸(배열)으로 넘김", async () => {
  const run = fakeRun(rps);
  const s = createSession({ code: "X", run });
  await s.start();
  await s.answer("a\nb");
  assert.deepEqual(run.calls[1].stdin, ["a\nb"]);
});

test("console: 같은 판은 같은 씨앗", async () => {
  const run = fakeRun(rps);
  const s = createSession({ code: "X", run, seed: 42, files: { "a.txt": "x" } });
  await s.start(); await s.answer("가위"); await s.answer("바위");
  for (const c of run.calls) { assert.equal(c.opts.seed, 42); assert.deepEqual(c.opts.files, { "a.txt": "x" }); }
  const r2 = fakeRun(rps);
  const t = createSession({ code: "X", run: r2 });
  const u = createSession({ code: "X", run: r2 });
  await t.start(); await u.start();
  assert.equal(Number.isInteger(r2.calls[0].opts.seed), true);
});

test("console: 다시 하기는 새 씨앗·입력 비움", async () => {
  const run = fakeRun(rps);
  const s = createSession({ code: "X", run, seed: 42 });
  await s.start(); await s.answer("가위");
  const f = await s.restart();
  const last = run.calls[run.calls.length - 1];
  assert.deepEqual(last.stdin, []);
  assert.notEqual(last.opts.seed, 42);
  assert.deepEqual(s.inputs, []);
  assert.equal(f.output, "시작\n");
  assert.equal(f.appended, "시작\n");
  assert.equal(f.replaced, false);
});

test("console: 앞부분이 다르면 전체를 바꿈", async () => {
  const run = fakeRun((stdin, o, n) => stdin.length === 0 ? ask("시각 10:01\n", "답: ") : end("시각 10:02\n끝\n"));
  const s = createSession({ code: "X", run });
  await s.start();
  const f = await s.answer("네");
  assert.equal(f.output, "시각 10:02\n끝\n");
  assert.equal(f.appended, "시각 10:02\n끝\n");
  assert.equal(f.replaced, true);
});

test("console: 입력 상한", async () => {
  const run = fakeRun((stdin) => ask("줄\n".repeat(stdin.length), "또: "));
  const s = createSession({ code: "X", run, maxInputs: 3 });
  await s.start();
  await s.answer("1"); await s.answer("2");
  const f3 = await s.answer("3");
  assert.equal(f3.limit, false);
  const n = run.calls.length;
  const f4 = await s.answer("4");
  assert.equal(run.calls.length, n);
  assert.equal(f4.limit, true);
  assert.equal(f4.need, null);
  assert.equal(f4.done, true);
  assert.equal(f4.appended, "");
  assert.equal(f4.output, f3.output);
  assert.deepEqual(s.inputs, ["1", "2", "3"]);
});

test("console: 기본 상한은 50", async () => {
  const run = fakeRun((stdin) => ask("", "?"));
  const s = createSession({ code: "X", run });
  await s.start();
  for (let i = 0; i < 50; i++) assert.equal((await s.answer("a")).limit, false);
  assert.equal((await s.answer("a")).limit, true);
});

test("console: 빈 답과 긴 답", async () => {
  const run = fakeRun((stdin) => ask("", "?"));
  const s = createSession({ code: "X", run });
  await s.start();
  await s.answer("");
  assert.deepEqual(run.calls[1].stdin, [""]);
  await s.answer("가".repeat(600));
  assert.equal(run.calls[2].stdin[1].length, 500);
  assert.equal(s.inputs[1], "가".repeat(500));
  await s.answer("x".repeat(500));
  assert.equal(run.calls[3].stdin[2].length, 500);
});

test("console: 오류로 끝나면 done과 error", async () => {
  const err = { type: "ZeroDivisionError", line: 2, msg: "division by zero" };
  const run = fakeRun(() => ({ stdout: "앞\n", stderr: "", error: err, missing: [], charts: [] }));
  const s = createSession({ code: "X", run });
  const f = await s.start();
  assert.equal(f.done, true);
  assert.deepEqual(f.error, err);
  assert.equal(f.need, null);
  assert.equal(f.output, "앞\n");
});

test("console: 끝난 뒤 답은 다시 돌리지 않음", async () => {
  const run = fakeRun(() => end("끝\n"));
  const s = createSession({ code: "X", run });
  await s.start();
  const f = await s.answer("x");
  assert.equal(run.calls.length, 1);
  assert.equal(f.done, true);
  assert.equal(f.appended, "");
  assert.deepEqual(s.inputs, []);
});
