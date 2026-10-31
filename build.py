#!/usr/bin/env python3
"""배포 빌드: src/를 HTML 한 장(dist/index.html)으로 합친다 (계획 작업 10).

    python3 build.py                                   # 배포용 → dist/
    python3 build.py --dev-pyodide --out tests/out/dist-dev   # 시험용(Pyodide를 /node_modules/pyodide/에서)
    python3 build.py --update-docs-icons               # docs/img/ 아이콘 복사본도 갱신
    python3 build.py --build-id 2026-10-29a            # 빌드 표시를 넣음(내용 지문·저장본 이름이 바뀜)

쓰기 전에 out 폴더에서 빌드가 만드는 것(index.html, manifest.webmanifest, sw.js, icons/)만 지운다.

    python3 build.py --lessons-dir 다른/폴더              # 장 파일을 다른 폴더에서(시험용, 기본 data/lessons)

결과물 (out 폴더):
  index.html              CSS·앱·작업자·runner.py·레슨 목록이 들어간 한 장. 외부 <script src> 없음
  lessons/chN-<지문>.json  장 하나의 레슨 전체(v0.3 작업 1). 지문 = 파일 내용 sha256 앞 8자
  manifest.webmanifest    홈 화면 앱 설명
  sw.js                   서비스 작업자(판 번호·내용 지문·Pyodide 주소를 채움)
  icons/*.png             리아 얼굴 아이콘(tools/icon.py)

합치는 방법
- src/app.js → esbuild로 묶고 줄임(IIFE). src/lessondev.js(개발판의 data/lessons import)는 빈 모듈로 바꿔 끼워
  레슨 내용이 index.html에 들어가지 않는다. 대신 레슨 목록(window.RIA_LESSON_INDEX)과 장 파일 이름표
  (window.RIA_CHAPTER_FILES)를 넣고, 앱은 레슨을 열 때 장 파일을 받는다. sw.js는 설치 때 장 파일을 모두 미리 받는다.
- src/worker.js → 따로 묶고 줄여(ES 모듈) 글자로 넣고, 실행할 때 Blob 주소로 만든다(window.RIA_WORKER_URL).
- src/py/runner.py → 글자 그대로 window.RIA_RUNNER_SRC로 넣는다.
- Pyodide 주소: 배포는 jsDelivr(판정 C19), --dev-pyodide는 /node_modules/pyodide/.
- app.js가 PyRun에 window.RIA_WORKER_URL·RIA_RUNNER_SRC를 넘기지 않으면 빌드를 멈춘다
  (한 장짜리 HTML에는 worker.js·runner.py 파일이 따로 없어서 Python이 돌지 않는다).
"""
import argparse
import gzip
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
PYODIDE_VERSION = "314.0.7"
PYODIDE_CDN = "https://cdn.jsdelivr.net/npm/pyodide@%s/" % PYODIDE_VERSION
PYODIDE_DEV = "/node_modules/pyodide/"
MAX_RAW = 700 * 1024  # 판정 C28
TARGET = ["es2022", "safari16"]

# esbuild를 JS API로 부른다(한 번에 세 묶음을 글자로 받기 위해).
NODE_BUNDLE = r"""
const [esbuildPath, argsJson] = process.argv.slice(1);
const esbuild = (await import(esbuildPath)).default;
const a = JSON.parse(argsJson);
const common = { bundle: true, minify: true, write: false, metafile: true, target: a.target, legalComments: "none", logLevel: "warning", charset: "utf8" };
// 배포판에는 개발용 레슨 import(src/lessondev.js)를 빈 모듈로 (레슨 내용은 장 파일로 따로 나감)
const noDevLessons = { name: "ria-no-dev-lessons", setup(b) {
  b.onResolve({ filter: /(^|\/)lessondev\.js$/ }, () => ({ path: "lessondev", namespace: "ria-stub" }));
  b.onLoad({ filter: /.*/, namespace: "ria-stub" }, () => ({ contents: "export async function loadDevChapters() { return []; }", loader: "js" }));
} };
const app = await esbuild.build({ ...common, entryPoints: [a.app], format: "iife", plugins: [noDevLessons],
  define: { "import.meta.url": "location.href" } });
const worker = await esbuild.build({ ...common, entryPoints: [a.worker], format: "esm" });
const css = await esbuild.build({ ...common, entryPoints: [a.css], loader: { ".css": "css" } });
const inputs = [...Object.keys(app.metafile.inputs), ...Object.keys(worker.metafile.inputs), ...Object.keys(css.metafile.inputs)];
process.stdout.write(JSON.stringify({ app: app.outputFiles[0].text, worker: worker.outputFiles[0].text, css: css.outputFiles[0].text, inputs }));
"""

