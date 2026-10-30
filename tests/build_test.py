"""배포 빌드 시험 (계획 작업 10).

실행: python3 tests/build_test.py      (또는 python3 -m pytest tests/build_test.py -q)

1. 배포용 빌드(python3 build.py → dist/)를 검사한다.
   - dist/index.html에 <script src=·<link rel="stylesheet">가 없음(Pyodide는 작업자 안에서 동적으로 받음)
   - 압축 전 700KB 이하(판정 C28), 버전 문자열 v0.1, 배포용 Pyodide 주소(C19)
   - manifest.webmanifest 필수 칸, 아이콘 PNG가 있고 크기가 맞음, sw.js
   - 빌드가 자기 파일만 지우고 새로 씀, docs/img/는 --update-docs-icons 때만 바뀜
   - node가 없으면 알아보기 쉬운 오류로 멈춤, app.js가 RIA_WORKER_URL을 안 읽으면 멈춤
2. 시험용 빌드(--dev-pyodide)를 로컬 서버로 열고 Chromium + "iPhone 17" 기기 설정으로 확인한다.
   - 첫 화면 → 「시작하기」 → 홈 화면, 콘솔 오류 0, Blob 작업자로 print(1)
   - sw.js 등록 → 오프라인 → 새로고침 → 홈 화면, 오프라인에서도 print(1)
   - Pyodide 주소가 막혀도 sw.js 설치는 끝나고, 오프라인 새로고침에 앱이 뜸
   - 서버가 느리면(8초) 4초 뒤 저장본으로 뜸
   - 내용이 바뀐 빌드 → 새 게임 저장본 이름, 활성화 뒤 옛 저장본은 지워짐
"""

import functools
import gzip
import http.server
import importlib.util
import json
import os
import shutil
import socketserver
import struct
import subprocess
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
OUT = os.path.join(ROOT, "tests", "out")
DEV_OUT = os.path.join(OUT, "dist-dev")
CDN = "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/"
MAX_RAW = 700 * 1024
ICON_SIZES = {"icons/icon-180.png": 180, "icons/icon-192.png": 192, "icons/icon-512.png": 512,
              "icons/icon-maskable-512.png": 512, "icons/apple-touch-icon.png": 180}
DOC_ICONS = ("icon-180.png", "icon-512.png", "icon-maskable-512.png")

_built = {}


def _run_build(*args, env=None):
    return subprocess.run([sys.executable, os.path.join(ROOT, "build.py"), *args],
                          cwd=ROOT, capture_output=True, text=True, env=env)


def _build(*args):
    if args not in _built:
        r = _run_build(*args)
        assert r.returncode == 0, "build.py failed:\n" + r.stdout + r.stderr
        _built[args] = r.stdout
    return _built[args]


def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    assert head[:8] == b"\x89PNG\r\n\x1a\n", path + " is not a PNG"
    return struct.unpack(">II", head[16:24])


