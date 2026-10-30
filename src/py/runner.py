"""학습자 코드를 실행하고 결과를 dict로 돌려준다.

CPython 3.13(시험)과 Pyodide(Python 3.14, Web Worker 안)에서 같이 돈다.
스레드·시그널·네트워크·파일을 쓰지 않는다. 시간 제한은 바깥(작업자 종료)에서 건다.

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

run(code, stdin, require) -> {
    "stdout": str, "stderr": str,
    "error": None | {"type": str, "line": int | None, "msg": str},
    "missing": [str, ...],   # require 중 코드에 없는 ast 마디 이름
}
stdin은 "12\n30" 같은 문자열(레슨 데이터 형식) 또는 문자열 목록.

"""

import ast
import builtins
import io
import linecache
import sys
import traceback

USER_FILE = "<user>"
OUTPUT_LIMIT = 100_000  # stdout + stderr 합계 글자 수

# 학습자 코드가 builtins를 지워도 쓸 수 있게 미리 잡아 둔다.
_len = len
_str = str
_BaseException = BaseException
_StringIO_write = io.StringIO.write


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


def _missing(tree, require):
    if not require:
        return []
    # require 항목(판정 C26):
    #   "If"          — 그 종류의 ast 마디가 있음
    #   "Call:type"   — 이름으로 부르는 호출 type(...) (obj.type(...)은 아님)
    #   "Name:count"  — 변수 count를 어딘가에서 읽음(ast.Name, Load)
    #   "Method:get"  — 점으로 부르는 호출 d.get(...) (판정 C34, 그냥 get(...)은 아님)
    found = set()
    for node in ast.walk(tree):
        found.add(type(node).__name__)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            found.add("Call:" + node.func.id)
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            found.add("Method:" + node.func.attr)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            found.add("Name:" + node.id)
    return [name for name in require if name not in found]


def run(code, stdin=None, require=None):
    code = "" if code is None else str(code)
    stdin = _split_stdin(stdin)
    require = list(require or [])

    # 학습자가 except로 삼켜도 알 수 있게 특수 중단은 여기에 적어 둔다.
    state = {"used": 0, "input_missing": None, "output_limit": None}
    out = _CappedIO(state)
    err = _CappedIO(state)
    result = {"stdout": "", "stderr": "", "error": None, "missing": []}

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
        return result

    try:
        result["missing"] = _missing(ast.parse(code, USER_FILE), require)
    except BaseException:  # noqa: BLE001 — compile이 통과했으면 드묾
        result["missing"] = []

    old_out, old_err = sys.stdout, sys.stderr
    old_builtins = dict(builtins.__dict__)
    old_limit = sys.getrecursionlimit()
    old_modules = set(sys.modules)
    sys.stdout, sys.stderr = out, err
    builtins.input = _make_input(stdin, out, state)
    user_globals = {"__name__": "__main__", "__builtins__": builtins}
    caught = None
    try:
        exec(compiled, user_globals)
    except _BaseException as e:  # noqa: BLE001 — 어떤 오류든 결과로 돌려준다. 분류는 builtins를 되돌린 뒤에.
        caught = e
    finally:
        builtins.__dict__.clear()
        builtins.__dict__.update(old_builtins)
        sys.stdout, sys.stderr = old_out, old_err
        sys.setrecursionlimit(old_limit)
        for name in set(sys.modules) - old_modules:
            del sys.modules[name]

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

    # 입력 부족·출력 초과는 학습자 코드가 except로 삼켰더라도 그것을 결과로 알린다.
    if state["input_missing"] is not None or (result["error"] or {}).get("type") == "InputMissing":
        line = state["input_missing"] or result["error"]["line"]
        result["error"] = {"type": "InputMissing", "line": line,
                           "msg": "input() needed more values than were given"}
        err.raw_write("InputMissing (line %s): input() needed more values than were given\n" % line)
    elif state["output_limit"] is not None or (result["error"] or {}).get("type") == "OutputLimit":
        line = state["output_limit"] or result["error"]["line"]
        result["error"] = {"type": "OutputLimit", "line": line,
                           "msg": "output is longer than %d characters" % OUTPUT_LIMIT}
        err.raw_write("OutputLimit (line %s): output is longer than %d characters\n" % (line, OUTPUT_LIMIT))

    result["stdout"] = out.getvalue()
    result["stderr"] = err.getvalue()
    return result
