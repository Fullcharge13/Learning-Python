"""배포 빌드 시험 (계획 작업 10).

실행: python3 tests/build_test.py      (또는 python3 -m pytest tests/build_test.py -q)

1. 배포용 빌드(python3 build.py → dist/)를 검사한다.
   - dist/index.html에 <script src=·<link rel="stylesheet">가 없음(Pyodide는 작업자 안에서 동적으로 받음)
   - 압축 전 700KB 이하(판정 C28), 버전 문자열(src/app.js의 VERSION), 배포용 Pyodide 주소(C19)
   - manifest.webmanifest 필수 칸, 아이콘 PNG가 있고 크기가 맞음, sw.js
   - 빌드가 자기 파일만 지우고 새로 씀, docs/img/는 --update-docs-icons 때만 바뀜
   - node가 없으면 알아보기 쉬운 오류로 멈춤, app.js가 RIA_WORKER_URL을 안 읽으면 멈춤
2. 시험용 빌드(--dev-pyodide)를 로컬 서버로 열고 Chromium + "iPhone 17" 기기 설정으로 확인한다.
   - 첫 화면 → 「시작하기」 → 홈 화면, 콘솔 오류 0, Blob 작업자로 print(1)
   - sw.js 등록 → 오프라인 → 새로고침 → 홈 화면, 오프라인에서도 print(1)
   - Pyodide 주소가 막혀도 sw.js 설치는 끝나고, 오프라인 새로고침에 앱이 뜸
   - 서버가 느리면(8초) 4초 뒤 저장본으로 뜸
   - 내용이 바뀐 빌드 → 새 게임 저장본 이름, 활성화 뒤 옛 저장본은 지워짐
3. 장 따로 불러오기 (v0.3 작업 1)
   - index.html에 문제 문장·카드 글이 없음, 크기가 v0.2(651.8KB)보다 작음
   - lessons/chN-<지문8자>.json 6개 이상, 지문은 내용으로 정해짐(같은 내용 → 같은 이름·같은 바이트)
   - 온라인으로 한 번 연 뒤 오프라인 → 6장 레슨 열기·직접 작성 실행, 설정 「오프라인 준비 완료」
   - 장 파일 요청을 막음 → 안내와 「다시 시도」·「학습 길로」, 막기를 풀고 다시 시도 → 열림, 느리면 「준비 중」
   - 장 내용이 바뀐 빌드 → 옛 장 파일은 저장본·배포 폴더에서 사라짐
   - 복습은 review_queue 개념이 든 장만 받음
"""

import functools
import gzip
import hashlib
import http.server
import importlib.util
import json
import os
import re
import shutil
import socketserver
import struct
import subprocess
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_VERSION = re.search(r'VERSION = "(v[0-9.]+)"', open(os.path.join(ROOT, "src", "app.js"), encoding="utf-8").read()).group(1)

DIST = os.path.join(ROOT, "dist")
OUT = os.path.join(ROOT, "tests", "out")
DEV_OUT = os.path.join(OUT, "dist-dev")
CDN = "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/"
MAX_RAW = 700 * 1024
V02_RAW = 667397  # v0.2 dist/index.html (651.8 KB). v0.3부터 이보다 작아야 함
CHAPTER_FILE = re.compile(r"^ch(\d+)-([0-9a-f]{8})\.json$")
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
    assert APP_VERSION in html
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
    assert APP_VERSION in sw
    assert "NETWORK_TIMEOUT_MS = 4000" in sw


