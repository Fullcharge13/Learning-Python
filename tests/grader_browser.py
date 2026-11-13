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
import re
import socketserver
import sys
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from runner_src import runner_source  # noqa: E402
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
        if self.path.split("?")[0] == "/src/py/runner.py":   # 작업자는 guard.py를 이어 붙인 한 파일을 받는다
            body = runner_source().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
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
    context = browser.new_context(locale="ko-KR", **device)  # v0.14.0: 처음 언어는 휴대폰 언어
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


def test_require_comment_elif_else_in_pyodide():
    # 판정 C44: Pyodide 안에서도 tokenize로 주석·elif를 가려낸다
    assert _run('print("# 아님")', "", ["Comment"])["missing"] == ["Comment"]
    assert _run('# 메모\nprint(1)', "", ["Comment"])["missing"] == []
    elif_code = "x = 5\nif x > 9:\n    print(1)\nelif x > 3:\n    print(2)\nelse:\n    print(3)\n"
    assert _run(elif_code, "", ["Elif", "Else"])["missing"] == []
    else_if = "x = 5\nif x > 9:\n    print(1)\nelse:\n    if x > 3:\n        print(2)\n"
    assert _run(else_if, "", ["Elif", "Else"])["missing"] == ["Elif"]



def test_require_selfcall_formatspec_triplestr_in_pyodide():
    # 판정 C45: 재귀·f-문자열 서식·세 따옴표 문자열을 Pyodide에서도 가려낸다(한 번에)
    code = ('def fact(n):\n    """세 따옴표"""\n    return 1 if n <= 1 else n * fact(n - 1)\n\n'
            'v = fact(5)\nprint(f"{v:>6}")\n')
    r = _run(code, "", ["SelfCall", "FormatSpec", "TripleStr"])
    assert r["stdout"] == "   120\n" and r["missing"] == [], r
    plain = 'def f(n):\n    return n\n\nx = f(1)\nprint(f"{x!r}")  #"""\n'
    r = _run(plain, "", ["SelfCall", "FormatSpec", "TripleStr"])
    assert r["missing"] == ["SelfCall", "FormatSpec", "TripleStr"], r


def test_require_namedgroup_listcomp_lambda_in_pyodide():
    # v0.8(12장·7장·9장 심화): 이름 붙인 묶음 (?P<…>)과 컴프리헨션·lambda를 Pyodide에서도 가려낸다
    code = ('import re\nm = re.search(r"(?P<h>\\d+)시", "9시")\nps = sorted([3, 1], key=lambda x: -x)\n'
            'print(m.group("h"), [p * 2 for p in ps])\n')
    r = _run(code, "", ["NamedGroup", "ListComp", "Lambda"])
    assert r["stdout"] == "9 [6, 2]\n" and r["missing"] == [], r
    plain = 'import re\n# (?P<h>…)\nprint(re.search(r"(\\d+)시", "9시").group(1))\n'
    r = _run(plain, "", ["NamedGroup", "ListComp", "Lambda"])
    assert r["stdout"] == "9\n" and r["missing"] == ["NamedGroup", "ListComp", "Lambda"], r


def test_require_reraise_in_pyodide():
    # v0.8(10장 심화): except 안의 맨 raise만 Reraise로 본다(새 오류를 던지는 raise ValueError(e)는 아님)
    code = ('try:\n    try:\n        int("a")\n    except ValueError:\n        print("안")\n        raise\n'
            'except ValueError:\n    print("밖")\n')
    r = _run(code, "", ["Reraise"])
    assert r["stdout"] == "안\n밖\n" and r["missing"] == [], r
    plain = code.replace("        raise\n", "        raise ValueError(\"x\")\n")
    r = _run(plain, "", ["Reraise"])
    assert r["stdout"] == "안\n밖\n" and r["missing"] == ["Reraise"], r


