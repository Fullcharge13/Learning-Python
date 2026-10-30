#!/usr/bin/env python3
"""점검기(tests/content.py) 장별 문법 규칙 시험 (v0.2 작업 2).

실행: python3 tests/content_rules_test.py   (pytest로도 돌아감)
"""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content  # noqa: E402
from content import Lesson, check_code_shape, check_write, check_require, chapter_file_errors  # noqa: E402


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


# ── 7장 리스트 ───────────────────────────────────────────────────────────
CH7_OK = """cart = ["사과", "우유"]
cart.append("빵")
cart.insert(0, "물")
cart.remove("우유")
last = cart.pop()
cart[0] = "주스"
nums = [3, 1, 2]
nums.sort()
print(cart, last, nums.index(2))
print(sorted(nums), sum(nums))
print(list("ab"))
for n in nums:
    print(n)"""


def test_ch7_allowed():
    assert shape_errors(CH7_OK, 7) == []


def test_ch7_forbids_dict_literal():
    e = shape_errors('d = {"a": 1}\nprint(d)', 7)
    assert has(e, "Dict")


def test_ch7_forbids_try():
    e = shape_errors("try:\n    print(1)\nexcept ValueError:\n    print(2)", 7)
    assert has(e, "Try")


def test_ch7_forbids_comprehension():
    e = shape_errors("print([n * 2 for n in [1, 2]])", 7)
    assert has(e, "ListComp")


# ── 8장 딕셔너리 ─────────────────────────────────────────────────────────
CH8_OK = """menu = {"라테": 4500, "차": 3000}
menu["쿠키"] = 2000
print(menu.get("빵", "품절"))
print("차" in menu, list(menu.keys()))
print(sum(menu.values()))
for k, v in menu.items():
    print(k, v)
votes = {}
for w in "a b a".split():
    votes[w] = votes.get(w, 0) + 1
print(votes)"""


def test_ch8_allowed():
    assert shape_errors(CH8_OK, 8) == []


def test_ch8_forbids_tuple_literal():
    e = shape_errors("t = (1, 2)\nprint(t)", 8)
    assert has(e, "Tuple")


def test_ch8_forbids_tuple_unpack_assign():
    # for 대상이 아닌 곳의 묶고 풀기(a, b = …)는 9장
    e = shape_errors("a, b = 1, 2\nprint(a, b)", 8)
    assert has(e, "Tuple")


def test_ch8_forbids_set_literal():
    e = shape_errors("s = {1, 2}\nprint(s)", 8)
    assert has(e, "Set")


# ── 9장 튜플과 집합 ──────────────────────────────────────────────────────
CH9_OK = """def low_high(nums):
    return min(nums), max(nums)

p = (3, 4)
a, b = 1, 2
a, b = b, a
lo, hi = low_high([5, 1, 9])
print(p[0], a, b, lo, hi)
print(tuple([1, 2]))
x = {"수영", "축구"}
y = set(["축구", "바둑"])
print(x & y, x | y, x - y)"""


def test_ch9_allowed():
    assert shape_errors(CH9_OK, 9) == []


def test_ch9_forbids_try():
    e = shape_errors("try:\n    print(1)\nexcept ValueError:\n    print(2)", 9)
    assert has(e, "Try")


def test_ch9_forbids_raise():
    e = shape_errors('raise ValueError("음수")', 9)
    assert has(e, "Raise")


# ── 10장 예외 처리 ───────────────────────────────────────────────────────
CH10_OK = """def check_age(n):
    if n < 0:
        raise ValueError("음수 나이")
    return n

try:
    n = int(input())
    print(10 / n)
except ValueError:
    print("숫자로 입력해 주세요")
except ZeroDivisionError:
    print("0으로 못 나눠요")
else:
    print(check_age(n))
finally:
    print("끝")"""


def test_ch10_allowed():
    assert shape_errors(CH10_OK, 10) == []


def test_ch10_forbids_comprehension():
    e = shape_errors("print([i for i in range(3)])", 10)
    assert has(e, "ListComp")


def test_ch10_forbids_class():
    e = shape_errors("class Cat:\n    pass", 10)
    assert has(e, "ClassDef")


# ── require 형식 (판정 C34: Method:이름) ─────────────────────────────────
def require_errors(req):
    rep = Lesson("t")
    check_require(rep, "require", req)
    return rep.errors


def test_require_method_ok():
    assert require_errors(["Method:get", "Call:print", "Name:x", "For"]) == []


