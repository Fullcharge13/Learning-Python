"""화면 대비 측정 도구 (v0.19.0 「밤의 연구 노트」 작업 2, 설계서 2026-11-14 §4).

실행
    python3 tests/contrast.py --self-test                       도구 자기 시험(앱 빌드 없음, 몇 초)
    python3 tests/contrast.py --theme dark [--strict]            앱을 빌드해 화면 목록을 돌며 대비를 잰다
    python3 tests/contrast.py --theme light --report out.json    미달 목록을 JSON으로
    python3 tests/contrast.py --theme dark --skip-editor-tokens  CodeMirror 문법 색 글자는 뺌(작업 4부터 어둡게 엄격 시험은 이 옵션 없이 통과)
    python3 tests/contrast.py --theme dark --strict --skip-art-text   어둡게 엄격(flow test_theme_dark_contrast)
    python3 tests/contrast.py --theme light --compare tests/fixtures/contrast-light-baseline.json   밝게 그대로(flow test_theme_light_unchanged)

하는 일
- `build.py --dev-pyodide`로 만든 앱(tests/flow.py의 빌드·서버·Chromium 하나를 같이 씀)을 `localStorage["ria-python.theme"]`를
  주어 연다. 설계서 §4 화면 목록(인사, 튜토리얼 4장+실행 결과, 홈, 레슨 카드·고르기·빈칸·순서·코드 쓰기·오류 카드·맞음/틀림 설명·완료,
  배지, 의상실, 설정+확인 창, 텃밭(1장 통과 저장)+말풍선·노드 고르기 창·주문 완료 창, 경비실 빈칸·고르기 창·판정 칸·직접 쓰기)을 연다.
- 화면마다 「보이는 글자가 있는 요소」의 글자색과 실제 바탕색의 대비를 재어, 기준 미달을 목록으로 낸다.
  기준: 글자 4.5:1, 큰 글씨(24px 이상, 또는 굵기 700 이상이고 19px 이상) 3:1.
- 같은 화면 목록의 스크린숏을 tests/out/contrast/<theme>/<화면>.png 로 저장한다(밝게 회귀 비교의 기준 사진).
- `--compare 기준.json`: 보고서의 `digests`(화면별 선택자|글자색|바탕색 전부)를 견줘 다르면 1. 스크린숏은 animations=disabled·caret=hide.
- 종료 코드: `--strict`이고 미달(또는 화면을 못 연 오류)이 있으면 1. 아니면 0. (밝게는 보고만, 어둡게는 실패시킴 — 부르는 쪽이 정함)

바탕색 계산
- 글자 요소에서 조상으로 올라가며 `background-color`를 알파 합성(투명이면 계속 올라감, 불투명을 만나면 멈춤). 맨 아래는 브라우저 캔버스
  색(`Canvas` 시스템 색: color-scheme이 dark면 어두운 색). 조상의 `opacity`는 그 층의 알파와 글자 알파에 곱한다.
- `background-image`(그라데이션·모눈)는 계산하지 않는다. 특히 `body`의 모눈 무늬(rgba 0.045 선)는 「페이지 색 = body `background-color`」로 본다.
  body·html 말고 배경 그림이 있는 요소는 결과에 `bgimg: true`를 달아 어림값임을 표시한다.
- 입력칸은 값(없으면 `::placeholder`, 그것도 없으면 빈 칸의 글자색을 글자 'x'로) 글자색, SVG `<text>`는 `fill`을 글자색으로, 그 뒤쪽에 먼저 그려진 같은 SVG의 도형 중 글자 중심을 덮는 것들의
  `fill`을 합성한 것을 바탕으로 본다(텃밭 말풍선).

빼는 것(JSON `excluded`에 개수로 보고)
- `hidden`·`display:none`·`visibility:hidden`·`opacity:0`(화면에 안 보임), 크기가 2px 미만(.sr 등),
  화면 가로 밖·문서 위 밖, 조상이 가로로 자른 영역 밖(`clippedHoriz`). 세로 스크롤 안 접힌 아래쪽 글자는 잰다
- 글자 낱자(`\\p{L}`·`\\p{N}`)가 하나도 없는 글(이모지·기호만 = 장식). `aria-hidden` 안이라도 낱자가 보이면 잰다(`info.ariaHiddenChecked`)
- 비활성(`:disabled`, `aria-disabled="true"` 안) — WCAG 대비 기준 예외
- `--skip-editor-tokens`일 때만: `.cm-content` 안 `.cm-line`의 자손 토큰 칸(문법 색)
- `--skip-art-text`일 때만: ART_TEXT 목록(그림 속 글자, 판정 D-C6 — 배지 그림 안 「1장」 등). 어둡게 엄격 시험이 씀(`excluded.artText`)
- SVG 그림 안의 캐릭터·작물은 글자가 없어 저절로 빠짐. 이모지 글자는 위 규칙으로 빠짐.
"""

