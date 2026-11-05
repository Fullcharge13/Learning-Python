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
- test_resume_lesson: 1-2 문제 2개 → 새로고침 → 「이어서 하기」 → 같은 문제 / write 초안 → 새로고침 → 초안 그대로
                      → 끝까지: 보상·저장이 끊지 않은 판과 같음, 이어 하기 칸 지워짐 (v0.6.2 다)
- test_resume_decline: 「처음부터」 → 카드 1부터, 칸 지워짐 / 「그만두기」도 칸을 지움
- test_advanced_branch: 시험 심화(tests/fixtures/advanced.js)를 1·2장에 끼운 빌드. 1-5까지 끝낸 저장 → 1장 별 노드 3개 열림,
                        2장은 잠김 → 1-A1 풀기 → XP 15(+보너스)·바이트 15, 배지 「심화 첫걸음」, 지금 레슨은 2-1 그대로
                        → 설정 「심화 1/3」·펼친 목록 「심화」 (v0.7 작업 1). 캡처: adv-*.png
- test_daily_challenge: 새 저장은 잠긴 카드 「1장을 끝내면 열려요」. 1~2장을 끝낸 저장 → 홈 맨 위 「오늘의 도전」(시작, 점 0)
                        → 1문제 풀고 새로고침 → 같은 3문제·「이어서」·점 1 → 남은 2문제(틀 1 + 직접 작성) → 「오늘의 도전 완료!」
                        XP 15·바이트 10·도전 1일째 → 홈 「완료됨」 → 새로고침해도 같은 문제·완료됨 (v0.9 작업 2).
                        캡처: daily-home.png, daily-item.png, daily-write.png, daily-done.png, daily-home-done.png (iPhone 17)
- test_garden_*: 파이의 텃밭(v0.10 작업 4, 설계서 2026-11-05). 새 저장은 홈 입구 잠김 「1장을 끝내면 열려요」 /
                 1장 통과 → 입구에 지금 주문 → 시작 프로그램 실행(재생·건너뛰기) → 주문 1 완료 창·XP 5 한 번 →
                 노드 고르기 창으로 말하기 추가·값 바꾸기 → 주문 2 / 코드 모드(만든 코드 복사, 실행, 오류 줄·한국어 설명,
                 고친 뒤 「노드로 돌아가기」 확인 창) / 검사 오류 빨간 노드는 실행을 막음 / while 500번 지침 말풍선 /
                 성장 창(모자람 이유, 밭 4×4 사기 → 주문 완료). 텃밭 화면 넘침·터치 44px(노드·코드 모드).
                 캡처: garden-*.png (iPhone 17)