def test_require_method_bad_format():
    assert has(require_errors(["Method:"]), "형식이 틀림")
    assert has(require_errors(["Method:1x"]), "형식이 틀림")
    assert has(require_errors(["Attr:get"]), "형식이 틀림")


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


# ── v0.4 E1·E2: files·server 칸 (작업 1) ─────────────────────────────
from content import files_of, server_of, check_choice  # noqa: E402


def _env_errors(fn, obj):
    rep = Lesson("t")
    v = fn(rep, "x", obj)
    return v, rep.errors


def test_files_shape():
    assert _env_errors(files_of, {}) == (None, [])
    assert _env_errors(files_of, {"files": {"memo.txt": "우유"}}) == ({"memo.txt": "우유"}, [])
    for bad in ({}, [], "memo.txt", {"a/b.txt": "x"}, {".hidden": "x"}, {"m.txt": 3},
                {"x" * 41: ""}, {str(i): "" for i in range(6)}):
        v, errs = _env_errors(files_of, {"files": bad})
        assert v is None and has(errs, "files"), (bad, errs)


def test_server_shape():
    ok = {"https://ria.example/menu": {"status": 200, "body": "김밥", "type": "text/plain"},
          "http://ria.example/x": {"status": 404, "body": ""}}
    assert _env_errors(server_of, {"server": ok}) == (ok, [])
    for bad in ({}, {"ria.example": {"status": 200, "body": ""}},
                {"https://a.b/c": {"status": "200", "body": ""}},
                {"https://a.b/c": {"status": True, "body": ""}},
                {"https://a.b/c": {"status": 700, "body": ""}},
                {"https://a.b/c": {"status": 200}},
                {"https://a.b/c": {"status": 200, "body": b"x"}},
                {"https://a.b/c": {"status": 200, "body": "", "headers": {}}},
                {"https://a b/c": {"status": 200, "body": ""}}):
        v, errs = _env_errors(server_of, {"server": bad})
        assert v is None and has(errs, "server"), (bad, errs)


def _run_errors(errors):
    """장 문법 규칙(open·import 금지 등, 작업 2 몫)을 뺀 실행 관련 오류만."""
    return [e for e in errors if "실제 출력" in e or "통과하지" in e or "다름" in e or "files" in e or "server" in e
            or "시험" in e]


def test_choice_runs_with_files_and_server():
    item = {"type": "choice", "concept": "print", "q": "출력은?",
            "code": "print(open('m.txt').read())\nimport urllib.request\n"
                    "print(urllib.request.urlopen('https://ria.example/a').read().decode())",
            "options": ["우유\n김밥", "우유", "오류"], "answer": 0, "explain": "파일과 서버에서 읽어요.",
            "files": {"m.txt": "우유"}, "server": {"https://ria.example/a": {"status": 200, "body": "김밥"}}}
    rep = Lesson("t")
    check_choice(rep, "items[0]", item, 10)
    assert _run_errors(rep.errors) == [], rep.errors
    item["answer"] = 1
    rep = Lesson("t")
    check_choice(rep, "items[0]", item, 10)
    assert has(rep.errors, "실제 출력"), rep.errors


def test_write_test_level_files_override():
    item = {
        "type": "write", "concept": "print", "task": "memo.txt의 줄 수를 출력해요.", "starter": "",
        "tests": [{"stdin": "", "expect": "2", "public": True},
                  {"stdin": "", "expect": "3", "public": False, "files": {"memo.txt": "a\nb\nc\n"}}],
        "require": [], "files": {"memo.txt": "a\nb\n"},
        "hints": ["다시 봐요.", "파일을 읽어요.", "줄로 나눠요.", "print(len(___))"],
        "solution": "print(len(open('memo.txt').read().splitlines()))", "explain": "줄 수예요.",
    }
    rep = Lesson("t")
    check_write(rep, "items[0] write", item, 10)
    assert _run_errors(rep.errors) == [], rep.errors
    # 시험별 files가 없으면 입력 없는 문제라 시험은 1개만
    item2 = dict(item, tests=[dict(item["tests"][0]), {"stdin": "", "expect": "2", "public": False}])
    rep = Lesson("t")
    check_write(rep, "items[0] write", item2, 10)
    assert has(rep.errors, "tests는 1~1개"), rep.errors
    # 시험 칸 오타
    item3 = dict(item, tests=[dict(item["tests"][0], file={"memo.txt": "x"})])
    rep = Lesson("t")
    check_write(rep, "items[0] write", item3, 10)
    assert has(rep.errors, "선택 files"), rep.errors