import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "tests", "out", "contrast")
THEME_KEY = "ria-python.theme"
NEED_TEXT, NEED_LARGE = 4.5, 3.0
# 그림으로 보는 글자(판정 D-C6): 배지 그림(src/ui/badges.js) 안 <text>. 그림 색은 손대지 않으므로 어둡게 엄격 시험에서 뺀다
ART_TEXT = [".badge-art > text", ".badge-art text"]

CHECK_JS = r"""(opts) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const pc = new Map();
  const parse = (s) => {
    if (pc.has(s)) return pc.get(s);
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data, v = [d[0], d[1], d[2], d[3] / 255];
    pc.set(s, v); return v;
  };
  const over = (t, b) => [0, 1, 2].map(i => t[i] * t[3] + b[i] * (1 - t[3]));
  const lum = (c) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const probe = document.createElement('i'); probe.style.backgroundColor = 'Canvas';
  document.documentElement.appendChild(probe);
  const canvas = parse(getComputedStyle(probe).backgroundColor).slice(0, 3); probe.remove();

  const ocache = new Map();
  const cum = (e) => {
    if (!e || e.nodeType !== 1) return 1;
    if (ocache.has(e)) return ocache.get(e);
    const v = (parseFloat(getComputedStyle(e).opacity) || 0) * cum(e.parentElement);
    ocache.set(e, v); return v;
  };
  const backdrop = (el) => {
    const layers = []; let bgimg = false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e), bg = parse(cs.backgroundColor), a = bg[3] * cum(e);
      if (a > 0) layers.push([bg[0], bg[1], bg[2], a]);
      if (cs.backgroundImage !== 'none' && e !== document.body && e !== document.documentElement) bgimg = true;
      if (a >= 0.999) break;
    }
    let base = canvas.slice();
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return { rgb: base, bgimg };
  };
  const svgBackdrop = (el, svg) => {
    const r = el.getBoundingClientRect(), cxp = (r.left + r.right) / 2, cyp = (r.top + r.bottom) / 2;
    const res = backdrop(svg); let base = res.rgb;
    for (const s of svg.querySelectorAll('rect,path,circle,ellipse,polygon')) {
      if (!(s.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const cs = getComputedStyle(s);
      if (!cs.fill || cs.fill === 'none' || cs.fill.startsWith('url')) continue;
      const f = parse(cs.fill), a = f[3] * (parseFloat(cs.fillOpacity) || 0) * cum(s);
      if (a <= 0) continue;
      const b = s.getBoundingClientRect();
      if (cxp < b.left || cxp > b.right || cyp < b.top || cyp > b.bottom) continue;
      base = over([f[0], f[1], f[2], a], base);
    }
    return { rgb: base, bgimg: res.bgimg };
  };
  const sel = (e) => {
    let s = e.tagName.toLowerCase();
    if (e.id) return s + '#' + e.id;
    const c = [...e.classList].slice(0, 3); if (c.length) s += '.' + c.join('.');
    const p = e.parentElement;
    if (p && p !== document.body) s = (p.id ? '#' + p.id : p.classList.length ? '.' + p.classList[0] : p.tagName.toLowerCase()) + ' > ' + s;
    return s;
  };
  const vw = window.innerWidth, vh = window.innerHeight;
  const ex = { noLetterSkipped: 0, invisible: 0, tiny: 0, offscreen: 0, clippedHoriz: 0, disabledSkipped: 0, editorToken: 0, artText: 0, svgSkipped: 0 };
  const info = { ariaHiddenChecked: 0, bgimgChecked: 0 }; const digest = [];
  const fails = {}; let checked = 0, minRatio = 99;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE']);
  const word = /[\p{L}\p{N}]/u;
  for (const el of document.querySelectorAll('body, body *')) {
    if (SKIP.has(el.tagName)) continue;
    const tag = el.tagName; let text = '', input = false;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      const t = el.type;
      if (t === 'hidden' || t === 'checkbox' || t === 'radio' || t === 'file' || t === 'range' || t === 'color') continue;
      text = el.value || ''; input = true;
      if (!text && el.placeholder) text = el.placeholder;
      if (!text) text = 'x';      // 빈 입력칸도 입력할 때 쓰이는 글자색을 잰다(흰 바탕·상속된 밝은 글자 문제)
    } else if (tag === 'SELECT') {
      text = (el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '') || 'x';
    } else {
      for (const n of el.childNodes) if (n.nodeType === 3) text += n.nodeValue;
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (!word.test(text)) { ex.noLetterSkipped++; continue; }
    const ariaHid = !!el.closest('[aria-hidden="true"]');   // 글자가 보이면(낱자 있음) 장식이 아니라 측정 대상
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden]') || cum(el) < 0.01 || !el.getClientRects().length) { ex.invisible++; continue; }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { ex.tiny++; continue; }
    let fixed = false;
    for (let p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') { fixed = true; break; }
    const top = fixed ? r.top : r.top + window.scrollY, bot = fixed ? r.bottom : r.bottom + window.scrollY;
    if (r.right <= 0 || r.left >= vw || bot <= 0 || (fixed && top >= vh)) { ex.offscreen++; continue; }
    let clipped = false;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX !== 'visible') {      // 가로로 잘린 것만 뺀다. 세로 스크롤 안(접힌 아래쪽)은 사용자가 내려서 보므로 잰다
        const b = p.getBoundingClientRect();
        if (r.right <= b.left || r.left >= b.right) { clipped = true; break; }
      }
    }
    if (clipped) { ex.clippedHoriz++; continue; }
    if (el.matches(':disabled') || el.closest('[aria-disabled="true"]')) { ex.disabledSkipped++; continue; }
    if (opts.skipEditorTokens) {
      const cm = el.closest('.cm-content');
      if (cm && !el.classList.contains('cm-line') && el !== cm) { ex.editorToken++; continue; }
    }
    if (opts.artText.length && opts.artText.some(q => el.matches(q))) { ex.artText++; continue; }
    const svg = el instanceof SVGElement ? el.closest('svg') : null;
    let fgc, bd;
    if (svg) {
      const fs = cs.fill; if (!fs || fs === 'none' || fs.startsWith('url')) { ex.svgSkipped++; continue; }
      const f = parse(fs); fgc = [f[0], f[1], f[2], f[3] * (parseFloat(cs.fillOpacity) || 0) * cum(el)];
      bd = svgBackdrop(el, svg);
    } else {
      let col = cs.color;
      if (input && !el.value && el.placeholder) col = getComputedStyle(el, '::placeholder').color;   // 빈 칸·placeholder 없음 = 입력할 글자색(자기 color)
      const f = parse(col); fgc = [f[0], f[1], f[2], f[3] * cum(el)];
      bd = backdrop(el);
    }
    const fg = over(fgc, bd.rgb);
    const size = parseFloat(cs.fontSize) || 16, weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (weight >= 700 && size >= 19);
    const need = large ? 3 : 4.5, rt = ratio(fg, bd.rgb);
    checked++; if (rt < minRatio) minRatio = rt;
    if (ariaHid) info.ariaHiddenChecked++;
    if (bd.bgimg) info.bgimgChecked++;
    digest.push(sel(el) + '|' + hex(fg) + '|' + hex(bd.rgb));
    if (rt + 1e-9 >= need) continue;
    const key = sel(el) + '|' + hex(fg) + '|' + hex(bd.rgb);
    if (fails[key]) { fails[key].count++; continue; }
    fails[key] = { selector: sel(el), text: text.slice(0, 20), fg: hex(fg), bg: hex(bd.rgb), ratio: Math.round(rt * 100) / 100, need,
                   count: 1, ...(bd.bgimg ? { bgimg: true } : {}) };
  }
  return { fails: Object.values(fails), checked, minRatio: Math.round(minRatio * 100) / 100, excluded: ex, info, digest: digest.sort() };
}"""


