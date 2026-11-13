"""튜토리얼 첫 코드(src/tutorial.js의 tutorialCode)가 입력값을 그대로 글자로 출력하는지.

JS가 만든 코드를 고정 문자열로 박아 실제 CPython에서 exec한다(Pyodide에서도 같은 문법).
test_js_matches_pinned는 node가 있으면 JS 실제 출력이 박아 둔 문자열과 같은지도 확인한다.
"""
import contextlib
import io
import json
import os
import shutil
import subprocess

import pytest

# (JS 입력, JS가 만드는 코드, 실행했을 때 stdout 한 줄)
CASES = [
    ("안녕하세요!", 'print("안녕하세요!")', "안녕하세요!"),
    ("Hello!", 'print("Hello!")', "Hello!"),
    ('a"b', 'print("a\\"b")', 'a"b'),
    ("a\\b", 'print("a\\\\b")', "a\\b"),
    ("a\nb", 'print("ab")', "ab"),
    ("a\r\nb", 'print("ab")', "ab"),
    ("a" * 31, 'print("' + "a" * 30 + '")', "a" * 30),
    ("가" * 31, 'print("' + "가" * 30 + '")', "가" * 30),
    ("😀" * 31, 'print("' + "😀" * 30 + '")', "😀" * 30),
    ('"); import os #', 'print("\\"); import os #")', '"); import os #'),
    ('<b>x</b>"); print(1) #', 'print("<b>x</b>\\"); print(1) #")', '<b>x</b>"); print(1) #'),
    ("\\", 'print("\\\\")', "\\"),
    ("\\\\\"", 'print("\\\\\\\\\\"")', '\\\\"'),
    ("", 'print("")', ""),
]


def run(code):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        exec(compile(code, "<tutorial>", "exec"), {"__builtins__": __builtins__})
    return buf.getvalue()


@pytest.mark.parametrize("text,code,out", CASES, ids=range(len(CASES)))
def test_pinned_code_prints_text_verbatim(text, code, out):
    assert run(code) == out + "\n"


@pytest.mark.skipif(shutil.which("node") is None, reason="node 없음")
def test_js_matches_pinned():
    root = os.path.join(os.path.dirname(__file__), "..", "..")
    script = (
        "import { tutorialCode } from './src/tutorial.js';"
        "const c = JSON.parse(process.argv[1]);"
        "console.log(JSON.stringify(c.map(t => tutorialCode(t))));"
    )
    res = subprocess.run(
        ["node", "--input-type=module", "-e", script, json.dumps([c[0] for c in CASES])],
        cwd=root, capture_output=True, text=True, check=True,
    )
    assert json.loads(res.stdout) == [c[1] for c in CASES]
