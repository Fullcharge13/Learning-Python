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
# v0.7.1의 의도된 변경(기초 보강 설계 2절): f-문자열은 1장(1-2)부터 본 과정에서 허용
V071_ALLOWED_IN_CH1 = {"JoinedStr"}


def test_ch1_3_tables_unchanged():
    for ch in (1, 2, 3):
        real = {k for k in content.FORBID_BY_CHAPTER[ch] if k in OLD_FORBID_ALL or k in OLD_FORBID[1]}
        assert real == (OLD_FORBID[ch] | V02_MOVED_TO_CH6) - V071_ALLOWED_IN_CH1, ch
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


# ── v0.5 작업 2: 15~17장 ─────────────────────────────────────────────
def test_modules_cumulative_v05():
    m = content.MODULES_BY_CHAPTER
    assert m[15] == m[14]
    assert m[16] == m[15] | {"sqlite3"}
    assert m[17] == m[16] | {"chart"}
    for ch in (15, 16, 17):
        assert {"max", "min", "round", "isinstance", "super"} <= content.CALLS_BY_CHAPTER[ch], ch


# 15장 객체지향
CH15_OK = """class Pet:
    kind = "동물"

    def __init__(self, name):
        self.name = name
        self.hunger = 0

    def __str__(self):
        return "펫 " + self.name

    def eat(self, n):
        self.hunger -= n
        return self.hunger


class Dog(Pet):
    def __init__(self, name, trick):
        super().__init__(name)
        self.trick = trick

    def show(self):
        print(self.name, self.trick)


d = Dog("초코", "손")
d.show()
d.eat(2)
d.hunger = 5
print(d, Pet.kind, d.kind)
print(isinstance(d, Pet), str(d))
pets = [Pet("나비"), d]
for p in pets:
    print(p.name)"""


def test_ch15_allowed():
    assert rule_errors(CH15_OK, 15) == []


def test_ch15_missing_self_is_not_a_rule_error():
    # self를 빠뜨린 코드는 실행 때 TypeError가 나는 「틀린 예」로 쓸 수 있어야 함
    code = "class Cat:\n    def meow():\n        print(1)\n\nCat().meow()"
    assert rule_errors(code, 15) == []


def test_ch14_forbids_class():
    e = shape_errors("class Cat:\n    pass\nc = Cat()", 14)
    assert has(e, "ClassDef") and has(e, "Cat()"), e


def test_ch15_forbids_bad_classes():
    for code, word in (
        ("class A:\n    pass\nclass B:\n    pass\nclass C(A, B):\n    pass", "여러 클래스"),
        ("class A(object):\n    pass", "object"),
        ("class E(Exception):\n    pass", "Exception"),
        ("class A:\n    pass\nclass B(A, metaclass=type):\n    pass", "metaclass"),
        ("def deco(c):\n    return c\n\n@deco\nclass A:\n    pass", "@"),
        ("class A:\n    @staticmethod\n    def f():\n        return 1", "@"),
        ("class A:\n    def __eq__(self, o):\n        return True", "__eq__"),
        ("class A:\n    def __len__(self):\n        return 1", "__len__"),
        ("class A:\n    pass\nprint(A().__dict__)", "__dict__"),
        ("class A:\n    pass\nprint(A.__name__)", "__name__"),
        ("class A:\n    def f(self):\n        return [x for x in 'ab']", "ListComp"),
        ("class A:\n    f = lambda self: 1", "Lambda"),
    ):
        e = shape_errors(code, 15)
        assert has(e, word), (code, e)


def test_ch15_forbids_sqlite3():
    assert has(shape_errors("import sqlite3", 15), "쓸 수 없는 모듈 sqlite3")


# 16장 데이터베이스와 SQL
CH16_OK = """import sqlite3

conn = sqlite3.connect(":memory:")
cur = conn.cursor()
cur.execute("CREATE TABLE book (t TEXT, y INT)")
rows = [("하늘", 2021), ("바다", 2019)]
cur.executemany("INSERT INTO book VALUES (?, ?)", rows)
conn.commit()
cur.execute("SELECT t FROM book WHERE y > ?", (2020,))
for row in cur.fetchall():
    print(row[0])
one = conn.execute("SELECT COUNT(*) FROM book").fetchone()
print(one[0])
for t, y in conn.execute("SELECT * FROM book ORDER BY y"):
    print(t, y)
cur.close()
conn.close()"""


def test_ch16_allowed():
    assert rule_errors(CH16_OK, 16) == []


