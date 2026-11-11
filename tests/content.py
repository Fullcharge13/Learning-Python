#!/usr/bin/env python3
"""레슨 내용 자동 점검 (계획 작업 6, 설계서 4장).

실행: python3 tests/content.py          있는 장(data/lessons/ch*.js)만 점검
      python3 tests/content.py --full N 정확히 1~N장(N×5개 레슨)이 있어야 통과
                                        (N을 빼면 있는 장 파일 수. 장 파일은 늘 1장부터 이어져야 함)
      python3 tests/content.py --advanced N  1~N장 파일에 심화 레슨(ADVANCED)이 모두 있어야 통과
      python3 tests/content.py --templates N 1~N장 파일에 매일 도전 틀(TEMPLATES)이 4개 이상 있어야 통과
                                        (틀은 플래그 없이도 있는 것은 모두 검사: 씨앗 0~99를 실제로 돌려 봄)

데이터는 node로 ES 모듈을 import해 JSON으로 꺼낸다(실행 기록 C8).
코드는 src/py/runner.py의 run()으로 CPython에서 실제로 돌린다(앱의 Pyodide 작업자와 같은 파일).
출력 비교는 src/grade.js normalize()와 같은 규칙(줄 끝 공백·마지막 줄바꿈 무시).

레슨 파일 형식 (data/lessons/chN.js)
    export const CHAPTER = { id: N, title: "…" };
    export const LESSONS = [ { id: "N-1", chapter: N, title, goal, summary: [3줄], isExam?, updated?("v0.7.1"),
                               cards: [{ say, code, out }], items: [...] }, ... ];
    items = 터치 문제(choice/blank/order) 4~6개(장 평가는 4~8개) → write 1개 → check 1개, 이 순서.
    cards는 1~2장. 보강 레슨(updated 있음, 판정 C48)은 카드 1~3장·터치 문제 4~7개(평가는 그대로 4~8개).
    export const ADVANCED = [ { id: "N-A1", chapter: N, isAdvanced: true, … }, N-A2, N-A3 ];  (선택, v0.7)
    심화 레슨은 본 과정 레슨과 모양이 같고(isExam 없음) 규칙은 N장 + ADVANCED_EXTRA[1..N](심화끼리 누적).
아래 ITEM_KEYS가 문제 형태별로 허용하는 칸이다(오타를 잡으려고 모르는 칸은 오류).
카드·choice·blank·order·check는 stdin 칸("\n"으로 나눈 문자열, 판정 C23)을 둘 수 있다. 없으면 "".
카드·choice·check·blank·order·write는 선택 칸 files·server를 둘 수 있다(v0.4 E1·E2, 뜻은 FILES_SERVER_DOC).
write의 시험(tests[i])은 files를 따로 둘 수 있고, 있으면 문제의 files 대신 쓴다.
카드·choice·check·blank·order·write의 시험은 선택 칸 chart를 둘 수 있다(v0.5 E3, 뜻은 CHART_DOC).
카드는 선택 칸 show_only: true를 둘 수 있다(판정 C38, 뜻은 CHART_DOC).
실행 한 번은 RUN_SECONDS초까지만 기다리고, 넘으면 오류로 알린다.
"""

import ast
import io
import itertools
import json
import keyword
import os
import re
import signal
import subprocess
import sys
import time
import tokenize
import unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "src", "py"))
from runner import run  # noqa: E402

LESSON_DIR = os.path.join(ROOT, "data", "lessons")
CONCEPTS_FILE = os.path.join(ROOT, "data", "concepts.js")
LESSONS_PER_CHAPTER = 5
RUN_SECONDS = 5       # 점검기에서 실행 한 번의 제한 시간

# ── 화면·문장 한도 (아이폰 세로, 코드 글자 16px 기준) ──────────────────────
CODE_COLS = 38        # 코드 한 줄 표시 폭(한글 등 넓은 글자는 2칸)
GOAL_MAX = 40         # 학습 목표 한 줄
SUMMARY_MAX = 32      # 요약 한 줄
TITLE_MAX = 16
SAY_MAX = 140         # 개념 카드 말풍선
Q_MAX = 80            # 문제 문장
EXPLAIN_MAX = 160     # 해설
TASK_MAX = 200        # 직접 작성 과제 설명
HINT_MAX = 120

LESSON_KEYS = {"id", "chapter", "title", "goal", "summary", "isExam", "isAdvanced", "cards", "items", "updated"}
# v0.7.1: 보강한 레슨에 updated: "v0.7.1"(판 이름). 이미 끝낸 학습자의 학습 길에 「새 내용」 점이 뜬다
UPDATED_RE = re.compile(r"v\d+\.\d+(\.\d+)?")
CARD_KEYS = {"say", "code", "out"}
ENV_KEYS = {"files", "server"}   # v0.4 가상 파일·연습 서버
CARD_OPT = {"stdin", "chart", "show_only"} | ENV_KEYS
ITEM_KEYS = {
    "choice": ({"type", "concept", "q", "options", "answer", "explain"}, {"code", "stdin"} | ENV_KEYS | {"chart"}),
    "check": ({"type", "concept", "q", "options", "answer", "explain"}, {"code", "stdin"} | ENV_KEYS | {"chart"}),
    "blank": ({"type", "concept", "q", "code", "chips", "answer", "explain"}, {"stdin"} | ENV_KEYS | {"chart"}),
    "order": ({"type", "concept", "q", "lines", "expect", "explain"}, {"stdin"} | ENV_KEYS | {"chart"}),
    "write": ({"type", "concept", "task", "starter", "tests", "require", "hints", "solution", "explain"}, ENV_KEYS),
}
TEST_KEYS = {"stdin", "expect", "public"}
TEST_OPT = {"files", "chart"}

FILES_SERVER_DOC = """
files:  {"memo.txt": "우유\\n빵\\n"}  이름 → 내용(글자). 실행마다 빈 폴더에 이 파일들을 만들고 그 폴더에서 돈다.
        이름은 폴더 없는 파일 이름(/ \\ 없음, .으로 시작하지 않음, 40자 이하). 1~5개.
server: {"https://ria.example/menu": {"status": 200, "body": "…", "type": "text/plain"}}
        주소(http:// 또는 https://) → 응답. status는 100~599 정수, body는 글자, type은 선택(글자).
        실행 동안 urllib.request.urlopen이 이 표로 답한다(표에 없는 주소는 URLError, 400 이상은 HTTPError).
"""
CHART_DOC = """
chart:  {"kind": "bar", "labels": ["사과", "배"], "values": [3, 5], "title"?: "…", "xlabel"?: "…", "ylabel"?: "…"}
        또는 그런 그림 1~3개의 목록(그림 수·차례까지 비교). kind는 "bar"·"line", labels는 글자·숫자 1~24개,
        values는 같은 수의 숫자(true/false 아님). 제목·축 이름은 40자 이하 글자.
        여러 선(v0.9, 17장 심화만): values 대신 "series": [{"name"?: "철수", "values": [...]}, …] 1~3개, kind "line".
                    runner는 꺾은선이 둘 이상이거나 legend를 부르면 이 모양을 준다. 본 과정 레슨에서 나오면 오류.
        write 시험: 정답 코드의 chart.show() 그림과 비교(적힌 칸만, 값은 수로 3 == 3.0, 이름은 글자로).
                    출력과 그림을 둘 다 맞혀야 통과. 정답이 그림을 그리면 chart를 꼭 적는다.
        카드·터치 문제: 실행하지 않고 이 그림을 화면에 보여 준다. 점검기는 코드를 돌린 그림과 같은지 본다.
                    카드 코드가 그림을 그리면 chart를 꼭 적는다(안 적으면 학습자가 그림을 못 봄).
show_only: true (카드만) — 코드를 보여 주기만 하고 돌리지 않는다(matplotlib 비교 카드 등).
        점검기는 실행·문법·모듈 검사를 건너뛰고 줄 폭만 본다. out은 없거나 ""이어야 하고,
        stdin·files·server·chart는 함께 쓰지 않는다. 화면에는 「실제 컴퓨터용 코드(여기서는 실행 안 함)」.
"""
CHART_KEYS = {"kind", "labels", "values"}
CHART_OPT = {"title", "xlabel", "ylabel"}
CHART_LINES_MAX = 3   # v0.9: 17장 심화 한 그림의 꺾은선 수(runner CHART_LINES_MAX)
SERIES_KEYS, SERIES_OPT = {"values"}, {"name"}
CHART_KINDS = {"bar": "막대 그래프", "line": "꺾은선 그래프"}
CHART_MAX = 3
CHART_POINTS_MAX = 24
CHART_TEXT_MAX = 40
FILES_MAX = 5
FILE_NAME_MAX = 40
SERVER_MAX = 8
RESPONSE_KEYS = {"status", "body"}
RESPONSE_OPT = {"type"}
TOUCH = {"choice", "blank", "order"}

# ── 장마다 아직 배우지 않은 문법 막기 ─────────────────────────────────────
# 레슨 코드(카드·문제·정답·시작 코드)에서 문법 오류 없이 읽히는 것만 검사한다.
# FORBID_ALL: 장 표에 없는 장의 기본값(가장 엄격). 반복문·함수 정의·import·목록/사전·예외 처리 등.
# "ForNonRange"는 ast 마디가 아닌 가짜 이름: range(…)가 아닌 것(문자열, split() 결과)을 for로 도는 것.
# "ForTupleTarget"도 가짜 이름: for의 대상 자리에서만 튜플로 풀기(for k, v in d.items():). 튜플 일반은 9장.
# "PrintEnd"도 가짜 이름: print(…, end="…"). 5장부터(v0.7.1). print의 다른 이름 붙은 인자(sep 등)는 언제나 금지.
FORBID_ALL = {
    "For", "While", "FunctionDef", "AsyncFunctionDef", "Lambda", "ClassDef", "Import", "ImportFrom",
    "List", "Dict", "Set", "Tuple", "ListComp", "DictComp", "SetComp", "GeneratorExp",
    "Try", "With", "Return", "Yield", "Global", "Nonlocal", "Delete", "Assert", "Raise", "Match",
    "ForNonRange", "Slice", "ForTupleTarget", "PrintEnd",
}
# 장마다 새로 허용하는 것만 적는다. 뒤 장은 앞 장이 허용한 것을 모두 허용한다(누적).
#   allow: 금지에서 빼는 문법, calls: 새로 부를 수 있는 내장 함수, names: None이면 이름 제한 해제
CHAPTER_RULES = {
    # 1장: 변수·조건·비교 없음. 이름은 print 하나만, 메서드·인덱싱 없음.
    #      f-문자열은 1장부터(v0.7.1, 1-2 보강): f"{3 * 4}개"처럼 {} 안에 값·계산만. 서식 지정자(:.2f)는 심화 전용
    1: {"forbid": FORBID_ALL | {"Assign", "AugAssign", "AnnAssign", "NamedExpr", "If", "IfExp", "Compare",
                                "BoolOp", "Attribute", "Subscript"},
        "names": {"print"}, "calls": {"print"}},
    # 2장: 변수·표현식·입력. (v0.2: Attribute·Subscript는 6장으로 옮김 — 인덱스·메서드는 6장에서 처음 배움)
    #      round(x)·round(x, n)은 2장부터(2-2 보강). +=·-=(AugAssign)는 v0.9부터 5장(5-1 보강)
    2: {"allow": {"Assign", "AnnAssign", "NamedExpr", "Compare", "BoolOp"},
        "names": None, "calls": {"input", "int", "float", "str", "bool", "type", "round"}},
    3: {"allow": {"If", "IfExp"}, "calls": {"len", "abs", "max", "min"}},
    # 4장: 내 함수 정의·부르기. 부를 때 이름 붙여 넘기기 f(won=5000)도 됨(4-3). 기본값 매개변수는 심화 전용
    4: {"allow": {"FunctionDef", "Return"}, "calls": {"len", "max", "min", "abs", "round"}},
    # 5장: for는 range(…)만 돈다. 반복 안의 반복, print(…, end=" ")(5-2 보강), n += 1·n -= 1(v0.9, 5-1 보강)
    5: {"allow": {"For", "While", "PrintEnd", "AugAssign"}, "calls": {"range"}},
    # 6장: 인덱스·슬라이싱·문자열 메서드(s.upper(), zfill·center·ljust·rjust 등), 문자열·split() 결과를 for로 돌기
    6: {"allow": {"Attribute", "Subscript", "Slice", "ForNonRange"}, "calls": {"len"}},
    # 7장: 리스트 리터럴, 메서드(append·remove·pop·sort·index·insert — 메서드는 6장부터 Attribute로 허용),
    #      cart[0] = … 로 바꾸기(Subscript는 6장부터). 컴프리헨션은 계속 금지.
    7: {"allow": {"List"}, "calls": {"sorted", "sum", "list"}},
    # 8장: 딕셔너리 리터럴, get·keys·values·items, in. 튜플은 for k, v in d.items(): 의 풀기만.
    8: {"allow": {"Dict", "ForTupleTarget"}},
    # 9장: 튜플 리터럴·묶고 풀기 전부, 집합 리터럴, 교집합 & · 합집합 | · 차집합 -
    9: {"allow": {"Tuple", "Set"}, "calls": {"set", "tuple"}},
    # 10장: try/except/else/finally, raise. raise ValueError("…")처럼 오류를 만들어 부르는 것도 허용
    10: {"allow": {"Try", "Raise"},
         "calls": {"Exception", "ValueError", "TypeError", "ZeroDivisionError", "IndexError", "KeyError"}},
    # 11장: with, open()(모드 "r"·"w"·"a"만), 파일 메서드 read·readline·readlines·write·close,
    #       for line in f. import는 이 장부터지만 modules에 적은 모듈만(장마다 누적).
    11: {"allow": {"With", "Import", "ImportFrom"}, "calls": {"open"}, "modules": {"csv"}},
    12: {"modules": {"re"}},                                              # 정규표현식, r"…"
    13: {"modules": {"urllib.request", "urllib.parse", "urllib.error"}},  # 연습 서버(E2)
    14: {"modules": {"json"}},
    # 15장: class(사용자 클래스 하나만 물려받기, metaclass·데코레이터 없음), 메서드와 self,
    #       특수 메서드는 __init__만(check_classes, v0.9: __str__·__eq__는 15장 심화), super().__init__(…), isinstance(…).
    15: {"allow": {"ClassDef"}, "calls": {"isinstance", "super"}},
    # 16장: sqlite3.connect(":memory:")만(check_sqlite). SQL 글 자체는 검사하지 않음.
    16: {"modules": {"sqlite3"}},
    # 17장: 앱 모듈 chart(E3, matplotlib.pyplot과 같은 이름). max·min·round는 앞 장에서 허용됨.
    17: {"modules": {"chart"}},
}
# import한 모듈에서 쓸 수 있는 이름(모듈.이름 또는 from 모듈 import 이름). 모르는 이름은 오류.
MODULE_MEMBERS = {
    "csv": {"reader", "writer"},
    "re": {"search", "match", "fullmatch", "findall", "sub", "split", "compile"},
    "urllib.request": {"urlopen", "Request"},
    "urllib.parse": {"urlencode", "quote", "unquote", "urlparse", "parse_qs"},
    "urllib.error": {"HTTPError", "URLError"},
    "json": {"loads", "dumps", "dump", "load"},   # dump·load(파일)는 14장 심화 전용(ADVANCED_MEMBERS)
    "sqlite3": {"connect"},
    "chart": {"bar", "line", "title", "xlabel", "ylabel", "show", "legend"},   # legend는 17장 심화 전용
}
OPEN_MODES = ("r", "w", "a")
# 이름 붙은 인자(키워드)를 제한하는 함수: 함수 → 쓸 수 있는 키워드
CALL_KWARGS = {
    "open": {"mode", "encoding", "newline"},
    "json.dumps": {"ensure_ascii", "indent", "sort_keys"},
    "json.loads": set(),
    "json.dump": {"ensure_ascii", "indent", "sort_keys"},
    "json.load": set(),
    "sqlite3.connect": set(),
    **{"chart." + n: set() for n in ("bar", "line", "title", "xlabel", "ylabel", "show", "legend")},
}
# 15장: 클래스 안에 정의할 수 있는 특수 메서드, 점 뒤에 쓸 수 있는 __이름__ (본 과정)
CLASS_DUNDERS = {"__init__"}
# 15장 심화(v0.9)가 더 여는 특수 메서드 → 가짜 문법 이름(ADVANCED_ONLY). 그 밖의 __이름__은 심화에서도 금지
ADVANCED_DUNDERS = {"__str__": "DunderStr", "__eq__": "DunderEq"}
# 16장: sqlite3.connect(…) 결과(연결)와 그 cursor()/execute(…) 결과(커서)에 쓸 수 있는 메서드
DB_METHODS = {"execute", "executemany", "fetchall", "fetchone", "commit", "close", "cursor"}
DB_MEMORY = ":memory:"


