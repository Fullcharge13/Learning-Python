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
//   받음 { type: "run", id, code, stdin, require, files?, server?, farm?, guard?, lang? }   (lang v0.13.5: "ko"|"en")
//        files: { 이름: 글자 } (가상 파일, v0.4 E1), server: { 주소: { status, body, type? } } (연습 서버, E2)
//        farm: { size, cells, pie:{x,y}, clock, store, upgrades, seeds? } (파이의 텃밭 상태, v0.10·v0.12)
//        셋 다 JSON 글자로 바꿔 Python의 json.loads로 dict를 만든다(toPy의 객체 변환 차이를 피함).
//   보냄 { type: "started", id }  (받자마자)
//        치명 오류(v0.16.1)면 result = { …, error: { type: "EngineCrash", line: null, msg }, fatal: true }
//   보냄 { type: "result", id, result: { stdout, stderr, error, missing, charts, farm?, guard? } }
//        charts: chart.show()로 그린 그림 목록(v0.5 E3). 그대로 toJs → 화면 쪽 cleanCharts가 다듬음.
//        farm(텃밭을 넘겼을 때만): { events:[{t,line,…}], state, stopped: null|"tired"|"waited", actions, files? }.
//        files(v0.12): farm과 files를 함께 넘긴 실행에만 { "농장일지.txt": 글자 }.
//        guard(경비실, 넘겼을 때만): 입력 { mode, tries:[{value,expect}], password? } → 결과 { events, stats, solved, stopped }.
//        farm처럼 json.dumps → JSON.parse로 옮긴다(null·정수 값 보존 — 시도 값 9가 9.0이나 문자로 바뀌지 않게).
//        toJs는 None을 undefined로 바꾸므로(빈 칸 cells[i]·stopped) farm은 json.dumps → JSON.parse로 옮겨 null을 지킨다.
//   sqlite3(v0.5): Pyodide 314.0.7은 _sqlite3가 핵심(pyodide.asm.wasm)에 들어 있고 sqlite3 모듈은
//        python_stdlib.zip에 있어 loadPackage가 필요 없다(loadPackage("sqlite3")는 "No known package"로 실패).

let pyodide = null;
let runFn = null;
let loadsFn = null;
let dumpsFn = null;

function errInfo(e) {
  // PythonError는 e.type에 Python 예외 이름이 들어 있다.
  const type = (e && (e.type || e.name)) || "WorkerError";
  const msg = String((e && e.message) || e);
  return { type: String(type), line: null, msg: msg.slice(0, 2000) };
}

// Pyodide 치명 오류(v0.16.1 §2-1): 스택 바닥(RangeError: Maximum call stack size exceeded)이 Pyodide 밖으로 나오거나
// 한 번 치명 오류가 난 뒤의 "Pyodide already fatally failed and can no longer be used." 는 이 작업자를 더 쓸 수 없다.
// 파이썬 예외(PythonError)는 학습자 코드가 낸 글이 들어 있으니 따지지 않는다(예: ValueError("fatal")).
function isFatal(e) {
  if (!e || e.name === "PythonError" || e.type) return false;
  const name = String(e.name || "");
  const msg = String(e.message || e);
  return /fatal|already fatally failed/i.test(msg) || (name === "RangeError" && /Maximum call stack/i.test(msg));
}

