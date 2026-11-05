"""학습자 코드를 실행하고 결과를 dict로 돌려준다.

CPython 3.13(시험)과 Pyodide(Python 3.14, Web Worker 안)에서 같이 돈다.
스레드·시그널·네트워크를 쓰지 않는다. 시간 제한은 바깥(작업자 종료)에서 건다.

격리(검토 C18 I2): 실행마다 builtins 전체·재귀 한도·sys.modules 목록을 저장해 두었다가 되돌린다.
알려진 한계:
- 이미 import되어 있던 표준 모듈을 학습자가 고치는 것(예: math.pi = 3)은 되돌리지 않는다.
  이런 변경은 같은 작업자의 다음 실행에 남는다.
- 실행 중 새로 import된 모듈은 sys.modules에서 지워 다음 실행에서 새로 불러오게 한다.
  C 확장처럼 다시 import할 수 없거나 두 번째 import에서 상태가 어긋나는 모듈은
  이 방식으로 깨끗이 되돌릴 수 없다(그럴 때는 작업자를 새로 띄우는 수밖에 없다).

학습자가 builtins를 지우거나 바꿔도(예: del builtins.str) runner가 결과를 돌려주도록,
학습자 코드가 도는 동안 불리는 runner 코드는 아래 _len·_str 같은 모듈 변수만 쓰고,
결과(dict) 만들기는 finally에서 builtins를 되돌린 뒤에 한다.

가상 파일·연습 서버(v0.4 E1·E2):
- 실행마다 새 임시 폴더를 만들어 작업 위치(cwd)로 삼고, files(이름 → 글자)를 UTF-8로 써 둔다.
  끝나면 원래 위치로 돌아가고 폴더를 통째로 지운다(학습자가 만든 파일도). 실행 사이에 흔적이 없다.
  files가 없어도 빈 폴더에서 돈다. 절대 경로로 다른 곳에 쓰는 것까지 막지는 않는다.
- server(주소 → {"status": int, "body": str, "type"?: str})가 있으면 실행 동안
  urllib.request.urlopen이 이 표에서 답한다(소켓을 열지 않음). 표에 없는 주소는 URLError,
  status 400 이상은 HTTPError. 끝나면 진짜 urlopen으로 되돌린다. server가 None이면 손대지 않는다.

차트(v0.5 E3): 실행마다 새 `chart` 모듈을 sys.modules에 넣는다(끝나면 지워져 실행 사이에 상태가 없다).
  matplotlib.pyplot과 거의 같은 이름(line만 pyplot에서는 plot): bar(이름들, 값들), line(이름들, 값들), title(글), xlabel(글), ylabel(글), legend(선 이름들), show().
  show()가 그림 하나를 결과의 charts에 넣고 그림을 비운다. show() 없이 끝나면 그리지 않는다. 한 실행에 CHART_MAX개까지.
  인자는 차례로만 받는다(color= 같은 이름 붙은 인자는 한국어 TypeError). 이름은 글자로 바꿔 담고, 값은 JSON에 넣을 수 있는 수(int·float, bool·nan·inf 아님).
  그림 하나에 막대는 하나만. 꺾은선은 같은 이름들(가로축)로 CHART_LINES_MAX개까지 겹칠 수 있다(v0.9, 17장 심화).
  막대와 꺾은선은 섞지 않는다. legend(이름들)는 선 이름표 — 부르는 차례는 line 앞뒤 상관없고, show() 때 개수가 선 수와 같아야 한다.
  그림 모양: 꺾은선 하나이고 legend가 없으면 예전 그대로 {kind, labels, values, …}.
             꺾은선이 둘 이상이거나 legend가 있으면 values 대신 series: [{"name"?: 글, "values": [수]}, …].

텃밭(v0.10, 설계서 2026-11-05 §2): farm(dict)이 있으면 실행마다 새 `farm` 모듈을 sys.modules에 넣고(끝나면 지움)
  명령 move(방향)·plant(작물)·harvest()·can_harvest()·what_here()·store()·where()를 실행 전역에도 미리 넣는다(import 없이 씀,
  `from farm import *`·`import farm`도 됨). print는 그대로 출력하면서 say 사건도 남긴다(표준 출력에 쓸 때만).
  받은 상태는 고치지 않고 다듬은 사본(_farm_state) 위에서 돈다. 시간 1짜리 행동(move·plant·harvest, 실패한
  심기·빈 칸 수확 포함)은 지금 clock에 일어나고 clock += 1. 다 자람: clock − planted_at ≥ 자라는 시간(당근 8,
  감자 12, upgrades에 "비료"면 6·9). 감자는 upgrades에 "감자 씨앗"이 있어야 심어짐.
  한 실행에 행동 FARM_ACTIONS_MAX(500)번까지 — 501번째에 FarmTired(BaseException)로 멈추고, 학습자가 except로
  삼켜도 추적 함수가 학습자 코드 다음 줄에서 다시 던진다. 결과는 오류가 아니라 stopped "tired".
  확인(can_harvest·what_here·store·where, 시간 0)은 한 실행에 FARM_CHECKS_MAX(2000)번까지 — 2001번째에 같은 방식으로 멈추고
  stopped "waited"(`while not can_harvest(): pass`처럼 시간이 흐르지 않는 기다리기, 판정 C60). 확인은 사건을 남기지 않는다.
  v0.11(설계서 2026-11-05 6~9장 §1): store()는 창고 사본 {"당근": n, "감자": n}(새 dict — 바꿔도 진짜 창고·결과는
  그대로, 없는 작물 이름은 KeyError), where()는 파이의 자리 튜플 (x, y). 둘 다 확인 하나로 세고 사건은 없다(사건 모양 그대로).
  둘 중 먼저 걸린 이유가 stopped에 남고, 멈춘 뒤로는 행동·확인 모두 다시 던진다.
  result["farm"] = {
      "events": [ {"t": "move", "line", "dir", "x", "y"}            # x, y = 움직인 뒤 자리
                | {"t": "plant", "line", "crop", "x", "y"}
                | {"t": "plant_fail", "line", "reason": "occupied" | "no_seed", "crop", "x", "y"}
                | {"t": "harvest", "line", "crop", "x", "y"}          # 다 자람 → store[crop] += 1
                | {"t": "harvest_young", "line", "crop", "x", "y"}    # 덜 자람 → 작물만 사라짐
                | {"t": "harvest_empty", "line", "x", "y"}            # 빈 칸(시간은 1 듦)
                | {"t": "say", "line", "text"} ],                     # print 한 번(끝 줄바꿈 뺌, 40자까지)
                # line: 그 명령을 부른 학습자 코드 줄(가장 안쪽). say는 FARM_SAYS_MAX(100)개까지만 남긴다(넘는 print는
                # 출력만). 시간 1짜리 사건은 행동 상한(500) 안이라 하나도 버리지 않는다 → 사건만으로 끝 상태를 다시 만들 수 있다.
      "state": {"size", "cells": [None | {"crop", "planted_at"}] (y*size+x), "pie": {"x", "y"},
                "clock", "store": {"당근", "감자"}, "upgrades": [str]},   # 끝 상태(오류가 나도 그 직전까지)
      "stopped": None | "tired" | "waited", "actions": int }   # actions: 이번 실행의 시간 1짜리 행동 수
  결과 farm은 학습자 코드가 닫힘으로 상태·사건을 건드렸어도 다시 다듬은 사본이다(JSON 모양, nan 없음).
  규칙 표는 실행마다 바꿀 수 없는 원본에서 새로 만들고, 이 모듈의 전역 이름은 실행이 끝나면 되돌린다(검토 C62 I1).
  farm=None이면 result에 "farm"이 없다(예전 그대로).

run(code, stdin, require, files=None, server=None, farm=None) -> {
    "stdout": str, "stderr": str,
    "error": None | {"type": str, "line": int | None, "msg": str},
    "missing": [str, ...],   # require 중 코드에 없는 것(ast 마디 이름, Call:/Name:/Method:/Def:/SQL:, Comment·Elif·Else, SelfCall·FormatSpec·TripleStr, NamedGroup·Reraise)
    "charts": [{"kind": "bar" | "line", "labels": [str], "values": [int | float],
                "title"?: str, "xlabel"?: str, "ylabel"?: str}
               | {"kind": "line", "labels": [str], "series": [{"name"?: str, "values": [...]}, ...], ...}, ...],
}
stdin은 "12\n30" 같은 문자열(레슨 데이터 형식) 또는 문자열 목록.

"""