def test_require_def_sql_in_pyodide():
    # v0.9(15·16장 심화): Def:<이름>은 def가 있는지, SQL:<낱말>은 글자 상수 안의 낱말(대소문자 무시)
    code = ('class B:\n    def __str__(self):\n        return "책"\n\n'
            'q = ("SELECT * FROM a "\n     "join b ON a.id = b.id")\nprint(B())\n')
    r = _run(code, "", ["Def:__str__", "SQL:JOIN", "SQL:HAVING", "Def:__eq__"])
    assert r["stdout"] == "책\n" and r["missing"] == ["SQL:HAVING", "Def:__eq__"], r


def test_multiline_chart_in_pyodide():
    # v0.9(17장 심화): 같은 이름들에 line 여러 번 + legend → series, 선 하나는 예전 모양 그대로
    r = _run("import chart\nd = ['월', '화']\nchart.line(d, [1, 2])\nchart.line(d, [2, 0.5])\n"
             "chart.legend(['리아', '민지'])\nchart.show()\nchart.line(d, [3, 3])\nchart.show()\n")
    assert r["error"] is None, r
    assert r["charts"] == [{"kind": "line", "labels": ["월", "화"],
                            "series": [{"name": "리아", "values": [1, 2]}, {"name": "민지", "values": [2, 0.5]}]},
                           {"kind": "line", "labels": ["월", "화"], "values": [3, 3]}], r
    r2 = _run("import chart\nd = ['월', '화']\nchart.line(d, [1, 2])\nchart.legend(['a', 'b'])\nchart.show()\n")
    assert r2["error"]["type"] == "ValueError" and r2["error"]["line"] == 5 and r2["charts"] == [], r2


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


def test_chart_in_pyodide():
    # v0.5 E3: chart 모듈이 Pyodide에서도 같은 charts를 돌려주고, 다음 실행에 남지 않는다.
    r = _run("import chart\nchart.bar(['사과', '배'], [3, 5.5])\nchart.title('과일')\nchart.show()\n"
             "chart.line([2024, 2025], [1, 2])\nchart.show()\n")
    assert r["error"] is None, r
    assert r["charts"] == [{"kind": "bar", "labels": ["사과", "배"], "values": [3, 5.5], "title": "과일"},
                           {"kind": "line", "labels": ["2024", "2025"], "values": [1, 2]}], r
    r2 = _run("import chart\nchart.bar(['a', 'b'], [1])\n")
    assert r2["error"]["type"] == "ValueError" and r2["error"]["msg"] == "이름과 값의 개수가 달라요", r2
    assert r2["charts"] == [], r2
    r3 = _run("print(1)")
    assert r3["charts"] == [], r3