def test_ch16_connect_memory_only():
    for code in ('import sqlite3\nconn = sqlite3.connect("lib.db")',
                 'import sqlite3\nname = ":memory:"\nconn = sqlite3.connect(name)',
                 'import sqlite3\nconn = sqlite3.connect()',
                 'import sqlite3\nconn = sqlite3.connect(":memory:", timeout=1)',
                 'from sqlite3 import connect\nconn = connect("a.db")'):
        e = shape_errors(code, 16)
        assert has(e, ":memory:"), (code, e)


def test_ch16_forbids():
    for code, word in (("import sqlite3\nprint(sqlite3.Row)", "sqlite3.Row"),
                       ('import sqlite3\nc = sqlite3.connect(":memory:")\nc.executescript("x")', "executescript"),
                       ('import sqlite3\nc = sqlite3.connect(":memory:")\nc.create_function("f", 1, len)',
                        "create_function"),
                       ("import chart", "쓸 수 없는 모듈 chart"),
                       ("import os", "쓸 수 없는 모듈 os")):
        e = shape_errors(code, 16)
        assert has(e, word), (code, e)


# 17장 데이터 시각화
CH17_OK = """import chart

months = ["1월", "2월", "3월"]
cost = {"1월": 30, "2월": 45, "3월": 38}
values = []
for m in months:
    values.append(cost[m])
print(max(values), min(values), round(sum(values) / 3, 1))
chart.bar(months, values)
chart.title("월별 지출")
chart.xlabel("달")
chart.ylabel("만 원")
chart.show()
chart.line(months, values)
chart.show()"""


def test_ch17_allowed():
    assert rule_errors(CH17_OK, 17) == []


def test_ch17_comment_only_matplotlib_card_ok():
    code = "# import matplotlib.pyplot as plt\n# plt.bar(names, values)\n# plt.show()"
    assert rule_errors(code, 17) == []


def test_ch17_forbids():
    for code, word in (("import chart\nchart.pie([1], [2])", "chart.pie"),
                       ("import matplotlib.pyplot as plt", "쓸 수 없는 모듈 matplotlib.pyplot"),
                       ("import chart\nchart.bar([1], [2], color='red')", "color"),
                       ("import chart\nchart.bar([n for n in 'ab'], [1, 2])", "ListComp"),
                       ('import sqlite3\nc = sqlite3.connect("x.db")', ":memory:")):
        e = shape_errors(code, 17)
        assert has(e, word), (code, e)


def test_ch16_forbids_chart():
    assert has(shape_errors("import chart\nchart.show()", 16), "쓸 수 없는 모듈 chart")


def test_concepts_v05():
    mods = content.load_modules([content.CONCEPTS_FILE])
    cs = mods[content.CONCEPTS_FILE]["CONCEPTS"]
    by = {c["id"]: c["chapter"] for c in cs}
    want = {15: ["class", "init", "method", "inherit"], 16: ["sqlcreate", "sqlselect", "sqlagg", "sqlpy"],
            17: ["vizdata", "bar", "line", "vizstyle"]}
    for ch, ids in want.items():
        for i in ids:
            assert by.get(i) == ch, (i, by.get(i))
    assert len(by) == len(cs)


# ── require: Comment·Elif·Else (판정 C44) ─────────────────────────────
def test_require_comment_elif_else_ok():
    assert require_errors(["Comment", "Elif", "Else", "If"]) == []


def test_require_unknown_pseudo_still_error():
    assert has(require_errors(["Elsee"]), "ast 마디 이름이 아님")



# ── require: SelfCall·FormatSpec·TripleStr (판정 C45) ────────────────
def test_require_selfcall_formatspec_triplestr_ok():
    assert require_errors(["SelfCall", "FormatSpec", "TripleStr", "Elif"]) == []


def test_require_c45_typo_still_error():
    assert has(require_errors(["Selfcall"]), "ast 마디 이름이 아님")
    assert has(require_errors(["TripleQuote"]), "ast 마디 이름이 아님")

def _write_item(lesson_id):
    ch = lesson_id.split("-")[0]
    path = os.path.join(content.LESSON_DIR, "ch%s.js" % ch)
    lessons = content.load_modules([path])[path]["LESSONS"]
    lesson = next(l for l in lessons if l["id"] == lesson_id)
    return next(it for it in lesson["items"] if it["type"] == "write")