def run_check(page, skip_editor_tokens=False, skip_art=False):
    return page.evaluate(CHECK_JS, {"skipEditorTokens": bool(skip_editor_tokens), "artText": ART_TEXT if skip_art else []})


# ---------------------------------------------------------------- 자기 시험

SELF_HTML = """<!doctype html><html><body style="margin:0;background:#fff;background-image:linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px);background-size:24px 24px">
<input id="a" value="흰 바탕 흰 글자" style="color:#fff;background:#fff">
<div style="background:#1B2538"><p id="b" style="color:#F1EBDD;margin:0">남색 바탕 크림 글자</p></div>
<div style="background:#1B2538"><p id="c" style="color:#222;margin:0;background:transparent">투명 바탕 위 어두운 글자</p></div>
<p id="d" style="color:#888;font-size:16px;margin:0">작은 회색 글자</p>
<p id="e" style="color:#888;font-size:26px;margin:0">큰 회색 글자</p>
<p id="f" aria-hidden="true" style="color:#fff;margin:0">보이는 글자는 aria-hidden이어도 잼</p>
<span id="f2" aria-hidden="true" style="color:#fff">★</span>
<input id="h" style="color:#fff;background:#fff">
<style>#i::placeholder{color:#fff}</style><input id="i" style="color:#22304A;background:#fff">
<p id="g" hidden style="color:#fff">숨김 빼기</p>
<svg class="badge-art" width="60" height="30"><rect width="60" height="30" fill="#E4DCCB"/><text x="4" y="20" fill="#9A8F78">1장</text></svg>
</body></html>"""