def test_farm_in_pyodide():
    # v0.10 파이의 텃밭: 명령·사건·끝 상태가 Pyodide에서도 같고, 빈 칸(None)은 null로 온다.
    # 500번 지침은 except로 삼켜도 멈추고(추적 함수), 오류 없이 stopped "tired".
    state = {"size": 3, "cells": [{"crop": "당근", "planted_at": 0}] + [None] * 8,
             "pie": {"x": 0, "y": 0}, "clock": 8, "store": {"당근": 0, "감자": 0}, "upgrades": []}
    code = ('harvest()\nmove("왼쪽")\nplant("감자")\nplant("당근")\nprint("다 했어")\n')
    r = _run_env(code, {"farm": state})
    assert r["error"] is None and r["stdout"] == "다 했어\n", r
    f = r["farm"]
    assert f["events"] == [
        {"t": "harvest", "line": 1, "crop": "당근", "x": 0, "y": 0},
        {"t": "move", "line": 2, "dir": "왼쪽", "x": 2, "y": 0},
        {"t": "plant_fail", "line": 3, "reason": "no_seed", "crop": "감자", "x": 2, "y": 0},
        {"t": "plant", "line": 4, "crop": "당근", "x": 2, "y": 0},
        {"t": "say", "line": 5, "text": "다 했어"}], f
    assert f["state"] == {"size": 3, "cells": [None, None, {"crop": "당근", "planted_at": 11}] + [None] * 6,
                          "pie": {"x": 2, "y": 0}, "clock": 12, "store": {"당근": 1, "감자": 0, "토마토": 0},
                          "upgrades": [], "seeds": 5}, f
    assert "files" not in f, f
    assert f["stopped"] is None and f["actions"] == 4, f
    # v0.11: store()는 창고 사본(바꿔도 진짜 창고 그대로), where()는 (x, y) 튜플 — 시간·사건 없음
    q = _run_env('from farm import *\nharvest()\nmove("오른쪽")\ns = store()\ns["당근"] = 99\n'
                 'print(where(), store(), type(where()).__name__)\n', {"farm": state})
    assert q["error"] is None and q["stdout"] == "(1, 0) {'당근': 1, '감자': 0, '토마토': 0} tuple\n", q
    assert q["farm"]["state"]["store"] == {"당근": 1, "감자": 0, "토마토": 0} and q["farm"]["actions"] == 2, q
    assert [e["t"] for e in q["farm"]["events"]] == ["harvest", "move", "say"], q
    t = _run_env('while True:\n    try:\n        move("아래")\n    except BaseException:\n        pass\n',
                 {"farm": state})
    assert t["error"] is None and t["timeout"] is False, t
    assert t["farm"]["stopped"] == "tired" and t["farm"]["actions"] == 500, t["farm"]["stopped"]
    # 판정 C60: 시간이 흐르지 않는 기다리기는 확인 2000번에서 멈춤(시간 초과 아님)
    w = _run_env('move("아래")\nwhile not can_harvest():\n    pass\n', {"farm": state})
    assert w["error"] is None and w["timeout"] is False, w
    assert w["farm"]["stopped"] == "waited" and w["farm"]["actions"] == 1, w["farm"]["stopped"]
    assert w["ms"] < 1000, w["ms"]
    bad = _run_env('move("앞")\n', {"farm": state})
    assert bad["error"]["type"] == "ValueError" and bad["error"]["line"] == 1, bad
    assert bad["error"]["msg"] == "방향은 위·아래·왼쪽·오른쪽 중 하나예요", bad
    assert bad["farm"]["state"]["clock"] == 8, bad
    plain = _run("import farm")
    assert "farm" not in plain and plain["error"]["type"] == "ModuleNotFoundError", plain
    # v0.12: 토마토·씨앗 봉투, 받는 쪽지 읽기(읽기 전용 → PermissionError), 농장일지 쓰기·돌려받기(MEMFS)
    notes = {"주문서.txt": "토마토 2\n당근 1\n", "농장일지.txt": "어제\n"}
    code = ('with open("주문서.txt") as f:\n    for line in f:\n        crop, n = line.split()\n'
            '        for i in range(int(n)):\n            try:\n                plant(crop)\n'
            '            except ValueError as e:\n                print(e)\n            move("오른쪽")\n'
            'with open("농장일지.txt", "a") as f:\n    f.write("씨앗 " + str(seeds()) + "\\n")\n'
            'try:\n    open("주문서.txt", "a")\nexcept PermissionError as e:\n    print(e)\n'
            'import io\nio.open("주문서.txt", "w")\n')
    n = _run_env(code, {"farm": dict(state, cells=[None] * 9, seeds=1), "files": notes})
    assert n["error"] == {"type": "PermissionError", "line": 17, "msg": "받은 쪽지는 읽기만 해요"}, n
    assert n["stdout"] == "토마토 씨앗이 떨어졌어요\n받은 쪽지는 읽기만 해요\n", n
    nf = n["farm"]
    assert [(e["t"], e.get("crop"), e.get("reason")) for e in nf["events"] if e["t"].startswith("plant")] == [
        ("plant", "토마토", None), ("plant_fail", "토마토", "no_tomato_seed"), ("plant", "당근", None)], nf
    assert nf["state"]["seeds"] == 0 and nf["files"] == {"농장일지.txt": "어제\n씨앗 0\n"}, nf
    ripe = dict(state, cells=[{"crop": "토마토", "planted_at": 0}] + [None] * 8, clock=10, seeds=19)
    h = _run_env("harvest()\nprint(seeds(), store())\n", {"farm": ripe, "files": {"농장일지.txt": "x" * 2100}})
    assert h["stdout"] == "20 {'당근': 0, '감자': 0, '토마토': 1}\n", h
    assert h["farm"]["files"] == {"농장일지.txt": "x" * 2000}, h["farm"]["files"]
    gone = _run_env('import os\nos.remove("농장일지.txt")\nopen("메모.txt", "w").write("a")\n',
                    {"farm": state, "files": notes})
    assert gone["error"] is None and gone["farm"]["files"] == {"농장일지.txt": ""}, gone
    after = _run_env('import os\nprint(sorted(os.listdir(".")))\nopen("x.txt", "w").write("ok")\n', {"files": {}})
    assert after["error"] is None and after["stdout"] == "[]\n", after   # 텃밭 없는 실행은 open 그대로