def test_lesson_1_4_requires_comment_and_cheat_fails():
    it = _write_item("1-4")
    assert "Comment" in it["require"] and "주석" in it["task"]
    from runner import run
    cheat = run('print("선크림 챙기기")\n', "", it["require"])   # 줄을 지운 풀이
    assert cheat["stdout"].strip() == it["tests"][0]["expect"] and cheat["missing"] == ["Comment"]
    assert run(it["solution"], "", it["require"])["missing"] == []


def test_ch3_else_elif_requires_match_task_text():
    two_ifs_32 = "height = int(input())\nif height >= 120:\n    print(\"탑승 가능\")\nif height < 120:\n    print(\"다음에 만나요\")"
    it = _write_item("3-2")
    assert "else" in it["task"] and "Else" in it["require"]
    from runner import run
    assert run(two_ifs_32, "130", it["require"])["missing"] == ["Else"]
    it = _write_item("3-3")
    assert "elif" in it["task"] and "Elif" in it["require"]
    # 과제 문장에 없는 조건은 넣지 않는다
    for lid in ("3-1", "3-4", "3-5"):
        w = _write_item(lid)
        for word, req in (("elif", "Elif"), ("else", "Else")):
            assert (req in w["require"]) == (word in w["task"]), (lid, req)



# ── v0.7 심화 레슨 규칙 (계획 작업 2) ─────────────────────────────────────
# 심화 N-Ak = N장 규칙 + 심화 N장까지 연 문법(ADVANCED_EXTRA, 누적). 심화 문법은 본 과정에 새지 않는다.
import json as _json  # noqa: E402
import tempfile as _tempfile  # noqa: E402

TQ = '"' * 3   # 여러 줄 문자열 따옴표(이 파일 안에서 헷갈리지 않게)


def adv_errors(code, chapter):
    rep = Lesson("t")
    check_code_shape(rep, "code", code, content.AdvancedChapter(chapter))
    return rep.errors


def test_adv_tables_cumulative_and_main_never_opens_advanced_only():
    for ch in range(1, 18):
        assert content.ADVANCED_ONLY <= content.MAIN_FORBID_BY_CHAPTER[ch], ch
        assert content.CALLS_BY_CHAPTER[ch] <= content.ADV_CALLS_BY_CHAPTER[ch], ch
        assert content.ADV_FORBID_BY_CHAPTER[ch] <= content.MAIN_FORBID_BY_CHAPTER[ch], ch
    for a in range(1, 17):
        assert content.ADV_FORBID_BY_CHAPTER[a + 1] <= content.ADV_FORBID_BY_CHAPTER[a], a
    # 1~6장 심화에서도 lambda·컴프리헨션은 아직(7·9장 심화, v0.8)
    for ch in range(1, 7):
        assert {"Lambda", "ListComp", "DictComp", "SetComp", "GeneratorExp"} <= content.ADV_FORBID_BY_CHAPTER[ch]


# 1장 심화: f-string 서식 지정자(상수만, 변수는 2장), 여러 줄 문자열
CH1A_OK = ('print(f"{3.14159:.2f}")\n'
           'print(f"{\'커피\':>6}|{4500:>7,}")\n'
           'print(' + TQ + '영수증\n------' + TQ + ')')


def test_adv1_allowed():
    assert adv_errors(CH1A_OK, 1) == []


def test_adv1_spec_forbidden_in_main_1_and_main_2():
    e1 = shape_errors('print(f"{3.14159:.2f}")', 1)
    assert has(e1, "FormatSpec") and not has(e1, "JoinedStr")
    e = shape_errors('x = 3.14159\nprint(f"{x:.2f}")', 2)
    assert has(e, "FormatSpec") and has(e, "심화")
    assert has(shape_errors('w = 7\nprint(f"{w:>8}")', 17), "FormatSpec")


def test_adv1_multiline_forbidden_in_main():
    assert has(shape_errors("print(" + TQ + "가\n나" + TQ + ")", 1), "TripleQuote")
    assert has(shape_errors("s = '''가\n나'''\nprint(s)", 12), "TripleQuote")
    assert has(shape_errors("x = 1\nprint(f" + TQ + "{x}\n나" + TQ + ")", 12), "TripleQuote")


def test_adv1_still_forbids_variables_and_nested_spec():
    assert has(adv_errors('x = 1\nprint(f"{x:>3}")', 1), "Assign")
    assert has(adv_errors('x = 5\nw = 4\nprint(f"{x:>{w}}")', 2), "FormatSpecNested")