def _build_tables(rules):
    forbid, names, calls, modules = {}, {}, {}, {}
    cur_forbid, cur_names, cur_calls, cur_mods = set(FORBID_ALL), set(), set(), set()
    for ch in sorted(rules):
        r = rules[ch]
        if "forbid" in r:
            cur_forbid = set(r["forbid"])
        cur_forbid = cur_forbid - set(r.get("allow", ()))
        if "names" in r:
            cur_names = None if r["names"] is None else set(r["names"])
        cur_calls = cur_calls | set(r.get("calls", ()))
        cur_mods = cur_mods | set(r.get("modules", ()))
        forbid[ch], names[ch], calls[ch], modules[ch] = set(cur_forbid), cur_names, set(cur_calls), set(cur_mods)
    return forbid, names, calls, modules


FORBID_BY_CHAPTER, NAMES_BY_CHAPTER, CALLS_BY_CHAPTER, MODULES_BY_CHAPTER = _build_tables(CHAPTER_RULES)
INPUT_FROM_CHAPTER = 2  # input()은 2장부터

# ── 심화 레슨(v0.7, 설계서 「심화학습」 1절) ─────────────────────────────────
# 심화 N-Ak = N장까지의 본 과정 규칙 + ADVANCED_EXTRA[1..N](심화끼리 누적).
# ADVANCED_ONLY는 심화에서만 여는 문법이라 본 과정 레슨에서는 모든 장에서 금지한다(본 과정만 하는 학습자).
# ast 마디가 아닌 가짜 이름(advanced_features가 찾음):
#   FormatSpec   f"{x:>8}"처럼 f-문자열의 서식 지정자(: 뒤). 지정자 안의 {…}(FormatSpecNested)는 늘 금지
#   TripleQuote  """…"""·'''…''' 여러 줄 문자열
#   DivmodUnpack q, r = divmod(a, b) 풀기만(튜플 일반은 9장). 마디로 알리지 않고 Tuple 금지에서 빼 주기만 함
#   DefaultArg   def f(x, end="!"): 기본값(숫자·문자열·True/False/None 상수만)
#   Recursion    함수가 자기 자신을 부름
#   LoopElse     for…else / while…else
#   Reraise      except 안의 맨 raise(다시 던지기, v0.8). raise ValueError(…)는 본 과정 10장. raise … from …은 늘 금지
#   CsvWriter    csv.writer(+ writerow·writerows, v0.8). 본 과정 11장은 csv.reader만(check_imports가 알림)
#   RegexNamedGroup  re를 들여온 코드에서 글자 상수 안의 (?P<…>, m.group("이름")(글자 인자), .groupdict() (v0.8)
#   RegexBackref     re를 들여온 코드에서 글자 상수 안의 \1~\9·\g<…>·(?P=…) — 바꿀 글·패턴 어디든 (v0.8)
#                    패턴을 변수에 담아 넘겨도 잡도록 re.* 인자만이 아니라 그 코드의 모든 글자 상수를 본다
# Match는 ast 마디. 쓸 수 있는 패턴: 글자·숫자·None/True/False 값, | 여러 값, _ 나머지(check_match).
# ListComp·Lambda도 ast 마디(v0.8): 본 과정에서는 어느 장에서도 금지라 「심화 전용」 안내가 나가게 여기 넣는다.
#   ListComp  for 하나, if는 0~1개, 컴프리헨션 안에 컴프리헨션 없음(2차원은 [[0] * 3 for r in range(2)]).
#             DictComp·SetComp·GeneratorExp(sum(x for …))는 가르치지 않아 심화에서도 늘 금지
#   Lambda    함수에 넘기는 자리(sorted(…, key=lambda p: p[1]))에서만. 이름에 담기(f = lambda …)·return 금지
#   JsonFile     json.dump(d, f)·json.load(f) 파일로 쓰고 읽기(v0.9). 본 과정 14장은 dumps·loads만
#   DunderStr·DunderEq  클래스 안 __str__·__eq__ 정의 또는 점 뒤 쓰기(v0.9, check_classes). 본 과정 15장은 __init__만
#   ChartMulti   chart.legend(…)(v0.9). 한 그림에 선 여럿은 실행 결과(series)로 잡는다(check_main_charts)
ADVANCED_ONLY = {"FormatSpec", "TripleQuote", "DivmodUnpack", "DefaultArg", "Recursion", "LoopElse", "Match",
                 "ListComp", "Lambda", "Reraise", "CsvWriter", "RegexNamedGroup", "RegexBackref",
                 "JsonFile", "DunderStr", "DunderEq", "ChartMulti"}
ADVANCED_EXTRA = {
    # 1장 심화: 자릿수·정렬(f"{3.14159:.2f}", f"{'커피':>6}") — 변수는 아직이라 상수만. 여러 줄 문자열
    #           (f-문자열 자체는 v0.7.1부터 본 과정 1장에서 허용)
    1: {"allow": {"FormatSpec", "TripleQuote"}},
    # 2장 심화: round(2장부터 있음)로 실수 오차 다루기, divmod와 그 결과 풀기
    2: {"allow": {"DivmodUnpack"}, "calls": {"divmod"}},
    # 3장 심화: match(값 패턴만). 조건 묶기(and·or, 3 < x < 7, … if … else …)는 본 과정 3장부터 허용됨
    3: {"allow": {"Match"}},
    # 4장 심화: 기본값 매개변수, 재귀. 내 함수에 이름 붙은 인자(f(b=1))는 본 과정 4장부터 허용됨
    4: {"allow": {"DefaultArg", "Recursion"}},
    # 5장 심화: for…else·while…else. 중첩 반복·break·continue는 본 과정 5장부터 허용됨
    5: {"allow": {"LoopElse"}},
    # 6장 심화: 새 문법 없음. center·ljust·rjust·zfill·count·title 등 메서드는 본 과정 6장부터(Attribute),
    #           채우기·정렬 서식(f"{s:*^9}")은 1장 심화의 FormatSpec으로 이미 열림
    6: {},
    # 7장 심화(v0.8): 리스트 컴프리헨션 [식 for x in a if 조건] (모양 제한은 ADVANCED_ONLY 주석)
    7: {"allow": {"ListComp"}},
    # 8장 심화: 새 문법 없음(묶음 세기·딕셔너리 안 리스트는 본 과정 8장 문법으로 씀)
    8: {},
    # 9장 심화: lambda(넘기는 자리에서만). 집합 ^·<=·discard는 본 과정 9장 문법(BinOp·Compare·메서드)
    9: {"allow": {"Lambda"}},
    # 10장 심화: 맨 raise로 다시 던지기(except 안). raise ValueError(f"…")는 본 과정 10장
    10: {"allow": {"Reraise"}},
    # 11장 심화: csv.writer(f) → writerow·writerows. 여러 파일 합치기는 본 과정 11장 문법
    11: {"allow": {"CsvWriter"}},
    # 12장 심화: 이름 붙인 묶음 (?P<이름>…)·m.group("이름")·groupdict(), 묶음 참조 \1·\g<이름>
    12: {"allow": {"RegexNamedGroup", "RegexBackref"}},
    # 13장 심화(v0.9): 새 문법 없음(쿼리 붙이기·상태 코드·쪽 번호 반복은 본 과정 13장 문법).
    #           urlencode·quote는 MODULE_MEMBERS로 본 과정 13장부터 이미 허용
    13: {},
    # 14장 심화: json.dump(d, f)·json.load(f) — 파일로 쓰고 읽기(csv.writer와 같은 선례)
    14: {"allow": {"JsonFile"}},
    # 15장 심화: __str__·__eq__. 클래스 속성(Book.count = Book.count + 1)은 본 과정 15장 문법
    15: {"allow": {"DunderStr", "DunderEq"}},
    # 16장 심화: 새 문법 없음(JOIN·HAVING은 SQL 글이라 점검기가 보지 않음 — require SQL:JOIN으로 채점)
    16: {},
    # 17장 심화: 한 그림에 꺾은선 여럿(최대 3개) + chart.legend([...])
    17: {"allow": {"ChartMulti"}},
}
# 모듈 이름 중 심화에서만 여는 것: "모듈.이름" → 가짜 문법 이름(ADVANCED_ONLY)
ADVANCED_MEMBERS = {"csv.writer": "CsvWriter", "json.dump": "JsonFile", "json.load": "JsonFile",
                    "chart.legend": "ChartMulti"}
ADV_RUN_SECONDS = 1.0       # 심화 직접 작성: 정답이 시험마다 이 시간 안에 끝나야 함(앱 제한 3초의 여유)
ADV_RECURSION_DEPTH = 100   # 심화 재귀 정답이 쓸 수 있는 깊이(Pyodide 스택 여유)


class AdvancedChapter(int):
    """심화 레슨의 장 번호. int처럼 쓰되(비교·%d·표 찾기), 점검기가 심화 규칙을 고르게 한다.
    concepts 표에서는 심화 개념의 장을 이것으로 담는다(본 과정 레슨에서 못 쓰게)."""


def _build_adv_tables():
    forbid, calls = {}, {}
    allow, extra_calls = set(), set()
    for ch in range(1, max(max(CHAPTER_RULES), max(ADVANCED_EXTRA)) + 1):
        r = ADVANCED_EXTRA.get(ch, {})
        allow |= set(r.get("allow", ()))
        extra_calls |= set(r.get("calls", ()))
        base = FORBID_BY_CHAPTER.get(ch, FORBID_ALL)
        forbid[ch] = (set(base) | ADVANCED_ONLY) - allow
        calls[ch] = set(CALLS_BY_CHAPTER.get(ch, set())) | extra_calls
    return forbid, calls


MAIN_FORBID_BY_CHAPTER = {ch: set(f) | ADVANCED_ONLY for ch, f in FORBID_BY_CHAPTER.items()}
ADV_FORBID_BY_CHAPTER, ADV_CALLS_BY_CHAPTER = _build_adv_tables()
ADVANCED_PER_CHAPTER = 3

# 앱이 채우는 자리 표시가 그대로 남은 것만 막는다(f-문자열 예시의 { }는 허용, 판정 C23).
PLACEHOLDER = re.compile(r"\{(name|streak|xp|outfit|line|seconds|type)\}")
HANGUL = re.compile(r"[가-힣]")


# ── 도구 ────────────────────────────────────────────────────────────────
def normalize(text):
    """src/grade.js normalize()와 같은 규칙."""
    if text is None:
        return ""
    s = str(text).replace("\r\n", "\n").replace("\r", "\n")
    s = "\n".join(line.rstrip() for line in s.split("\n"))
    return s.rstrip("\n")


def width(line):
    return sum(2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1 for ch in line)


def load_modules(paths):
    """ES 모듈 여러 개를 node로 import해 {경로: 내보낸 값} 을 돌려준다."""
    script = (
        "const paths = JSON.parse(process.argv[1]); const out = {};"
        "for (const p of paths) { out[p] = { ...(await import('file://' + p)) }; }"
        "process.stdout.write(JSON.stringify(out));"
    )
    r = subprocess.run(
        ["node", "--input-type=module", "-e", script, json.dumps(paths)],
        capture_output=True, text=True, cwd=ROOT,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or "node 실행 실패")
    return json.loads(r.stdout)


def _is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and v not in (float("inf"), float("-inf"))


def same_number(a, b):
    """src/chart.js sameNumber와 같은 규칙: 3 == 3.0, 아주 작은 소수 오차는 같음"""
    if not _is_num(a) or not _is_num(b):
        return False
    return abs(a - b) <= 1e-9 * max(1, abs(a), abs(b))


def _lines_of(c):
    """src/chart.js linesOf: series가 있으면 그것, 아니면 values 하나짜리 선 목록"""
    if isinstance(c.get("series"), list):
        return [x if isinstance(x, dict) else {} for x in c["series"]]
    return [{"values": c.get("values") if isinstance(c.get("values"), list) else []}]


