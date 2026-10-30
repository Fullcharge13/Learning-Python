// Pyodide 작업자를 다루는 화면 쪽 손잡이 (설계서 4-3, 계획 작업 5).
//
//   const py = new PyRun({ indexURL: PYODIDE_CDN });
//   py.onstatus = (status, phase) => { ... };  // phase: "first-load" | "restart"
//   py.preload();                       // 앱을 열자마자 미리 받기 시작(선택)
//   const r = await py.run(code, "12\n30", ["If"]);
//   // r = { stdout, stderr, error: null | {type, line, msg}, missing: [], timeout, ms }
//   py.run(code, "", [], { files: { "memo.txt": "…" }, server: { "https://ria.example/a": { status: 200, body: "…" } } });
//   // 넷째 인자는 제한 시간(ms) 숫자 또는 { timeoutMs?, files?, server? } (v0.4 E1·E2)
//
// - 실행은 한 번에 하나씩 차례로 돈다(대기열).
// - 제한 시간(기본 3초)을 넘으면 작업자를 끝내고(terminate) 새로 띄운다. 그 실행은
//   { timeout: true, error: { type: "Timeout" } }로 끝나고, 다음 실행은 새 작업자 준비를 기다린다.
// - 작업자는 실행을 받자마자 "started"를 보낸다. 제한 시간이 지나도 이 확인이 없었다면 작업자가
//   이미 죽어 있던 것(예: iOS가 쉬는 작업자를 끝냄)이므로 "Timeout"이 아니라 "WorkerError"로 알린다.
// - 작업자가 죽거나 runner가 예외를 내도 run()은 거부(reject)하거나 멈추지 않고 error로 끝난다.
// - 불러오기는 preload()·ready·run() 중 처음 닿는 곳에서 시작한다. preload()·ready는 언제나 Promise.
// - 불러오기 실패(runner.py 받기 실패, Worker 생성 실패, loadTimeoutMs 초과)는 LoadError.
//   실패를 붙잡아 두지 않고 다음 preload()·run()에서 처음부터 다시 시도한다.
// - onstatus(status, phase): 한 번도 준비된 적 없으면 phase "first-load", 그 뒤 다시 띄우면 "restart".
//   화면은 "restart"일 때 첫 불러오기 화면 대신 작은 「다시 준비 중」만 보여 주면 된다.
// - ms는 화면 쪽에서 잰 왕복 시간(작업자에 보낸 때 → 결과 받은 때)이다. 준비 기다림은 빠진다.
//   제한 시간도 보낸 때부터 잰다(앞 실행의 시간 초과·재시작 기다림은 들지 않음).

export const PYODIDE_VERSION = "314.0.7";
// 배포용 고정 주소(npm 패키지를 jsDelivr로 받음, 판정 C19). 시험·개발은 "/node_modules/pyodide/"를 쓴다.
// 어느 쪽을 쓸지는 build.py가 정한다.
export const PYODIDE_CDN = "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/";
export const DEFAULT_TIMEOUT_MS = 3000;
export const DEFAULT_LOAD_TIMEOUT_MS = 90_000;

function baseHref() {
  return (typeof location !== "undefined" && location.href) || import.meta.url;
}

function failResult(type, msg, extra = {}) {
  return { stdout: "", stderr: "", error: { type, line: null, msg: String(msg || "") }, missing: [], timeout: false, ...extra };
}

function errMsg(e) {
  return e && e.message ? e.message : String(e);
}

function plainObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

function cleanResult(r) {
  const e = r && r.error;
  return {
    stdout: typeof r?.stdout === "string" ? r.stdout : "",
    stderr: typeof r?.stderr === "string" ? r.stderr : "",
    error: e ? { type: String(e.type || "Error"), line: Number.isInteger(e.line) ? e.line : null, msg: e.msg == null ? "" : String(e.msg) } : null,
    missing: Array.isArray(r?.missing) ? r.missing.map(String) : [],
    timeout: false,
  };
}