# 2장 심화: divmod(몫·나머지), q, r = divmod(…) 풀기만
CH2A_OK = "m = int(input())\nh, mm = divmod(m, 60)\nprint(h, mm, round(0.1 + 0.2, 2))"


def test_adv2_allowed():
    assert adv_errors(CH2A_OK, 2) == []


def test_adv2_forbids():
    assert has(shape_errors("print(divmod(7, 2))", 2), "divmod")   # 본 과정에는 없음
    assert has(shape_errors("print(divmod(7, 2))", 17), "divmod")
    assert has(adv_errors("print(divmod(7, 2))", 1), "divmod")
    assert has(adv_errors("a, b = 1, 2\nprint(a)", 2), "Tuple")       # 풀기는 divmod만
    assert has(shape_errors("h, m = divmod(130, 60)\nprint(h)", 3), "Tuple")
    assert has(adv_errors("x = 1\nmatch x:\n    case 1:\n        print(1)", 2), "Match")


# 3장 심화: match(글자·숫자 값, | 여러 값, _ 나머지). 이름 잡기·guard·클래스·목록 패턴은 안 됨
CH3A_OK = """cmd = input()
match cmd:
    case "아메리카노" | "라테":
        print("커피")
    case 1:
        print("하나")
    case _:
        print("기타")"""


def test_adv3_allowed():
    assert adv_errors(CH3A_OK, 3) == []
    assert adv_errors(CH3A_OK, 9) == []   # 뒤 장 심화에도 누적


def test_adv3_match_forbidden_in_main_and_earlier_adv():
    assert has(shape_errors(CH3A_OK, 3), "Match")
    assert has(shape_errors(CH3A_OK, 17), "Match")
    assert has(adv_errors(CH3A_OK, 2), "Match")


def test_adv3_match_pattern_limits():
    head = "x = 1\nmatch x:\n"
    assert has(adv_errors(head + "    case n:\n        print(n)", 3), "MatchPattern")
    assert has(adv_errors(head + "    case 1 if x > 0:\n        print(1)", 3), "MatchGuard")
    assert has(adv_errors(head + "    case int():\n        print(1)", 3), "MatchPattern")
    assert has(adv_errors(head + "    case [1, 2]:\n        print(1)", 9), "MatchPattern")
    assert has(adv_errors(head + "    case {\"a\": 1}:\n        print(1)", 9), "MatchPattern")
    assert adv_errors(head + "    case -1:\n        print(1)\n    case None:\n        print(0)", 3) == []


# 4장 심화: 기본값 매개변수(상수만), 재귀
CH4A_OK = """def greet(name, end="!"):
    return name + end

def fact(n):
    if n <= 1:
        return 1
    return n * fact(n - 1)

print(greet("리아"))
print(greet("리아", end="?"))
print(fact(5))"""


def test_adv4_allowed():
    assert adv_errors(CH4A_OK, 4) == []


def test_adv4_forbids():
    d = 'def greet(name, end="!"):\n    return name + end\nprint(greet("a"))'
    assert has(shape_errors(d, 4), "DefaultArg")       # 4-2 같은 본 과정
    assert has(shape_errors(d, 15), "DefaultArg")
    assert has(adv_errors(d, 3), "FunctionDef")
    r = "def f(n):\n    if n == 0:\n        return 0\n    return f(n - 1)\nprint(f(3))"
    assert has(shape_errors(r, 4), "Recursion")
    assert has(shape_errors(r, 17), "Recursion")
    assert has(adv_errors(r, 3), "FunctionDef")
    assert has(adv_errors("def f(x=[]):\n    return x\nprint(f())", 7), "DefaultArg")   # 바뀌는 기본값 금지
    assert has(adv_errors("def f(x=len('ab')):\n    return x\nprint(f())", 4), "DefaultArg")


def test_keyword_call_to_own_function_is_main_rule():
    assert shape_errors("def f(a, b):\n    return a - b\nprint(f(b=1, a=3))", 4) == []


# 5장 심화: for…else / while…else (중첩 반복·break·continue는 본 과정 5장부터)
CH5A_OK = """for i in range(2, 4):
    for j in range(1, 3):
        print(i * j, end=" ")
    print()
n = 7
for d in range(2, n):
    if n % d == 0:
        break
else:
    print("소수")"""


def test_adv5_allowed():
    assert adv_errors(CH5A_OK, 5) == []