import ast
import builtins
import io
import linecache
import os
import shutil
import sys
import tempfile
import tokenize
import traceback

USER_FILE = "<user>"
OUTPUT_LIMIT = 100_000  # stdout + stderr 합계 글자 수

# 학습자 코드가 builtins를 지워도 쓸 수 있게 미리 잡아 둔다.
_len = len
_str = str
_BaseException = BaseException
_StringIO_write = io.StringIO.write
_isinstance = isinstance
_getattr = getattr
_chdir = os.chdir
_getcwd = os.getcwd
_rmtree = shutil.rmtree
_BytesIO = io.BytesIO

NO_SUCH_URL = "연습 서버에 없는 주소예요"


class InputMissing(BaseException):
    """input()이 stdin 값보다 많이 불렸을 때.

    BaseException을 이어받아 학습자의 `except Exception:`에 삼켜지지 않게 한다.
    """


class OutputLimit(BaseException):
    """출력이 OUTPUT_LIMIT 글자를 넘었을 때(끝없는 print 반복 등)."""


def _caller_user_line():
    f = sys._getframe(1)
    while f is not None:
        if f.f_code.co_filename == USER_FILE:
            return f.f_lineno
        f = f.f_back
    return None


class _CappedIO(io.StringIO):
    """stdout·stderr가 함께 쓰는 글자 수 한도를 지키는 출력 통.

    close()는 아무 일도 하지 않는다(학습자가 sys.stdout.close()를 불러도 결과를 읽을 수 있게).
    """

    def __init__(self, state):
        super().__init__()
        self._state = state

    def write(self, s):
        s = _str(s)
        left = OUTPUT_LIMIT - self._state["used"]
        if _len(s) > left:
            if left > 0:
                _StringIO_write(self, s[:left])
            self._state["used"] = OUTPUT_LIMIT
            if self._state["output_limit"] is None:
                self._state["output_limit"] = _caller_user_line()
            raise OutputLimit("output is longer than %d characters" % OUTPUT_LIMIT)
        self._state["used"] += _len(s)
        return _StringIO_write(self, s)

    def raw_write(self, s):
        """runner 자신이 쓰는 오류 원문. 한도를 세지 않는다."""
        return _StringIO_write(self, s)

    def close(self):
        pass


def _split_stdin(stdin):
    if stdin is None:
        return []
    if isinstance(stdin, str):
        items = stdin.split("\n")
        if items and items[-1] == "":
            items.pop()
        return items
    return [str(v) for v in stdin]


def _make_input(values, out, state):
    queue = list(values)

    def fake_input(prompt=""):
        # 진짜 Python처럼 안내 문구를 줄바꿈 없이 표준 출력에 쓴다.
        if prompt:
            out.write(_str(prompt))
        if not queue:
            if state["input_missing"] is None:
                state["input_missing"] = _caller_user_line()
            raise InputMissing("input() needed more values than were given")
        return _str(queue.pop(0))

    return fake_input


def _user_line(tb):
    line = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == USER_FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def _user_tb(tb):
    """runner 자신의 프레임을 건너뛰고 학습자 코드부터 시작하는 traceback."""
    while tb is not None and tb.tb_frame.f_code.co_filename != USER_FILE:
        tb = tb.tb_next
    return tb


def _safe_str(e):
    try:
        return str(e)
    except BaseException:  # noqa: BLE001 — __str__이 깨진 예외
        return type(e).__name__


def _format_tb(e, tb):
    try:
        return "".join(traceback.format_exception(type(e), e, tb))
    except BaseException:  # noqa: BLE001
        return "%s: %s\n" % (type(e).__name__, _safe_str(e))


def _has_comment(code):
    """코드에 # 주석이 하나라도 있나(tokenize로 봄 — 문자열 안의 #은 주석이 아님)."""
    try:
        for tok in tokenize.generate_tokens(io.StringIO(code).readline):
            if tok.type == tokenize.COMMENT:
                return True
    except BaseException:  # noqa: BLE001 — compile을 통과한 코드라 드묾
        return False
    return False


def _has_triple_str(code):
    """코드에 세 따옴표 문자열(\"\"\"…\"\"\" 또는 '''…''')이 있나(판정 C45).
    tokenize로 문자열 토큰의 앞머리(r·b·f 같은 글자 뒤)를 본다 — 주석 안의 \"\"\"은 셈하지 않음.
    3.12부터 f-문자열은 FSTRING_START 토큰(3.14의 t-문자열은 TSTRING_START)으로 따로 나온다."""
    kinds = {tokenize.STRING}
    for extra in ("FSTRING_START", "TSTRING_START"):
        if hasattr(tokenize, extra):
            kinds.add(getattr(tokenize, extra))
    try:
        for tok in tokenize.generate_tokens(io.StringIO(code).readline):
            if tok.type in kinds:
                body = tok.string.lstrip("rRbBuUfFtT")
                if body.startswith('"""') or body.startswith("'''"):
                    return True
    except BaseException:  # noqa: BLE001
        return False
    return False