// v0.19.2 판정 H-C4: 학습자 코드(가져온 저장의 텃밭 코드 포함)는 `import js`로 이 작업자의 전역을 그대로 본다.
// 같은 출처라 caches·indexedDB로 서비스 작업자 저장본(편집기 묶음·언어 묶음·index.html)을 바꿔 다음에 열 때마다
// 앱 화면에서 스크립트를 돌릴 수 있었다 → 엔진을 올린 뒤, 학습자 코드가 처음 돌기 전에 이 이름들을 전역과
// 프로토타입 사슬에서 모두 지운다(WebIDL 속성은 지울 수 있음). fetch는 엔진이 쓰므로 남기고, 다른 출처 요청은
// index.html의 CSP(connect-src)가 막는다(Blob 작업자는 문서의 CSP를 물려받음). Python의 import js 막기는 우회되므로 하지 않는다.
export const SEALED_NAMES = ["caches", "indexedDB", "Worker", "SharedWorker"];
export function sealRealm(g = self) {
  const strip = (start, names) => {
    for (let o = start; o; o = Object.getPrototypeOf(o)) {
      for (const k of names) {
        if (!Object.getOwnPropertyDescriptor(o, k)) continue;
        if (!Reflect.deleteProperty(o, k)) {
          // 지울 수 없으면(이상한 엔진) 값을 undefined로 덮어 둔다
          try { Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false }); } catch (_) { /* 아래에서 확인 */ }
        }
      }
    }
  };
  strip(g, SEALED_NAMES);
  if (g.navigator) strip(g.navigator, ["serviceWorker"]);
  const left = SEALED_NAMES.filter((k) => typeof g[k] !== "undefined");
  if (g.navigator && typeof g.navigator.serviceWorker !== "undefined") left.push("navigator.serviceWorker");
  if (left.length) throw new Error("sandbox: could not remove " + left.join(", "));
}

async function init(msg) {
  const t0 = performance.now();
  try {
    const { loadPyodide } = await import(msg.indexURL + "pyodide.mjs");
    pyodide = await loadPyodide({ indexURL: msg.indexURL, packageBaseUrl: msg.indexURL });  // v0.19.2: loadPackage 기본 주소(jsDelivr)가 쓰일 길을 막음
    sealRealm();   // v0.19.2 H-C4: 학습자 코드가 돌기 전에(아래 runner 올리기·한 번 돌리기보다 먼저)
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
    dumpsFn = pyodide.runPython("import json\njson.dumps");
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
    result = { stdout: "", stderr: "", error: { type: "NotReady", line: null, msg: "Python is not loaded" }, missing: [], charts: [] };
  } else {
    let stdinPy = null;
    let reqPy = null;
    let out = null;
    // 없는 칸은 undefined로 넘긴다(Python None). JS null은 Pyodide에서 None이 아닌 jsnull이 된다.
    let filesPy;
    let serverPy;
    let farmPy;
    let farmOut = null;
    let guardPy;
    let guardOut = null;
    try {
      stdinPy = Array.isArray(msg.stdin) ? pyodide.toPy(msg.stdin) : String(msg.stdin == null ? "" : msg.stdin);
      reqPy = pyodide.toPy(Array.isArray(msg.require) ? msg.require : []);
      if (msg.files && typeof msg.files === "object") filesPy = loadsFn(JSON.stringify(msg.files));
      if (msg.server && typeof msg.server === "object") serverPy = loadsFn(JSON.stringify(msg.server));
      if (msg.farm && typeof msg.farm === "object") farmPy = loadsFn(JSON.stringify(msg.farm));
      if (msg.guard && typeof msg.guard === "object") guardPy = loadsFn(JSON.stringify(msg.guard));
      out = runFn.callKwargs(String(msg.code == null ? "" : msg.code), stdinPy, reqPy, filesPy, serverPy, farmPy,
        { lang: msg.lang === "en" ? "en" : "ko", guard: guardPy });
      result = out.toJs({ dict_converter: Object.fromEntries });
      delete result.farm;
      delete result.guard;
      if (out.has("farm")) {
        farmOut = out.get("farm");
        result.farm = JSON.parse(dumpsFn(farmOut));
      }
      if (out.has("guard")) {
        guardOut = out.get("guard");
        result.guard = JSON.parse(dumpsFn(guardOut));
      }
    } catch (e) {
      // runner.py 자체가 예외를 낸 경우(정상이라면 없음). 매달리지 않고 오류로 돌려준다.
      result = { stdout: "", stderr: "", error: errInfo(e), missing: [], charts: [] };
      if (isFatal(e)) {
        // 화면 쪽 PyRun이 이 결과를 돌려준 뒤 작업자를 새로 띄운다.
        result.error = { type: "EngineCrash", line: null, msg: String((e && e.name) || "Error") + ": " + String((e && e.message) || e).slice(0, 1900) };
        result.fatal = true;
      }
    } finally {
      for (const p of [out, reqPy, stdinPy, filesPy, serverPy, farmPy, farmOut, guardPy, guardOut]) {
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