def test_adv5_forbids():
    assert has(shape_errors(CH5A_OK, 5), "LoopElse")
    assert has(shape_errors("n = 0\nwhile n < 2:\n    n += 1\nelse:\n    print(n)", 10), "LoopElse")
    assert has(adv_errors(CH5A_OK, 4), "For")
    nested = "for i in range(2):\n    for j in range(2):\n        if j:\n            continue\n        print(i, j)"
    assert shape_errors(nested, 5) == []


# 6장 심화: 서식 고급(채우기·정렬)은 1장 심화부터 누적, 문자열 메서드는 본 과정 6장부터
CH6A_OK = ('s = "ria"\nprint(s.center(7, "*"))\nprint(s.ljust(5) + "|", s.rjust(4))\n'
           'print("7".zfill(3), s.title())\nprint(f"{s:*^9}", "-".join("abc"))')


def test_adv6_allowed():
    assert adv_errors(CH6A_OK, 6) == []


def test_adv6_forbids():
    assert has(shape_errors(CH6A_OK, 6), "FormatSpec")
    assert has(adv_errors("f = lambda x: x\nprint(f(1))", 6), "Lambda")
    assert has(adv_errors('print([c for c in "ab"])', 6), "ListComp")


# ── 심화 레슨 묶음(장 파일의 ADVANCED) — 임시 폴더의 작은 장 파일로 ────────────
def _lesson(lid, ch, code, out, concept, require, adv=True):
    choice = {"type": "choice", "concept": concept, "q": "이 코드의 출력은?", "code": code,
              "options": [out, "오류", "아무것도 안 나옴"], "answer": 0, "explain": "실행하면 이렇게 나와요."}
    write = {"type": "write", "concept": concept, "task": "카드처럼 코드를 써서 같은 출력을 내 봐요.",
             "starter": "", "tests": [{"stdin": "", "expect": out, "public": True}], "require": require,
             "hints": ["문제를 다시 읽어 봐요.", "카드에서 본 방법을 떠올려요.", "출력 모양을 먼저 정해요.", "___"],
             "solution": code, "explain": "잘했어요."}
    check = dict(choice, type="check")
    lesson = {"id": lid, "chapter": ch, "title": "한 걸음 더", "goal": "심화 문법을 써 봐요",
              "summary": ["하나", "둘", "셋"],
              "cards": [{"say": "한 걸음 더 가 봐요.", "code": code, "out": out}],
              "items": [dict(choice) for _ in range(4)] + [write, check]}
    if adv:
        lesson["isAdvanced"] = True
    return lesson


MATCH3 = 'x = "라테"\nmatch x:\n    case "아메리카노" | "라테":\n        print("커피")\n    case _:\n        print("기타")'
DEF4 = 'def tag(s, mark="!"):\n    return s + mark\nprint(tag("안녕"))'


def _fixture_module(ch, advanced):
    """임시 폴더에 chN.js를 써서 실제 앱과 같은 방식(node import)으로 읽는다."""
    d = _tempfile.mkdtemp()
    path = os.path.join(d, "ch%d.js" % ch)
    with open(path, "w", encoding="utf-8") as f:
        f.write("export const CHAPTER = { id: %d, title: \"시험\" };\nexport const LESSONS = [];\n" % ch)
        f.write("export const ADVANCED = %s;\n" % _json.dumps(advanced, ensure_ascii=False))
    return content.load_modules([path])[path]


def _concepts():
    c = {"print": 1, "if": 3, "def": 4}
    c.update({k: content.AdvancedChapter(v) for k, v in (("match", 3), ("defaultarg", 4), ("fmtspec", 1))})
    return c


def _adv_errors_of(mod, ch):
    file_errs, reps = content.check_advanced(mod.get("ADVANCED"), ch, _concepts())
    return file_errs, {r.label: r.errors for r in reps}


def test_adv_fixture_ch3_match_lesson_passes():
    adv = [_lesson("3-A%d" % k, 3, MATCH3, "커피", "match", ["Match"]) for k in (1, 2, 3)]
    file_errs, errs = _adv_errors_of(_fixture_module(3, adv), 3)
    assert file_errs == [] and errs == {"3-A1": [], "3-A2": [], "3-A3": []}, (file_errs, errs)


def test_adv_fixture_match_leaks_into_main_lesson_3_4():
    rep = Lesson("3-4")
    content.check_lesson(rep, _lesson("3-4", 3, MATCH3, "커피", "if", ["Match"], adv=False), 3, 4, _concepts())
    assert has(rep.errors, "Match")