def _chart_one(exp, got):
    if exp.get("kind") is not None and exp.get("kind") != got.get("kind"):
        return "그래프 종류가 달라요(기대: %s)" % CHART_KINDS.get(exp["kind"], exp["kind"])
    if exp.get("labels") is not None:
        a, b = [str(x) for x in exp["labels"]], [str(x) for x in got.get("labels") or []]
        if a != b:
            return "그래프 이름(가로축 항목)이 달라요"
    if exp.get("values") is not None or exp.get("series") is not None:
        es, gs = _lines_of(exp), _lines_of(got)

        def same_vals(a, b):
            return len(a) == len(b) and all(same_number(x, y) for x, y in zip(a, b))

        def name_differs(e, g):
            return e.get("name") is not None and str(e["name"]).strip() != str(
                g.get("name") if g.get("name") is not None else "").strip()

        if len(es) == 1 and len(gs) == 1:
            if name_differs(es[0], gs[0]):
                return "선 이름이 달라요"
            if not same_vals(es[0].get("values") or [], gs[0].get("values") or []):
                return "그래프 값이 달라요"
        elif len(es) != len(gs):
            return "선 개수가 달라요(기대 %d개, 내 코드 %d개)" % (len(es), len(gs))
        else:
            for i, (e, g) in enumerate(zip(es, gs)):
                if name_differs(e, g):
                    return "%d번째 선 이름이 달라요" % (i + 1)
                if not same_vals(e.get("values") or [], g.get("values") or []):
                    return "%d번째 선 값이 달라요" % (i + 1)
    for k, msg in (("title", "그래프 제목이 달라요"), ("xlabel", "가로축 이름이 달라요"), ("ylabel", "세로축 이름이 달라요")):
        if exp.get(k) is not None and str(exp[k]).strip() != str(got.get(k) if got.get(k) is not None else "").strip():
            return msg
    return None


def chart_mismatch(expected, charts):
    """src/chart.js chartMismatch와 같은 비교. 맞으면 None, 아니면 학습자에게 보이는 말과 같은 한 줄."""
    want = expected if isinstance(expected, list) else [expected]
    got = charts if isinstance(charts, list) else []
    if not got:
        return "그래프가 그려지지 않았어요. 마지막에 chart.show()를 불렀는지 확인해 봐요"
    if len(got) != len(want):
        return "그래프 개수가 달라요(기대 %d개, 내 코드 %d개)" % (len(want), len(got))
    for i, (w, g) in enumerate(zip(want, got)):
        why = _chart_one(w or {}, g or {})
        if why:
            return "%d번째 %s" % (i + 1, why) if len(want) > 1 else why
    return None


def chart_of(rep, where, obj):
    """chart 칸(없으면 None). 형식이 틀리면 오류를 적고 None."""
    if "chart" not in obj:
        return None
    v = obj["chart"]
    figs = v if isinstance(v, list) else [v]
    if not figs or len(figs) > CHART_MAX:
        rep.err(where, "chart는 그림 객체 하나 또는 1~%d개 목록" % CHART_MAX)
        return None
    ok = True
    multi_keys = CHART_KEYS - {"values"} | {"series"}
    for f in figs:
        if not isinstance(f, dict) or not (CHART_KEYS <= set(f) <= CHART_KEYS | CHART_OPT
                                           or multi_keys <= set(f) <= multi_keys | CHART_OPT):
            rep.err(where, "chart 칸은 kind, labels, values (또는 여러 선이면 values 대신 series)"
                           " + 선택 title, xlabel, ylabel")
            ok = False
            continue
        if f["kind"] not in CHART_KINDS:
            rep.err(where, "chart.kind는 \"bar\" 또는 \"line\"")
            ok = False
        labels = f["labels"]
        if not isinstance(labels, list) or not (1 <= len(labels) <= CHART_POINTS_MAX):
            rep.err(where, "chart.labels는 목록(1~%d개)" % CHART_POINTS_MAX)
            ok = False
            continue
        if "series" in f:
            series = f["series"]
            if f["kind"] != "line":
                rep.err(where, "chart.series(여러 선)는 kind \"line\"에만")
                ok = False
            if not isinstance(series, list) or not (1 <= len(series) <= CHART_LINES_MAX):
                rep.err(where, "chart.series는 선 1~%d개 목록 [{name?, values}, …]" % CHART_LINES_MAX)
                ok = False
                continue
            values = []
            for line in series:
                if not isinstance(line, dict) or not (SERIES_KEYS <= set(line) <= SERIES_KEYS | SERIES_OPT):
                    rep.err(where, "chart.series의 선 하나는 {values, name?}")
                    ok = False
                    continue
                if "name" in line and (not isinstance(line["name"], str) or not line["name"].strip()
                                       or len(line["name"]) > CHART_TEXT_MAX):
                    rep.err(where, "chart.series의 name은 비어 있지 않은 글자(%d자 이하)" % CHART_TEXT_MAX)
                    ok = False
                if not isinstance(line["values"], list) or len(line["values"]) != len(labels):
                    rep.err(where, "chart.series의 values는 labels와 같은 길이의 목록")
                    ok = False
                    continue
                values = values + line["values"]
        else:
            values = f["values"]
            if not isinstance(values, list) or len(labels) != len(values):
                rep.err(where, "chart.labels와 chart.values는 같은 길이의 목록(1~%d개)" % CHART_POINTS_MAX)
                ok = False
                continue
        if not all((isinstance(x, str) or _is_num(x)) and len(str(x)) <= CHART_TEXT_MAX for x in labels):
            rep.err(where, "chart.labels는 글자나 숫자(%d자 이하)" % CHART_TEXT_MAX)
            ok = False
        if not all(_is_num(x) for x in values):
            rep.err(where, "chart.values는 숫자만(true/false·글자 아님)")
            ok = False
        for k in CHART_OPT & set(f):
            if not isinstance(f[k], str) or not f[k].strip() or len(f[k]) > CHART_TEXT_MAX:
                rep.err(where, "chart.%s는 비어 있지 않은 글자(%d자 이하)" % (k, CHART_TEXT_MAX))
                ok = False
    return v if ok else None


def judge(result, expect, chart=None):
    """runner 결과 하나가 기대 출력(과 chart가 있으면 그림)과 맞는지. 맞으면 None, 아니면 이유 문자열."""
    if result["error"]:
        e = result["error"]
        return "오류 %s(%s줄): %s" % (e["type"], e["line"], e["msg"])
    if normalize(result["stdout"]) != normalize(expect):
        return "출력 %r ≠ 기대 %r" % (normalize(result["stdout"]), normalize(expect))
    if chart is not None:
        why = chart_mismatch(chart, result.get("charts"))
        if why:
            return "그림: " + why
    if result["missing"]:
        return "구조 조건 빠짐: %s" % ", ".join(result["missing"])
    return None


class CheckTimeout(BaseException):
    """점검기 시간 제한. BaseException이라 runner가 학습자 오류처럼 결과에 담아 돌려준다."""


def _on_alarm(signum, frame):
    raise CheckTimeout("over %d seconds" % RUN_SECONDS)


def safe_run(rep, where, code, stdin="", require=None, files=None, server=None):
    """runner.run + 시간 제한. 시간을 넘기면 rep에 오류를 적고 error.type = "Timeout"인 결과를 준다."""
    old = signal.signal(signal.SIGALRM, _on_alarm)
    signal.setitimer(signal.ITIMER_REAL, RUN_SECONDS)
    try:
        r = run(code, stdin, require or [], files=files, server=server)
    except CheckTimeout:
        r = {"stdout": "", "stderr": "", "error": {"type": "CheckTimeout", "line": None, "msg": ""}, "missing": []}
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old)
    if r["error"] and r["error"]["type"] == "CheckTimeout":
        r["error"] = {"type": "Timeout", "line": r["error"].get("line"), "msg": "over %d seconds" % RUN_SECONDS}
        rep.err(where, "실행이 %d초를 넘음(끝나지 않는 코드?)" % RUN_SECONDS)
    return r


def stdin_of(rep, where, obj):
    """카드·문제의 stdin 칸. 없으면 "", 문자열이 아니면 오류."""
    v = obj.get("stdin", "")
    if not isinstance(v, str):
        rep.err(where, "stdin은 문자열이어야 함(여러 값은 \\n으로 나눔)")
        return ""
    return v


def files_of(rep, where, obj):
    """files 칸(없으면 None). 형식이 틀리면 오류를 적고 None."""
    v = obj.get("files")
    if v is None and "files" not in obj:
        return None
    if not isinstance(v, dict) or not (1 <= len(v) <= FILES_MAX):
        rep.err(where, "files는 {이름: 내용} 객체, 1~%d개" % FILES_MAX)
        return None
    ok = True
    for name, text in v.items():
        if (not isinstance(name, str) or not name or len(name) > FILE_NAME_MAX or "/" in name or "\\" in name
                or name.startswith(".") or name != name.strip()):
            rep.err(where, "files 이름 %r 이 틀림(폴더 없는 파일 이름, .으로 시작 안 함, %d자 이하)"
                    % (name, FILE_NAME_MAX))
            ok = False
        if not isinstance(text, str):
            rep.err(where, "files[%r] 내용은 글자여야 함" % (name,))
            ok = False
    return v if ok else None


def server_of(rep, where, obj):
    """server 칸(없으면 None). 형식이 틀리면 오류를 적고 None."""
    v = obj.get("server")
    if v is None and "server" not in obj:
        return None
    if not isinstance(v, dict) or not (1 <= len(v) <= SERVER_MAX):
        rep.err(where, "server는 {주소: 응답} 객체, 1~%d개" % SERVER_MAX)
        return None
    ok = True
    for url, resp in v.items():
        if not isinstance(url, str) or not re.match(r"^https?://[^\s/]+(/\S*)?$", url):
            rep.err(where, "server 주소 %r 는 http:// 또는 https://로 시작하는 공백 없는 주소" % (url,))
            ok = False
        if not isinstance(resp, dict) or not (RESPONSE_KEYS <= set(resp) <= RESPONSE_KEYS | RESPONSE_OPT):
            rep.err(where, "server[%r] 응답 칸은 status, body (+ 선택 type)" % (url,))
            ok = False
            continue
        st = resp["status"]
        if not isinstance(st, int) or isinstance(st, bool) or not (100 <= st <= 599):
            rep.err(where, "server[%r].status는 100~599 정수" % (url,))
            ok = False
        if not isinstance(resp["body"], str):
            rep.err(where, "server[%r].body는 글자여야 함" % (url,))
            ok = False
        if "type" in resp and not isinstance(resp["type"], str):
            rep.err(where, "server[%r].type은 글자여야 함" % (url,))
            ok = False
    return v if ok else None


def env_of(rep, where, obj):
    """safe_run에 넘길 files·server(kwargs)."""
    return {"files": files_of(rep, where, obj), "server": server_of(rep, where, obj)}


def same_outcome(a, b):
    """두 실행 결과가 학습자 눈에 같은지(둘 다 같은 출력·같은 그림, 오류 없음)."""
    if a["error"] or b["error"] or normalize(a["stdout"]) != normalize(b["stdout"]):
        return False
    ca, cb = a.get("charts") or [], b.get("charts") or []
    return (not ca and not cb) or (bool(ca) and chart_mismatch(ca, cb) is None)


def check_main_charts(rep, where, chapter, result):
    """v0.9: 본 과정 레슨은 한 그림에 선 하나만(여러 선·legend는 17장 심화). line을 두 번 부르는 것은
    정적으로 다 못 잡으므로 실행 결과의 그림(series)으로 본다."""
    if isinstance(chapter, AdvancedChapter):
        return
    if any(isinstance(c, dict) and "series" in c for c in result.get("charts") or []):
        rep.err(where, "본 과정 레슨에서는 한 그림에 꺾은선 하나만 그림 — 여러 선·legend는 17장 심화 전용")


def check_run_chart(rep, where, expected, result):
    """카드·터치 문제의 chart(화면에 보여 줄 그림)가 코드를 돌린 그림과 같은지"""
    if expected is None or result["error"]:
        return
    why = chart_mismatch(expected, result.get("charts"))
    if why:
        rep.err(where, "chart가 코드를 돌린 그림과 다름 — " + why)


class Lesson:
    def __init__(self, label):
        self.label = label
        self.errors = []

    def err(self, where, msg):
        self.errors.append("%s: %s" % (where, msg) if where else msg)


# ── 검사 ────────────────────────────────────────────────────────────────
# --lang en (v0.13.1 영어 레슨): data/lessons/en/을 보고, 한국어 문장 검사는 끄고 글자 수 한도를 영어에 맞게 늘린다
LANG = "ko"
EN_TEXT_FACTOR = 2.2   # 같은 뜻의 영어는 한국어보다 대략 2배 길다(화면 폭은 영어 글자가 더 좁음)


# 영어 레슨의 질문·보기 낱말(한국어 「출력」「오류」「오류가 나는」「오류 없이」에 해당). 번역 지침에 같은 규칙을 적어 둠
# src/template.js errorOption()의 영어: 앱과 같은 값을 쓰도록 영어 표에서 읽는다(v0.13.4 검토 M6)
with open(os.path.join(ROOT, "i18n", "en", "ui.lesson.json"), encoding="utf-8") as _f:
    EN_ERROR_OPTION = json.load(_f)["오류가 나요"]


def asks_output(q):
    return ("출력" in q) if LANG == "ko" else bool(re.search(r"\b(output|print|prints|printed)\b", q, re.I))


def says_error(opt):
    return ("오류" in opt) if LANG == "ko" else ("error" in opt.lower())


def asks_error_code(q):
    """「오류가 나는 코드는?」 → True, 「오류 없이 … 코드는?」 → False, 아니면 None"""
    if LANG == "ko":
        return True if "오류가 나는" in q else (False if "오류 없이" in q else None)
    if re.search(r"\bwithout (an |any )?errors?\b", q, re.I):
        return False
    if re.search(r"\b(causes?|raises?|gives?|throws?) an error\b", q, re.I):
        return True
    return None