# 장 파일 나누기: data/lessons/chN.js → 레슨 목록 + lessons/chN-<지문>.json (목록·이름은 src/lessondata.js가 만듦)
NODE_LESSONS = r"""
const [dir, libUrl] = process.argv.slice(1);
const fs = await import("node:fs"); const path = await import("node:path");
const url = await import("node:url"); const crypto = await import("node:crypto");
const lib = await import(libUrl);
const names = fs.readdirSync(dir).filter((f) => /^ch[1-9]\d*\.js$/.test(f));
const mods = [];
for (const f of names) {
  const m = await import(url.pathToFileURL(path.join(dir, f)).href);
  const n = Number(f.slice(2, -3));
  const id = m.CHAPTER ? m.CHAPTER.id : (m.LESSONS && m.LESSONS[0] && m.LESSONS[0].chapter);
  if (id !== n) throw new Error(`${f}: chapter id ${id} does not match file name`);
  mods.push({ n, CHAPTER: m.CHAPTER || { id: n, title: "" }, LESSONS: m.LESSONS });
}
mods.sort((a, b) => a.n - b.n);
const index = lib.buildLessonIndex(mods);
const files = {}, contents = {}, tasks = [];
for (const m of mods) {
  const text = JSON.stringify({ CHAPTER: m.CHAPTER, LESSONS: m.LESSONS });
  const hash = crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex").slice(0, 8);
  const name = lib.chapterFileName(m.n, hash);
  files[m.n] = name;
  contents[name] = text;
  for (const l of m.LESSONS) for (const it of l.items || []) if (it && it.task) tasks.push(it.task);
}
process.stdout.write(JSON.stringify({ index, files, contents, tasks }));
"""


OWNED = ("index.html", "manifest.webmanifest", "sw.js", "icons", "lessons", "licenses.txt")
HOOKS = ("RIA_WORKER_URL", "RIA_RUNNER_SRC")



def bundled_packages(inputs):
    """esbuild가 실제로 묶어 넣은 node_modules 꾸러미 이름(정렬)."""
    pkgs = set()
    for p in inputs:
        m = re.search(r"(?:^|/)node_modules/((?:@[^/]+/)?[^/]+)/", p)
        if m:
            pkgs.add(m.group(1))
    return sorted(pkgs)


def third_party_notices(inputs, pyodide_url):
    """판정 C43: 묶어 넣은 꾸러미의 라이선스 전문 + CDN에서 받는 Pyodide 안내."""
    parts = ["리아와 파이썬! — 사용한 프로그램과 라이선스 (Third-party notices)", "",
             "이 앱에는 아래 공개 소프트웨어가 들어 있습니다. 각 저작권자에게 감사드립니다.", ""]
    for pkg in bundled_packages(inputs):
        d = os.path.join(ROOT, "node_modules", *pkg.split("/"))
        with open(os.path.join(d, "package.json"), encoding="utf-8") as f:
            meta = json.load(f)
        lic = next((os.path.join(d, n) for n in sorted(os.listdir(d)) if re.match(r"(?i)^licen[cs]e", n)), None)
        if not lic:
            raise SystemExit("build: no LICENSE file for bundled package " + pkg)
        with open(lic, encoding="utf-8") as f:
            body = f.read().strip()
        parts += ["== %s %s (%s)" % (pkg, meta.get("version", ""), meta.get("license", "")), "", body, "", ""]
    parts += ["== pyodide %s (MPL-2.0)" % PYODIDE_VERSION, "",
              "Python 실행기 Pyodide는 앱에 묶지 않고 실행할 때 아래 주소에서 받습니다(고치지 않은 원본).",
              pyodide_url, "라이선스: Mozilla Public License 2.0 — https://www.mozilla.org/MPL/2.0/",
              "소스: https://github.com/pyodide/pyodide", ""]
    return "\n".join(parts)

