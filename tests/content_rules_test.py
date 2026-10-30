#!/usr/bin/env python3
"""점검기(tests/content.py) 장별 문법 규칙 시험 (v0.2 작업 2).

실행: python3 tests/content_rules_test.py   (pytest로도 돌아감)
"""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content  # noqa: E402
from content import Lesson, check_code_shape, check_write, chapter_file_errors  # noqa: E402


def shape_errors(code, chapter):
    rep = Lesson("t")
    check_code_shape(rep, "code", code, chapter)
    return rep.errors


def has(errors, word):
    return any(word in e for e in errors)


# ── 1~3장은 예전 표와 똑같다(회귀) ──────────────────────────────────────
OLD_FORBID_ALL = {
    "For", "While", "FunctionDef", "AsyncFunctionDef", "Lambda", "ClassDef", "Import", "ImportFrom",
    "List", "Dict", "Set", "Tuple", "ListComp", "DictComp", "SetComp", "GeneratorExp",
    "Try", "With", "Return", "Yield", "Global", "Nonlocal", "Delete", "Assert", "Raise", "Match",
}
OLD_FORBID = {
    1: OLD_FORBID_ALL | {"Assign", "AugAssign", "AnnAssign", "NamedExpr", "If", "IfExp", "Compare",
                         "BoolOp", "JoinedStr", "Attribute", "Subscript"},
    2: OLD_FORBID_ALL | {"If", "IfExp"},
    3: OLD_FORBID_ALL,
}
OLD_NAMES = {1: {"print"}, 2: None, 3: None}
OLD_CALLS = {
    1: {"print"},
    2: {"print", "input", "int", "float", "str", "bool", "type", "round"},
    3: {"print", "input", "int", "float", "str", "bool", "type", "round", "len", "abs", "max", "min"},
}


# v0.2의 의도된 변경(감독 판정): 인덱스·슬라이싱·메서드는 6장에서 처음 배우므로
# 2~3장에서도 Attribute·Subscript를 금지한다. 그 밖의 1~3장 표는 v0.1과 똑같다.
V02_MOVED_TO_CH6 = {"Attribute", "Subscript"}


def test_ch1_3_tables_unchanged():
    for ch in (1, 2, 3):
        real = {k for k in content.FORBID_BY_CHAPTER[ch] if k in OLD_FORBID_ALL or k in OLD_FORBID[1]}
        assert real == OLD_FORBID[ch] | V02_MOVED_TO_CH6, ch
        assert content.NAMES_BY_CHAPTER[ch] == OLD_NAMES[ch], ch
        assert content.CALLS_BY_CHAPTER[ch] == OLD_CALLS[ch], ch


def test_later_chapters_are_cumulative():
    chs = sorted(content.FORBID_BY_CHAPTER)
    for a, b in zip(chs, chs[1:]):
        assert content.FORBID_BY_CHAPTER[b] <= content.FORBID_BY_CHAPTER[a], (a, b)
        assert content.CALLS_BY_CHAPTER[a] <= content.CALLS_BY_CHAPTER[b], (a, b)


# ── 4장 함수 ─────────────────────────────────────────────────────────────
CH4_OK = """def area(w, h):
    return w * h

def hello():
    print("안녕")

hello()
print(area(3, 4), max(1, 5))
print(len("abc"))
print(min(2, 7), abs(-3), round(2.5))"""


def test_ch4_allowed():
    assert shape_errors(CH4_OK, 4) == []


def test_ch4_forbids_loop():
    e = shape_errors("for i in range(3):\n    print(i)", 4)
    assert has(e, "For") and has(e, "range()")


def test_ch4_forbids_list_literal():
    e = shape_errors("nums = [1, 2]\nprint(nums)", 4)
    assert has(e, "List")


def test_ch4_forbids_index_and_method():
    e = shape_errors('s = "abc"\nprint(s[0], s.upper())', 4)
    assert has(e, "Subscript") and has(e, "Attribute")


def test_ch5_forbids_slice():
    e = shape_errors('s = "abc"\nprint(s[1:])', 5)
    assert has(e, "Slice")


# ── 5장 반복문 ───────────────────────────────────────────────────────────
CH5_OK = """total = 0
for i in range(1, 4):
    if i == 2:
        continue
    total += i
n = 3
while n > 0:
    n -= 1
    if n == 1:
        break
print(total, n)"""


def test_ch5_allowed():
    assert shape_errors(CH5_OK, 5) == []


def test_ch5_forbids_for_over_split():
    e = shape_errors('for w in "a b".split():\n    print(w)', 5)
    assert has(e, "ForNonRange")


def test_ch5_forbids_comprehension():
    e = shape_errors("print([i for i in range(3)])", 5)
    assert has(e, "ListComp")


# ── 6장 문자열 ───────────────────────────────────────────────────────────
CH6_OK = """s = " Ria "
t = s.strip().upper()
print(t[0], t[-1], t[1:3], len(t))
for w in "a b".split():
    print(w)
for ch in t:
    print(ch)"""


def test_ch6_allowed():
    assert shape_errors(CH6_OK, 6) == []


def test_ch6_forbids_list_literal():
    e = shape_errors('words = ["a", "b"]\nprint(words)', 6)
    assert has(e, "List")


def test_ch6_forbids_dict_literal():
    e = shape_errors('d = {"a": 1}\nprint(d)', 6)
    assert has(e, "Dict")


# ── 장 파일 연속성 ───────────────────────────────────────────────────────
def test_contiguity_gap_is_error():
    assert chapter_file_errors([1, 2, 4], None)


def test_contiguity_ok():
    assert chapter_file_errors([1, 2, 3], None) == []


def test_full_n():
    assert chapter_file_errors([1, 2, 3], 3) == []
    assert chapter_file_errors([1, 2, 3], 6)        # 4~6장이 없음
    assert chapter_file_errors([1, 2, 3, 4], 3)     # 계획보다 많음


# ── 정답 코드의 무한 반복 ────────────────────────────────────────────────
def test_loop_timeout():
    item = {
        "type": "write", "concept": "while", "task": "끝나지 않는 반복이에요.", "starter": "",
        "tests": [{"stdin": "", "expect": "", "public": True}], "require": [],
        "hints": ["다시 봐요.", "조건을 봐요.", "멈출 길을 만들어요.", "while ___:"],
        "solution": "while True:\n    pass", "explain": "멈추지 않아요.",
    }
    rep = Lesson("t")
    t0 = time.monotonic()
    check_write(rep, "items[0] write", item, 5)
    took = time.monotonic() - t0
    assert took < content.RUN_SECONDS + 2, took
    assert has(rep.errors, "%d초를 넘음" % content.RUN_SECONDS), rep.errors
    assert has(rep.errors, "Timeout"), rep.errors


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    bad = 0
    for name, fn in tests:
        try:
            fn()
            print("✓ " + name)
        except Exception as e:  # noqa: BLE001
            bad += 1
            print("✗ %s: %s: %s" % (name, type(e).__name__, e))
    print("\n%d/%d 통과" % (len(tests) - bad, len(tests)))
    sys.exit(1 if bad else 0)