def check_text(rep, where, value, limit, need_hangul=True, one_line=True):
    if LANG == "en":
        limit = int(limit * EN_TEXT_FACTOR)
        need_hangul = False
    if not isinstance(value, str) or not value.strip():
        rep.err(where, "글이 비어 있음")
        return
    if one_line and "\n" in value:
        rep.err(where, "한 줄이어야 함")
    if len(value) > limit:
        rep.err(where, "너무 김(%d자 > %d자)" % (len(value), limit))
    if PLACEHOLDER.search(value):
        rep.err(where, "앱 자리 표시 %s 가 남아 있음" % PLACEHOLDER.search(value).group(0))
    if need_hangul and not HANGUL.search(value):
        rep.err(where, "한국어 문장이 아님: %r" % value)
    if "TODO" in value or "…" == value.strip():
        rep.err(where, "임시 글이 남아 있음")


def check_code_shape(rep, where, code, chapter):
    """줄 폭과 장별 금지 문법. 문법 오류가 있는 코드는 일부러 틀린 예일 수 있어 문법 검사만 건너뛴다."""
    if not isinstance(code, str):
        rep.err(where, "코드가 문자열이 아님")
        return
    for n, line in enumerate(code.split("\n"), 1):
        if width(line) > CODE_COLS:
            rep.err(where, "%d번째 줄이 휴대폰 화면보다 넓음(%d칸 > %d칸): %s" % (n, width(line), CODE_COLS, line))
        if "\t" in line:
            rep.err(where, "탭 문자 대신 빈칸 4개를 씀")
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return
    adv = isinstance(chapter, AdvancedChapter)
    if adv:
        forbid = ADV_FORBID_BY_CHAPTER.get(chapter, FORBID_ALL | ADVANCED_ONLY)
        calls = ADV_CALLS_BY_CHAPTER.get(chapter, set())
    else:
        forbid = MAIN_FORBID_BY_CHAPTER.get(chapter, FORBID_ALL | ADVANCED_ONLY)
        calls = CALLS_BY_CHAPTER.get(chapter, set())
    names = NAMES_BY_CHAPTER.get(chapter)
    where_ch = "%d장 심화" % chapter if adv else "%d장" % chapter

    def forbidden(kind, line, what=None):
        label = "%s(%s)" % (kind, what) if what else kind
        if kind in ADVANCED_ONLY and not adv:
            rep.err(where, "%s 은 심화 레슨에서만 쓰는 문법 — %d장 본 과정 레슨에서는 쓰지 않음(%s줄)"
                    % (label, chapter, line))
        else:
            rep.err(where, "%s에서 아직 배우지 않은 문법 %s (%s줄)" % (where_ch, label, line))

    for kind, line, problem in advanced_features(tree, code):
        if problem:
            if kind not in forbid:   # 금지된 문법이면 위의 한 줄로 충분
                rep.err(where, "%s: %s (%s줄)" % (kind, problem, line))
        elif kind in forbid:
            forbidden(kind, line)
    if "Match" not in forbid:
        check_match(rep, where, tree)
    divmod_targets = set()
    if "DivmodUnpack" not in forbid:
        divmod_targets = {id(n.targets[0]) for n in ast.walk(tree)
                          if isinstance(n, ast.Assign) and len(n.targets) == 1
                          and isinstance(n.targets[0], ast.Tuple)
                          and all(isinstance(e, ast.Name) for e in n.targets[0].elts)
                          and isinstance(n.value, ast.Call) and isinstance(n.value.func, ast.Name)
                          and n.value.func.id == "divmod"}
    if "FunctionDef" not in forbid:  # 직접 만든 함수는 부를 수 있음(4장부터)
        calls = calls | {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    if "ClassDef" not in forbid:     # 직접 만든 클래스로 객체 만들기(15장부터)
        calls = calls | {n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)}
        for kind, line, what in check_classes(rep, where, tree, chapter):
            if kind in forbid:
                forbidden(kind, line, what)
    # for 대상 자리의 튜플(for k, v in …:) — ForTupleTarget이 허용된 장에서는 Tuple 금지에서 뺀다
    for_targets = set()
    if "ForTupleTarget" not in forbid:
        for_targets = {id(n.target) for n in ast.walk(tree)
                       if isinstance(n, ast.For) and isinstance(n.target, ast.Tuple)}
    from_names = {}
    if "Import" not in forbid:
        adv_members = []
        from_names = check_imports(rep, where, tree, chapter, adv_members)
        calls = calls | set(from_names)
        for kind, line, what in adv_members:
            if kind in forbid:
                forbidden(kind, line, what)
    for node in ast.walk(tree):
        kind = type(node).__name__
        if kind == "Tuple" and (id(node) in for_targets or id(node) in divmod_targets):
            pass
        elif kind in forbid:
            forbidden(kind, getattr(node, "lineno", "?"))
        elif (kind == "For" and "ForNonRange" in forbid
              and not (isinstance(node.iter, ast.Call) and isinstance(node.iter.func, ast.Name)
                       and node.iter.func.id == "range")):
            rep.err(where, "%s에서 아직 배우지 않은 문법 ForNonRange: for는 range(…)만 돎(%s줄)"
                    % (where_ch, node.lineno))
        if isinstance(node, ast.Name) and names is not None and node.id not in names:
            rep.err(where, "%s에서 쓸 수 없는 이름 %r(변수는 2장부터)" % (where_ch, node.id))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id not in calls:
            rep.err(where, "%s에서 아직 배우지 않은 함수 %s()" % (where_ch, node.func.id))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "print":
            for kw in node.keywords:
                if kw.arg == "end":
                    if "PrintEnd" in forbid:
                        forbidden("PrintEnd", node.lineno)
                else:
                    rep.err(where, "print에는 end= 말고 이름 붙은 인자(%s)를 쓰지 않음(%s줄)"
                            % ("**" if kw.arg is None else kw.arg + "=", node.lineno))


def _const_default(node):
    """기본값으로 쓸 수 있는 상수(숫자·문자열·True/False/None, -1 같은 음수)인지"""
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        node = node.operand
        return isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool)
    return isinstance(node, ast.Constant) and not isinstance(node.value, bytes)


def advanced_features(tree, code):
    """심화 가짜 문법 찾기 → [(이름, 줄, 문제)]. 문제가 None이면 그 문법을 쓴 것, 아니면 허용돼도 틀린 쓰임."""
    found = []
    comps = (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)
    lambda_args = {id(a) for n in ast.walk(tree) if isinstance(n, ast.Call)
                   for a in list(n.args) + [k.value for k in n.keywords] if isinstance(a, ast.Lambda)}
    in_except = {id(r) for h in ast.walk(tree) if isinstance(h, ast.ExceptHandler)
                 for b in h.body for r in ast.walk(b) if isinstance(r, ast.Raise)}
    for node in ast.walk(tree):
        if isinstance(node, ast.ListComp):
            if len(node.generators) > 1:
                found.append(("ListComp", node.lineno, "for는 하나만 씀(반복 안의 반복은 for 문 두 개로)"))
            if any(len(g.ifs) > 1 for g in node.generators):
                found.append(("ListComp", node.lineno, "if는 하나만 씀(조건 여러 개는 and로 묶음)"))
            if any(isinstance(c, comps) for c in ast.walk(node) if c is not node):
                found.append(("ListComp", node.lineno, "컴프리헨션 안에 컴프리헨션을 넣지 않음(바깥은 for 문으로)"))
        if isinstance(node, ast.Lambda) and id(node) not in lambda_args:
            found.append(("Lambda", node.lineno,
                          "lambda는 함수에 넘기는 자리(key=lambda p: p[1])에서만 — 이름에 담을 함수는 def로"))
        if isinstance(node, ast.Raise):
            if node.exc is None:
                found.append(("Reraise", node.lineno, None))
                if id(node) not in in_except:
                    found.append(("Reraise", node.lineno, "맨 raise는 except 안에서만(잡은 오류를 다시 던짐)"))
            if node.cause is not None:
                found.append(("Raise", node.lineno, "raise … from … 은 쓰지 않음"))
        if isinstance(node, ast.FormattedValue) and node.format_spec is not None:
            found.append(("FormatSpec", node.lineno, None))
            if any(isinstance(n, ast.FormattedValue) for n in ast.walk(node.format_spec)):
                found.append(("FormatSpecNested", node.lineno, "서식 지정자 안에 {…}를 넣지 않음(자릿수는 숫자로 적음)"))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            defaults = list(node.args.defaults) + [d for d in node.args.kw_defaults if d is not None]
            if defaults:
                found.append(("DefaultArg", node.lineno, None))
                if not all(_const_default(d) for d in defaults):
                    found.append(("DefaultArg", node.lineno,
                                  "기본값은 숫자·문자열·True/False/None 상수만(목록·계산 결과는 부를 때마다 같은 것을 써서 헷갈림)"))
            if not isinstance(node, ast.Lambda) and any(
                    isinstance(c, ast.Call) and isinstance(c.func, ast.Name) and c.func.id == node.name
                    for b in node.body for c in ast.walk(b)):
                found.append(("Recursion", node.lineno, None))
        elif isinstance(node, (ast.For, ast.While)) and node.orelse:
            found.append(("LoopElse", node.lineno, None))
    try:
        starts = {tokenize.STRING} | ({tokenize.FSTRING_START} if hasattr(tokenize, "FSTRING_START") else set())
        for tok in tokenize.generate_tokens(io.StringIO(code).readline):
            if tok.type in starts and tok.string.lstrip("rRbBuUfF")[:3] in ('"""', "'''"):
                found.append(("TripleQuote", tok.start[0], None))
    except (tokenize.TokenError, SyntaxError, IndentationError):
        pass
    found.extend(regex_features(tree))
    return found


REGEX_NAMED = "(?P<"
REGEX_BACKREF = re.compile(r"\\[1-9]|\\g<|\(\?P=")


def regex_features(tree):
    """re를 들여온 코드에서 12장 심화 정규식 문법 찾기 → [(이름, 줄, None)].
    글자 상수 안의 (?P<…> → RegexNamedGroup, \\1~\\9·\\g<…>·(?P=…) → RegexBackref,
    .group("이름")(글자 인자)·.groupdict() → RegexNamedGroup."""
    uses_re = any((isinstance(n, ast.Import) and any(a.name == "re" for a in n.names))
                  or (isinstance(n, ast.ImportFrom) and n.module == "re" and not n.level)
                  for n in ast.walk(tree))
    if not uses_re:
        return []
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if REGEX_NAMED in node.value:
                found.append(("RegexNamedGroup", node.lineno, None))
            if REGEX_BACKREF.search(node.value):
                found.append(("RegexBackref", node.lineno, None))
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr == "groupdict" or (
                    node.func.attr == "group"
                    and any(isinstance(a, ast.Constant) and isinstance(a.value, str) for a in node.args)):
                found.append(("RegexNamedGroup", node.lineno, None))
    return found


def check_match(rep, where, tree):
    """심화 match: 값 패턴(글자·숫자·None/True/False, 음수), | 여러 값, _ 나머지만. 이름 잡기·guard·
    클래스·목록·사전 패턴은 쓰지 않는다(값으로 경우 나누기만 배움)."""
    def ok(p):
        if isinstance(p, ast.MatchValue):
            return _const_default(p.value) and not (isinstance(p.value, ast.Constant) and p.value.value is None)
        if isinstance(p, ast.MatchSingleton):
            return True
        if isinstance(p, ast.MatchOr):
            return all(ok(x) for x in p.patterns)
        return isinstance(p, ast.MatchAs) and p.pattern is None and p.name is None   # _
    for node in ast.walk(tree):
        if not isinstance(node, ast.Match):
            continue
        for case in node.cases:
            line = getattr(case.pattern, "lineno", node.lineno)
            if case.guard is not None:
                rep.err(where, "MatchGuard: case … if … 는 쓰지 않음(조건은 case 안의 if로, %s줄)" % line)
            if not ok(case.pattern):
                rep.err(where, "MatchPattern: case에는 글자·숫자 값, | 로 묶은 값, _ 만 씀 — %s 은 안 됨(%s줄)"
                        % (ast.unparse(case.pattern), line))


def check_classes(rep, where, tree, chapter):
    """15장부터: 물려받기는 같은 코드에서 만든 클래스 하나만, metaclass·데코레이터 없음,
    특수 메서드(__이름__)는 CLASS_DUNDERS만 정의하고 점 뒤에도 그것만 쓴다.
    ADVANCED_DUNDERS(__str__·__eq__, 15장 심화)는 여기서 오류로 적지 않고 [(가짜 문법 이름, 줄, 이름)]로 돌려준다
    (부르는 쪽이 금지 표로 「심화 전용」/「아직 배우지 않은」을 고름)."""
    own = {n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)}
    allowed = CLASS_DUNDERS | set(ADVANCED_DUNDERS)
    adv_found = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and node.decorator_list:
            rep.err(where, "%d장에서는 데코레이터(@…)를 쓰지 않음(%s줄)" % (chapter, node.decorator_list[0].lineno))
        if isinstance(node, ast.ClassDef):
            if len(node.bases) > 1:
                rep.err(where, "class %s: 여러 클래스를 한꺼번에 물려받지 않음(하나만, %s줄)" % (node.name, node.lineno))
            for b in node.bases:
                if not (isinstance(b, ast.Name) and b.id in own and b.id != node.name):
                    rep.err(where, "class %s: 물려받기는 이 코드에서 만든 클래스만 — %s 은 안 됨(%s줄)"
                            % (node.name, ast.unparse(b), node.lineno))
            for k in node.keywords:
                rep.err(where, "class %s: %s= 은 쓰지 않음(%s줄)" % (node.name, k.arg or "**", node.lineno))
            for f in node.body:
                if (isinstance(f, (ast.FunctionDef, ast.AsyncFunctionDef)) and f.name.startswith("__")
                        and f.name.endswith("__")):
                    if f.name in ADVANCED_DUNDERS:
                        adv_found.append((ADVANCED_DUNDERS[f.name], f.lineno, f.name))
                    elif f.name not in allowed:
                        rep.err(where, "특수 메서드 %s 은 %d장에서 쓰지 않음 — 쓸 수 있는 것: %s(%s줄)"
                                % (f.name, chapter, ", ".join(sorted(allowed)), f.lineno))
        if isinstance(node, ast.Attribute) and node.attr.startswith("__") and node.attr.endswith("__"):
            if node.attr in ADVANCED_DUNDERS:
                adv_found.append((ADVANCED_DUNDERS[node.attr], node.lineno, "." + node.attr))
            elif node.attr not in allowed:
                rep.err(where, ".%s 은 %d장에서 쓰지 않음(%s줄)" % (node.attr, chapter, node.lineno))
    return adv_found