# 기대: 미달은 a(입력, 흰/흰), h(빈 입력칸 흰/흰), c(남색 위 #222), d(작은 회색 3.54:1), f(aria-hidden이지만 글자가 보임). 낱자 없는 ★ 장식·hidden은 뺌
# i: 빈 입력칸(placeholder 없음)은 ::placeholder 색(흰)이 아니라 입력칸 자기 글자색(남색)으로 잰다 → 통과
#    (Chromium의 getComputedStyle(el,'::placeholder')는 자기 color를 돌려줘 고치기 전에도 통과한다 — 다른 엔진 대비 규칙 고정용)
SELF_EXPECT_FAIL = {"input#a", "p#c", "p#d", "p#f", "input#h", ".badge-art > text"}   # 배지 글자는 --skip-art-text일 때만 빠짐


def self_test():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        try:
            page = b.new_page()
            page.set_content(SELF_HTML)
            res = run_check(page)
            art = run_check(page, skip_art=True)
        finally:
            b.close()
    got = {f["selector"] for f in res["fails"]}
    problems = []
    if got != SELF_EXPECT_FAIL:
        problems.append("fails %r != expected %r" % (sorted(got), sorted(SELF_EXPECT_FAIL)))
    if res["excluded"]["noLetterSkipped"] != 1 or res["excluded"]["invisible"] != 1 or res["info"]["ariaHiddenChecked"] != 1:
        problems.append("excluded counts wrong: %r" % res["excluded"])
    got_art = {f["selector"] for f in art["fails"]}
    if got_art != SELF_EXPECT_FAIL - {".badge-art > text"} or art["excluded"]["artText"] != 1:
        problems.append("skip_art: fails %r, artText %r" % (sorted(got_art), art["excluded"]["artText"]))
    first = next((f for f in res["fails"] if f["selector"] == "input#a"), None)
    if not first or first["ratio"] != 1.0 or first["need"] != 4.5:
        problems.append("input#a entry wrong: %r" % first)
    if problems:
        raise AssertionError("; ".join(problems) + "\n" + json.dumps(res, ensure_ascii=False, indent=1))
    return res


def test_contrast_self_test():
    """흰 바탕 흰 글자만 미달, 남색 바탕 크림 글자는 통과(조상 합성·큰 글씨·장식·숨김 빼기 포함)"""
    self_test()


# ---------------------------------------------------------------- 화면 순회

