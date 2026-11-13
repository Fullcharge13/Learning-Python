// v0.17.0 작업 2: 따로 받는 묶음(편집기·오류 안내). 같은 이름은 한 번만 받고, 실패하면 다시 받을 수 있고,
// 실패 까닭을 「옛 판(stale, 404 등)」과 「연결 없음(offline)」으로 나눈다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createChunkLoader, ChunkMissingError } from "../../src/chunks.js";

const CHUNKS = { editor: "js/editor-0123abcd.js" };
const BASE = "https://example.test/app/index.html";

function fake({ importer, probe, devChunk } = {}) {
  const calls = [];
  const loader = createChunkLoader({
    chunks: () => CHUNKS,
    base: () => BASE,
    importer: importer || (async (url) => { calls.push(url); return { url }; }),
    probe: probe || (async () => ({ ok: true, status: 200 })),
    devChunk: devChunk || (async (name) => { calls.push("dev:" + name); return { dev: name }; }),
  });
  return { loader, calls };
}

test("loadChunk: 이름표에 있으면 그 주소(페이지 기준 절대 주소)를 받는다", async () => {
  const { loader, calls } = fake();
  const m = await loader.loadChunk("editor");
  assert.equal(m.url, "https://example.test/app/js/editor-0123abcd.js");
  assert.deepEqual(calls, ["https://example.test/app/js/editor-0123abcd.js"]);
});

test("loadChunk: 두 번 불러도 한 번만 받고 같은 약속을 돌려준다", async () => {
  const { loader, calls } = fake();
  const a = loader.loadChunk("editor");
  const b = loader.loadChunk("editor");
  assert.equal(a, b);
  await a;
  await loader.loadChunk("editor");
  assert.equal(calls.length, 1);
});

test("loadChunk: 이름표에 없는 묶음(개발판·아직 안 나눈 묶음)은 devChunk로", async () => {
  const { loader, calls } = fake();
  const m = await loader.loadChunk("errors");
  assert.deepEqual(m, { dev: "errors" });
  assert.deepEqual(calls, ["dev:errors"]);
});

test("loadChunk: 실패하면 약속을 지워 다음에 다시 받는다(다시 받을 때는 브라우저 모듈 기억을 피해 주소를 바꿈)", async () => {
  let n = 0;
  const urls = [];
  const { loader } = fake({
    importer: async (url) => { urls.push(url); n += 1; if (n === 1) throw new TypeError("Failed to fetch dynamically imported module"); return { ok: n }; },
    probe: async () => { throw new TypeError("Failed to fetch"); },
  });
  await assert.rejects(loader.loadChunk("editor"));
  const m = await loader.loadChunk("editor");
  assert.deepEqual(m, { ok: 2 });
  assert.equal(urls.length, 2);
  assert.equal(urls[0], "https://example.test/app/js/editor-0123abcd.js");
  assert.notEqual(urls[1], urls[0]);
  assert.ok(urls[1].startsWith(urls[0] + "?"), urls[1]);
});

test("loadChunk: 404면 kind=stale(ChunkMissingError), 연결이 없으면 kind=offline", async () => {
  const fail = async () => { throw new TypeError("Failed to fetch dynamically imported module"); };
  const stale = fake({ importer: fail, probe: async () => ({ ok: false, status: 404 }) }).loader;
  const e1 = await stale.loadChunk("editor").catch((e) => e);
  assert.ok(e1 instanceof ChunkMissingError);
  assert.equal(e1.kind, "stale");
  const off = fake({ importer: fail, probe: async () => { throw new TypeError("Failed to fetch"); } }).loader;
  const e2 = await off.loadChunk("editor").catch((e) => e);
  assert.equal(e2.kind, "offline");
  assert.ok(!(e2 instanceof ChunkMissingError));
  // 파일은 받아지는데 모듈 실행이 실패(이상한 경우): 연결 문제로 보고 다시 시도
  const odd = fake({ importer: fail, probe: async () => ({ ok: true, status: 200 }) }).loader;
  assert.equal((await odd.loadChunk("editor").catch((e) => e)).kind, "offline");
});

test("loadChunk: devChunk 실패도 kind가 붙는다(offline)", async () => {
  const { loader } = fake({ devChunk: async () => { throw new Error("x"); } });
  const e = await loader.loadChunk("errors").catch((x) => x);
  assert.equal(e.kind, "offline");
});

test("prefetchChunks: 쉬는 틈에 두 묶음을 받고, 실패해도 던지지 않는다", async () => {
  const { loader, calls } = fake({ devChunk: async () => { throw new Error("no"); } });
  let idle = null;
  loader.prefetchChunks({ idle: (fn) => { idle = fn; } });
  assert.equal(calls.length, 0, "쉬는 틈 전에는 받지 않음");
  await idle();
  assert.deepEqual(calls, ["https://example.test/app/js/editor-0123abcd.js"]);
});

test("편집기 모듈은 앱의 i18n.js를 묶지 않는다(언어 상태 한 벌, 라벨은 부르는 쪽이 넘김)", () => {
  const src = readFileSync(new URL("../../src/ui/editor.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /from\s+["'][^"']*i18n\.js["']/);
});

test("chunkdev: 개발판 import 길", () => {
  const src = readFileSync(new URL("../../src/chunkdev.js", import.meta.url), "utf8");
  assert.match(src, /import\("\.\/ui\/editor\.js"\)/);
  assert.match(src, /import\("\.\.\/data\/errors\.js"\)/);
});