def _dotted(node):
    """a.b.c 꼴 속성 사슬 → ["a", "b", "c"]. 맨 앞이 이름이 아니면 None."""
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if not isinstance(node, ast.Name):
        return None
    parts.append(node.id)
    return parts[::-1]


def check_imports(rep, where, tree, chapter, adv_members=None):
    """11장부터: import는 그 장까지 배운 모듈만, 모듈에서는 MODULE_MEMBERS에 있는 이름만.
    open()의 모드, CALL_KWARGS의 키워드도 여기서 본다. from … import로 들여온 {이름: "모듈.이름"}을 돌려준다.
    adv_members(목록)를 주면 ADVANCED_MEMBERS에 있는 이름을 쓴 곳을 (가짜 문법 이름, 줄, "모듈.이름")으로 담는다."""
    def note(qname, line):
        if adv_members is not None and qname in ADVANCED_MEMBERS:
            adv_members.append((ADVANCED_MEMBERS[qname], line, qname))

    modules = MODULES_BY_CHAPTER.get(chapter, set())
    allowed = ", ".join(sorted(modules)) or "없음"

    def bad_module(name, line):
        rep.err(where, "%d장에서 쓸 수 없는 모듈 %s (%s줄) — 이 장까지 쓸 수 있는 모듈: %s"
                % (chapter, name, line, allowed))

    bound, from_names = {}, {}   # 코드 안 이름 → 모듈 경로
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                if a.name not in modules:
                    bad_module(a.name, node.lineno)
                elif a.asname:
                    bound[a.asname] = a.name
                else:
                    bound[a.name.split(".")[0]] = a.name.split(".")[0]
        elif isinstance(node, ast.ImportFrom):
            mod = "." * node.level + (node.module or "")
            if mod not in modules:
                bad_module(mod, node.lineno)
                continue
            for a in node.names:
                if a.name == "*":
                    rep.err(where, "from %s import * 는 쓰지 않음(필요한 이름만 적음, %s줄)" % (mod, node.lineno))
                elif a.name not in MODULE_MEMBERS.get(mod, ()):
                    rep.err(where, "%s.%s 은 %d장에서 쓸 수 없는 이름 (%s줄) — 쓸 수 있는 것: %s"
                            % (mod, a.name, chapter, node.lineno, ", ".join(sorted(MODULE_MEMBERS.get(mod, ())))))
                else:
                    from_names[a.asname or a.name] = mod + "." + a.name
                    note(mod + "." + a.name, node.lineno)

    inner = {id(n.value) for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
    qual = {}   # id(속성 마디) → "모듈.이름"
    for node in ast.walk(tree):
        if not isinstance(node, ast.Attribute) or id(node) in inner:
            continue
        parts = _dotted(node)
        if not parts or parts[0] not in bound:
            continue
        parts = bound[parts[0]].split(".") + parts[1:]
        cut = max((i for i in range(1, len(parts) + 1) if ".".join(parts[:i]) in MODULE_MEMBERS), default=0)
        mod = ".".join(parts[:cut])
        if not cut or mod not in modules:
            bad_module(mod or ".".join(parts[:2]), node.lineno)
        elif cut < len(parts) and parts[cut] not in MODULE_MEMBERS[mod]:
            rep.err(where, "%s.%s 은 %d장에서 쓸 수 없는 이름 (%s줄) — 쓸 수 있는 것: %s"
                    % (mod, parts[cut], chapter, node.lineno, ", ".join(sorted(MODULE_MEMBERS[mod]))))
        elif cut < len(parts):
            qual[id(node)] = mod + "." + parts[cut]
            note(mod + "." + parts[cut], node.lineno)

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        f = node.func
        name = (from_names.get(f.id, f.id) if isinstance(f, ast.Name) else qual.get(id(f)))
        if name in CALL_KWARGS:
            for kw in node.keywords:
                if kw.arg not in CALL_KWARGS[name]:
                    rep.err(where, "%s()에는 %s 를 쓰지 않음(%s줄) — 쓸 수 있는 이름 인자: %s"
                            % (name, "**" if kw.arg is None else kw.arg + "=", node.lineno,
                               ", ".join(sorted(CALL_KWARGS[name])) or "없음"))
        if name == "open":
            mode = node.args[1] if len(node.args) > 1 else next(
                (k.value for k in node.keywords if k.arg == "mode"), None)
            if len(node.args) > 2:
                rep.err(where, "open()에는 파일 이름과 모드만 차례로 씀(%s줄)" % node.lineno)
            if mode is not None and not (isinstance(mode, ast.Constant) and mode.value in OPEN_MODES):
                rep.err(where, "open()의 모드는 \"r\"·\"w\"·\"a\" 중 하나를 글자 그대로 씀(%s줄)" % node.lineno)
        if name == "sqlite3.connect" and not (
                len(node.args) == 1 and not node.keywords
                and isinstance(node.args[0], ast.Constant) and node.args[0].value == DB_MEMORY):
            rep.err(where, "sqlite3.connect()에는 \"%s\" 하나만 글자 그대로 씀 — 실행마다 새 DB, 휴대폰에 파일을 "
                           "남기지 않아요(%s줄)" % (DB_MEMORY, node.lineno))
    check_db_methods(rep, where, tree, chapter, from_names, qual)
    return from_names


def check_db_methods(rep, where, tree, chapter, from_names, qual):
    """16장: 연결·커서로 알아볼 수 있는 이름(sqlite3.connect(…), x.cursor(), x.execute(…)의 결과를 담은 변수와
    그런 호출 바로 뒤)에는 DB_METHODS만 쓴다. 그 밖의 객체 메서드는 보지 않는다(형 추론 없음)."""
    def qname(call):
        f = call.func
        return from_names.get(f.id, f.id) if isinstance(f, ast.Name) else qual.get(id(f))

    db_names = set()

    def is_db(expr):
        if isinstance(expr, ast.Name):
            return expr.id in db_names
        if isinstance(expr, ast.Call):
            if qname(expr) == "sqlite3.connect":
                return True
            f = expr.func
            return (isinstance(f, ast.Attribute) and f.attr in ("cursor", "execute", "executemany")
                    and is_db(f.value))
        return False

    # conn = …; cur = conn.cursor() 처럼 이어진 대입을 더 늘지 않을 때까지 훑는다(함수 안 순서와 무관).
    while True:
        before = len(db_names)
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and is_db(node.value):
                db_names.update(t.id for t in node.targets if isinstance(t, ast.Name))
            elif (isinstance(node, ast.withitem) and is_db(node.context_expr)
                  and isinstance(node.optional_vars, ast.Name)):
                db_names.add(node.optional_vars.id)
        if len(db_names) == before:
            break
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and node.attr not in DB_METHODS and is_db(node.value):
            rep.err(where, "DB 연결·커서의 %s 은 %d장에서 쓰지 않음(%s줄) — 쓸 수 있는 것: %s"
                    % (node.attr, chapter, node.lineno, ", ".join(sorted(DB_METHODS))))


def check_index(rep, where, item, key="options", lo=3, hi=4):
    opts = item.get(key)
    if not isinstance(opts, list) or not (lo <= len(opts) <= hi):
        rep.err(where, "%s는 %d~%d개여야 함(지금 %s)" % (key, lo, hi, len(opts) if isinstance(opts, list) else opts))
        return False
    if any(not isinstance(o, str) or not o.strip() for o in opts):
        rep.err(where, "%s의 값은 비어 있지 않은 문자열이어야 함" % key)
        return False
    if len(set(opts)) != len(opts):
        rep.err(where, "%s에 같은 값이 두 번 있음" % key)
    a = item.get("answer")
    if not isinstance(a, int) or isinstance(a, bool) or not (0 <= a < len(opts)):
        rep.err(where, "answer %r 가 범위(0~%d) 밖" % (a, len(opts) - 1))
        return False
    return True


def check_choice(rep, where, item, chapter):
    check_text(rep, where + ".q", item.get("q"), Q_MAX)
    ok = check_index(rep, where, item)
    q = item.get("q") if isinstance(item.get("q"), str) else ""
    code = item.get("code")
    stdin = stdin_of(rep, where, item)
    env = env_of(rep, where, item)
    if code is None:
        if ok:
            check_codeless_error(rep, where, item, q, env)
        return
    if not isinstance(code, str):
        rep.err(where, "code가 문자열이 아님")
        return
    check_code_shape(rep, where + ".code", code, chapter)
    r = safe_run(rep, where, code, stdin, **env)
    check_main_charts(rep, where, chapter, r)
    check_run_chart(rep, where, chart_of(rep, where, item), r)
    if not ok:
        return
    if r["error"]:
        # 「출력은?」 문제인데 코드가 오류를 내면 정답 보기는 「오류」를 말해야 함.
        # 그 밖의 질문(「어떤 오류?」 등)은 보기 비교를 하지 않음.
        if asks_output(q) and not says_error(item["options"][item["answer"]]):
            rep.err(where, "코드가 오류(%s)를 내는데 정답 보기 %r 에 「오류」가 없음"
                    % (r["error"]["type"], item["options"][item["answer"]]))
        return
    out = normalize(r["stdout"])
    opts = [normalize(o) for o in item["options"]]
    hits = [i for i, o in enumerate(opts) if o == out]
    if asks_output(q):
        # 「출력은?」 문제: 실제 출력과 같은 보기가 정확히 정답 하나여야 함
        if hits != [item["answer"]]:
            rep.err(where, "출력 문제인데 실제 출력 %r 이 정답 보기 %r 와 다름" % (out, opts[item["answer"]]))
    elif hits and hits != [item["answer"]]:
        rep.err(where, "실제 출력 %r 와 같은 보기가 정답이 아님" % out)


def check_codeless_error(rep, where, item, q, env=None):
    """코드 없는 「오류가 나는 코드는?」·「오류 없이 … 코드는?」 문제.

    보기가 모두 print( 를 담은 코드일 때만 실행해 본다(보기가 설명 문장이면 건너뜀).
    """
    opts = item["options"]
    if not all("print(" in o for o in opts):
        return
    want_error = asks_error_code(q)
    if want_error is None:
        return
    errs = [bool(safe_run(rep, where, o, stdin_of(rep, where, item), **(env or {}))["error"]) for o in opts]
    picked = [i for i, e in enumerate(errs) if e == want_error]
    if picked != [item["answer"]]:
        rep.err(where, "보기를 실행해 보니 %s 보기는 %s 인데 정답은 %d"
                % ("오류가 나는" if want_error else "오류 없는", picked, item["answer"]))


def check_blank(rep, where, item, chapter):
    check_text(rep, where + ".q", item.get("q"), Q_MAX)
    code = item.get("code")
    if not isinstance(code, str) or code.count("___") != 1:
        rep.err(where, "code에 빈칸 ___ 이 정확히 하나여야 함")
        return
    if not check_index(rep, where, item, "chips", 3, 4):
        return
    chips = item["chips"]
    if any("___" in c for c in chips):
        rep.err(where, "칩에 ___ 가 들어 있음")
    stdin = stdin_of(rep, where, item)
    env = env_of(rep, where, item)
    right = code.replace("___", chips[item["answer"]])
    check_code_shape(rep, where + ".code(정답)", right, chapter)
    good = safe_run(rep, where, right, stdin, **env)
    if good["error"]:
        rep.err(where, "정답 칩을 넣은 코드가 오류: %s %s" % (good["error"]["type"], good["error"]["msg"]))
        return
    check_main_charts(rep, where, chapter, good)
    check_run_chart(rep, where, chart_of(rep, where, item), good)
    for i, c in enumerate(chips):
        if i == item["answer"]:
            continue
        if same_outcome(safe_run(rep, where, code.replace("___", c), stdin, **env), good):
            rep.err(where, "오답 칩 %r 도 정답과 같은 출력을 냄(정답이 둘)" % c)


def check_order(rep, where, item, chapter):
    check_text(rep, where + ".q", item.get("q"), Q_MAX)
    lines = item.get("lines")
    if not isinstance(lines, list) or not (3 <= len(lines) <= 6):
        rep.err(where, "lines는 3~6줄이어야 함")
        return
    if any(not isinstance(l, str) or "\n" in l or not l.strip() for l in lines):
        rep.err(where, "lines의 각 항목은 비어 있지 않은 한 줄 문자열")
        return
    if len(set(lines)) != len(lines):
        rep.err(where, "같은 줄이 두 번 있음(터치로 구분할 수 없음)")
        return
    stdin = stdin_of(rep, where, item)
    env = env_of(rep, where, item)
    code = "\n".join(lines)
    check_code_shape(rep, where + ".lines", code, chapter)
    if not isinstance(item.get("expect"), str):
        rep.err(where, "expect가 문자열이 아님")
        return
    chart = chart_of(rep, where, item)
    r = safe_run(rep, where, code, stdin, **env)
    check_main_charts(rep, where, chapter, r)
    why = judge(r, item["expect"], chart)
    if why:
        rep.err(where, "정답 순서 실행 결과가 expect와 다름 — " + why)
        return
    # 정답 순서는 딱 하나여야 함(판정 C23): Pyodide가 준비되기 전에는 앱이 저장된 순서와 비교하므로.
    valid = 1
    for perm in itertools.permutations(lines):
        if list(perm) != lines and judge(safe_run(rep, where, "\n".join(perm), stdin, **env), item["expect"], chart) is None:
            valid += 1
    if valid != 1:
        rep.err(where, "expect를 내는 순서가 %d가지(정확히 1가지여야 함)" % valid)


def uses_input(code):
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return False
    return any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "input"
               for n in ast.walk(tree))


# 판정 C26: "Call:print" = print(…)를 부름, "Name:price" = 이름 price를 씀
# 판정 C34: "Method:get" = 메서드 .get(…)을 부름(d.get(…), s.upper() 등)
REQUIRE_PREFIXES = ("Call", "Name", "Method")
# 판정 C44: ast 마디 이름이 아니지만 runner가 알아보는 조건(주석·elif·else)
# 판정 C45: 심화용 재귀 호출·f-문자열 서식·세 따옴표 문자열
# v0.8: 12장 심화 이름 붙인 묶음(글자 상수 안에 (?P<가 있음)
# v0.8: 10장 심화 다시 던지기(except 안의 맨 raise)
REQUIRE_EXTRA = ("Comment", "Elif", "Else", "SelfCall", "FormatSpec", "TripleStr", "NamedGroup", "Reraise")
# v0.9(13~17장 심화): "Def:__str__" = 그 이름의 함수·메서드를 정의함(print가 몰래 부르는 __str__은 Method:로 못 셈),
#                    "SQL:JOIN" = 코드의 글자 상수 안에 그 SQL 낱말(대문자로 적음, 채점은 대소문자 무시·낱말 단위)
REQUIRE_DEF_SQL = ("Def", "SQL")
SQL_WORD_RE = re.compile(r"[A-Z]+")


