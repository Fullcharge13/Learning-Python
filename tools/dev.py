#!/usr/bin/env python3
"""개발용: src/app.js를 설치된 esbuild로 묶어 dev/에 두고, 저장소 뿌리를 로컬 서버로 연다.

    python3 tools/dev.py               # 묶고 http://127.0.0.1:8765/dev/ 열기
    python3 tools/dev.py --port 9000
    python3 tools/dev.py --build-only  # 묶기만 (시험 도구가 씀)

dev/ 구성: index.html(설정 주입) · style.css · app.js(묶음) · worker.js · py/runner.py
Pyodide는 /node_modules/pyodide/ 에서 받는다(저장소 뿌리를 열기 때문). 배포판(작업 10 build.py)은 jsDelivr 주소를 쓴다.
"""
import argparse
import functools
import http.server
import os
import shutil
import socketserver
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
DEV = os.path.join(ROOT, "dev")
ESBUILD = os.path.join(ROOT, "node_modules", ".bin", "esbuild")
CONFIG = '<script>window.RIA_PYODIDE_URL = "/node_modules/pyodide/";</script>'


def build():
    os.makedirs(os.path.join(DEV, "py"), exist_ok=True)
    subprocess.run(
        [ESBUILD, os.path.join(SRC, "app.js"), "--bundle", "--format=esm", "--target=es2022,safari16",
         "--outfile=" + os.path.join(DEV, "app.js"), "--log-level=warning"],
        check=True, cwd=ROOT)
    with open(os.path.join(SRC, "index.html"), encoding="utf-8") as f:
        html = f.read()
    html = html.replace("<!-- RIA:CONFIG -->", CONFIG)
    with open(os.path.join(DEV, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    shutil.copy(os.path.join(SRC, "style.css"), os.path.join(DEV, "style.css"))
    shutil.copy(os.path.join(SRC, "worker.js"), os.path.join(DEV, "worker.js"))
    shutil.copy(os.path.join(SRC, "py", "runner.py"), os.path.join(DEV, "py", "runner.py"))
    size = os.path.getsize(os.path.join(DEV, "app.js"))
    print("묶음 dev/app.js %.1f KB" % (size / 1024))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
        ".json": "application/json", ".py": "text/plain", ".css": "text/css",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def make_server(port=0):
    return Server(("127.0.0.1", port), functools.partial(Handler, directory=ROOT))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--build-only", action="store_true")
    a = ap.parse_args()
    build()
    if a.build_only:
        return
    httpd = make_server(a.port)
    print("http://127.0.0.1:%d/dev/" % httpd.server_address[1])
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    sys.exit(main())