def check_app_hooks(src):
    """app.js가 PyRun에 작업자 주소와 runner.py 글자를 넘기는지 확인한다."""
    missing = [h for h in HOOKS if ("window." + h) not in src]
    if missing:
        raise SystemExit("build: src/app.js must pass %s to PyRun (single-file build has no worker.js/runner.py)"
                         % ", ".join("window." + h for h in missing))


def check_output(html):
    """한 장짜리 결과에 바깥 파일을 부르는 script·stylesheet가 남지 않았는지 확인한다."""
    if re.search(r"<script\b[^>]*\ssrc\s*=", html, re.I):
        raise SystemExit("build: external <script src> left in output")
    if re.search(r"<link\b[^>]*rel\s*=\s*[\"']?stylesheet", html, re.I):
        raise SystemExit("build: <link rel=\"stylesheet\"> left in output (CSS must be inlined)")


def need_node():
    if not shutil.which("node"):
        raise SystemExit("build: `node` was not found on PATH. Install Node.js 18+ (esbuild runs through it) and retry.")
    if not os.path.exists(os.path.join(ROOT, "node_modules", "esbuild", "lib", "main.js")):
        raise SystemExit("build: node_modules/esbuild is missing. Run `npm install` first.")


def clean(out):
    for name in OWNED:
        p = os.path.join(out, name)
        if os.path.isdir(p):
            shutil.rmtree(p)
        elif os.path.exists(p):
            os.remove(p)