def _build_module():
    spec = importlib.util.spec_from_file_location("ria_build", os.path.join(ROOT, "build.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------- 정적 검사

def test_html_static():
    out = _build()
    html = _read(os.path.join(DIST, "index.html"))
    raw = len(html.encode("utf-8"))
    gz = len(gzip.compress(html.encode("utf-8"), 9))
    print("    dist/index.html raw %.1f KB, gzip %.1f KB" % (raw / 1024, gz / 1024))
    print("    build.py: " + out.strip().replace("\n", "\n    build.py: "))
    assert "<script src=" not in html and "<script type=\"module\" src=" not in html
    assert 'rel="stylesheet"' not in html, "CSS must be inlined"
    assert raw <= MAX_RAW, "too big: %d bytes" % raw
    assert "v0.1" in html
    assert CDN in html, "deploy build must point Pyodide at the CDN (C19)"
    assert "/node_modules/" not in html
    assert "RIA_WORKER_URL" in html and "RIA_RUNNER_SRC" in html
    assert '<link rel="manifest" href="manifest.webmanifest">' in html
    assert 'rel="apple-touch-icon"' in html
    assert 'name="apple-mobile-web-app-capable"' in html


def test_manifest_and_icons():
    _build()
    with open(os.path.join(DIST, "manifest.webmanifest"), encoding="utf-8") as f:
        m = json.load(f)
    assert m["name"] == "리아와 파이썬!"
    assert m["short_name"] == "리아와 파이썬"
    assert m["lang"] == "ko"
    assert m["display"] == "standalone"
    assert m["start_url"] and m["scope"]
    for k in ("theme_color", "background_color"):
        assert m[k].startswith("#") and len(m[k]) == 7, (k, m[k])
    sizes = {i["sizes"] for i in m["icons"]}
    assert {"180x180", "192x192", "512x512"} <= sizes, sizes
    assert any("maskable" in i.get("purpose", "") for i in m["icons"])
    for i in m["icons"]:
        w, h = _png_size(os.path.join(DIST, i["src"]))
        assert "%dx%d" % (w, h) == i["sizes"], (i, w, h)
    for doc in DOC_ICONS:
        assert os.path.exists(os.path.join(ROOT, "docs", "img", doc)), doc
    for rel, px in ICON_SIZES.items():
        assert _png_size(os.path.join(DIST, rel)) == (px, px), rel


def test_sw_static():
    _build()
    sw = _read(os.path.join(DIST, "sw.js"))
    assert CDN in sw
    assert "__RIA_" not in sw, "placeholders left in sw.js"
    assert "v0.1" in sw
    assert "NETWORK_TIMEOUT_MS = 4000" in sw


def test_clean_and_docs_icons():
    out = os.path.join(OUT, "dist-clean")
    os.makedirs(os.path.join(out, "icons"), exist_ok=True)
    stale = os.path.join(out, "icons", "stale.png")
    keep = os.path.join(out, "notes.txt")
    for p in (stale, keep):
        with open(p, "w") as f:
            f.write("x")
    docs = [os.path.join(ROOT, "docs", "img", d) for d in DOC_ICONS]
    before = [os.stat(p).st_mtime_ns for p in docs]
    r = _run_build("--out", out)
    assert r.returncode == 0, r.stdout + r.stderr
    assert not os.path.exists(stale), "build must clear files it owns (icons/)"
    assert os.path.exists(keep), "build must not delete files it does not own"
    assert [os.stat(p).st_mtime_ns for p in docs] == before, "docs/img/ changed without --update-docs-icons"
    r = _run_build("--out", out, "--update-docs-icons")
    assert r.returncode == 0, r.stdout + r.stderr
    assert all(a != b for a, b in zip(before, [os.stat(p).st_mtime_ns for p in docs])), "docs icons not updated"


def test_node_missing():
    env = {**os.environ, "PATH": "/nonexistent"}
    r = _run_build("--out", os.path.join(OUT, "dist-nonode"), env=env)
    assert r.returncode != 0
    assert "node" in (r.stdout + r.stderr).lower() and "Traceback" not in r.stderr, r.stderr


def test_guards():
    b = _build_module()
    ok = "const py = new PyRun({ indexURL, workerURL: window.RIA_WORKER_URL, runnerSource: window.RIA_RUNNER_SRC });"
    b.check_app_hooks(ok)
    for bad in ("const py = new PyRun({ indexURL });", "new PyRun({ indexURL, workerURL: window.RIA_WORKER_URL })"):
        try:
            b.check_app_hooks(bad)
        except SystemExit as e:
            assert "RIA_" in str(e), e
        else:
            raise AssertionError("check_app_hooks accepted: " + bad)
    try:
        b.check_output('<head><link rel="stylesheet" href="style.css"></head>')
    except SystemExit as e:
        assert "stylesheet" in str(e), e
    else:
        raise AssertionError("check_output accepted a stylesheet link")
    try:
        b.check_output('<script type="module" src="app.js"></script>')
    except SystemExit as e:
        assert "script" in str(e), e
    else:
        raise AssertionError("check_output accepted <script src>")
    b.check_output("<style>a{}</style><script>1</script>")


# ---------------------------------------------------------------- 브라우저

class _Handler(http.server.SimpleHTTPRequestHandler):
    """dist-dev와 /node_modules/를 함께 준다. 시험이 STATE로 네트워크 상태를 흉내 낸다."""
    STATE = {"block_pyodide": False, "slow_s": 0}
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
        ".json": "application/json", ".webmanifest": "application/manifest+json",
        ".zip": "application/zip",
    }

    def do_GET(self):
        p = self.path.split("?")[0]
        if p.startswith("/node_modules/pyodide/") and self.STATE["block_pyodide"]:
            self.close_connection = True  # 답 없이 끊음(막힌 CDN 흉내)
            return
        if p in ("/", "/index.html") and self.STATE["slow_s"]:
            time.sleep(self.STATE["slow_s"])
        try:
            return super().do_GET()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def translate_path(self, path):
        p = path.split("?")[0]
        if p.startswith("/node_modules/"):
            return os.path.join(ROOT, *p.lstrip("/").split("/"))
        return super().translate_path(path)

    def end_headers(self):
        # 브라우저 HTTP 저장본을 막아, 오프라인에서 뜨는 것이 서비스 작업자 저장본 덕분인지 확인한다.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


class _Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class _Browser:
    """빌드 폴더 하나를 새 서버·새 브라우저 문맥으로 연다(서비스 작업자가 시험끼리 섞이지 않게)."""

    def __init__(self, folder):
        from playwright.sync_api import sync_playwright
        _Handler.STATE.update(block_pyodide=False, slow_s=0)
        self.httpd = _Server(("127.0.0.1", 0), functools.partial(_Handler, directory=folder))
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.url = "http://127.0.0.1:%d/" % self.httpd.server_address[1]
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch()
        device = {k: v for k, v in self.pw.devices["iPhone 17"].items() if k != "default_browser_type"}
        self.context = self.browser.new_context(**device)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append("pageerror: " + str(e)))
        self.page.on("console", lambda m: self.errors.append("console.error: " + m.text) if m.type == "error" else None)

    def home(self):
        pg = self.page
        pg.wait_for_selector(".screen.splash #go", timeout=20_000)
        assert "v0.1" in pg.inner_text(".screen.splash .ver")
        pg.click("#go")
        pg.wait_for_selector("#app[data-screen=home]", timeout=10_000)

    def wait_controlled(self):
        self.page.wait_for_function("() => navigator.serviceWorker && navigator.serviceWorker.controller",
                                    timeout=30_000)

    def cache_keys(self):
        return self.page.evaluate("async () => (await caches.keys()).sort()")

    def cached_urls(self):
        return self.page.evaluate("""async () => {
            const out = [];
            for (const k of await caches.keys()) {
                const c = await caches.open(k);
                for (const req of await c.keys()) out.push(req.url);
            }
            return out;
        }""")

    def close(self):
        try:
            self.browser.close()
            self.pw.stop()
        finally:
            self.httpd.shutdown()


