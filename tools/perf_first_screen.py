"""첫 화면 시간 측정 도구 (v0.17.0 작업 1).

실행:
  python3 build.py --dev-pyodide --out tests/out/dist-perf
  python3 tools/perf_first_screen.py tests/out/dist-perf --runs 3 --json tests/out/perf-before.json
  python3 tools/perf_first_screen.py --self-test        # 도구 자체 시험(gzip 응답 확인)

하는 일
- 빌드 폴더를 gzip 켠 로컬 서버로 내준다(GitHub Pages처럼 Content-Encoding: gzip).
  /node_modules/pyodide/ 도 내준다(--dev-pyodide 빌드용). .wasm·.mjs 형식 지정.
- Playwright Chromium + 「iPhone 13」 기기 설정. CDP로 CPU 4배·6배 x 네트워크(로컬, 느린 3G)를 건다.
  느린 3G = 지연 150ms, 내려받기 1.6Mbps, 올리기 750kbps.
- 조건마다 --runs 회, 매 회 새 브라우저(캐시·저장소 없음). 중앙값을 표로 낸다.

무엇을 "첫 화면"으로 보나 (고정 약속)
- 새 브라우저에 휴대폰 언어 ko-KR 을 주면 앱은 언어 고르기 없이 곧바로 시작 화면(`.screen.splash`의 `#go`)을 그린다.
  그래서 첫 화면 = `#go` 또는 `.screen.home` 이 처음 보이는 순간(둘 중 먼저). 저장은 비어 있다(처음 방문자).
- 시각은 페이지 안 MutationObserver가 performance.now()로 잰다(탐색 시작 기준).
- DOMContentLoaded = 탐색 항목의 domContentLoadedEventEnd.
- 첫 파일 전송 바이트 = 문서 요청의 encodedDataLength(gzip 뒤 전송량, 헤더 포함).
"""

import argparse
import functools
import gzip
import http.server
import io
import json
import os
import socketserver
import statistics
import sys
import tempfile
import threading
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEVICE = "iPhone 13"
CPU_RATES = [4, 6]
NETWORKS = [
    ("로컬", None),
    ("느린 3G", {"latency": 150, "downloadThroughput": 1.6e6 / 8, "uploadThroughput": 750e3 / 8}),
]
FIRST_SCREEN_JS = """
(() => {
  window.__firstScreen = null;
  const hit = () => document.querySelector('.screen.home') || document.querySelector('#go');
  const check = () => {
    if (window.__firstScreen === null && hit()) { window.__firstScreen = performance.now(); return true; }
    return false;
  };
  const mo = new MutationObserver(() => { if (check()) mo.disconnect(); });
  mo.observe(document, {childList: true, subtree: true});
})();
"""

# 이미 압축된 .zip 등은 제외
GZIP_TYPES = {".html", ".js", ".mjs", ".json", ".css", ".wasm", ".svg", ".webmanifest", ".txt"}


class GzipHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
        ".json": "application/json", ".webmanifest": "application/manifest+json",
    }
    extra_roots = {}      # "/node_modules/" 같은 접두어 -> 실제 폴더
    gz_cache = {}         # 경로 -> gzip 바이트(한 번만 압축)

    def translate_path(self, path):
        p = path.split("?")[0]
        for prefix, base in self.extra_roots.items():
            if p.startswith(prefix):
                return os.path.join(base, *p.lstrip("/").split("/"))
        return super().translate_path(path)

    def log_message(self, *a):
        pass

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            idx = os.path.join(path, "index.html")
            if os.path.exists(idx):
                path = idx
        ext = os.path.splitext(path)[1].lower()
        if ext not in GZIP_TYPES or not os.path.isfile(path) or "gzip" not in self.headers.get("Accept-Encoding", ""):
            return super().send_head()
        body = self.gz_cache.get(path)
        if body is None:
            with open(path, "rb") as f:
                body = gzip.compress(f.read(), compresslevel=6)
            self.gz_cache[path] = body
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Vary", "Accept-Encoding")
        self.end_headers()
        return io.BytesIO(body)


class _Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        if not isinstance(sys.exc_info()[1], (ConnectionError, BrokenPipeError)):
            super().handle_error(request, client_address)


def serve(directory, with_node_modules=True):
    """directory 를 gzip 켠 서버로 내준다. (서버, 주소) 를 돌려준다."""
    handler = type("H", (GzipHandler,), {
        "extra_roots": {"/node_modules/": ROOT} if with_node_modules else {},
        "gz_cache": {},
    })
    httpd = _Server(("127.0.0.1", 0), functools.partial(handler, directory=directory))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d/" % httpd.server_address[1]


# ---------------------------------------------------------------- 측정