SQL = ("import sqlite3\n"
       "con = sqlite3.connect(':memory:')\n"
       "con.execute('CREATE TABLE t (name TEXT, n INTEGER)')\n"
       "con.executemany('INSERT INTO t VALUES (?, ?)', [('사과', 3), ('배', 5)])\n"
       "print(con.execute('SELECT name FROM t ORDER BY n DESC').fetchall())\n")


def test_sqlite3_in_pyodide():
    # Pyodide 314.0.7은 _sqlite3를 핵심(pyodide.asm.wasm)에, sqlite3 모듈을 python_stdlib.zip에 넣어 둔다.
    # 따로 받을 꾸러미가 없다 → 실행 중 네트워크 요청이 하나도 없어야 한다(막아 둔 채로 돌려 봄).
    pg = _page()
    asked = []
    pg.on("request", lambda req: asked.append(req.url))
    pg.route("**/*", lambda route: route.abort())
    try:
        r = _run(SQL)
    finally:
        pg.unroute("**/*")
    assert r["error"] is None, r
    assert r["stdout"] == "[('배',), ('사과',)]\n", r
    assert r["ms"] < 3000, r
    assert asked == [], asked


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


def test_engine_crash_restart():
    # 치명 오류(스택 바닥) → error.type "EngineCrash"·fatal, 작업자를 다시 띄운 뒤 다음 실행은 정상(v0.16.1 §2-1).
    # Pyodide가 치명 오류를 console.error로 남기므로(기대한 소음) 이 시험이 만든 것만 걸러낸다.
    s = _session()
    before = len(s["errors"])
    res = _page().evaluate("""async () => {
        const r = window.runner;
        const log = [];
        const prev = r.onstatus;
        r.onstatus = (st, ph) => { log.push(st + ":" + ph); if (prev) prev(st, ph); };
        const a = await r.run("x=[]\\nfor i in range(100000):\\n    x=[x]\\nprint(x)");
        const mid = r.status;
        const b = await r.run("print(2)");
        r.onstatus = prev;
        return { a, mid, b, log, status: r.status };
    }""")
    a, b = res["a"], res["b"]
    print("    fatal result: %r" % (a["error"],))
    assert a["error"]["type"] == "EngineCrash", a
    assert a["fatal"] is True, a
    assert a["timeout"] is False, a
    assert res["mid"] == "loading", res          # 돌려준 직후 새 작업자를 띄우는 중
    assert res["log"] == ["loading:restart", "ready:restart"], res["log"]
    assert b["stdout"] == "2\n" and b["error"] is None, b
    assert res["status"] == "ready", res
    added = s["errors"][before:]
    del s["errors"][before:]
    assert added and all(re.search(r"fatal|RangeError|Maximum call stack|^console\.error: \s+at ", e, re.I | re.S)
                         for e in added), added


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


