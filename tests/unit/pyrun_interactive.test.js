// v0.21.0 주고받기·정해 둔 무작위: pyrun이 옵션을 작업자에 넘기고 need_input을 결과에 싣는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanResult, PyRun } from "../../src/pyrun.js";

const base = { stdout: "", stderr: "", error: null, missing: [], charts: [] };

test("cleanResult: need_input이 있으면 { prompt }로 싣는다", () => {
  const r = cleanResult({ ...base, need_input: { prompt: "이름: " } });
  assert.deepEqual(r.need_input, { prompt: "이름: " });
  assert.equal(r.error, null);
});

test("cleanResult: need_input이 없으면 열쇠 자체가 없다", () => {
  assert.equal("need_input" in cleanResult(base), false);
  assert.equal("need_input" in cleanResult({ ...base, need_input: null }), false);
  assert.equal("need_input" in cleanResult({ ...base, need_input: "x" }), false);
});

test("cleanResult: prompt가 null이면 빈 글자, 숫자면 글자로", () => {
  assert.deepEqual(cleanResult({ ...base, need_input: { prompt: null } }).need_input, { prompt: "" });
  assert.deepEqual(cleanResult({ ...base, need_input: {} }).need_input, { prompt: "" });
  assert.deepEqual(cleanResult({ ...base, need_input: { prompt: 5 } }).need_input, { prompt: "5" });
});

// 가짜 작업자: init에 ready, run에 started·result(받은 메시지를 결과 stdout에 JSON으로 돌려줌)
class FakeWorker {
  constructor() { FakeWorker.last = this; this.sent = []; }
  postMessage(m) {
    this.sent.push(m);
    queueMicrotask(() => {
      if (m.type === "init") this.onmessage({ data: { type: "ready", loadMs: 1, sealed: true } });
      else if (m.type === "run") {
        this.onmessage({ data: { type: "started", id: m.id } });
        this.onmessage({ data: { type: "result", id: m.id, result: { ...base, stdout: "ok" } } });
      }
    });
  }
  terminate() {}
}

async function posted(opts) {
  const prev = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  try {
    const py = new PyRun({ indexURL: "/x/", runnerSource: "pass" });
    await py.run("print(1)", "", [], opts);
    return FakeWorker.last.sent.find((m) => m.type === "run");
  } finally {
    globalThis.Worker = prev;
  }
}

test("run: interactive·rand·seed를 작업자에 보낸다", async () => {
  const m = await posted({ interactive: true, rand: [3, "바위"], seed: 7 });
  assert.equal(m.interactive, true);
  assert.deepEqual(m.rand, [3, "바위"]);
  assert.equal(m.seed, 7);
});

test("run: 옵션이 없으면 false·null·null", async () => {
  const m = await posted({});
  assert.equal(m.interactive, false);
  assert.equal(m.rand, null);
  assert.equal(m.seed, null);
});

test("run: 정수가 아닌 seed·배열이 아닌 rand는 null, interactive는 true일 때만", async () => {
  for (const seed of [1.5, "7", NaN, undefined]) assert.equal((await posted({ seed })).seed, null, String(seed));
  for (const rand of ["3", 3, { 0: 1 }, undefined]) assert.equal((await posted({ rand })).rand, null, String(rand));
  assert.equal((await posted({ interactive: "yes" })).interactive, false);
  assert.deepEqual((await posted({ rand: [1, null, true] })).rand, [1, "null", "true"]);
});
