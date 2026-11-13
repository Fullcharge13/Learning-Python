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
- test_garden_clear_nodes: 「비우기」 확인 창(그만두기 → 그대로 / 지우기 → 빈 프로그램 저장, 다른 텃밭 상태 그대로) →
                 알림 「되돌리기」(5초)로 그대로 복원 · 비면 흐리게 · 코드 모드 숨김 · 재생 중 막힘 · 402px 머리 줄 한 줄.
                 캡처: garden-clear-*.png (iPhone 17)
- test_garden11_*: 텃밭 6~9장(v0.11 작업 4). 목록에서 하나씩(종류 고르기·목록 편집 창: 더하기·6개 한도·←/→·빼기,
                 안쪽 심기에서 「목록 값(crop)」) → 섞어 심기 완료 / 창고 보기 조건(8장 잠금은 흐리게) → 모자란 것만 완료 /
                 위치 알기 뒤 x 비교(앞에서는 x 없음) → 줄 끝에서 내려가기 완료 / 값 넣어 말하기(앞·뒤 글자 10자, 값 고르기)
                 → 수확 보고 완료 / 코드 모드 NameError 오타 → 「혹시 move?」. 새 창 넘침·터치 44px.
                 캡처: garden11-*.png (iPhone 17)
- test_garden12_*: 텃밭 10~12장(v0.12 작업 4). 쪽지함(받은 쪽지 🔒·농장일지 n/2000자·「일지 비우기」 확인) /
                 일지 쓰기(값 없이 글자만) → 농장일지 주문 → 쪽지함에 일지 / 쪽지 읽기 → 줄 나누기 → 반복 int(n) → 심기 crop
                 → 주문서대로 완료 / 토마토 그림·씨앗 봉투가 비면 ValueError 설명 → 시도하기(안 되면 칸)로 잡기 → 완료 /
                 패턴 찾기 고르기 창(정규식 미리보기)·비교 조건에 쪽지 값 없음 → 숫자만 뽑기 완료 / 9장 저장은 토마토 잠김.
                 새 창 넘침·터치 44px. 캡처: garden12-*.png (iPhone 17)
- test_dev_mode: 개발자 모드(v0.11.1). 1장을 끝낸 학습 기록 → 설정 맨 아래 스위치 → 확인 창 「그만두기」는 그대로 →
                 「켜기」 → 모든 화면 위 띠(상태 줄을 가리지 않음) · 새 개발자 저장에서 17-3·13-A1 열림 · 오늘의 도전 ·
                 텃밭 입구·9장 노드(위치 알기) 열림 → 새로고침해도 켜짐 → 끄기(확인 없음) → 학습 기록 원문 그대로·17-3 잠김.
                 설정 켬/끔 넘침·터치 44px. 캡처: dev-*.png (iPhone 17)
- test_guard_room_*: 경비실(v0.15 작업 7, 설계서 2026-11-12). 2장 저장은 텃밭의 경비실 단추가 잠김·「3장을 끝내면 열려요」 /
                 3장 통과 → 하단 텃밭 칸·단추 새 소식 점 → G1 카드(크로우 그림) → 빈칸 하나만 고르면 실행 막고 흔듦 →
                 오답 실행(재생 중 「실행」 막힘, ❌/⚠️ 칸, 칸을 누르면 「왜?」) → 정답 실행 「사건 해결」 XP +5·firstTry false·
                 바이트 그대로(XP 퀘스트 없는 저장, 판정 G-C2) → 직접 쓰기(처음 내용은 빈칸 비운 시작 코드) 해결, how는 처음 값 /
                 재생 중 사건 목록에서 G2로 바꾸면 결과 비움 / 영어 화면에 한글 없음(시도 값 포함) / 움직임 줄이기는 재생 없음.
                 넘침·터치 44px·콘솔 오류 0. 캡처: guard-*.png, docs/img/guard-g1.png·guard-replay.png (iPhone 17)
- test_guard_room_load_fail_retry / _switch_while_loading: v0.16.0 작업 2. 사건 본문은 장 파일(guard/chN-*.json)에서 받는다.
                 장 파일을 막으면 「사건을 불러오지 못했어요」+「다시 시도」 → 풀고 다시 시도하면 카드 / 3장 파일이 늦는 동안
                 4장 G3으로 바꾸면 늦게 온 G1 카드는 그리지 않는다. 캡처: guard-load-fail.png
- test_guard_room_file_case / _json_case / _list_45 / _locked_chapters: v0.16.0 작업 8. 11장 저장 → 목록에서 G25(파일
                 blocklist.txt)를 빈칸 정답으로 「사건 해결」(firstTry) / 14장 저장 → G34(주문 JSON) 해결 / 17장 저장 → 머리
                 「0/45 해결」, 목록 45개 장 순서·모두 열림 / 6장 저장 → 7장 사건 G13~G15 「7장을 끝내면 열려요」 잠김.
                 캡처: guard-file-case.png·guard-json-case.png·guard-list-45.png
- test_editor_slot_slow / _fail: v0.17.0 작업 2. 편집기는 따로 받는 묶음(js/editor-<지문>.js). 늦으면 시작 코드 글자 +
                 「코드 입력창 준비 중…」, 「실행」「제출」·기호 줄 꺼짐 → 오면 편집기(레슨·텃밭 코드·경비실 직접 쓰기) /
                 연결 끊김 → 「다시 시도」로 열림, 404 → 「새로 고침」. 영어판 한글 없음. 캡처: editor-wait-*.png·editor-fail.png·editor-stale.png