def test_adv_fixture_advanced_concept_not_in_main_lesson():
    rep = Lesson("3-4")
    content.check_lesson(rep, _lesson("3-4", 3, 'print("a")', "a", "match", [], adv=False), 3, 4, _concepts())
    assert has(rep.errors, "심화 개념")


def test_adv_fixture_ch4_default_arg():
    adv = [_lesson("4-A%d" % k, 4, DEF4, "안녕!", "defaultarg", ["FunctionDef"]) for k in (1, 2, 3)]
    file_errs, errs = _adv_errors_of(_fixture_module(4, adv), 4)
    assert file_errs == [] and all(v == [] for v in errs.values()), errs
    rep = Lesson("4-2")
    content.check_lesson(rep, _lesson("4-2", 4, DEF4, "안녕!", "def", ["FunctionDef"], adv=False), 4, 2, _concepts())
    assert has(rep.errors, "DefaultArg")
    # 3장 심화에서는 아직(함수는 4장)
    adv3 = [_lesson("3-A%d" % k, 3, DEF4, "안녕!", "if", []) for k in (1, 2, 3)]
    _, errs = _adv_errors_of(_fixture_module(3, adv3), 3)
    assert has(errs["3-A1"], "FunctionDef")


def test_adv_fixture_shape_errors():
    good = _lesson("3-A1", 3, MATCH3, "커피", "match", ["Match"])
    file_errs, _ = content.check_advanced([good], 3, _concepts())
    assert has(file_errs, "3개")
    bad_id = dict(good, id="3-A9")
    no_flag = {k: v for k, v in good.items() if k != "isAdvanced"}
    no_flag["id"] = "3-A2"
    exam = dict(good, id="3-A3", isExam=True)
    _, reps = content.check_advanced([bad_id, no_flag, exam], 3, _concepts())
    e = {i: r.errors for i, r in enumerate(reps)}
    assert has(e[0], "3-A1") and has(e[1], "isAdvanced") and has(e[2], "isExam"), e
    # 뒤 장 심화 개념은 쓸 수 없음
    later = [_lesson("1-A%d" % k, 1, 'print("가")', "가", "match", []) for k in (1, 2, 3)]
    _, reps = content.check_advanced(later, 1, _concepts())
    assert has(reps[0].errors, "3장 개념")
    # 본 과정 레슨에 isAdvanced를 두면 오류
    rep = Lesson("3-4")
    content.check_lesson(rep, _lesson("3-4", 3, 'print("a")', "a", "if", [], adv=True), 3, 4, _concepts())
    assert has(rep.errors, "isAdvanced")


def test_adv_fixture_lambda_forbidden_in_6_a1():
    code = 'f = lambda s: s.upper()\nprint(f("ab"))'
    adv = [_lesson("6-A%d" % k, 6, code, "AB", "fmtspec", []) for k in (1, 2, 3)]
    _, errs = _adv_errors_of(_fixture_module(6, adv), 6)
    assert has(errs["6-A1"], "Lambda")


def test_adv_write_time_guard():
    slow = "n = 0\nwhile n < 300000:\n    n += 1\nprint(n)"
    it = _lesson("5-A1", 5, slow, "300000", "print", [])["items"][4]
    old = content.ADV_RUN_SECONDS
    try:
        content.ADV_RUN_SECONDS = 0.001
        rep = Lesson("t")
        check_write(rep, "w", it, content.AdvancedChapter(5))
        assert has(rep.errors, "초 안에"), rep.errors
        rep = Lesson("t")
        check_write(rep, "w", it, 5)    # 본 과정에는 이 제한이 없음
        assert not has(rep.errors, "초 안에")
    finally:
        content.ADV_RUN_SECONDS = old


def test_adv_write_recursion_depth_guard():
    deep = "def f(n):\n    if n == 0:\n        return 0\n    return 1 + f(n - 1)\nprint(f(%d))"
    it = _lesson("4-A2", 4, deep % 400, "400", "print", [])["items"][4]
    rep = Lesson("t")
    check_write(rep, "w", it, content.AdvancedChapter(4))
    assert has(rep.errors, "재귀"), rep.errors
    it = _lesson("4-A2", 4, deep % 30, "30", "print", [])["items"][4]
    rep = Lesson("t")
    check_write(rep, "w", it, content.AdvancedChapter(4))
    assert rep.errors == [], rep.errors


def test_advanced_file_errors():
    assert content.advanced_file_errors([1, 2, 3], 3) == []
    assert content.advanced_file_errors([1, 3], 3) != []
    assert content.advanced_file_errors([1, 2], None) == []