def test_lang_in_pyodide():
    # v0.13.5: 실행 언어 — opts.lang을 주면 그 언어, 없으면 앱의 지금 언어(i18n lang()). 차트·텃밭 문구가 따른다.
    res = _page().evaluate("""async () => {
        const code = "import chart\\nchart.bar([1], [1, 2])\\n";
        const en = await window.runner.run(code, "", [], { lang: "en" });
        const ko = await window.runner.run(code, "", [], {});
        const farm = { size: 3, cells: Array(9).fill(null), pie: { x: 0, y: 0 }, clock: 0,
                       store: { "당근": 0, "감자": 0, "토마토": 0 }, upgrades: [], seeds: 5 };
        const f = await window.runner.run('plant("carrot")\\nprint(what_here())\\n', "", [], { farm, lang: "en" });
        const i18n = await import("/src/i18n.js");
        const before = i18n.packOf("en");
        i18n.usePack("en", before || { ui: {}, data: {} });
        i18n.setLang("en");
        let d;
        try { d = await window.runner.run(code, "", [], {}); } finally { i18n.setLang("ko"); i18n.usePack("en", before); }
        return { en: en.error.msg, ko: ko.error.msg, f: f.stdout, fe: f.error, d: d.error.msg };
    }""")
    hangul = re.compile(r"[가-힣]")
    assert not hangul.search(res["en"]) and hangul.search(res["ko"]), res
    assert res["fe"] is None and res["f"] == "carrot\n", res
    assert not hangul.search(res["d"]), res


def test_guard_three_modes():
    # 경비실: 세 방식(script·loop·func)이 Pyodide 작업자에서 돈다. 정수 값·null이 JSON으로 건너가 int로 남는다.
    res = _page().evaluate("""async () => {
        const T = (...p) => p.map(([value, expect]) => ({ value, expect }));
        const run = (code, guard) => window.runner.run(code, "", [], { guard });
        const g1 = 'if attempt == password:\\n    allow()\\nelse:\\n    block()\\n';
        const g2 = 'if attempt >= 9 and attempt < 18:\\n    allow()\\nelse:\\n    block()\\n';
        const g3 = 'def check(attempt):\\n    if attempt == "0000" or attempt == "1234" or attempt == "1111":\\n'
                 + '        return False\\n    return True\\n';
        const g5 = 'count = 0\\nwhile has_try():\\n    next_try()\\n    if count < 5:\\n        allow()\\n'
                 + '        count = count + 1\\n    else:\\n        block()\\n';
        const s = await run(g1, { mode: "script", password: "sunflower77",
            tries: T(["sunflower77", "allow"], ["123456", "block"]) });
        const i = await run(g2, { mode: "script", tries: T([9, "allow"], [18, "block"], [5, "block"]) });
        const l = await run(g5, { mode: "loop", tries: T(["a", "allow"], ["b", "allow"], ["c", "allow"],
            ["d", "allow"], ["e", "allow"], ["f", "block"]) });
        const f = await run(g3, { mode: "func", tries: T(["0000", "block"], ["1234", "block"], ["9999", "allow"]) });
        const bad = await run('def check(attempt):\\n    return "yes"\\n', { mode: "func", tries: T(["a", "allow"]) });
        const sw = await run("while True:\\n    try:\\n        next_try()\\n    except:\\n        pass\\n",
            { mode: "loop", tries: T(["a", "block"], ["b", "block"]) });
        const n = await run("print(1)\\n", undefined);
        return { s, i, l, f, bad, sw, n };
    }""")
    assert res["s"]["error"] is None and res["s"]["guard"]["solved"] is True, res["s"]
    assert res["i"]["error"] is None and res["i"]["guard"]["solved"] is True, res["i"]
    assert res["l"]["error"] is None and res["l"]["guard"]["solved"] is True, res["l"]
    assert res["f"]["error"] is None and res["f"]["guard"]["solved"] is True, res["f"]
    assert res["bad"]["error"]["type"] == "GuardAnswerError", res["bad"]
    assert res["sw"]["error"]["type"] == "GuardUsageError", res["sw"]   # 삼킨 사용 오류: 추적기 경로
    assert len(res["sw"]["guard"]["events"]) == 2, res["sw"]
    assert res["n"].get("guard") is None, res["n"]