def _has_self_call(tree):
    """어떤 def 함수가 자기 본문 안에서 자기 이름으로 자신을 부르나(직접 재귀, 판정 C45).
    단순 규칙: 함수 f의 본문(body) 어디든 — 안쪽 def·lambda 안이라도 — f(...) 호출이 있으면 셈.
    안쪽에서 같은 이름을 다시 정의해 가리는 경우는 따지지 않는다. 함수 밖의 f(...),
    obj.f(...) 같은 점 호출, 서로 부르는 두 함수(f→g→f), lambda에 붙인 이름은 세지 않는다."""
    for fn in ast.walk(tree):
        if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for stmt in fn.body:
                for node in ast.walk(stmt):
                    if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                            and node.func.id == fn.name):
                        return True
    return False


def _is_elif(node, lines):
    """If 마디가 elif로 쓰였나. ast는 elif와 「else: 아래 if」를 똑같이 만들므로
    마디가 시작하는 자리(줄·바이트 칸)의 원문이 elif로 시작하는지 본다."""
    try:
        line = lines[node.lineno - 1].encode("utf-8")
        return line[node.col_offset:].startswith(b"elif")
    except BaseException:  # noqa: BLE001
        return False


def _missing(tree, require, code=""):
    if not require:
        return []
    # require 항목(판정 C26):
    #   "If"          — 그 종류의 ast 마디가 있음
    #   "Call:type"   — 이름으로 부르는 호출 type(...) (obj.type(...)은 아님)
    #   "Name:count"  — 변수 count를 어딘가에서 읽음(ast.Name, Load)
    #   "Method:get"  — 점으로 부르는 호출 d.get(...) (판정 C34, 그냥 get(...)은 아님)
    # 판정 C44(ast 마디 이름이 아닌 세 가지):
    #   "Comment"     — # 주석이 하나라도 있음(문자열 안의 #은 아님)
    #   "Elif"        — elif로 쓴 갈래가 있음(else: 아래에 따로 쓴 if는 아님)
    #   "Else"        — if·for·while·try에 elif가 아닌 else: 가 있음(a if c else b 식은 아님)
    # 판정 C45(심화 레슨용):
    #   "SelfCall"    — def 함수가 자기 본문 안에서 자기 이름으로 자신을 부름(직접 재귀)
    #   "FormatSpec"  — f-문자열 {…} 안에 :서식이 있음({x:>8}, {n:,}, {v:.2f}).
    #                   {x!r}만 있거나 {x:}처럼 비었거나 format()·.format()은 아님
    #   "TripleStr"   — 세 따옴표 문자열 리터럴(""" 또는 ''', f-문자열 포함, 주석 안은 아님)
    # v0.8(12장 심화):
    #   "NamedGroup"  — 글자 상수 안에 (?P< 가 있음(이름 붙인 묶음, 패턴을 변수에 담아도 됨, 주석 안은 아님)
    # v0.8(10장 심화):
    #   "Reraise"     — except 블록 안의 맨 raise(받은 오류를 그대로 다시 던짐). raise ValueError(e)·except 밖의 raise는 아님
    # v0.9(13~17장 심화):
    #   "Def:__str__" — 그 이름의 def가 어딘가에 있음(클래스 안 메서드도). 부르기만 하거나 lambda에 이름 붙인 것은 아님
    #   "SQL:JOIN"    — 글자 상수(이어 붙인 글자, f-문자열의 글자 부분 포함) 안에 그 낱말이 있음.
    #                   대소문자 무시, 앞뒤가 영문자·숫자·_가 아니어야 함(JOINED·re_join은 아님). 주석·변수 이름은 아님
    lines = code.splitlines()
    sql_words = [name[4:] for name in require if name.startswith("SQL:") and name[4:]]
    texts = []
    found = set()
    for node in ast.walk(tree):
        found.add(type(node).__name__)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            found.add("Call:" + node.func.id)
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            found.add("Method:" + node.func.attr)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            found.add("Name:" + node.id)
        if isinstance(node, (ast.If, ast.For, ast.AsyncFor, ast.While, ast.Try)) and node.orelse:
            if (isinstance(node, ast.If) and len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If)
                    and _is_elif(node.orelse[0], lines)):
                found.add("Elif")
            else:
                found.add("Else")
        elif isinstance(node, getattr(ast, "TryStar", ())) and node.orelse:
            found.add("Else")
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if "(?P<" in node.value:
                found.add("NamedGroup")
            if sql_words:
                texts.append(node.value)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            found.add("Def:" + node.name)
        if isinstance(node, ast.ExceptHandler) and any(
                isinstance(r, ast.Raise) and r.exc is None for st in node.body for r in ast.walk(st)):
            found.add("Reraise")
        if isinstance(node, ast.FormattedValue) and node.format_spec is not None:
            spec = node.format_spec
            if not (isinstance(spec, ast.JoinedStr) and not spec.values):
                found.add("FormatSpec")
    if "Comment" in require and _has_comment(code):
        found.add("Comment")
    if "SelfCall" in require and _has_self_call(tree):
        found.add("SelfCall")
    if "TripleStr" in require and _has_triple_str(code):
        found.add("TripleStr")
    if sql_words:
        import re
        for w in sql_words:
            pat = re.compile(r"(?<![A-Za-z0-9_])" + re.escape(w) + r"(?![A-Za-z0-9_])", re.IGNORECASE)
            if any(pat.search(t) for t in texts):
                found.add("SQL:" + w)
    return [name for name in require if name not in found]


def _make_run_dir(files):
    """새 임시 폴더를 만들고 files를 써 둔 뒤 그 경로를 돌려준다."""
    d = tempfile.mkdtemp(prefix="ria-run-")
    root = os.path.realpath(d)
    for name, text in (files or {}).items():
        path = os.path.realpath(os.path.join(root, str(name)))
        if os.path.dirname(path) != root and not path.startswith(root + os.sep):
            continue  # 폴더 밖을 가리키는 이름은 쓰지 않는다(점검기가 막는 형식)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write("" if text is None else str(text))
    return root


