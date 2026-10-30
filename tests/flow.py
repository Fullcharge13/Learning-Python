"""화면 순회 시험 (계획 작업 11).

실행: python3 tests/flow.py            (또는 python3 -m pytest tests/flow.py -q)

- 배포와 같은 한 장짜리 HTML을 시험용으로 빌드한다
  (python3 build.py --dev-pyodide --out tests/out/flow/dist, Pyodide는 /node_modules/pyodide/에서).
- 실행 기록 C2: WebKit이 없어 Chromium에 Playwright 기기 설정("iPhone 17" 등)을 적용한다.
  사파리 고유 동작(실제 키보드, 홈 화면 추가, 저장 7일 규칙)은 실기기 확인 목록에서 본다.
- 캡처: tests/out/flow/*.png

시험
- test_no_overflow: 화면 9개 × 기기 4종 — 가로 스크롤 0, 화면 밖 버튼 0, 콘솔 오류 0
- test_first_lesson: 새 저장 → 1-1 전부 정답 → 완료 화면 XP +20, completed_lessons ["1-1"]
- test_run_button_visible_with_keyboard: 화면 높이 336px 줄임(키보드 흉내) → 실행·제출·기호 줄이 화면 안
- test_touch_targets: 화면마다 보이는 버튼·입력 44×44 CSS px 이상
- test_old_save: saveVer 없는 {xp: 30} → 홈 정상, XP 30
- test_replay_and_exam: 1-1 다시 하기 XP +10·레슨 바이트 0 / 1-1~1-4 끝낸 저장에서 1-5 평가 XP 40
- test_wrong_then_retry: 한 문제 틀림 → 본 문제 끝에 다시 나옴 → 완료 화면은 실수 없음 아님
- test_timeout_recovery: while True: pass → 시간 초과 설명 → 다음 실행은 정상 출력
- test_reduced_motion: 동작 줄이기에서 리아 .ria-body 움직임 없음
- test_status_after_milestone: 연속 6일(어제 달성) → 레슨 완료로 7일 축하 창이 떠 있는 동안 상태 줄 7일
"""

import atexit
import datetime
import functools
import http.server
import json
import os
import socketserver
import subprocess
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tests", "out", "flow")
DIST = os.path.join(OUT, "dist")
SAVE_KEY = "ria-python.save"
GUARD_WAIT = 450          # 결과 창 입력 보호(400ms)보다 조금 길게
PY_READY_MS = 120_000

DEVICES = ["iPhone 17", "iPhone 17e", "iPhone 17 Pro Max", "PC 1280x800"]
SCREENS = ["splash", "home", "lesson-card", "touch-item", "write", "done", "badges", "closet", "settings"]

# 터치 영역 예외(근거가 있는 것만). 비어 있으면 예외 없음.
TOUCH_EXCEPTIONS = {}


# ---------------------------------------------------------------- 서버·브라우저

class _Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
        ".json": "application/json", ".webmanifest": "application/manifest+json",
        ".zip": "application/zip",
    }

    def translate_path(self, path):
        p = path.split("?")[0]
        if p.startswith("/node_modules/"):
            return os.path.join(ROOT, *p.lstrip("/").split("/"))
        return super().translate_path(path)

    def log_message(self, *a):
        pass


class _Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        # 창을 닫을 때 끊긴 Pyodide 내려받기(ConnectionResetError 등)는 시험과 무관
        if not isinstance(sys.exc_info()[1], (ConnectionError, BrokenPipeError)):
            super().handle_error(request, client_address)


_env = {}