def test_card_with_files():
    lesson_like = {"say": "파일을 읽어요.", "code": "print(open('m.txt').read())", "out": "리아", "files": {"m.txt": "리아"}}
    from content import ITEM_KEYS, CARD_OPT
    assert {"files", "server"} <= CARD_OPT
    for kind in ("choice", "check", "blank", "order", "write"):
        assert {"files", "server"} <= ITEM_KEYS[kind][1], kind
    r = content.safe_run(Lesson("t"), "c", lesson_like["code"], "", files=lesson_like["files"])
    assert r["stdout"] == "리아\n" and r["error"] is None, r


# ── v0.4 작업 2: 11~14장 문법·import 허용 ─────────────────────────────
def rule_errors(code, chapter):
    """줄 폭(38칸) 오류를 뺀 문법 규칙 오류만(긴 예시 코드를 한곳에 모아 시험하려고)."""
    return [e for e in shape_errors(code, chapter) if "넓음" not in e]


def test_modules_cumulative():
    m = content.MODULES_BY_CHAPTER
    assert m[10] == set()
    assert m[11] == {"csv"}
    assert m[12] == {"csv", "re"}
    assert m[13] == {"csv", "re", "urllib.request", "urllib.parse", "urllib.error"}
    assert m[14] == m[13] | {"json"}


# 11장 파일
CH11_OK = """import csv

with open("memo.txt", encoding="utf-8") as f:
    text = f.read()
f = open("memo.txt", "r")
first = f.readline()
rest = f.readlines()
f.close()
count = 0
with open("memo.txt") as f:
    for line in f:
        count += 1
        print(line.strip().split(","))
with open("todo.txt", "w") as f:
    f.write("우유\\n")
with open("todo.txt", mode="a") as f:
    f.write("빵\\n")
try:
    open("없음.txt")
except FileNotFoundError:
    print("없어요")
with open("book.csv") as f:
    for row in csv.reader(f):
        print(row[0])
with open("out.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["a", 1])
print(text, first, rest, count)"""


def test_ch11_allowed():
    assert rule_errors(CH11_OK, 11) == []


def test_ch10_forbids_with_open():
    e = shape_errors('with open("m.txt") as f:\n    print(f.read())', 10)
    assert has(e, "With") and has(e, "open()"), e


def test_ch10_forbids_import_csv():
    e = shape_errors("import csv\nprint(1)", 10)
    assert has(e, "Import"), e


def test_ch11_forbids_other_modules():
    for code, mod in (("import os", "os"), ("import re", "re"), ("import sys", "sys"),
                      ("from json import loads", "json"), ("import csv, os", "os"),
                      ("import urllib", "urllib")):
        e = shape_errors(code + "\nprint(1)", 11)
        assert has(e, "쓸 수 없는 모듈 %s" % mod), (code, e)


def test_ch11_forbids_star_and_unknown_member():
    assert has(shape_errors("from csv import *", 11), "*")
    assert has(shape_errors("import csv\nr = csv.DictWriter", 11), "csv.DictWriter")


def test_ch11_open_modes():
    for mode in ("rb", "x", "w+", "r+"):
        e = shape_errors('f = open("m.txt", "%s")' % mode, 11)
        assert has(e, "모드"), (mode, e)
    assert has(shape_errors('m = "w"\nf = open("m.txt", m)', 11), "모드")
    assert has(shape_errors('f = open("m.txt", buffering=1)', 11), "buffering")


def test_ch11_still_forbids_comprehension_lambda_class():
    assert has(shape_errors('print([l for l in open("m.txt")])', 11), "ListComp")
    assert has(shape_errors("f = lambda x: x", 11), "Lambda")
    assert has(shape_errors("class A:\n    pass", 11), "ClassDef")


# 12장 정규표현식
CH12_OK = r"""import re

s = "주문 3개, 12시 30분"
m = re.search(r"\d+", s)
if m:
    print(m.group(), m.group(0))
m2 = re.match(r"(\w+)@(\w+)", "ria@cafe")
print(m2.group(1))
print(re.fullmatch(r"\d{3}", "123") is not None)
print(re.findall(r"\d+", s))
print(re.sub(r"\d", "*", s))
print(re.split(r",\s*", "a, b,c"))
p = re.compile(r"(\d+)시")
print(p.search(s).group(1), p.findall(s))"""