def _make_urlopen(server):
    """연습 서버 표로 답하는 가짜 urlopen. 진짜 네트워크(소켓)는 쓰지 않는다."""
    import email.message
    import http
    import urllib.error
    import urllib.response

    class PracticeResponse(urllib.response.addinfourl):
        def getheader(self, name, default=None):
            return self.headers.get(name, default)

        @property
        def reason(self):
            return _phrase(self.code)

    def _phrase(code):
        try:
            return http.HTTPStatus(code).phrase
        except ValueError:
            return ""

    table = {}
    for url, resp in (server or {}).items():
        resp = resp or {}
        status = int(resp.get("status", 200))
        body = resp.get("body", "")
        body = body.encode("utf-8") if _isinstance(body, str) else bytes(body or b"")
        ctype = str(resp.get("type") or "text/plain")
        if "charset" not in ctype:
            ctype += "; charset=utf-8"
        table[str(url)] = (status, body, ctype)

    def urlopen(url, data=None, timeout=None, *args, **kwargs):
        full = _getattr(url, "full_url", url)
        full = _str(full)
        if full not in table:
            raise urllib.error.URLError(NO_SUCH_URL)
        status, body, ctype = table[full]
        headers = email.message.Message()
        headers["Content-Type"] = ctype
        headers["Content-Length"] = _str(_len(body))
        if status >= 400:
            raise urllib.error.HTTPError(full, status, _phrase(status), headers, _BytesIO(body))
        return PracticeResponse(_BytesIO(body), headers, full, status)

    return urlopen


CHART_MAX = 3          # 한 실행에 그릴 수 있는 그림 수
CHART_POINTS_MAX = 24  # 그림 하나의 막대·점 수(휴대폰 폭에서 읽을 수 있는 만큼)
CHART_TEXT_MAX = 40    # 제목·축 이름·항목 이름 글자 수
CHART_LINES_MAX = 3    # 그림 하나에 겹칠 수 있는 꺾은선 수(v0.9, 17장 심화)
_float = float
_int = int
_bool = bool
_list = list
_tuple = tuple
_ValueError = ValueError
_TypeError = TypeError
_type = type
_enumerate = enumerate
_INT_SAFE = 2 ** 53


def _make_chart(charts):
    """실행 하나에 쓰는 새 chart 모듈. 그린 그림은 charts 목록에 쌓인다."""
    import types

    mod = types.ModuleType("chart")
    mod.__doc__ = ("리아와 파이썬! 차트: bar, line, title, xlabel, ylabel, legend, show "
                   "(matplotlib.pyplot과 거의 같은 이름, line은 pyplot의 plot)")
    # kind, labels, lines(꺾은선마다 값 목록 / 막대는 하나), legend, title, xlabel, ylabel
    fig = {}

    def _text(v, what):
        if _isinstance(v, _bool) or not _isinstance(v, (_str, _int, _float)):
            raise _TypeError("%s은 글자나 숫자로 줘요(지금 %s)" % (what, _type(v).__name__))
        s = _str(v)
        if _len(s) > CHART_TEXT_MAX:
            raise _ValueError("%s은 %d글자까지 쓸 수 있어요" % (what, CHART_TEXT_MAX))
        return s

    def _seq(v, what):
        if not _isinstance(v, (_list, _tuple)):
            raise _TypeError("%s은 리스트로 줘요(예: [1, 2, 3])" % what)
        return _list(v)

    def _num(v):
        if _isinstance(v, _bool) or not _isinstance(v, (_int, _float)):
            raise _TypeError("값은 숫자여야 해요(지금 %s)" % _type(v).__name__)
        if _isinstance(v, _int):
            return v if -_INT_SAFE <= v <= _INT_SAFE else _float(v)
        if v != v or v in (_float("inf"), _float("-inf")):
            raise _ValueError("값에 nan이나 inf는 쓸 수 없어요")
        return v

    def _args(name, args, kw, n, shape):
        """인자 검사: 이름 붙은 인자 없이 정확히 n개. 틀리면 한국어 TypeError"""
        if kw:
            raise _TypeError("chart.%s()에는 %s= 같은 이름 붙은 인자를 쓰지 않아요. 값만 차례로 써요(%s)"
                             % (name, _list(kw)[0], shape))
        if _len(args) != n:
            raise _TypeError("chart.%s()에는 값을 %d개 줘요(%s)" % (name, n, shape) if n
                             else "chart.%s()에는 아무것도 넣지 않아요(%s)" % (name, shape))
        return args

    def _plot(kind, labels, values):
        if fig.get("kind") == "bar" and kind == "bar":
            raise _ValueError("그림 하나에는 막대 그래프 하나만 그려요. 먼저 chart.show()를 불러요")
        if fig.get("kind") and fig["kind"] != kind:
            raise _ValueError("막대와 꺾은선은 한 그림에 섞지 않아요. 먼저 chart.show()를 불러요")
        if fig.get("kind") == "line" and _len(fig["lines"]) >= CHART_LINES_MAX:
            raise _ValueError("꺾은선은 한 그림에 %d개까지 겹칠 수 있어요" % CHART_LINES_MAX)
        labels = _seq(labels, "이름들")
        values = _seq(values, "값들")
        if _len(labels) != _len(values):
            raise _ValueError("이름과 값의 개수가 달라요")
        if not labels:
            raise _ValueError("그릴 값이 하나도 없어요")
        if _len(labels) > CHART_POINTS_MAX:
            raise _ValueError("그래프 하나에 값은 %d개까지 그릴 수 있어요" % CHART_POINTS_MAX)
        labels = [_text(x, "이름") for x in labels]
        values = [_num(x) for x in values]
        if fig.get("kind"):
            if labels != fig["labels"]:
                raise _ValueError("선마다 이름(가로축)이 같아야 해요")
            fig["lines"].append(values)
            return
        fig["labels"] = labels
        fig["lines"] = [values]
        fig["kind"] = kind

    def bar(*args, **kw):
        """막대 그래프: chart.bar(["사과", "배"], [3, 5])"""
        labels, values = _args("bar", args, kw, 2, 'chart.bar(이름들, 값들)')
        _plot("bar", labels, values)

    def line(*args, **kw):
        """꺾은선 그래프: chart.line(["월", "화"], [12, 15]). 같은 이름들로 다시 부르면 선을 겹친다(3개까지)"""
        labels, values = _args("line", args, kw, 2, 'chart.line(이름들, 값들)')
        _plot("line", labels, values)

    def title(*args, **kw):
        """그림 제목"""
        text, = _args("title", args, kw, 1, 'chart.title("제목")')
        fig["title"] = _text(text, "제목")

    def xlabel(*args, **kw):
        """가로축 이름"""
        text, = _args("xlabel", args, kw, 1, 'chart.xlabel("가로축 이름")')
        fig["xlabel"] = _text(text, "가로축 이름")

    def ylabel(*args, **kw):
        """세로축 이름"""
        text, = _args("ylabel", args, kw, 1, 'chart.ylabel("세로축 이름")')
        fig["ylabel"] = _text(text, "세로축 이름")

    def legend(*args, **kw):
        """선 이름표: chart.legend(["철수", "영희"]) — 선을 그린 차례대로"""
        names, = _args("legend", args, kw, 1, 'chart.legend(["선 이름", "선 이름"])')
        names = _seq(names, "선 이름들")
        if not names:
            raise _ValueError("선 이름이 하나도 없어요")
        if _len(names) > CHART_LINES_MAX:
            raise _ValueError("선 이름은 %d개까지 줄 수 있어요(꺾은선이 %d개까지라서)"
                              % (CHART_LINES_MAX, CHART_LINES_MAX))
        fig["legend"] = [_text(x, "선 이름") for x in names]

    def show(*args, **kw):
        """지금까지 그린 그림을 화면에 보여 주고 새 그림을 시작한다"""
        _args("show", args, kw, 0, "chart.show()")
        if not fig.get("kind"):
            raise _ValueError("그릴 그래프가 없어요. chart.bar()나 chart.line()을 먼저 불러요")
        names = fig.get("legend")
        if names is not None and fig["kind"] != "line":
            raise _ValueError("chart.legend()는 꺾은선 그래프에만 써요")
        if names is not None and _len(names) != _len(fig["lines"]):
            raise _ValueError("선 이름(legend)의 개수가 선 개수와 달라요(선 %d개, 이름 %d개)"
                              % (_len(fig["lines"]), _len(names)))
        if _len(charts) >= CHART_MAX:
            raise _ValueError("그림은 한 번 실행에 %d개까지 보여 줄 수 있어요" % CHART_MAX)
        c = {"kind": fig["kind"], "labels": fig["labels"]}
        if _len(fig["lines"]) == 1 and names is None:
            c["values"] = fig["lines"][0]   # 예전 모양 그대로(v0.5 레슨·시험)
        else:
            c["series"] = [({"name": names[i], "values": v} if names is not None else {"values": v})
                           for i, v in _enumerate(fig["lines"])]
        for k in ("title", "xlabel", "ylabel"):
            if k in fig:
                c[k] = fig[k]
        charts.append(c)
        fig.clear()

    for f in (bar, line, title, xlabel, ylabel, legend, show):
        f.__module__ = "chart"
        setattr(mod, f.__name__, f)
    return mod


