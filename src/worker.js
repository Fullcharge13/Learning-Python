// Pyodide 작업자 (설계서 4-3). 화면 뒤 따로 도는 일꾼 안에서 학습자 코드를 실행한다.
//
// 모듈 작업자(new Worker(url, { type: "module" }))로 띄운다.
// - Pyodide 314는 핵심 파일이 pyodide.asm.mjs(ES 모듈) 하나뿐이라, 고전 작업자에서 pyodide.js를
//   importScripts로 불러도 결국 안에서 import()를 쓴다. 그래서 처음부터 모듈 작업자로 통일한다.
// - 모듈 작업자와 작업자 안 import()는 Chromium 80+, Safari 15+(iOS 15+)에서 된다.
//   목표 기기(iOS Safari 16+, iPhone 17)는 모두 이 범위다.
//
// 주고받는 말:
//   받음 { type: "init", indexURL, runnerSource }
//   보냄 { type: "ready", loadMs } | { type: "init-error", name, msg }
//   받음 { type: "run", id, code, stdin, require, files?, server? }
//        files: { 이름: 글자 } (가상 파일, v0.4 E1), server: { 주소: { status, body, type? } } (연습 서버, E2)
//        둘 다 JSON 글자로 바꿔 Python의 json.loads로 dict를 만든다(toPy의 객체 변환 차이를 피함).
//   보냄 { type: "started", id }  (받자마자)
//   보냄 { type: "result", id, result: { stdout, stderr, error, missing } }

let pyodide = null;
let runFn = null;
let loadsFn = null;

function errInfo(e) {
  // PythonError는 e.type에 Python 예외 이름이 들어 있다.
  const type = (e && (e.type || e.name)) || "WorkerError";
  const msg = String((e && e.message) || e);
  return { type: String(type), line: null, msg: msg.slice(0, 2000) };
}

async function init(msg) {
  const t0 = performance.now();
  try {
    const { loadPyodide } = await import(msg.indexURL + "pyodide.mjs");
    pyodide = await loadPyodide({ indexURL: msg.indexURL });
    // runner.py를 진짜 모듈(ria_runner)로 올린다. 파일 이름이 있어야 오류 원문이 깔끔하다.
    pyodide.globals.set("__ria_src", String(msg.runnerSource));
    pyodide.runPython(
      "import sys, types\n" +
      "_m = types.ModuleType('ria_runner')\n" +
      "_m.__file__ = 'ria_runner.py'\n" +
      "exec(compile(__ria_src, 'ria_runner.py', 'exec'), _m.__dict__)\n" +
      "sys.modules['ria_runner'] = _m\n" +
      "del _m, __ria_src\n");
    const mod = pyodide.pyimport("ria_runner");
    // mod.run은 mod에 "빌린" 대리 객체라 mod를 해제하면 같이 사라진다 → copy()로 따로 잡아 둔다.
    runFn = mod.run.copy();
    mod.destroy();
    loadsFn = pyodide.runPython("import json\njson.loads");
    // 한 번 돌려 두면 첫 실행이 빠르다(ast·traceback 등 첫 사용 비용).
    const warm = runFn("pass", "", pyodide.toPy([]));
    warm.destroy();
    self.postMessage({ type: "ready", loadMs: performance.now() - t0 });
  } catch (e) {
    const info = errInfo(e);
    self.postMessage({ type: "init-error", name: info.type, msg: info.msg });
  }
}

function run(msg) {
  // 받자마자 알린다. 화면 쪽은 이 확인이 없으면 작업자가 죽은 것으로 본다(시간 초과와 구별).
  self.postMessage({ type: "started", id: msg.id });
  let result;
  if (!runFn) {
    result = { stdout: "", stderr: "", error: { type: "NotReady", line: null, msg: "Python is not loaded" }, missing: [] };
  } else {
    let stdinPy = null;
    let reqPy = null;
    let out = null;
    // 없는 칸은 undefined로 넘긴다(Python None). JS null은 Pyodide에서 None이 아닌 jsnull이 된다.
    let filesPy;
    let serverPy;
    try {
      stdinPy = Array.isArray(msg.stdin) ? pyodide.toPy(msg.stdin) : String(msg.stdin == null ? "" : msg.stdin);
      reqPy = pyodide.toPy(Array.isArray(msg.require) ? msg.require : []);
      if (msg.files && typeof msg.files === "object") filesPy = loadsFn(JSON.stringify(msg.files));
      if (msg.server && typeof msg.server === "object") serverPy = loadsFn(JSON.stringify(msg.server));
      out = runFn(String(msg.code == null ? "" : msg.code), stdinPy, reqPy, filesPy, serverPy);
      result = out.toJs({ dict_converter: Object.fromEntries });
    } catch (e) {
      // runner.py 자체가 예외를 낸 경우(정상이라면 없음). 매달리지 않고 오류로 돌려준다.
      result = { stdout: "", stderr: "", error: errInfo(e), missing: [] };
    } finally {
      for (const p of [out, reqPy, stdinPy, filesPy, serverPy]) {
        if (p && typeof p.destroy === "function") {
          try { p.destroy(); } catch (_) { /* 이미 해제됨 */ }
        }
      }
    }
  }
  self.postMessage({ type: "result", id: msg.id, result });
}

self.onmessage = (ev) => {
  const msg = ev.data || {};
  if (msg.type === "init") init(msg);
  else if (msg.type === "run") run(msg);
};