export class PyRun {
  constructor({ indexURL = PYODIDE_CDN, runnerSource, workerURL, loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS } = {}) {
    let idx = new URL(indexURL, baseHref()).href; // 작업자가 blob 주소여도 되도록 절대 주소로
    if (!idx.endsWith("/")) idx += "/";
    this.indexURL = idx;
    this.workerURL = workerURL || new URL("./worker.js", import.meta.url);
    this.loadTimeoutMs = loadTimeoutMs; // 다음 불러오기부터 적용
    this._runnerSource = runnerSource;  // 문자열, 받는 중인 Promise, 또는 null(다시 받기)
    this.status = "loading";
    this.phase = "first-load";
    this.onstatus = null;
    this.loadMs = null;      // 마지막 작업자 준비에 걸린 시간(작업자 안에서 잼)
    this._everReady = false;
    this._worker = null;
    this._workerDead = false;
    this._readyP = null;
    this._pending = null;    // { id, started, finish }
    this._nextId = 0;
    this._queue = Promise.resolve();
  }

  get ready() {
    return this.preload();
  }

  preload() {
    return this._readyP || this._spawn();
  }

  run(code, stdin = "", require = [], opts = DEFAULT_TIMEOUT_MS) {
    const o = typeof opts === "number" ? { timeoutMs: opts } : (opts || {});
    const timeoutMs = typeof o.timeoutMs === "number" ? o.timeoutMs : DEFAULT_TIMEOUT_MS;
    const env = { files: plainObj(o.files), server: plainObj(o.server) };
    const job = this._queue.then(() => this._runOne(code, stdin, require, timeoutMs, env));
    this._queue = job.then(() => {}, () => {});
    return job;
  }

  // 시험 전용: 작업자를 알리지 않고 끝냄(iOS가 백그라운드에서 끝낸 경우 흉내).
  _testKill() {
    if (this._worker) this._worker.terminate();
  }

  // 시험 전용: 작업자에 오류 사건이 난 것처럼 함.
  _testCrash() {
    const w = this._worker;
    if (w && typeof w.onerror === "function") w.onerror({ message: "test crash", preventDefault() {} });
  }

  // ------------------------------------------------------------ 내부

  _setStatus(s) {
    this.status = s;
    if (typeof this.onstatus === "function") {
      try { this.onstatus(s, this.phase); } catch (_) { /* 화면 쪽 오류가 실행을 막지 않게 */ }
    }
  }

  _source() {
    if (this._runnerSource == null) {
      const pr = fetch(new URL("./py/runner.py", import.meta.url)).then((r) => {
        if (!r.ok) throw new Error("runner.py " + r.status);
        return r.text();
      });
      // 실패는 붙잡아 두지 않는다: 다음 시도에서 다시 받는다.
      pr.catch(() => { if (this._runnerSource === pr) this._runnerSource = null; });
      this._runnerSource = pr;
    }
    return Promise.resolve(this._runnerSource);
  }