def test_concepts_v07_advanced():
    path = content.CONCEPTS_FILE
    cs = content.load_modules([path])[path]["CONCEPTS"]
    adv = {c["id"]: c["chapter"] for c in cs if c.get("advanced") is True}
    for cid in ("fmtspec", "multiline", "floaterr", "divmod", "condsimple", "match", "defaultarg",
                "recursion", "nestedloop", "loopelse", "strfmt", "strmore"):
        assert cid in adv, cid
    assert all(1 <= ch <= 6 for ch in adv.values())
    ids = [c["id"] for c in cs]
    assert len(ids) == len(set(ids))


def test_adv_main_reads_advanced_from_chapter_file():
    """임시 폴더에 실제 ch1.js + ADVANCED(1장 심화 서식 지정자)를 두고 main()을 돌린다."""
    import io as _io
    import contextlib as _ctx
    d = _tempfile.mkdtemp()
    src = os.path.join(content.LESSON_DIR, "ch1.js")
    code = 'print(f"{3.14159:.2f}")'
    adv = [_lesson("1-A%d" % k, 1, code, "3.14", "fmtspec", ["JoinedStr"]) for k in (1, 2, 3)]
    with open(src, encoding="utf-8") as f:
        text = f.read()
    # 실제 ch1.js에 이미 ADVANCED가 있으면 떼어 낸다(이 시험은 실제 심화 내용과 무관해야 함)
    start = text.find("\nexport const ADVANCED")
    if start >= 0:
        nxt = text.find("\nexport ", start + 1)
        text = text[:start] + ("\n" + text[nxt:] if nxt >= 0 else "\n")
    with open(os.path.join(d, "ch1.js"), "w", encoding="utf-8") as g:
        g.write(text + "\nexport const ADVANCED = %s;\n" % _json.dumps(adv, ensure_ascii=False))
    old = content.LESSON_DIR
    try:
        content.LESSON_DIR = d
        out = _io.StringIO()
        with _ctx.redirect_stdout(out):
            code_ok = content.main(["--advanced", "1"])
        assert code_ok == 0, out.getvalue()[-800:]
        assert "1-A3" in out.getvalue() and "심화: 레슨 3개" in out.getvalue()
        # 같은 코드를 1장 본 과정에 두면 오류(FormatSpec — f-문자열 자체는 v0.7.1부터 1장 본 과정에서 허용)
        assert has(shape_errors(code, 1), "FormatSpec")
    finally:
        content.LESSON_DIR = old


# ── v0.7.1 기초 보강(설계 2절): 심화의 디딤돌을 본 과정 그 장부터 허용 ─────────────
def test_v071_fstring_plain_ok_in_ch1_main():
    assert shape_errors('print(f"{3 * 4}개")', 1) == []
    assert shape_errors('print(f"합계 {1000 + 500}원")', 1) == []


def test_v071_fstring_spec_still_advanced_only_in_main():
    for code in ('print(f"{3.14159:.2f}")', 'print(f"{4500:,}")', "print(f\"{'커피':>6}\")"):
        e = shape_errors(code, 1)
        assert has(e, "FormatSpec") and has(e, "심화"), (code, e)
    assert has(shape_errors('x = 5\nprint(f"{x:>3}")', 6), "FormatSpec")


def test_v071_fstring_ch1_still_no_variables():
    assert has(shape_errors('x = 3\nprint(f"{x}")', 1), "Assign")


def test_v071_round_gated_at_ch2():
    assert has(shape_errors("print(round(3.14159, 2))", 1), "round()")
    assert shape_errors("x = 0.1 + 0.2\nprint(x, round(x, 1))\nprint(round(2.5))", 2) == []


def test_v071_keyword_args_to_own_function_ch4():
    code = "def price(won, n):\n    return won * n\n\nprint(price(won=5000, n=2))\nprint(price(3000, n=1))"
    assert shape_errors(code, 4) == []


def test_v071_default_params_still_advanced_only():
    e = shape_errors('def price(won, n=1):\n    return won * n\nprint(price(5000))', 4)
    assert has(e, "DefaultArg") and has(e, "심화")


def test_v071_print_end_gated_at_ch5():
    for ch in (1, 2, 3, 4):
        e = shape_errors('print("가", end=" ")\nprint("나")', ch)
        assert has(e, "PrintEnd"), (ch, e)
    assert shape_errors('for i in range(3):\n    print(i, end=" ")\nprint()', 5) == []
    assert shape_errors('for r in range(2):\n    for c in range(3):\n        print("*", end="")\n    print()', 5) == []
    assert shape_errors('print("가", end="")', 12) == []