def bundle():
    args = {"app": os.path.join(SRC, "app.js"), "worker": os.path.join(SRC, "worker.js"),
            "css": os.path.join(SRC, "style.css"), "target": TARGET}
    esb = os.path.join(ROOT, "node_modules", "esbuild", "lib", "main.js")
    r = subprocess.run(["node", "--input-type=module", "-e", NODE_BUNDLE, "file://" + esb, json.dumps(args)],
                       cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        raise SystemExit("esbuild failed")
    if r.stderr.strip():
        sys.stderr.write(r.stderr)
    return json.loads(r.stdout)


def split_lessons(lessons_dir):
    """장 파일 나누기 결과: {index, files: {n: 이름}, contents: {이름: JSON 글자}, tasks: [문제 문장]}"""
    lib = "file://" + os.path.join(SRC, "lessondata.js")
    r = subprocess.run(["node", "--input-type=module", "-e", NODE_LESSONS, lessons_dir, lib],
                       cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        raise SystemExit("build: could not read lessons from %s" % lessons_dir)
    out = json.loads(r.stdout)
    if not out["files"]:
        raise SystemExit("build: no chN.js lesson files in %s" % lessons_dir)
    return out


def check_no_lesson_text(html, tasks):
    """index.html에 문제 문장이 남지 않았는지 (장 파일로만 나가야 함)"""
    leaked = [t for t in tasks if t and t in html]
    if leaked:
        raise SystemExit("build: lesson text leaked into index.html (e.g. %r)" % leaked[0][:60])


def js_value(v):
    """<script> 안에 넣을 수 있는 JSON 값"""
    return js_string(v) if isinstance(v, str) else (
        json.dumps(v, ensure_ascii=False, separators=(",", ":"))
        .replace("</", "<\\/").replace("<!--", "<\\!--").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def app_version(src):
    m = re.search(r'export const VERSION = "([^"]+)"', src)
    if not m:
        raise SystemExit("build: VERSION not found in src/app.js")
    return m.group(1)


def js_string(s):
    """<script> 안에 안전하게 넣을 수 있는 JS 문자열 글자."""
    return (json.dumps(s, ensure_ascii=False)
            .replace("</", "<\\/").replace("<!--", "<\\!--")
            .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def html_attr(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def inline_script(code):
    # 문자열·템플릿·정규식 안의 </script 는 <\/script 로 바꿔도 뜻이 같다.
    return re.sub(r"</(script)", r"<\\/\1", code, flags=re.I)


def replace_block(html, name, new):
    start, end = "<!-- RIA:%s -->" % name, "<!-- /RIA:%s -->" % name
    i, j = html.find(start), html.find(end)
    if i < 0 or j < 0:
        raise SystemExit("build: marker %s not found in src/index.html" % name)
    return html[:i] + new + html[j + len(end):]


HEAD_LINKS = """<meta name="mobile-web-app-capable" content="yes">
<meta name="ria-version" content="{version}">{build_meta}
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">
"""

CONFIG = """<script>
window.RIA_VERSION = {version};
window.RIA_PYODIDE_URL = {pyodide};
window.RIA_RUNNER_SRC = {runner};
window.RIA_LESSON_INDEX = {lesson_index};
window.RIA_CHAPTER_FILES = {chapter_files};
(function () {{
  try {{
    window.RIA_WORKER_URL = URL.createObjectURL(new Blob([{worker}], {{ type: "text/javascript" }}));
  }} catch (e) {{ console.warn("worker blob", e); }}
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {{
    window.addEventListener("load", function () {{
      navigator.serviceWorker.register("sw.js").catch(function (e) {{ console.warn("sw", e); }});
    }});
  }}
}})();
</script>"""


def build(out, dev_pyodide=False, update_docs_icons=False, build_id="", lessons_dir=None):
    need_node()
    with open(os.path.join(SRC, "app.js"), encoding="utf-8") as f:
        app_src = f.read()
    check_app_hooks(app_src)
    version = app_version(app_src)
    pyodide_url = PYODIDE_DEV if dev_pyodide else PYODIDE_CDN
    split = split_lessons(lessons_dir or os.path.join(ROOT, "data", "lessons"))
    b = bundle()
    if not all(h in b["app"] for h in HOOKS):
        raise SystemExit("build: bundled app lost %s" % "/".join(HOOKS))
    with open(os.path.join(SRC, "py", "runner.py"), encoding="utf-8") as f:
        runner = f.read()
    with open(os.path.join(SRC, "index.html"), encoding="utf-8") as f:
        html = f.read()

    html = replace_block(html, "STYLE", "<style>" + b["css"].replace("</", "<\\/") + "</style>")
    html = html.replace("</title>\n", "</title>\n" + HEAD_LINKS.format(
        version=version, build_meta=('\n<meta name="ria-build" content="%s">' % html_attr(build_id)) if build_id else ""), 1)
    if 'rel="manifest"' not in html:
        raise SystemExit("build: could not insert head links after <title>")
    config = CONFIG.format(version=js_string(version), pyodide=js_string(pyodide_url),
                           runner=js_string(runner), worker=js_string(b["worker"]),
                           lesson_index=js_value(split["index"]), chapter_files=js_value(split["files"]))
    if "<!-- RIA:CONFIG -->" not in html:
        raise SystemExit("build: marker CONFIG not found in src/index.html")
    html = html.replace("<!-- RIA:CONFIG -->", config, 1)
    html = replace_block(html, "SCRIPT", "<script>" + inline_script(b["app"]) + "</script>")
    check_output(html)
    check_no_lesson_text(html, split["tasks"])

    os.makedirs(out, exist_ok=True)
    clean(out)
    data = html.encode("utf-8")
    with open(os.path.join(out, "index.html"), "wb") as f:
        f.write(data)
    shutil.copy(os.path.join(ROOT, "manifest.webmanifest"), os.path.join(out, "manifest.webmanifest"))
    os.makedirs(os.path.join(out, "lessons"))
    chapter_sizes = []
    for n, name in sorted(split["files"].items(), key=lambda kv: int(kv[0])):
        body = split["contents"][name].encode("utf-8")
        if hashlib.sha256(body).hexdigest()[:8] != re.search(r"-([0-9a-f]{8})\.json$", name).group(1):
            raise SystemExit("build: chapter file hash mismatch for " + name)
        with open(os.path.join(out, name), "wb") as f:
            f.write(body)
        chapter_sizes.append((name, len(body)))
    chapter_files = [name for name, _ in chapter_sizes]

    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import icon  # noqa: E402  (Playwright가 필요해서 쓸 때만 불러옴)
    icon.render(out, update_docs=update_docs_icons)
    with open(os.path.join(ROOT, "manifest.webmanifest"), encoding="utf-8") as f:
        manifest = json.load(f)
    icon_files = sorted({i["src"] for i in manifest["icons"]} | {"icons/apple-touch-icon.png"})
    with open(os.path.join(out, "licenses.txt"), "w", encoding="utf-8") as f:
        f.write(third_party_notices(b["inputs"], pyodide_url))
    game_files = ["./", "index.html", "manifest.webmanifest", "licenses.txt"] + icon_files

    h = hashlib.sha256(data)
    for rel in icon_files + ["manifest.webmanifest", "licenses.txt"]:
        with open(os.path.join(out, rel), "rb") as f:
            h.update(f.read())
    with open(os.path.join(ROOT, "sw.js"), encoding="utf-8") as f:
        sw = f.read()
    sw = (sw.replace("__RIA_VERSION__", version).replace("__RIA_HASH__", h.hexdigest()[:10])
            .replace("__RIA_PYODIDE_VERSION__", PYODIDE_VERSION).replace("__RIA_PYODIDE_URL__", pyodide_url)
            .replace("__RIA_GAME_FILES__", json.dumps(game_files))
            .replace("__RIA_CHAPTER_FILES__", json.dumps(chapter_files)))
    if "__RIA_" in sw:
        raise SystemExit("build: placeholder left in sw.js")
    with open(os.path.join(out, "sw.js"), "w", encoding="utf-8") as f:
        f.write(sw)

    raw, gz = len(data), len(gzip.compress(data, 9))
    print("dist: %s" % os.path.relpath(out, ROOT))
    print("version %s, Pyodide %s" % (version, pyodide_url))
    print("app.js %.1f KB, worker %.1f KB, runner.py %.1f KB, css %.1f KB" % (
        len(b["app"].encode()) / 1024, len(b["worker"].encode()) / 1024, len(runner.encode()) / 1024,
        len(b["css"].encode()) / 1024))
    print("sw cache %s" % re.search(r'GAME_CACHE = "([^"]+)"', sw).group(1))
    print("index.html raw %.1f KB (limit %d KB), gzip %.1f KB" % (raw / 1024, MAX_RAW // 1024, gz / 1024))
    print("lessons: %d chapter files, %.1f KB total" % (len(chapter_sizes), sum(sz for _, sz in chapter_sizes) / 1024))
    for name, sz in chapter_sizes:
        print("  %s %.1f KB" % (name, sz / 1024))
    if raw > MAX_RAW:
        raise SystemExit("build: index.html is over %d KB" % (MAX_RAW // 1024))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "dist"))
    ap.add_argument("--dev-pyodide", action="store_true", help="Pyodide를 /node_modules/pyodide/에서 받음(시험용)")
    ap.add_argument("--update-docs-icons", action="store_true", help="docs/img/ 아이콘 복사본도 갱신")
    ap.add_argument("--build-id", default="", help="빌드 표시(meta ria-build). 바꾸면 게임 저장본 이름도 바뀜")
    ap.add_argument("--lessons-dir", default=None, help="장 파일(chN.js) 폴더. 기본 data/lessons (시험용)")
    a = ap.parse_args()
    build(os.path.abspath(a.out), dev_pyodide=a.dev_pyodide, update_docs_icons=a.update_docs_icons,
          build_id=a.build_id, lessons_dir=os.path.abspath(a.lessons_dir) if a.lessons_dir else None)


if __name__ == "__main__":
    main()