FARM_ACTIONS_MAX = 500   # 한 실행에 시간 1짜리 행동(move·plant·harvest) 수. 넘으면 파이가 지침
FARM_CHECKS_MAX = 2000   # 한 실행에 시간이 들지 않는 확인(can_harvest·what_here·store·where) 수. 넘으면 기다리다 멈춤(판정 C60)
FARM_SAYS_MAX = 100      # 한 실행에 남기는 말풍선(say) 사건 수. 넘는 print는 출력만 되고 사건은 없음(검토 C62 I2)
FARM_EVENTS_MAX = FARM_ACTIONS_MAX + FARM_SAYS_MAX  # 사건 수 안전 상한 → 시간 1짜리 사건(≤500)은 절대 버리지 않는다
FARM_SAY_MAX = 40        # 말풍선(say) 글자 수
FARM_SIZE_MAX = 12       # 밭 한 변의 칸 수 상한(받은 상태를 다듬을 때)
FARM_FERTILIZER = "비료"
FARM_POTATO_SEED = "감자 씨앗"
FARM_DIR_MSG = "방향은 위·아래·왼쪽·오른쪽 중 하나예요"
FARM_CROP_MSG = "작물은 당근·감자 중 하나예요"
FARM_NAMES = ("move", "plant", "harvest", "can_harvest", "what_here", "store", "where")
# 규칙 표의 원본(검토 C62 I1): 바꿀 수 없는 튜플. 실행마다 _make_farm이 여기서 새 표를 만들어 닫힘(closure)에만 둔다.
# 아래 FARM_CROPS·FARM_GROW·FARM_GROW_FERTILIZED·FARM_DIRS는 시험·문서가 읽는 읽기 전용 사본이고 엔진은 쓰지 않는다.
_FARM_CROP_RULES = (("당근", 8, 6), ("감자", 12, 9))   # (작물, 자라는 시간, 비료 뒤 자라는 시간)
_FARM_DIR_RULES = (("위", 0, -1), ("아래", 0, 1), ("왼쪽", -1, 0), ("오른쪽", 1, 0))


def _farm_tables():
    """규칙 원본에서 새 표를 만든다(실행마다·모듈 이름을 되돌릴 때마다)."""
    import types
    crops = tuple(c for c, _g, _f in _FARM_CROP_RULES)
    grow = types.MappingProxyType({c: g for c, g, _f in _FARM_CROP_RULES})
    fert = types.MappingProxyType({c: f for c, _g, f in _FARM_CROP_RULES})
    dirs = types.MappingProxyType({d: (dx, dy) for d, dx, dy in _FARM_DIR_RULES})
    return crops, grow, fert, dirs


FARM_CROPS, FARM_GROW, FARM_GROW_FERTILIZED, FARM_DIRS = _farm_tables()
_dict = dict
_print = print
_settrace = sys.settrace


class FarmTired(BaseException):
    """파이가 멈춤: 한 실행의 행동이 FARM_ACTIONS_MAX번(stopped "tired")이나
    확인이 FARM_CHECKS_MAX번(stopped "waited")을 넘었을 때.

    BaseException이라 `except Exception:`에 걸리지 않는다. 학습자가 `except:`·`except BaseException:`으로
    삼키면, 그 뒤로는 학습자 코드 한 줄이 돌 때마다 다시 던져(추적 함수) 실행이 끝나게 한다.
    run()은 이것을 오류가 아니라 result["farm"]["stopped"] = "tired" | "waited"로 알린다.
    """


_FARM_INT_MAX = 2 ** 53   # JSON·JS에서 정확한 정수 범위


def _farm_int(v, default):
    """정수로 다듬음. 정수가 아니거나(bool·nan·inf·글자·객체) 너무 크면 default."""
    t = _type(v)
    if t is _float and v == v and -_FARM_INT_MAX <= v <= _FARM_INT_MAX:
        return _int(v)
    if t is not _int or not (-_FARM_INT_MAX <= v <= _FARM_INT_MAX):
        return default
    return v