def check_require(rep, where, req):
    """require 항목: ast 마디 이름(예: "If", "Mult"), "Call:<이름>"·"Name:<이름>"·"Method:<이름>"·"Def:<이름>"·"SQL:<낱말>",
    또는 REQUIRE_EXTRA("Comment"·"Elif"·"Else"·"SelfCall"·"FormatSpec"·"TripleStr"·"NamedGroup"·"Reraise")."""
    for name in req:
        if isinstance(name, str) and ":" in name:
            kind, _, ident = name.partition(":")
            if kind == "SQL":
                if not SQL_WORD_RE.fullmatch(ident):
                    rep.err(where, "require %r 형식이 틀림(SQL:JOIN처럼 대문자 영어 낱말 하나)" % (name,))
            elif ((kind not in REQUIRE_PREFIXES and kind not in REQUIRE_DEF_SQL)
                  or not ident.isidentifier() or keyword.iskeyword(ident)):
                rep.err(where, "require %r 형식이 틀림(Call:이름, Name:이름, Method:이름, Def:이름 중 하나, "
                               "이름은 Python 식별자 — 또는 SQL:낱말)" % (name,))
            continue
        if name in REQUIRE_EXTRA:
            continue
        node = getattr(ast, name, None) if isinstance(name, str) else None
        if not (isinstance(node, type) and issubclass(node, ast.AST)):
            rep.err(where, "require %r 는 Python ast 마디 이름이 아님" % (name,))


def check_write(rep, where, item, chapter):
    check_text(rep, where + ".task", item.get("task"), TASK_MAX, one_line=False)
    sol, starter = item.get("solution"), item.get("starter")
    if not isinstance(sol, str) or not sol.strip():
        rep.err(where, "solution이 비어 있음")
        return
    if not isinstance(starter, str):
        rep.err(where, "starter가 문자열이 아님(비우려면 \"\")")
        return
    adv = isinstance(chapter, AdvancedChapter)
    check_code_shape(rep, where + ".solution", sol, chapter)
    if starter.strip():
        check_code_shape(rep, where + ".starter", starter, chapter)

    req = item.get("require")
    if not isinstance(req, list) or not all(isinstance(n, str) for n in req):
        rep.err(where, "require는 문자열 목록이어야 함(없으면 [])")
        req = []
    check_require(rep, where, req)

    hints = item.get("hints")
    if not isinstance(hints, list) or len(hints) != 4:
        rep.err(where, "hints는 정확히 4개(재확인 → 개념 → 방향 → 뼈대)")
    else:
        for i, h in enumerate(hints[:3]):
            check_text(rep, "%s.hints[%d]" % (where, i), h, HINT_MAX, one_line=False)
        if not isinstance(hints[3], str) or "___" not in hints[3]:
            rep.err(where, "4번째 힌트(뼈대 코드)에 빈칸 ___ 이 있어야 함")
        elif not uses_input(sol) and "input" in hints[3]:
            rep.err(where, "뼈대 힌트에 정답에 없는 input()이 있음")

    tests = item.get("tests")
    if not isinstance(tests, list) or not tests:
        rep.err(where, "tests가 없음")
        return
    has_input = uses_input(sol)
    env = env_of(rep, where, item)
    # 시험마다 다른 파일을 두면 입력이 없어도 결과가 달라지므로 시험을 여러 개 둘 수 있다.
    test_files = any(isinstance(t, dict) and "files" in t for t in tests)
    if has_input and chapter < INPUT_FROM_CHAPTER:
        rep.err(where, "%d장에서는 input()을 쓰지 않음" % chapter)
    # 입력이 없는 문제는 출력이 늘 같으므로 시험 1개(공개)만 둔다. 입력이 있으면 2~4개.
    lo, hi = (2, 4) if has_input or test_files else (1, 1)
    if not (lo <= len(tests) <= hi):
        rep.err(where, "tests는 %d~%d개여야 함(input %s, 시험별 files %s, 지금 %d개)"
                % (lo, hi, "있음" if has_input else "없음", "있음" if test_files else "없음", len(tests)))
    if sum(1 for t in tests if isinstance(t, dict) and t.get("public") is True) != 1:
        rep.err(where, "공개 시험(public: true)은 정확히 1개")
    stdins = []
    envs = []
    charts = {}   # 시험 번호 → 기대 그림(없으면 None)
    for i, t in enumerate(tests):
        tw = "%s.tests[%d]" % (where, i)
        if not isinstance(t, dict) or not (TEST_KEYS <= set(t) <= TEST_KEYS | TEST_OPT):
            rep.err(tw, "시험 칸은 stdin, expect, public 세 개 (+ 선택 files, chart)")
            envs.append(env)
            continue
        if not isinstance(t["stdin"], str) or not isinstance(t["expect"], str) or not isinstance(t["public"], bool):
            rep.err(tw, "stdin·expect는 문자열(여러 값은 \\n으로 나눔), public은 true/false")
            continue
        if not has_input and t["stdin"] != "":
            rep.err(tw, "input()이 없는 문제인데 stdin이 있음")
        tenv = dict(env, files=files_of(rep, tw, t)) if "files" in t else env
        envs.append(tenv)
        stdins.append((t["stdin"], json.dumps(tenv["files"], sort_keys=True, ensure_ascii=False)))
        charts[i] = chart_of(rep, tw, t)
        if adv:
            r = adv_run(rep, tw, sol, t["stdin"], req, tenv)
        else:
            r = safe_run(rep, tw, sol, t["stdin"], req, **tenv)
        check_main_charts(rep, tw, chapter, r)
        why = judge(r, t["expect"], charts[i])
        if why:
            rep.err(tw, "solution이 통과하지 못함 — " + why)
        elif r.get("charts") and "chart" not in t:
            rep.err(tw, "solution이 그림을 그리는데 시험에 chart가 없음(그림을 채점하려면 chart를 적음)")
    if len(set(stdins)) != len(stdins):
        rep.err(where, "같은 stdin(과 files)의 시험이 두 번 있음")
    if all(isinstance(t, dict) and isinstance(t.get("stdin"), str) and isinstance(t.get("expect"), str)
           and judge(safe_run(rep, where, starter, t["stdin"], req, **envs[i]), t["expect"], charts.get(i)) is None
           for i, t in enumerate(tests)):
        rep.err(where, "starter만으로 모든 시험을 통과함")


def _frame_depth():
    f, n = sys._getframe(), 0
    while f is not None:
        f, n = f.f_back, n + 1
    return n


def adv_run(rep, where, code, stdin, req, env):
    """심화 정답 실행: ADV_RUN_SECONDS 안에 끝나야 하고, 재귀가 있으면 ADV_RECURSION_DEPTH단계 안에서 끝나야 한다
    (앱 제한 3초·휴대폰 Pyodide 스택의 여유). 재귀 깊이는 실행 동안 재귀 한도를 낮춰서 본다."""
    try:
        recursive = any(k == "Recursion" for k, _, _ in advanced_features(ast.parse(code), code))
    except SyntaxError:
        recursive = False
    old_limit = sys.getrecursionlimit()
    if recursive:
        # safe_run → run → exec → <module> 몇 단계 + 학습자 재귀 깊이
        sys.setrecursionlimit(_frame_depth() + 10 + ADV_RECURSION_DEPTH)
    t0 = time.perf_counter()
    try:
        r = safe_run(rep, where, code, stdin, req, **env)
    finally:
        took = time.perf_counter() - t0
        sys.setrecursionlimit(old_limit)
    if took > ADV_RUN_SECONDS and not (r["error"] and r["error"]["type"] == "Timeout"):
        rep.err(where, "심화 직접 작성은 정답이 시험마다 %g초 안에 끝나야 함(지금 %.2f초)" % (ADV_RUN_SECONDS, took))
    if recursive and r["error"] and r["error"]["type"] == "RecursionError":
        rep.err(where, "재귀가 너무 깊음 — 심화 정답의 재귀는 %d단계 안에서 끝나야 함(휴대폰 여유)"
                % ADV_RECURSION_DEPTH)
    return r


def check_item(rep, where, item, chapter, concepts):
    if not isinstance(item, dict):
        rep.err(where, "문제가 객체가 아님")
        return
    kind = item.get("type")
    if kind not in ITEM_KEYS:
        rep.err(where, "모르는 문제 형태 %r" % kind)
        return
    need, opt = ITEM_KEYS[kind]
    missing = need - set(item)
    extra = set(item) - need - opt
    if missing:
        rep.err(where, "빠진 칸: " + ", ".join(sorted(missing)))
    if extra:
        rep.err(where, "모르는 칸: " + ", ".join(sorted(extra)))
    concept = item.get("concept")
    if not isinstance(concept, str) or concept not in concepts:
        rep.err(where, "개념 %r 이 concepts.js에 없음" % (concept,))
    elif isinstance(concepts[concept], int) and concepts[concept] > chapter:
        rep.err(where, "개념 %s 은 %d장 개념이라 %d장에서 쓸 수 없음" % (concept, concepts[concept], chapter))
    elif isinstance(concepts[concept], AdvancedChapter) and not isinstance(chapter, AdvancedChapter):
        rep.err(where, "심화 개념 %s 은 본 과정 레슨에서 쓰지 않음(심화 레슨 전용)" % concept)
    check_text(rep, where + ".explain", item.get("explain"), EXPLAIN_MAX, one_line=False)
    if missing:
        return
    try:
        {"choice": check_choice, "check": check_choice, "blank": check_blank,
         "order": check_order, "write": check_write}[kind](rep, where, item, chapter)
    except Exception as e:  # noqa: BLE001 — 형식이 망가진 데이터도 줄 하나로 알린다
        rep.err(where, "형식이 잘못되어 점검을 마치지 못함(%s: %s)" % (type(e).__name__, e))


def check_lesson(rep, lesson, chapter, pos, concepts):
    if not isinstance(lesson, dict):
        rep.err("", "레슨이 객체가 아님")
        return
    extra = set(lesson) - LESSON_KEYS
    if extra:
        rep.err("", "모르는 칸: " + ", ".join(sorted(extra)))
    adv = isinstance(chapter, AdvancedChapter)
    want_id = ("%d-A%d" if adv else "%d-%d") % (chapter, pos)
    if lesson.get("id") != want_id:
        rep.err("id", "%r 이어야 함(파일 안 순서)" % want_id)
    if lesson.get("chapter") != chapter or isinstance(lesson.get("chapter"), bool):
        rep.err("chapter", "%r — 파일 ch%d.js와 다름" % (lesson.get("chapter"), chapter))
    exam = not adv and pos == LESSONS_PER_CHAPTER
    if adv:
        if "isExam" in lesson:
            rep.err("isExam", "심화 레슨에는 isExam을 두지 않음(평가 없음)")
        if lesson.get("isAdvanced") is not True:
            rep.err("isAdvanced", "심화 레슨에는 isAdvanced: true가 필요함")
    else:
        if "isAdvanced" in lesson:
            rep.err("isAdvanced", "본 과정 레슨(LESSONS)에는 isAdvanced를 두지 않음 — 심화는 ADVANCED 목록에")
        if bool(lesson.get("isExam")) != exam or ("isExam" in lesson and not isinstance(lesson["isExam"], bool)):
            rep.err("isExam", "장의 마지막 레슨(%d-%d)만 true" % (chapter, LESSONS_PER_CHAPTER))
    if "updated" in lesson:
        u = lesson["updated"]
        if not isinstance(u, str) or not UPDATED_RE.fullmatch(u):
            rep.err("updated", "%r — \"v0.7.1\"처럼 보강한 판 이름 글자여야 함" % (u,))
    check_text(rep, "title", lesson.get("title"), TITLE_MAX)
    check_text(rep, "goal", lesson.get("goal"), GOAL_MAX)
    summ = lesson.get("summary")
    summ_hi = 4 if lesson.get("updated") else 3  # 판정 C49: 보강 레슨은 새 주제 한 줄을 더할 수 있음
    if not isinstance(summ, list) or not (3 <= len(summ) <= summ_hi):  # 문자열 하나도 여기서 걸림
        rep.err("summary", "정확히 3줄" if summ_hi == 3 else "3~4줄(보강 레슨)")
    else:
        for i, s in enumerate(summ):
            check_text(rep, "summary[%d]" % i, s, SUMMARY_MAX, need_hangul=False)

    # 판정 C48(v0.7.1): 보강한 레슨(updated 있음)은 기존 카드·문제를 지우지 않고 더하므로 한 칸씩 더 둔다
    boosted = "updated" in lesson
    card_hi = 3 if boosted else 2
    cards = lesson.get("cards")
    if not isinstance(cards, list) or not (1 <= len(cards) <= card_hi):
        rep.err("cards", "개념 카드는 1~%d장%s" % (card_hi, "(보강 레슨)" if boosted else ""))
        cards = cards if isinstance(cards, list) else []
    for i, c in enumerate(cards):
        w = "cards[%d]" % i
        if isinstance(c, dict) and "show_only" in c:
            check_show_only_card(rep, w, c)
            continue
        if not isinstance(c, dict) or not (CARD_KEYS <= set(c) <= CARD_KEYS | CARD_OPT):
            rep.err(w, "카드 칸은 say, code, out (+ 선택 stdin, files, server, chart / 또는 show_only)")
            continue
        check_text(rep, w + ".say", c["say"], SAY_MAX, one_line=False)
        if not isinstance(c["code"], str) or not isinstance(c["out"], str):
            rep.err(w, "code와 out은 문자열이어야 함")
            continue
        check_code_shape(rep, w + ".code", c["code"], chapter)
        r = safe_run(rep, w, c["code"], stdin_of(rep, w, c), **env_of(rep, w, c))
        check_main_charts(rep, w, chapter, r)
        why = judge(r, c["out"])
        if why:
            rep.err(w, "코드 실행 결과가 out과 다름 — " + why)
        elif "chart" in c:
            check_run_chart(rep, w, chart_of(rep, w, c), r)
        elif r.get("charts"):
            rep.err(w, "코드가 그림을 그리는데 chart가 없음(카드는 실행하지 않으니 chart를 적어야 그림이 보임)")

    items = lesson.get("items")
    if not isinstance(items, list):
        rep.err("items", "목록이 아님")
        return
    kinds = [i.get("type") if isinstance(i, dict) else None for i in items]  # 객체가 아닌 문제는 None
    touch_hi = 8 if exam else (7 if boosted else 6)
    n_touch = len(items) - 2
    if (kinds.count("write") != 1 or kinds.count("check") != 1 or kinds[-2:] != ["write", "check"]
            or any(k not in TOUCH for k in kinds[:-2])):
        rep.err("items", "터치 문제들 → write 1개 → check 1개 순서여야 함(지금 %s)" % kinds)
    elif not (4 <= n_touch <= touch_hi):
        rep.err("items", "터치 문제는 4~%d개(지금 %d개)" % (touch_hi, n_touch))
    for i, item in enumerate(items):
        check_item(rep, "items[%d] %s" % (i, kinds[i]), item, chapter, concepts)