- test_garden11_*: 텃밭 6~9장(v0.11 작업 4). 목록에서 하나씩(종류 고르기·목록 편집 창: 더하기·6개 한도·←/→·빼기,
                 안쪽 심기에서 「목록 값(crop)」) → 섞어 심기 완료 / 창고 보기 조건(8장 잠금은 흐리게) → 모자란 것만 완료 /
                 위치 알기 뒤 x 비교(앞에서는 x 없음) → 줄 끝에서 내려가기 완료 / 값 넣어 말하기(앞·뒤 글자 10자, 값 고르기)
                 → 수확 보고 완료 / 코드 모드 NameError 오타 → 「혹시 move?」. 새 창 넘침·터치 44px.
                 캡처: garden11-*.png (iPhone 17)
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
RESUME_KEY = "ria-python.resume"
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

    def __init__(self, device="iPhone 17", save=None, reduced=False, url=None):
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
        self.page.goto(url or e["url"])
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
            return sorted(str(v).strip() for v in (x.get("options") or x.get("chips") or x.get("lines") or []))
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
                    if b.inner_text().strip() == line.strip():
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
    let fixed = false, scroller = false, vscroller = false;
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.position === 'fixed' || ps.position === 'sticky') fixed = true;
      if (p !== e && /(auto|scroll)/.test(ps.overflowX) && p.scrollWidth > p.clientWidth + 1) scroller = true;
      if (p !== e && /(auto|scroll)/.test(ps.overflowY) && p.scrollHeight > p.clientHeight + 1) vscroller = true;
    }
    const text = (e.getAttribute('aria-label') || e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    const name = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].join('.') : '') + ' "' + text + '"';
    items.push({ name, l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, fixed, scroller, vscroller });
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
            # 가로 스크롤 줄 안(가로만 넘침) 또는 세로로 스크롤되는 창(고르기 창) 안에서 위아래로 밀려난 것은 스크롤로 닿음
            in_scroll = (it["scroller"] and not out_v) or (it.get("vscroller") and out_v and not out_h)
            (scrolled if in_scroll else offscreen).append(
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
        assert s["saveVer"] == 2 and s["xp"] == 30 and s["bytes"] == 0, s
        assert a.page.is_visible("#continue")
        assert not a.errors, a.errors


def test_v06_outfit_migration_and_closet():
    """v0.6: 옛 의상(lab·detective·camping)을 입던 saveVer 1 저장 → 새 id·환불, 의상실 10벌 모두 그려짐(아이폰 17)."""
    old = {"saveVer": 1, "xp": 40, "bytes": 5, "outfits": ["basic", "lab", "detective", "camping"], "outfit": "lab"}
    with App("iPhone 17", save=old) as a:
        a.start()
        s = a.save()
        assert s["saveVer"] == 2, s
        assert s["outfits"] == ["basic", "whitecoat", "explorer"], s["outfits"]
        assert s["outfit"] == "whitecoat" and s["bytes"] == 5 + 180, s
        a.dismiss()
        a.page.click('[data-go="closet"]')
        a.page.wait_for_selector(".screen.closet")
        tiles = a.page.query_selector_all(".outfit-grid [data-o]")
        assert len(tiles) == 10, len(tiles)
        ids = [x.get_attribute("data-o") for x in tiles]
        a.shot("v06-closet-grid.png", full=True)
        descs = {}
        for oid in ids:
            a.page.click('[data-o="%s"]' % oid)
            a.page.wait_for_selector('[data-o="%s"][aria-pressed="true"]' % oid)
            descs[oid] = a.page.inner_text(".stage-info")
            assert a.page.query_selector(".stage .ria-wrap svg.ria"), oid
            a.page.locator(".stage").screenshot(path=os.path.join(OUT, "v06-closet-%s.png" % oid))
        assert "언제나 친절한 리아 교수!" in descs["basic"], descs["basic"]
        assert "30일 연속 기록 보상" in descs["graduate"], descs["graduate"]
        assert "입고 있어요" in descs["whitecoat"], descs["whitecoat"]
        print("    closet ids %s" % ",".join(ids))
        assert not a.errors, a.errors


def test_refund_notice_once():
    """판정 C42: detective를 가졌던 saveVer 1 저장 → 첫 홈에서 환불 안내 한 번, 새로 고침하면 다시 안 나옴."""
    old = {"saveVer": 1, "xp": 10, "bytes": 3, "outfits": ["basic", "detective"], "outfit": "detective"}
    msg = "없어진 옷 값 180바이트를 돌려 드렸어요. 새 옷도 구경해 보세요!"
    with App("iPhone 17", save=old) as a:
        a.start()
        a.page.wait_for_selector(".hello .refund-notice .bubble")
        assert a.page.inner_text(".hello .refund-notice .bubble").strip() == msg
        a.shot("v06-refund-notice.png")
        s = a.save()
        assert s["pending_refund"] == 0 and s["bytes"] == 183 and s["outfit"] == "basic", s
        a.page.reload()
        a.page.wait_for_selector(".screen.splash #go", timeout=20_000)
        a.start()
        assert a.save()["saveVer"] == 2
        assert not a.page.query_selector(".refund-notice"), "새로 고침 뒤 다시 나오면 안 됨"
        assert msg not in a.page.inner_text(".screen.home")
        assert a.save()["bytes"] == 183
        assert not a.errors, a.errors
    # 환불이 없던 v1 저장(lab만)은 안내 없음
    with App("iPhone 17", save={"saveVer": 1, "outfits": ["basic", "lab"], "outfit": "lab"}) as a:
        a.start()
        assert not a.page.query_selector(".refund-notice")
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


# ---------------------------------------------------------------- 이어 하기 (v0.6.2 다)

SEED_AFTER_11 = {"saveVer": 2, "xp": 20, "bytes": 15, "completed_lessons": ["1-1"], "current_lesson": "1-2",
                 "current_chapter": 1, "grading_results": {"1-1": {"perfect": True, "attempts": 1}}}


def _resume_rec(a):
    return a.js("() => JSON.parse(localStorage.getItem(%s))" % json.dumps(RESUME_KEY))


def _answer_items(a, items, n):
    """카드를 넘기고 터치 문제 n개를 맞힌다. 푼 문제 번호 목록"""
    done = []
    for _ in range(40):
        if len(done) >= n:
            return done
        a.page.wait_for_timeout(80)
        if a.page.query_selector(".card-view"):
            a.page.click("#act")
            continue
        if a.page.query_selector("article.item"):
            idx = a.which_item(items)
            a.answer_touch(items[idx])
            a.page.wait_for_selector("#result:not([hidden])")
            a.cont()
            done.append(idx)
    raise AssertionError("items not answered: %s" % done)


def _reload_to_prompt(a, lid):
    a.page.reload()
    a.page.wait_for_selector(".screen.splash #go", timeout=20_000)
    a.start()
    assert lid in a.page.inner_text("#continue")
    a.page.click("#continue")
    a.page.wait_for_selector(".modal .resume-ask", timeout=10_000)
    assert "하던 곳부터 이어서 할까요?" in a.page.inner_text(".modal")


def _strip_times(save):
    s = dict(save)
    s.pop("last_active_at", None)
    s["submission_logs"] = [{k: v for k, v in e.items() if k != "at"} for e in s.get("submission_logs", [])]
    return s


def test_resume_lesson():
    # 끊지 않은 판(같은 답: 전부 정답, write는 첫 제출에 정답)
    with App("iPhone 17", save=SEED_AFTER_11) as a:
        a.start()
        a.page.click("#continue")
        a.play("1-2")
        whole_r, whole_s = a.result(), a.save()
        a.dismiss()
    with App("iPhone 17", save=SEED_AFTER_11) as a:
        a.start()
        a.page.click("#continue")
        items = a.lesson("1-2")["items"]
        done = _answer_items(a, items, 2)
        a.page.wait_for_selector("article.item")
        on_screen = a.which_item(items)
        rec = _resume_rec(a)
        assert rec and rec["lessonId"] == "1-2" and rec["flow"]["answered"] == 2, rec
        # 새로고침 → 묻기 → 이어서 하기 → 같은 문제
        _reload_to_prompt(a, "1-2")
        path = a.shot("resume-prompt-iphone-17.png")
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.click(".modal .btn.primary")
        a.page.wait_for_selector("article.item")
        assert a.which_item(items) == on_screen, (done, on_screen)
        assert a.page.inner_text(".lesson-tag") == "1-2"
        # write까지 가서 초안을 쓰고 새로고침 → 초안 그대로
        _to_write(a, "1-2")
        draft = 'print("리아 카페")\n# 초안 메모'
        a.set_code(draft)
        a.page.wait_for_timeout(800)   # 초안은 0.5초 뒤 저장
        rec = _resume_rec(a)
        assert rec["item"] and rec["item"]["code"] == draft, rec and rec["item"]
        _reload_to_prompt(a, "1-2")
        a.page.click(".modal .btn.primary")
        a.page.wait_for_selector(".item.write .cm-content")
        got = a.js("() => [...document.querySelectorAll('.cm-content .cm-line')].map(e => e.textContent).join('\\n')")
        assert got == draft, got
        # 끝까지 → 보상이 끊지 않은 판과 같음
        a.play("1-2")
        r, s = a.result(), a.save()
        print("    resumed: xp +%s bytes +%s perfect %s | whole: xp +%s bytes +%s perfect %s | prompt %s" % (
            r["xp"], r["totalBytes"], r["perfect"], whole_r["xp"], whole_r["totalBytes"], whole_r["perfect"], path))
        assert r == whole_r, (r, whole_r)
        assert _strip_times(s) == _strip_times(whole_s)
        assert _resume_rec(a) is None
        a.dismiss()
        assert not a.errors, a.errors


def test_resume_decline():
    with App("iPhone 17", save=SEED_AFTER_11) as a:
        a.start()
        a.page.click("#continue")
        items = a.lesson("1-2")["items"]
        _answer_items(a, items, 2)
        assert _resume_rec(a) is not None
        _reload_to_prompt(a, "1-2")
        a.page.click(".modal .btn:not(.primary)")       # 처음부터
        a.page.wait_for_selector(".card-view")
        assert "오늘의 목표" in a.page.inner_text(".card-view")   # 첫 카드
        assert _resume_rec(a) is None
        # 카드 하나 넘기면 다시 기록 → 그만두기로 지움
        a.page.click("#act")
        a.page.wait_for_timeout(150)
        assert _resume_rec(a) is not None
        a.page.click("#quit")
        a.page.wait_for_selector(".modal")
        a.page.click(".modal .btn:not(.primary)")       # 그만두기
        a.page.wait_for_selector(".screen.home")
        assert _resume_rec(a) is None
        # 다시 들어가도 묻지 않음
        a.page.click("#continue")
        a.page.wait_for_selector(".card-view")
        assert not a.page.query_selector(".modal")
        assert not a.errors, a.errors


# ---------------------------------------------------------------- 실행

# ---------------------------------------------------------------- 심화 (v0.7 작업 1)

_adv_env = {}


def adv_url():
    """시험 심화를 1·2장에 끼운 빌드를 따로 띄운다(실제 심화 내용이 없어도 엔진·화면을 시험)."""
    if _adv_env:
        return _adv_env["url"]
    env()
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from fixtures.advanced_dir import make
    lessons = make(os.path.join(ROOT, "data", "lessons"), os.path.join(OUT, "lessons-adv"), chapters=(1, 2), strip_advanced=(17,))
    dist = os.path.join(OUT, "dist-adv")
    r = subprocess.run([sys.executable, os.path.join(ROOT, "build.py"), "--dev-pyodide", "--out", dist, "--lessons-dir", lessons],
                       cwd=ROOT, capture_output=True, text=True)
    assert r.returncode == 0, "build.py (advanced fixture) failed:\n" + r.stdout + r.stderr
    httpd = _Server(("127.0.0.1", 0), functools.partial(_Handler, directory=dist))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    atexit.register(httpd.shutdown)
    _adv_env["url"] = "http://127.0.0.1:%d/" % httpd.server_address[1]
    return _adv_env["url"]


def _adv_classes(a, chapter):
    return a.js("(n) => [1, 2, 3].map((k) => document.querySelector(`.star-node[data-lesson='${n}-A${k}']`)?.className || null)", chapter)


def test_advanced_branch():
    url = adv_url()
    ch1 = ["1-%d" % k for k in range(1, 6)]
    seed = {"saveVer": 2, "xp": 120, "bytes": 0, "completed_lessons": ch1, "current_lesson": "2-1", "current_chapter": 2,
            "grading_results": {k: {"perfect": True, "attempts": 1} for k in ch1}, "outfits": ["basic"], "outfit": "basic"}
    with App("iPhone 17", save=seed, url=url) as a:
        a.start()
        # 학습 길: 1장 별 3개 열림, 2장 별 3개 잠김, 지금 레슨 2-1
        c1, c2 = _adv_classes(a, 1), _adv_classes(a, 2)
        assert all(c and "open" in c for c in c1), c1
        assert all(c and "locked" in c for c in c2), c2
        assert "current" in a.page.get_attribute('.node[data-lesson="2-1"]', "class")
        assert "2-1" in a.page.inner_text("#continue")
        a.js("() => document.querySelector(`.star-node[data-lesson='1-A1']`).scrollIntoView({ block: 'center' })")
        a.page.wait_for_timeout(200)
        a.shot("adv-home.png")
        m = measure(a, "home-adv")
        assert not m["problems"] and not m["small"], m
        # 잠긴 별: 열리지 않음
        a.page.click(".star-node[data-lesson='2-A1']")
        a.page.wait_for_timeout(300)
        assert a.page.query_selector(".screen.home"), "locked advanced star must not open"
        # 1-A1 풀기(첫 문제 한 번 틀림 → 실수 없음 아님, 힌트 없이 통과)
        a.page.click(".star-node[data-lesson='1-A1']")
        a.page.wait_for_selector(".screen.lesson")
        a.play("1-A1", wrong=(0,))
        r = a.result()
        s = a.save()
        title = a.page.inner_text(".done-hero h1")
        print("    advanced: %s xp +%s, lessonBytes %s, perfect %s, hintfree %s, badges %s" % (
            title, r["xp"], r["lessonBytes"], r["perfect"], r["hintFreeWrite"], r["newBadges"]))
        assert title == "1-A1 심화 완료!", title
        assert r["firstTime"] and not r["perfect"] and r["hintFreeWrite"], r
        assert r["xp"] == 15 + 5 and r["lessonBytes"] == 15, r
        assert "advanced1" in r["newBadges"], r["newBadges"]
        assert "심화 첫걸음" in a.page.inner_text(".screen.done")
        assert "1-A1" in s["completed_lessons"] and s["current_lesson"] == "2-1" and s["current_chapter"] == 2, s
        a.shot("adv-done.png")
        a.dismiss()
        a.page.click("#home")
        a.page.wait_for_selector(".screen.home")
        a.dismiss()
        c1 = _adv_classes(a, 1)
        assert "done" in c1[0] and "open" in c1[1] and "open" in c1[2], c1
        assert "2-1" in a.page.inner_text("#continue"), "current lesson stays 2-1"
        # 설정: 「심화 1/3」, 펼치면 「심화」 아래 3개
        a.page.click('[data-go="settings"]')
        a.page.wait_for_selector(".screen.settings")
        row = a.page.query_selector('.ch-row[aria-controls="ch-1"]')
        assert "심화 1/3" in row.inner_text(), row.inner_text()
        plain = a.js("() => (window.__ria.app.chapters.find((c) => !(c.advanced || []).length) || {}).id")
        assert plain, "need a chapter without ADVANCED"
        assert a.page.query_selector('.ch-row[aria-controls="ch-%d"] .ch-adv' % plain) is None, "chapter without ADVANCED shows no 심화 count"
        assert "심화 0/3" in a.page.inner_text('.ch-row[aria-controls="ch-2"]')
        assert "레슨 중 5개 완료" in a.page.inner_text(".course-sum"), a.page.inner_text(".course-sum")
        row.click()
        a.page.wait_for_selector("#ch-1:not([hidden])")
        assert a.page.inner_text("#ch-1 .ch-adv-head").startswith("심화")
        assert a.page.eval_on_selector_all("#ch-1 .ls.adv", "es => es.map(e => e.className)") == ["ls adv done", "ls adv open", "ls adv open"]
        a.js("() => document.querySelector('#ch-1').scrollIntoView({ block: 'start' })")
        a.page.wait_for_timeout(150)
        a.shot("adv-settings.png")
        m = measure(a, "settings-adv")
        assert not m["problems"] and not m["small"], m
        # 배지: 15개
        a.page.click('[data-go="badges"]')
        a.page.wait_for_selector(".screen.badges")
        assert "/15" in a.page.inner_text(".page-title"), a.page.inner_text(".page-title")
        assert "끝낸 심화" in a.page.inner_text(".stat-grid")
        a.shot("adv-badges.png", full=True)
        m = measure(a, "badges-adv")
        assert not m["problems"] and not m["small"], m
        assert not a.errors, a.errors


# ---------------------------------------------------------------- 「새 내용」 점 (v0.7.1 작업 1)

_upd_env = {}


def upd_url():
    """1-2에 updated: "v0.7.1"을 단 빌드를 따로 띄운다(실제 보강 내용이 없어도 점·기록을 시험)."""
    if _upd_env:
        return _upd_env["url"]
    env()
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from fixtures.advanced_dir import make
    lessons = make(os.path.join(ROOT, "data", "lessons"), os.path.join(OUT, "lessons-upd"), chapters=(),
                   updated={"1-2": "v0.7.1"})
    dist = os.path.join(OUT, "dist-upd")
    r = subprocess.run([sys.executable, os.path.join(ROOT, "build.py"), "--dev-pyodide", "--out", dist, "--lessons-dir", lessons],
                       cwd=ROOT, capture_output=True, text=True)
    assert r.returncode == 0, "build.py (updated fixture) failed:\n" + r.stdout + r.stderr
    httpd = _Server(("127.0.0.1", 0), functools.partial(_Handler, directory=dist))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    atexit.register(httpd.shutdown)
    _upd_env["url"] = "http://127.0.0.1:%d/" % httpd.server_address[1]
    return _upd_env["url"]


def _dots(a):
    return a.js("() => [...document.querySelectorAll('.screen.home .new-dot')].map((d) => d.dataset.for)")


def test_new_content_dot():
    url = upd_url()
    done = ["1-1", "1-2"]
    seed = {"saveVer": 2, "xp": 40, "bytes": 30, "completed_lessons": done, "current_lesson": "1-3", "current_chapter": 1,
            "grading_results": {k: {"perfect": True, "attempts": 1} for k in done}}
    with App("iPhone 17", save=seed, url=url) as a:
        a.start()
        assert _dots(a) == ["1-2"], _dots(a)
        dot = a.page.query_selector('.new-dot[data-for="1-2"]')
        assert dot.get_attribute("aria-label") == "새 내용 있음" and dot.get_attribute("role") == "img"
        assert "새 내용 있음" in a.page.get_attribute('.node[data-lesson="1-2"]', "aria-label")
        assert "새 내용" not in (a.page.get_attribute('.node[data-lesson="1-1"]', "aria-label") or "")
        a.js("() => document.querySelector('.node[data-lesson=\"1-2\"]').scrollIntoView({ block: 'center' })")
        a.page.wait_for_timeout(200)
        # 점이 노드 누르기를 가리지 않음: 노드 가운데·점 자리를 누르면 노드가 받는다, 노드 크기 그대로
        box = a.page.query_selector('.node[data-lesson="1-2"]').bounding_box()
        assert round(box["width"]) == 68 and round(box["height"]) == 68, box
        hit = a.js("([x, y]) => document.elementFromPoint(x, y)?.closest('.node')?.dataset.lesson || null",
                   [box["x"] + box["width"] / 2, box["y"] + box["height"] / 2])
        assert hit == "1-2", hit
        db = dot.bounding_box()
        under = a.js("([x, y]) => document.elementFromPoint(x, y)?.closest('.new-dot') ? 'dot' : 'other'",
                     [db["x"] + db["width"] / 2, db["y"] + db["height"] / 2])
        assert under == "other", "dot must not take taps (pointer-events: none)"
        a.shot("v071-new-dot-home.png")
        m = measure(a, "home-new-dot")
        assert not m["problems"] and not m["small"], m
        # 설정 학습 내용: 1장을 펼치면 1-2 줄에 점
        a.page.click('[data-go="settings"]')
        a.page.wait_for_selector(".screen.settings")
        a.page.click('.ch-row[aria-controls="ch-1"]')
        a.page.wait_for_selector("#ch-1:not([hidden])")
        rows = a.page.eval_on_selector_all("#ch-1 .ls", "es => es.map(e => !!e.querySelector('.new-dot'))")
        assert rows[:3] == [False, True, False], rows
        a.js("() => document.querySelector('#ch-1 .new-dot').scrollIntoView({ block: 'center' })")
        a.page.wait_for_timeout(150)
        a.shot("v071-new-dot-settings.png")
        m = measure(a, "settings-new-dot")
        assert not m["problems"] and not m["small"], m
        # 다시 하기 → 끝까지 → 점 사라짐, 완료 화면은 평소 다시 하기와 같음
        a.page.click('[data-go="home"]')
        a.page.wait_for_selector(".screen.home")
        a.page.click('[data-lesson="1-2"]')
        a.page.wait_for_selector(".modal .btn.primary")
        a.page.click(".modal .btn.primary")
        a.page.wait_for_selector(".screen.lesson")
        a.play("1-2")
        r = a.result()
        s = a.save()
        assert r["xp"] == 10 and r["lessonBytes"] == 0 and not r["firstTime"], r
        assert s["seen_updates"] == {"1-2": "v0.7.1"}, s.get("seen_updates")
        assert s["completed_lessons"] == done and s["saveVer"] == 2, s
        text = a.page.inner_text(".screen.done")
        assert "다시 하기라서" in text and "새 내용" not in text, text
        a.dismiss()
        a.page.click("#home")
        a.page.wait_for_selector(".screen.home")
        a.dismiss()
        assert _dots(a) == [], _dots(a)
        assert "새 내용" not in a.page.get_attribute('.node[data-lesson="1-2"]', "aria-label")
        a.js("() => document.querySelector('.node[data-lesson=\"1-2\"]').scrollIntoView({ block: 'center' })")
        a.page.wait_for_timeout(200)
        a.shot("v071-new-dot-after-replay.png")
        # 새로 불러도 그대로(저장됨)
        a.page.reload()
        a.page.wait_for_selector(".screen.splash #go", timeout=20_000)
        a.start()
        assert _dots(a) == [], _dots(a)
        assert not a.errors, a.errors



# ---------------------------------------------------------------- 매일 도전 (v0.9 작업 2)

DAILY_JS = "() => { const l = window.__ria.app.dailyLesson; return l ? l.items : null; }"


def _daily_card(a):
    return a.js("""() => { const c = document.querySelector('.panel.daily'); if (!c) return null;
      const b = c.querySelector('#daily');
      return { cls: c.className, text: c.innerText, btn: b ? b.innerText.trim() : null, disabled: b ? b.disabled : null,
               on: c.querySelectorAll('.d-dot.on').length, dots: c.querySelectorAll('.d-dot').length,
               first: [...document.querySelector('main').children].filter((e) => !e.classList.contains('sr'))[0] === c }; }""")


def _daily_answer_one(a, shots):
    """도전 화면의 지금 문제 하나를 맞게 풀고 「계속」. 돌려줌: 문제 종류"""
    a.page.wait_for_selector("article.item", timeout=PY_READY_MS)
    items = a.js(DAILY_JS)
    idx = a.which_item(items)
    it = items[idx]
    if it["type"] == "write":
        a.page.wait_for_selector(".cm-content")
        if "write" in shots:
            a.shot(shots.pop("write"))
        a.submit_write(it["solution"])
    else:
        assert a.page.query_selector(".tag.daily"), "daily tag missing"
        if "item" in shots:
            a.shot(shots.pop("item"))
        a.answer_touch(it)
        a.page.wait_for_selector("#result:not([hidden])")
    assert a.cont(), "daily item %d (%s) judged wrong" % (idx, it["type"])
    return it["type"]


def test_daily_challenge():
    with App("iPhone 17") as a:   # 새 저장: 잠긴 카드
        a.start()
        c = _daily_card(a)
        assert c and "locked" in c["cls"] and "1장을 끝내면 열려요" in c["text"] and c["btn"] is None, c
        assert a.save()["daily"]["picks"] == [], "no picks before chapter 1"
        assert not a.errors, a.errors

    done12 = ["%d-%d" % (c, k) for c in (1, 2) for k in range(1, 6)]
    base = {"saveVer": 2, "completed_lessons": done12, "current_chapter": 3, "current_lesson": "3-1",
            "settings": {"sound": False, "dailyGoal": 10, "name": ""}}
    with App("iPhone 17", save=base) as a:
        a.start()
        c = _daily_card(a)
        assert c and c["first"] and "daily new" in c["cls"] and c["btn"] == "시작" and c["on"] == 0 and c["dots"] == 3, c
        assert "첫 도전" in c["text"], c["text"]
        assert a.js("() => window.scrollY") == 0, "home must stay at the top while today's challenge is open"
        a.shot("daily-home.png")
        box = a.page.eval_on_selector("#daily", "e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }")
        assert box[0] >= 44 and box[1] >= 44, box
        m = measure(a, "home-daily")
        assert not m["problems"], m["problems"]
        assert not [x for x in m["small"] if "daily" in x], m["small"]
        s0 = a.save()
        picks = s0["daily"]["picks"]
        assert s0["daily"]["date"] == today() and len(picks) == 3, s0["daily"]
        assert [p["kind"] for p in picks] == ["tpl", "tpl", "write"], picks
        assert all(p["chapter"] in (1, 2) for p in picks), picks
        assert picks[2]["lesson"] in done12, picks
        xp0, bytes0 = s0["xp"], s0["bytes"]

        a.wait_py()
        a.page.click("#daily")
        shots = {"item": "daily-item.png", "write": "daily-write.png"}
        kinds = [_daily_answer_one(a, shots)]
        a.page.wait_for_selector("article.item")
        s1 = a.save()
        assert s1["daily"]["done"] == [0], s1["daily"]

        # 새로고침(같은 날) → 같은 문제, 「이어서」, 점 1
        a.page.reload()
        a.page.wait_for_selector(".screen.splash #go", timeout=20_000)
        a.start()
        c = _daily_card(a)
        assert c["btn"] == "이어서" and c["on"] == 1 and "partial" in c["cls"], c
        assert a.save()["daily"]["picks"] == picks, "same picks after reload"
        a.wait_py()
        a.page.click("#daily")
        for _ in range(2):
            kinds.append(_daily_answer_one(a, shots))
        assert "write" in kinds and kinds.count("write") == 1, kinds
        a.page.wait_for_selector(".screen.done", timeout=10_000)
        a.page.wait_for_timeout(300)
        title = a.page.inner_text(".done-hero h1")
        assert title == "오늘의 도전 완료!", title
        assert "도전 1일째" in a.page.inner_text(".daily-done"), a.page.inner_text(".daily-done")
        assert a.page.inner_text(".tile.xp b") == "+15"
        a.shot("daily-done.png", full=True)
        r = a.result()
        s2 = a.save()
        assert r["mode"] == "daily" and r["xp"] == 15 and r["lessonBytes"] == 10, r
        assert s2["xp"] == xp0 + 15, (s2["xp"], xp0)
        assert s2["bytes"] == bytes0 + 10 + r["questBytes"] + r["milestoneBytes"], (s2["bytes"], bytes0, r)
        assert s2["daily"]["streak"] == 1 and s2["daily"]["last_done_date"] == today() and s2["daily"]["done"] == [0, 1, 2], s2["daily"]
        assert s2["streak"]["todayXp"] >= 15 and s2["streak"]["lastGoalDate"] == today(), s2["streak"]
        assert s2["completed_lessons"] == done12, "daily does not change course progress"

        a.page.click("#home")
        a.page.wait_for_selector(".screen.home")
        c = _daily_card(a)
        assert c["btn"] == "완료됨" and c["disabled"] and c["on"] == 3 and "도전 1일째" in c["text"], c
        a.js("() => window.scrollTo(0, 0)")
        a.shot("daily-home-done.png")
        a.page.reload()
        a.page.wait_for_selector(".screen.splash #go", timeout=20_000)
        a.start()
        c = _daily_card(a)
        assert c["btn"] == "완료됨" and c["disabled"], c
        assert a.save()["daily"]["picks"] == picks
        assert not a.errors, a.errors


# ---------------------------------------------------------------- 파이의 텃밭 (v0.10 작업 4)

def _chapters_done(n):
    return ["%d-%d" % (c, k) for c in range(1, n + 1) for k in range(1, 6)]


def _garden_seed(chapters, garden=None, xp=0):
    s = {"saveVer": 2, "xp": xp, "bytes": 0, "completed_lessons": _chapters_done(chapters),
         "current_chapter": chapters + 1, "current_lesson": "%d-1" % (chapters + 1),
         "settings": {"sound": False, "dailyGoal": 10, "name": ""}}
    if garden is not None:
        s["garden"] = garden
    return s


def _nd(i, kind, body=None, orelse=None, **args):
    n = {"id": i, "kind": kind, "args": args}
    if body is not None:
        n["body"] = body
    if orelse is not None:
        n["orelse"] = orelse
    return n


def _garden(order_idx=0, program=None, store=None, cells=None, size=3, upgrades=None, mode="nodes", code=""):
    order_ids = ["o_first", "o_hello", "o_plant", "o_lunch", "o_count", "o_row", "o_soup", "o_if", "o_potato",
                 "o_grid4", "o_def", "o_def_row", "o_repeat", "o_while", "o_all",
                 "o_sayval", "o_mix", "o_patrol", "o_lowstock", "o_potato_book", "o_where", "o_zigzag"]
    return {"v": 1, "size": size, "cells": cells if cells is not None else [None] * (size * size),
            "pie": {"x": 0, "y": 0}, "clock": 20, "store": {"당근": 0, "감자": 0, **(store or {})},
            "upgrades": upgrades or [], "order": {"idx": order_idx, "done": order_ids[:order_idx], "paid": order_ids[:order_idx]},
            "program": program if program is not None else [_nd(1, "move", dir="오른쪽"), _nd(2, "harvest")],
            "code": code, "mode": mode, "runs": 0}


def _open_garden(a):
    a.start()
    a.page.click("#garden")
    a.page.wait_for_selector(".screen.garden")
    a.page.wait_for_timeout(150)


def _garden_state(a):
    return a.js("() => document.querySelector('.screen.garden').dataset.state")


def _garden_run(a, skip=False):
    """「실행」 → (재생이면 건너뛰기) → 끝날 때까지. 돌려줌: 실행 뒤 save.garden"""
    a.wait_py()
    runs = (a.save().get("garden") or {}).get("runs", 0)
    a.page.click("#g-run")
    if skip:
        a.page.wait_for_selector(".screen.garden[data-state=replay]", timeout=30_000)
        a.page.click("#g-skip")
    a.page.wait_for_selector(".screen.garden[data-state=idle]", timeout=30_000)
    g = a.save()["garden"]
    assert g["runs"] == runs + 1, (g["runs"], runs)
    return g


def _close_done(a):
    a.page.wait_for_selector(".modal .g-done-body", timeout=10_000)
    a.page.wait_for_timeout(GUARD_WAIT)
    a.page.click(".modal .btn.primary")
    a.page.wait_for_selector(".modal .g-done-body", state="detached")


def _code_preview(a):
    return a.js("() => [...document.querySelectorAll('.g-code .g-line')].map(e => e.dataset.text).join('\\n')")


def _sheet_pick(a, sel):
    a.page.wait_for_selector(".modal.g-sheet")
    a.page.click(".modal.g-sheet " + sel)
    a.page.wait_for_selector(".modal.g-sheet", state="detached")


def test_garden_locked_home():
    with App("iPhone 17") as a:
        a.start()
        c = a.js("""() => { const c = document.querySelector('.garden-card'); return c && { cls: c.className, text: c.innerText,
                     btn: !!c.querySelector('#garden') }; }""")
        assert c and "locked" in c["cls"] and "1장을 끝내면 열려요" in c["text"] and not c["btn"], c
        assert "파이의 텃밭" in c["text"], c
        m = measure(a, "home-garden-locked")
        assert not m["problems"], m["problems"]
        assert not a.errors, a.errors


def test_garden_first_orders():
    with App("iPhone 17", save=_garden_seed(1, xp=40)) as a:
        a.start()
        c = a.js("() => document.querySelector('.garden-card').innerText")
        assert "첫 수확" in c, c
        a.page.eval_on_selector(".garden-card", "e => e.scrollIntoView({block: 'center'})")
        a.shot("garden-home.png")
        box = a.page.eval_on_selector("#garden", "e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }")
        assert box[0] >= 44 and box[1] >= 44, box
        a.page.click("#garden")
        a.page.wait_for_selector(".screen.garden")
        a.page.wait_for_timeout(200)
        assert a.page.inner_text("h1") == "파이의 텃밭"
        assert a.js("() => document.querySelectorAll('#board [data-cell]').length") == 9
        assert "첫 수확" in a.page.inner_text(".g-order"), a.page.inner_text(".g-order")
        assert _code_preview(a) == 'move("오른쪽")\nharvest()', _code_preview(a)
        a.shot("garden-open.png")
        a.shot("garden-open-full.png", full=True)
        m = measure(a, "garden-nodes")
        assert not m["problems"], m["problems"]
        assert not m["small"], m["small"]
        xp0 = a.save()["xp"]

        # 시작 프로그램 실행 → 재생 중 노드 불·건너뛰기 → 주문 1 완료
        a.wait_py()
        a.page.click("#g-run")
        a.page.wait_for_selector(".screen.garden[data-state=replay]", timeout=30_000)
        a.page.wait_for_selector(".g-node.now", timeout=5_000)
        a.shot("garden-replay.png")
        a.page.click("#g-skip")
        a.page.wait_for_selector(".modal .g-done-body", timeout=10_000)
        assert "첫 수확" in a.page.inner_text(".modal"), a.page.inner_text(".modal")
        assert "XP" in a.page.inner_text(".modal")
        a.shot("garden-order-done.png")
        _close_done(a)
        s = a.save()
        g = s["garden"]
        assert s["xp"] == xp0 + 5, (s["xp"], xp0)
        assert g["order"]["idx"] == 1 and g["order"]["paid"] == ["o_first"], g["order"]
        assert g["store"]["당근"] == 1 and g["runs"] == 1 and g["pie"] == {"x": 1, "y": 0}, g
        assert "당근 +1" in a.page.inner_text("#g-result"), a.page.inner_text("#g-result")
        assert "파이의 인사" in a.page.inner_text(".g-order")

        # 노드 더하기: 잠긴 노드는 흐리게, 말하기 추가
        a.page.click('.g-add[data-parent=""]')
        a.page.wait_for_selector(".modal.g-sheet")
        lk = a.js("""() => { const b = document.querySelector('.g-sheet [data-kind=setvar]');
                     return { dis: b.disabled || b.getAttribute('aria-disabled') === 'true', text: b.innerText }; }""")
        assert lk["dis"] and "2장을 끝내면 열려요" in lk["text"], lk
        a.shot("garden-add-sheet.png")
        m = measure(a, "garden-add-sheet")
        assert not m["small"], m["small"]
        _sheet_pick(a, "[data-kind=say]")
        assert a.js("() => document.querySelectorAll('.g-node').length") == 3
        assert _code_preview(a).endswith('print("안녕!")'), _code_preview(a)

        # 값 바꾸기: 말하기 글, 이동 방향
        a.page.click('.g-node[data-kind=say] .g-arg[data-arg=text]')
        a.page.wait_for_selector(".modal.g-sheet input")
        a.page.fill(".modal.g-sheet input", "반가워요")
        _sheet_pick(a, "#g-ok")
        a.page.click('.g-node[data-kind=move] .g-arg[data-arg=dir]')
        a.shot("garden-arg-sheet.png")
        _sheet_pick(a, '[data-v="아래"]')
        assert _code_preview(a) == 'move("아래")\nharvest()\nprint("반가워요")', _code_preview(a)
        g = a.save()["garden"]
        assert [n["kind"] for n in g["program"]] == ["move", "harvest", "say"], g["program"]
        assert g["program"][2]["args"]["text"] == "반가워요"

        # 다시 실행(건너뛰기) → 말하기 주문 완료, 말풍선
        _garden_run(a, skip=True)
        _close_done(a)
        s = a.save()
        assert s["xp"] == xp0 + 10 and s["garden"]["order"]["idx"] == 2, (s["xp"], s["garden"]["order"])
        assert "반가워요" in a.js("() => document.querySelector('#board svg').textContent")
        a.shot("garden-say.png")

        # 한 번 더: 다음 주문(심기)은 아직 아님 → XP 그대로
        _garden_run(a, skip=True)
        a.page.wait_for_timeout(300)
        assert not a.page.query_selector(".modal .g-done-body")
        assert a.save()["xp"] == xp0 + 10
        assert not a.errors, a.errors


def test_garden_code_mode():
    with App("iPhone 17", save=_garden_seed(1, _garden(order_idx=1)), reduced=True) as a:
        _open_garden(a)
        # 고치지 않았으면 바로 돌아옴
        a.page.click("#to-code")
        a.page.wait_for_selector(".g-editor .cm-content")
        got = a.js("() => [...document.querySelectorAll('.g-editor .cm-line')].map(e => e.textContent).join('\\n')")
        assert got.strip() == 'move("오른쪽")\nharvest()', got
        a.page.click("#to-nodes")
        a.page.wait_for_selector(".g-flow")
        assert not a.page.query_selector(".modal")
        assert a.save()["garden"]["mode"] == "nodes"

        a.page.click("#to-code")
        a.page.wait_for_selector(".g-editor .cm-content")
        a.wait_py()
        a.set_code('move("아래")\nprint("코드로 왔어요")\n')
        a.page.wait_for_timeout(700)  # 저장 지연(500ms)
        a.shot("garden-code.png")
        m = measure(a, "garden-code")
        assert not m["problems"], m["problems"]
        assert not m["small"], m["small"]
        g = _garden_run(a)
        assert g["mode"] == "code" and g["code"].startswith('move("아래")'), g
        assert g["pie"] == {"x": 0, "y": 1}, g["pie"]
        assert g["order"]["idx"] == 1, "use orders count only in node mode"
        assert "노드" in a.page.inner_text(".g-order"), a.page.inner_text(".g-order")
        assert "코드로 왔어요" in a.js("() => document.querySelector('#board svg').textContent")

        # 실행 중 오류: 그 줄 빨갛게 + 한국어 설명
        a.set_code('move("오른쪽")\nmove("앞")\n')
        _garden_run(a)
        err = a.page.inner_text(".err-panel")
        assert "방향은 위·아래·왼쪽·오른쪽 중 하나예요" in err and "값 오류" in err and "2번째 줄" in err, err
        assert a.page.query_selector(".g-editor .cm-errline"), "error line marked"
        assert a.save()["garden"]["pie"] == {"x": 1, "y": 1}, "state before the error is kept"
        a.shot("garden-code-error.png")

        # 고친 코드 → 노드로 돌아가기는 확인 창(그만두기 → 그대로, 돌아가기 → 노드)
        a.page.click("#to-nodes")
        a.page.wait_for_selector(".modal")
        assert "사라져요" in a.page.inner_text(".modal"), a.page.inner_text(".modal")
        a.page.click(".modal .btn.ghost")
        a.page.wait_for_selector(".modal", state="detached")
        assert a.page.query_selector(".g-editor .cm-content")
        a.page.click("#to-nodes")
        a.page.wait_for_selector(".modal .btn.primary")
        a.page.click(".modal .btn.primary")
        a.page.wait_for_selector(".g-flow")
        g = a.save()["garden"]
        assert g["mode"] == "nodes" and [n["kind"] for n in g["program"]] == ["move", "harvest"], g
        assert not a.errors, a.errors


def test_garden_node_errors():
    prog = [_nd(1, "addvar", name="count", value=1), _nd(2, "move", dir="오른쪽")]
    with App("iPhone 17", save=_garden_seed(2, _garden(order_idx=4, program=prog)), reduced=True) as a:
        _open_garden(a)
        bad = a.js("() => [...document.querySelectorAll('.g-node.bad')].map(e => e.dataset.id)")
        assert bad == ["1"], bad
        assert "count 값을 먼저 기억해요" in a.page.inner_text('.g-node[data-id="1"]')
        a.wait_py()
        a.page.click("#g-run")
        a.page.wait_for_timeout(400)
        assert a.save()["garden"]["runs"] == 0, "validation errors block the run"
        assert "빨간 노드" in a.page.inner_text("#g-result"), a.page.inner_text("#g-result")
        a.shot("garden-node-error.png")
        # 고치기: 값 기억하기를 맨 앞에 넣고 위로 올림
        a.page.click('.g-add[data-parent=""]')
        _sheet_pick(a, "[data-kind=setvar]")
        for _ in range(2):
            a.page.click('.g-node[data-kind=setvar] .g-menu')
            _sheet_pick(a, '[data-act=up]')
        assert [n["kind"] for n in a.save()["garden"]["program"]] == ["setvar", "addvar", "move"]
        assert not a.page.query_selector(".g-node.bad")
        g = _garden_run(a)
        assert g["order"]["idx"] == 5, "o_count (use addvar) done"
        _close_done(a)
        assert not a.errors, a.errors


def test_garden_tired_and_deep_nodes():
    prog = [
        _nd(1, "def", body=[_nd(2, "if", cond="can_harvest", body=[_nd(3, "harvest")], orelse=[_nd(4, "say", text="아직이야")]),
                            _nd(5, "move", dir="오른쪽")], name="tend"),
        _nd(6, "setvar", name="count", value=0),
        _nd(7, "while", cond={"var": "count", "op": "<", "num": 99}, body=[
            _nd(8, "repeat", n=5, body=[_nd(9, "call", name="tend")]),
            _nd(10, "move", dir="아래"),
            _nd(11, "addvar", name="count", value=1),
        ]),
    ]
    with App("iPhone 17", save=_garden_seed(5, _garden(order_idx=12, program=prog, size=4, upgrades=["grid4"])), reduced=True) as a:
        _open_garden(a)
        assert not a.page.query_selector(".g-node.bad"), a.page.inner_text(".g-flow")
        a.shot("garden-nodes-deep.png", full=True)
        m = measure(a, "garden-deep")
        assert not m["problems"], m["problems"]
        assert not m["small"], m["small"]
        code = _code_preview(a)
        assert "while count < 99:\n    for i in range(5):\n        tend()" in code and "\n    else:\n" in code, code
        assert "    count = count + 1" in code, code
        g = _garden_run(a)
        txt = a.js("() => document.querySelector('#board svg').textContent")
        assert "오늘은 여기까지! 지쳤어요" in txt, txt
        assert "지쳤어요" in a.page.inner_text("#g-result")
        assert g["clock"] == 20 + 500, g["clock"]
        a.shot("garden-tired.png")
        assert not a.errors, a.errors


def test_garden_upgrades():
    seed = _garden_seed(3, _garden(order_idx=9, store={"당근": 25}, upgrades=["감자 씨앗"]), xp=10)
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        assert "밭 넓히기" in a.page.inner_text(".g-order")
        a.page.click("#g-grow")
        a.page.wait_for_selector(".modal.g-sheet")
        info = a.js("""() => Object.fromEntries([...document.querySelectorAll('.g-sheet [data-up]')].map(b =>
                      [b.dataset.up, { dis: b.disabled, text: b.closest('.g-up').innerText }]))""")
        assert not info["grid4"]["dis"], info
        assert info["비료"]["dis"] and "감자 20개가 모자라요" in info["비료"]["text"], info
        assert info["grid5"]["dis"] and "먼저 「밭 4×4」 성장이 필요해요" in info["grid5"]["text"], info
        assert info["감자 씨앗"]["dis"] and "이미" in info["감자 씨앗"]["text"], info
        a.shot("garden-grow.png")
        m = measure(a, "garden-grow")
        assert not m["small"], m["small"]
        a.page.click('.g-sheet [data-up="grid4"]')
        _close_done(a)
        s = a.save()
        g = s["garden"]
        assert g["size"] == 4 and "grid4" in g["upgrades"] and g["store"]["당근"] == 5, g
        assert g["order"]["idx"] == 10 and s["xp"] == 15, (g["order"], s["xp"])
        assert a.js("() => document.querySelectorAll('#board [data-cell]').length") == 16
        assert "당근" in a.page.inner_text(".g-store") and "5" in a.page.inner_text(".g-store")
        a.shot("garden-grid4.png")
        assert not a.errors, a.errors


def test_garden_order_chain():
    # 검토 C62 I3: 감자 주문 차례에 밭 4×4를 미리 사 두고 감자 주문을 해내면 밭 넓히기 주문도 바로 끝남
    cells = [None] * 9
    cells[1] = {"crop": "감자", "planted_at": 8}   # clock 20 → 다 자람(12)
    seed = _garden_seed(3, _garden(order_idx=8, store={"당근": 25}, upgrades=["감자 씨앗"], cells=cells), xp=10)
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        assert "첫 감자" in a.page.inner_text(".g-order")
        a.page.click("#g-grow")
        _sheet_pick(a, '[data-up="grid4"]')
        a.page.wait_for_timeout(GUARD_WAIT)
        assert not a.page.query_selector(".modal .g-done-body"), "감자 주문 차례라 아직 완료 아님"
        g = a.save()["garden"]
        assert g["size"] == 4 and g["order"]["idx"] == 8 and a.save()["xp"] == 10, g
        _garden_run(a)
        a.page.wait_for_selector(".modal .g-done-body", timeout=10_000)
        first = a.page.inner_text(".modal")
        assert "첫 감자" in first and "밭 넓히기" in first, first
        # 첫 창을 닫으면 이어서 끝난 주문의 창이 바로 뜬다
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.click(".modal .btn.primary")
        a.page.wait_for_function("() => { const m = document.querySelector('.modal .g-done-body'); "
                                 "return m && !m.innerText.includes('첫 감자'); }", timeout=5_000)
        second = a.page.inner_text(".modal")
        assert "밭 넓히기" in second and "주문 완료" in second, second
        a.shot("garden-order-chain.png")
        _close_done(a)
        s = a.save()
        assert s["garden"]["order"]["idx"] == 10, s["garden"]["order"]
        assert s["garden"]["order"]["paid"][-2:] == ["o_potato", "o_grid4"], s["garden"]["order"]
        assert s["xp"] == 20, s["xp"]
        assert "내 노드 만들기" in a.page.inner_text(".g-order") or "4장" in a.page.inner_text(".g-order")
        assert not a.errors, a.errors


def test_garden_edit_minors():
    # 글자 id 노드 안에 더하기(id를 숫자로 바꾸지 않음), 편집 창 뒤 초점, 「아니면 떼기」 확인, 실행 중 떠나도 저장
    prog = [
        {"id": "7", "kind": "repeat", "args": {"n": 2}, "body": [{"id": "8", "kind": "harvest", "args": {}}]},
        _nd(9, "if", cond="can_harvest", body=[_nd(10, "harvest")], orelse=[_nd(11, "say", text="아직")]),
    ]
    with App("iPhone 17", save=_garden_seed(5, _garden(order_idx=12, program=prog, size=4, upgrades=["grid4"])),
             reduced=True) as a:
        _open_garden(a)
        a.page.click('.g-add[data-parent="7"][data-slot=body]')
        _sheet_pick(a, "[data-kind=move]")
        g = a.save()["garden"]
        assert g["program"][0]["id"] == "7" and [n["kind"] for n in g["program"][0]["body"]] == ["harvest", "move"], g["program"]
        new_id = g["program"][0]["body"][1]["id"]
        foc = a.js("() => { const e = document.activeElement; const n = e && e.closest('.g-node'); return n && [n.dataset.id, e.className]; }")
        assert foc and foc[0] == str(new_id) and "g-arg" in foc[1], foc
        # 값 바꾸기 뒤 초점은 그 값 단추
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=dir]' % new_id)
        _sheet_pick(a, '[data-v="아래"]')
        foc = a.js("() => { const e = document.activeElement; return e && e.closest('.g-node') && [e.closest('.g-node').dataset.id, e.dataset.arg]; }")
        assert foc == [str(new_id), "dir"], foc
        # 아니면 떼기: 안에 노드가 있으면 확인(그만두기 → 그대로, 떼기 → 지움)
        a.page.click('.g-node[data-id="9"] .g-menu')
        _sheet_pick(a, "[data-act=else-off]")
        a.page.wait_for_selector(".modal:not(.g-sheet)")
        assert "1개" in a.page.inner_text(".modal"), a.page.inner_text(".modal")
        a.page.click(".modal .btn.ghost")
        a.page.wait_for_selector(".modal", state="detached")
        assert a.save()["garden"]["program"][1].get("orelse"), "그만두기 → 아니면 그대로"
        a.page.click('.g-node[data-id="9"] .g-menu')
        _sheet_pick(a, "[data-act=else-off]")
        a.page.wait_for_selector(".modal:not(.g-sheet)")
        a.page.click(".modal .btn.primary")
        a.page.wait_for_selector(".modal", state="detached")
        assert "orelse" not in a.save()["garden"]["program"][1], a.save()["garden"]["program"][1]
        foc = a.js("() => { const e = document.activeElement; return e && e.closest('.g-node') && e.closest('.g-node').dataset.id; }")
        assert foc == "9", foc
        # 빈 아니면은 묻지 않고 바로 뗌
        a.page.click('.g-node[data-id="9"] .g-menu')
        _sheet_pick(a, "[data-act=else-on]")
        a.page.click('.g-node[data-id="9"] .g-menu')
        _sheet_pick(a, "[data-act=else-off]")
        a.page.wait_for_timeout(200)
        assert not a.page.query_selector(".modal") and "orelse" not in a.save()["garden"]["program"][1]
        # 실행을 누르고 같은 순간 홈으로(결과는 작업자에서 늦게 옴): 결과·주문(반복 사용) XP가 저장에 남음
        a.wait_py()
        clock0 = a.save()["garden"]["clock"]
        xp0 = a.save()["xp"]
        a.js("() => { document.querySelector('#g-run').click(); document.querySelector('#g-back').click(); }")
        a.page.wait_for_selector(".screen.home", timeout=10_000)
        a.page.wait_for_function("() => (JSON.parse(localStorage.getItem(%s)).garden || {}).runs === 1" % json.dumps(SAVE_KEY),
                                 timeout=15_000)
        s = a.save()
        g = s["garden"]
        assert g["runs"] == 1 and g["clock"] > clock0, (g["runs"], g["clock"], clock0)
        assert g["order"]["idx"] == 13 and s["xp"] == xp0 + 5, (g["order"], s["xp"], xp0)
        assert not a.page.query_selector(".modal"), "떠난 화면의 창은 띄우지 않음"
        assert not a.errors, a.errors


