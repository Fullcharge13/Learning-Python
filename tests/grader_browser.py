"""브라우저(Chromium) 안에서 Pyodide 작업자 채점기를 시험한다 (계획 작업 5).

실행: python3 tests/grader_browser.py      (또는 python3 -m pytest tests/grader_browser.py -q)

- 저장소 뿌리를 로컬 서버(빈 포트, 백그라운드 스레드)로 띄우고 tests/browser/grader_page.html을 연다.
- Pyodide는 node_modules/pyodide/에서 받는다(네트워크 없이).
- 화면은 Playwright의 "iPhone 17" 기기 설정(402×681, 배율 3, 터치)을 Chromium에 적용한다.
  WebKit은 이 환경에 없으므로 사파리 고유 동작은 실기기 목록(작업 13)에서 확인한다.
- 모든 시험은 페이지 하나(작업자 하나)를 함께 쓴다. 그래야 실행 사이 격리와 시간 초과 뒤 재시작을 볼 수 있다.
"""

import atexit
import functools
import http.server
import os
import socketserver
import sys
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE_PATH = "/tests/browser/grader_page.html"
READY_TIMEOUT_MS = 60_000


class _Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
        ".json": "application/json",
        ".py": "text/plain; charset=utf-8",
        ".zip": "application/zip",
    }

    def log_message(self, *args):  # 시험 출력을 깨끗하게
        pass

    # /stall-once/<표>/<파일>: 그 표로 오는 첫 요청은 STALL_S초 동안 답하지 않고(멈춘 네트워크 흉내)
    # 끝에 404를 준다. 두 번째 요청부터는 node_modules/pyodide/<파일>을 그대로 준다.
    def do_GET(self):
        parts = self.path.split("?")[0].split("/")
        if len(parts) >= 4 and parts[1] == "stall-once":
            token = parts[2]
            with _STALL_LOCK:
                first = token not in _STALLED
                _STALLED.add(token)
            if first:
                time.sleep(STALL_S)
                try:
                    self.send_error(404)
                except (BrokenPipeError, ConnectionResetError):
                    pass  # 작업자를 끝내면 브라우저가 이 요청을 이미 끊었다(정상)
                return
            self.path = "/node_modules/pyodide/" + "/".join(parts[3:])
        return super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


STALL_S = 3
_STALL_LOCK = threading.Lock()
_STALLED = set()


class _Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


_S = {}