def check_advanced(advanced, chapter, concepts):
    """장 파일의 ADVANCED(심화 레슨 3개, N-A1~N-A3) 점검 → (파일 오류 목록, [레슨별 Lesson])."""
    if not isinstance(advanced, list):
        return ["export const ADVANCED = [...] 는 레슨 목록이어야 함"], []
    errs = []
    if len(advanced) != ADVANCED_PER_CHAPTER:
        errs.append("심화 레슨은 %d개여야 함(지금 %d개)" % (ADVANCED_PER_CHAPTER, len(advanced)))
    ids = [l.get("id") if isinstance(l, dict) else None for l in advanced]
    ids = [i if isinstance(i, (str, int, type(None))) else repr(i) for i in ids]
    if len(set(ids)) != len(ids):
        errs.append("심화 레슨 id 중복: %s" % ids)
    reps = []
    for pos, lesson in enumerate(advanced, 1):
        label = lesson.get("id", "?") if isinstance(lesson, dict) else "?"
        rep = Lesson(label if isinstance(label, str) else repr(label))
        try:
            check_lesson(rep, lesson, AdvancedChapter(chapter), pos, concepts)
        except Exception as e:  # noqa: BLE001
            rep.err("", "형식이 잘못되어 점검을 마치지 못함(%s: %s)" % (type(e).__name__, e))
        reps.append(rep)
    return errs, reps


def advanced_file_errors(found_adv, upto):
    """--advanced N: 1~N장 파일에 ADVANCED가 모두 있어야 함."""
    if upto is None:
        return []
    lack = [c for c in range(1, upto + 1) if c not in found_adv]
    return ["--advanced %d: 심화 레슨(ADVANCED)이 없는 장: %s" % (upto, ", ".join("ch%d.js" % c for c in lack))] if lack else []


def check_show_only_card(rep, w, c):
    """show_only 카드(판정 C38): 보여 주기만 하는 코드. 실행·문법·모듈 검사 없이 줄 폭만 본다."""
    if c.get("show_only") is not True:
        rep.err(w, "show_only는 true만 씀(돌리는 카드면 칸을 지움)")
        return
    extra = set(c) - {"say", "code", "out", "show_only"}
    if extra or not {"say", "code"} <= set(c):
        rep.err(w, "show_only 카드 칸은 say, code, show_only (+ 빈 out) — 함께 못 쓰는 칸: %s"
                % ", ".join(sorted(extra)) if extra else "show_only 카드에는 say와 code가 필요함")
        return
    if c.get("out", "") != "":
        rep.err(w, "show_only 카드는 실행하지 않으므로 out을 비움(\"\" 또는 칸 없음)")
    check_text(rep, w + ".say", c["say"], SAY_MAX, one_line=False)
    if not isinstance(c["code"], str) or not c["code"].strip():
        rep.err(w, "code가 비어 있거나 문자열이 아님")
        return
    for n, line in enumerate(c["code"].split("\n"), 1):
        if width(line) > CODE_COLS:
            rep.err(w + ".code", "%d번째 줄이 휴대폰 화면보다 넓음(%d칸 > %d칸): %s" % (n, width(line), CODE_COLS, line))
        if "\t" in line:
            rep.err(w + ".code", "탭 문자 대신 빈칸 4개를 씀")


def check_exam_coverage(rep, lessons):
    """장 평가는 그 장 레슨들의 핵심 개념(직접 작성 문제의 concept)을 모두 다룬다."""
    core = []
    for l in lessons[:-1]:
        for it in l.get("items") or []:
            if isinstance(it, dict) and it.get("type") == "write" and it.get("concept") not in core:
                core.append(it.get("concept"))
    have = {it.get("concept") for it in lessons[-1].get("items") or [] if isinstance(it, dict)}
    lack = [c for c in core if c not in have]
    if lack:
        rep.err("items", "장 평가에 빠진 개념: " + ", ".join(map(str, lack)))


# ── 매일 도전 틀 TEMPLATES (v0.9 작업 2, 판정 C54) ─────────────────────────
# 형식은 docs/lesson-writing-guide.md 7절과 src/template.js. 이 묶음은 다른 검사와 따로 둔다(심화 규칙과 섞지 않음).
# 값 바꿔 끼우기는 앱과 똑같이 src/template.js의 instantiate를 node로 불러 만든다(씨앗 0~99 × 시도 0~4).
# 그 코드를 CPython runner로 돌리고 judge_instance(= template.js judgeInstance와 같은 규칙)로 판정한다.
TEMPLATE_SEEDS = 100
TEMPLATE_ATTEMPTS = 5
TEMPLATE_RUN_SECONDS = 1.0     # 틀 코드 한 번 실행이 이 시간 안에 끝나야 함(앱이 하루 문제를 만들 때 기다리는 시간)
TEMPLATE_MIN = 4               # --templates N: 1~N장마다 틀 이 개수 이상
OPTION_COLS = 30               # 보기 한 줄 폭(src/template.js OPTION_COLS)
TEMPLATE_KEYS = {
    "choice": ({"id", "concept", "type", "q", "code", "vars", "wrong", "explain"}, {"stdin"}),
    "blank": ({"id", "concept", "type", "q", "code", "vars", "chips", "answer", "explain"}, {"stdin"}),
}
TPL_VAR = re.compile(r"\{([A-Z][A-Z0-9_]*)\}")
TPL_VAR_KEY = re.compile(r"[A-Z][A-Z0-9_]*")
TPL_OUT = "OUT"
TPL_VALUE_BAD = re.compile(r'["\'\\\n{}]')


def instantiate_templates(templates):
    """{틀 id: [씨앗][시도] → 바꿔 끼운 한 벌}. src/template.js instantiate를 그대로 쓴다."""
    lib = "file://" + os.path.join(ROOT, "src", "template.js")
    script = (
        "const [libUrl, seeds, attempts] = process.argv.slice(1);"
        "const lib = await import(libUrl);"
        "const fs = await import('node:fs');"
        "const tpls = JSON.parse(fs.readFileSync(0, 'utf8')); const out = {};"
        "for (const t of tpls) { out[t.id] = []; for (let s = 0; s < +seeds; s++) { const row = [];"
        "  for (let a = 0; a < +attempts; a++) row.push(lib.instantiate(t, s, a)); out[t.id].push(row); } }"
        "process.stdout.write(JSON.stringify(out));"
    )
    r = subprocess.run(["node", "--input-type=module", "-e", script, lib, str(TEMPLATE_SEEDS), str(TEMPLATE_ATTEMPTS)],
                       input=json.dumps(templates), capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or "node 실행 실패")
    return json.loads(r.stdout)


def template_run_list(inst):
    """src/template.js runList와 같음"""
    if inst["type"] == "blank":
        return [inst["code"].replace("___", c) for c in inst["chips"]]
    return [inst["code"]] + list(inst["wrong"])


def judge_instance(inst, results):
    """src/template.js judgeInstance와 같은 규칙. 문제가 되면 None, 아니면 이유(dup·answer-error·empty·multiline·wide)."""
    def text(r):
        return None if r["error"] else normalize(r["stdout"])
    ai = inst["answer"] if inst["type"] == "blank" else 0
    ans = text(results[ai])
    if ans is None:
        return "answer-error"
    if not ans:
        return "empty"
    if inst["type"] == "blank":
        if "{OUT}" in (inst.get("q") or "") + (inst.get("explain") or "") and "\n" in ans:
            return "multiline"
        if any(i != ai and text(r) == ans for i, r in enumerate(results)):
            return "dup"
        return None
    opts = [("오류가 나요" if LANG == "ko" else EN_ERROR_OPTION) if text(r) is None else text(r) for r in results]
    if any("\n" in o for o in opts):
        return "multiline"
    if any(not o.strip() for o in opts):
        return "empty"
    if any(width(o) > OPTION_COLS for o in opts):
        return "wide"
    if len(set(opts)) != len(opts):
        return "dup"
    return None


def _template_values_ok(rep, where, key, v):
    if isinstance(v, list):
        if not (2 <= len(v) <= 40):
            rep.err(where, "vars.%s 목록은 값 2~40개" % key)
            return False
        for x in v:
            if isinstance(x, bool) or not isinstance(x, (str, int)) or (isinstance(x, str) and (not x.strip() or TPL_VALUE_BAD.search(x))):
                rep.err(where, "vars.%s 의 값 %r — 글자(따옴표·역슬래시·중괄호·줄바꿈 없음) 또는 정수만" % (key, x))
                return False
        if len(set(map(str, v))) != len(v):
            rep.err(where, "vars.%s 목록에 같은 값이 두 번 있음" % key)
            return False
        return True
    if isinstance(v, dict) and set(v) == {"min", "max"}:
        lo, hi = v["min"], v["max"]
        if (not isinstance(lo, int) or not isinstance(hi, int) or isinstance(lo, bool) or isinstance(hi, bool)
                or not (lo < hi) or abs(lo) > 10 ** 6 or abs(hi) > 10 ** 6):
            rep.err(where, "vars.%s 는 {min, max} 정수이고 min < max (절댓값 100만 이하)" % key)
            return False
        return True
    rep.err(where, "vars.%s 는 값 목록 [..] 또는 {min, max}" % key)
    return False


def _template_schema(rep, t, chapter, concepts):
    """틀 하나의 모양. 실행해 볼 만하면 True."""
    kind = t.get("type")
    if kind not in TEMPLATE_KEYS:
        rep.err("type", "틀의 type은 choice 또는 blank (지금 %r)" % (kind,))
        return False
    need, opt = TEMPLATE_KEYS[kind]
    missing, extra = need - set(t), set(t) - need - opt
    if missing:
        rep.err("", "빠진 칸: " + ", ".join(sorted(missing)))
    if extra:
        rep.err("", "모르는 칸: " + ", ".join(sorted(extra)))
    if missing:
        return False
    ok = not extra
    if not re.fullmatch(r"%d-T[1-9]\d*" % chapter, str(t.get("id"))):
        rep.err("id", "틀 id %r 는 %d-T1, %d-T2 … 모양" % (t.get("id"), chapter, chapter))
        ok = False
    c = t.get("concept")
    if not isinstance(c, str) or c not in concepts:
        rep.err("concept", "개념 %r 이 concepts.js에 없음" % (c,))
        ok = False
    elif isinstance(concepts[c], AdvancedChapter):
        rep.err("concept", "심화 개념 %s 은 틀에 쓰지 않음(틀은 본 과정 수준)" % c)
        ok = False
    elif concepts[c] > chapter:
        rep.err("concept", "개념 %s 은 %d장 개념이라 %d장 틀에서 쓸 수 없음" % (c, concepts[c], chapter))
        ok = False
    for k in ("q", "code", "explain") + (("stdin",) if "stdin" in t else ()):
        if not isinstance(t.get(k), str) or (k != "stdin" and not t[k].strip()):
            rep.err(k, "%s 는 비어 있지 않은 글자" % k)
            ok = False
    if not ok:
        return False
    vars_ = t.get("vars")
    if not isinstance(vars_, dict) or not (1 <= len(vars_) <= 6):
        rep.err("vars", "vars는 {이름: 값들} 1~6개")
        return False
    for key, v in vars_.items():
        if not TPL_VAR_KEY.fullmatch(key):
            rep.err("vars", "값 이름 %r 은 대문자로(예: N, NAME) — 코드의 소문자 변수와 헷갈리지 않게" % key)
            ok = False
        elif key == TPL_OUT:
            rep.err("vars", "OUT은 정답 출력 자리라 값 이름으로 못 씀")
            ok = False
        elif not _template_values_ok(rep, "vars", key, v):
            ok = False
    if kind == "choice":
        w = t.get("wrong")
        if not isinstance(w, list) or not (2 <= len(w) <= 3) or not all(isinstance(x, str) and x.strip() for x in w):
            rep.err("wrong", "wrong은 오답 코드 2~3개(글자)")
            return False
        if "___" in t["code"]:
            rep.err("code", "choice 틀 code에는 ___ 를 쓰지 않음")
            ok = False
    else:
        if t["code"].count("___") != 1:
            rep.err("code", "blank 틀 code에 빈칸 ___ 이 정확히 하나여야 함")
            ok = False
        if not check_index(rep, "chips", t, "chips", 3, 4):
            return False
        if any("___" in x for x in t["chips"]):
            rep.err("chips", "칩에 ___ 가 들어 있음")
            ok = False
    # 자리 표시: code 쪽은 vars만, q·explain은 vars + OUT. 어디에도 안 쓰는 값은 오류(바꿔 끼워도 문제가 그대로)
    code_side = [t["code"], t.get("stdin", "")] + list(t.get("wrong") or []) + list(t.get("chips") or [])
    names = set(vars_)
    for where, texts, allowed in (("code", code_side, names), ("q", [t["q"]], names | {TPL_OUT}),
                                  ("explain", [t["explain"]], names | {TPL_OUT})):
        for x in texts:
            for m in TPL_VAR.findall(x):
                if m not in allowed:
                    rep.err(where, "모르는 자리 표시 {%s}%s" % (m, " — {OUT}은 q·explain에서만" if m == TPL_OUT else ""))
                    ok = False
    used = set(TPL_VAR.findall("\n".join(code_side + [t["q"], t["explain"]])))
    for key in sorted(names - used):
        rep.err("vars", "쓰지 않는 값 %s (어디에도 {%s} 가 없음)" % (key, key))
        ok = False
    return ok