def test_sqlite3_in_precached_core():
    """v0.5: 16장 sqlite3가 오프라인에서 돌려면 그 파일이 sw.js가 미리 받는 Pyodide 핵심 파일 안에 있어야 한다.
    Pyodide 314.0.7: _sqlite3는 pyodide.asm.wasm에 내장, sqlite3 모듈은 python_stdlib.zip 안 → 따로 받을 꾸러미 없음.
    Pyodide를 올렸는데 sqlite3가 따로 받는 꾸러미가 되면 이 시험이 실패한다(그때는 worker.js에서 loadPackage를
    부르고 그 파일들을 sw.js PY_CORE와 offline.js PYODIDE_REQUIRED에 더해야 함)."""
    import zipfile
    pyo = os.path.join(ROOT, "node_modules", "pyodide")
    with open(os.path.join(pyo, "pyodide-lock.json"), encoding="utf-8") as f:
        lock = json.load(f)
    pkgs = {k for k, v in lock["packages"].items() if "sqlite3" in v.get("imports", []) or k in ("sqlite3", "_sqlite3")}
    assert not pkgs, "sqlite3 became a separate Pyodide package: %r" % pkgs
    names = zipfile.ZipFile(os.path.join(pyo, "python_stdlib.zip")).namelist()
    assert "sqlite3/__init__.py" in names and "sqlite3/dbapi2.py" in names
    _build()
    sw = _read(os.path.join(DIST, "sw.js"))
    core = json.loads(re.search(r"const PY_CORE = (\[[^\]]*\]);", sw).group(1))
    assert {"pyodide.asm.wasm", "python_stdlib.zip"} <= set(core), core
    offline = _read(os.path.join(ROOT, "src", "offline.js"))
    assert '"pyodide.asm.wasm"' in offline and '"python_stdlib.zip"' in offline


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
    STATE = {"block_pyodide": False, "slow_s": 0, "block_chapters": False, "slow_chapter_s": 0,
             "chapter_404": False, "block_names": (), "block_sw": False}
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
        if p.startswith("/lessons/") and self.STATE["block_chapters"]:
            self.close_connection = True  # 장 파일만 끊음(비행기 모드·막힌 망 흉내)
            return
        if p.startswith("/lessons/") and p.rsplit("/", 1)[-1] in self.STATE["block_names"]:
            self.close_connection = True  # 이 장 파일만 끊음
            return
        if p.startswith("/lessons/") and self.STATE["chapter_404"]:
            self.send_error(404)  # 새 판을 올려 옛 이름의 장 파일이 없어진 서버 흉내
            return
        if p == "/sw.js" and self.STATE["block_sw"]:
            self.send_error(404)  # 새 서비스 작업자 설치 실패 흉내
            return
        if p.startswith("/lessons/") and self.STATE["slow_chapter_s"]:
            time.sleep(self.STATE["slow_chapter_s"])
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

    def __init__(self, folder, service_workers="allow", init_save=None):
        from playwright.sync_api import sync_playwright
        _Handler.STATE.update(block_pyodide=False, slow_s=0, block_chapters=False, slow_chapter_s=0,
                              chapter_404=False, block_names=(), block_sw=False)
        self.httpd = _Server(("127.0.0.1", 0), functools.partial(_Handler, directory=folder))
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.url = "http://127.0.0.1:%d/" % self.httpd.server_address[1]
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch()
        device = {k: v for k, v in self.pw.devices["iPhone 17"].items() if k != "default_browser_type"}
        self.context = self.browser.new_context(service_workers=service_workers, **device)
        if init_save is not None:
            self.context.add_init_script("if (!sessionStorage.getItem('seeded')) { localStorage.setItem('ria-python.save', %s); sessionStorage.setItem('seeded', '1'); }"
                                         % json.dumps(json.dumps(init_save)))
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append("pageerror: " + str(e)))
        self.page.on("console", lambda m: self.errors.append("console.error: " + m.text) if m.type == "error" else None)

    def home(self):
        pg = self.page
        pg.wait_for_selector(".screen.splash #go", timeout=20_000)
        assert APP_VERSION in pg.inner_text(".screen.splash .ver")
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
        # v0.5: 16장 sqlite3와 17장 chart도 오프라인에서(sw 저장본만으로) 돈다
        sql = ("import sqlite3\ncon = sqlite3.connect(':memory:')\ncon.execute('CREATE TABLE t (n INTEGER)')\n"
               "con.execute('INSERT INTO t VALUES (7)')\nprint(con.execute('SELECT n * 6 FROM t').fetchone()[0])\n"
               "import chart\nchart.bar(['a'], [1])\nchart.show()\n")
        r = pg.evaluate("(c) => window.__ria.ctx.py.run(c)", sql)
        assert r["error"] is None and r["stdout"] == "42\n", r
        assert r["charts"] == [{"kind": "bar", "labels": ["a"], "values": [1]}], r
        print("    offline sqlite3 + chart: %r, %d chart" % (r["stdout"], len(r["charts"])))
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