def _session():
    """서버·브라우저·페이지를 한 번만 띄우고 모든 시험이 함께 쓴다."""
    if _S:
        return _S
    httpd = _Server(("127.0.0.1", 0), functools.partial(_Handler, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    port = httpd.server_address[1]

    pw = sync_playwright().start()
    browser = pw.chromium.launch()
    device = {k: v for k, v in pw.devices["iPhone 17"].items() if k != "default_browser_type"}
    context = browser.new_context(**device)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append("console." + m.type + ": " + m.text)
            if m.type == "error" else None)
    page.goto("http://127.0.0.1:%d%s" % (port, PAGE_PATH))
    # 모듈 스크립트 안의 await 때문에 load 뒤에야 readyPromise가 생길 수 있다.
    page.wait_for_function("() => window.readyPromise !== undefined", timeout=READY_TIMEOUT_MS)
    state = page.evaluate("() => window.readyPromise")
    _S.update(httpd=httpd, pw=pw, browser=browser, page=page, errors=errors, ready_state=state)

    def _close():
        try:
            browser.close()
            pw.stop()
        finally:
            httpd.shutdown()

    atexit.register(_close)
    return _S


def _page():
    s = _session()
    assert s["ready_state"] == "ready", "runner not ready: %r / %r" % (
        s["page"].evaluate("() => window.pageErrors"), s["errors"])
    return s["page"]


def _run(code, stdin="", require=None, timeout_ms=3000):
    return _page().evaluate(
        "([c, s, r, t]) => window.runner.run(c, s, r, t)", [code, stdin, require or [], timeout_ms])


# ---------------------------------------------------------------- 시험

def test_cold_start_ms():
    s = _session()
    assert s["ready_state"] == "ready"
    ms = s["page"].evaluate("() => window.coldStartMs")
    print("    Pyodide cold start (page script → ready): %.0f ms" % ms)
    assert ms > 0


def test_hello():
    r = _run('print("hi")')
    assert r["stdout"] == "hi\n", r
    assert r["error"] is None, r
    assert r["timeout"] is False, r
    assert r["missing"] == [], r
    assert isinstance(r["ms"], (int, float)) and r["ms"] >= 0, r
    print("    print(\"hi\") round trip: %.1f ms" % r["ms"])


def test_input_short():
    r = _run("a = input()\nb = input()\nprint(a, b)", "1")
    assert r["error"] is not None and r["error"]["type"] == "InputMissing", r
    assert r["error"]["line"] == 2, r
    assert r["timeout"] is False, r


def test_string_stdin():
    r = _run("a = int(input())\nb = int(input())\nprint(a + b)", "12\n30")
    assert r["stdout"] == "42\n", r
    assert r["error"] is None, r


def test_require():
    r = _run("print(1)", "", ["If"])
    assert r["missing"] == ["If"], r


def test_error_line():
    r = _run("x = 1\nprint(y)")
    assert r["error"]["type"] == "NameError", r
    assert r["error"]["line"] == 2, r


def test_output_limit():
    r = _run('while True:\n    print("x" * 1000)')
    assert r["timeout"] is False, r
    assert r["error"]["type"] == "OutputLimit", r
    assert len(r["stdout"]) <= 100_000, len(r["stdout"])


def test_isolation():
    r1 = _run("import builtins\nbuiltins.print = lambda *a, **k: None\nprint('hidden')")
    assert r1["stdout"] == "", r1
    r2 = _run("print('ok')")
    assert r2["stdout"] == "ok\n", r2


def _run_env(code, env):
    return _page().evaluate(
        "([c, e]) => window.runner.run(c, '', [], e)", [code, env])


def test_files_in_pyodide():
    # v0.4 E1: 준 파일을 읽고, 쓴 파일은 다음 실행에 남지 않는다.
    r = _run_env('with open("memo.txt") as f:\n    print(f.read())\nopen("new.txt", "w").write("x")\n',
                 {"files": {"memo.txt": "우유 2개"}})
    assert r["error"] is None and r["stdout"] == "우유 2개\n", r
    r2 = _run_env('import os\nprint(sorted(os.listdir(".")))\nopen("new.txt")\n', {})
    assert r2["stdout"] == "[]\n", r2
    assert r2["error"]["type"] == "FileNotFoundError", r2


def test_practice_server_in_pyodide():
    # v0.4 E2: 연습 서버에서 읽기, 없는 주소는 URLError, 404는 HTTPError.
    env = {"server": {"https://ria.example/menu": {"status": 200, "body": "김밥 3000"},
                      "https://ria.example/gone": {"status": 404, "body": ""}}}
    code = ("import urllib.request\nimport urllib.error\n"
            "with urllib.request.urlopen('https://ria.example/menu') as r:\n"
            "    print(r.status, r.read().decode('utf-8'))\n"
            "for u in ['https://ria.example/gone', 'https://example.com']:\n"
            "    try:\n        urllib.request.urlopen(u)\n"
            "    except urllib.error.HTTPError as e:\n        print('HTTP', e.code)\n"
            "    except urllib.error.URLError as e:\n        print(e.reason)\n")
    r = _run_env(code, env)
    assert r["error"] is None, r
    assert r["stdout"] == "200 김밥 3000\nHTTP 404\n연습 서버에 없는 주소예요\n", r
    # server 없이 돌리면 손대지 않은 진짜 urlopen(JS null이 Python None이 아닌 jsnull로 가던 회귀 방지)
    r2 = _run("import urllib.request\nprint(urllib.request.urlopen.__module__)")
    assert r2["stdout"] == "urllib.request\n", r2


def test_queue():
    # 동시에 세 번 불러도 하나씩 차례로 돌고 모두 끝난다.
    outs = _page().evaluate("""async () => {
        const r = window.runner;
        const all = await Promise.all([r.run("print(1)"), r.run("print(2)"), r.run("print(3)")]);
        return all.map(x => x.stdout);
    }""")
    assert outs == ["1\n", "2\n", "3\n"], outs


def test_timeout_then_ok():
    res = _page().evaluate("""async () => {
        const r = window.runner;
        const t0 = performance.now();
        const a = await r.run("while True:\\n    pass");
        const dt = performance.now() - t0;
        const t1 = performance.now();
        const b = await r.run("print(2)");
        const dt2 = performance.now() - t1;
        return { a, dt, b, dt2, status: r.status };
    }""")
    a, b = res["a"], res["b"]
    print("    timeout returned after %.0f ms; next run (incl. worker restart) %.0f ms"
          % (res["dt"], res["dt2"]))
    assert a["timeout"] is True, a
    assert a["error"]["type"] == "Timeout", a
    assert a["stdout"] == "" and a["missing"] == [], a
    assert 3000 <= res["dt"] <= 4500, res["dt"]
    assert b["stdout"] == "2\n", b
    assert b["timeout"] is False and b["error"] is None, b
    assert res["status"] == "ready", res


def test_status_phases():
    # 처음 불러오기와 시간 초과 뒤 다시 띄우기를 화면이 구별할 수 있어야 한다(「다시 준비 중」).
    log = _page().evaluate("() => window.statusLog")
    assert log[:4] == ["loading:first-load", "ready:first-load",
                       "loading:restart", "ready:restart"], log


def test_queued_own_clock():
    # 시간 초과 뒤에 줄 서 있던 실행은 자기 시계로 잰다: 새 작업자 준비 시간은 제한 시간·ms에 들지 않는다.
    res = _page().evaluate("""async () => {
        const r = window.runner;
        await r.ready;
        const t0 = performance.now();
        const pa = r.run("while True:\\n    pass", "", [], 1000);
        const pb = r.run("print(7)", "", [], 1000);   // 다시 띄우는 데 1초 넘게 걸려도 시간 초과가 아니어야 함
        const a = await pa;
        const b = await pb;
        return { a, b, wall: performance.now() - t0 };
    }""")
    a, b = res["a"], res["b"]
    print("    queued job: wall %.0f ms, its own ms %.1f" % (res["wall"], b["ms"]))
    assert a["timeout"] is True, a
    assert b["timeout"] is False and b["error"] is None and b["stdout"] == "7\n", b
    assert res["wall"] > 1000 + 500, res          # 앞 실행 1초 + 재시작이 실제로 있었음
    assert b["ms"] < 500, b                       # 재시작 기다림은 ms에서 빠짐


def test_ui_alive():
    # 무한 반복이 작업자에서 도는 동안 화면(본 스레드)의 requestAnimationFrame이 계속 도는지.
    res = _page().evaluate("""async () => {
        const r = window.runner;
        await r.ready;
        const p = r.run("while True:\\n    pass");
        await new Promise((ok) => setTimeout(ok, 200));   // 작업자가 반복에 들어간 뒤부터 잼
        let frames = 0;
        const t0 = performance.now();
        await new Promise((ok) => {
            const tick = () => { frames++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else ok(); };
            requestAnimationFrame(tick);
        });
        const elapsed = performance.now() - t0;
        const res = await p;
        return { frames, elapsed, timeout: res.timeout };
    }""")
    print("    rAF during infinite loop: %d frames in %.0f ms" % (res["frames"], res["elapsed"]))
    assert res["timeout"] is True, res
    assert res["frames"] >= 30, res


def test_no_page_errors():
    s = _session()
    assert s["errors"] == [], s["errors"]


def test_load_error_resolves():
    # Pyodide를 못 받으면 run()은 매달리지 않고 LoadError로 끝나고, 상태는 "error".
    # (일부러 404를 내므로 test_no_page_errors 뒤에 둔다.)
    res = _page().evaluate("""async () => {
        const { PyRun } = await import("/src/pyrun.js");
        const bad = new PyRun({ indexURL: "/no-such-dir/" });
        const seen = [];
        bad.onstatus = (s) => seen.push(s);
        const r = await bad.run("print(1)");
        return { r, status: bad.status, seen };
    }""")
    assert res["r"]["error"]["type"] == "LoadError", res
    assert res["r"]["timeout"] is False, res
    assert res["status"] == "error", res
    # 원래 작업자는 그대로 쓸 수 있다.
    assert _run("print(5)")["stdout"] == "5\n"


def test_cdn_constant():
    v = _page().evaluate("""async () => {
        const m = await import("/src/pyrun.js");
        return [m.PYODIDE_CDN, m.PYODIDE_VERSION];
    }""")
    assert v == ["https://cdn.jsdelivr.net/npm/pyodide@314.0.7/", "314.0.7"], v


def test_fetch_retry():
    # runner.py 받기가 한 번 실패해도 그 실패를 붙잡아 두지 않고 다음 실행에서 다시 받는다.
    res = _page().evaluate("""async () => {
        const { PyRun } = await import("/src/pyrun.js");
        const p = new PyRun({ indexURL: "/node_modules/pyodide/" });
        const realFetch = window.fetch;
        window.fetch = () => Promise.reject(new TypeError("offline (test)"));
        let a;
        try { a = await p.run("print(1)"); } finally { window.fetch = realFetch; }
        const statusAfterFail = p.status;
        const b = await p.run("print(1)");
        return { a, b, statusAfterFail };
    }""")
    assert res["a"]["error"]["type"] == "LoadError", res
    assert res["statusAfterFail"] == "error", res
    assert res["b"]["error"] is None and res["b"]["stdout"] == "1\n", res


def test_worker_ctor_throws():
    # new Worker가 바로 던져도 ready·preload는 언제나 Promise이고, run은 LoadError로 끝난다.
    res = _page().evaluate("""async () => {
        const { PyRun } = await import("/src/pyrun.js");
        const p = new PyRun({ indexURL: "/node_modules/pyodide/" });
        const RealWorker = window.Worker;
        window.Worker = function () { throw new Error("no workers (test)"); };
        let out = {};
        try {
            const pre = p.preload();
            out.preloadIsPromise = pre instanceof Promise;
            out.readyIsPromise = p.ready instanceof Promise;
            out.readyRejected = await p.ready.then(() => false, () => true);
            out.a = await p.run("print(1)");
        } finally { window.Worker = RealWorker; }
        out.b = await p.run("print(1)");
        return out;
    }""")
    assert res["preloadIsPromise"] and res["readyIsPromise"] and res["readyRejected"], res
    assert res["a"]["error"]["type"] == "LoadError", res
    assert res["b"]["stdout"] == "1\n", res


def test_load_timeout_retry():
    # Pyodide 받기가 멈추면 loadTimeoutMs 뒤 LoadError, 다음 호출에서 다시 시도해 성공한다.
    res = _page().evaluate("""async () => {
        const { PyRun } = await import("/src/pyrun.js");
        const p = new PyRun({ indexURL: "/stall-once/t" + Date.now() + "/", loadTimeoutMs: 500 });
        const t0 = performance.now();
        const a = await p.run("print(1)");
        const failMs = performance.now() - t0;
        const statusAfterFail = p.status;
        p.loadTimeoutMs = 60000;
        const b = await p.run("print(1)");
        return { a, b, failMs, statusAfterFail };
    }""")
    print("    stalled load gave up after %.0f ms" % res["failMs"])
    assert res["a"]["error"]["type"] == "LoadError", res
    assert 400 <= res["failMs"] < 2500, res
    assert res["statusAfterFail"] == "error", res
    assert res["b"]["error"] is None and res["b"]["stdout"] == "1\n", res


def test_idle_worker_killed_silently():
    # 쉬는 동안 작업자가 소리 없이 죽으면(iOS가 백그라운드에서 끝낸 경우 흉내) 실행 시작 확인이 오지 않는다.
    # 그때는 "Timeout"이 아니라 "WorkerError"로 알리고, 그다음 실행은 새 작업자로 성공한다.
    res = _page().evaluate("""async () => {
        const r = window.runner;
        await r.ready;
        r._testKill();
        const a = await r.run("print(1)");
        const b = await r.run("print(1)");
        return { a, b };
    }""")
    a, b = res["a"], res["b"]
    assert a["timeout"] is False and a["error"]["type"] == "WorkerError", a
    assert b["error"] is None and b["stdout"] == "1\n", b


def test_idle_worker_error_event():
    # 쉬는 동안 작업자에 오류 사건이 나면 죽은 것으로 표시하고 다시 띄운다 → 다음 실행은 그냥 성공.
    res = _page().evaluate("""async () => {
        const r = window.runner;
        await r.ready;
        r._testCrash();
        const a = await r.run("print(1)");
        return { a, status: r.status };
    }""")
    assert res["a"]["error"] is None and res["a"]["stdout"] == "1\n", res
    assert res["status"] == "ready", res


TESTS = [test_cold_start_ms, test_hello, test_input_short, test_string_stdin, test_require,
         test_error_line, test_output_limit, test_isolation, test_files_in_pyodide,
         test_practice_server_in_pyodide, test_queue, test_timeout_then_ok,
         test_status_phases, test_queued_own_clock, test_ui_alive, test_no_page_errors,
         test_load_error_resolves, test_cdn_constant, test_fetch_retry, test_worker_ctor_throws,
         test_load_timeout_retry, test_idle_worker_killed_silently, test_idle_worker_error_event]


def main():
    passed = failed = 0
    for t in TESTS:
        t0 = time.perf_counter()
        try:
            t()
        except Exception as e:  # noqa: BLE001
            failed += 1
            print("FAIL %s (%.2fs): %s: %s" % (t.__name__, time.perf_counter() - t0,
                                               type(e).__name__, e))
        else:
            passed += 1
            print("ok   %s (%.2fs)" % (t.__name__, time.perf_counter() - t0))
    print("pass %d, fail %d" % (passed, failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