"""

import atexit
import datetime
import functools
import http.server
import json
import os
import re
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
DEV_FLAG_KEY = "ria-python.dev"
DEV_SAVE_KEY = "ria-python.dev.save"
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

    def __init__(self, device="iPhone 17", save=None, reduced=False, url=None, locale=None, init_js=None, routes=()):
        e = env()
        opts = device_opts(device)
        opts["locale"] = locale or "ko-KR"   # v0.14.0: 처음 언어는 휴대폰 언어를 따른다 → 기본은 한국어 휴대폰
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
        if init_js:
            self.page.add_init_script(init_js)
        for pat, handler in routes:   # v0.17.0: 첫 화면 뒤 미리 받기(묶음 파일)까지 가로채려면 열기 전에
            self.page.route(pat, handler)
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
                if hook:
                    hook("result-wrong" if bad else "result", self)   # v0.14.0: 맞음·틀림 설명 화면도 보게
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


def _settle_animations(app, ms=1200):
    """끝나는 CSS 움직임(창이 아래에서 올라오는 up .22s 등)이 끝날 때까지 기다림(v0.12.1 QA: 확인 창을 연 바로 뒤
    재면 단추가 올라오는 도중이라 화면 밖으로 잡혔음). 무한 반복 움직임은 기다리지 않고, 길어도 ms까지만."""
    app.page.evaluate("""(ms) => Promise.race([
        Promise.all(document.getAnimations().filter(a => a.effect && a.effect.getComputedTiming().iterations !== Infinity)
            .map(a => a.finished.catch(() => null))),
        new Promise(r => setTimeout(r, ms))])""", ms)


def measure(app, screen):
    _settle_animations(app)
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


def _to_write(a, lid="1-1", ready=".item.write .cm-content"):
    """lid 레슨을 직접 작성 문제까지 진행(ready: 다 왔다고 볼 표시. 편집기를 기다리는 시험은 ".item.write")"""
    items = a.lesson(lid)["items"]
    for _ in range(40):
        a.page.wait_for_timeout(80)
        if a.page.query_selector(ready):
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
    # 나) 설정에서 목표를 낮춰도 오늘은 인정하지 않음(v0.12.1 QA 4: 새 목표는 내일부터) → 축하 창 없음, 6일 그대로
    seed2 = dict(seed, streak=dict(seed["streak"], todayXp=12))
    with App("iPhone 17", save=seed2) as a:
        a.start()
        a.page.click('[data-go="settings"]')
        a.page.wait_for_selector(".screen.settings")
        a.page.click('[data-g="10"]')
        a.page.wait_for_selector("#goal-note")
        a.page.wait_for_timeout(300)
        if a.page.query_selector(".celebrate"):
            fails.append("settings path: celebration opened on goal change")
        after = a.page.inner_text(".status .stat.flame b")
        if after != "6":
            fails.append("settings path: status shows %s (want 6)" % after)
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
        assert "/17" in a.page.inner_text(".page-title"), a.page.inner_text(".page-title")
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
    a.page.click('.tabbar [data-go="garden"]')  # v0.12.6: 홈 카드 대신 하단 「텃밭」 칸
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
    """v0.12.6: 홈에는 텃밭 카드가 없고, 1장 전에는 하단 「텃밭」 칸이 잠김(자물쇠·안내 이름표)."""
    with App("iPhone 17") as a:
        a.start()
        assert not a.page.query_selector(".garden-card"), "홈 텃밭 카드 없음"
        t = a.page.query_selector('.tabbar [data-go="garden"]')
        assert t and t.get_attribute("data-locked") == "1", "텃밭 칸 잠김"
        assert "1장을 끝내면 열려요" in t.get_attribute("aria-label"), t.get_attribute("aria-label")
        assert t.query_selector(".tab-lock"), "자물쇠"
        m = measure(a, "home-garden-locked")
        assert not m["problems"], m["problems"]
        assert not a.errors, a.errors


def test_garden_first_orders():
    with App("iPhone 17", save=_garden_seed(1, xp=40)) as a:
        a.start()
        assert not a.page.query_selector(".garden-card"), "홈 텃밭 카드 없음(v0.12.6)"
        a.shot("garden-home.png")
        box = a.page.eval_on_selector('.tabbar [data-go="garden"]', "e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }")
        assert box[0] >= 44 and box[1] >= 44, box
        a.page.click('.tabbar [data-go="garden"]')
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


def _clear_btn(a):
    return a.js("""() => { const b = document.querySelector('#g-clear'); if (!b) return null;
        const r = b.getBoundingClientRect();
        return { text: b.innerText.trim(), aria: b.getAttribute('aria-label'), dis: b.disabled,
                 ariaDis: b.getAttribute('aria-disabled'), visible: !!b.offsetParent, inert: !!b.closest('[inert]'),
                 w: r.width, h: r.height }; }""")


def _toast_undo(a):
    return a.page.query_selector("#toasts .toast-act")


def test_garden_clear_nodes():
    # 「비우기」: 확인 창(그만두기 → 그대로 / 지우기 → 빈 프로그램 저장) → 알림 「되돌리기」(5초) → 그대로 돌아옴.
    # 비었으면 흐리게(aria-disabled), 코드 모드에서는 숨김, 재생 중에는 다른 단추처럼 막힘. 머리 줄은 402px에 넘침 없음.
    prog = [
        _nd(1, "repeat", n=2, body=[_nd(2, "move", dir="오른쪽")]),
        _nd(3, "if", cond="can_harvest", body=[_nd(4, "harvest")], orelse=[_nd(5, "say", text="아직")]),
        _nd(6, "move", dir="아래"),
    ]
    with App("iPhone 17", save=_garden_seed(5, _garden(order_idx=12, program=prog, store={"당근": 3}))) as a:
        _open_garden(a)
        b = _clear_btn(a)
        assert b and b["text"] == "비우기" and b["aria"] == "노드 모두 지우기" and not b["dis"], b
        assert b["w"] >= 44 and b["h"] >= 44, b
        # 머리 줄 순서: 제목 → 비우기 → 코드로 쓰기, 같은 줄
        head = a.js("""() => [...document.querySelectorAll('.g-prog-head > *')].map(e => {
            const r = e.getBoundingClientRect(); return [e.tagName === "H2" ? "H2" : e.id, Math.round(r.top), Math.round(r.bottom), Math.round(r.right), Math.round(r.width)]; })""")
        assert [h[0] for h in head] == ["H2", "g-clear", "to-code"], head
        mids = [(h[1] + h[2]) / 2 for h in head]
        assert max(mids) - min(mids) <= 4, ("one row", head)
        assert a.js("() => window.innerWidth") == 402
        a.page.eval_on_selector(".g-prog-head", "e => e.scrollIntoView({block: 'center'})")
        a.page.wait_for_timeout(150)
        a.shot("garden-clear-head.png")
        m = measure(a, "garden-clear-head")
        assert not m["problems"], m["problems"]
        assert not m["small"], m["small"]
        before = a.save()["garden"]

        # 재생 중에는 막힘(노드 흐름 전체가 inert)
        a.wait_py()
        a.page.click("#g-run")
        a.page.wait_for_selector(".screen.garden[data-state=replay]", timeout=30_000)
        assert _clear_btn(a)["inert"], "inert during replay"
        a.page.click("#g-skip")
        a.page.wait_for_selector(".screen.garden[data-state=idle]", timeout=30_000)
        a.page.wait_for_timeout(300)
        while a.page.query_selector(".modal .g-done-body"):  # 주문 완료 창이 뜨면 닫기
            _close_done(a)
            a.page.wait_for_timeout(300)
        assert not _clear_btn(a)["inert"]
        before = a.save()["garden"]
        assert before["program"] == prog, before["program"]

        # 그만두기 → 그대로
        _clear_toasts(a)  # 배지 알림이 캡처를 가리지 않게
        a.page.click("#g-clear")
        a.page.wait_for_selector(".modal")
        assert a.page.inner_text(".modal h2") == "노드 6개를 모두 지울까요?", a.page.inner_text(".modal h2")
        labels = a.js("() => [...document.querySelectorAll('.modal .modal-actions button')].map(b => b.innerText.trim())")
        assert labels == ["그만두기", "지우기"], labels
        a.shot("garden-clear-confirm.png")
        m = measure(a, "garden-clear-confirm")
        assert not m["problems"], m["problems"]
        assert not m["small"], m["small"]
        a.page.click(".modal button:has-text('그만두기')")
        a.page.wait_for_selector(".modal", state="detached")
        assert a.save()["garden"]["program"] == prog
        assert len(a.page.query_selector_all(".g-node")) == 6

        # 지우기 → 빈 프로그램, 다른 텃밭 상태는 그대로, 결과 칸·말풍선 지움, 알림 + 되돌리기
        a.page.click("#g-clear")
        a.page.click(".modal button:has-text('지우기')")
        a.page.wait_for_selector(".modal", state="detached")
        g = a.save()["garden"]
        assert g["program"] == [], g["program"]
        for k in ("store", "order", "cells", "pie", "clock", "upgrades", "size", "runs", "mode"):
            assert g[k] == before[k], (k, g[k], before[k])
        assert len(a.page.query_selector_all(".g-node")) == 0
        assert "노드 0/" in a.page.inner_text(".g-count")
        assert "「실행」을 누르면" in a.page.inner_text("#g-result"), a.page.inner_text("#g-result")
        assert not a.page.query_selector("#board .g-bubble")
        b = _clear_btn(a)
        assert b["dis"] and b["ariaDis"] == "true" and b["visible"], b
        t = a.page.inner_text("#toasts")
        assert "노드를 모두 지웠어요" in t and "되돌리기" in t, t
        a.shot("garden-clear-toast.png")
        m = measure(a, "garden-clear-toast")
        assert not m["problems"], m["problems"]
        assert not m["small"], m["small"]
        a.shot("garden-clear-empty.png")

        # 되돌리기 → 그대로(저장도), 알림 닫힘
        _toast_undo(a).click()
        a.page.wait_for_timeout(150)
        assert a.save()["garden"]["program"] == prog, a.save()["garden"]["program"]
        assert len(a.page.query_selector_all(".g-node")) == 6
        assert not _toast_undo(a), "toast closes after undo"
        assert not _clear_btn(a)["dis"]

        # 다시 지우고 5초 기다리면 알림이 사라지고 빈 채로 남음. 빈 단추는 눌러도 창이 없음
        a.page.click("#g-clear")
        a.page.click(".modal button:has-text('지우기')")
        a.page.wait_for_selector(".modal", state="detached")
        assert _toast_undo(a)
        a.page.wait_for_timeout(5300)
        assert not _toast_undo(a), "undo toast gone after 5 s"
        assert a.save()["garden"]["program"] == []
        a.page.click("#g-clear", force=True)
        a.page.wait_for_timeout(200)
        assert not a.page.query_selector(".modal"), "disabled when empty"

        # 코드 모드에서는 숨김
        a.page.click("#to-code")
        a.page.wait_for_selector(".g-editor .cm-content")
        b = _clear_btn(a)
        assert b is None or not b["visible"], b
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


# ---------------------------------------------------------------- 텃밭 10~12장 (v0.12 작업 4)

G12_ORDER_IDS = ["o_first", "o_hello", "o_plant", "o_lunch", "o_count", "o_row", "o_soup", "o_if", "o_potato",
                 "o_grid4", "o_def", "o_def_row", "o_repeat", "o_while", "o_all",
                 "o_sayval", "o_mix", "o_patrol", "o_lowstock", "o_potato_book", "o_where", "o_zigzag",
                 "o_tomato", "o_try", "o_note", "o_log", "o_readlog", "o_hand", "o_digits"]


def _garden12(order_idx, program=None, cells=None, store=None, seeds=5, journal="", pie=None, runs=0):
    g = _garden(order_idx=order_idx, program=program if program is not None else [], size=4, upgrades=G11_UP, cells=cells,
                store={"당근": 70, "감자": 6, "토마토": 1, **(store or {})})
    g["order"] = {"idx": order_idx, "done": G12_ORDER_IDS[:order_idx], "paid": G12_ORDER_IDS[:order_idx]}
    g["seeds"] = seeds
    g["files"] = {"농장일지.txt": journal}
    g["runs"] = runs
    if pie:
        g["pie"] = pie
    return g


def _prog_at(a, *path):
    """save.garden.program에서 경로(번호·"body"·"handler")를 따라간 노드"""
    n = a.save()["garden"]["program"]
    for p in path:
        n = n[p]
    return n


def _add(a, parent, slot, kind):
    a.page.click('.g-add[data-parent="%s"][data-slot=%s]' % ("" if parent is None else parent, slot))
    _sheet_pick(a, "[data-kind=%s]" % kind)


def _notes_open(a):
    a.page.click("#g-notes")
    a.page.wait_for_selector(".modal.g-notes-sheet")


def _note_text(a, file):
    return a.js("(f) => { const e = document.querySelector(`.g-notes-sheet [data-file=\"${f}\"] .g-note-text`); return e && e.textContent; }", file)


def test_garden12_notes_box():
    seed = _garden_seed(12, _garden12(25, journal="수확 4개\n"))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        box = a.page.eval_on_selector("#g-notes", "e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }")
        assert box[0] >= 44 and box[1] >= 44, box
        assert "씨앗 5" in a.page.inner_text("#g-seeds"), a.page.inner_text("#g-seeds")
        assert a.page.query_selector('#g-store [data-crop="토마토"]'), "10장 뒤 창고에 토마토"
        a.shot("garden12-top.png")
        _notes_open(a)
        files = a.js("() => [...document.querySelectorAll('.g-notes-sheet [data-file]')].map(e => e.dataset.file)")
        assert files == ["주문서.txt", "손글씨주문.txt", "농장일지.txt"], files
        # 받는 쪽지: 지금 주문(o_log)에 쪽지가 없으니 오늘의 쪽지(runs 0) — 읽기만
        assert _note_text(a, "주문서.txt") == "당근 2\n감자 1", _note_text(a, "주문서.txt")
        assert _note_text(a, "손글씨주문.txt") == "리아: 당근2개 부탁해요!", _note_text(a, "손글씨주문.txt")
        for f in ("주문서.txt", "손글씨주문.txt"):
            assert "받은 쪽지" in a.page.inner_text('.g-notes-sheet [data-file="%s"] h3' % f)
        assert _note_text(a, "농장일지.txt") == "수확 4개\n", _note_text(a, "농장일지.txt")
        assert "6/2000자" in a.page.inner_text("#g-log-n"), a.page.inner_text("#g-log-n")
        ws = a.js("() => getComputedStyle(document.querySelector('.g-notes-sheet .g-note-text')).whiteSpace")
        assert ws in ("pre-wrap", "break-spaces"), ws
        _sheet_ok(a, "garden12-notes", "garden12-notes.png")
        # 비우기: 확인에서 그만두기 → 그대로
        a.page.click("#g-log-clear")
        a.page.wait_for_selector("#g-log-yes")
        _sheet_ok(a, "garden12-notes-confirm", "garden12-notes-confirm.png")
        a.page.click("#g-log-no")
        assert a.save()["garden"]["files"]["농장일지.txt"] == "수확 4개\n"
        assert a.page.is_visible("#g-log-clear")
        # 비우기 → 빈 일지 저장
        a.page.click("#g-log-clear")
        a.page.click("#g-log-yes")
        a.page.wait_for_selector("#g-log-clear[disabled]")
        assert a.save()["garden"]["files"]["농장일지.txt"] == ""
        assert "0/2000자" in a.page.inner_text("#g-log-n")
        assert "비어 있어요" in a.page.inner_text('.g-notes-sheet [data-file="농장일지.txt"]')
        assert a.save()["garden"]["order"]["idx"] == 25, "다른 텃밭 상태 그대로"
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        assert not a.errors, a.errors


def test_garden12_writelog_journal():
    prog = [_nd(1, "setvar", name="count", value=0),
            _nd(2, "repeat", n=4, body=[_nd(3, "if", cond="can_harvest", body=[_nd(4, "harvest"), _nd(5, "addvar", name="count", value=1)]),
                                        _nd(6, "move", dir="오른쪽")])]
    cells = [{"crop": "당근", "planted_at": 0}] * 4 + [None] * 12
    seed = _garden_seed(12, _garden12(25, program=prog, cells=cells))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        assert "일지에 한 줄 이상 쓰기" in a.page.inner_text(".g-goal"), a.page.inner_text(".g-goal")
        _add(a, None, "body", "writelog")
        wid = _prog_at(a, 2)["id"]
        assert _row_chips(a, wid) == ["“수확 ”", "count", "“개”"], _row_chips(a, wid)
        # 값 고르기: count + 「값 없이 글자만」
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=var]' % wid)
        a.page.wait_for_selector(".g-sheet [data-name]")
        names = a.js("() => [...document.querySelectorAll('.g-sheet [data-name]')].map(b => b.dataset.name)")
        assert names == ["count"], names
        assert a.page.query_selector('.g-sheet [data-v="none"]'), "값 없이 글자만"
        _sheet_ok(a, "garden12-writelog-val", "garden12-writelog-val.png")
        _sheet_pick(a, '[data-v="none"]')
        assert _prog_at(a, 2)["args"]["var"] is None
        assert _row_chips(a, wid)[1] == "값 없음", _row_chips(a, wid)
        assert _code_preview(a).endswith('    f.write("수확 개\\n")'), _code_preview(a)
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=var]' % wid)
        _sheet_pick(a, '[data-name="count"]')
        code = _code_preview(a)
        assert code.endswith('with open("농장일지.txt", "a") as f:\n    f.write("수확 " + str(count) + "개\\n")'), code
        a.shot("garden12-writelog.png", full=True)
        _garden_run(a)
        _close_done(a)
        g = a.save()["garden"]
        assert g["order"]["paid"][-1] == "o_log", g["order"]
        assert g["files"]["농장일지.txt"] == "수확 4개\n", g["files"]
        _notes_open(a)
        assert _note_text(a, "농장일지.txt") == "수확 4개\n"
        a.shot("garden12-journal.png")
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        assert not a.errors, a.errors


def test_garden12_note_order():
    seed = _garden_seed(12, _garden12(24))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        assert "쪽지에 적힌 대로 심기" in a.page.inner_text(".g-goal"), a.page.inner_text(".g-goal")
        _add(a, None, "body", "readnote")
        rid = _prog_at(a, 0)["id"]
        assert _row_chips(a, rid) == ["주문서.txt"], _row_chips(a, rid)
        assert "line이 생겨요" in a.page.inner_text('.g-node[data-id="%s"]' % rid)
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=file]' % rid)
        a.page.wait_for_selector(".modal.g-sheet [data-v]")
        opts = a.js("() => [...document.querySelectorAll('.g-sheet [data-v]')].map(b => b.dataset.v)")
        assert opts == ["주문서.txt", "손글씨주문.txt", "농장일지.txt"], opts
        _sheet_ok(a, "garden12-file", "garden12-file.png")
        _sheet_pick(a, '[data-v="주문서.txt"]')
        _add(a, rid, "body", "splitline")
        sid = _prog_at(a, 0, "body", 0)["id"]
        assert "crop, n이 생겨요" in a.page.inner_text('.g-node[data-id="%s"]' % sid)
        _add(a, rid, "body", "repeat")
        pid = _prog_at(a, 0, "body", 1)["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=n]' % pid)
        a.page.wait_for_selector('.g-sheet [data-v="__note"]')
        assert "쪽지 값 n번" in a.page.inner_text('.g-sheet [data-v="__note"]')
        _sheet_ok(a, "garden12-repeat-n", "garden12-repeat-n.png")
        _sheet_pick(a, '[data-v="__note"]')
        assert _prog_at(a, 0, "body", 1)["args"]["n"] == {"value": "n"}
        assert _row_chips(a, pid) == ["int(n)번"], _row_chips(a, pid)
        _add(a, pid, "body", "plant")
        plid = _prog_at(a, 0, "body", 1, "body", 0)["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=crop]' % plid)
        a.page.wait_for_selector('.g-sheet [data-v="__note"]')
        assert "쪽지 값" in a.page.inner_text('.g-sheet [data-v="__note"]') and "crop" in a.page.inner_text('.g-sheet [data-v="__note"]')
        assert not a.js("() => document.querySelector('.g-sheet [data-v=\"토마토\"]').disabled"), "10장 뒤 토마토 열림"
        _sheet_ok(a, "garden12-plant-note", "garden12-plant-note.png")
        _sheet_pick(a, '[data-v="__note"]')
        assert _prog_at(a, 0, "body", 1, "body", 0)["args"]["crop"] == {"noteVar": "crop"}
        assert _row_chips(a, plid) == ["crop"], _row_chips(a, plid)
        _add(a, pid, "body", "move")
        code = _code_preview(a)
        assert code == ('with open("주문서.txt") as f:\n    for line in f:\n        crop, n = line.split()\n'
                        '        for i in range(int(n)):\n            plant(crop)\n            move("오른쪽")'), code
        assert not a.page.query_selector(".g-node.bad"), a.page.inner_text(".g-flow")
        a.shot("garden12-note-prog.png", full=True)
        m = measure(a, "garden12-note-prog")
        assert not m["problems"] and not m["small"], (m["problems"], m["small"])
        # 쪽지 읽기 밖 심기에는 쪽지 값이 없음
        _add(a, None, "body", "plant")
        top = _prog_at(a, 1)["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=crop]' % top)
        a.page.wait_for_selector(".modal.g-sheet")
        assert not a.page.query_selector('.g-sheet [data-v="__note"]')
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        a.page.click('.g-node[data-id="%s"] .g-menu' % top)
        _sheet_pick(a, "[data-act=del]")
        _garden_run(a)
        _close_done(a)
        g = a.save()["garden"]
        assert g["order"]["paid"][-1] == "o_note", g["order"]
        assert [c and c["crop"] for c in g["cells"][:4]] == ["당근", "당근", "감자", None], g["cells"][:4]
        assert not a.errors, a.errors


def test_garden12_tomato_seeds_try():
    prog = [_nd(1, "repeat", n=4, body=[_nd(2, "plant", crop="토마토"), _nd(3, "move", dir="오른쪽")])]
    cells = [None] * 4 + [None, {"crop": "토마토", "planted_at": 0}, {"crop": "토마토", "planted_at": 15}, {"crop": "토마토", "planted_at": 19}] + [None] * 8
    seed = _garden_seed(12, _garden12(23, program=prog, cells=cells, seeds=2))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        stages = a.js("() => [...document.querySelectorAll('#board [data-crop=\"토마토\"]')].map(e => e.dataset.stage)")
        assert stages == ["ripe", "grow", "seed"], stages
        assert "씨앗 2" in a.page.inner_text("#g-seeds")
        a.page.eval_on_selector(".g-board", "e => e.scrollIntoView({block: 'start'})")
        a.shot("garden12-tomato.png")
        g = _garden_run(a)
        assert g["seeds"] == 0, g["seeds"]
        assert "씨앗 0" in a.page.inner_text("#g-seeds")
        err = a.page.inner_text(".err-panel")
        assert "ValueError" in err and "토마토 씨앗 없음" in err and "시도하기" in err, err
        assert "토마토 씨앗이 떨어졌어요" in a.js("() => document.querySelector('#board svg').textContent")
        a.page.eval_on_selector(".err-panel", "e => e.scrollIntoView({block: 'center'})")
        a.shot("garden12-seed-error.png")
        m = measure(a, "garden12-seed-error")
        assert not m["problems"] and not m["small"], (m["problems"], m["small"])
        # 시도하기: 안 되면 칸
        _add(a, 1, "body", "try")
        tid = _prog_at(a, 0, "body", 2)["id"]
        assert a.page.inner_text('.g-item:has(> .g-node[data-id="%s"]) > .g-else' % tid).strip() == "안 되면"
        assert a.page.query_selector('.g-add[data-parent="%s"][data-slot=handler]' % tid)
        assert len(a.page.query_selector_all('.g-node[data-id="%s"] .g-err span' % tid)) >= 1, "빈 칸 오류"
        _add(a, tid, "body", "plant")
        b = _prog_at(a, 0, "body", 2, "body", 0)["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=crop]' % b)
        _sheet_pick(a, '[data-v="토마토"]')
        _add(a, tid, "handler", "plant")
        assert _prog_at(a, 0, "body", 2, "handler", 0)["args"]["crop"] == "당근"
        a.page.click('.g-node[data-id="2"] .g-menu')
        _sheet_pick(a, "[data-act=del]")
        a.page.click('.g-node[data-id="%s"] .g-menu' % tid)
        _sheet_pick(a, "[data-act=up]")
        code = _code_preview(a)
        assert code == ('for i in range(4):\n    try:\n        plant("토마토")\n    except ValueError:\n        plant("당근")\n'
                        '    move("오른쪽")'), code
        assert not a.page.query_selector(".g-node.bad"), a.page.inner_text(".g-flow")
        a.shot("garden12-try.png", full=True)
        m = measure(a, "garden12-try")
        assert not m["problems"] and not m["small"], (m["problems"], m["small"])
        _garden_run(a)
        _close_done(a)
        g = a.save()["garden"]
        assert g["order"]["paid"][-1] == "o_try", g["order"]
        assert not a.page.query_selector(".err-panel")
        assert not a.errors, a.errors


def test_garden12_findall_pattern():
    seed = _garden_seed(12, _garden12(28))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        assert "패턴 찾기" in a.page.inner_text(".g-goal") and "숫자만" in a.page.inner_text(".g-goal"), a.page.inner_text(".g-goal")
        _notes_open(a)
        assert _note_text(a, "손글씨주문.txt") == "리아: 감자4개랑 당근 1개 줄래요?"
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        _add(a, None, "body", "readnote")
        rid = _prog_at(a, 0)["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=file]' % rid)
        _sheet_pick(a, '[data-v="손글씨주문.txt"]')
        _add(a, rid, "body", "findall")
        fid = _prog_at(a, 0, "body", 0)["id"]
        assert _row_chips(a, fid) == ["작물+숫자"], _row_chips(a, fid)
        assert "crop, n이 생겨요" in a.page.inner_text('.g-node[data-id="%s"]' % fid)
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=pattern]' % fid)
        a.page.wait_for_selector(".modal.g-pattern-sheet")
        opts = a.js("() => [...document.querySelectorAll('.g-sheet [data-v]')].map(b => [b.dataset.v, b.innerText.replace(/\\s+/g, ' ').trim()])")
        assert [o[0] for o in opts] == ["crop_num", "num", "crop"], opts
        assert "숫자만" in opts[1][1] and "\\d+" in opts[1][1], opts
        _sheet_ok(a, "garden12-pattern", "garden12-pattern.png")
        _sheet_pick(a, '[data-v="num"]')
        assert _row_chips(a, fid) == ["숫자만"], _row_chips(a, fid)
        assert "n이 생겨요" in a.page.inner_text('.g-node[data-id="%s"]' % fid)
        # 비교 조건에는 쪽지 값(line·crop)이 나오지 않음
        _add(a, fid, "body", "if")
        iid = _prog_at(a, 0, "body", 0, "body", 0)["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=cond]' % iid)
        a.page.wait_for_selector(".g-sheet .g-varcond")
        vs = a.js("() => [...document.querySelectorAll('.g-varcond [data-var]')].map(b => b.dataset.var)")
        assert "line" not in vs and "crop" not in vs, vs
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        a.page.click('.g-node[data-id="%s"] .g-menu' % iid)
        _sheet_pick(a, "[data-act=del]")
        _add(a, fid, "body", "sayval")
        vid = _prog_at(a, 0, "body", 0, "body", 0)["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=var]' % vid)
        a.page.wait_for_selector(".g-sheet [data-name]")
        names = a.js("() => [...document.querySelectorAll('.g-sheet [data-name]')].map(b => b.dataset.name)")
        assert names == ["line", "n"], names
        assert "쪽지 값" in a.page.inner_text('.g-sheet [data-name="n"]')
        _sheet_pick(a, '[data-name="n"]')
        code = _code_preview(a)
        assert code.startswith('import re\nwith open("손글씨주문.txt") as f:\n    for line in f:\n'
                               '        for n in re.findall(r"\\d+", line):\n            print('), code
        a.shot("garden12-findall.png", full=True)
        _garden_run(a)
        _close_done(a)
        assert a.save()["garden"]["order"]["paid"][-1] == "o_digits", a.save()["garden"]["order"]
        assert not a.errors, a.errors


def test_garden12_tomato_locked():
    seed = _garden_seed(9, _garden(order_idx=21, program=[], size=4, upgrades=G11_UP, store={"당근": 50, "감자": 5}))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        assert not a.page.query_selector('#g-store [data-crop="토마토"]'), "10장 전 창고에 토마토 없음"
        assert not a.page.query_selector("#g-seeds") or not a.page.is_visible("#g-seeds")
        assert not a.page.query_selector("#g-notes") or not a.page.is_visible("#g-notes")
        _add(a, None, "body", "plant")
        a.page.click(".g-node[data-kind=plant] .g-arg[data-arg=crop]")
        a.page.wait_for_selector('.g-sheet [data-v="토마토"]')
        t = a.js("() => { const b = document.querySelector('.g-sheet [data-v=\"토마토\"]'); return [b.disabled, b.innerText]; }")
        assert t[0] and "10장을 끝내면 열려요" in t[1], t
        _sheet_ok(a, "garden12-locked", "garden12-locked.png")
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        assert not a.errors, a.errors


def test_garden12_review_c71_before_notes():
    """C71 I1: 10장 전 코드 모드 plant("토마토")는 잠김 오류(씨앗 그대로), 11장 전에는 쪽지함을 넘기지 않아 일지가 그대로"""
    code = 'open("농장일지.txt", "a").write("새")\nplant("토마토")\n'
    g = _garden(order_idx=21, program=[], size=4, upgrades=G11_UP, store={"당근": 50, "감자": 5}, mode="code", code=code)
    g["seeds"] = 5
    g["files"] = {"농장일지.txt": "옛\n"}
    with App("iPhone 17", save=_garden_seed(9, g), reduced=True) as a:
        _open_garden(a)
        a.page.wait_for_selector(".g-editor .cm-content")
        out = _garden_run(a)
        assert out["files"] == {"농장일지.txt": "옛\n"}, out["files"]
        assert out["seeds"] == 5 and out["clock"] == 21, (out["seeds"], out["clock"])
        assert all(c is None for c in out["cells"]), out["cells"]
        err = a.page.inner_text(".err-panel")
        assert "ValueError" in err and "10장" in err, err
        assert not a.errors, a.errors


def test_garden12_review_c71_seedpack_and_a11y():
    """C71 C2 씨앗 5개 사기(성장 창, 지금 씨앗 표시) · I4 쪽지 글 영역 · 씨앗 표시에 aria-label 없음 · 빈 쪽지 대비"""
    g = _garden12(26, seeds=0, store={"당근": 12}, journal="")
    with App("iPhone 17", save=_garden_seed(12, g), reduced=True) as a:
        _open_garden(a)
        assert a.js("() => document.querySelector('#g-seeds').getAttribute('aria-label')") is None
        assert "씨앗 0" in a.page.inner_text("#g-seeds")
        a.page.click("#g-grow")
        a.page.wait_for_selector(".modal.g-sheet")
        info = a.js("""() => Object.fromEntries([...document.querySelectorAll('.g-sheet [data-up]')].map(b =>
                      [b.dataset.up, { dis: b.disabled, text: b.closest('.g-up').innerText }]))""")
        assert "seedpack" in info, info
        assert not info["seedpack"]["dis"], info
        assert "토마토 씨앗 5개" in info["seedpack"]["text"] and "지금 0/20개" in info["seedpack"]["text"], info
        a.page.eval_on_selector('.g-sheet [data-up="seedpack"]', "b => b.closest('.g-up').scrollIntoView({block: 'center'})")
        _sheet_ok(a, "garden12-seedpack", "garden12-seedpack.png")
        a.page.click('.g-sheet [data-up="seedpack"]')
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        sv = a.save()["garden"]
        assert sv["seeds"] == 5 and sv["store"]["당근"] == 7 and "seedpack" not in sv["upgrades"], sv
        assert "씨앗 5" in a.page.inner_text("#g-seeds")
        # 한 번 더 사면 10, 당근 2 → 그다음은 모자람
        a.page.click("#g-grow")
        a.page.wait_for_selector(".modal.g-sheet")
        a.page.click('.g-sheet [data-up="seedpack"]')
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        assert a.save()["garden"]["seeds"] == 10
        a.page.click("#g-grow")
        a.page.wait_for_selector(".modal.g-sheet")
        t = a.js("() => { const b = document.querySelector('.g-sheet [data-up=\"seedpack\"]'); return [b.disabled, b.closest('.g-up').innerText]; }")
        assert t[0] and "모자라요" in t[1] and "지금 10/20개" in t[1], t
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        # 쪽지함: 글 영역은 초점을 받고(스크롤) 이름이 있으며, 받은 쪽지 칸은 제목으로 이름 붙음
        _notes_open(a)
        regions = a.js("""() => [...document.querySelectorAll('.g-notes-sheet .g-note-text')].map(e =>
                       [e.closest('[data-file]').dataset.file, e.getAttribute('tabindex'), e.getAttribute('role'), e.getAttribute('aria-label')])""")
        for f, tab, role, label in regions:
            assert tab == "0" and role == "region" and label == f + " 내용", regions
        labelled = a.js("""() => [...document.querySelectorAll('.g-notes-sheet section.g-file')].map(s => {
                        const id = s.getAttribute('aria-labelledby'); const h = id && document.getElementById(id);
                        return [s.dataset.file, !!h && s.contains(h)]; })""")
        assert all(ok for _f, ok in labelled) and len(labelled) == 3, labelled
        color = a.js("() => getComputedStyle(document.querySelector('.g-notes-sheet .g-note-empty')).color")
        assert color == "rgb(107, 101, 89)", color
        _sheet_ok(a, "garden12-notes-a11y")
        assert not a.errors, a.errors


# ---------------------------------------------------------------- 텃밭 QA 고침 (v0.12.1)

def test_garden121_confirm_in_view():
    """비우기 확인 창: 아래로 스크롤된 화면에서 연 바로 뒤에 재도 단추가 화면 안(올라오는 움직임이 끝난 뒤 잼)"""
    prog = [_nd(1, "repeat", n=2, body=[_nd(2, "move", dir="오른쪽")]), _nd(3, "move", dir="아래")]
    with App("iPhone 17", save=_garden_seed(5, _garden(order_idx=12, program=prog))) as a:
        _open_garden(a)
        a.page.click("#g-clear")
        a.page.wait_for_selector(".modal .modal-actions button")
        m = measure(a, "garden121-clear-confirm")
        assert not m["problems"], m["problems"]
        r = a.js("""() => [...document.querySelectorAll('.modal .modal-actions button')].map(b => {
            const r = b.getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; })""")
        assert all(0 <= t and b <= h for t, b, h in r), r
        assert not a.errors, a.errors


def _result_text(a):
    return a.page.inner_text("#g-result")


def test_garden121_note_shortfall():
    """주문서대로: 쪽지와 다르게 심으면 결과 칸에 쪽지·심은 것·까닭(칸이 참)"""
    prog = [_nd(1, "readnote", file="주문서.txt", body=[
        _nd(2, "splitline"),
        _nd(3, "repeat", n={"value": "n"}, body=[_nd(4, "plant", crop={"noteVar": "crop"}), _nd(5, "move", dir="오른쪽")])])]
    cells = [None, {"crop": "감자", "planted_at": 440}] + [None] * 14
    seed = _garden_seed(12, _garden12(24, program=prog, cells=cells))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        g = _garden_run(a)
        assert g["order"]["idx"] == 24, g["order"]
        t = _result_text(a)
        for want in ("쪽지: 당근 2 · 감자 1", "이번에 심은 것: 당근 1 · 감자 1", "빈 칸이 모자랐어요 — 먼저 거둬요"):
            assert want in t, t
        a.shot("garden121-shortfall.png")
        m = measure(a, "garden121-shortfall")
        assert not m["problems"], m["problems"]
        assert not a.errors, a.errors


def _g121_first():
    """첫 주문(첫 수확): 오른쪽에 다 자란 당근, 재생이 몇 초 걸리게 이동을 더 붙임"""
    prog = [_nd(1, "move", dir="오른쪽"), _nd(2, "harvest")] + [_nd(3 + k, "move", dir="아래" if k % 2 == 0 else "위") for k in range(10)]
    cells = [None, {"crop": "당근", "planted_at": 0}] + [None] * 7
    return _garden(order_idx=0, program=prog, cells=cells)


def test_garden121_pending_done_after_leave():
    """재생 중 홈으로 가도 XP는 저장되고, 다음에 텃밭을 열면 「주문 완료!」(조사 「예요」) → 닫으면 실행 단추에 초점"""
    with App("iPhone 17", save=_garden_seed(1, _g121_first())) as a:
        _open_garden(a)
        a.wait_py()
        a.page.click("#g-run")
        a.page.wait_for_selector(".screen.garden[data-state=replay]", timeout=30_000)
        a.page.click("#g-back")
        a.page.wait_for_selector(".screen.home")
        g = a.save()["garden"]
        assert g["order"]["paid"] == ["o_first"] and g.get("pendingDone") == ["o_first"], g["order"]
        a.page.click('.tabbar [data-go="garden"]')
        a.page.wait_for_selector(".modal .g-done-body", timeout=10_000)
        t = a.page.inner_text(".modal .g-done-body")
        assert "「첫 수확」 주문 완료!" in t and "다음 주문은 「파이의 인사」예요." in t, t
        _close_done(a)
        a.page.wait_for_timeout(200)
        assert a.js("() => document.activeElement && document.activeElement.id") == "g-run"
        assert a.save()["garden"]["pendingDone"] == []
        # 한 번만: 다시 열어도 창 없음
        a.page.click("#g-back")
        a.page.wait_for_selector(".screen.home")
        a.page.click('.tabbar [data-go="garden"]')
        a.page.wait_for_selector(".screen.garden")
        a.page.wait_for_timeout(400)
        assert not a.page.query_selector(".modal .g-done-body")
        assert not a.errors, a.errors
    # 새로 고침: 재생 중 앱을 다시 열어도 창이 뜸
    with App("iPhone 17", save=_garden_seed(1, _g121_first())) as a:
        _open_garden(a)
        a.wait_py()
        a.page.click("#g-run")
        a.page.wait_for_selector(".screen.garden[data-state=replay]", timeout=30_000)
        a.page.reload()
        a.page.wait_for_selector(".screen.splash #go", timeout=20_000)
        assert a.save()["garden"]["pendingDone"] == ["o_first"]
        _open_garden(a)
        a.page.wait_for_selector(".modal .g-done-body", timeout=10_000)
        _close_done(a)
        assert a.save()["garden"]["pendingDone"] == []
        assert not a.errors, a.errors


def test_garden121_run_done_focus():
    """실행으로 주문을 해내고 창을 닫으면(키보드 Enter) 초점이 실행 단추로"""
    with App("iPhone 17", save=_garden_seed(1, _g121_first()), reduced=True) as a:
        _open_garden(a)
        _garden_run(a)
        a.page.wait_for_selector(".modal .g-done-body", timeout=10_000)
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.keyboard.press("Enter")
        a.page.wait_for_selector(".modal .g-done-body", state="detached")
        a.page.wait_for_timeout(200)
        assert a.js("() => document.activeElement && document.activeElement.id") == "g-run"
        assert a.save()["garden"]["pendingDone"] == []
        assert not a.errors, a.errors


def test_garden121_sayval_note_text():
    """값 넣어 말하기: 쪽지 값을 고르면 기본 「당근 」·「개」를 비움(고친 글자는 둠) → 「수확 4개」가 그대로"""
    seed = _garden_seed(12, _garden12(26, journal="수확 4개\n"))
    with App("iPhone 17", save=seed, reduced=True) as a:
        _open_garden(a)
        _add(a, None, "body", "readnote")
        rid = _prog_at(a, 0)["id"]
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=file]' % rid)
        _sheet_pick(a, '[data-v="농장일지.txt"]')
        _add(a, rid, "body", "sayval")
        sv = _prog_at(a, 0, "body", 0)
        assert sv["args"] == {"pre": "", "var": {"noteVar": "line"}, "post": ""}, sv
        # 위치 값도: 맨 바깥 위치 알기 뒤 값 넣어 말하기 → x, 글자 비움
        _add(a, None, "body", "where")
        _add(a, None, "body", "sayval")
        sx = _prog_at(a, 2)
        assert sx["args"] == {"pre": "", "var": "x", "post": ""}, sx
        # 직접 쓴 뒷글자(기본값과 같아도)는 값을 다시 골라도 둠
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=post]' % sx["id"])
        a.page.wait_for_selector(".modal.g-sheet input")
        a.page.fill(".modal.g-sheet input", "개")
        _sheet_pick(a, "#g-ok")
        a.page.click('.g-node[data-id="%s"] .g-arg[data-arg=var]' % sx["id"])
        _sheet_pick(a, '[data-name="y"]')
        assert _prog_at(a, 2)["args"] == {"pre": "", "var": "y", "post": "개"}, _prog_at(a, 2)
        for k in (2, 1):
            a.page.click('.g-node[data-id="%s"] .g-menu' % _prog_at(a, k)["id"])
            _sheet_pick(a, "[data-act=del]")
        _garden_run(a)
        assert "수확 4개" in a.js("() => document.querySelector('#board svg').textContent")
        assert "개개" not in a.js("() => document.querySelector('#board svg').textContent")
        _close_done(a)
        assert a.save()["garden"]["order"]["paid"][-1] == "o_readlog"
        assert not a.errors, a.errors


# ---------------------------------------------------------------- 개발자 모드 (v0.11.1)

def _ls(a, key):
    return a.js("(k) => localStorage.getItem(k)", key)


def _dev_banner(a):
    return a.js("""() => { const b = document.getElementById('dev-banner'); if (!b) return null;
        const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
        return { hidden: b.hidden || cs.display === 'none', text: b.innerText, top: r.top, bottom: r.bottom, w: r.width,
                 dev: document.documentElement.classList.contains('dev-on') }; }""")


def _below_banner(a, sel):
    """띠가 보이는 동안 sel(화면 위 머리줄의 내용)이 띠 아래에서 시작하나"""
    b = _dev_banner(a)
    top = a.js("(s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top : null; }", sel)
    assert top is not None, sel
    assert top >= b["bottom"] - 0.5, "%s top %.1f under banner bottom %.1f" % (sel, top, b["bottom"])


def _to_settings_dev(a):
    a.page.click('[data-go="settings"]')
    a.page.wait_for_selector(".screen.settings")
    a.page.eval_on_selector("#dev", "e => e.scrollIntoView({block: 'center'})")
    a.page.wait_for_timeout(150)


def _clear_toasts(a):
    """캡처에 알림이 겹치지 않게(알림 자체는 시험하지 않음)"""
    a.js("() => { const t = document.getElementById('toasts'); if (t) t.replaceChildren(); }")


def _home(a):
    _clear_toasts(a)
    a.js("() => window.__ria.ctx.show('home')")
    a.page.wait_for_selector(".screen.home")
    a.page.wait_for_timeout(150)


def _open_node(a, lid):
    a.page.eval_on_selector('[data-lesson="%s"]' % lid, "e => e.scrollIntoView({block: 'center'})")
    cls = a.page.get_attribute('[data-lesson="%s"]' % lid, "class")
    a.page.click('[data-lesson="%s"]' % lid)
    a.page.wait_for_selector(".screen.lesson .lesson-tag", timeout=20_000)
    a.page.wait_for_selector(".card-view, article.item", timeout=20_000)
    return cls, a.page.inner_text(".lesson-tag")


def test_dev_mode():
    seed = _garden_seed(1, xp=40)
    with App("iPhone 17", save=seed) as a:
        a.start()
        real_before = _ls(a, SAVE_KEY)
        assert real_before and json.loads(real_before)["xp"] == 40
        assert _dev_banner(a)["hidden"], "꺼져 있으면 띠 없음"
        assert "locked" in a.page.get_attribute('[data-lesson="17-3"]', "class")

        # 설정: 맨 아래 칸·스위치(꺼짐)
        _to_settings_dev(a)
        info = a.js("""() => { const sw = document.getElementById('dev'), r = sw.getBoundingClientRect();
            const panels = [...document.querySelectorAll('.screen.settings main > section.panel')];
            return { checked: sw.getAttribute('aria-checked'), role: sw.getAttribute('role'), w: r.width, h: r.height,
                     label: document.getElementById(sw.getAttribute('aria-labelledby')).innerText,
                     last: panels[panels.length - 1].classList.contains('devmode') }; }""")
        assert info["checked"] == "false" and info["role"] == "switch" and info["w"] >= 44 and info["h"] >= 44, info
        assert "개발자 모드" in info["label"] and "잠긴 곳을 모두 열어 검수해요. 학습 기록과 따로 저장돼요." in info["label"], info
        assert info["last"], "개발자 모드 칸은 설정 맨 아래 칸"
        m = measure(a, "settings-dev-off")
        assert not m["problems"] and not m["small"], m
        a.shot("dev-settings-off.png")

        # 켜기: 확인 창 → 「그만두기」는 아무것도 바꾸지 않음
        a.page.click("#dev")
        a.page.wait_for_selector(".modal [data-i]")
        body = a.page.inner_text(".modal")
        assert "검수용 모드예요. 켜 두는 동안의 진행은 학습 기록과 따로 저장돼요." in body, body
        labels = a.js("() => [...document.querySelectorAll('.modal [data-i]')].map(b => b.innerText.trim())")
        assert labels == ["그만두기", "켜기"], labels
        a.shot("dev-confirm.png")
        m = measure(a, "dev-confirm")
        assert not m["problems"] and not m["small"], m
        a.page.click(".modal [data-i='0']")
        a.page.wait_for_selector(".modal", state="detached")
        assert a.page.get_attribute("#dev", "aria-checked") == "false"
        assert _ls(a, DEV_FLAG_KEY) is None and _dev_banner(a)["hidden"]

        a.page.click("#dev")
        a.page.wait_for_selector(".modal [data-i]")
        a.page.click(".modal [data-i='1']")
        a.page.wait_for_selector(".modal", state="detached")
        a.page.wait_for_selector('#dev[aria-checked="true"]')
        b = _dev_banner(a)
        assert not b["hidden"] and b["text"] == "개발자 모드" and b["dev"] and b["top"] == 0 and b["bottom"] <= 30, b
        assert _ls(a, DEV_FLAG_KEY) == "1"
        assert "(개발자 모드 저장)" in a.page.inner_text(".screen.settings")
        assert "(개발자 모드 저장)" in a.page.get_attribute("#export", "aria-label")
        assert a.js("() => window.__ria.app.save.completed_lessons.length") == 0, "새 개발자 저장"
        _below_banner(a, ".status .stats-row")
        a.page.wait_for_timeout(300)
        _clear_toasts(a)
        m = measure(a, "settings-dev-on")
        assert not m["problems"] and not m["small"], m
        a.shot("dev-settings-on.png")
        a.page.evaluate("() => window.scrollTo(0, 0)")
        a.page.wait_for_timeout(100)
        a.shot("dev-settings-top.png")
        assert _ls(a, SAVE_KEY) == real_before, "켜는 것만으로 학습 기록이 바뀌면 안 됨"

        # 홈: 띠·오늘의 도전·텃밭 입구, 17-3·13-A1 열림
        _home(a)
        _below_banner(a, ".status .stats-row")
        m = measure(a, "home-dev")
        assert not m["problems"] and not m["small"], m
        assert a.page.query_selector(".panel.daily"), "오늘의 도전 카드"
        assert not a.page.query_selector('.tabbar [data-go="garden"][data-locked]'), "텃밭 칸 열림"
        a.shot("dev-home.png")
        cls = a.page.get_attribute('[data-lesson="17-3"]', "class")
        assert "locked" not in cls, cls
        cls, tag = _open_node(a, "17-3")
        assert "17-3" in tag, tag
        _below_banner(a, ".lesson-top #quit")
        a.shot("dev-lesson-17-3.png")
        _home(a)
        cls, tag = _open_node(a, "13-A1")
        assert "locked" not in cls and "13-A1" in tag, (cls, tag)
        _home(a)

        # 텃밭: 9장 노드(위치 알기)·지금 주문 기다림 없음
        a.page.click('.tabbar [data-go="garden"]')
        a.page.wait_for_selector(".screen.garden")
        a.page.wait_for_timeout(200)
        _below_banner(a, ".g-top #g-back")
        a.page.click('.g-add[data-parent=""]')
        a.page.wait_for_selector(".modal.g-sheet")
        lk = a.js("() => { const b = document.querySelector('.g-sheet [data-kind=where]'); return b && [b.disabled, b.innerText]; }")
        assert lk and not lk[0] and "9장" not in lk[1], lk
        a.shot("dev-garden-sheet.png")
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        a.page.evaluate("() => window.scrollTo(0, 0)")
        a.page.wait_for_timeout(100)
        a.shot("dev-garden.png")
        m = measure(a, "garden-dev")
        assert not m["problems"], m

        # 개발자 저장에서 활동(하루 목표 바꾸기) → 개발자 칸에만
        a.page.click("#g-back")
        a.page.wait_for_selector(".screen.home")
        a.page.click('[data-go="settings"]')
        a.page.wait_for_selector(".screen.settings")
        a.page.click('[data-g="30"]')
        a.page.wait_for_timeout(200)
        dev_save = json.loads(_ls(a, DEV_SAVE_KEY))
        # v0.12.1(QA 4): 바꾼 목표는 내일부터 → goal_pending에 예약
        assert (dev_save.get("goal_pending") or {}).get("value") == 30 and dev_save.get("dev_mode") is True, dev_save
        assert _ls(a, SAVE_KEY) == real_before

        # 새로고침해도 켜져 있음(깃발이 남음)
        a.page.reload()
        a.page.wait_for_selector(".screen.splash #go")
        assert not _dev_banner(a)["hidden"], "새로고침 뒤에도 띠"
        _below_banner(a, ".screen.splash h1, .screen.splash #go")
        a.shot("dev-splash.png")
        a.start()
        assert a.js("() => (window.__ria.app.save.goal_pending || {}).value") == 30
        assert _ls(a, SAVE_KEY) == real_before

        # 끄기: 확인 창 없음 → 학습 기록 그대로
        _to_settings_dev(a)
        a.page.click("#dev")
        a.page.wait_for_selector('#dev[aria-checked="false"]')
        assert not a.page.query_selector(".modal"), "끌 때는 확인 창 없음"
        assert _dev_banner(a)["hidden"] and not _dev_banner(a)["dev"]
        assert _ls(a, DEV_FLAG_KEY) is None
        assert "(개발자 모드 저장)" not in a.page.inner_text(".screen.settings")
        m = measure(a, "settings-dev-off2")
        assert not m["problems"] and not m["small"], m
        assert _ls(a, SAVE_KEY) == real_before, "끈 뒤 학습 기록 원문 그대로"
        st = a.js("() => ({ xp: window.__ria.app.save.xp, n: window.__ria.app.save.completed_lessons.length, dev: 'dev_mode' in window.__ria.app.save })")
        assert st == {"xp": 40, "n": 5, "dev": False}, st
        assert _ls(a, DEV_SAVE_KEY), "개발자 저장은 남음"
        _home(a)
        assert "locked" in a.page.get_attribute('[data-lesson="17-3"]', "class")
        assert "locked" in a.page.get_attribute('[data-lesson="13-A1"]', "class")
        a.shot("dev-off-home.png")
        assert not a.errors, a.errors


# ---------------------------------------------------------------- v0.12.1 앱 전체 QA

def _in_view(a, sel):
    """요소가 상태 줄 아래·화면 안에 다 보이나"""
    return a.js("""(sel) => { const e = document.querySelector(sel); if (!e) return 'missing';
        const r = e.getBoundingClientRect(); const bar = document.querySelector('#app .status');
        const top = bar ? bar.getBoundingClientRect().bottom : 0;
        return r.top >= top - 1 && r.bottom <= innerHeight + 1 ? true : [Math.round(r.top), Math.round(r.bottom), Math.round(top), innerHeight]; }""", sel)


def test_qa0121_closet_preview_in_view():
    """의상실(QA 1·3): 아래쪽 카드(마법사 망토)를 누르면 미리보기·「300바이트로 사기」가 화면 안, 초점은 사기 단추 →
    사면 초점은 「입고 있어요」. 맨 끝 카드(졸업 가운)도 미리보기가 화면 안. 캡처: qa0121-closet-*.png (iPhone 17)"""
    seed = {"saveVer": 2, "xp": 500, "bytes": 1000, "completed_lessons": ["1-1"]}
    with App("iPhone 17", save=seed) as a:
        a.start()
        a.page.click('[data-go="closet"]')
        a.page.wait_for_selector(".screen.closet")
        a.page.locator('[data-o="wizard"]').scroll_into_view_if_needed()
        a.page.wait_for_timeout(200)
        a.page.click('[data-o="wizard"]')
        a.page.wait_for_selector('[data-o="wizard"][aria-pressed="true"]')
        a.page.wait_for_function("() => { const b = document.querySelector('#buy'); if (!b) return false;"
                                 " const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }", timeout=3000)
        a.page.wait_for_timeout(500)   # 부드러운 스크롤이 멈출 때까지
        a.shot("qa0121-closet-wizard.png")
        assert _in_view(a, "#buy") is True, _in_view(a, "#buy")
        assert _in_view(a, ".stage .ria-wrap") is True, _in_view(a, ".stage .ria-wrap")
        assert a.js("() => document.activeElement && document.activeElement.id") == "buy"
        a.page.click("#buy")
        a.page.wait_for_selector("#worn")
        a.page.wait_for_timeout(100)
        focus = a.js("() => [document.activeElement.id, document.activeElement.tagName, document.activeElement.textContent.trim()]")
        assert focus[0] == "worn" and "입고 있어요" in focus[2], focus
        assert a.save()["outfit"] == "wizard" and a.save()["bytes"] == 700, a.save()
        a.page.click("#worn", force=True)   # aria-disabled: 눌러도 아무 일 없음
        assert a.save()["outfit"] == "wizard"
        a.shot("qa0121-closet-bought.png")
        # 맨 끝 카드(판매 안 함): 미리보기가 화면 안, 초점은 이름
        a.page.locator('[data-o="graduate"]').scroll_into_view_if_needed()
        a.page.click('[data-o="graduate"]')
        a.page.wait_for_timeout(900)
        assert _in_view(a, ".stage .lock-note") is True, _in_view(a, ".stage .lock-note")
        assert a.js("() => document.activeElement.closest('.stage') !== null")
        assert not a.errors, a.errors
    # 동작 줄이기: 바로 이동(부드러운 스크롤 없이)
    with App("iPhone 17", save=seed, reduced=True) as a:
        a.start()
        a.page.click('[data-go="closet"]')
        a.page.wait_for_selector(".screen.closet")
        a.page.locator('[data-o="wizard"]').scroll_into_view_if_needed()
        a.page.click('[data-o="wizard"]')
        a.page.wait_for_timeout(60)
        assert _in_view(a, "#buy") is True, _in_view(a, "#buy")
        assert not a.errors, a.errors


def _import_file(a, name, obj):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(obj if isinstance(obj, str) else json.dumps(obj))
    a.page.set_input_files("#import", path)


def test_qa0121_import_checks():
    """저장 가져오기(QA 2): 다른 JSON → 「리아와 파이썬! 저장 파일이 아니에요」, 창 없음, 저장 그대로 /
    끝낸 레슨이 적은 저장 → 확인 창에 요약 + 「지금보다 끝낸 레슨이 2개 적어요」 → 그만두기 → 그대로 → 바꾸기 → 바뀜"""
    seed = {"saveVer": 2, "xp": 90, "bytes": 40, "completed_lessons": ["1-1", "1-2", "1-3"], "current_lesson": "1-4"}
    with App("iPhone 17", save=seed) as a:
        a.start()
        a.page.click('[data-go="settings"]')
        a.page.wait_for_selector(".screen.settings")
        before = a.save()
        _import_file(a, "qa0121-foreign.json", {"hello": "world", "xp": "lots"})
        a.page.wait_for_selector(".toast.warn")
        assert "리아와 파이썬! 저장 파일이 아니에요" in a.page.inner_text("#toasts")
        a.page.wait_for_timeout(300)
        assert not a.page.query_selector(".modal"), "다른 JSON에 확인 창이 뜨면 안 됨"
        assert a.save() == before
        _import_file(a, "qa0121-xponly.json", {"xp": 5})
        a.page.wait_for_timeout(400)
        assert not a.page.query_selector(".modal") and a.save() == before
        _import_file(a, "qa0121-less.json", {"saveVer": 2, "xp": 10, "bytes": 3, "completed_lessons": ["1-1"]})
        a.page.wait_for_selector(".modal")
        body = a.page.inner_text(".modal")
        a.shot("qa0121-import-less.png")
        assert "끝낸 레슨 1개, XP 10" in body, body
        assert "지금보다 끝낸 레슨이 2개 적어요" in body, body
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.click(".modal button:has-text('그만두기')")
        a.page.wait_for_selector(".modal", state="detached")
        assert a.save() == before
        _import_file(a, "qa0121-less.json", {"saveVer": 2, "xp": 10, "bytes": 3, "completed_lessons": ["1-1"]})
        a.page.wait_for_selector(".modal")
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.click(".modal button:has-text('바꾸기')")
        a.page.wait_for_selector("#app[data-screen=home]")
        assert a.save()["completed_lessons"] == ["1-1"] and a.save()["xp"] == 10
        assert not a.errors, a.errors


def test_qa0121_goal_from_tomorrow():
    """하루 목표(QA 4): 오늘 15 XP·목표 20에서 10으로 → 연속 기록 그대로, 「내일부터 10 XP」, 상태 줄은 오늘 목표 20"""
    seed = {"saveVer": 2, "xp": 60, "completed_lessons": ["1-1"],
            "streak": {"days": 3, "best": 3, "lastGoalDate": today(1), "todayDate": today(), "todayXp": 15},
            "settings": {"sound": False, "dailyGoal": 20, "name": ""}}
    with App("iPhone 17", save=seed) as a:
        a.start()
        a.page.click('[data-go="settings"]')
        a.page.wait_for_selector(".screen.settings")
        a.page.click('[data-g="10"]')
        a.page.wait_for_selector("#goal-note")
        s = a.save()
        assert s["streak"]["days"] == 3 and s["streak"]["lastGoalDate"] == today(1), s["streak"]
        assert s["settings"]["dailyGoal"] == 20, s["settings"]
        tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        assert s["goal_pending"] == {"value": 10, "from": tomorrow}, s.get("goal_pending")
        assert "내일부터 10 XP" in a.page.inner_text("#goal-note")
        assert a.page.get_attribute('[data-g="10"]', "aria-checked") == "true"
        assert a.js("() => document.activeElement.dataset.g") == "10"
        a.shot("qa0121-goal-pending.png")
        # 지금 목표를 다시 고르면 예약 취소
        a.page.click('[data-g="20"]')
        a.page.wait_for_selector("#goal-note", state="detached")
        assert a.save()["goal_pending"] is None
        assert not a.errors, a.errors


def test_qa0121_broken_save_notice():
    """깨진 저장(QA 5): 읽지 못한 저장 → 홈에 한 번 안내 + 「옛 저장 내보내기」로 .broken 내용 받기 → 새로고침하면 안내 없음"""
    with App("iPhone 17", save="{not a save") as a:
        raw = a.js("() => localStorage.getItem('ria-python.save.broken')")
        assert raw == json.dumps("{not a save"), raw
        a.start()
        a.page.wait_for_selector(".broken-notice")
        text = a.page.inner_text(".broken-notice")
        assert "저장을 읽지 못해 새로 시작했어요" in text and "설정 → 저장 가져오기" in text, text
        a.shot("qa0121-broken-notice.png")
        with a.page.expect_download() as dl:
            a.page.click("#broken-export")
        path = dl.value.path()
        with open(path, encoding="utf-8") as f:
            assert f.read() == raw
        assert dl.value.suggested_filename.startswith("ria-python-old-save-"), dl.value.suggested_filename
        assert a.save()["broken_notice"] is None
        a.page.reload()
        a.page.wait_for_selector(".screen.splash #go", timeout=20_000)
        a.start()
        assert not a.page.query_selector(".broken-notice")
        assert a.js("() => localStorage.getItem('ria-python.save.broken.1')") is None, "다시 깨진 것으로 남기면 안 됨"
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


def test_android_newline():
    """v0.12.2 (갤럭시 S25 제보): 안드로이드에서 세 번째 줄을 만들 수 있어야 한다.
    ① 안드로이드는 EditContext를 그대로 씀(v0.12.3, 끄면 글자 입력이 망가짐) ② 「↵ 줄 바꿈」 단추가 새 줄을 만듦(키보드 초점 유지)
    ③ 처음 코드가 정답 줄 수만큼 빈 줄로 열림."""
    LINES = "() => [...document.querySelectorAll('.cm-content .cm-line')].map(e => e.textContent)"
    fails = []
    for dev in ("Galaxy S24", "iPhone 17"):
        with App(dev) as a:
            a.start()
            a.page.click("#continue")
            _to_write(a)
            item = next(x for x in a.lesson("1-1")["items"] if x["type"] == "write")
            need = len((item.get("solution") or "").rstrip("\n").split("\n"))
            have = len(a.js(LINES))
            if have < need:
                fails.append("%s: opened with %d lines, solution has %d" % (dev, have, need))
            # v0.12.3: 안드로이드는 CodeMirror 기본(EditContext)을 그대로 쓴다. 끄면 삼성 키보드(천지인)에서
            # 글자가 거의 입력되지 않는다는 실기기 제보(C73). 다시 끄지 못하게 지킨다.
            ec = a.js("() => !!document.querySelector('.cm-content').editContext")
            if dev.startswith("Galaxy") and not ec:
                fails.append("%s: EditContext is off (must stay on for Android, C73)" % dev)
            a.set_code("a = 1\nb = 2")
            a.page.click("#foot .sym[data-act=newline]")
            a.page.wait_for_timeout(150)
            a.page.keyboard.type("c = 3")
            got = a.js(LINES)
            if got != ["a = 1", "b = 2", "c = 3"]:
                fails.append("%s: after 줄 바꿈 button %r" % (dev, got))
            if not a.js("() => !!document.activeElement.closest('.cm-editor')"):
                fails.append("%s: editor lost focus after button" % dev)
            if a.errors:
                fails.append("%s: %s" % (dev, a.errors))
    # 텃밭 코드 모드의 기호 줄도 같은 단추를 씀
    with App("Galaxy S24", save=_garden_seed(5, _garden(mode="code", code='move("아래")'))) as a:
        _open_garden(a)
        a.page.click(".cm-content")
        a.page.keyboard.press("End")
        a.page.click("#g-syms .sym[data-act=newline]")
        a.page.wait_for_timeout(150)
        a.page.keyboard.type("harvest()")
        got = a.js(LINES)
        if got != ['move("아래")', "harvest()"]:
            fails.append("garden code mode: after 줄 바꿈 button %r" % got)
        if a.errors:
            fails.append("garden: %s" % a.errors)
    assert not fails, "\n".join(fails)


def test_garden_tab():
    """v0.12.5: 하단 메뉴 「텃밭」 칸. 잠김 안내, 새 소식 점, 텃밭 안에서는 메뉴 숨김, 「<」는 들어오기 전 화면으로."""
    fails = []
    tabs = "() => [...document.querySelectorAll('.tabbar [data-go]')].map(e => e.dataset.go)"
    # 1) 1장 전: 잠김 → 누르면 안내만, 홈에 그대로
    with App("iPhone 17") as a:
        a.start()
        if a.js(tabs) != ["home", "garden", "badges", "closet", "settings"]:
            fails.append("tab order %r" % a.js(tabs))
        a.page.click('.tabbar [data-go="garden"]')
        a.page.wait_for_timeout(300)
        if a.js("() => document.body.dataset.screen") != "home":
            fails.append("locked tab opened %s" % a.js("() => document.body.dataset.screen"))
        if a.page.query_selector(".garden-card"):
            fails.append("home still has locked garden card")
        if "1장을 끝내면 열려요" not in a.page.inner_text(".toasts"):
            fails.append("no locked toast: %r" % a.page.inner_text(".toasts"))
        m = measure(a, "home-5tabs")
        if m["small"]:
            fails.append("small targets %r" % m["small"])
        if m["problems"]:
            fails.append("problems %r" % m["problems"])
    # 2) 막 열림(실행 0번): 점 → 누르면 텃밭, 메뉴 없음, 「<」는 홈
    with App("Galaxy S24", save=_garden_seed(1)) as a:
        a.start()
        if not a.page.query_selector('.tabbar [data-go="garden"] .tab-dot'):
            fails.append("no news dot when just unlocked")
        # v0.12.6: 하단 칸과 겹치는 홈의 텃밭 카드는 없음
        if a.page.query_selector(".garden-card") or a.page.query_selector("#garden"):
            fails.append("home still has garden card")
        a.shot("tab-garden-news.png")
        a.page.click('.tabbar [data-go="garden"]')
        a.page.wait_for_selector(".screen.garden")
        if a.page.query_selector(".tabbar"):
            fails.append("tabbar shown inside garden")
        a.page.click("#g-back")
        a.page.wait_for_selector(".screen.home")
        if a.errors:
            fails.append("errors %r" % a.errors)
    # 3) 의상실에서 들어가면 「<」로 의상실에 돌아감
    with App("iPhone 17", save=_garden_seed(2, _garden(order_idx=6, store={"당근": 3}) | {"runs": 4})) as a:
        a.start()
        a.page.click('[data-go="closet"]')
        a.page.wait_for_selector(".screen.closet")
        if a.page.query_selector('.tabbar [data-go="garden"] .tab-dot'):
            fails.append("dot shown though soup order short (3/10)")
        a.page.click('.tabbar [data-go="garden"]')
        a.page.wait_for_selector(".screen.garden")
        a.page.click("#g-back")
        a.page.wait_for_selector(".screen.closet", timeout=3000)
    # 4) 보내기 주문에 창고가 충분하면 점
    with App("iPhone 17", save=_garden_seed(2, _garden(order_idx=6, store={"당근": 10}) | {"runs": 4})) as a:
        a.start()
        if not a.page.query_selector('.tabbar [data-go="garden"] .tab-dot'):
            fails.append("no dot though soup order deliverable (10/10)")
    assert not fails, "\n".join(fails)


def _hangul_left(a, allow=()):
    """화면 글자에서 허용 글자를 뺀 뒤 남은 한글 줄. v0.13.4: 레슨도 모두 영어라 레슨 내용도 빼지 않는다"""
    return a.js("""(allow) => {
        let text = document.body.innerText + "\\n" + [...document.querySelectorAll("[aria-label], [title], [placeholder]")]
            .map((e) => [e.getAttribute("aria-label"), e.getAttribute("title"), e.getAttribute("placeholder")].filter(Boolean).join("\\n")).join("\\n");
        for (const p of [...allow].filter(Boolean).sort((x, y) => y.length - x.length)) text = text.split(p).join("");
        return text.split("\\n").filter((ln) => /[가-힣]/.test(ln)).slice(0, 8);
    }""", list(allow))


def _lessons_lang(a):
    """지금 레슨 목록·1-1 내용의 언어: 'ko'(한글 있음) / 'en'(없음). 언어를 바꾼 뒤 레슨도 따라 바뀌는지(v0.13.4 검토 I3)"""
    return a.js("""async () => { const app = window.__ria.app; const l = await window.__ria.ctx.getLesson('1-1');
        const ko = /[가-힣]/; const t = (app.chapters[0] && app.chapters[0].title) || '';
        return { data: app.dataLang, title: ko.test(t) ? 'ko' : 'en', lesson: ko.test(JSON.stringify(l)) ? 'ko' : 'en' }; }""")


def test_language_switch():
    """v0.13.0: 「한국어 / English」. v0.14.0부터 일반 모드에서도 시작 화면·설정에 보인다. 영어로 바꾸면 화면이 영어,
    다시 한국어로 바꿔도 진도·바이트 그대로."""
    fails = []
    with App("iPhone 17") as a:
        if not a.page.query_selector(".screen.splash .lang-pick"):
            fails.append("no picker on splash in normal mode (v0.14.0 public)")
        a.start()
        a.page.click('.tabbar [data-go="settings"]')
        a.page.wait_for_selector(".screen.settings")
        if not a.page.query_selector(".lang-pick"):
            fails.append("no picker in settings in normal mode (v0.14.0 public)")
    seed = dict(_garden_seed(1, xp=40), dev_mode=True)
    for dev in ("Galaxy S24", "iPhone 17"):
        with App(dev) as a:
            a.js("([k1, k2, v]) => { localStorage.setItem(k1, '1'); localStorage.setItem(k2, v); }",
                 [DEV_FLAG_KEY, DEV_SAVE_KEY, json.dumps(seed)])
            a.page.reload()
            a.page.wait_for_selector(".screen.splash .lang-pick")
            a.page.click('.lang-pick [data-lang="en"]')
            a.page.wait_for_function("() => document.documentElement.lang === 'en'")
            a.page.wait_for_selector(".screen.splash #go")
            a.page.wait_for_timeout(300)
            if a.page.inner_text("#go").strip() != "Start":
                fails.append("%s splash button %r" % (dev, a.page.inner_text("#go")))
            left = _hangul_left(a, ["한국어"])
            if left:
                fails.append("%s splash hangul %r" % (dev, left))
            a.shot("lang-en-splash-%s.png" % slug(dev))
            a.start()
            for name in ("home", "badges", "closet", "settings"):
                if name != "home":
                    a.page.click('.tabbar [data-go="%s"]' % name)
                    a.page.wait_for_selector(".screen.%s" % name)
                a.page.wait_for_timeout(300)
                left = _hangul_left(a, ["한국어"] if name == "settings" else [])
                if left:
                    fails.append("%s %s hangul %r" % (dev, name, left))
                m = measure(a, "lang-en-%s" % name)
                if m["problems"] or m["small"]:
                    fails.append("%s %s layout %r %r" % (dev, name, m["problems"], m["small"]))
                a.shot("lang-en-%s-%s.png" % (name, slug(dev)))
            # 레슨 화면 틀(레슨 내용은 v0.13.1부터 영어) + 그만두기 창
            a.page.click('.tabbar [data-go="home"]')
            a.page.wait_for_selector(".screen.home")
            a.page.click("#continue")
            a.page.wait_for_selector(".card-view, article.item", timeout=20_000)
            left = _hangul_left(a)
            if left:
                fails.append("%s lesson chrome hangul %r" % (dev, left))
            a.page.click("#quit")
            a.page.wait_for_selector(".modal [data-i]")
            left = _hangul_left(a)
            if left:
                fails.append("%s quit dialog hangul %r" % (dev, left))
            a.shot("lang-en-lesson-quit-%s.png" % slug(dev))
            a.page.click(".modal [data-i='1']")
            a.page.wait_for_selector(".screen.home", timeout=10_000)
            a.page.click('.tabbar [data-go="settings"]')
            a.page.wait_for_selector(".screen.settings")
            # 다시 한국어: 진도 그대로
            before = a.js("() => ({ xp: window.__ria.app.save.xp, done: window.__ria.app.save.completed_lessons.length })")
            a.page.click('.lang-pick [data-lang="ko"]')
            a.page.wait_for_function("() => document.documentElement.lang === 'ko'")
            after = a.js("() => ({ xp: window.__ria.app.save.xp, done: window.__ria.app.save.completed_lessons.length, lang: window.__ria.app.save.settings.lang })")
            if after["lang"] != "ko" or after["xp"] != before["xp"] or after["done"] != before["done"]:
                fails.append("%s back to ko %r → %r" % (dev, before, after))
            if "설정" not in a.page.inner_text(".tabbar"):
                fails.append("%s tabbar not Korean after switch back" % dev)
            a.page.wait_for_function("() => window.__ria.app.dataLang === 'ko'", timeout=10_000)
            if _lessons_lang(a) != {"data": "ko", "title": "ko", "lesson": "ko"}:
                fails.append("%s lessons not Korean after switch back %r" % (dev, _lessons_lang(a)))
            # 영어로 다시 바꾼 뒤 개발자 모드를 끄면(학습 기록 칸, 공개 전) 한국어
            a.page.click('.lang-pick [data-lang="en"]')
            a.page.wait_for_function("() => document.documentElement.lang === 'en' && window.__ria.app.dataLang === 'en'", timeout=10_000)
            if _lessons_lang(a) != {"data": "en", "title": "en", "lesson": "en"}:
                fails.append("%s lessons not English after switch %r" % (dev, _lessons_lang(a)))
            a.page.click("#dev")
            a.page.wait_for_function("() => document.documentElement.lang === 'ko'", timeout=5000)
            try:
                a.page.wait_for_function("() => window.__ria.app.dataLang === 'ko'", timeout=10_000)
            except Exception:  # noqa: BLE001
                pass
            if _lessons_lang(a) != {"data": "ko", "title": "ko", "lesson": "ko"}:
                fails.append("%s lessons not Korean after dev off %r" % (dev, _lessons_lang(a)))
            if "설정" not in a.page.inner_text(".tabbar") or not a.page.query_selector(".lang-pick"):
                fails.append("%s dev off: not Korean / picker missing (v0.14.0 public)" % dev)
            if _ls(a, SAVE_KEY) and json.loads(_ls(a, SAVE_KEY))["settings"].get("lang", "ko") != "ko":
                fails.append("%s learning save got lang en" % dev)
            if a.errors:
                fails.append("%s errors %r" % (dev, a.errors))
    assert not fails, "\n".join(fails)


def test_english_lesson():
    """v0.13.1~: 개발자 모드 영어에서 1-1을 끝까지 풀면 레슨 화면·완료 화면에 한글이 없다(영어 레슨 파일 ch1이 있을 때)."""
    if not os.path.exists(os.path.join(ROOT, "data", "lessons", "en", "ch1.js")):
        return
    fails = []
    seed = dict(_garden_seed(1, xp=40), dev_mode=True, settings={"sound": False, "dailyGoal": 20, "name": "", "lang": "en"})
    seed["completed_lessons"] = []
    seed["current_lesson"] = "1-1"
    with App("iPhone 17") as a:
        a.js("([k1, k2, v]) => { localStorage.setItem(k1, '1'); localStorage.setItem(k2, v); }",
             [DEV_FLAG_KEY, DEV_SAVE_KEY, json.dumps(seed)])
        a.page.reload()
        a.page.wait_for_function("() => document.documentElement.lang === 'en'", timeout=20_000)
        a.start()
        lesson = a.lesson("1-1")
        if re.search(r"[가-힣]", json.dumps(lesson, ensure_ascii=False)):
            fails.append("1-1 lesson data has Hangul (Korean file loaded?)")
        seen = []

        def hook(name, app):
            left = _hangul_left(app)
            if left:
                seen.append("%s: %r" % (name, left))
        a.page.click('[data-lesson="1-1"]')
        a.page.wait_for_selector(".card-view, article.item", timeout=20_000)
        a.play("1-1", wrong=(0,), hook=hook)
        a.page.wait_for_selector(".screen.done")
        a.page.wait_for_timeout(400)
        a.dismiss()
        left = _hangul_left(a)
        if left:
            fails.append("done screen hangul %r" % left)
        a.shot("en-lesson-done.png")
        fails += seen
        # v0.13.4: 뒤쪽 장(리스트)·심화(웹 API 연습 서버)도 영어로 끝까지
        for lid in ("7-1", "14-A1"):
            a.js("(id) => window.__ria.ctx.show('lesson', { id })", lid)
            a.page.wait_for_selector(".card-view, article.item", timeout=20_000)
            if re.search(r"[가-힣]", json.dumps(a.lesson(lid), ensure_ascii=False)):
                fails.append("%s lesson data has Hangul" % lid)
            seen = []
            a.play(lid, hook=hook)
            a.page.wait_for_selector(".screen.done", timeout=20_000)
            a.page.wait_for_timeout(300)
            a.dismiss()
            left = _hangul_left(a)
            if left:
                seen.append("%s done: %r" % (lid, left))
            fails += seen
            a.shot("en-lesson-done-%s.png" % lid)
        if a.errors:
            fails.append("errors %r" % a.errors)
    assert not fails, "\n".join(fails)


def test_english_garden():
    """v0.13.5: 개발자 모드 영어 텃밭 — 화면·노드 코드·쪽지함·실행 결과·노드 고르기에 한글이 없고, 노드가 만든 영어 코드
    (open("handwritten.txt"), 숫자+작물 정규식)가 영어 쪽지를 읽어 그대로 심는다. 저장은 안쪽 열쇠(한국어) 그대로."""
    prog = [_nd(1, "readnote", file="손글씨주문.txt",
                body=[_nd(2, "findall", pattern="crop_num",
                          body=[_nd(3, "repeat", n={"value": "n"},
                                    body=[_nd(4, "plant", crop={"noteVar": "crop"}), _nd(5, "move", dir="오른쪽")])])])]
    seed = dict(_garden_seed(12, _garden12(28, program=prog)), dev_mode=True,
                settings={"sound": False, "dailyGoal": 20, "name": "", "lang": "en"})
    fails = []
    with App("iPhone 17", reduced=True) as a:
        a.js("([k1, k2, v]) => { localStorage.setItem(k1, '1'); localStorage.setItem(k2, v); }",
             [DEV_FLAG_KEY, DEV_SAVE_KEY, json.dumps(seed)])
        a.page.reload()
        a.page.wait_for_function("() => document.documentElement.lang === 'en'", timeout=20_000)
        _open_garden(a)
        left = _hangul_left(a)
        if left:
            fails.append("garden screen: %r" % left)
        code = _code_preview(a)
        for want in ('with open("handwritten.txt") as f:', 'for n, crop in re.findall(r"(\\d+)\\s*(carrot|potato|tomato)", line):',
                     "plant(crop)", 'move("right")'):
            if want not in code:
                fails.append("code preview lacks %r:\n%s" % (want, code))
        if re.search(r"[가-힣]", code):
            fails.append("code preview has Hangul:\n%s" % code)
        a.shot("en-garden.png")
        _notes_open(a)
        left = _hangul_left(a)
        if left:
            fails.append("mailbox: %r" % left)
        note = _note_text(a, "손글씨주문.txt")
        if not note or re.search(r"[가-힣]", note):
            fails.append("handwritten note not English: %r" % note)
        a.shot("en-garden-notes.png")
        a.page.click(".gs-close")
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        dev_save = lambda: json.loads(a.js("(k) => localStorage.getItem(k)", DEV_SAVE_KEY))  # noqa: E731 개발자 모드 저장 칸
        before = dev_save()["garden"]
        a.wait_py()
        a.page.click("#g-run")
        a.page.wait_for_function("(n) => { const s = JSON.parse(localStorage.getItem(%r) || '{}'); "
                                 "return ((s.garden || {}).runs || 0) > n; }" % DEV_SAVE_KEY, arg=before.get("runs", 0),
                                 timeout=30_000)
        a.page.wait_for_selector(".screen.garden[data-state=idle]", timeout=30_000)
        g = dev_save()["garden"]
        planted = sum(1 for c in g["cells"] if c) - sum(1 for c in before["cells"] if c)
        if planted <= 0:
            fails.append("nothing planted from the English note: %r" % g["cells"])
        if set(g["store"]) - {"당근", "감자", "토마토"}:
            fails.append("save store keys not internal: %r" % g["store"])
        a.page.wait_for_timeout(300)
        left = _hangul_left(a)
        if left:
            fails.append("after run: %r" % left)
        a.shot("en-garden-after-run.png")
        a.page.click('.g-add[data-parent=""][data-slot=body]')
        a.page.wait_for_selector(".modal.g-sheet")
        left = _hangul_left(a)
        if left:
            fails.append("add-node sheet: %r" % left)
        a.shot("en-garden-add.png")
        if a.errors:
            fails.append("errors %r" % a.errors)
    assert not fails, "\n".join(fails)


def test_english_garden_code_mode_switch():
    """v0.13.5 검토 I1: 한국어 코드 모드에서 노드가 만든 코드를 고치지 않은 채 영어로 바꾸면 영어 코드가 보이고,
    노드로 돌아갈 때 「고친 것이 사라져요」를 묻지 않는다."""
    g = _garden(order_idx=0, mode="code", code='move("오른쪽")\nharvest()\n')
    seed = dict(_garden_seed(1, g, xp=40), dev_mode=True, settings={"sound": False, "dailyGoal": 20, "name": "", "lang": "en"})
    with App("iPhone 17", reduced=True) as a:
        a.js("([k1, k2, v]) => { localStorage.setItem(k1, '1'); localStorage.setItem(k2, v); }",
             [DEV_FLAG_KEY, DEV_SAVE_KEY, json.dumps(seed)])
        a.page.reload()
        a.page.wait_for_function("() => document.documentElement.lang === 'en'", timeout=20_000)
        _open_garden(a)
        a.page.wait_for_selector(".cm-content")
        got = a.js("() => [...document.querySelectorAll('.cm-content .cm-line')].map(e => e.textContent).join('\\n')")
        assert got.strip() == 'move("right")\nharvest()', got
        a.page.click("#to-nodes")
        a.page.wait_for_timeout(GUARD_WAIT)
        assert not a.page.query_selector(".modal"), "no 'edits will be lost' dialog"
        assert json.loads(a.js("(k) => localStorage.getItem(k)", DEV_SAVE_KEY))["garden"]["mode"] == "nodes"
        assert not a.errors, a.errors


def test_garden_sheet_once():
    """v0.13.6: 「노드」 단추가 빠르게 두 번 눌려도(아이폰에서 두 번 톡) 노드 더하기 창은 한 장만 열리고,
    노드를 고르면 창이 남지 않는다(사용자 보고: 노드는 생기는데 창이 그대로)."""
    with App("iPhone 17", save=_garden_seed(4, _garden(order_idx=4)), reduced=True) as a:
        _open_garden(a)
        a.js("""() => { const b = document.querySelector('.g-add[data-parent=""][data-slot=body]'); b.click(); b.click(); }""")
        a.page.wait_for_selector(".modal.g-sheet")
        a.page.wait_for_timeout(300)
        n = a.js("() => document.querySelectorAll('.modal.g-sheet').length")
        assert n == 1, "add-node sheets open: %d" % n
        before = len(a.save()["garden"]["program"])
        a.page.click(".modal.g-sheet [data-kind=move]")
        a.page.wait_for_timeout(300)
        assert not a.page.query_selector(".modal.g-sheet"), "a sheet is still open after picking"
        assert len(a.save()["garden"]["program"]) == before + 1
        # 노드 메뉴(⋯)·값 고르기도 두 번 눌려 겹치지 않음
        a.js("() => { const b = document.querySelector('.g-node .g-menu'); b.click(); b.click(); }")
        a.page.wait_for_selector(".modal.g-sheet")
        a.page.wait_for_timeout(300)
        assert a.js("() => document.querySelectorAll('.modal.g-sheet').length") == 1
        assert not a.errors, a.errors


def test_first_language_follows_phone():
    """v0.14.0: 처음 여는 사람은 휴대폰 언어를 따른다 — 영어 휴대폰이면 영어로 시작(한글 없음), 한국어 휴대폰이면 한국어.
    이미 저장이 있는 사람은 휴대폰 언어와 상관없이 저장의 언어 그대로. 앱 이름(홈 화면에 추가)도 언어별."""
    fails = []
    with App("iPhone 17", locale="en-US") as a:
        a.page.wait_for_function("() => document.documentElement.lang === 'en'", timeout=20_000)
        a.page.wait_for_selector(".screen.splash #go")
        left = _hangul_left(a, ["한국어"])
        if left:
            fails.append("English phone splash: %r" % left)
        if a.save().get("settings", {}).get("lang") != "en":
            fails.append("first-run English choice not saved: %r" % a.save().get("settings"))
        man = a.js("() => document.querySelector('link[rel=manifest]').getAttribute('href')")
        title = a.js("() => (document.querySelector('meta[name=apple-mobile-web-app-title]') || {}).content")
        if not man.endswith("manifest.en.webmanifest") or title != "Ria & Python":
            fails.append("app name not English: %r %r" % (man, title))
        a.start()
        left = _hangul_left(a, ["한국어"])
        if left:
            fails.append("English phone home: %r" % left)
        a.shot("en-first-run-home.png")
    with App("iPhone 17", locale="ko-KR") as a:
        a.page.wait_for_selector(".screen.splash #go")
        if a.js("() => document.documentElement.lang") != "ko":
            fails.append("Korean phone did not start in Korean")
        man = a.js("() => document.querySelector('link[rel=manifest]').getAttribute('href')")
        if not man.endswith("manifest.webmanifest") or man.endswith(".en.webmanifest"):
            fails.append("Korean manifest wrong: %r" % man)
    with App("iPhone 17", locale="en-US", save=_garden_seed(1, xp=40)) as a:
        a.page.wait_for_selector(".screen.splash #go")
        if a.js("() => document.documentElement.lang") != "ko":
            fails.append("existing Korean save switched to English on an English phone")
    assert not fails, "\n".join(fails)


def test_language_follows_phone_until_chosen():
    """v0.14.3: 언어 단추를 직접 누르지 않은 사람은 열 때마다 휴대폰 언어(저장이 있어도), 누른 뒤에는 그 선택을 지킨다.
    langChosen 칸이 없던 옛 저장은 「고른 것」 — 영어 휴대폰에서도 한국어 그대로(앞 시험의 마지막 경우)."""
    fails = []

    # 1) 한국어 휴대폰에서 처음 열고(아무것도 안 고름) → 저장에 langChosen false
    with App("iPhone 17", locale="ko-KR") as a:
        a.page.wait_for_selector(".screen.splash #go")
        a.start()
        saved = a.save()
    if saved.get("settings", {}).get("langChosen") is not False:
        fails.append("fresh save should not count as chosen: %r" % saved.get("settings"))
    # 2) 같은 저장으로 영어 휴대폰에서 열면 영어(앱 안 글, 앱 이름, 여는 중 글)
    boot = []
    with App("iPhone 17", locale="en-US", save=saved, init_js=BOOT_TEXT_JS) as a:
        boot.extend(a.js("() => [window.__bootText, window.__bootLang]"))
        a.page.wait_for_function("() => document.documentElement.lang === 'en'", timeout=20_000)
        a.page.wait_for_selector(".screen.home, .screen.splash")
        if a.save().get("settings", {}).get("lang") != "en":
            fails.append("not-chosen save on English phone did not switch: %r" % a.save().get("settings"))
        man = a.js("() => document.querySelector('link[rel=manifest]').getAttribute('href')")
        if not man.endswith("manifest.en.webmanifest"):
            fails.append("app name not English: %r" % man)
        left = _hangul_left(a, ["한국어"])
        if left:
            fails.append("English phone, not-chosen save: %r" % left)
        again = a.save()
    if len(boot) != 2 or not boot[0] or re.search(r"[가-힣]", boot[0]) or boot[1] != "en":
        fails.append("boot text before the app starts should be English: %r" % boot)
    # 3) 다시 한국어 휴대폰 → 한국어로 돌아옴
    with App("iPhone 17", locale="ko-KR", save=again) as a:
        a.page.wait_for_selector(".screen.home, .screen.splash")
        if a.js("() => document.documentElement.lang") != "ko" or a.save()["settings"]["lang"] != "ko":
            fails.append("not-chosen save on Korean phone did not come back to Korean")
    # 4) 영어 휴대폰에서 「한국어」를 직접 고르면, 다음에 영어 휴대폰으로 열어도 한국어
    with App("iPhone 17", locale="en-US") as a:
        a.page.wait_for_selector(".screen.splash .lang-pick")
        a.page.wait_for_function("() => document.documentElement.lang === 'en'", timeout=20_000)
        a.page.click('.lang-pick [data-lang="ko"]')
        a.page.wait_for_function("() => document.documentElement.lang === 'ko'")
        picked = a.save()
    if picked.get("settings", {}).get("langChosen") is not True:
        fails.append("pressing a language button should mark it chosen: %r" % picked.get("settings"))
    with App("iPhone 17", locale="en-US", save=picked) as a:
        a.page.wait_for_selector(".screen.splash #go")
        a.page.wait_for_timeout(500)
        if a.js("() => document.documentElement.lang") != "ko":
            fails.append("chosen Korean was overridden by the English phone")
    # 5) 한국어 휴대폰에서 「English」를 고르면, 다음에 한국어 휴대폰으로 열어도 영어
    with App("iPhone 17", locale="ko-KR") as a:
        a.page.wait_for_selector(".screen.splash .lang-pick")
        a.page.click('.lang-pick [data-lang="en"]')
        a.page.wait_for_function("() => document.documentElement.lang === 'en'", timeout=20_000)
        picked = a.save()
    with App("iPhone 17", locale="ko-KR", save=picked) as a:
        a.page.wait_for_function("() => document.documentElement.lang === 'en'", timeout=20_000)
        a.page.wait_for_selector(".screen.splash #go")
        if a.save()["settings"]["lang"] != "en":
            fails.append("chosen English was overridden by the Korean phone")
    assert not fails, "\n".join(fails)


def test_english_daily_review():
    """v0.14.0(v0.13.4 검토 M9): 영어로 배우는 사람(일반 모드) — 틀린 답 설명, 매일 도전(문제·완료), 복습 화면에도 한글이 없다."""
    done12 = ["%d-%d" % (c, k) for c in (1, 2) for k in range(1, 6)]
    seed = {"saveVer": 2, "completed_lessons": done12, "current_chapter": 3, "current_lesson": "3-1",
            "review_queue": ["slice", "int"], "settings": {"sound": False, "dailyGoal": 10, "name": "", "lang": "en"}}
    fails = []
    with App("iPhone 17", save=seed) as a:
        a.page.wait_for_function("() => document.documentElement.lang === 'en'", timeout=20_000)
        a.start()

        def check(name, app=a):
            left = _hangul_left(app)
            if left:
                fails.append("%s: %r" % (name, left))
        check("home")
        # 틀린 답 설명(3-1, 첫 터치 문제를 한 번 틀림)
        a.page.click('[data-lesson="3-1"]')
        a.page.wait_for_selector(".card-view, article.item", timeout=20_000)
        a.play("3-1", wrong=(0, 1), hook=lambda name, app: check("3-1 " + name, app))
        a.dismiss()
        check("3-1 done")
        a.page.click("#home")
        a.page.wait_for_selector(".screen.home")
        a.dismiss()
        # 매일 도전
        a.wait_py()
        a.page.click("#daily")
        for i in range(3):
            a.page.wait_for_selector("article.item", timeout=PY_READY_MS)
            check("daily item %d" % i)
            _daily_answer_one(a, {})
        a.page.wait_for_selector(".screen.done", timeout=10_000)
        a.page.wait_for_timeout(300)
        check("daily done")
        a.shot("en-daily-done.png")
        a.page.click("#home")
        a.page.wait_for_selector(".screen.home")
        # 복습
        if a.page.query_selector("#review"):
            a.page.click("#review")
            a.page.wait_for_selector("article.item", timeout=20_000)
            check("review item")
            a.shot("en-review.png")
        else:
            fails.append("no review button with a review queue")
        if a.errors:
            fails.append("errors %r" % a.errors)
    assert not fails, "\n".join(fails)


BOOT_TEXT_JS = """(() => { const grab = () => { const p = document.querySelector('#app .boot');
  if (p) { window.__bootText = p.textContent; window.__bootLang = document.documentElement.lang; } };   // 사라지기 전 마지막 모습
  document.addEventListener('DOMContentLoaded', grab);
  new MutationObserver(grab).observe(document, { childList: true, subtree: true, characterData: true }); })();"""


def test_boot_text_language():
    """v0.14.0 검토 I2: 앱이 뜨기 전 「여는 중」 글도 그 사람의 언어 — 영어 휴대폰 처음·영어 저장이면 영어, 한국어면 한국어."""
    fails = []
    with App("iPhone 17", locale="en-US", init_js=BOOT_TEXT_JS) as a:
        t, l = a.js("() => [window.__bootText, window.__bootLang]")
        if not t or re.search(r"[가-힣]", t) or l != "en":
            fails.append("English phone boot text: %r lang %r" % (t, l))
    seed = dict(_garden_seed(1, xp=40), settings={"sound": False, "dailyGoal": 10, "name": "", "lang": "en"})
    with App("iPhone 17", locale="ko-KR", save=seed, init_js=BOOT_TEXT_JS) as a:
        t, l = a.js("() => [window.__bootText, window.__bootLang]")
        if not t or re.search(r"[가-힣]", t):
            fails.append("English save on Korean phone boot text: %r" % t)
    with App("iPhone 17", locale="ko-KR", init_js=BOOT_TEXT_JS) as a:
        t, l = a.js("() => [window.__bootText, window.__bootLang]")
        if not t or not re.search(r"[가-힣]", t) or l != "ko":
            fails.append("Korean phone boot text: %r lang %r" % (t, l))
    assert not fails, "\n".join(fails)


BROKEN_WORDS_JS = r"""(sel) => {
  // 낱말 하나가 두 줄로 쪼개졌는지: 낱말마다 Range를 만들어 줄(사각형)이 둘 이상인지 본다
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden]') || !el.offsetParent) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const re = /[A-Za-z][A-Za-z'’-]{2,}/g;
      let m;
      while ((m = re.exec(n.data))) {
        const r = document.createRange();
        r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const tops = new Set([...r.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top)));
        if (tops.size > 1) out.push(m[0]);
      }
    }
  }
  return out;
}"""


def test_english_no_broken_words():
    """v0.14.0 QA H1: 좁은 휴대폰(iPhone SE 320px, Galaxy S24 360px)에서 영어 낱말이 중간에서 끊기지 않는다
    (「Setting/s」, 「Gro/w」, 장 이름 「Expressio/ns」)."""
    seed = dict(_garden_seed(2, xp=40), settings={"sound": False, "dailyGoal": 10, "name": "", "lang": "en"})
    fails = []
    for dev in ("iPhone SE", "Galaxy S24"):
        with App(dev, locale="en-US", save=seed) as a:
            a.start()
            for name, go in (("home", None), ("settings", "settings"), ("badges", "badges"), ("garden", "garden")):
                if go:
                    a.page.click('.tabbar [data-go="%s"]' % go)
                    a.page.wait_for_timeout(400)
                broken = a.js(BROKEN_WORDS_JS, "#app, .tabbar")
                if broken:
                    fails.append("%s %s: %r" % (dev, name, sorted(set(broken))[:12]))
                m = measure(a, "en-narrow-%s-%s" % (slug(dev), name))
                over = m["problems"]
                if over:
                    fails.append("%s %s layout: %r" % (dev, name, over[:5]))
            a.shot("en-narrow-%s-garden.png" % slug(dev))
    assert not fails, "\n".join(fails)


def test_install_sheet_platforms():
    """v0.14.1: 설정 「홈 화면에 추가 방법」 — 아이폰(사파리) / 안드로이드(크롬) 두 갈래. 쓰는 휴대폰 쪽이 먼저 열리고,
    다른 쪽 탭을 누르면 그 안내로 바뀐다. 영어도 같고 한글이 없다. 넘침 없음."""
    fails = []
    cases = (("Galaxy S24", "ko-KR", "android"), ("iPhone 17", "ko-KR", "ios"), ("Galaxy S24", "en-US", "android"),
             ("iPhone SE", "en-US", "ios"))
    for dev, loc, first in cases:
        with App(dev, locale=loc) as a:
            a.start()
            a.page.click('.tabbar [data-go="settings"]')
            a.page.wait_for_selector(".screen.settings")
            a.page.click("#install")
            a.page.wait_for_selector(".modal.install")
            sel = a.js("() => (document.querySelector('.ins-tabs [aria-selected=true]') || {}).dataset?.p")
            if sel != first:
                fails.append("%s %s: first tab %r, want %r" % (dev, loc, sel, first))
            vis = a.js("() => [...document.querySelectorAll('.ins-panel')].filter(p => !p.hidden).map(p => p.dataset.p)")
            if vis != [first]:
                fails.append("%s %s: visible panels %r" % (dev, loc, vis))
            steps = a.js("() => [...document.querySelectorAll('.ins-panel:not([hidden]) .ins-steps li')].length")
            if steps != 3:
                fails.append("%s %s: %d steps" % (dev, loc, steps))
            if first == "android":
                txt = a.page.inner_text(".ins-panel:not([hidden])")
                if "⋮" not in txt:
                    fails.append("%s %s: android steps lack the ⋮ menu" % (dev, loc))
                # v0.14.2: 안드로이드도 비행기 모드(초록)·기록 주의(노랑) 안내
                boxes = a.js("() => [...document.querySelectorAll('#ins-android .ins-after, #ins-android .ins-why')].map(e => e.className.split(' ')[0])")
                if boxes != ["ins-after", "ins-why"]:
                    fails.append("%s %s: android boxes %r" % (dev, loc, boxes))
                want = ("비행기 모드", "사이트 데이터", "저장 내보내기") if loc == "ko-KR" else ("airplane mode", "site data", "Export")
                for w in want:
                    if w not in txt:
                        fails.append("%s %s: android text lacks %r" % (dev, loc, w))
            if loc == "en-US":
                left = _hangul_left(a, ["한국어"])
                if left:
                    fails.append("%s en: %r" % (dev, left))
            tops = a.js("() => [...document.querySelectorAll('.ins-tabs [role=tab]')].map(b => Math.round(b.getBoundingClientRect().top))")
            if len(set(tops)) != 1:
                fails.append("%s %s: tabs not side by side %r" % (dev, loc, tops))
            m = measure(a, "install-%s-%s-%s" % (slug(dev), loc, first))
            if m["problems"]:
                fails.append("%s %s layout: %r" % (dev, loc, m["problems"][:4]))
            other = "ios" if first == "android" else "android"
            a.page.click('.ins-tabs [data-p="%s"]' % other)
            vis = a.js("() => [...document.querySelectorAll('.ins-panel')].filter(p => !p.hidden).map(p => p.dataset.p)")
            if vis != [other]:
                fails.append("%s %s: after tab click visible %r" % (dev, loc, vis))
            a.shot("install-%s-%s-%s.png" % (slug(dev), loc, other))
            a.page.click("#ins-ok")
            a.page.wait_for_selector(".modal.install", state="detached")
    assert not fails, "\n".join(fails)


# ---------------------------------------------------------------- 경비실 (v0.15 작업 7)

G1_START = 'if attempt {0} password:\n    {1}\nelse:\n    {2}\n'
G1_SOLUTION = 'if attempt == password:\n    allow()\nelse:\n    block()\n'
DOCS_IMG = os.path.join(ROOT, "docs", "img")


def _guard_seed(chapters, guard=None, en=False):
    """경비실 시험 저장. 텃밭은 새 소식이 없는 상태(주문 2), 바이트 17.
    판정 G-C2: 오늘 퀘스트에 「XP 얻기」가 없고 연속 기록 이정표도 없어 경비실 XP로 바이트가 생길 길이 없다."""
    s = _garden_seed(chapters, garden=_garden(order_idx=2), xp=40)
    s["bytes"] = 17
    s["quests"] = {"date": today(), "ids": ["q_lessons2", "q_hintfree", "q_garden"], "progress": {}, "done": [], "chest": False}
    if en:
        s["settings"] = {"sound": False, "dailyGoal": 10, "name": "", "lang": "en"}
    if guard is not None:
        s["guard"] = guard
    return s


def _guard_g(**kw):
    g = {"v": 1, "solved": {}, "code": {}, "blanks": {}, "seen": [], "attempts": {}, "runs": 0}
    g.update(kw)
    return g


def _open_guard(a, loaded=True):
    _open_garden(a)
    a.page.click("#g-guard")
    a.page.wait_for_selector(".screen.guard")
    if loaded:   # v0.16.0: 사건 본문은 장 파일에서 받는다(「불러오는 중」 → 카드)
        a.page.wait_for_selector(".screen.guard[data-state=idle] #gd-card svg[role=img]", timeout=15_000)
    a.page.wait_for_timeout(150)


def _gd_state(a):
    return a.js("() => document.querySelector('.screen.guard').dataset.state")


def _gd_pick(a, n, v):
    a.page.click('.gd-blank[data-n="%d"]' % n)
    _sheet_pick(a, '[data-v="%d"]' % v)


def _gd_run(a, skip=True):
    """「실행」 → (재생이면 건너뛰기) → 끝날 때까지"""
    a.wait_py()
    a.page.click("#gd-run")
    if skip:
        a.page.wait_for_selector(".screen.guard[data-state=replay]", timeout=30_000)
        a.page.click("#gd-skip")
    a.page.wait_for_selector(".screen.guard[data-state=idle]", timeout=30_000)


def _gd_check_layout(a, name, fails):
    m = measure(a, name)
    if m["problems"]:
        fails.append("%s layout: %r" % (name, m["problems"][:5]))
    if m["small"]:
        fails.append("%s touch < 44: %r" % (name, m["small"][:5]))


def test_guard_room_locked():
    """2장까지 통과: 텃밭의 경비실 단추는 자물쇠, 누르면 「3장을 끝내면 열려요」 알림(화면은 그대로)."""
    with App("iPhone 17", save=_guard_seed(2)) as a:
        _open_garden(a)
        b = a.page.query_selector("#g-guard")
        assert b and b.is_visible(), "경비실 단추"
        assert b.get_attribute("data-locked") == "1", "잠김 표시"
        assert not b.query_selector('svg path[d^="M5.338"]'), "잠겼을 때는 자물쇠 아이콘"
        assert "3장을 끝내면 열려요" in (b.get_attribute("aria-label") or ""), b.get_attribute("aria-label")
        assert not a.page.query_selector('.tabbar [data-go="garden"] .tab-dot'), "2장: 경비실 새 소식 없음"
        b.click()
        a.page.wait_for_selector(".toast")
        assert "3장을 끝내면 열려요" in a.page.inner_text("#toasts")
        assert a.page.query_selector(".screen.garden") and not a.page.query_selector(".screen.guard")
        assert not a.errors, a.errors


def test_guard_room_g1():
    fails = []
    with App("iPhone 17", save=_guard_seed(3)) as a:
        a.start()
        if not a.page.query_selector('.tabbar [data-go="garden"] .tab-dot'):
            fails.append("no news dot on garden tab")
        a.page.click('.tabbar [data-go="garden"]')
        a.page.wait_for_selector(".screen.garden")
        if not a.page.query_selector("#g-guard .gd-dot"):
            fails.append("no news dot on guard button")
        if not a.page.query_selector('#g-guard svg path[d^="M5.338"]'):
            fails.append("guard button lacks shield-check icon")
        a.page.click("#g-guard")
        a.page.wait_for_selector(".screen.guard")
        a.page.wait_for_timeout(200)
        if not a.page.query_selector("#gd-card svg[role=img]"):
            fails.append("no crow svg in card")
        if not a.page.query_selector('#gd-gate-t svg path[d^="M5.338"]'):
            fails.append("gate heading lacks shield-check icon")
        head = a.page.inner_text(".gd-head")
        for w in ("견습 문지기", "0/45 해결"):
            if w not in head:
                fails.append("head lacks %r: %r" % (w, head))
        card = a.page.inner_text("#gd-card")
        for w in ("창고 문 암호", "대응", "인증"):
            if w not in card:
                fails.append("card lacks %r" % w)
        if "G1" not in (a.save().get("guard") or {}).get("seen", []):
            fails.append("G1 not marked seen")
        os.makedirs(DOCS_IMG, exist_ok=True)
        a.page.screenshot(path=os.path.join(DOCS_IMG, "guard-g1.png"))
        a.shot("guard-g1.png")
        _gd_check_layout(a, "guard-open", fails)

        # 빈칸 하나만 → 실행 막힘, 첫 빈 칸 흔들림
        _gd_pick(a, 0, 0)
        a.wait_py()
        a.page.click("#gd-run")
        a.page.wait_for_timeout(300)
        if not a.page.query_selector('.gd-blank[data-n="1"].gd-shake'):
            fails.append("first empty blank does not shake")
        if _gd_state(a) != "idle" or (a.save().get("guard") or {}).get("attempts", {}).get("G1"):
            fails.append("ran with an empty blank")

        # 오답(!=) → 재생 중 실행 막힘, ❌/⚠️, 칸 눌러 왜?
        _gd_pick(a, 0, 1)
        _gd_pick(a, 1, 0)
        _gd_pick(a, 2, 0)
        a.page.click("#gd-run")
        a.page.wait_for_selector(".screen.guard[data-state=replay]", timeout=30_000)
        if not a.page.is_disabled("#gd-run"):
            fails.append("run not disabled during replay")
        a.page.wait_for_selector(".screen.guard[data-state=idle]", timeout=30_000)
        bad = a.js("() => [...document.querySelectorAll('.gd-try')].map(e => e.textContent).filter(x => /❌|⚠️/.test(x)).length")
        if not bad:
            fails.append("no ❌/⚠️ cell after a wrong run")
        res = a.page.inner_text("#gd-result")
        if "막은 공격" not in res or "들인 손님" not in res:
            fails.append("result line: %r" % res)
        a.page.evaluate("() => window.scrollTo(0, 0)")
        a.page.click(".gd-try.bad >> nth=0")
        a.page.wait_for_timeout(900)   # 부드러운 스크롤이 끝나길 기다림
        wy = a.js("() => { const w = document.querySelector('#gd-why').getBoundingClientRect(); const f = document.querySelector('.g-foot').getBoundingClientRect(); return { wb: w.bottom, wt: w.top, ft: f.top }; }")
        if not (wy["wb"] <= wy["ft"] and wy["wt"] >= 0):   # 「왜?」 전체가 고정 「실행」 줄 위에 보여야 한다
            fails.append("why hidden under the sticky bar: %r" % wy)
        why = a.page.inner_text("#gd-why") if a.page.query_selector("#gd-why") else ""
        if "암호와 똑같아서 들입니다." not in why:   # 첫 틀린 칸 = 맞는 암호를 잘못 막음(⚠️)
            fails.append("why not shown: %r" % why)
        a.page.screenshot(path=os.path.join(DOCS_IMG, "guard-replay.png"))
        a.shot("guard-replay.png")
        _gd_check_layout(a, "guard-after-wrong", fails)

        # 정답 → 사건 해결, XP +5, firstTry false, 바이트 그대로
        _gd_pick(a, 0, 0)
        a.page.click("#gd-run")
        a.page.wait_for_selector(".screen.guard[data-state=replay]", timeout=30_000)
        a.page.click("#gd-skip")
        a.page.wait_for_selector(".modal .gd-done", timeout=15_000)
        body = a.page.inner_text(".modal")
        if "사건 해결" not in body or "XP +5" not in body:
            fails.append("solved dialog: %r" % body)
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.click(".modal .btn.primary")
        a.page.wait_for_selector(".modal .gd-done", state="detached")
        s = a.save()
        g = s.get("guard") or {}
        if g.get("solved", {}).get("G1") != {"firstTry": False, "how": "blank"}:
            fails.append("solved G1: %r" % g.get("solved"))
        if s["bytes"] != 17:
            fails.append("bytes changed: %r" % s["bytes"])
        if s["xp"] != 45:
            fails.append("xp: %r" % s["xp"])
        if "q_xp20" in (s.get("quests") or {}).get("ids", []):
            fails.append("seed should have no xp quest (G-C2)")
        if "사건 해결" not in a.page.inner_text("#gd-result"):
            fails.append("result lacks 사건 해결")
        if "1/45 해결" not in a.page.inner_text(".gd-head"):
            fails.append("count not 1/45")

        # 직접 쓰기: 처음 내용은 정답 보기로 채운 코드(고른 것이 틀려도 같음) → 정답 코드 → 해결, how 그대로
        _gd_pick(a, 0, 1)   # 해결 뒤 틀린 보기를 골라 둠
        a.page.click("#gd-mode")
        a.page.wait_for_selector("#gd-ed .cm-content")
        first = a.js("() => [...document.querySelectorAll('.cm-content .cm-line')].map(e => e.textContent).join('\\n')")
        want = G1_SOLUTION   # v0.16.1: 해결한 고르기로 채운 코드(판정 G-C7 바꿈)
        if first != want:
            fails.append("code mode first content %r != %r" % (first, want))
        _gd_check_layout(a, "guard-code", fails)
        a.set_code(G1_SOLUTION)
        _gd_run(a)
        if "사건 해결" not in a.page.inner_text("#gd-result"):
            fails.append("code mode not solved: %r" % a.page.inner_text("#gd-result"))
        g = a.save().get("guard") or {}
        if g.get("solved", {}).get("G1", {}).get("how") != "blank":
            fails.append("how changed: %r" % g.get("solved"))
        if g.get("code", {}).get("G1") != G1_SOLUTION:
            fails.append("code not saved: %r" % g.get("code"))
        if a.page.query_selector(".modal"):
            fails.append("dialog again on a re-solve")
        if a.errors:
            fails.append("console errors %r" % a.errors)
    assert not fails, "\n".join(fails)


def _guard_solved_g1():
    return _guard_g(solved={"G1": {"firstTry": True, "how": "blank"}}, blanks={"G1": [0, 0, 0]}, attempts={"G1": 1}, runs=1)


def _gd_open_g1(a):
    """해결한 G1은 목록에서 골라야 열린다(처음 열림은 풀지 않은 사건)."""
    a.page.click("#gd-list")
    _sheet_pick(a, '[data-g="G1"]')
    a.page.wait_for_selector(".screen.guard[data-state=idle] #gd-mode")


def _gd_code_run(a, code):
    _gd_open_g1(a)
    a.page.click("#gd-mode")
    a.page.wait_for_selector("#gd-ed .cm-content")
    a.set_code(code)
    _gd_run(a)


def test_guard_room_no_decision():
    """v0.16.1 작업 2: allow/block을 안 부른 시도(`pass`)는 손님 칸에서도 ⚪ 「판정 안 함」 — 해결 아님, 「왜?」 첫 줄 안내."""
    with App("iPhone 17", save=_guard_seed(3, guard=_guard_solved_g1())) as a:
        _open_guard(a)
        _gd_code_run(a, 'if attempt == password:\n    pass\nelse:\n    block()\n')
        marks = a.js("() => [...document.querySelectorAll('.gd-try')].map(e => e.textContent)")
        assert any("⚪" in m for m in marks), marks
        assert a.page.query_selector(".gd-try.none"), "none 칸 클래스"
        assert "사건 해결" not in a.page.inner_text("#gd-result")
        a.page.click(".gd-try.none >> nth=0")
        why = a.page.inner_text("#gd-why")
        assert why.split("\n")[0] == "이 시도에서 allow()도 block()도 부르지 않았어요", why
        assert "판정 안 함" in why, why
        s = a.save()["guard"]
        assert s["solved"]["G1"] == {"firstTry": True, "how": "blank"}
        assert not a.errors, a.errors


def test_guard_room_starter_names():
    """v0.16.1 G3-C15: 「지워진 시작 코드」 안내는 직접 쓰기에서, 시작 코드가 만드는 이름일 때만. 빈칸 고르기 오답(G37 gate)은 보통 NameError 안내."""
    g = _guard_g(solved={"G37": {"firstTry": True, "how": "blank"}}, blanks={"G37": [0, 0, 0]}, attempts={"G37": 1}, runs=1)
    with App("iPhone 17", save=_guard_seed(17, guard=g)) as a:
        _open_guard(a)
        a.page.click("#gd-list")
        _sheet_pick(a, '[data-g="G37"]')
        a.page.wait_for_selector(".screen.guard[data-state=idle] #gd-mode")
        _gd_pick(a, 0, 1)   # self 대신 gate
        _gd_run(a, skip=False)
        a.page.wait_for_selector("#gd-result .err-panel")
        title = a.page.inner_text("#gd-result .err-panel h3")
        assert "NameError" in title and "지워진 시작 코드" not in title, title
        a.page.click("#gd-mode")
        a.page.wait_for_selector("#gd-ed .cm-content")
        a.set_code("def check(attempt):\n    return gate.allows(attempt)\n")   # gate = Gate(...) 줄을 지움
        _gd_run(a, skip=False)
        a.page.wait_for_selector("#gd-result .err-panel")
        title = a.page.inner_text("#gd-result .err-panel h3")
        assert "지워진 시작 코드" in title, title
        a.set_code("def check(attempt):\n    return nobody.allows(attempt)\n")   # 시작 코드에 없는 이름
        _gd_run(a, skip=False)
        a.page.wait_for_selector("#gd-result .err-panel")
        title = a.page.inner_text("#gd-result .err-panel h3")
        assert "지워진 시작 코드" not in title, title
        assert not a.errors, a.errors


def test_guard_room_polish():
    """v0.16.1 작업 7: 영어 머리 부제가 잘리지 않고, 오류 카드가 고정 줄에 가려지지 않고, 직접 쓰기 첫 내용에 ___ 가 없다."""
    fails = []
    with App("iPhone 17", locale="en-US", save=_guard_seed(3, guard=_guard_solved_g1(), en=True)) as a:
        _open_guard(a)
        h = a.js("""() => { const e = document.querySelector('#gd-rank'); const c = getComputedStyle(e);
            return { sw: e.scrollWidth, cw: e.clientWidth, to: c.textOverflow, ws: c.whiteSpace, txt: e.textContent }; }""")
        if h["sw"] > h["cw"] or h["to"] == "ellipsis" or h["ws"] == "nowrap":
            fails.append("rank subtitle clipped: %r" % h)
        _gd_open_g1(a)
        _gd_pick(a, 0, 1)
        a.page.click("#gd-mode")
        a.page.wait_for_selector("#gd-ed .cm-content")
        first = a.js("() => [...document.querySelectorAll('.cm-content .cm-line')].map(e => e.textContent).join('\\n')")
        if "___" in first or "allow()" not in first:
            fails.append("write-mode first content: %r" % first)
        # 오류가 나는 코드 → 오류 카드 위쪽이 화면 안, 아래 고정 줄 위쪽보다 위
        a.set_code("print(undefined_name)\n")
        _gd_run(a, skip=False)
        a.page.wait_for_selector("#gd-result .err-panel")
        a.page.wait_for_timeout(900)   # 부드러운 스크롤이 끝나길
        r = a.js("""() => ({ top: document.querySelector('#gd-result .err-panel').getBoundingClientRect().top,
            foot: document.querySelector('.g-foot').getBoundingClientRect().top })""")
        if not (0 <= r["top"] < r["foot"]):
            fails.append("error card not visible: %r" % r)
        if a.errors:
            fails.append("console errors %r" % a.errors)
    assert not fails, "\n".join(fails)


def test_guard_room_shuffled_blanks():
    """v0.16.1 작업 4: 보기는 섞여 보이지만 저장은 데이터 번호, 다시 열면 같은 글자가 골라져 있다."""
    inc = json.loads(subprocess.check_output(["node", "tests/guard_incidents_helper.mjs"], cwd=ROOT))["incidents"][0]
    assert inc["id"] == "G1"
    with App("iPhone 17", save=_guard_seed(3)) as a:
        _open_guard(a)
        texts = [b["options"][b["answer"]] for b in inc["blanks"]]
        order_all = []
        for n, b in enumerate(inc["blanks"]):
            a.page.click('.gd-blank[data-n="%d"]' % n)
            a.page.wait_for_selector(".modal.g-sheet")
            shown = a.js("() => [...document.querySelectorAll('.g-pick-btn')].map(e => +e.dataset.v)")
            assert sorted(shown) == list(range(len(b["options"]))), shown
            order_all.append(shown)
            a.page.click('.modal.g-sheet .g-pick-btn:has-text("%s")' % texts[n])
            a.page.wait_for_selector(".modal.g-sheet", state="detached")
        assert any(o != sorted(o) for o in order_all), order_all
        assert (a.save().get("guard") or {}).get("blanks", {}).get("G1") == [0, 0, 0], a.save().get("guard")
        _gd_run(a)
        a.page.wait_for_selector(".modal .gd-done", timeout=15_000)
        a.page.click(".modal .btn.primary")
        a.page.wait_for_selector(".modal .gd-done", state="detached")
        a.page.reload()
        _open_guard(a)
        _gd_open_g1(a)
        got = a.js("() => [...document.querySelectorAll('.gd-blank')].map(e => e.textContent)")
        assert got == texts, (got, texts)
        assert not a.errors, a.errors


def test_guard_room_twice_mark():
    """v0.16.1 작업 2: 한 시도에 판정을 두 번 하면 칸에 「2번」, 「왜?」 앞에 안내 한 줄(첫 판정만 셈)."""
    with App("iPhone 17", save=_guard_seed(3, guard=_guard_solved_g1())) as a:
        _open_guard(a)
        _gd_code_run(a, 'allow()\nblock()\n')
        cell = a.page.inner_text(".gd-try >> nth=0")
        assert "2번" in cell, cell
        a.page.click(".gd-try >> nth=0")
        why = a.page.inner_text("#gd-why")
        assert "이 시도에서 판정을 두 번 했어요 — 첫 번째만 셌어요" in why, why
        assert not a.errors, a.errors


def test_guard_room_engine_crash():
    """작업 1 연결: 치명 오류(EngineCrash)는 저장을 건드리지 않고, 다시 준비하는 동안 「실행」은 꺼졌다가 준비되면 켜진다."""
    with App("iPhone 17", save=_guard_seed(3, guard=_guard_solved_g1())) as a:
        _open_guard(a)
        _gd_open_g1(a)
        before = a.save()["guard"]
        a.page.click("#gd-mode")
        a.page.wait_for_selector("#gd-ed .cm-content")
        a.set_code("x = []\nfor i in range(100000):\n    x = [x]\nprint(x)\n")
        a.wait_py()
        a.page.click("#gd-run")
        a.page.wait_for_selector(".screen.guard[data-state=idle]", timeout=60_000)
        a.page.wait_for_function("() => document.querySelector('#gd-result').innerText.trim().length > 0", timeout=30_000)
        after = a.save()["guard"]
        for k in ("solved", "attempts", "runs"):   # 쓴 코드(code)만 저장되고, 해결·시도·실행 횟수는 그대로
            assert after[k] == before[k], (k, before, after)
        assert "사건 해결" not in a.page.inner_text("#gd-result")
        st = a.js("() => ({ s: window.__ria.app.pyStatus, d: document.querySelector('#gd-run').disabled })")
        if st["s"] != "ready":
            assert st["d"] is True, st
        a.wait_py()
        a.page.wait_for_function("() => !document.querySelector('#gd-run').disabled", timeout=10_000)
        a.set_code(G1_SOLUTION)
        _gd_run(a)
        assert "막은 공격" in a.page.inner_text("#gd-result")
        noise = ("Pyodide has suffered", "cause of the fatal error", "Maximum call stack", "RangeError")   # 치명 오류가 남기는 기대한 소음
        assert not [e for e in a.errors if not any(n in str(e) for n in noise)], a.errors


def test_guard_room_switch_during_replay():
    """재생 중 사건 목록에서 G2로 바꾸면 재생이 멈추고 결과 영역이 비어 있다(Review Focus 5). 목록: 열림·✓·잠김."""
    fails = []
    guard = _guard_g(seen=["G1"], blanks={"G1": [1, 1, 1]})
    with App("iPhone 17", save=_guard_seed(3, guard=guard)) as a:
        _open_guard(a)
        a.wait_py()
        a.page.click("#gd-run")
        a.page.wait_for_selector(".screen.guard[data-state=replay]", timeout=30_000)
        a.page.click("#gd-list")
        a.page.wait_for_selector(".modal.g-sheet")
        txt = a.page.inner_text(".modal.g-sheet")
        if "4장을 끝내면 열려요" not in txt:
            fails.append("locked G3 note missing: %r" % txt)
        if not a.page.is_disabled('.modal.g-sheet [data-g="G3"]'):
            fails.append("G3 should be locked")
        _gd_check_layout(a, "guard-list", fails)
        _sheet_pick(a, '[data-v="G2"]')
        a.page.wait_for_timeout(100)
        if a.page.inner_text("#gd-result").strip():
            fails.append("result not cleared: %r" % a.page.inner_text("#gd-result"))
        if "한밤중의 손님" not in a.page.inner_text("#gd-card"):
            fails.append("not on G2")
        a.page.wait_for_timeout(3500)   # 옛 재생이 남아 있다면 이 사이 칸·결과를 그린다
        if a.page.inner_text("#gd-result").strip() or a.js("() => document.querySelectorAll('.gd-try.ok, .gd-try.bad').length"):
            fails.append("old replay kept painting")
        if _gd_state(a) != "idle":
            fails.append("state %r after switch" % _gd_state(a))
        g = a.save().get("guard") or {}
        if g.get("attempts", {}).get("G1") != 1 or "G2" not in g.get("seen", []):
            fails.append("save: %r" % g)
        a.page.click("#gd-back")
        a.page.wait_for_selector(".screen.garden")
        if a.errors:
            fails.append("console errors %r" % a.errors)
    assert not fails, "\n".join(fails)


def test_guard_room_english():
    """영어: 경비실 화면·시도 값·「왜?」·목록·해결 창에 한글이 없다(G5 시도 값 order n 포함)."""
    fails = []
    guard = _guard_g(blanks={"G1": [0, 0, 0], "G5": [0, 0]})
    with App("iPhone 17", locale="en-US", save=_guard_seed(5, guard=guard, en=True)) as a:
        _open_guard(a)
        left = _hangul_left(a)
        if left:
            fails.append("open: %r" % left)
        _gd_run(a)
        a.page.wait_for_selector(".modal .gd-done", timeout=15_000)
        left = _hangul_left(a)
        if left:
            fails.append("solved dialog: %r" % left)
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.click(".modal .btn.primary")
        a.page.wait_for_selector(".modal", state="detached")
        a.page.click(".gd-try >> nth=0")
        left = _hangul_left(a)
        if left:
            fails.append("after run: %r" % left)
        a.page.click("#gd-list")
        a.page.wait_for_selector(".modal.g-sheet")
        left = _hangul_left(a)
        if left:
            fails.append("list: %r" % left)
        sheet_txt = a.page.inner_text(".modal.g-sheet") + " " + a.js(
            "() => [...document.querySelectorAll('.modal.g-sheet [aria-label]')].map(e => e.getAttribute('aria-label')).join(' ')")
        if re.search(r"[가-힣]", sheet_txt):
            fails.append("list sheet has Hangul: %r" % sheet_txt)
        _sheet_pick(a, '[data-v="G5"]')
        _gd_run(a)
        vals = a.js("() => [...document.querySelectorAll('.gd-try')].map(e => e.textContent).join(' ')")
        if "order 1" not in vals:
            fails.append("G5 English try values: %r" % vals)
        left = _hangul_left(a)
        if left:
            fails.append("G5: %r" % left)
        a.page.wait_for_selector(".modal .gd-done", timeout=15_000)
        a.page.wait_for_timeout(GUARD_WAIT)
        a.page.click(".modal .btn.primary")
        a.page.wait_for_selector(".modal", state="detached")
        _gd_check_layout(a, "guard-en", fails)
        a.shot("guard-en.png")
        if a.errors:
            fails.append("console errors %r" % a.errors)
    assert not fails, "\n".join(fails)


def test_guard_room_empty_option_label():
    """G6 빈칸 2의 빈 보기(.lower() 안 붙임): 시트·채운 빈칸 모두 이름표 글자가 보이고 aria-label도 있다. 코드에는 빈 글자가 들어간다."""
    with App("iPhone 17", save=_guard_seed(6)) as a:
        _open_guard(a)
        a.page.click("#gd-list")
        _sheet_pick(a, '[data-g="G6"]')
        a.page.wait_for_selector('.gd-blank[data-n="1"]')
        a.page.click('.gd-blank[data-n="1"]')
        a.page.wait_for_selector(".modal.g-sheet .g-pick-btn")
        opts = a.js("""() => [...document.querySelectorAll('.modal.g-sheet .g-pick-btn')].map(b => ({
            text: b.textContent.trim(), aria: (b.getAttribute('aria-label') || '').trim() }))""")
        assert len(opts) == 3, opts
        for o in opts:
            assert o["text"] and o["aria"], opts
        assert any(o["text"] == "(비워 두기)" and o["aria"] == "(비워 두기)" for o in opts), opts
        _sheet_pick(a, '.g-pick-btn[aria-label="(비워 두기)"]')
        b = a.page.query_selector('.gd-blank[data-n="1"]')
        assert b.inner_text().strip() == "(비워 두기)", b.inner_text()
        assert "(비워 두기)" in (b.get_attribute("aria-label") or ""), b.get_attribute("aria-label")
        assert not a.errors, a.errors


def test_guard_room_reduced_motion():
    """움직임 줄이기: 재생 없이 바로 결과(상태가 replay가 되지 않음)."""
    guard = _guard_g(seen=["G1"], blanks={"G1": [1, 0, 0]})
    with App("iPhone 17", save=_guard_seed(3, guard=guard), reduced=True) as a:
        _open_guard(a)
        a.js("""() => { window.__gdStates = []; const s = document.querySelector('.screen.guard');
            new MutationObserver(() => window.__gdStates.push(s.dataset.state)).observe(s, { attributes: true, attributeFilter: ['data-state'] }); }""")
        _gd_run(a, skip=False)
        states = a.js("() => window.__gdStates")
        assert "replay" not in states, states
        assert "막은 공격" in a.page.inner_text("#gd-result")
        assert a.js("() => document.querySelectorAll('.gd-try.ok, .gd-try.bad').length") == 9  # G1 시도 9개(v0.16.1 보강 뒤)
        assert not a.errors, a.errors


GUARD_FILE_GLOB = re.compile(r"/guard/ch\d+-[0-9a-f]{8}\.json$")
GUARD_CH3_GLOB = re.compile(r"/guard/ch3-[0-9a-f]{8}\.json$")


def _app_errors(a):
    """콘솔 오류 중 앱 오류만: 시험이 일부러 막은 요청을 브라우저가 적는 「Failed to load resource」 줄은 뺀다"""
    return [e for e in a.errors if "Failed to load resource" not in e]


def test_guard_room_load_fail_retry():
    """v0.16.0 작업 2: 장 파일을 받지 못하면 「사건을 불러오지 못했어요」·「다시 시도」 → 막기를 풀고 다시 시도 → 사건 카드."""
    fails = []
    with App("iPhone 17", save=_guard_seed(3)) as a:
        a.page.route(GUARD_FILE_GLOB, lambda route: route.abort())
        _open_guard(a, loaded=False)
        a.page.wait_for_selector("#gd-retry", timeout=15_000)
        card = a.page.inner_text("#gd-card")
        if "사건을 불러오지 못했어요" not in card or "다시 시도" not in card:
            fails.append("fail card: %r" % card)
        if a.page.query_selector("#gd-card svg[role=img]"):
            fails.append("crow shown without a body")
        if not a.page.is_disabled("#gd-run"):
            fails.append("run enabled without a body")
        if _gd_state(a) == "idle":
            fails.append("state idle without a body")
        if "G1" in (a.save().get("guard") or {}).get("seen", []):
            fails.append("G1 marked seen before it loaded")
        a.shot("guard-load-fail.png")
        _gd_check_layout(a, "guard-load-fail", fails)
        a.page.unroute(GUARD_FILE_GLOB)
        a.page.click("#gd-retry")
        a.page.wait_for_selector(".screen.guard[data-state=idle] #gd-card svg[role=img]", timeout=15_000)
        if "창고 문 암호" not in a.page.inner_text("#gd-card"):
            fails.append("not on G1 after retry: %r" % a.page.inner_text("#gd-card"))
        if "G1" not in (a.save().get("guard") or {}).get("seen", []):
            fails.append("G1 not marked seen after load")
        if not a.page.query_selector(".gd-blank") or not a.page.query_selector(".gd-try"):
            fails.append("code / tries not painted")
        errs = _app_errors(a)
        if errs:
            fails.append("console errors %r" % errs)
    assert not fails, "\n".join(fails)


def test_guard_room_load_stale_refresh():
    """v0.16 최종 검토: 새 판이 나와 옛 장 파일이 404면 「다시 시도」 대신 「새로 고치기」(lesson.js와 같은 글·동작).
    실패 글은 role=alert, 초점은 새로 고치기 단추로. 누르면 앱을 다시 불러온다."""
    fails = []
    with App("iPhone 17", save=_guard_seed(3)) as a:
        a.page.route(GUARD_FILE_GLOB, lambda route: route.fulfill(status=404, body="not found"))
        _open_guard(a, loaded=False)
        a.page.wait_for_selector("#gd-refresh", timeout=15_000)
        card = a.page.inner_text("#gd-card")
        if "새로 고치기" not in card or "새 판이 나왔어요" not in card:
            fails.append("stale card: %r" % card)
        if a.page.query_selector("#gd-retry"):
            fails.append("retry shown for a stale (404) chapter file")
        if not a.page.query_selector(".gd-loadfail [role=alert]"):
            fails.append("failure message has no role=alert")
        if a.js("() => document.activeElement && document.activeElement.id") != "gd-refresh":
            fails.append("focus not on refresh: %r" % a.js("() => document.activeElement && document.activeElement.id"))
        a.js("() => { window.__beforeReload = 1; }")
        with a.page.expect_navigation(timeout=15_000):
            a.page.click("#gd-refresh")
        if a.js("() => window.__beforeReload || 0"):
            fails.append("refresh did not reload the app")
        errs = _app_errors(a)
        if errs:
            fails.append("console errors %r" % errs)
    assert not fails, "\n".join(fails)


def test_guard_room_switch_while_loading():
    """3장 파일이 늦게 오는 동안 목록에서 4장 G3을 고르면 끝에 화면은 G3이고, 늦게 온 G1 카드는 나타나지 않는다."""
    fails = []
    guard = _guard_g(seen=["G1", "G2"])

    # 3장 파일만 1.5초 늦게(페이지의 fetch를 감싼다. Playwright route에서 기다리면 시험 쪽 동작도 멈춤)
    slow = """(() => { const f = window.fetch.bind(window);
        window.fetch = (u, o) => /\\/guard\\/ch3-[0-9a-f]{8}\\.json$/.test(String(u && u.url || u))
          ? new Promise((res) => setTimeout(res, 1500)).then(() => f(u, o)) : f(u, o);
        new MutationObserver(() => { const e = document.querySelector('#gd-card .gd-id');
          if (e && e.textContent === 'G1') window.__gdG1 = true; }).observe(document, { childList: true, subtree: true }); })();"""

    with App("iPhone 17", save=_guard_seed(4, guard=guard), init_js=slow) as a:
        _open_guard(a, loaded=False)
        a.page.wait_for_selector(".screen.guard[data-state=loading]", timeout=5_000)
        if "사건을 불러오는 중" not in a.page.inner_text("#gd-card"):
            fails.append("loading text: %r" % a.page.inner_text("#gd-card"))
        a.page.click("#gd-list")
        _sheet_pick(a, '[data-v="G3"]')
        a.page.wait_for_selector(".screen.guard[data-state=idle] #gd-card svg[role=img]", timeout=15_000)
        a.page.wait_for_timeout(2500)   # 3장 응답이 이 사이에 온다
        ids = a.js("() => document.querySelector('#gd-card .gd-id')?.textContent")
        if ids != "G3":
            fails.append("card id %r, want G3" % ids)
        if a.js("() => window.__gdG1"):
            fails.append("late G1 card was painted")
        if _gd_state(a) != "idle":
            fails.append("state %r" % _gd_state(a))
        if "G3" not in (a.save().get("guard") or {}).get("seen", []):
            fails.append("G3 not seen")
        errs = _app_errors(a)
        if errs:
            fails.append("console errors %r" % errs)
    assert not fails, "\n".join(fails)


def _gd_solve_from_list(a, gid, answer, fails):
    """목록에서 사건을 열고 빈칸을 정답으로 채워 실행 → 「사건 해결」 창 → 닫기"""
    a.page.click("#gd-list")
    _sheet_pick(a, '[data-v="%s"]' % gid)
    a.page.wait_for_selector(".screen.guard[data-state=idle] #gd-card svg[role=img]", timeout=15_000)
    if a.js("() => document.querySelector('#gd-card .gd-id')?.textContent") != gid:
        fails.append("card is not %s" % gid)
    for n, v in enumerate(answer):
        _gd_pick(a, n, v)
    _gd_run(a)
    a.page.wait_for_selector(".modal .gd-done", timeout=15_000)
    body = a.page.inner_text(".modal")
    if "사건 해결" not in body or "XP +5" not in body:
        fails.append("%s solved dialog: %r" % (gid, body))
    a.page.wait_for_timeout(GUARD_WAIT)
    a.page.click(".modal .btn.primary")
    a.page.wait_for_selector(".modal .gd-done", state="detached")
    if "사건 해결" not in a.page.inner_text("#gd-result"):
        fails.append("%s result: %r" % (gid, a.page.inner_text("#gd-result")))
    bad = a.js("() => document.querySelectorAll('.gd-try.bad').length")
    if bad:
        fails.append("%s: %d bad tries after the right answer" % (gid, bad))
    g = a.save().get("guard") or {}
    if g.get("solved", {}).get(gid) != {"firstTry": True, "how": "blank"}:
        fails.append("%s solved save: %r" % (gid, g.get("solved")))


def test_guard_room_file_case():
    """v0.16.0 작업 8: 11장까지 통과 → 목록에서 G25(파일 사건, blocklist.txt)를 빈칸 정답으로 해결(Review Focus 5)."""
    fails = []
    with App("iPhone 17", save=_guard_seed(11)) as a:
        _open_guard(a)
        _gd_solve_from_list(a, "G25", [0, 0, 0], fails)
        if "차단 목록 파일" not in a.page.inner_text("#gd-card"):
            fails.append("card title: %r" % a.page.inner_text("#gd-card"))
        a.shot("guard-file-case.png")
        _gd_check_layout(a, "guard-file-case", fails)
        if a.errors:
            fails.append("console errors %r" % a.errors)
    assert not fails, "\n".join(fails)


def test_guard_room_json_case():
    """v0.16.0 작업 8: 14장까지 통과 → 목록에서 G34(주문 JSON 검사)를 빈칸 정답으로 해결."""
    fails = []
    with App("iPhone 17", save=_guard_seed(14)) as a:
        _open_guard(a)
        _gd_solve_from_list(a, "G34", [0, 0, 0], fails)
        a.shot("guard-json-case.png")
        _gd_check_layout(a, "guard-json-case", fails)
        if a.errors:
            fails.append("console errors %r" % a.errors)
    assert not fails, "\n".join(fails)


def test_guard_room_eval_warning():
    """v0.16.1 작업 6: G34를 푼 뒤 직접 쓰기로 eval을 쓴 올바른 풀이 → 해결 결과에 「eval」 경고 한 줄(없는 풀이엔 없음)."""
    code = ('items = ["carrot", "potato", "apple"]\n\ndef check(attempt):\n    try:\n        order = eval(attempt)\n'
            '        item = order["item"]\n        qty = order["qty"]\n    except Exception:\n        return False\n'
            '    return item in items and type(qty) == int and 1 <= qty <= 50\n')
    with App("iPhone 17", save=_guard_seed(14, guard=_guard_g(solved={"G34": {"firstTry": True, "how": "blank"}},
                                                               blanks={"G34": [0, 0, 0]}, attempts={"G34": 1}, runs=1))) as a:
        _open_guard(a)
        a.page.click("#gd-list")
        _sheet_pick(a, '[data-g="G34"]')
        a.page.wait_for_selector(".screen.guard[data-state=idle] #gd-mode")
        a.page.click("#gd-mode")
        a.page.wait_for_selector("#gd-ed .cm-content")
        a.set_code(code)
        _gd_run(a)
        res = a.page.inner_text("#gd-result")
        assert "사건 해결" in res, res
        assert "eval은 입력을 코드로 실행해요. JSON은 json.loads로 읽어요" in res, res
        a.page.click("#gd-mode")   # 빈칸 고르기로 → 정답 빈칸 풀이엔 경고 없음
        a.page.wait_for_selector(".gd-blank")
        _gd_run(a)
        res = a.page.inner_text("#gd-result")
        assert "사건 해결" in res and "eval" not in res, res
        assert not a.errors, a.errors


def test_guard_room_list_45():
    """v0.16.0 작업 8: 17장까지 통과 → 머리 「0/45 해결」, 목록 시트에 사건 45개가 장 순서(3장 G1·G2·G7 …), 모두 열림."""
    fails = []
    with App("iPhone 17", save=_guard_seed(17)) as a:
        _open_guard(a)
        head = a.page.inner_text(".gd-head")
        if "0/45 해결" not in head:
            fails.append("head: %r" % head)
        a.page.click("#gd-list")
        a.page.wait_for_selector(".modal.g-sheet")
        ids = a.js("() => [...document.querySelectorAll('.modal.g-sheet .gd-item')].map(b => b.dataset.g)")
        if len(ids) != 45 or set(ids) != {"G%d" % i for i in range(1, 46)}:
            fails.append("list ids: %r" % ids)
        # 장 순서: 목록 차례대로 색인의 need가 줄지 않고, 3~17장 모두 3개씩(G7~G12처럼 뒤에 더한 사건도 제 장 자리에)
        need_of = a.js("() => Object.fromEntries((window.RIA_GUARD_INDEX || []).map(e => [e.id, e.need]))")
        need = [need_of.get(i) for i in ids]
        if need != sorted(need, key=lambda x: x or 0) or [need.count(c) for c in range(3, 18)] != [3] * 15:
            fails.append("chapter order: %r" % list(zip(ids, need)))
        dis = a.js("() => document.querySelectorAll('.modal.g-sheet .gd-item[disabled]').length")
        if dis:
            fails.append("%d locked at chapter 17" % dis)
        if "끝내면 열려요" in a.page.inner_text(".modal.g-sheet"):
            fails.append("lock note at chapter 17")
        a.shot("guard-list-45.png")
        _gd_check_layout(a, "guard-list-45", fails)
        if a.errors:
            fails.append("console errors %r" % a.errors)
    assert not fails, "\n".join(fails)


def test_guard_room_locked_chapters():
    """v0.16.0 작업 8: 6장까지 통과 → 6장 사건(G10~G12)은 열리고, 7장 사건(G13~G15)은 「7장을 끝내면 열려요」로 잠김."""
    fails = []
    with App("iPhone 17", save=_guard_seed(6)) as a:
        _open_guard(a)
        a.page.click("#gd-list")
        a.page.wait_for_selector(".modal.g-sheet")
        for gid in ("G10", "G11", "G12"):
            if a.page.is_disabled('.modal.g-sheet [data-g="%s"]' % gid):
                fails.append("%s should be open" % gid)
        for gid in ("G13", "G14", "G15"):
            b = '.modal.g-sheet [data-g="%s"]' % gid
            if not a.page.is_disabled(b):
                fails.append("%s should be locked" % gid)
            note = a.page.inner_text(b)
            if "7장을 끝내면 열려요" not in note:
                fails.append("%s note: %r" % (gid, note))
        if "8장을 끝내면 열려요" not in a.page.inner_text('.modal.g-sheet [data-g="G16"]'):
            fails.append("G16 note")
        if a.errors:
            fails.append("console errors %r" % a.errors)
    assert not fails, "\n".join(fails)


# ---------------------------------------------------------------- v0.17.0 편집기 따로 받기

EDITOR_FILE_GLOB = re.compile(r"/js/editor-[0-9a-f]{8}\.js(\?.*)?$")
WAIT_TEXT = {"ko": "코드 입력창 준비 중…", "en": "Getting the code editor ready…"}


def _ed_text(a, sel=".cm-content"):
    return a.js("(s) => [...document.querySelectorAll(s + ' .cm-line')].map(e => e.textContent).join('\\n')", sel)


def _editor_wait_checks(a, slot, run, syms, lang_="ko"):
    """편집기를 기다리는 동안: 「준비 중」 덮개 + 시작 코드 글자(읽기 전용), 「실행」·기호 줄 꺼짐, 누르면 아무 일 없음"""
    fails = []
    a.page.wait_for_selector(slot + " .ed-wait", timeout=10_000)
    if a.page.query_selector(slot + " .cm-content"):
        fails.append("editor already there (chunk not delayed?)")
    wait = a.page.inner_text(slot + " .ed-wait")
    if WAIT_TEXT[lang_] not in wait:
        fails.append("wait text %r" % wait)
    start = a.js("(s) => { const p = document.querySelector(s + ' .ed-pre'); return p ? p.textContent : null; }", slot)
    if start is None:
        fails.append("no read-only start code")
    for b in run:
        if not a.page.is_disabled(b):
            fails.append("%s enabled before the editor" % b)
    dis = a.js("(s) => [...document.querySelectorAll(s)].filter((b) => b.offsetParent).map((b) => b.disabled)", syms)
    if not dis or not all(dis):
        fails.append("symbol keys not disabled: %r" % dis)
    a.js("(bs) => bs.forEach((b) => document.querySelector(b)?.click())", run)
    return fails, start


def _editor_slot_slow(lang_):
    held = []
    fails = []
    locale = "en-US" if lang_ == "en" else "ko-KR"
    with App("iPhone 17", locale=locale, routes=[(EDITOR_FILE_GLOB, lambda r: held.append(r))]) as a:
        a.start()
        a.page.click("#continue")
        _to_write(a, ready=".item.write")
        f, start = _editor_wait_checks(a, "#ed", ["#run", "#submit"], ".dock .sym", lang_)
        fails += f
        a.shot("editor-wait-%s.png" % lang_)
        if lang_ == "en":
            left = _hangul_left(a)
            if left:
                fails.append("hangul while waiting %r" % left)
        a.page.wait_for_timeout(3000)
        if a.page.query_selector("#ed .cm-content") or not a.page.query_selector("#ed .ed-wait"):
            fails.append("editor appeared before the file came")
        if not held:
            fails.append("editor file was never requested")
        for r in held:
            r.continue_()
        a.page.wait_for_selector("#ed .cm-content", timeout=10_000)
        if a.page.query_selector("#ed .ed-wait"):
            fails.append("wait cover left after the editor came")
        got = _ed_text(a, "#ed")
        if start is not None and got != start:
            fails.append("start code changed %r -> %r" % (start, got))
        if a.page.is_disabled("#run") or a.page.is_disabled("#submit"):
            fails.append("run/submit still disabled after the editor came")
        if a.js("() => [...document.querySelectorAll('.dock .sym')].some((b) => b.disabled)"):
            fails.append("symbol keys still disabled")
        label = a.js("() => document.querySelector('#ed .cm-content').getAttribute('aria-label')")
        want = "Code editor. Write your Python code here" if lang_ == "en" else "코드 입력창. 여기에 Python 코드를 써요"
        if label != want:
            fails.append("editor label %r" % label)
        if lang_ == "en":
            left = _hangul_left(a)
            if left:
                fails.append("hangul after the editor %r" % left)
        errs = _app_errors(a)
        if errs:
            fails.append("console errors %r" % errs)
    return fails


def test_editor_slot_slow():
    """v0.17.0 작업 2: 편집기 파일(js/editor-*.js)이 늦게 오면 레슨 코드 쓰기 자리에 시작 코드 글자 + 「코드 입력창 준비 중…」,
    「실행」「제출」·기호 줄은 꺼짐(눌러도 아무 일 없음) → 파일이 오면 편집기, 시작 코드 그대로, 단추 켜짐. 영어판은 한글 없음.
    텃밭 코드 모드·경비실 직접 쓰기도 같은 자리. 캡처: editor-wait-ko.png·editor-wait-en.png"""
    fails = _editor_slot_slow("ko") + ["en: " + f for f in _editor_slot_slow("en")]
    # 텃밭 코드 모드
    held = []
    code = 'move("오른쪽")\nharvest()\n'
    with App("iPhone 17", save=_garden_seed(1, _garden(order_idx=1, mode="code", code=code)), reduced=True,
             routes=[(EDITOR_FILE_GLOB, lambda r: held.append(r))]) as a:
        _open_garden(a)
        a.wait_py()
        f, start = _editor_wait_checks(a, "#g-prog", ["#g-run"], "#g-syms .sym")
        fails += ["garden: " + x for x in f]
        if start != code:
            fails.append("garden start code %r" % start)
        for r in held:
            r.continue_()
        a.page.wait_for_selector(".g-editor .cm-content", timeout=10_000)
        if _ed_text(a, ".g-editor") != code.rstrip("\n") + "\n" and _ed_text(a, ".g-editor") != code:
            fails.append("garden editor %r" % _ed_text(a, ".g-editor"))
        if a.page.is_disabled("#g-run"):
            fails.append("garden run disabled after the editor came")
        errs = _app_errors(a)
        if errs:
            fails.append("garden console errors %r" % errs)
    # 경비실 직접 쓰기
    held = []
    with App("iPhone 17", save=_guard_seed(3, guard=_guard_solved_g1()), routes=[(EDITOR_FILE_GLOB, lambda r: held.append(r))]) as a:
        _open_guard(a)
        a.wait_py()
        _gd_open_g1(a)
        a.page.click("#gd-mode")
        f, start = _editor_wait_checks(a, "#gd-code", ["#gd-run"], "#gd-syms .sym")
        fails += ["guard: " + x for x in f]
        for r in held:
            r.continue_()
        a.page.wait_for_selector("#gd-ed .cm-content", timeout=10_000)
        if start is not None and _ed_text(a, "#gd-ed") != start:
            fails.append("guard start code changed %r -> %r" % (start, _ed_text(a, "#gd-ed")))
        if a.page.is_disabled("#gd-run"):
            fails.append("guard run disabled after the editor came")
        errs = _app_errors(a)
        if errs:
            fails.append("guard console errors %r" % errs)
    assert not fails, "\n".join(fails)


def test_editor_slot_fail():
    """v0.17.0 작업 2: 편집기 파일을 못 받으면(연결 끊김) 「코드 입력창을 불러오지 못했어요…」+「다시 시도」 → 연결이 돌아온 뒤
    누르면 편집기. 404(새 판이 나와 옛 파일이 없음)면 「새 판이 나왔어요…」+「새로 고침」(누르면 앱을 다시 불러옴). 영어판 한글 없음.
    캡처: editor-fail.png·editor-stale.png"""
    fails = []
    block = {"on": True}

    def flaky(route):
        if block["on"]:
            route.abort()
        else:
            route.continue_()
    with App("iPhone 17", routes=[(EDITOR_FILE_GLOB, flaky)]) as a:
        a.start()
        a.page.click("#continue")
        _to_write(a, ready=".item.write")
        a.page.wait_for_selector("#ed .ed-retry", timeout=15_000)
        msg = a.page.inner_text("#ed .ed-wait")
        if "코드 입력창을 불러오지 못했어요. 인터넷에 연결한 뒤 다시 열어 주세요" not in msg or "다시 시도" not in msg:
            fails.append("fail text %r" % msg)
        if not a.page.query_selector("#ed [role=alert]"):
            fails.append("failure has no role=alert")
        if not a.page.is_disabled("#run"):
            fails.append("run enabled without an editor")
        a.shot("editor-fail.png")
        block["on"] = False
        a.page.click("#ed .ed-retry")
        a.page.wait_for_selector("#ed .cm-content", timeout=10_000)
        if a.page.is_disabled("#run"):
            fails.append("run disabled after retry")
        errs = _app_errors(a)
        if errs:
            fails.append("console errors %r" % errs)
    for lang_ in ("ko", "en"):
        with App("iPhone 17", locale="en-US" if lang_ == "en" else "ko-KR",
                 routes=[(EDITOR_FILE_GLOB, lambda route: route.fulfill(status=404, body="not found"))]) as a:
            a.start()
            a.page.click("#continue")
            _to_write(a, ready=".item.write")
            a.page.wait_for_selector("#ed .ed-refresh", timeout=15_000)
            msg = a.page.inner_text("#ed .ed-wait")
            want = ("새 판이 나왔어요. 새로 고침하면 열려요", "새로 고침") if lang_ == "ko" else ("A new version is out", "Refresh")
            if not all(w in msg for w in want):
                fails.append("%s stale text %r" % (lang_, msg))
            if a.page.query_selector("#ed .ed-retry"):
                fails.append("%s retry shown for a stale (404) file" % lang_)
            if lang_ == "en":
                left = _hangul_left(a)
                if left:
                    fails.append("en hangul %r" % left)
            else:
                a.shot("editor-stale.png")
                a.js("() => { window.__beforeReload = 1; }")
                with a.page.expect_navigation(timeout=15_000):
                    a.page.click("#ed .ed-refresh")
                if a.js("() => window.__beforeReload || 0"):
                    fails.append("refresh did not reload the app")
            errs = _app_errors(a)
            if errs:
                fails.append("%s console errors %r" % (lang_, errs))
    assert not fails, "\n".join(fails)


if __name__ == "__main__":
    sys.exit(main())