def _farm_state(farm):
    """받은 텃밭 상태를 새 dict로 다듬는다(받은 것은 고치지 않음). 모르는 값은 기본값으로.

    결과를 만들 때(_farm_copy)도 같은 정리를 한 번 더 한다: 학습자 코드가 닫힘으로 상태를 바꿔 nan·객체 같은
    값을 넣어도 결과는 언제나 JSON에 넣을 수 있는 모양이다(검토 C62). 형(type)은 isinstance가 아니라 type()으로
    정확히 본다(dict·str을 이은 클래스의 이상한 __eq__·items를 타지 않게).
    """
    if _type(farm) is not _dict:
        farm = {}
    get = _dict.get
    size = max(1, min(FARM_SIZE_MAX, _farm_int(get(farm, "size"), 3)))
    raw = get(farm, "cells")
    raw = _list(raw) if _type(raw) in (_list, _tuple) else []
    cells = []
    for i in range(size * size):
        c = raw[i] if i < _len(raw) else None
        crop = get(c, "crop") if _type(c) is _dict else None
        if _type(crop) is _str and crop in FARM_CROPS:
            cells.append({"crop": crop, "planted_at": _farm_int(get(c, "planted_at"), 0)})
        else:
            cells.append(None)
    pie = get(farm, "pie")
    pie = pie if _type(pie) is _dict else {}
    store = {c: 0 for c in FARM_CROPS}
    given = get(farm, "store")
    if _type(given) is _dict:
        for k, v in _list(_dict.items(given)):
            if _type(k) is _str and k in FARM_CROPS:
                store[k] = max(0, _farm_int(v, 0))
    ups = get(farm, "upgrades")
    ups = [u for u in ups if _type(u) is _str] if _type(ups) in (_list, _tuple) else []
    return {
        "size": size,
        "cells": cells,
        "pie": {"x": _farm_int(get(pie, "x"), 0) % size, "y": _farm_int(get(pie, "y"), 0) % size},
        "clock": max(0, _farm_int(get(farm, "clock"), 0)),
        "store": store,
        "upgrades": ups,
    }


def _farm_copy(st):
    """결과에 넣을 상태 사본: _farm_state와 같은 정리(JSON에 그대로 넣을 수 있는 모양)."""
    return _farm_state(st)


_FARM_EVENT_TYPES = ("move", "plant", "plant_fail", "harvest", "harvest_young", "harvest_empty", "say")
_FARM_EVENT_KEYS = (("line", "int"), ("x", "int"), ("y", "int"), ("dir", "str"), ("crop", "str"),
                    ("reason", "str"), ("text", "str"))


def _farm_events_copy(events):
    """결과에 넣을 사건 목록 사본. 모양이 이상한 사건·값은 버린다(JSON에 넣을 수 있는 것만)."""
    out = []
    if _type(events) is not _list:
        return out
    for e in _list(events)[:FARM_EVENTS_MAX]:
        if _type(e) is not _dict:
            continue
        t = _dict.get(e, "t")
        if _type(t) is not _str or t not in _FARM_EVENT_TYPES:
            continue
        c = {"t": t}
        for k, kind in _FARM_EVENT_KEYS:
            if not _dict.__contains__(e, k):
                continue
            v = _dict.get(e, k)
            if kind == "int":
                v = None if v is None else _farm_int(v, None)
                if v is None and k != "line":   # line만 None일 수 있음(학습자 코드 밖에서 부름)
                    continue
            elif _type(v) is not _str:
                continue
            c[k] = v
        out.append(c)
    return out


def _farm_result(fs):
    """result["farm"]: 사건·끝 상태·멈춤·행동 수를 다듬은 사본(학습자가 닫힘으로 fs를 바꿨어도 JSON 모양)."""
    stopped = _dict.get(fs, "stopped")
    return {"events": _farm_events_copy(_dict.get(fs, "events")),
            "state": _farm_copy(_dict.get(fs, "state")),
            "stopped": stopped if _type(stopped) is _str and stopped in ("tired", "waited") else None,
            "actions": max(0, _farm_int(_dict.get(fs, "actions"), 0))}