  _spawn() {
    this.phase = this._everReady ? "restart" : "first-load";
    this._setStatus("loading");
    let resolveReady, rejectReady;
    const p = new Promise((ok, no) => { resolveReady = ok; rejectReady = no; });
    p.catch(() => {}); // 아무도 기다리지 않을 때 처리 안 된 거부 경고를 막음
    this._readyP = p;

    let w;
    try {
      w = new Worker(this.workerURL, { type: "module" });
    } catch (e) {
      this._loadFailed(null, rejectReady, e);
      return p;
    }
    this._worker = w;
    this._workerDead = false;
    let isReady = false;
    const loadTimer = setTimeout(() => {
      if (this._worker === w && !isReady) {
        this._loadFailed(w, rejectReady, new Error("Pyodide did not load within " + this.loadTimeoutMs + " ms"));
      }
    }, this.loadTimeoutMs);

    w.onmessage = (ev) => {
      if (this._worker !== w) return; // 끝낸 작업자의 늦은 말은 무시
      const m = ev.data || {};
      if (m.type === "ready") {
        clearTimeout(loadTimer);
        isReady = true;
        this._everReady = true;
        this.loadMs = m.loadMs;
        this._setStatus("ready");
        resolveReady();
      } else if (m.type === "init-error") {
        clearTimeout(loadTimer);
        this._loadFailed(w, rejectReady, new Error(m.name + ": " + m.msg));
      } else if (m.type === "started") {
        if (this._pending && this._pending.id === m.id) this._pending.started = true;
      } else if (m.type === "result") {
        if (this._pending && this._pending.id === m.id) this._pending.finish(cleanResult(m.result));
      }
    };
    const onCrash = (ev) => {
      if (this._worker !== w) return;
      if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
      const msg = (ev && ev.message) || "worker crashed";
      clearTimeout(loadTimer);
      if (!isReady) {
        this._loadFailed(w, rejectReady, new Error(msg));
      } else {
        // 죽은 작업자로 표시하고 바로 새로 띄운다(실행 중이었다면 그 실행은 WorkerError).
        this._workerDead = true;
        const pend = this._pending;
        this._restart();
        if (pend) pend.finish(failResult("WorkerError", msg));
      }
    };
    w.onerror = onCrash;
    w.onmessageerror = onCrash;

    this._source().then(
      (src) => { if (this._worker === w) w.postMessage({ type: "init", indexURL: this.indexURL, runnerSource: src }); },
      (e) => { if (this._worker === w) { clearTimeout(loadTimer); this._loadFailed(w, rejectReady, e); } });
    return p;
  }

  _loadFailed(w, rejectReady, e) {
    if (w) { try { w.terminate(); } catch (_) { /* 무시 */ } }
    if (!w || this._worker === w) {
      this._worker = null;
      this._readyP = null; // 다음 preload()·run()에서 다시 시도
    }
    this._setStatus("error");
    rejectReady(e instanceof Error ? e : new Error(String(e)));
  }

  _restart() {
    const old = this._worker;
    this._worker = null;
    this._readyP = null;
    if (old) { try { old.terminate(); } catch (_) { /* 무시 */ } }
    this._spawn();
  }

  async _runOne(code, stdin, require, timeoutMs, env = {}) {
    for (let attempt = 0; ; attempt++) {
      try {
        await this.preload();
      } catch (e) {
        return { ...failResult("LoadError", errMsg(e)), ms: 0 };
      }
      if (!this._worker) return { ...failResult("LoadError", "no worker"), ms: 0 };
      if (!this._workerDead) break;
      // 쉬는 동안 죽은 것으로 표시된 작업자: 한 번 새로 띄워 본다.
      if (attempt >= 1) return { ...failResult("WorkerError", "worker died"), ms: 0 };
      this._restart();
    }
    const w = this._worker;
    const id = ++this._nextId;
    const t0 = performance.now();
    return new Promise((resolve) => {
      let timer = null;
      const finish = (r) => {
        if (!this._pending || this._pending.id !== id) return;
        this._pending = null;
        clearTimeout(timer);
        resolve({ ...r, ms: performance.now() - t0 });
      };
      this._pending = { id, started: false, finish };
      timer = setTimeout(() => {
        const started = this._pending && this._pending.id === id && this._pending.started;
        if (started) {
          finish({ ...failResult("Timeout", "ran longer than " + timeoutMs + " ms"), timeout: true });
        } else {
          finish(failResult("WorkerError", "worker did not respond"));
        }
        this._restart(); // 무한 반복이든 죽은 작업자든 새로 띄우는 수밖에 없다
      }, timeoutMs);
      try {
        w.postMessage({
          type: "run", id,
          code: code == null ? "" : String(code),
          stdin: Array.isArray(stdin) ? stdin.map(String) : (stdin == null ? "" : String(stdin)),
          require: Array.from(require || [], String),
          files: env.files, server: env.server,
        });
      } catch (e) {
        finish(failResult("WorkerError", errMsg(e)));
        this._restart();
      }
    });
  }
}