def env():
    """빌드 한 번 + 서버 + Chromium 하나를 시험 전체가 같이 쓴다."""
    if _env:
        return _env
    os.makedirs(OUT, exist_ok=True)
    r = subprocess.run([sys.executable, os.path.join(ROOT, "build.py"), "--dev-pyodide", "--no-icons", "--out", DIST],
                       cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:  # 아이콘이 아직 없을 때 등
        r = subprocess.run([sys.executable, os.path.join(ROOT, "build.py"), "--dev-pyodide", "--out", DIST],
                           cwd=ROOT, capture_output=True, text=True)
    assert r.returncode == 0, "build.py failed:\n" + r.stdout + r.stderr
    httpd = _Server(("127.0.0.1", 0), functools.partial(_Handler, directory=DIST))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    browser = pw.chromium.launch()
    _env.update(httpd=httpd, pw=pw, browser=browser, url="http://127.0.0.1:%d/" % httpd.server_address[1],
                build=r.stdout.strip())

    def stop():
        try:
            browser.close()
            pw.stop()
        finally:
            httpd.shutdown()
    atexit.register(stop)
    return _env


def device_opts(name):
    if name.startswith("PC"):
        return {"viewport": {"width": 1280, "height": 800}}
    d = dict(env()["pw"].devices[name])
    d.pop("default_browser_type", None)
    return d


def slug(name):
    return name.lower().replace(" ", "-")


def today(n=0):
    return (datetime.date.today() - datetime.timedelta(days=n)).isoformat()


class App:
    """기기 하나 + 새 저장소의 앱 한 판."""

    def __init__(self, device="iPhone 17", save=None, reduced=False):
        e = env()
        opts = device_opts(device)
        if reduced:
            opts["reduced_motion"] = "reduce"
        # sw.js가 옛 빌드를 저장해 두지 않도록 서비스 작업자는 막는다(오프라인은 build_test.py가 시험)
        self.context = e["browser"].new_context(service_workers="block", **opts)
        self.page = self.context.new_page()
        self.device = device
        self.errors = []
        self.page.on("pageerror", lambda x: self.errors.append("pageerror: " + str(x)))
        self.page.on("console", lambda m: self.errors.append("console.error: " + m.text) if m.type == "error" else None)
        if save is not None:
            self.page.add_init_script(
                "if (!sessionStorage.getItem('flow-seeded')) { localStorage.setItem(%s, %s); sessionStorage.setItem('flow-seeded', '1'); }"
                % (json.dumps(SAVE_KEY), json.dumps(json.dumps(save))))
        self.page.goto(e["url"])
        self.page.wait_for_selector(".screen.splash #go", timeout=20_000)

    def close(self):
        self.context.close()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()

    # -- 공용 동작 --
    def shot(self, name, full=False):
        path = os.path.join(OUT, name)
        self.page.screenshot(path=path, full_page=full)
        return path

    def js(self, expr, arg=None):
        return self.page.evaluate(expr, arg)

    def save(self):
        return self.js("() => JSON.parse(localStorage.getItem(%s))" % json.dumps(SAVE_KEY))

    def dismiss(self):
        """홈 화면 추가 안내(iOS 사파리 흉내 UA라서 뜰 수 있음)·확인되지 않은 창을 닫는다. 닫은 이름 목록."""
        closed = []
        for _ in range(3):
            if self.page.is_visible("#ins-ok"):
                self.page.wait_for_timeout(100)
                self.page.click("#ins-ok")
                self.page.wait_for_selector(".modal.install", state="detached")
                closed.append("install")
                continue
            break
        return closed

    def start(self):
        self.page.click("#go")
        self.page.wait_for_selector("#app[data-screen=home] .screen.home")
        self.page.wait_for_timeout(200)
        self.dismiss()

    def lesson(self, lid):
        # 레슨 목록(index.html)에는 문제가 없어 장 파일에서 받는다(v0.3 작업 1)
        return self.js("(id) => window.__ria.ctx.getLesson(id)", lid)

    def wait_py(self):
        self.page.wait_for_function("() => window.__ria.app.pyStatus === 'ready'", timeout=PY_READY_MS)

    def set_code(self, code):
        self.page.click(".cm-content")
        self.page.keyboard.press("Control+a")
        self.page.keyboard.press("Delete")
        self.page.keyboard.insert_text(code)
        got = self.js("() => [...document.querySelectorAll('.cm-content .cm-line')].map(e => e.textContent).join('\\n')")
        assert got == code, "editor content %r != %r" % (got, code)

    def which_item(self, items):
        """지금 화면의 문제가 레슨 items의 몇 번인지 (보기 순서가 섞여 있어도 글자 묶음으로 찾음)"""
        if self.page.query_selector(".item.write"):
            return next(i for i, x in enumerate(items) if x["type"] == "write")
        norm = lambda v: " ".join(str(v or "").split())
        q = self.page.inner_text("h1.q")
        shown = sorted(t.strip() for t in self.page.eval_on_selector_all(
            ".opt .opt-text, .chip, #op .line", "es => es.map(e => e.innerText)"))
        code = self.page.eval_on_selector_all("article.item > pre.code", "es => es.map(e => e.innerText).join('')")

        def keyset(x):
            return sorted(x.get("options") or x.get("chips") or x.get("lines") or [])
        cands = [i for i, x in enumerate(items) if x["type"] != "write" and norm(x.get("q")) == norm(q) and keyset(x) == shown]
        if len(cands) > 1:
            cands = [i for i in cands if norm(items[i].get("code")) == norm(code)] or cands
        assert cands, "unknown item on screen: %r %r" % (q, shown)
        return cands[0]

    def answer_touch(self, it, correct=True):
        t = it["type"]
        if t in ("choice", "check"):
            right = it["options"][it["answer"]]
            target = right if correct else next(o for o in it["options"] if o != right)
            for b in self.page.query_selector_all(".opt"):
                if b.query_selector(".opt-text").inner_text().strip() == target:
                    b.click()
                    break
        elif t == "blank":
            right = it["chips"][it["answer"]]
            target = right if correct else next(c for c in it["chips"] if c != right)
            for b in self.page.query_selector_all(".chip"):
                if b.inner_text().strip() == target:
                    b.click()
                    break
        elif t == "order":
            lines = list(it["lines"]) if correct else list(reversed(it["lines"]))
            for line in lines:
                for b in self.page.query_selector_all("#op .line:not([disabled])"):
                    if b.inner_text().strip() == line:
                        b.click()
                        break
        self.page.click("#act")

    def submit_write(self, code):
        self.page.wait_for_selector(".cm-content")
        self.wait_py()
        self.set_code(code)
        self.page.click("#submit")
        try:
            self.page.wait_for_selector("#result:not([hidden])", timeout=30_000)
        except Exception:
            raise AssertionError("write not accepted, console: " + self.page.inner_text("#console"))

    def cont(self):
        """결과 창의 「계속」 (입력 보호 시간 뒤)"""
        ok = "ok" in (self.page.get_attribute("#result", "class") or "")
        self.page.wait_for_timeout(GUARD_WAIT)
        self.page.click("#cont")
        return ok

    def play(self, lid, wrong=(), hook=None):
        """레슨 lid를 끝까지 푼다. wrong: 처음 한 번 틀릴 문제 번호들. hook(name, app): 화면별로 부름.
        돌려줌: 본 문제 순서 ["0", "1", ..., "0r", ...]"""
        items = self.lesson(lid)["items"]
        seq = []
        wrong_left = set(wrong)
        first_card = first_touch = True
        for _ in range(60):
            self.page.wait_for_timeout(80)
            if self.page.query_selector(".screen.done"):
                break
            if self.page.query_selector(".card-view"):
                if first_card and hook:
                    hook("lesson-card", self)
                first_card = False
                self.page.click("#act")
                continue
            if not self.page.query_selector("article.item"):
                continue
            idx = self.which_item(items)
            retry = self.page.query_selector(".tag.retry") is not None
            seq.append(str(idx) + ("r" if retry else ""))
            it = items[idx]
            bad = False
            if it["type"] == "write":
                self.page.wait_for_selector(".cm-content")
                if hook:
                    hook("write", self)
                self.submit_write(it["solution"])
            else:
                if first_touch and hook:
                    hook("touch-item", self)
                first_touch = False
                bad = idx in wrong_left
                wrong_left.discard(idx)
                self.answer_touch(it, correct=not bad)
                self.page.wait_for_selector("#result:not([hidden])")
            ok = self.cont()
            assert ok == (not bad), "item %d (%s) judged ok=%s, expected %s" % (idx, it["type"], ok, not bad)
        self.page.wait_for_selector(".screen.done", timeout=10_000)
        self.page.wait_for_timeout(300)
        return seq

    def result(self):
        return self.js("() => window.__ria.app.params && window.__ria.app.params.result")


# ---------------------------------------------------------------- 화면 측정

MEASURE_JS = r"""() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const sel = 'button, a[href], input:not([type=hidden]), select, textarea, label.btn, [role=button], [role=radio], [role=switch], [role=tab]';
  const items = [];
  for (const e of document.querySelectorAll(sel)) {
    if (e.closest('[hidden]')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;          // .sr로 숨긴 파일 입력 등
    let fixed = false, scroller = false;
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.position === 'fixed' || ps.position === 'sticky') fixed = true;
      if (p !== e && /(auto|scroll)/.test(ps.overflowX) && p.scrollWidth > p.clientWidth + 1) scroller = true;
    }
    const text = (e.getAttribute('aria-label') || e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    const name = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].join('.') : '') + ' "' + text + '"';
    items.push({ name, l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, fixed, scroller });
  }
  return { vw, vh, sw: document.documentElement.scrollWidth, bsw: document.body.scrollWidth, items };
}"""


def measure(app, screen):
    m = app.js(MEASURE_JS)
    problems = []
    if max(m["sw"], m["bsw"]) > m["vw"]:
        problems.append("horizontal scroll: scrollWidth %d > %d" % (max(m["sw"], m["bsw"]), m["vw"]))
    # 가로 스크롤을 시도해서 실제로 움직이는지도 확인
    sx = app.js("() => { window.scrollTo(200, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x; }")
    if sx:
        problems.append("page scrolls horizontally by %dpx" % sx)
    offscreen, small, scrolled = [], [], []
    for it in m["items"]:
        out_h = it["l"] < -1 or it["r"] > m["vw"] + 1
        out_v = it["fixed"] and (it["t"] < -1 or it["b"] > m["vh"] + 1)
        if out_h or out_v:
            (scrolled if it["scroller"] and not out_v else offscreen).append(
                "%s [%d,%d..%d,%d]" % (it["name"], it["l"], it["t"], it["r"], it["b"]))
        if (it["w"] < 43.5 or it["h"] < 43.5) and it["name"] not in TOUCH_EXCEPTIONS:
            small.append("%s %dx%d" % (it["name"], round(it["w"]), round(it["h"])))
    problems += ["offscreen: " + x for x in offscreen]
    return {"screen": screen, "problems": problems, "small": small, "in_scroller": scrolled,
            "errors": list(app.errors), "count": len(m["items"])}


_traversals = {}


def traverse(device):
    """새 저장으로 9개 화면을 차례로 열어 측정하고 캡처한다(기기마다 한 번, 결과는 다시 씀)."""
    if device in _traversals:
        return _traversals[device]
    res = {}
    tag = slug(device)
    with App(device) as a:
        def at(name, app, full=False):
            app.page.wait_for_timeout(150)
            res[name] = measure(app, name)
            app.shot("%s-%s.png" % (tag, name), full=full)
            app.errors.clear()

        at("splash", a)
        a.start()
        at("home", a)
        a.page.click("#continue")
        a.page.wait_for_selector(".screen.lesson")
        a.play("1-1", hook=lambda n, app: at(n, app))
        if a.page.is_visible("#ins-ok"):
            at("install-sheet", a)
            a.dismiss()
        at("done", a, full=False)
        a.page.click("#home")
        a.page.wait_for_selector(".screen.home")
        if a.page.is_visible("#ins-ok"):
            at("install-sheet", a)
            a.dismiss()
        for name in ("badges", "closet", "settings"):
            a.page.click('[data-go="%s"]' % name)
            a.page.wait_for_selector(".screen.%s" % name)
            at(name, a)
        res["_errors_left"] = list(a.errors)
    _traversals[device] = res
    return res


# ---------------------------------------------------------------- 시험

def test_no_overflow():
    fails = []
    for dev in DEVICES:
        res = traverse(dev)
        missing = [s for s in SCREENS if s not in res]
        if missing:
            fails.append("%s: screens not reached %s" % (dev, missing))
        for s, r in res.items():
            if s.startswith("_"):
                if r:
                    fails.append("%s: console errors %s" % (dev, r))
                continue
            for p in r["problems"]:
                fails.append("%s/%s: %s" % (dev, s, p))
            for e in r["errors"]:
                fails.append("%s/%s: %s" % (dev, s, e))
            if r["in_scroller"]:
                print("    note %s/%s: inside horizontal scroller (partly hidden by design): %s" % (dev, s, r["in_scroller"]))
        print("    %s: %s" % (dev, ", ".join("%s(%d)" % (s, r["count"]) for s, r in res.items() if not s.startswith("_"))))
    assert not fails, "\n".join(fails)


def test_touch_targets():
    fails = []
    for dev in DEVICES:
        res = traverse(dev)
        for s, r in res.items():
            if not s.startswith("_") and r["small"]:
                fails.append("%s/%s: %s" % (dev, s, "; ".join(r["small"])))
    assert not fails, "touch targets < 44x44:\n" + "\n".join(fails)


def test_first_lesson():
    with App("iPhone 17") as a:
        a.start()
        assert "첫 레슨 시작" in a.page.inner_text("#continue")
        a.page.click("#continue")
        seq = a.play("1-1")
        assert seq == ["0", "1", "2", "3", "4", "5", "6"], seq
        xp_tile = a.page.inner_text(".tile.xp b")
        a.shot("first-lesson-done.png", full=True)
        r = a.result()
        s = a.save()
        print("    done tiles: %s | result xp=%s bytes=%s perfect=%s hintfree=%s" % (
            a.page.inner_text(".tiles").replace("\n", " "), r["xp"], r["totalBytes"], r["perfect"], r["hintFreeWrite"]))
        assert xp_tile == "+20", xp_tile
        assert r["xp"] == 20 and r["perfect"] and r["hintFreeWrite"] and r["firstTime"], r
        assert s["completed_lessons"] == ["1-1"], s["completed_lessons"]
        assert s["xp"] == 20, s["xp"]
        a.dismiss()
        assert not a.errors, a.errors


def _to_write(a, lid="1-1"):
    """lid 레슨을 직접 작성 문제까지 진행"""
    items = a.lesson(lid)["items"]
    for _ in range(40):
        a.page.wait_for_timeout(80)
        if a.page.query_selector(".item.write .cm-content"):
            return
        if a.page.query_selector(".card-view"):
            a.page.click("#act")
            continue
        if a.page.query_selector("article.item"):
            a.answer_touch(items[a.which_item(items)])
            a.page.wait_for_selector("#result:not([hidden])")
            a.cont()
    raise AssertionError("write item not reached")


def test_run_button_visible_with_keyboard():
    fails = []
    for dev in ("iPhone 17", "iPhone 17e"):
        with App(dev) as a:
            a.start()
            a.page.click("#continue")
            _to_write(a)
            a.wait_py()
            a.page.click(".cm-content")
            a.page.keyboard.type("print(1)")
            vp = a.page.viewport_size
            a.page.set_viewport_size({"width": vp["width"], "height": vp["height"] - 336})
            a.page.wait_for_timeout(400)
            a.page.keyboard.type(" ")       # 입력하면 커서가 보이도록 스크롤되는지
            a.page.wait_for_timeout(300)
            v = a.js("""() => { const h = innerHeight, w = innerWidth;
              const r = s => { const e = document.querySelector(s).getBoundingClientRect(); return [Math.round(e.left), Math.round(e.top), Math.round(e.right), Math.round(e.bottom)]; };
              const caret = document.querySelector('.cm-activeLine') ? r('.cm-activeLine') : null;
              const head = document.querySelector('.lesson-top').getBoundingClientRect().bottom;
              return { w, h, run: r('#run'), submit: r('#submit'), sym: r('.symbols'), dockTop: Math.round(document.querySelector('#foot').getBoundingClientRect().top), headBottom: Math.round(head), caret, focused: !!document.activeElement.closest('.cm-editor') }; }""")
            a.shot("keyboard-%s.png" % slug(dev))
            print("    %s keyboard sim: %s" % (dev, v))
            for k in ("run", "submit", "sym"):
                l, t, r, b = v[k]
                if t < 0 or b > v["h"] or l < 0 or r > v["w"]:
                    fails.append("%s: %s outside viewport %s (viewport %dx%d)" % (dev, k, v[k], v["w"], v["h"]))
            if not v["focused"]:
                fails.append("%s: editor lost focus" % dev)
            # 쓰고 있는 줄이 아래 줄(기호·실행)이나 머리 줄에 가려지지 않아야 함 (검토 중점 #5)
            c = v["caret"]
            if not c or c[1] < v["headBottom"] or c[3] > v["dockTop"]:
                fails.append("%s: editing line %s hidden (visible band %d..%d, header bottom / dock top)" % (
                    dev, c, v["headBottom"], v["dockTop"]))
            a.page.keyboard.press("Backspace")
            # 실행이 실제로 눌리는지
            a.page.click("#run")
            a.page.wait_for_selector(".console .out", timeout=20_000)
            if a.page.inner_text(".console .out").strip() != "1":
                fails.append("%s: run output %r" % (dev, a.page.inner_text(".console .out")))
            if a.errors:
                fails.append("%s: %s" % (dev, a.errors))
    assert not fails, "\n".join(fails)


def test_old_save():
    with App("iPhone 17", save={"xp": 30}) as a:
        a.start()
        xp = a.page.inner_text(".status .stat.xp b")
        s = a.save()
        a.shot("old-save-home.png")
        assert xp == "30", xp
        assert s["saveVer"] == 1 and s["xp"] == 30 and s["bytes"] == 0, s
        assert a.page.is_visible("#continue")
        assert not a.errors, a.errors


def test_replay_and_exam():
    # 1) 1-1 첫 완료 → 다시 하기
    with App("iPhone 17") as a:
        a.start()
        a.page.click("#continue")
        a.play("1-1")
        first = a.result()
        assert first["xp"] == 20, first
        a.dismiss()
        a.page.click("#home")
        a.page.wait_for_selector(".screen.home")
        a.dismiss()
        before = a.save()
        a.page.click('[data-lesson="1-1"]')
        a.page.wait_for_selector(".modal .btn.primary")
        a.page.click(".modal .btn.primary")
        a.page.wait_for_selector(".screen.lesson")
        a.play("1-1")
        r = a.result()
        after = a.save()
        a.shot("replay-done.png", full=True)
        print("    replay: xp +%s, lessonBytes %s, questBytes %s, total bytes +%s, tiles %s" % (
            r["xp"], r["lessonBytes"], r["questBytes"], r["totalBytes"], a.page.inner_text(".tiles").replace("\n", " ")))
        assert a.page.inner_text(".tile.xp b") == "+10"
        assert r["xp"] == 10 and r["lessonBytes"] == 0 and not r["firstTime"], r
        assert after["xp"] - before["xp"] == 10, (before["xp"], after["xp"])
        assert after["completed_lessons"] == ["1-1"]
        assert "다시 하기라서" in a.page.inner_text(".screen.done")
        assert not a.errors, a.errors

    # 2) 1-1~1-4를 끝낸 저장 → 1-5(장 평가)
    seed = {"saveVer": 1, "xp": 80, "bytes": 60, "completed_lessons": ["1-1", "1-2", "1-3", "1-4"],
            "current_lesson": "1-5", "current_chapter": 1,
            "grading_results": {k: {"perfect": True, "attempts": 1} for k in ("1-1", "1-2", "1-3", "1-4")}}
    with App("iPhone 17", save=seed) as a:
        a.start()
        node = a.page.query_selector('.node[data-lesson="1-5"]')
        assert node and "current" in node.get_attribute("class"), node and node.get_attribute("class")
        assert "1-5" in a.page.inner_text("#continue")
        a.page.click("#continue")
        a.play("1-5")
        r = a.result()
        s = a.save()
        a.shot("exam-done.png", full=True)
        print("    exam: xp +%s (perfect %s, hintfree %s), lessonBytes %s" % (r["xp"], r["perfect"], r["hintFreeWrite"], r["lessonBytes"]))
        assert r["firstTime"] and r["perfect"] and r["hintFreeWrite"], r
        assert r["xp"] == 30 + 5 + 5, r["xp"]
        assert r["lessonBytes"] == 15, r["lessonBytes"]
        assert a.page.inner_text(".tile.xp b") == "+40"
        assert s["xp"] == 120 and "1-5" in s["completed_lessons"], s["xp"]
        a.dismiss()
        assert not a.errors, a.errors


def test_wrong_then_retry():
    with App("iPhone 17") as a:
        a.start()
        a.page.click("#continue")
        seq = a.play("1-1", wrong=(0,))
        r = a.result()
        a.shot("retry-done.png", full=True)
        acc = a.page.inner_text(".tile.acc b")
        print("    sequence %s, accuracy tile %s, perfect %s" % (seq, acc, r["perfect"]))
        # 0번을 틀림 → 본 문제(0~5) 뒤에 0번을 다시, 그다음 이해도 확인(6)
        assert seq == ["0", "1", "2", "3", "4", "5", "0r", "6"], seq
        assert r["perfect"] is False and r["xp"] == 15, r     # 10 + 힌트 없이 5
        assert acc != "100%", acc
        assert "실수 없이 끝냈어요" not in a.page.inner_text(".screen.done")
        s = a.save()
        assert s["grading_results"]["1-1"]["perfect"] is False, s["grading_results"]
        a.dismiss()
        assert not a.errors, a.errors


def test_timeout_recovery():
    with App("iPhone 17") as a:
        a.start()
        a.page.click("#continue")
        _to_write(a)
        a.wait_py()
        a.set_code("while True:\n    pass")
        t0 = time.time()
        a.page.click("#run")
        a.page.wait_for_selector(".err-panel", timeout=30_000)
        took = time.time() - t0
        title = a.page.inner_text(".err-panel h3")
        a.shot("timeout.png")
        print("    timeout after %.1fs: %r; chip: %r" % (took, title, a.page.inner_text("#pychip") if a.page.is_visible("#pychip") else ""))
        assert "시간 초과" in title, title
        assert "Timeout" in a.page.inner_text(".err-orig")
        a.set_code('print("다시")')
        a.page.click("#run")
        a.page.wait_for_selector(".console .out", timeout=60_000)
        out = a.page.inner_text(".console .out").strip()
        a.shot("timeout-recovered.png")
        assert out == "다시", out
        assert not a.errors, a.errors


def test_reduced_motion():
    q = """() => [...document.querySelectorAll('.ria-body')].map(e => ({
        name: getComputedStyle(e).animationName,
        running: e.getAnimations().filter(x => x.playState === 'running').length }))"""
    with App("iPhone 17", reduced=True) as a:
        seen = {}
        seen["splash"] = a.js(q)
        a.start()
        seen["home"] = a.js(q)
        a.page.click("#continue")
        a.page.wait_for_selector(".card-view")
        seen["card"] = a.js(q)
        print("    %s" % {k: len(v) for k, v in seen.items()})
        bad = {k: v for k, v in seen.items() if any(x["running"] or x["name"] != "none" for x in v)}
        assert all(seen.values()), "no Ria found on some screen: %s" % seen
        assert not bad, bad
    # 대조: 동작 줄이기가 없으면 숨쉬기 움직임이 돈다(측정 방법이 맞는지)
    with App("iPhone 17") as a:
        v = a.js(q)
        assert any(x["running"] for x in v), v


def test_status_after_milestone():
    seed = {"saveVer": 1, "xp": 100, "bytes": 0, "completed_lessons": [],
            "streak": {"days": 6, "best": 6, "lastGoalDate": today(1), "todayDate": today(), "todayXp": 0},
            "settings": {"sound": True, "dailyGoal": 20, "name": ""}}
    fails = []
    # 가) 레슨 완료로 7일 → 축하 창
    with App("iPhone 17", save=seed) as a:
        a.start()
        assert a.page.inner_text(".status .stat.flame b") == "6"
        a.page.click("#continue")
        a.play("1-1")
        a.page.wait_for_selector(".celebrate", timeout=3000)
        bars = a.js("() => [...document.querySelectorAll('.status .stat.flame b')].map(e => e.textContent)")
        tile = a.page.inner_text(".tile.flame b")
        a.shot("milestone-lesson.png")
        print("    lesson path: status bars behind overlay %s, done tile %s, overlay %r" % (
            bars, tile, a.page.inner_text(".celebrate .cel-title")))
        if any(b != "7" for b in bars):
            fails.append("lesson path: status bar shows %s while overlay open" % bars)
        if tile != "7":
            fails.append("lesson path: done tile %s" % tile)
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.click("#cel-ok")
        a.page.wait_for_selector(".celebrate", state="detached")
        a.dismiss()
        a.page.click("#home")
        a.page.wait_for_selector(".screen.home")
        a.dismiss()
        home = a.page.inner_text(".status .stat.flame b")
        if home != "7":
            fails.append("lesson path: home shows %s" % home)
        if a.errors:
            fails.append("lesson path errors: %s" % a.errors)
    # 나) 설정에서 목표를 낮춰 7일 → 축하 창 (상태 줄이 같은 화면에 있음; 실행 기록 작업 9 남은 경미)
    seed2 = dict(seed, streak=dict(seed["streak"], todayXp=12))
    with App("iPhone 17", save=seed2) as a:
        a.start()
        a.page.click('[data-go="settings"]')
        a.page.wait_for_selector(".screen.settings")
        a.page.click('[data-g="10"]')
        a.page.wait_for_selector(".celebrate", timeout=3000)
        a.page.wait_for_timeout(100)
        bars = a.js("() => [...document.querySelectorAll('.status .stat.flame b')].map(e => e.textContent)")
        a.shot("milestone-settings.png")
        print("    settings path: status bars behind overlay %s" % bars)
        if not bars or any(b != "7" for b in bars):
            fails.append("settings path: status bar shows %s while overlay open" % bars)
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.click("#cel-ok")
        a.page.wait_for_selector(".celebrate", state="detached")
        after = a.page.inner_text(".status .stat.flame b")
        if after != "7":
            fails.append("settings path: after closing shows %s" % after)
        if a.errors:
            fails.append("settings path errors: %s" % a.errors)
    assert not fails, "\n".join(fails)


# ---------------------------------------------------------------- 실행

def main():
    only = sys.argv[1:]
    tests = [(n, f) for n, f in globals().items() if n.startswith("test_") and callable(f) and (not only or n in only)]
    t0 = time.time()
    env()
    print("build: " + _env["build"].replace("\n", " | "))
    fails = 0
    for name, f in tests:
        t = time.time()
        try:
            f()
            print("PASS %s (%.0fs)" % (name, time.time() - t))
        except Exception as e:  # noqa: BLE001
            fails += 1
            print("FAIL %s (%.0fs) - %s: %s" % (name, time.time() - t, type(e).__name__, str(e)[:3000]))
    print("%d passed, %d failed (%.0fs). screenshots: %s" % (len(tests) - fails, fails, time.time() - t0, OUT))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
