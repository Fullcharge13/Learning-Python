import { test } from "node:test";
import assert from "node:assert/strict";
import { offlineStatus, PYODIDE_REQUIRED } from "../../src/offline.js";

const BASE = "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/";
const ALL = PYODIDE_REQUIRED.map((f) => BASE + f).concat([BASE + "pyodide-lock.json"]);

test("offline_ready: 작업자가 다루고 Pyodide 저장본에 필수 파일이 모두 있음", () => {
  const r = offlineStatus({ controlled: true, cacheNames: ["ria-game-v0.1-x", "ria-pyodide-314.0.7"], urlsByCache: { "ria-pyodide-314.0.7": ALL } });
  assert.equal(r.ready, true);
  assert.deepEqual(r.missing, []);
  assert.deepEqual([...PYODIDE_REQUIRED].sort(), ["pyodide.asm.mjs", "pyodide.asm.wasm", "pyodide.mjs", "python_stdlib.zip"]);
});

test("offline_missing_wasm: wasm이 없으면 준비 안 됨", () => {
  const urls = ALL.filter((u) => !u.endsWith("pyodide.asm.wasm"));
  const r = offlineStatus({ controlled: true, cacheNames: ["ria-pyodide-314.0.7"], urlsByCache: { "ria-pyodide-314.0.7": urls } });
  assert.equal(r.ready, false);
  assert.deepEqual(r.missing, ["pyodide.asm.wasm"]);
});

test("offline_mjs_not_confused: pyodide.asm.mjs만 있으면 pyodide.mjs는 없는 것", () => {
  const urls = ALL.filter((u) => !u.endsWith("/pyodide.mjs"));
  const r = offlineStatus({ controlled: true, cacheNames: ["ria-pyodide-1"], urlsByCache: { "ria-pyodide-1": urls } });
  assert.deepEqual(r.missing, ["pyodide.mjs"]);
});

test("offline_no_controller: 서비스 작업자가 없으면 준비 안 됨", () => {
  const r = offlineStatus({ controlled: false, cacheNames: ["ria-pyodide-314.0.7"], urlsByCache: { "ria-pyodide-314.0.7": ALL } });
  assert.equal(r.ready, false);
  assert.equal(r.reason, "no-controller");
});

test("offline_no_caches: 저장본 API·Pyodide 저장본이 없으면 준비 안 됨", () => {
  assert.equal(offlineStatus({ controlled: true, cacheNames: null, urlsByCache: null }).ready, false);
  assert.equal(offlineStatus({ controlled: true, cacheNames: [], urlsByCache: {} }).ready, false);
  // 이름이 ria-pyodide-로 시작하지 않는 저장본의 파일은 세지 않음
  assert.equal(offlineStatus({ controlled: true, cacheNames: ["other"], urlsByCache: { other: ALL } }).ready, false);
});

test("offline_any_pyodide_cache: 필수 파일이 여러 ria-pyodide- 저장본에 나뉘어 있어도 모두 있으면 준비", () => {
  const r = offlineStatus({ controlled: true, cacheNames: ["ria-pyodide-a", "ria-pyodide-b"],
    urlsByCache: { "ria-pyodide-a": ALL.slice(0, 2), "ria-pyodide-b": ALL.slice(2) } });
  assert.equal(r.ready, true);
});

// v0.3 작업 1: 장 파일도 모두 저장돼야 오프라인 준비 완료
const ORIGIN = "https://x.test/app/";
const CH = ["lessons/ch1-11111111.json", "lessons/ch2-22222222.json"];

test("offline_chapters_needed: 장 파일 하나가 게임 저장본에 없으면 준비 안 됨", () => {
  const r = offlineStatus({ controlled: true, cacheNames: ["ria-pyodide-1", "ria-game-v0.3-a"], chapterFiles: CH,
    urlsByCache: { "ria-pyodide-1": ALL, "ria-game-v0.3-a": [ORIGIN + "index.html", ORIGIN + CH[0]] } });
  assert.equal(r.ready, false);
  assert.deepEqual(r.missing, [CH[1]]);
  assert.equal(r.reason, "missing-chapters");
});

test("offline_chapters_all: 장 파일 전부 + Pyodide면 준비, 다른 저장본에 있는 장 파일은 세지 않음", () => {
  const ok = offlineStatus({ controlled: true, cacheNames: ["ria-pyodide-1", "ria-game-v0.3-a"], chapterFiles: CH,
    urlsByCache: { "ria-pyodide-1": ALL, "ria-game-v0.3-a": CH.map((c) => ORIGIN + c) } });
  assert.equal(ok.ready, true);
  const other = offlineStatus({ controlled: true, cacheNames: ["ria-pyodide-1", "other"], chapterFiles: CH,
    urlsByCache: { "ria-pyodide-1": ALL, other: CH.map((c) => ORIGIN + c) } });
  assert.equal(other.ready, false);
  // 이름 끝만 같은 다른 파일(ch11-…이 ch1-…로 착각되지 않게)
  const near = offlineStatus({ controlled: true, cacheNames: ["ria-pyodide-1", "ria-game-x"], chapterFiles: [CH[0]],
    urlsByCache: { "ria-pyodide-1": ALL, "ria-game-x": [ORIGIN + "lessons/xch1-11111111.json"] } });
  assert.equal(near.ready, false);
});