def test_browser_offline():
    _build("--dev-pyodide", "--out", DEV_OUT)
    b = _Browser(DEV_OUT)
    try:
        pg = b.page
        # 1) 온라인: 홈 화면, Blob 작업자로 print(1)
        pg.goto(b.url)
        b.home()
        info = pg.evaluate("() => ({ worker: String(window.__ria.ctx.py.workerURL), idx: window.__ria.ctx.py.indexURL })")
        assert info["worker"].startswith("blob:"), info
        assert info["idx"] == b.url + "node_modules/pyodide/", info
        r = pg.evaluate("() => window.__ria.ctx.py.run('print(1)')")
        assert r["stdout"] == "1\n" and r["error"] is None, r
        print("    online print(1): %r in %.0f ms" % (r["stdout"], r["ms"]))

        # 2) 서비스 작업자가 이 페이지를 통제할 때까지
        b.wait_controlled()
        cached = b.cached_urls()
        assert any(u.endswith("/index.html") or u == b.url for u in cached), cached
        assert any("pyodide.asm.wasm" in u for u in cached), "Pyodide files not cached: %r" % cached
        print("    cached entries: %d (game + Pyodide)" % len(cached))

        # 3) 오프라인 → 새로고침 → 홈 화면, print(1)
        b.context.set_offline(True)
        resp = pg.reload()
        assert resp is not None and resp.from_service_worker, "offline page not served by sw.js"
        b.home()
        r = pg.evaluate("() => window.__ria.ctx.py.run('print(1)')")
        assert r["stdout"] == "1\n" and r["error"] is None, r
        print("    offline reload: home OK, print(1): %r" % r["stdout"])
        b.context.set_offline(False)
        pg.screenshot(path=os.path.join(OUT, "build_offline_home.png"))
        assert b.errors == [], b.errors
    finally:
        b.close()