class Runner:
    def __init__(self, theme, skip_tokens, skip_art=False):
        self.theme = theme
        self.skip_tokens = skip_tokens
        self.skip_art = skip_art
        self.dir = os.path.join(OUT, theme)
        os.makedirs(self.dir, exist_ok=True)
        self.screens = []     # [{screen, checked, minRatio, fails, excluded, theme_ok}]
        self.errors = []      # 화면을 못 연 오류
        self.seen = set()

    def cap(self, a, name):
        if name in self.seen:
            return
        self.seen.add(name)
        import flow
        a.page.wait_for_timeout(150)
        flow._settle_animations(a)
        applied = a.js("() => document.documentElement.dataset.theme")
        res = run_check(a.page, self.skip_tokens, self.skip_art)
        a.page.screenshot(path=os.path.join(self.dir, name + ".png"), animations="disabled", caret="hide")
        for f in res["fails"]:
            f["screen"] = name
        res.update(screen=name, theme_applied=applied)
        self.screens.append(res)
        print("  %-22s checked %3d  fails %2d  min %5.2f  theme=%s" % (name, res["checked"], len(res["fails"]), res["minRatio"], applied), flush=True)

    def scenario(self, label, fn):
        t0 = time.time()
        print("[%s]" % label, flush=True)
        try:
            fn()
        except Exception as e:  # 한 시나리오가 깨져도 나머지는 계속
            self.errors.append({"scenario": label, "error": "%s: %s" % (type(e).__name__, str(e)[:300])})
            print("  ERROR %s: %s" % (type(e).__name__, str(e)[:200]), flush=True)
        print("  (%.1fs)" % (time.time() - t0), flush=True)


# 화면 내용이 요일·날짜에 따라 달라지면(완료 화면의 「새 배지」 줄, 바이트 나눔 문장 등) 밝게 색 비교가
# 날마다 다르게 나온다. 페이지 시계를 늘 같은 날(수요일 2026-11-11 12:00 KST)에서 시작하게 하고,
# 흐르는 시간은 그대로 둔다(애니메이션·타이머 정상). 인자를 준 new Date(...)는 그대로.
FROZEN_DATE_JS = ("(function(){var D=Date,b=D.now(),F=D.parse('2026-11-11T12:00:00+09:00');"
                  "function now(){return F+(D.now()-b);}"
                  "function FD(){var a=Array.prototype.slice.call(arguments);"
                  "if(!(this instanceof FD))return new D(now()).toString();"
                  "return a.length?new(Function.prototype.bind.apply(D,[null].concat(a)))():new D(now());}"
                  "FD.prototype=D.prototype;FD.now=now;FD.parse=D.parse;FD.UTC=D.UTC;window.Date=FD;})();")


def _app(theme, **kw):
    import flow
    init = FROZEN_DATE_JS + "try{localStorage.setItem(%s,%s)}catch(e){}" % (json.dumps(THEME_KEY), json.dumps(theme))
    return flow.App("iPhone 17", init_js=init, **kw)


def sc_fresh(r):
    import flow
    with _app(r.theme) as a:
        r.cap(a, "splash")
        flow._tut_open(a)
        r.cap(a, "tutorial-1")
        for i in range(2, 5):
            a.page.click("#tut-next")
            a.page.wait_for_timeout(250)
            if i == 4:   # 4장의 「▶ 실행」은 엔진이 준비돼야 보임 → 늘 같은 상태로 찍게 준비를 기다림
                a.wait_py()
                a.page.wait_for_selector("#tut-run:not([disabled])", timeout=60_000)
            r.cap(a, "tutorial-%d" % i)
        flow._tut_run(a)
        a.page.wait_for_selector("#tut-ok", timeout=60_000)
        r.cap(a, "tutorial-result")
        a.page.click("#tut-home")
        a.page.wait_for_selector("#app[data-screen=home] .screen.home")
        a.page.wait_for_timeout(200)
        a.dismiss()
        r.cap(a, "home")
        a.page.click("#continue")
        a.page.wait_for_selector(".screen.lesson")
        orig = a.answer_touch

        def answer_touch(it, correct=True):
            r.cap(a, "item-" + it["type"])
            return orig(it, correct)
        a.answer_touch = answer_touch

        def hook(name, app):
            if name == "write":
                app.wait_py()
                app.page.wait_for_selector(".cm-editor")
                r.cap(app, "write")
                app.set_code("print(")
                app.page.click("#run")
                app.page.wait_for_selector(".err-panel", timeout=30_000)
                r.cap(app, "error-card")
            else:
                r.cap(app, {"lesson-card": "lesson-card", "touch-item": "item-choice", "result": "result-right",
                            "result-wrong": "result-wrong"}[name])
        a.play("1-1", wrong=(0,), hook=hook)
        r.cap(a, "done")


