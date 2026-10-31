"""README 첫머리 화면 캡처 3장을 docs/img/로 복사한다.

먼저 `python3 tests/flow.py`를 돌려 tests/out/flow/에 최신 캡처(아이폰 17)가 있어야 한다.
    python3 tools/readme_shots.py
"""
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tests" / "out" / "flow"
SHOTS = {"iphone-17-home.png": "screen-home.png", "iphone-17-write.png": "screen-write.png",
         "iphone-17-done.png": "screen-done.png"}

missing = [s for s in SHOTS if not (SRC / s).exists()]
if missing:
    sys.exit("readme_shots: run `python3 tests/flow.py` first (missing %s)" % ", ".join(missing))
for src, dst in SHOTS.items():
    shutil.copy(SRC / src, ROOT / "docs" / "img" / dst)
    print("copied", dst)