def test_ch12_allowed():
    assert rule_errors(CH12_OK, 12) == []


def test_ch11_forbids_import_re():
    assert has(shape_errors("import re\nprint(re.findall('a', 'aa'))", 11), "쓸 수 없는 모듈 re")


def test_ch12_forbids():
    assert has(shape_errors("import json", 12), "쓸 수 없는 모듈 json")
    assert has(shape_errors("import urllib.request", 12), "쓸 수 없는 모듈 urllib.request")
    assert has(shape_errors('import re\nprint(re.escape("."))', 12), "re.escape")
    assert has(shape_errors('import re\nprint(re.sub("a", lambda m: "b", "a"))', 12), "Lambda")


# 13장 네트워크 기초
CH13_OK = """import urllib.request
import urllib.parse
import urllib.error
from urllib.request import urlopen, Request

url = "https://ria.example/search?q=" + urllib.parse.quote("김밥")
parts = urllib.parse.urlparse(url)
print(parts.netloc, urllib.parse.parse_qs(parts.query)["q"][0])
print(urllib.parse.unquote("%EA%B9%80"))
q = urllib.parse.urlencode({"q": "라면", "n": 3})
with urllib.request.urlopen("https://ria.example/menu") as r:
    print(r.status, r.read().decode())
req = Request("https://ria.example/menu")
r = urlopen(req)
html = r.read().decode("utf-8")
print(html.find("<title>"))
try:
    urllib.request.urlopen("https://ria.example/x")
except urllib.error.HTTPError as e:
    print(e.code)
except urllib.error.URLError as e:
    print(e.reason)"""


def test_ch13_allowed():
    assert rule_errors(CH13_OK, 13) == []


def test_ch13_from_import_names_callable():
    code = "from urllib.parse import quote, urlencode\nprint(quote('a'), urlencode({'a': 1}))"
    assert rule_errors(code, 13) == []
    code = "from urllib.error import HTTPError, URLError\nprint(HTTPError, URLError)"
    assert rule_errors(code, 13) == []


def test_ch13_forbids():
    for code, word in (("import socket", "쓸 수 없는 모듈 socket"),
                       ("import requests", "쓸 수 없는 모듈 requests"),
                       ("import json", "쓸 수 없는 모듈 json"),
                       ("from urllib import request", "쓸 수 없는 모듈 urllib"),
                       ("import http.client", "쓸 수 없는 모듈 http.client"),
                       ("from urllib.request import urlretrieve", "urllib.request.urlretrieve"),
                       ("import urllib.request\nurllib.request.urlretrieve('x')", "urllib.request.urlretrieve")):
        e = shape_errors(code, 13)
        assert has(e, word), (code, e)


def test_ch12_forbids_urllib_from_import():
    assert has(shape_errors("from urllib.request import urlopen", 12), "쓸 수 없는 모듈 urllib.request")


# 14장 웹 API와 JSON
CH14_OK = """import json
import urllib.request
import urllib.parse

text = '{"stop": "시청", "buses": [{"no": 7, "min": 3}]}'
data = json.loads(text)
for bus in data["buses"]:
    print(bus["no"], bus["min"])
print(data["buses"][0]["no"])
print(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True))
q = urllib.parse.urlencode({"stop": 101})
with urllib.request.urlopen("https://ria.example/bus?" + q) as r:
    info = json.loads(r.read().decode())
print(info.get("stop"))"""


def test_ch14_allowed():
    assert rule_errors(CH14_OK, 14) == []


def test_ch13_forbids_import_json():
    assert has(shape_errors("import json\nprint(json.loads('1'))", 13), "쓸 수 없는 모듈 json")


def test_ch14_forbids():
    for code, word in (("import subprocess", "쓸 수 없는 모듈 subprocess"),
                       ("import os", "쓸 수 없는 모듈 os"),
                       ("import json\nprint(json.load(open('a.json')))", "json.load"),
                       ("import json\nprint(json.dumps({}, default=str))", "default"),
                       ("print({k: 1 for k in 'ab'})", "DictComp"),
                       ("class Bus:\n    pass", "ClassDef")):
        e = shape_errors(code, 14)
        assert has(e, word), (code, e)


def test_module_alias():
    assert shape_errors("import json as j\nprint(j.loads('1'))", 14) == []
    assert has(shape_errors("import json as j\nprint(j.load(1))", 14), "json.load")


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