def _check_one_template(rep, t, insts, chapter, stats):
    msgs = set()

    def once(where, msg):
        if (where, msg) not in msgs:
            msgs.add((where, msg))
            rep.err(where, msg)

    for seed, row in enumerate(insts):
        made = False
        for attempt, inst in enumerate(row):
            results = []
            for code in template_run_list(inst):
                t0 = time.time()
                r = safe_run(rep, "씨앗 %d" % seed, code, inst["stdin"])
                took = time.time() - t0
                results.append(r)
                if took > TEMPLATE_RUN_SECONDS:
                    rep.err("씨앗 %d" % seed, "실행이 %g초를 넘음(%.2f초) — 틀 코드는 짧게" % (TEMPLATE_RUN_SECONDS, took))
                    return
            why = judge_instance(inst, results)
            if why == "dup":
                continue
            if why:
                e = results[inst["answer"] if inst["type"] == "blank" else 0]["error"]
                detail = {
                    "answer-error": "정답 코드가 오류 %s: %s" % ((e or {}).get("type"), (e or {}).get("msg")),
                    "empty": "정답 코드의 출력이 비어 있음",
                    "multiline": "출력이 여러 줄 — 보기와 {OUT}은 한 줄 출력만",
                    "wide": "보기가 화면보다 넓음(%d칸 넘음)" % OPTION_COLS,
                }[why]
                rep.err("씨앗 %d" % seed, "%s — 코드: %s" % (detail, inst["code"].replace("\n", " ⏎ ")))
                return
            made = True
            stats["retried"] += 1 if attempt else 0
            for where, val, lim in (("q", inst["q"], Q_MAX), ("explain", inst["explain"], EXPLAIN_MAX)):
                filled = val.replace("{OUT}", normalize(results[inst["answer"] if inst["type"] == "blank" else 0]["stdout"]))
                sub = Lesson("")
                check_text(sub, where, filled, lim, one_line=(where == "q"))
                for e in sub.errors:
                    once("", e)
            for code in template_run_list(inst):
                sub = Lesson("")
                check_code_shape(sub, "code", code, chapter)
                for e in sub.errors:
                    once("", e)
            break
        if not made:
            rep.err("씨앗 %d" % seed, "%d번 안에 겹치지 않는 보기를 못 만듦 — 오답 코드·칩이 정답과 자주 같은 출력" % TEMPLATE_ATTEMPTS)
            return
        stats["instances"] += 1


def check_templates(templates, chapter, concepts):
    """장 하나의 TEMPLATES 검사. 돌려줌 (오류 목록, {"instances": 문제가 된 씨앗 수, "retried": 다시 만든 수, "count": 틀 수})"""
    errors, stats = [], {"instances": 0, "retried": 0, "count": 0}
    if not isinstance(templates, list):
        return ["TEMPLATES는 목록 [...]"], stats
    seen, good, reps = set(), [], []
    for i, t in enumerate(templates):
        label = t.get("id") if isinstance(t, dict) and isinstance(t.get("id"), str) else "#%d" % (i + 1)
        rep = Lesson(label)
        reps.append(rep)
        if not isinstance(t, dict):
            rep.err("", "틀이 객체가 아님")
            continue
        if label in seen:
            rep.err("id", "틀 id 중복")
            continue
        seen.add(label)
        if _template_schema(rep, t, chapter, concepts):
            good.append((rep, t))
    stats["count"] = len(templates)
    if good:
        insts = instantiate_templates([t for _, t in good])
        for rep, t in good:
            _check_one_template(rep, t, insts[t["id"]], chapter, stats)
    for rep in reps:
        errors += ["틀 %s: %s" % (rep.label, e) for e in rep.errors]
    return errors, stats


def template_count_errors(counts, upto):
    """--templates N: 1~N장마다 틀이 TEMPLATE_MIN개 이상. counts = {장: 틀 수}"""
    if not upto:
        return []
    return ["--templates %d: %d장 틀이 %d개(%d개 이상 필요)" % (upto, c, counts.get(c, 0), TEMPLATE_MIN)
            for c in range(1, upto + 1) if counts.get(c, 0) < TEMPLATE_MIN]


def parse_templates(argv):
    """--templates N: 1~N장에 틀이 TEMPLATE_MIN개 이상 있어야 함. 없으면 None."""
    if "--templates" not in argv:
        return None
    i = argv.index("--templates")
    if i + 1 < len(argv) and argv[i + 1].isdigit() and int(argv[i + 1]) >= 1:
        return int(argv[i + 1])
    return None


def main(argv):
    global LANG, LESSON_DIR
    if "--lang" in argv:
        i = argv.index("--lang")
        val = argv[i + 1] if i + 1 < len(argv) else ""
        if val not in ("ko", "en"):
            print("--lang ko|en (받은 값: %r)" % val)
            return 2
        if val == "en":
            LANG = "en"
            LESSON_DIR = os.path.join(ROOT, "data", "lessons", "en")
        argv = argv[:i] + argv[i + 2:]
    full = parse_full(argv)  # None | 0(있는 장 수) | N
    adv_upto = parse_advanced(argv)  # None | N(1~N장에 심화가 있어야 함)
    tpl_upto = parse_templates(argv)  # None | N(1~N장에 매일 도전 틀이 4개 이상)
    tpl_counts, tpl_total = {}, 0
    failed = 0
    adv_total, found_adv = 0, []

    # 개념 목록
    if not os.path.exists(CONCEPTS_FILE):
        print("✗ data/concepts.js 가 없음")
        return 1
    files = sorted((f for f in os.listdir(LESSON_DIR) if re.fullmatch(r"ch\d+\.js", f)),
                   key=lambda f: int(f[2:-3])) if os.path.isdir(LESSON_DIR) else []
    paths = [CONCEPTS_FILE] + [os.path.join(LESSON_DIR, f) for f in files]
    try:
        mods = load_modules(paths)
    except RuntimeError as e:
        print("✗ 데이터 파일을 읽지 못함:\n" + str(e))
        return 1

    concepts_list = mods[CONCEPTS_FILE].get("CONCEPTS")
    concepts = {}  # id → 처음 배우는 장
    cerr = []
    if not isinstance(concepts_list, list) or not concepts_list:
        cerr.append("CONCEPTS 목록이 없음")
    else:
        for c in concepts_list:
            if not isinstance(c, dict) or not re.fullmatch(r"[a-z][a-z0-9_]*", str(c.get("id", ""))):
                cerr.append("개념 id 형식이 틀림: %r" % (c,))
            elif c["id"] in concepts:
                cerr.append("개념 id 중복: %s" % c["id"])
            elif not isinstance(c.get("name"), str) or not HANGUL.search(c["name"]):
                cerr.append("개념 %s 의 한국어 이름이 없음" % c["id"])
            elif not isinstance(c.get("chapter"), int) or isinstance(c.get("chapter"), bool) or c["chapter"] < 1:
                cerr.append("개념 %s 의 chapter(처음 배우는 장 번호)가 없음" % c["id"])
            elif "advanced" in c and c["advanced"] is not True:
                cerr.append("개념 %s 의 advanced는 true만 씀(본 과정 개념이면 칸을 지움)" % c["id"])
            else:
                # 심화 개념은 AdvancedChapter로 담아 본 과정 레슨에서 못 쓰게 한다(check_item)
                concepts[c["id"]] = AdvancedChapter(c["chapter"]) if c.get("advanced") else c["chapter"]
    print("개념 %d개 %s" % (len(concepts), "✓" if not cerr else "✗"))
    for e in cerr:
        print("    - " + e)
    failed += len(cerr)

    if full == 0:
        full = len(files)
    total = 0
    found = []
    for f in files:
        chapter = int(f[2:-3])
        found.append(chapter)
        mod = mods[os.path.join(LESSON_DIR, f)]
        lessons = mod.get("LESSONS")
        head = mod.get("CHAPTER")
        title = head.get("title") if isinstance(head, dict) else None
        print("\n%s 「%s」" % (f, title or "?"))
        ferr = []
        if not isinstance(head, dict) or head.get("id") != chapter or not isinstance(title, str) or not title:
            ferr.append("export const CHAPTER = { id: %d, title: \"…\" } 가 필요함" % chapter)
        if not isinstance(lessons, list):
            ferr.append("export const LESSONS = [...] 가 없음")
            lessons = []
        if len(lessons) != LESSONS_PER_CHAPTER:
            ferr.append("레슨은 %d개여야 함(지금 %d개)" % (LESSONS_PER_CHAPTER, len(lessons)))
        for e in ferr:
            print("    ✗ " + e)
        failed += len(ferr)
        ids = [l.get("id") if isinstance(l, dict) else None for l in lessons]
        ids = [i if isinstance(i, (str, int, type(None))) else repr(i) for i in ids]
        if len(set(ids)) != len(ids):
            print("    ✗ 레슨 id 중복: %s" % ids)
            failed += 1
        for pos, lesson in enumerate(lessons, 1):
            label = lesson.get("id", "?") if isinstance(lesson, dict) else "?"
            rep = Lesson(label)
            try:
                check_lesson(rep, lesson, chapter, pos, concepts)
                if pos == LESSONS_PER_CHAPTER and len(lessons) == LESSONS_PER_CHAPTER:
                    check_exam_coverage(rep, lessons)
            except Exception as e:  # noqa: BLE001 — 형식이 망가진 레슨도 줄 하나로 알린다
                rep.err("", "형식이 잘못되어 점검을 마치지 못함(%s: %s)" % (type(e).__name__, e))
            total += 1
            d = lesson if isinstance(lesson, dict) else {}
            n_items = len(d["items"]) if isinstance(d.get("items"), list) else 0
            n_cards = len(d["cards"]) if isinstance(d.get("cards"), list) else 0
            name = d.get("title") if isinstance(d.get("title"), str) else ""
            mark = "✓ 통과" if not rep.errors else "✗ 오류 %d" % len(rep.errors)
            print("  %-4s %s  (카드 %d, 문제 %d)  %s" % (label, name, n_cards, n_items, mark))
            for e in rep.errors:
                print("       - " + e)
            failed += len(rep.errors)

        if "ADVANCED" in mod:   # 심화 레슨(v0.7). 아직 없는 장은 건너뜀(--advanced N이면 오류)
            found_adv.append(chapter)
            aerr, areps = check_advanced(mod["ADVANCED"], chapter, concepts)
            print("  ── 심화")
            for e in aerr:
                print("    ✗ " + e)
            failed += len(aerr)
            for lesson, rep in zip(mod["ADVANCED"] if isinstance(mod["ADVANCED"], list) else [], areps):
                adv_total += 1
                d = lesson if isinstance(lesson, dict) else {}
                n_items = len(d["items"]) if isinstance(d.get("items"), list) else 0
                n_cards = len(d["cards"]) if isinstance(d.get("cards"), list) else 0
                name = d.get("title") if isinstance(d.get("title"), str) else ""
                mark = "✓ 통과" if not rep.errors else "✗ 오류 %d" % len(rep.errors)
                print("  %-5s %s  (카드 %d, 문제 %d)  %s" % (rep.label, name, n_cards, n_items, mark))
                for e in rep.errors:
                    print("       - " + e)
                failed += len(rep.errors)

        if "TEMPLATES" in mod:   # 매일 도전 틀(v0.9). 없는 장은 건너뜀(--templates N이면 오류)
            terr, tstats = check_templates(mod["TEMPLATES"], chapter, concepts)
            tpl_counts[chapter] = tstats["count"]
            tpl_total += tstats["count"]
            print("  ── 매일 도전 틀 %d개: 씨앗 %d개 문제 만듦(다시 만든 것 %d) %s"
                  % (tstats["count"], tstats["instances"], tstats["retried"], "✓ 통과" if not terr else "✗ 오류 %d" % len(terr)))
            for e in terr:
                print("       - " + e)
            failed += len(terr)

    for e in template_count_errors(tpl_counts, tpl_upto):
        print("\n✗ " + e)
        failed += 1
    for e in advanced_file_errors(found_adv, adv_upto):
        print("\n✗ " + e)
        failed += 1
    for e in chapter_file_errors(found, full):
        print("\n✗ " + e)
        failed += 1
    planned = full if full is not None else len(found)
    absent = [c for c in range(1, planned + 1) if c not in found]
    note = " (아직 없음: %s)" % ", ".join("ch%d.js" % c for c in absent) if absent else ""
    if found_adv or adv_upto:
        print("\n심화: 레슨 %d개 (%s)" % (adv_total, ", ".join("%d장" % c for c in found_adv) or "없음"))
    if tpl_counts or tpl_upto:
        print("매일 도전 틀: %d개 (%s)" % (tpl_total, ", ".join("%d장 %d" % kv for kv in sorted(tpl_counts.items())) or "없음"))
    print("\n합계: 레슨 %d/%d%s, 오류 %d" % (total, planned * LESSONS_PER_CHAPTER, note, failed))
    return 1 if failed else 0


def chapter_file_errors(found, full=None):
    """있는 장 번호 목록 검사. 1장부터 빠짐없이 이어져야 하고, full=N이면 정확히 1~N장이어야 함."""
    errs = []
    found = sorted(found)
    if found != list(range(1, len(found) + 1)):
        errs.append("장 파일이 1장부터 빠짐없이 이어져야 함: %s" % ", ".join("ch%d.js" % c for c in found))
    if full is not None and found != list(range(1, full + 1)):
        errs.append("--full %d: 1~%d장이 정확히 있어야 함(지금 %s)"
                    % (full, full, ", ".join("ch%d.js" % c for c in found) or "없음"))
    return errs


def parse_advanced(argv):
    """--advanced N: 1~N장에 심화 레슨이 있어야 함. 없으면 None."""
    if "--advanced" not in argv:
        return None
    i = argv.index("--advanced")
    if i + 1 < len(argv) and argv[i + 1].isdigit() and int(argv[i + 1]) >= 1:
        return int(argv[i + 1])
    return None


def parse_full(argv):
    """--full [N]. 없으면 None, N을 빼면 있는 장 파일 수를 쓰도록 0을 돌려줌(main에서 바꿈)."""
    if "--full" not in argv:
        return None
    i = argv.index("--full")
    if i + 1 < len(argv) and argv[i + 1].isdigit() and int(argv[i + 1]) >= 1:
        return int(argv[i + 1])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