def test_v071_print_other_keywords_rejected():
    e = shape_errors('print("a", "b", sep="-")', 5)
    assert has(e, "sep"), e
    assert has(shape_errors('print("a", flush=True)', 12), "flush")


def test_v071_print_end_ok_in_advanced_from_ch5_only():
    assert adv_errors('for i in range(3):\n    print(i, end=" ")\nelse:\n    print()', 5) == []
    assert has(adv_errors('print("가", end="")', 4), "PrintEnd")


def test_v071_shape_methods_gated_at_ch6():
    code = 's = "7"\nprint(s.zfill(3))\nprint("리아".center(8, "*"))\nprint("a".ljust(3), "b".rjust(3))'
    assert has(shape_errors(code, 5), "Attribute")
    assert shape_errors(code, 6) == []
    assert shape_errors('print("12".zfill(5))', 6) == []


# ── v0.7.1 레슨 칸 updated(「새 내용」 점): "v0.7.1"처럼 판 이름 글자 ───────────
def _updated_errors(value, adv=False):
    lesson = _lesson("1-A2" if adv else "1-2", 1, 'print("a")', "a", "print", [], adv=adv)
    lesson["updated"] = value
    rep = Lesson("1-2")
    content.check_lesson(rep, lesson, content.AdvancedChapter(1) if adv else 1, 2, _concepts())
    return [e for e in rep.errors if "updated" in e]


def test_v071_lesson_updated_ok():
    assert _updated_errors("v0.7.1") == []
    assert _updated_errors("v0.8") == []
    assert _updated_errors("v0.7.1", adv=True) == []


def test_v071_lesson_updated_bad():
    for bad in ("0.7.1", "v0.7.1 ", 71, True, "", None, "v0.7.1a"):
        assert _updated_errors(bad) != [], bad

# ── v0.7.1 판정 C48: 보강 레슨(updated 있음)은 카드 1~3장·터치 문제 ≤7개 ──────
def _size_errors(n_cards, n_touch, updated=None, lid="1-2", pos=2):
    lesson = _lesson(lid, 1, 'print("a")', "a", "print", [], adv=False)
    lesson["cards"] = [dict(lesson["cards"][0]) for _ in range(n_cards)]
    lesson["items"] = [dict(lesson["items"][0]) for _ in range(n_touch)] + lesson["items"][-2:]
    if updated is not None:
        lesson["updated"] = updated
    rep = Lesson(lid)
    content.check_lesson(rep, lesson, 1, pos, _concepts())
    return [e for e in rep.errors if "cards" in e or "터치 문제는" in e]


def test_c48_updated_lesson_allows_3_cards_7_touch():
    assert _size_errors(3, 7, "v0.7.1") == []
    assert _size_errors(2, 6, "v0.7.1") == []


def test_c48_plain_lesson_keeps_2_cards_6_touch():
    assert _size_errors(2, 6) == []
    assert has(_size_errors(3, 5), "cards")
    assert has(_size_errors(2, 7), "터치 문제는 4~6")


def test_c48_updated_lesson_upper_limits():
    assert has(_size_errors(4, 5, "v0.7.1"), "cards")
    assert has(_size_errors(2, 8, "v0.7.1"), "터치 문제는 4~7")
    assert has(_size_errors(0, 5, "v0.7.1"), "cards")



# ── C49: 보강 레슨(updated)만 요약 3~4줄, 나머지는 정확히 3줄 ───────────
def _summary_errors(lines, updated=None):
    lesson = _lesson("1-2", 1, 'print("a")', "a", "print", [])
    lesson["summary"] = lines
    if updated:
        lesson["updated"] = updated
    rep = Lesson("1-2")
    content.check_lesson(rep, lesson, 1, 2, _concepts())
    return [e for e in rep.errors if "summary" in e]


def test_c49_summary_four_lines_only_when_updated():
    four = ["가", "나", "다", "라"]
    assert _summary_errors(four, "v0.7.1") == []
    assert _summary_errors(four) != []
    assert _summary_errors(["가", "나", "다"], "v0.7.1") == []
    assert _summary_errors(["가", "나", "다", "라", "마"], "v0.7.1") != []
    assert _summary_errors(["가", "나"], "v0.7.1") != []

if __name__ == "__main__":
    tests =[(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
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