def test_error_variants_real_engine():
    # 오류 무늬가 영어 메시지에 의존한다 → 실제 Pyodide 3.14가 돌려주는 문구로 변형이 골라지는지 본다(v0.16.1 §2-4).
    cases = [
        ("self", "class A:\n    def f():\n        return 1\nA().f()\n", "TypeError", "TypeError_self"),
        ("self2", "class A:\n    def f(x):\n        return 1\nA().f(2)\n", "TypeError", "TypeError_self"),
        ("compare", "print([1] <= {1})\n", "TypeError", "TypeError_compare"),
        ("container", "d = {}\nprint('a' in d.get('x'))\n", "TypeError", "TypeError_container"),
        ("iterable", "for x in None:\n    pass\n", "TypeError", "TypeError_container"),
        ("call", "x = 5\nx()\n", "TypeError", "TypeError_call"),
        ("import", "print(re.match('a', 'a'))\n", "NameError", "NameError_import"),
        ("eq", "x = 1\nif x = 1:\n    pass\n", "SyntaxError", "SyntaxError_eq"),
        ("plain_name", "print(zzz)\n", "NameError", None),
        ("plain_syntax", "print('a'\n", "SyntaxError", None),
        ("index", "a = [1]\na[5]\n", "IndexError", "IndexError"),
        ("key", "{}['a']\n", "KeyError", "KeyError"),
        ("attr", "'a'.foo()\n", "AttributeError", "AttributeError"),
        ("file", "open('nope.txt')\n", "FileNotFoundError", "FileNotFoundError"),
        ("zero", "1 / 0\n", "ZeroDivisionError", "ZeroDivisionError"),
        ("json", "import json\njson.loads('{')\n", "JSONDecodeError", "JSONDecodeError"),
        ("recursion", "def f():\n    f()\nf()\n", "RecursionError", "RecursionError"),
    ]
    res = _page().evaluate("""async (cases) => {
        const { explain } = await import("/src/grade.js");
        const { ERRORS } = await import("/data/errors.js");
        const out = [];
        for (const [name, code] of cases) {
            const r = await window.runner.run(code, "", [], {});
            const e = r.error;
            const got = explain(e, "basic", { starterNames: [] });
            const keys = Object.keys(ERRORS).filter((k) => k !== "_default" && ERRORS[k].title.replace("{type}", e.type) === got.title);
            out.push({ name, type: e.type, msg: e.msg, keys });
        }
        const st = await window.runner.run("print(common)\\n", "", [], {});
        const sv = explain(st.error, "basic", { starterNames: ["common"] });
        return { out, starter: sv.title, starterBase: explain(st.error, "basic").title };
    }""", [[c[0], c[1]] for c in cases])
    for c, got in zip(cases, res["out"]):
        name, _code, typ, want = c
        print("    %-12s %s: %s -> %s" % (name, got["type"], got["msg"], got["keys"]))
        assert got["type"] == typ, got
        assert (want is None and got["keys"] in ([typ], [])) or got["keys"][:1] == [want], (name, got)
    assert res["starter"] != res["starterBase"] and "NameError" in res["starter"], res


TESTS = [test_cold_start_ms, test_hello, test_input_short, test_string_stdin, test_require,
         test_require_comment_elif_else_in_pyodide, test_require_selfcall_formatspec_triplestr_in_pyodide,
         test_require_namedgroup_listcomp_lambda_in_pyodide, test_require_reraise_in_pyodide,
         test_require_def_sql_in_pyodide, test_multiline_chart_in_pyodide,
         test_error_line, test_output_limit, test_isolation, test_files_in_pyodide,
         test_practice_server_in_pyodide, test_chart_in_pyodide, test_farm_in_pyodide,
         test_sqlite3_in_pyodide, test_lang_in_pyodide, test_error_variants_real_engine, test_guard_three_modes, test_queue, test_timeout_then_ok,
         test_status_phases, test_engine_crash_restart, test_queued_own_clock, test_ui_alive, test_no_page_errors,
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