def sc_garden_home(r):
    import flow
    seed = flow._garden_seed(1, xp=40)     # 처음 밭·주문 1(시작 프로그램 이동+수확)
    with _app(r.theme, save=seed) as a:
        a.start()
        a.page.wait_for_timeout(300)
        r.cap(a, "home-garden-save")
        for name in ("badges", "closet", "settings"):
            a.page.click('[data-go="%s"]' % name)
            a.page.wait_for_selector(".screen.%s" % name)
            r.cap(a, name)
            if name == "settings":
                a.page.click("#dev")
                a.page.wait_for_selector(".modal [data-i]")
                r.cap(a, "settings-confirm-modal")
                a.page.click(".modal [data-i='0']")
                a.page.wait_for_selector(".modal", state="detached")
            a.page.click('.tabbar [data-go="home"]') if a.page.query_selector('.tabbar [data-go="home"]') else a.page.go_back()
            a.page.wait_for_timeout(200)
        a.page.click('.tabbar [data-go="garden"]')
        a.page.wait_for_selector(".screen.garden")
        a.page.wait_for_timeout(300)
        r.cap(a, "garden")
        a.page.click('.g-add[data-parent=""]')
        a.page.wait_for_selector(".modal.g-sheet")
        r.cap(a, "garden-sheet")
        flow._sheet_pick(a, "[data-kind=say]")      # 말하기 노드를 더해 재생 중 말풍선을 본다
        a.wait_py()
        a.page.click("#g-run")
        a.page.wait_for_selector(".screen.garden[data-state=replay]", timeout=30_000)
        a.page.wait_for_selector(".g-bubble", timeout=10_000)
        r.cap(a, "garden-bubble")
        a.page.click("#g-skip")
        a.page.wait_for_selector(".modal .g-done-body", timeout=15_000)
        a.page.wait_for_timeout(flow.GUARD_WAIT)
        r.cap(a, "garden-done-modal")


def sc_guard(r):
    import flow
    with _app(r.theme, save=flow._guard_seed(3)) as a:
        flow._open_guard(a)
        r.cap(a, "guard-blank")
        a.page.click('.gd-blank[data-n="0"]')
        a.page.wait_for_selector(".modal.g-sheet")
        r.cap(a, "guard-sheet")
        a.page.click('.modal.g-sheet [data-v="1"]')
        a.page.wait_for_selector(".modal.g-sheet", state="detached")
        flow._gd_pick(a, 1, 0)
        flow._gd_pick(a, 2, 0)
        flow._gd_run(a, skip=True)
        a.page.wait_for_timeout(300)
        r.cap(a, "guard-result")
        a.page.click(".gd-try >> nth=0")
        a.page.wait_for_timeout(200)
        r.cap(a, "guard-why")
    with _app(r.theme, save=flow._guard_seed(3, guard=flow._guard_solved_g1())) as a:   # 해결한 사건만 「직접 쓰기」가 열림
        flow._open_guard(a)
        flow._gd_open_g1(a)
        a.page.click("#gd-mode")
        a.page.wait_for_selector("#gd-ed .cm-content", timeout=30_000)
        a.page.wait_for_timeout(300)
        r.cap(a, "guard-write")


def run_app(theme, skip_tokens, skip_art=False):
    import flow
    flow.env()
    r = Runner(theme, skip_tokens, skip_art)
    r.scenario("새 저장: 인사·튜토리얼·홈·레슨", lambda: sc_fresh(r))
    r.scenario("1장 통과 저장: 홈·배지·의상실·설정·텃밭", lambda: sc_garden_home(r))
    r.scenario("3장 통과 저장: 경비실", lambda: sc_guard(r))
    return r