def _make_farm(fs, out):
    """실행 하나에 쓰는 새 farm 모듈과 print 대신 쓸 함수.

    fs: {"state": _farm_state(...), "events": [], "actions": 0, "checks": 0, "says": 0, "stopped": None,
         "trace_on": False}
    규칙(설계서 §2-1)은 여기 한 곳에만 있다. 시간 1짜리 행동은 지금 시계(clock)에 일어나고 그 뒤 clock += 1.
    규칙 표·상한·도구는 여기서 원본(_FARM_CROP_RULES 등)으로 새로 만들어 닫힘에만 둔다(검토 C62 I1): 학습자가
    move.__globals__로 모듈 이름을 바꿔도 이 실행의 규칙은 그대로이고(이름은 run()이 끝에 되돌림), 닫힘을 파고들어
    바꾼 것은 이 실행에만 남는다(그렇게 만든 결과는 화면 쪽 applyRun의 일관성 검사가 거른다).
    """
    import types

    st = fs["state"]
    events = fs["events"]
    crops, grow_normal, grow_fert, dirs = _farm_tables()
    actions_max = FARM_ACTIONS_MAX
    checks_max = FARM_CHECKS_MAX
    says_max = FARM_SAYS_MAX
    events_max = FARM_EVENTS_MAX
    say_len = FARM_SAY_MAX
    seed = FARM_POTATO_SEED
    fertilizer = FARM_FERTILIZER
    dir_msg = FARM_DIR_MSG
    crop_msg = FARM_CROP_MSG
    stop_exc = FarmTired
    user_file = USER_FILE
    caller_line = _caller_user_line
    settrace = _settrace
    getframe = sys._getframe
    py_print = _print
    isinst = _isinstance
    str_t = _str
    value_error = _ValueError
    nlen = _len
    sys_mod = sys

    def _ev(t, extra):
        # 말풍선은 says_max개까지만(검토 C62 I2) → 시간 1짜리 사건(≤ actions_max)은 events_max 안에 언제나 들어간다
        if t == "say":
            if fs["says"] >= says_max:
                return
            fs["says"] += 1
        if nlen(events) < events_max:
            e = {"t": t, "line": caller_line()}
            e.update(extra)
            events.append(e)

    def _tired_tracer(frame, event, arg):
        # 지친 뒤에는 학습자 코드가 새 줄·새 함수에 들어설 때마다 다시 던진다(except로 삼켜도 끝나게).
        # 알려진 한계(검토 C62, 고치지 않음): 학습자가 exec("…")로 만든 코드는 파일 이름이 <user>가 아니어서
        # 여기서 다시 던지지 않는다. 그 안에서 except로 삼키며 끝없이 돌면 바깥 시간 제한(작업자 종료)으로 끝난다.
        # 자기 코드를 일부러 그렇게 쓸 때만 생기고, 결과는 「시간 초과」라 텃밭은 그대로다.
        if frame.f_code.co_filename != user_file:
            return None
        if event == "line" or event == "call":
            raise stop_exc("파이가 멈췄어요")
        return _tired_tracer

    def _stop(why):
        """실행을 멈춘다(첫 이유를 남김). 그 뒤로는 학습자 코드 한 줄마다 다시 던진다."""
        if fs["stopped"] is None:
            fs["stopped"] = why
        if not fs["trace_on"]:
            fs["trace_on"] = True
            settrace(_tired_tracer)
            f = getframe(1)
            while f is not None:
                if f.f_code.co_filename == user_file:
                    f.f_trace = _tired_tracer
                f = f.f_back
        raise stop_exc("파이가 멈췄어요")

    def _act():
        """시간 1짜리 행동 하나를 센다. 넘치면 지침."""
        if fs["stopped"] is not None or fs["actions"] >= actions_max:
            _stop("tired")
        fs["actions"] += 1
        now = st["clock"]
        st["clock"] = now + 1
        return now

    def _here():
        return st["pie"]["y"] * st["size"] + st["pie"]["x"]

    def _ripe(cell, now):
        grow = grow_fert if fertilizer in st["upgrades"] else grow_normal
        return now - cell["planted_at"] >= grow[cell["crop"]]

    def move(direction):
        """파이를 한 칸 움직인다: move("위"), "아래", "왼쪽", "오른쪽". 끝에 닿으면 반대편으로"""
        if not isinst(direction, str_t) or direction not in dirs:
            raise value_error(dir_msg)
        _act()
        dx, dy = dirs[direction]
        n = st["size"]
        st["pie"]["x"] = (st["pie"]["x"] + dx) % n
        st["pie"]["y"] = (st["pie"]["y"] + dy) % n
        _ev("move", {"dir": direction, "x": st["pie"]["x"], "y": st["pie"]["y"]})

    def plant(crop):
        """지금 칸에 심는다: plant("당근") 또는 plant("감자")"""
        if not isinst(crop, str_t) or crop not in crops:
            raise value_error(crop_msg)
        now = _act()
        i = _here()
        pos = {"crop": crop, "x": st["pie"]["x"], "y": st["pie"]["y"]}
        if st["cells"][i] is not None:
            pos["reason"] = "occupied"
            _ev("plant_fail", pos)
        elif crop == "감자" and seed not in st["upgrades"]:
            pos["reason"] = "no_seed"
            _ev("plant_fail", pos)
        else:
            st["cells"][i] = {"crop": crop, "planted_at": now}
            _ev("plant", pos)

    def harvest():
        """지금 칸의 작물을 거둔다. 덜 자랐으면 작물이 사라진다"""
        now = _act()
        i = _here()
        cell = st["cells"][i]
        pos = {"x": st["pie"]["x"], "y": st["pie"]["y"]}
        if cell is None:
            _ev("harvest_empty", pos)
            return
        st["cells"][i] = None
        pos["crop"] = cell["crop"]
        if _ripe(cell, now):
            st["store"][cell["crop"]] = st["store"].get(cell["crop"], 0) + 1
            _ev("harvest", pos)
        else:
            _ev("harvest_young", pos)

    def _check():
        """시간이 들지 않는 확인 하나를 센다. 넘치면(끝없이 기다리기) 멈춤."""
        if fs["stopped"] is not None or fs["checks"] >= checks_max:
            _stop("waited")
        fs["checks"] += 1

    def can_harvest():
        """지금 칸이 다 자란 작물이면 True(시간이 들지 않음)"""
        _check()
        cell = st["cells"][_here()]
        return cell is not None and _ripe(cell, st["clock"])

    def what_here():
        """지금 칸: "당근", "감자", "빈칸"(시간이 들지 않음)"""
        _check()
        cell = st["cells"][_here()]
        return "빈칸" if cell is None else cell["crop"]

    def store():
        """창고 사본 {"당근": n, "감자": n}(시간이 들지 않음). 사본을 바꿔도 진짜 창고는 그대로"""
        _check()
        have = st["store"]
        return {c: have.get(c, 0) for c in crops}

    def where():
        """파이의 지금 자리 (x, y)(시간이 들지 않음)"""
        _check()
        return (st["pie"]["x"], st["pie"]["y"])

    class _SayTee:
        """print가 쓰는 글을 진짜 출력 통(한도 포함)에 넘기면서 말풍선용으로도 모은다(실행마다 새 클래스)."""

        def __init__(self, target):
            self.out = target
            self.parts = []

        def write(self, s):
            n = self.out.write(s)
            self.parts.append(s)
            return n

        def flush(self):
            pass

    def say_print(*args, **kw):
        """print와 같고, 표준 출력에 쓴 줄은 말풍선(say 사건)으로도 남긴다"""
        target = kw.get("file")
        if target is None:
            target = sys_mod.stdout
        if target is not out:
            return py_print(*args, **kw)
        tee = _SayTee(out)
        kw["file"] = tee
        py_print(*args, **kw)
        text = "".join(tee.parts)
        if text.endswith("\n"):
            text = text[:-1]
        _ev("say", {"text": text[:say_len]})

    mod = types.ModuleType("farm")
    mod.__doc__ = ("리아와 파이썬! 파이의 텃밭: move(방향), plant(작물), harvest(), "
                   "can_harvest(), what_here(), store(), where()")
    mod.__all__ = list(FARM_NAMES)
    cmds = {}
    for f in (move, plant, harvest, can_harvest, what_here, store, where):
        f.__module__ = "farm"
        setattr(mod, f.__name__, f)
        cmds[f.__name__] = f
    return mod, cmds, say_print


def _restore_farm_tables():
    """보여 주기용 표(FARM_GROW 등)를 원본에서 다시 만든다(학습자가 이름을 바꾸거나 안을 건드렸어도)."""
    global FARM_CROPS, FARM_GROW, FARM_GROW_FERTILIZED, FARM_DIRS
    FARM_CROPS, FARM_GROW, FARM_GROW_FERTILIZED, FARM_DIRS = _farm_tables()


