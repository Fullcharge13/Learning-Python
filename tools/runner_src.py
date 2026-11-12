"""작업자에 올릴 runner 글자 = guard.py + "\n" + runner.py (판정 R6).

작업자는 파일 하나(ria_runner 모듈)만 올리므로 guard.py를 앞에 이어 붙인다. runner.py 맨 위의
`try: _guard_prepare / except NameError: from guard import ...`는 이어 붙이면 import 없이 지나간다.
guard.py에는 `from __future__`를 두지 않는다(맨 앞이 아니면 문법 오류).
build.py·tools/dev.py·tests/grader_browser.py가 같은 함수를 쓴다.
"""
import os

SRC_PY = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "py")


def runner_source():
    parts = []
    for name in ("guard.py", "runner.py"):
        with open(os.path.join(SRC_PY, name), encoding="utf-8") as f:
            parts.append(f.read())
    return parts[0] + "\n" + parts[1]