def summarize(r, theme, skip_tokens, secs, skip_art=False):
    fails = [f for s in r.screens for f in s["fails"]]
    info = {}
    for s in r.screens:
        for k, v in s["info"].items():
            info[k] = info.get(k, 0) + v
    ex = {}
    for s in r.screens:
        for k, v in s["excluded"].items():
            ex[k] = ex.get(k, 0) + v
    return {"theme": theme, "skip_editor_tokens": skip_tokens, "skip_art_text": ART_TEXT if skip_art else [], "seconds": round(secs, 1),
            "screens": [{k: s[k] for k in ("screen", "checked", "minRatio", "theme_applied")} | {"fails": len(s["fails"])} for s in r.screens],
            "checked": sum(s["checked"] for s in r.screens), "fail_count": len(fails),
            "fail_elements": sum(f["count"] for f in fails), "excluded": ex, "info": info, "errors": r.errors, "failures": fails,
            "digests": {s["screen"]: s["digest"] for s in r.screens}}


def compare(base_path, rep):
    """기준 JSON의 화면별 (선택자|글자색|바탕색) 목록과 지금 것을 견줌. 다른 줄을 돌려준다(없으면 []).
    같은 줄이 몇 번 나오는지는 보지 않는다 — 요일·날짜에 따라 같은 색의 줄이 하나 더 붙는 화면(완료 화면의
    「새 배지」 등)이 있어서. 색이 바뀌거나 새 색 조합이 생기면 차이로 잡는다."""
    with open(base_path, encoding="utf-8") as f:
        base = json.load(f)["digests"]
    diffs = []
    for name, old in base.items():
        new = rep["digests"].get(name)
        if new is None:
            diffs.append("%s: screen missing" % name)
            continue
        co, cn = set(old), set(new)
        for k in sorted((co - cn)):
            diffs.append("%s: - %s" % (name, k))
        for k in sorted((cn - co)):
            diffs.append("%s: + %s" % (name, k))
    return diffs


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--theme", choices=["light", "dark"], default="dark")
    ap.add_argument("--report", help="결과 JSON 경로")
    ap.add_argument("--strict", action="store_true", help="미달이 있으면 종료 코드 1")
    ap.add_argument("--skip-editor-tokens", action="store_true", help=".cm-content 안 문법 색 칸을 뺌")
    ap.add_argument("--skip-art-text", action="store_true", help="그림 속 글자(ART_TEXT, 판정 D-C6)를 뺌")
    ap.add_argument("--compare", metavar="BASELINE.json", help="기준 JSON과 화면별 글자색·바탕색이 하나라도 다르면 종료 코드 1(「밝게 그대로」 확인)")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args(argv)
    sys.path.insert(0, HERE)
    if args.self_test:
        res = self_test()
        print("self-test OK: fails=%s checked=%d" % (sorted(f["selector"] for f in res["fails"]), res["checked"]))
        return 0
    t0 = time.time()
    r = run_app(args.theme, args.skip_editor_tokens, args.skip_art_text)
    rep = summarize(r, args.theme, args.skip_editor_tokens, time.time() - t0, args.skip_art_text)
    if args.report:
        os.makedirs(os.path.dirname(os.path.abspath(args.report)), exist_ok=True)
        with open(args.report, "w", encoding="utf-8") as f:
            json.dump(rep, f, ensure_ascii=False, indent=1)
    print("\n%s: %d screens, %d elements checked, %d failing groups (%d elements), %d scenario errors, %.0fs"
          % (args.theme, len(rep["screens"]), rep["checked"], rep["fail_count"], rep["fail_elements"], len(rep["errors"]), rep["seconds"]))
    for f in sorted(rep["failures"], key=lambda f: f["ratio"])[:15]:
        print("  %-18s %-40s %s on %s  %.2f<%.1f  %r" % (f["screen"], f["selector"][:40], f["fg"], f["bg"], f["ratio"], f["need"], f["text"]))
    if args.compare:
        diffs = compare(args.compare, rep)
        print("compare vs %s: %d differences" % (args.compare, len(diffs)))
        for d in diffs[:30]:
            print("  " + d)
        if diffs:
            return 1
    return 1 if args.strict and (rep["fail_count"] or rep["errors"]) else 0


if __name__ == "__main__":
    sys.exit(main())