def test_garden_waited_message():
    # 확인만 하며 기다리면 「기다리다 지쳤어요」 + 시간은 움직일 때만 흐른다는 안내. 모드를 바꾸면 말풍선은 지워짐
    prog = [_nd(1, "while", cond="not_can_harvest", body=[_nd(2, "say", text="기다려")])]
    with App("iPhone 17", save=_garden_seed(5, _garden(order_idx=12, program=prog)), reduced=True) as a:
        _open_garden(a)
        g = _garden_run(a)
        assert g["clock"] == 20, g["clock"]
        res = a.page.inner_text("#g-result")
        assert "파이가 기다리다 지쳤어요 — 텃밭의 시간은 파이가 움직일 때만 흘러요." in res, res
        txt = a.js("() => document.querySelector('#board svg').textContent")
        assert "기다리다 지쳤어요" in txt and "움직여야" in txt, txt
        a.shot("garden-waited.png")
        a.page.click("#to-code")
        a.page.wait_for_selector(".g-editor .cm-content")
        assert not a.page.query_selector("#board .g-bubble"), "모드를 바꾸면 말풍선 지움"
        assert not a.errors, a.errors


# ---------------------------------------------------------------- 텃밭 6~9장 (v0.11 작업 4)

G11_UP = ["grid4", "감자 씨앗"]