def measure_once(pw, url, cpu, net):
    """새 브라우저 한 번 -> {first, dcl, bytes}. 첫 화면이 안 뜨면 예외."""
    browser = pw.chromium.launch()
    try:
        opts = dict(pw.devices[DEVICE])
        opts.pop("default_browser_type", None)
        opts["locale"] = "ko-KR"
        ctx = browser.new_context(service_workers="block", **opts)
        page = ctx.new_page()
        page.add_init_script(FIRST_SCREEN_JS)
        cdp = ctx.new_cdp_session(page)
        cdp.send("Network.enable")
        cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
        cdp.send("Emulation.setCPUThrottlingRate", {"rate": cpu})
        if net:
            cdp.send("Network.emulateNetworkConditions", {"offline": False, **net})
        doc = {}

        def on_resp(p):
            if p.get("type") == "Document" and "id" not in doc:
                doc["id"] = p["requestId"]
        cdp.on("Network.responseReceived", on_resp)

        def on_fin(p):
            if p["requestId"] == doc.get("id"):
                doc["bytes"] = int(p["encodedDataLength"])
        cdp.on("Network.loadingFinished", on_fin)
        page.goto(url, wait_until="commit")
        page.wait_for_function("() => window.__firstScreen !== null", timeout=120_000)
        first = page.evaluate("() => window.__firstScreen")
        page.wait_for_function(
            "() => { const n = performance.getEntriesByType('navigation')[0]; return n && n.domContentLoadedEventEnd > 0; }",
            timeout=120_000)
        dcl = page.evaluate("() => performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd")
        page.wait_for_timeout(50)
        return {"first": first / 1000.0, "dcl": dcl / 1000.0, "bytes": doc.get("bytes")}
    finally:
        browser.close()


def run_all(directory, runs):
    from playwright.sync_api import sync_playwright
    httpd, url = serve(directory)
    rows = []
    try:
        with sync_playwright() as pw:
            for cpu in CPU_RATES:
                for net_name, net in NETWORKS:
                    samples = [measure_once(pw, url, cpu, net) for _ in range(runs)]
                    r = {
                        "cpu": cpu, "network": net_name, "runs": runs,
                        "first_s": round(statistics.median(s["first"] for s in samples), 3),
                        "dcl_s": round(statistics.median(s["dcl"] for s in samples), 3),
                        "doc_bytes": int(statistics.median(s["bytes"] or 0 for s in samples)),
                        "samples": samples,
                    }
                    rows.append(r)
                    print("  CPU %dx %s: 첫 화면 %.2fs" % (cpu, net_name, r["first_s"]), file=sys.stderr, flush=True)
    finally:
        httpd.shutdown()
    return rows


def format_table(rows):
    lines = ["| 조건 | 첫 화면까지 | DOMContentLoaded | 첫 파일 전송(gzip) |", "|---|---|---|---|"]
    for r in rows:
        lines.append("| CPU %d배 + %s | %.2fs | %.2fs | %s B |" % (
            r["cpu"], r["network"], r["first_s"], r["dcl_s"], format(r["doc_bytes"], ",")))
    return "\n".join(lines)


# ---------------------------------------------------------------- 자체 시험

def self_test():
    """작은 임시 폴더(index.html 한 장)를 띄워 gzip 응답 헤더와 크기 줄어듦을 확인한다."""
    html = "<!doctype html><title>t</title>" + ("<p>gzip test line</p>\n" * 400)
    with tempfile.TemporaryDirectory() as d:
        with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
            f.write(html)
        with open(os.path.join(d, "x.wasm"), "wb") as f:
            f.write(b"\0asm" + b"\0" * 4000)
        httpd, url = serve(d, with_node_modules=False)
        try:
            def get(path, enc):
                req = urllib.request.Request(url + path, headers={"Accept-Encoding": enc})
                with urllib.request.urlopen(req) as r:
                    return dict(r.headers), r.read()
            h, body = get("", "gzip")
            assert h.get("Content-Encoding") == "gzip", "Content-Encoding 없음: %r" % h
            assert len(body) < len(html.encode()) / 4, "gzip 뒤 크기가 줄지 않음: %d" % len(body)
            assert gzip.decompress(body).decode() == html, "gzip 풀면 원문과 같아야 함"
            assert int(h["Content-Length"]) == len(body), "Content-Length 가 실제 전송량과 다름"
            h2, body2 = get("", "identity")
            assert "Content-Encoding" not in h2 and body2.decode() == html, "gzip 안 받는 쪽엔 원문"
            h3, _ = get("x.wasm", "gzip")
            assert h3.get("Content-Type") == "application/wasm", "wasm 형식: %r" % h3.get("Content-Type")
            assert h3.get("Content-Encoding") == "gzip"
        finally:
            httpd.shutdown()
    t = format_table([{"cpu": 4, "network": "로컬", "first_s": 1.0, "dcl_s": 0.5, "doc_bytes": 1234}])
    assert "CPU 4배 + 로컬" in t and "1,234 B" in t
    print("self-test OK")


def main():
    ap = argparse.ArgumentParser(description="첫 화면 시간 측정(gzip 서버 + CPU/네트워크 제한)")
    ap.add_argument("dir", nargs="?", help="빌드 폴더(예: tests/out/dist-perf)")
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--json", help="결과를 저장할 json 경로")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        self_test()
        return
    if not a.dir:
        ap.error("빌드 폴더가 필요합니다")
    d = os.path.abspath(a.dir)
    assert os.path.isfile(os.path.join(d, "index.html")), "index.html 이 없음: " + d
    rows = run_all(d, a.runs)
    print(format_table(rows))
    if a.json:
        os.makedirs(os.path.dirname(os.path.abspath(a.json)), exist_ok=True)
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump({"device": DEVICE, "runs": a.runs, "rows": rows}, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