def run(code, stdin=None, require=None, files=None, server=None, farm=None):
    code = "" if code is None else str(code)
    stdin = _split_stdin(stdin)
    require = list(require or [])

    # 학습자가 except로 삼켜도 알 수 있게 특수 중단은 여기에 적어 둔다.
    state = {"used": 0, "input_missing": None, "output_limit": None}
    out = _CappedIO(state)
    err = _CappedIO(state)
    charts = []
    result = {"stdout": "", "stderr": "", "error": None, "missing": [], "charts": charts}
    # 텃밭(v0.10): farm이 있으면 그 사본 위에서 명령을 실행하고 result["farm"]에 사건·끝 상태를 담는다.
    fs = None
    if farm is not None:
        fs = {"state": _farm_state(farm), "events": [], "actions": 0, "checks": 0, "says": 0, "stopped": None,
              "trace_on": False}
        result["farm"] = {"events": fs["events"], "state": None, "stopped": None, "actions": 0}

    # 오류 원문(Traceback)에 학습자 코드 줄이 보이도록 등록한다.
    linecache.cache[USER_FILE] = (len(code), None, code.splitlines(True), USER_FILE)

    try:
        compiled = compile(code, USER_FILE, "exec")
    except BaseException as e:  # noqa: BLE001 — SyntaxError·IndentationError, 너무 복잡한 코드의 MemoryError 등
        if isinstance(e, SyntaxError):
            result["error"] = {"type": type(e).__name__, "line": e.lineno, "msg": _safe_str(e.msg)}
            try:
                text = "".join(traceback.format_exception_only(type(e), e))
            except BaseException:  # noqa: BLE001
                text = "%s: %s\n" % (type(e).__name__, _safe_str(e.msg))
        else:
            result["error"] = {"type": type(e).__name__, "line": None, "msg": _safe_str(e)}
            text = "%s: %s\n" % (type(e).__name__, _safe_str(e))
        result["stderr"] = text[:2000]
        linecache.cache.pop(USER_FILE, None)
        if fs is not None:
            result["farm"] = _farm_result(fs)
        return result

    try:
        result["missing"] = _missing(ast.parse(code, USER_FILE), require, code)
    except BaseException:  # noqa: BLE001 — compile이 통과했으면 드묾
        result["missing"] = []

    # 연습 서버: 학습자가 import하기 전에 urllib.request를 올려 두고 urlopen을 바꿔 끼운다.
    # (미리 올린 모듈은 sys.modules 목록에 들어가 실행 뒤에도 남는다 → 학습자 import가 같은 모듈을 받음)
    urlreq = real_urlopen = None
    if server is not None:
        import urllib.request as urlreq
        real_urlopen = urlreq.urlopen
        fake_urlopen = _make_urlopen(server)

    old_cwd = _getcwd()
    run_dir = _make_run_dir(files)

    old_out, old_err = sys.stdout, sys.stderr
    old_builtins = dict(builtins.__dict__)
    old_limit = sys.getrecursionlimit()
    old_modules = set(sys.modules)
    old_modules.discard("chart")
    old_modules.discard("farm")
    old_trace = sys.gettrace()
    # 이 모듈의 전역 이름(규칙 상수·도구 함수)을 저장해 두었다가 끝나면 통째로 되돌린다(검토 C62 I1):
    # 학습자 코드는 move.__globals__나 import ria_runner로 이 dict에 닿을 수 있다.
    # 알려진 한계: 함수 객체의 __code__·클래스 속성처럼 이름이 아닌 객체 안을 바꾼 것은 되돌리지 않는다.
    mod_globals = globals()
    saved_globals = dict(mod_globals)
    sys.modules["chart"] = _make_chart(charts)  # 목록 뒤에 넣어 실행이 끝나면 지워지게
    user_globals = {"__name__": "__main__", "__builtins__": builtins}
    if fs is not None:
        farm_mod, farm_cmds, say_print = _make_farm(fs, out)
        sys.modules["farm"] = farm_mod
        user_globals.update(farm_cmds)  # import 없이 move(…) 등을 바로 쓰게(레슨 코드처럼 짧게)
        builtins.print = say_print      # builtins는 끝나면 통째로 되돌린다
    sys.stdout, sys.stderr = out, err
    builtins.input = _make_input(stdin, out, state)
    caught = None
    try:
        _chdir(run_dir)
        if urlreq is not None:
            urlreq.urlopen = fake_urlopen
        exec(compiled, user_globals)
    except _BaseException as e:  # noqa: BLE001 — 어떤 오류든 결과로 돌려준다. 분류는 builtins를 되돌린 뒤에.
        caught = e
    finally:
        mod_globals.clear()
        mod_globals.update(saved_globals)
        _restore_farm_tables()
        if fs is not None and fs["trace_on"]:
            _settrace(old_trace)
        builtins.__dict__.clear()
        builtins.__dict__.update(old_builtins)
        sys.stdout, sys.stderr = old_out, old_err
        sys.setrecursionlimit(old_limit)
        for name in set(sys.modules) - old_modules:
            del sys.modules[name]
        if urlreq is not None:
            urlreq.urlopen = real_urlopen
        try:
            _chdir(old_cwd)
        except OSError:
            pass
        _rmtree(run_dir, ignore_errors=True)

    tired = fs is not None and fs["stopped"] is not None
    if tired:
        # 파이가 지침(행동 500번)·기다리다 멈춤(확인 2000번): 오류가 아니라 멈춤.
        # 학습자가 except로 삼켰다가 다른 오류가 났어도 같다.
        caught = None
    if isinstance(caught, SystemExit):
        # exit()·sys.exit()는 종료 코드와 상관없이 정상 종료로 친다(판정 C10).
        # 글자 값이면 진짜 Python처럼 stderr에 남긴다.
        code_val = caught.code
        if code_val is not None and not isinstance(code_val, int):
            err.raw_write(_safe_str(code_val)[:1000] + "\n")
    elif caught is not None:
        tb = caught.__traceback__
        if isinstance(caught, SyntaxError):  # exec/eval 안에서 난 문법 오류
            line = _user_line(tb) or caught.lineno
            msg = _safe_str(caught.msg)
        else:
            line = _user_line(tb)
            msg = _safe_str(caught)
        result["error"] = {"type": type(caught).__name__, "line": line, "msg": msg}
        if not isinstance(caught, (InputMissing, OutputLimit)):
            err.raw_write(_format_tb(caught, _user_tb(tb))[:2000])
    linecache.cache.pop(USER_FILE, None)

    # 입력 부족·출력 초과는 학습자 코드가 except로 삼켰더라도 그것을 결과로 알린다(멈춘 경우는 빼고).
    if tired:
        pass
    elif state["input_missing"] is not None or (result["error"] or {}).get("type") == "InputMissing":
        line = state["input_missing"] or result["error"]["line"]
        result["error"] = {"type": "InputMissing", "line": line,
                           "msg": "input() needed more values than were given"}
        err.raw_write("InputMissing (line %s): input() needed more values than were given\n" % line)
    elif state["output_limit"] is not None or (result["error"] or {}).get("type") == "OutputLimit":
        line = state["output_limit"] or result["error"]["line"]
        result["error"] = {"type": "OutputLimit", "line": line,
                           "msg": "output is longer than %d characters" % OUTPUT_LIMIT}
        err.raw_write("OutputLimit (line %s): output is longer than %d characters\n" % (line, OUTPUT_LIMIT))

    if fs is not None:
        result["farm"] = _farm_result(fs)

    result["stdout"] = out.getvalue()
    result["stderr"] = err.getvalue()
    return result