# ---------------------------------------------------------------- 장 따로 불러오기 (v0.3 작업 1)

DUMP_LESSONS = r"""
const fs = await import("node:fs"); const path = await import("node:path"); const url = await import("node:url");
const dir = process.argv[1];
const out = {};
for (const f of fs.readdirSync(dir).filter((f) => /^ch\d+\.js$/.test(f))) {
  const m = await import(url.pathToFileURL(path.join(dir, f)).href);
  out[f] = { CHAPTER: m.CHAPTER, LESSONS: m.LESSONS };
}
process.stdout.write(JSON.stringify(out));
"""


def _source_lessons(folder=None):
    folder = folder or os.path.join(ROOT, "data", "lessons")
    r = subprocess.run(["node", "--input-type=module", "-e", DUMP_LESSONS, folder], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


SNAP = os.path.join(OUT, "lessons-snap")
SPLIT_OUT = os.path.join(OUT, "dist-split")


def _snapshot():
    """data/lessons를 한 번 복사해 둔다(다른 작업이 장 파일을 고치는 중이어도 시험끼리 같은 내용을 보게)"""
    if not _built.get("snap"):
        shutil.rmtree(SNAP, ignore_errors=True)
        shutil.copytree(os.path.join(ROOT, "data", "lessons"), SNAP)
        _built["snap"] = True
    return SNAP


def _lesson_texts():
    """index.html에 있으면 안 되는 글: 직접 작성 문제 문장, 카드 설명, 문제 해설"""
    texts = set()
    for mod in _source_lessons(_snapshot()).values():
        for l in mod["LESSONS"]:
            for c in l.get("cards", []):
                texts.add(c["say"])
            for it in l.get("items", []):
                for k in ("task", "explain"):
                    if it.get(k):
                        texts.add(it[k])
    return sorted(t for t in texts if len(t) >= 8)  # 아주 짧은 글은 앱 글자와 우연히 겹칠 수 있어 뺀다


DEV_SPLIT = os.path.join(OUT, "dist-dev-split")


def _dev_split():
    """장 따로 불러오기 브라우저 시험용 빌드: 스냅숏 내용, Pyodide는 /node_modules/"""
    _build("--dev-pyodide", "--out", DEV_SPLIT, "--lessons-dir", _snapshot())
    return DEV_SPLIT


def _chapter_table(html):
    m = re.search(r"window\.RIA_CHAPTER_FILES = (\{[^}]*\});", html)
    assert m, "RIA_CHAPTER_FILES table not in index.html"
    return {int(k): v for k, v in json.loads(m.group(1)).items()}


def _chapter_files(folder):
    d = os.path.join(folder, "lessons")
    return sorted(f for f in os.listdir(d) if CHAPTER_FILE.match(f)) if os.path.isdir(d) else []


def test_split_static():
    out = _build("--out", SPLIT_OUT, "--lessons-dir", _snapshot())
    DIST = SPLIT_OUT  # noqa: N806 (아래는 스냅숏으로 만든 빌드를 본다)
    html = _read(os.path.join(DIST, "index.html"))
    raw = len(html.encode("utf-8"))
    files = _chapter_files(DIST)
    print("    index.html %.1f KB (v0.2 %.1f KB); chapter files: %s" % (
        raw / 1024, V02_RAW / 1024,
        ", ".join("%s %.1f KB" % (f, os.path.getsize(os.path.join(DIST, "lessons", f)) / 1024) for f in files)))
    assert raw < V02_RAW, "index.html must be smaller than v0.2: %d >= %d" % (raw, V02_RAW)
    assert len(files) >= 6, files
    src = _source_lessons(_snapshot())
    table = _chapter_table(html)
    assert sorted(table.values()) == sorted("lessons/" + f for f in files), (table, files)
    for f in files:
        n, h = CHAPTER_FILE.match(f).groups()
        with open(os.path.join(DIST, "lessons", f), "rb") as fh:
            data = fh.read()
        assert hashlib.sha256(data).hexdigest()[:8] == h, "file name hash must come from content: " + f
        got = json.loads(data)
        assert got == src["ch%s.js" % n], "chapter file content differs from data/lessons/ch%s.js" % n
        assert table[int(n)] == "lessons/" + f
    leaked = [t for t in _lesson_texts() if t in html]
    assert not leaked, "lesson text found in index.html: %r" % leaked[:3]
    assert "lessons/" in out and "KB" in out


def test_split_deterministic():
    _build("--out", SPLIT_OUT, "--lessons-dir", _snapshot())
    other = os.path.join(OUT, "dist-det")
    r = _run_build("--out", other, "--lessons-dir", _snapshot())
    assert r.returncode == 0, r.stdout + r.stderr
    a, b = _chapter_files(SPLIT_OUT), _chapter_files(other)
    assert a == b, (a, b)
    for f in a:
        with open(os.path.join(SPLIT_OUT, "lessons", f), "rb") as x, open(os.path.join(other, "lessons", f), "rb") as y:
            assert x.read() == y.read(), f
    shutil.rmtree(other, ignore_errors=True)


def test_sw_chapter_files():
    _build("--out", SPLIT_OUT, "--lessons-dir", _snapshot())
    sw = _read(os.path.join(SPLIT_OUT, "sw.js"))
    files = _chapter_files(SPLIT_OUT)
    assert len(files) >= 6, files
    for f in files:
        assert '"lessons/%s"' % f in sw, "sw.js must precache " + f


def _flow_module():
    spec = importlib.util.spec_from_file_location("ria_flow", os.path.join(ROOT, "tests", "flow.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _driver(page):
    """flow.py의 레슨 풀기 도우미를 이 page에 빌려 씀"""
    App = _flow_module().App

    class Drv:
        def __init__(self, pg):
            self.page = pg
        js = App.js
        lesson = App.lesson
        which_item = App.which_item
        answer_touch = App.answer_touch
        wait_py = App.wait_py
        set_code = App.set_code
        submit_write = App.submit_write
        cont = App.cont
    return Drv(page)


def _play_to_write(d, lid):
    """lid 레슨을 직접 작성 문제까지 정답으로 풀고, 직접 작성을 정답으로 제출한다. 결과 창 클래스를 돌려줌."""
    items = d.lesson(lid)["items"]
    for _ in range(40):
        d.page.wait_for_timeout(80)
        if d.page.query_selector(".card-view"):
            d.page.click("#act")
            continue
        if d.page.query_selector(".item.write"):
            it = next(x for x in items if x["type"] == "write")
            d.submit_write(it["solution"])
            return d.page.get_attribute("#result", "class")
        if d.page.query_selector("article.item"):
            d.answer_touch(items[d.which_item(items)])
            d.page.wait_for_selector("#result:not([hidden])")
            d.cont()
    raise AssertionError("write item not reached in " + lid)


def _wait_chapters_cached(b, files, timeout=30):
    deadline = time.monotonic() + timeout
    while True:
        urls = b.cached_urls()
        missing = [f for f in files if not any(u.endswith("/" + f) for u in urls)]
        if not missing or time.monotonic() > deadline:
            return missing
        b.page.wait_for_timeout(200)


def test_offline_chapter_write():
    folder = _dev_split()
    b = _Browser(folder)
    try:
        pg = b.page
        pg.goto(b.url)
        b.home()
        b.wait_controlled()
        files = pg.evaluate("() => Object.values(window.RIA_CHAPTER_FILES)")
        assert len(files) >= 6, files
        missing = _wait_chapters_cached(b, files)
        assert not missing, "chapter files not precached: %r" % missing
        r = pg.evaluate("() => window.__ria.ctx.py.run('print(1)')")  # Pyodide 저장본 채우기
        assert r["stdout"] == "1\n", r
        b.context.set_offline(True)
        resp = pg.reload()
        assert resp is not None and resp.from_service_worker
        b.home()
        pg.evaluate("() => window.__ria.ctx.show('lesson', { id: '6-1' })")
        pg.wait_for_selector(".card-view", timeout=10_000)
        cls = _play_to_write(_driver(pg), "6-1")
        assert "ok" in (cls or ""), cls
        print("    offline: 6-1 opened from cached chapter file, write task passed")
        pg.evaluate("() => window.__ria.ctx.show('settings')")
        pg.wait_for_selector("#offline[data-ready]", timeout=10_000)
        assert pg.get_attribute("#offline", "data-ready") == "true", pg.inner_text("#offline")
        b.context.set_offline(False)
        assert not [e for e in b.errors if e.startswith("pageerror")], b.errors
    finally:
        b.close()


def test_chapter_blocked_retry():
    folder = _dev_split()
    b = _Browser(folder)
    try:
        pg = b.page
        _Handler.STATE["block_chapters"] = True
        pg.goto(b.url)
        b.home()
        b.wait_controlled()  # 장 파일을 못 받아도 설치는 끝남
        assert not [u for u in b.cached_urls() if "/lessons/" in u]
        pg.evaluate("() => window.__ria.ctx.show('lesson', { id: '2-1' })")
        pg.wait_for_selector(".lesson-wait[data-state=error]", timeout=15_000)
        txt = pg.inner_text(".lesson-wait")
        assert "이 장은 인터넷이 될 때 한 번 열어 주세요" in txt, txt
        assert pg.is_visible("#retry") and pg.is_visible("#to-home")
        pg.screenshot(path=os.path.join(OUT, "build_chapter_blocked.png"))
        pg.click("#to-home")
        pg.wait_for_selector("#app[data-screen=home] .screen.home")
        st = pg.evaluate("() => window.__ria.ctx.save.completed_lessons.length")
        assert st == 0
        pg.evaluate("() => window.__ria.ctx.show('lesson', { id: '2-1' })")
        pg.wait_for_selector(".lesson-wait[data-state=error]", timeout=15_000)
        pg.click("#retry")
        pg.wait_for_selector(".lesson-wait[data-state=error]", timeout=15_000)  # 아직 막힘 → 다시 안내
        _Handler.STATE["block_chapters"] = False
        pg.click("#retry")
        pg.wait_for_selector(".card-view", timeout=15_000)
        print("    blocked chapter: guidance shown, retry after unblocking opened 2-1")
        # 느린 장 파일: 0.3초 넘으면 「준비 중」
        _Handler.STATE["slow_chapter_s"] = 1.5
        pg.evaluate("() => window.__ria.ctx.show('lesson', { id: '3-1' })")
        pg.wait_for_selector(".lesson-wait[data-state=wait]:has-text('준비 중')", timeout=5_000)
        pg.wait_for_selector(".card-view", timeout=15_000)
        _Handler.STATE["slow_chapter_s"] = 0
        assert not [e for e in b.errors if e.startswith("pageerror")], b.errors
    finally:
        _Handler.STATE.update(block_chapters=False, slow_chapter_s=0)
        b.close()


def test_chapter_cache_rotation():
    folder = os.path.join(OUT, "dist-rotate-ch")
    alt = os.path.join(OUT, "lessons-alt")
    shutil.rmtree(alt, ignore_errors=True)
    shutil.copytree(_snapshot(), alt)
    p = os.path.join(alt, "ch1.js")
    src = _read(p)
    changed = re.sub(r'(export const CHAPTER = \{[^}]*title: ")', r"\1(시험판) ", src, count=1)
    assert changed != src
    with open(p, "w", encoding="utf-8") as f:
        f.write(changed)
    r = _run_build("--dev-pyodide", "--out", folder, "--lessons-dir", alt)
    assert r.returncode == 0, r.stdout + r.stderr
    old_files = _chapter_files(folder)
    b = _Browser(folder)
    try:
        b.page.goto(b.url)
        b.home()
        b.wait_controlled()
        old_table = b.page.evaluate("() => window.RIA_CHAPTER_FILES")
        assert not _wait_chapters_cached(b, list(old_table.values()))
        old_game = [k for k in b.cache_keys() if k.startswith("ria-game-")]
        r = _run_build("--dev-pyodide", "--out", folder, "--lessons-dir", _snapshot())
        assert r.returncode == 0, r.stdout + r.stderr
        new_files = _chapter_files(folder)
        gone = sorted(set(old_files) - set(new_files))
        assert len(gone) == 1 and gone[0].startswith("ch1-"), (old_files, new_files)
        assert not os.path.exists(os.path.join(folder, "lessons", gone[0])), "old chapter file left in out folder"
        b.page.evaluate("async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); }")
        deadline = time.monotonic() + 30
        while True:
            keys = [k for k in b.cache_keys() if k.startswith("ria-game-")]
            if (keys and old_game[0] not in keys) or time.monotonic() > deadline:
                break
            b.page.wait_for_timeout(200)
        urls = b.cached_urls()
        assert not [u for u in urls if u.endswith("/lessons/" + gone[0])], "old chapter file still cached"
        new_ch1 = next(f for f in new_files if f.startswith("ch1-"))
        assert [u for u in urls if u.endswith("/lessons/" + new_ch1)], "new chapter file not precached"
        print("    chapter rotation: %s -> %s, cache %s -> %s" % (gone[0], new_ch1, old_game[0], keys[0]))
    finally:
        b.close()
        shutil.rmtree(folder, ignore_errors=True)
        shutil.rmtree(alt, ignore_errors=True)


def test_review_lazy():
    folder = _dev_split()
    seed = {"saveVer": 1, "review_queue": ["slice", "def"], "completed_lessons": ["1-1"]}
    b = _Browser(folder, service_workers="block", init_save=seed)
    try:
        pg = b.page
        asked = []
        pg.on("request", lambda req: asked.append(req.url.rsplit("/", 1)[-1]) if "/lessons/" in req.url else None)
        pg.goto(b.url)
        b.home()
        table = pg.evaluate("() => window.RIA_CHAPTER_FILES")
        assert asked == [], "home must not load chapter files: %r" % asked
        pg.click("#review")
        pg.wait_for_selector("article.item", timeout=15_000)
        need = pg.evaluate("() => window.__ria.ctx.chaptersForConcepts(['slice', 'def'])")
        assert 0 < len(need) < len(table), need
        want = sorted(table[str(k)].rsplit("/", 1)[-1] for k in need)
        assert sorted(asked) == want, (asked, want)
        tag = pg.inner_text(".tag")
        m = re.match(r"^(\d+)-\d+ 복습$", tag.strip())
        assert m and int(m.group(1)) in need, tag
        n = pg.evaluate("() => document.querySelectorAll('.lesson-tag').length")
        assert n == 1
        print("    review: loaded only %s, first item tag %r" % (", ".join(asked), tag))
        assert not [e for e in b.errors if e.startswith("pageerror")], b.errors
    finally:
        b.close()


def _rotate_alt():
    """스냅숏을 복사해 ch1 제목만 바꾼 폴더(내용이 바뀐 판 흉내)"""
    alt = os.path.join(OUT, "lessons-alt2")
    shutil.rmtree(alt, ignore_errors=True)
    shutil.copytree(_snapshot(), alt)
    p = os.path.join(alt, "ch1.js")
    src = _read(p)
    with open(p, "w", encoding="utf-8") as f:
        f.write(re.sub(r'(export const CHAPTER = \{[^}]*title: ")', r"\1(시험판) ", src, count=1))
    return alt


def test_new_index_not_cached_without_new_sw():
    """새 판 index.html을 네트워크로 받아도, 새 서비스 작업자 설치가 실패하면 저장본은 옛 판 그대로여야 한다
    (새 index가 저장되면 오프라인에서 저장 안 된 새 장 파일을 찾다가 실패한다)."""
    folder = os.path.join(OUT, "dist-sw-fail")
    alt = _rotate_alt()
    r = _run_build("--dev-pyodide", "--out", folder, "--lessons-dir", alt)
    assert r.returncode == 0, r.stdout + r.stderr
    b = _Browser(folder)
    try:
        pg = b.page
        pg.goto(b.url)
        b.home()
        b.wait_controlled()
        assert not _wait_chapters_cached(b, list(pg.evaluate("() => window.RIA_CHAPTER_FILES").values()))
        r = _run_build("--dev-pyodide", "--out", folder, "--lessons-dir", _snapshot())
        assert r.returncode == 0, r.stdout + r.stderr
        _Handler.STATE["block_sw"] = True
        pg.reload()
        b.home()
        new_ch1 = pg.evaluate("() => window.RIA_CHAPTER_FILES['1']")
        assert new_ch1.rsplit("/", 1)[-1] in _chapter_files(folder), "online reload should show the new build"
        pg.wait_for_timeout(500)
        b.context.set_offline(True)
        pg.reload()
        b.home()
        pg.evaluate("() => window.__ria.ctx.show('lesson', { id: '1-1' })")
        pg.wait_for_selector(".card-view, .lesson-wait[data-state=error]", timeout=15_000)
        assert pg.query_selector(".card-view"), "offline launch after failed sw update cannot open 1-1: " + pg.inner_text("#app")
        print("    failed sw update: offline launch still uses a consistent cached build")
    finally:
        _Handler.STATE["block_sw"] = False
        b.close()
        shutil.rmtree(folder, ignore_errors=True)
        shutil.rmtree(alt, ignore_errors=True)


def test_chapter_wait_timeout():
    folder = _dev_split()
    b = _Browser(folder, service_workers="block")
    try:
        pg = b.page
        pg.goto(b.url)
        b.home()
        _Handler.STATE["slow_chapter_s"] = 60
        t0 = time.monotonic()
        pg.evaluate("() => window.__ria.ctx.show('lesson', { id: '2-1' })")
        pg.wait_for_selector(".lesson-wait[data-state=wait]:has-text('준비 중')", timeout=5_000)
        assert pg.is_visible("#to-home"), "waiting screen needs a way back"
        pg.wait_for_selector(".lesson-wait[data-state=error]", timeout=20_000)
        dt = time.monotonic() - t0
        print("    slow chapter (60 s): error screen after %.1f s" % dt)
        assert 11 <= dt < 16, dt
        _Handler.STATE["slow_chapter_s"] = 0
        pg.click("#to-home")
        pg.wait_for_selector("#app[data-screen=home] .screen.home")
        # 기다리는 중에도 학습 길로 나갈 수 있음
        _Handler.STATE["slow_chapter_s"] = 60
        pg.evaluate("() => window.__ria.ctx.show('lesson', { id: '3-1' })")
        pg.wait_for_selector(".lesson-wait[data-state=wait] #to-home", timeout=5_000)
        pg.click("#to-home")
        pg.wait_for_selector("#app[data-screen=home] .screen.home")
        assert not [e for e in b.errors if e.startswith("pageerror")], b.errors
    finally:
        _Handler.STATE["slow_chapter_s"] = 0
        b.close()


def test_chapter_404_reload():
    folder = _dev_split()
    b = _Browser(folder, service_workers="block")
    try:
        pg = b.page
        pg.goto(b.url)
        b.home()
        _Handler.STATE["chapter_404"] = True
        pg.evaluate("() => { window.__marker = 1; window.__ria.ctx.show('lesson', { id: '2-1' }); }")
        pg.wait_for_selector(".lesson-wait[data-state=error]", timeout=15_000)
        txt = pg.inner_text(".lesson-wait")
        assert "새 판이 나왔어요. 눌러서 새로 고쳐요" in txt, txt
        _Handler.STATE["chapter_404"] = False
        with pg.expect_navigation(timeout=15_000):
            pg.click("#retry")
        pg.wait_for_selector(".screen.splash #go", timeout=20_000)
        assert pg.evaluate("() => window.__marker") is None, "retry must reload the page"
        print("    404 chapter: new-version message, retry reloaded the page")
    finally:
        _Handler.STATE["chapter_404"] = False
        b.close()


def test_review_one_chapter_fails():
    folder = _dev_split()
    b = _Browser(folder, service_workers="block")
    try:
        pg = b.page
        pg.goto(b.url)
        b.home()
        # 두 장에서 그 장에만 있는 개념 하나씩
        pick = pg.evaluate("""() => {
            const ctx = window.__ria.ctx, out = [];
            for (const ch of ctx.chapters) {
                const c = ch.lessons.flatMap((l) => l.concepts).find((k) => ctx.chaptersForConcepts([k]).length === 1);
                if (c) out.push([ch.id, c]);
                if (out.length === 2) break;
            }
            return out;
        }""")
        assert len(pick) == 2, pick
        (bad_ch, bad_c), (good_ch, good_c) = pick
        table = pg.evaluate("() => window.RIA_CHAPTER_FILES")
        _Handler.STATE["block_names"] = (table[str(bad_ch)].rsplit("/", 1)[-1],)
        pg.evaluate("(q) => { const ctx = window.__ria.ctx; ctx.commit({ ...ctx.save, review_queue: q }); ctx.show('lesson', { review: true }); }",
                    [bad_c, good_c])
        pg.wait_for_selector("article.item, .lesson-wait[data-state=error]", timeout=15_000)
        assert pg.query_selector("article.item"), pg.inner_text("#app")
        tag = pg.inner_text(".tag").strip()
        assert tag.startswith("%d-" % good_ch), tag
        print("    review with chapter %d blocked: items from chapter %d (%s)" % (bad_ch, good_ch, tag))
        # 둘 다 막히면 안내
        _Handler.STATE["block_names"] = tuple(table[str(k)].rsplit("/", 1)[-1] for k in (bad_ch, good_ch))
        pg.reload()
        b.home()
        pg.evaluate("() => window.__ria.ctx.show('lesson', { review: true })")
        pg.wait_for_selector(".lesson-wait[data-state=error]", timeout=15_000)
        assert not [e for e in b.errors if e.startswith("pageerror")], b.errors
    finally:
        _Handler.STATE["block_names"] = ()
        b.close()



def test_third_party_notices():
    """판정 C43: 묶어 넣은 npm 꾸러미(MIT)의 저작권 표시를 licenses.txt로 함께 배포하고, 미리 받기·설정 링크에 넣는다."""
    _build()
    path = os.path.join(DIST, "licenses.txt")
    assert os.path.exists(path), "dist/licenses.txt missing"
    txt = _read(path)
    for pkg in ("@codemirror/view", "@codemirror/state", "@lezer/python", "@lezer/lr",
                "crelt", "style-mod", "w3c-keyname"):
        assert ("== %s " % pkg) in txt, pkg
    assert "Copyright (C) 2018-2021 by Marijn Haverbeke" in txt
    assert txt.count("Permission is hereby granted, free of charge") >= 8
    assert "pyodide" in txt.lower() and "MPL-2.0" in txt and "cdn.jsdelivr.net/npm/pyodide@" in txt
    assert "esbuild" not in txt, "build tool is not shipped, keep it out"
    sw = _read(os.path.join(DIST, "sw.js"))
    assert '"licenses.txt"' in sw, "licenses.txt must be precached for offline"
    html = _read(os.path.join(DIST, "index.html"))
    assert "licenses.txt" in html, "settings must link to licenses.txt"

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