def _sheet_ok(a, name, shot=None):
    """지금 열린 고르기 창을 재고(넘침·44px) 캡처"""
    a.page.wait_for_selector(".modal.g-sheet")
    a.page.wait_for_timeout(250)  # 올라오는 움직임
    if shot:
        a.shot(shot)
    m = measure(a, name)
    assert not m["problems"], (name, m["problems"])
    assert not m["small"], (name, m["small"])


def _row_chips(a, nid):
    return a.js("(id) => [...document.querySelectorAll(`.g-node[data-id=\"${id}\"] > .g-node-main .g-arg`)].map(b => b.innerText.trim())", str(nid))


def _list_items(a):
    return a.js("() => [...document.querySelectorAll('.g-list-sheet .g-li-item')].map(b => b.dataset.item)")


def test_garden11_foreach_mix():
    seed = _garden_seed(9, _garden(order_idx=16, program=[], size=4, upgrades=G11_UP, store={"당근": 44, "감자": 6}))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        assert "목록 값으로 심기·이동하기" in a.page.inner_text(".g-goal"), a.page.inner_text(".g-goal")
        # 노드 더하기 → 목록에서 하나씩 → 목록 종류 고르기
        a.page.click('.g-add[data-parent=""]')
        a.page.wait_for_selector(".modal.g-sheet [data-kind=foreach]")
        a.shot("garden11-add-sheet.png", full=False)
        a.page.click(".modal.g-sheet [data-kind=foreach]")   # 바로 다음 창(목록 종류)이 열림
        a.page.wait_for_selector(".modal.g-ltype-sheet")
        opts = a.js("() => [...document.querySelectorAll('.g-ltype-sheet [data-v]')].map(b => b.dataset.v)")
        assert opts == ["crop", "dir"], opts
        _sheet_ok(a, "garden11-ltype", "garden11-ltype.png")
        _sheet_pick(a, '[data-v="crop"]')
        g = a.save()["garden"]
        fe = g["program"][0]
        assert fe["kind"] == "foreach" and fe["args"]["list"] == {"type": "crop", "items": ["당근", "감자"]}, fe
        fid = fe["id"]
        badge = a.page.inner_text('.g-node[data-kind=foreach] .g-var')
        assert badge.strip() == "crop", badge

        # 목록 편집: 더하기 → 6개 한도 → ←/→ → 빼기
        a.page.click('.g-node[data-kind=foreach] .g-arg[data-arg=list]')
        a.page.wait_for_selector(".modal.g-list-sheet")
        assert _list_items(a) == ["당근", "감자"], _list_items(a)
        a.page.click('.g-list-sheet [data-add="당근"]')
        a.page.click('.g-list-sheet [data-add="감자"]')
        assert _list_items(a) == ["당근", "감자", "당근", "감자"], _list_items(a)
        a.page.click('.g-list-sheet [data-add="당근"]')
        a.page.click('.g-list-sheet [data-add="당근"]')
        assert len(_list_items(a)) == 6
        # 6개가 되어 누른 더하기 단추가 막히면 초점은 「정하기」로(v0.11 검토)
        assert a.js("() => document.activeElement && document.activeElement.id") == "g-ok", a.js("() => document.activeElement.outerHTML")
        assert a.js("() => [...document.querySelectorAll('.g-list-sheet [data-add]')].every(b => b.disabled)"), "6개면 더하기 막힘"
        assert "6/6" in a.page.inner_text("#g-li-n"), a.page.inner_text("#g-li-n")
        _sheet_ok(a, "garden11-list-full", "garden11-list.png")
        # 첫 칸 고르고 → (뒤로), ← (앞으로)
        a.page.click('.g-list-sheet .g-li-item[data-i="0"]')
        a.page.click("#g-li-right")
        assert _list_items(a)[:2] == ["감자", "당근"], _list_items(a)
        assert a.js("() => document.querySelector('.g-list-sheet .g-li-item.on').dataset.i") == "1", "고른 칸이 따라감"
        a.page.click("#g-li-left")
        assert _list_items(a)[:2] == ["당근", "감자"], _list_items(a)
        # 마지막 두 칸 빼기 — 빼기 단추가 막혀도 초점은 남은 칸(뺀 자리, 끝이면 바로 앞 칸)으로(v0.11 검토)
        for i in ("5", "4"):
            a.page.click('.g-list-sheet .g-li-item[data-i="%s"]' % i)
            a.page.click("#g-li-del")
            foc = a.js("() => document.activeElement && document.activeElement.matches('.g-list-sheet .g-li-item') ? document.activeElement.dataset.i : null")
            assert foc == str(int(i) - 1), (i, a.js("() => document.activeElement.outerHTML"))
        assert _list_items(a) == ["당근", "감자", "당근", "감자"], _list_items(a)
        assert "for crop in" in a.page.inner_text(".g-list-sheet .g-li-code"), a.page.inner_text(".g-list-sheet")
        _sheet_pick(a, "#g-ok")
        g = a.save()["garden"]
        assert g["program"][0]["args"]["list"]["items"] == ["당근", "감자", "당근", "감자"], g["program"][0]
        assert "당근" in _row_chips(a, fid)[0], _row_chips(a, fid)

        # 맨 바깥 심기는 목록 값이 없음
        a.page.click('.g-add[data-parent=""]')
        _sheet_pick(a, "[data-kind=plant]")
        top_plant = a.save()["garden"]["program"][1]["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=crop]' % top_plant)
        a.page.wait_for_selector(".modal.g-sheet")
        assert not a.page.query_selector('.g-sheet [data-v="__loop"]'), "목록 밖에서는 목록 값 없음"
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        a.page.click('.g-node[data-id="%s"] .g-menu' % top_plant)
        _sheet_pick(a, "[data-act=del]")

        # 목록 안: 빈칸이면 → 심기(crop), 이동
        a.page.click('.g-add[data-parent="%s"][data-slot=body]' % fid)
        _sheet_pick(a, "[data-kind=if]")
        if_id = a.save()["garden"]["program"][0]["body"][0]["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=cond]' % if_id)
        _sheet_pick(a, '[data-v="here_empty"]')
        a.page.click('.g-add[data-parent="%s"][data-slot=body]' % if_id)
        _sheet_pick(a, "[data-kind=plant]")
        pid = a.save()["garden"]["program"][0]["body"][0]["body"][0]["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=crop]' % pid)
        a.page.wait_for_selector('.g-sheet [data-v="__loop"]')
        assert "crop" in a.page.inner_text('.g-sheet [data-v="__loop"]')
        _sheet_ok(a, "garden11-loopvar", "garden11-loopvar.png")
        _sheet_pick(a, '[data-v="__loop"]')
        g = a.save()["garden"]
        assert g["program"][0]["body"][0]["body"][0]["args"]["crop"] == {"loopVar": True, "type": "crop"}, g["program"]
        assert _row_chips(a, pid) == ["crop"], _row_chips(a, pid)
        a.page.click('.g-add[data-parent="%s"][data-slot=body]' % fid)
        _sheet_pick(a, "[data-kind=move]")
        code = _code_preview(a)
        assert code == ('for crop in ["당근", "감자", "당근", "감자"]:\n    if what_here() == "빈칸":\n'
                        '        plant(crop)\n    move("오른쪽")'), code
        assert not a.page.query_selector(".g-node.bad"), a.page.inner_text(".g-flow")
        a.shot("garden11-foreach.png", full=True)
        m = measure(a, "garden11-foreach")
        assert not m["problems"] and not m["small"], (m["problems"], m["small"])
        g = _garden_run(a)
        _close_done(a)
        g = a.save()["garden"]
        assert g["order"]["idx"] == 17 and g["order"]["paid"][-1] == "o_mix", g["order"]
        crops = [c and c["crop"] for c in g["cells"][:4]]
        assert crops == ["당근", "감자", "당근", "감자"], g["cells"][:4]
        assert not a.errors, a.errors


def test_garden11_sayval_default_and_bad_list():
    """새 값 넣어 말하기는 그 자리에서 쓸 수 있는 첫 값으로(없으면 count), 망가진 목록은 저장 정리가 기본 목록으로(v0.11 검토)"""
    prog = [_nd(1, "foreach", list={"type": "crop", "items": []}, body=[_nd(2, "harvest")]),
            _nd(3, "foreach", list={"type": "dir", "items": ["오른쪽"]}, body=[_nd(4, "harvest")])]
    seed = _garden_seed(9, _garden(order_idx=16, program=prog, size=4, upgrades=G11_UP, store={"당근": 44, "감자": 6}))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        g = a.save()["garden"]
        assert g["program"][0]["args"]["list"] == {"type": "crop", "items": ["당근", "감자"]}, g["program"][0]
        # 목록 편집 창이 열리고 기본 목록을 보임
        a.page.click('.g-node[data-id="1"] .g-arg[data-arg=list]')
        a.page.wait_for_selector(".modal.g-list-sheet")
        assert _list_items(a) == ["당근", "감자"], _list_items(a)
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        # 맨 바깥(쓸 수 있는 값 없음) → count
        a.page.click('.g-add[data-parent=""]')
        _sheet_pick(a, "[data-kind=sayval]")
        assert a.save()["garden"]["program"][2]["args"]["var"] == "count", a.save()["garden"]["program"][2]
        # 방향 목록 안 → 목록 값 way
        a.page.click('.g-add[data-parent="3"][data-slot=body]')
        _sheet_pick(a, "[data-kind=sayval]")
        sv = a.save()["garden"]["program"][1]["body"][1]
        assert sv["args"]["var"] == {"loopVar": True, "type": "dir"}, sv
        assert _row_chips(a, sv["id"])[1] == "way", _row_chips(a, sv["id"])
        # 위치 알기 뒤 → x
        a.page.click('.g-add[data-parent=""]')
        _sheet_pick(a, "[data-kind=where]")
        a.page.click('.g-add[data-parent=""]')
        _sheet_pick(a, "[data-kind=sayval]")
        assert a.save()["garden"]["program"][4]["args"]["var"] == "x", a.save()["garden"]["program"][4]
        bad = a.js("() => [...document.querySelectorAll('.g-node.bad')].map(e => e.dataset.id)")
        assert bad == [str(a.save()["garden"]["program"][2]["id"])], bad   # count를 기억하지 않은 맨 바깥 것만
        assert not a.errors, a.errors


def test_garden11_store_cond():
    prog = [_nd(1, "if", cond="can_harvest", body=[_nd(2, "say", text="감자가 모자라")])]
    seed = _garden_seed(9, _garden(order_idx=18, program=prog, size=4, upgrades=G11_UP, store={"당근": 47, "감자": 6}))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        assert "창고 보기 조건 쓰기" in a.page.inner_text(".g-goal"), a.page.inner_text(".g-goal")
        a.page.click('.g-node[data-id="1"] .g-arg[data-arg=cond]')
        a.page.wait_for_selector(".g-sheet .g-storecond")
        assert not a.page.query_selector(".g-storecond.locked")
        assert a.js("() => document.querySelectorAll('.g-varcond [data-var].on').length") == 1
        a.page.click('.g-storecond [data-scrop="감자"]')
        _sheet_ok(a, "garden11-store", "garden11-store.png")
        _sheet_pick(a, "#g-store-ok")
        g = a.save()["garden"]
        assert g["program"][0]["args"]["cond"] == {"store": {"crop": "감자", "op": "<", "num": 10}}, g["program"][0]
        assert _row_chips(a, 1) == ["창고 감자 < 10"], _row_chips(a, 1)
        assert _code_preview(a).startswith('if store()["감자"] < 10:'), _code_preview(a)
        # 다시 열면: 창고 보기에 지금 값, 값 비교는 기본값 하나만(창고 조건을 값 비교로 읽지 않음)
        a.page.click('.g-node[data-id="1"] .g-arg[data-arg=cond]')
        a.page.wait_for_selector(".g-sheet .g-storecond")
        st = a.js("""() => ({ crop: document.querySelector('.g-storecond [data-scrop].on')?.dataset.scrop,
                    num: document.querySelector('#g-step2 .g-num').textContent,
                    varOn: [...document.querySelectorAll('.g-varcond [data-var].on')].map(b => b.dataset.var),
                    basicOn: document.querySelectorAll('.g-pick .g-pick-btn.on').length })""")
        assert st == {"crop": "감자", "num": "10", "varOn": ["count"], "basicOn": 0}, st
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        g = _garden_run(a)
        _close_done(a)
        assert a.save()["garden"]["order"]["paid"][-1] == "o_lowstock", a.save()["garden"]["order"]
        assert not a.errors, a.errors


def test_garden11_store_locked():
    prog = [_nd(1, "if", cond="can_harvest", body=[_nd(2, "harvest")])]
    with App("iPhone 17", save=_garden_seed(7, _garden(order_idx=16, program=prog, size=4, upgrades=G11_UP)), reduced=True) as a:
        _open_garden(a)
        a.page.click('.g-node[data-id="1"] .g-arg[data-arg=cond]')
        a.page.wait_for_selector(".g-sheet .g-storecond.locked")
        txt = a.page.inner_text(".g-storecond")
        assert "창고 보기" in txt and "8장을 끝내면 열려요" in txt, txt
        assert not a.page.query_selector("#g-store-ok"), "잠긴 창고 보기는 고를 수 없음"
        # 위치 알기 전이라 x·y도 없음
        assert not a.page.query_selector('.g-varcond [data-var="x"]')
        a.page.eval_on_selector(".g-storecond", "e => e.scrollIntoView({block: 'end'})")
        _sheet_ok(a, "garden11-store-locked", "garden11-store-locked.png")
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        # 노드 더하기 창: 위치 알기는 9장 잠금
        a.page.click('.g-add[data-parent=""]')
        a.page.wait_for_selector(".modal.g-sheet")
        lk = a.js("() => { const b = document.querySelector('.g-sheet [data-kind=where]'); return [b.disabled, b.innerText]; }")
        assert lk[0] and "9장을 끝내면 열려요" in lk[1], lk
        assert not a.js("() => document.querySelector('.g-sheet [data-kind=foreach]').disabled")
        assert not a.errors, a.errors


def test_garden11_where_pos():
    prog = [_nd(1, "repeat", n=4, body=[_nd(2, "if", cond="can_harvest", body=[_nd(3, "harvest")])])]
    cells = [{"crop": "당근", "planted_at": 0}] * 4 + [None] * 12
    seed = _garden_seed(9, _garden(order_idx=20, program=prog, size=4, upgrades=G11_UP, cells=cells, store={"당근": 47, "감자": 5}))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        # 위치 알기 전의 조건에는 x·y가 없음
        a.page.click('.g-node[data-id="2"] .g-arg[data-arg=cond]')
        a.page.wait_for_selector(".g-sheet .g-varcond")
        assert not a.page.query_selector('.g-varcond [data-var="x"]')
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        a.page.click('.g-add[data-parent="1"][data-slot=body]')
        _sheet_pick(a, "[data-kind=where]")
        assert "x, y가 생겨요" in a.page.inner_text(".g-node[data-kind=where]"), a.page.inner_text(".g-node[data-kind=where]")
        a.page.click('.g-add[data-parent="1"][data-slot=body]')
        _sheet_pick(a, "[data-kind=if]")
        if_id = a.save()["garden"]["program"][0]["body"][2]["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=cond]' % if_id)
        a.page.wait_for_selector('.g-varcond [data-var="x"]')
        vs = a.js("() => [...document.querySelectorAll('.g-varcond [data-var]')].map(b => b.dataset.var)")
        assert "x" in vs and "y" in vs and "crop" not in vs, vs
        a.page.click('.g-varcond [data-var="x"]')
        a.page.click('.g-varcond [data-op="=="]')
        a.page.click('#g-step [data-step="-1"]')
        a.page.click('#g-step [data-step="-1"]')
        _sheet_ok(a, "garden11-poscond", "garden11-poscond.png")
        _sheet_pick(a, "#g-ok")
        assert _row_chips(a, if_id) == ["x == 3"], _row_chips(a, if_id)
        a.page.click('.g-add[data-parent="%s"][data-slot=body]' % if_id)
        _sheet_pick(a, "[data-kind=move]")
        mid = a.save()["garden"]["program"][0]["body"][2]["body"][0]["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=dir]' % mid)
        _sheet_pick(a, '[data-v="아래"]')
        a.page.click('.g-node[data-id="%s"] .g-menu' % if_id)
        _sheet_pick(a, "[data-act=else-on]")
        a.page.click('.g-add[data-parent="%s"][data-slot=orelse]' % if_id)
        _sheet_pick(a, "[data-kind=move]")
        code = _code_preview(a)
        assert ("for i in range(4):\n    if can_harvest():\n        harvest()\n    x, y = where()\n"
                "    if x == 3:\n        move(\"아래\")\n    else:\n        move(\"오른쪽\")") == code, code
        assert not a.page.query_selector(".g-node.bad"), a.page.inner_text(".g-flow")
        a.shot("garden11-where.png", full=True)
        g = _garden_run(a)
        _close_done(a)
        assert a.save()["garden"]["order"]["paid"][-1] == "o_where", a.save()["garden"]["order"]
        assert not a.errors, a.errors


def test_garden11_sayval():
    prog = [_nd(1, "setvar", name="count", value=0),
            _nd(2, "repeat", n=4, body=[_nd(3, "if", cond="can_harvest", body=[_nd(4, "harvest"), _nd(5, "addvar", name="count", value=1)]),
                                        _nd(6, "move", dir="오른쪽")])]
    cells = [{"crop": "당근", "planted_at": 0}] * 4 + [None] * 12
    seed = _garden_seed(9, _garden(order_idx=15, program=prog, size=4, upgrades=G11_UP, cells=cells, store={"당근": 40, "감자": 6}))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        a.page.click('.g-add[data-parent=""]')
        _sheet_pick(a, "[data-kind=sayval]")
        sid = a.save()["garden"]["program"][2]["id"]
        assert _row_chips(a, sid) == ["“당근 ”", "count", "“개”"], _row_chips(a, sid)
        # 앞 글자: 10자 넘으면 막힘, 빈 글자는 됨
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=pre]' % sid)
        a.page.wait_for_selector(".modal.g-sheet input")
        a.page.fill(".modal.g-sheet input", "열한글자가넘는긴글자예요")
        assert a.js("() => document.querySelector('#g-ok').disabled")
        assert "너무 길어요" in a.page.inner_text("#g-text-n")
        a.page.fill(".modal.g-sheet input", "")
        assert not a.js("() => document.querySelector('#g-ok').disabled"), "앞 글자는 비워도 됨"
        a.page.fill(".modal.g-sheet input", "거둔 당근 ")
        assert "6/10" in a.page.inner_text("#g-text-n"), a.page.inner_text("#g-text-n")
        _sheet_ok(a, "garden11-sayval-text", "garden11-sayval-text.png")
        _sheet_pick(a, "#g-ok")
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=post]' % sid)
        a.page.wait_for_selector(".modal.g-sheet input")
        a.page.fill(".modal.g-sheet input", "개!")
        _sheet_pick(a, "#g-ok")
        # 값 고르기: 여기서 쓸 수 있는 값만(count)
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=var]' % sid)
        a.page.wait_for_selector(".g-sheet [data-name]")
        names = a.js("() => [...document.querySelectorAll('.g-sheet [data-name]')].map(b => b.dataset.name)")
        assert names == ["count"], names
        _sheet_ok(a, "garden11-sayval-val", "garden11-sayval-val.png")
        _sheet_pick(a, '[data-name="count"]')
        code = _code_preview(a)
        assert code.endswith('print("거둔 당근 " + str(count) + "개!")'), code
        g = _garden_run(a)
        _close_done(a)
        assert a.save()["garden"]["order"]["paid"][-1] == "o_sayval", a.save()["garden"]["order"]
        assert "거둔 당근 4개!" in a.js("() => document.querySelector('#board svg').textContent")
        a.shot("garden11-sayval.png")
        assert not a.errors, a.errors


def test_garden11_code_error_explain():
    seed = _garden_seed(9, _garden(order_idx=17, size=4, upgrades=G11_UP, mode="code", code='mvoe("오른쪽")\n'))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        note = a.page.inner_text(".g-mode-note")
        assert "store()" in note and "where()" in note, note
        _garden_run(a)
        err = a.page.inner_text(".err-panel")
        assert "NameError" in err and "1번째 줄" in err, err
        assert "모르는 명령" in err and "혹시 move?" in err, err
        a.page.eval_on_selector(".err-panel", "e => e.scrollIntoView({block: 'center'})")
        a.shot("garden11-code-error.png")
        m = measure(a, "garden11-code-error")
        assert not m["problems"] and not m["small"], (m["problems"], m["small"])
        # 텃밭과 상관없는 오류는 기존 설명
        a.set_code('print(1 / 0)\n')
        a.page.wait_for_timeout(700)
        _garden_run(a)
        err = a.page.inner_text(".err-panel")
        assert "ZeroDivisionError" in err and "혹시" not in err, err
        assert not a.errors, a.errors


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