def test_blocked_pyodide_install():
    _build("--dev-pyodide", "--out", DEV_OUT)
    b = _Browser(DEV_OUT)
    try:
        _Handler.STATE["block_pyodide"] = True
        b.page.goto(b.url)
        b.home()
        b.wait_controlled()  # 설치·활성화가 Pyodide 실패에 막히지 않음
        cached = b.cached_urls()
        assert not any("pyodide" in u for u in cached), cached
        assert any(u.endswith("/index.html") for u in cached), cached
        b.context.set_offline(True)
        resp = b.page.reload()
        assert resp is not None and resp.from_service_worker
        b.home()
        st = b.page.evaluate("() => window.__ria.ctx.pyState().status")
        print("    blocked CDN: sw installed, %d game files cached, offline home OK (python status: %s)"
              % (len(cached), st))
        assert not [e for e in b.errors if e.startswith("pageerror")], b.errors
    finally:
        _Handler.STATE["block_pyodide"] = False
        b.close()


def test_slow_network_falls_back():
    _build("--dev-pyodide", "--out", DEV_OUT)
    b = _Browser(DEV_OUT)
    try:
        b.page.goto(b.url)
        b.home()
        b.wait_controlled()
        _Handler.STATE["slow_s"] = 8
        t0 = time.monotonic()
        resp = b.page.reload(timeout=20_000)
        b.page.wait_for_selector(".screen.splash #go", timeout=20_000)
        dt = time.monotonic() - t0
        print("    slow server (8 s): page shown after %.1f s" % dt)
        assert resp is not None and resp.from_service_worker
        assert 3.5 <= dt < 7.0, dt
    finally:
        _Handler.STATE["slow_s"] = 0
        b.close()


def test_cache_rotation():
    folder = os.path.join(OUT, "dist-rotate")
    r = _run_build("--dev-pyodide", "--out", folder, "--build-id", "A")
    assert r.returncode == 0, r.stdout + r.stderr
    b = _Browser(folder)
    try:
        b.page.goto(b.url)
        b.home()
        b.wait_controlled()
        old = [k for k in b.cache_keys() if k.startswith("ria-game-")]
        assert len(old) == 1, old
        r = _run_build("--dev-pyodide", "--out", folder, "--build-id", "B")
        assert r.returncode == 0, r.stdout + r.stderr
        b.page.evaluate("async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); }")
        # wait_for_function은 async 판정을 기다리지 않으므로 직접 되풀이해 본다
        deadline = time.monotonic() + 30
        while True:
            new = [k for k in b.cache_keys() if k.startswith("ria-game-")]
            if old[0] not in new and new or time.monotonic() > deadline:
                break
            b.page.wait_for_timeout(200)
        print("    cache rotation: %s -> %s" % (old[0], new[0]))
        assert len(new) == 1 and new[0] != old[0], (old, new)
    finally:
        b.close()
        shutil.rmtree(folder, ignore_errors=True)


def main():
    tests = [(n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)]
    fails = 0
    for name, f in tests:
        try:
            f()
            print("PASS", name)
        except Exception as e:  # noqa: BLE001
            fails += 1
            print("FAIL", name, "-", type(e).__name__, str(e)[:2000])
    print("%d passed, %d failed" % (len(tests) - fails, fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
