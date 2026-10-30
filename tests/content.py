#!/usr/bin/env python3
"""레슨 내용 자동 점검 (계획 작업 6, 설계서 4장).

실행: python3 tests/content.py          있는 장(data/lessons/ch*.js)만 점검
      python3 tests/content.py --full   1~3장 15개 레슨이 모두 있어야 통과

데이터는 node로 ES 모듈을 import해 JSON으로 꺼낸다(실행 기록 C8).
코드는 src/py/runner.py의 run()으로 CPython에서 실제로 돌린다(앱의 Pyodide 작업자와 같은 파일).
출력 비교는 src/grade.js normalize()와 같은 규칙(줄 끝 공백·마지막 줄바꿈 무시).

레슨 파일 형식 (data/lessons/chN.js)
    export const CHAPTER = { id: N, title: "…" };
    export const LESSONS = [ { id: "N-1", chapter: N, title, goal, summary: [3줄], isExam?,
                               cards: [{ say, code, out }], items: [...] }, ... ];
    items = 터치 문제(choice/blank/order) 4~6개(장 평가는 4~8개) → write 1개 → check 1개, 이 순서.
아래 ITEM_KEYS가 문제 형태별로 허용하는 칸이다(오타를 잡으려고 모르는 칸은 오류).
카드·choice·blank·order·check는 stdin 칸("\n"으로 나눈 문자열, 판정 C23)을 둘 수 있다. 없으면 "".
실행 한 번은 RUN_SECONDS초까지만 기다리고, 넘으면 오류로 알린다.
"""

import ast
import itertools
import json
import keyword
import os
import re
import signal
import subprocess
import sys
import unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "src", "py"))
from runner import run  # noqa: E402

LESSON_DIR = os.path.join(ROOT, "data", "lessons")
CONCEPTS_FILE = os.path.join(ROOT, "data", "concepts.js")
CHAPTERS_EXPECTED = 3
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

LESSON_KEYS = {"id", "chapter", "title", "goal", "summary", "isExam", "cards", "items"}
CARD_KEYS = {"say", "code", "out"}
CARD_OPT = {"stdin"}
ITEM_KEYS = {
    "choice": ({"type", "concept", "q", "options", "answer", "explain"}, {"code", "stdin"}),
    "check": ({"type", "concept", "q", "options", "answer", "explain"}, {"code", "stdin"}),
    "blank": ({"type", "concept", "q", "code", "chips", "answer", "explain"}, {"stdin"}),
    "order": ({"type", "concept", "q", "lines", "expect", "explain"}, {"stdin"}),
    "write": ({"type", "concept", "task", "starter", "tests", "require", "hints", "solution", "explain"}, set()),
}
TOUCH = {"choice", "blank", "order"}

# ── 장마다 아직 배우지 않은 문법 막기 ─────────────────────────────────────
# 레슨 코드(카드·문제·정답·시작 코드)에서 문법 오류 없이 읽히는 것만 검사한다.
# 모든 장(1~3)에서 금지: 반복문·함수 정의·import·목록/사전·예외 처리 등(4장 이후 내용).
FORBID_ALL = {
    "For", "While", "FunctionDef", "AsyncFunctionDef", "Lambda", "ClassDef", "Import", "ImportFrom",
    "List", "Dict", "Set", "Tuple", "ListComp", "DictComp", "SetComp", "GeneratorExp",
    "Try", "With", "Return", "Yield", "Global", "Nonlocal", "Delete", "Assert", "Raise", "Match",
}
FORBID_BY_CHAPTER = {
    # 1장: 변수·조건·비교 없음. 이름은 print 하나만, f-문자열·메서드·인덱싱 없음.
    1: FORBID_ALL | {"Assign", "AugAssign", "AnnAssign", "NamedExpr", "If", "IfExp", "Compare",
                     "BoolOp", "JoinedStr", "Attribute", "Subscript"},
    2: FORBID_ALL | {"If", "IfExp"},
    3: FORBID_ALL,
}
NAMES_BY_CHAPTER = {  # 쓸 수 있는 이름(None이면 제한 없음: 변수를 배운 뒤)
    1: {"print"},
    2: None,
    3: None,
}
CALLS_BY_CHAPTER = {  # 부를 수 있는 내장 함수
    1: {"print"},
    2: {"print", "input", "int", "float", "str", "bool", "type", "round"},
    3: {"print", "input", "int", "float", "str", "bool", "type", "round", "len", "abs", "max", "min"},
}
INPUT_FROM_CHAPTER = 2  # input()은 2장부터

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


def judge(result, expect):
    """runner 결과 하나가 기대 출력과 맞는지. 맞으면 None, 아니면 이유 문자열."""
    if result["error"]:
        e = result["error"]
        return "오류 %s(%s줄): %s" % (e["type"], e["line"], e["msg"])
    if normalize(result["stdout"]) != normalize(expect):
        return "출력 %r ≠ 기대 %r" % (normalize(result["stdout"]), normalize(expect))
    if result["missing"]:
        return "구조 조건 빠짐: %s" % ", ".join(result["missing"])
    return None


class CheckTimeout(BaseException):
    """점검기 시간 제한. BaseException이라 runner가 학습자 오류처럼 결과에 담아 돌려준다."""


def _on_alarm(signum, frame):
    raise CheckTimeout("over %d seconds" % RUN_SECONDS)


def safe_run(rep, where, code, stdin="", require=None):
    """runner.run + 시간 제한. 시간을 넘기면 rep에 오류를 적고 error.type = "Timeout"인 결과를 준다."""
    old = signal.signal(signal.SIGALRM, _on_alarm)
    signal.setitimer(signal.ITIMER_REAL, RUN_SECONDS)
    try:
        r = run(code, stdin, require or [])
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


def same_outcome(a, b):
    """두 실행 결과가 학습자 눈에 같은지(둘 다 같은 출력, 오류 없음)."""
    return not a["error"] and not b["error"] and normalize(a["stdout"]) == normalize(b["stdout"])


class Lesson:
    def __init__(self, label):
        self.label = label
        self.errors = []

    def err(self, where, msg):
        self.errors.append("%s: %s" % (where, msg) if where else msg)


# ── 검사 ────────────────────────────────────────────────────────────────
def check_text(rep, where, value, limit, need_hangul=True, one_line=True):
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
    forbid = FORBID_BY_CHAPTER.get(chapter, FORBID_ALL)
    names = NAMES_BY_CHAPTER.get(chapter)
    calls = CALLS_BY_CHAPTER.get(chapter, set())
    for node in ast.walk(tree):
        kind = type(node).__name__
        if kind in forbid:
            rep.err(where, "%d장에서 아직 배우지 않은 문법 %s (%s줄)" % (chapter, kind, getattr(node, "lineno", "?")))
        if isinstance(node, ast.Name) and names is not None and node.id not in names:
            rep.err(where, "%d장에서 쓸 수 없는 이름 %r(변수는 2장부터)" % (chapter, node.id))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id not in calls:
            rep.err(where, "%d장에서 아직 배우지 않은 함수 %s()" % (chapter, node.func.id))


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
    if code is None:
        if ok:
            check_codeless_error(rep, where, item, q)
        return
    if not isinstance(code, str):
        rep.err(where, "code가 문자열이 아님")
        return
    check_code_shape(rep, where + ".code", code, chapter)
    r = safe_run(rep, where, code, stdin)
    if not ok:
        return
    if r["error"]:
        # 「출력은?」 문제인데 코드가 오류를 내면 정답 보기는 「오류」를 말해야 함.
        # 그 밖의 질문(「어떤 오류?」 등)은 보기 비교를 하지 않음.
        if "출력" in q and "오류" not in item["options"][item["answer"]]:
            rep.err(where, "코드가 오류(%s)를 내는데 정답 보기 %r 에 「오류」가 없음"
                    % (r["error"]["type"], item["options"][item["answer"]]))
        return
    out = normalize(r["stdout"])
    opts = [normalize(o) for o in item["options"]]
    hits = [i for i, o in enumerate(opts) if o == out]
    if "출력" in q:
        # 「출력은?」 문제: 실제 출력과 같은 보기가 정확히 정답 하나여야 함
        if hits != [item["answer"]]:
            rep.err(where, "출력 문제인데 실제 출력 %r 이 정답 보기 %r 와 다름" % (out, opts[item["answer"]]))
    elif hits and hits != [item["answer"]]:
        rep.err(where, "실제 출력 %r 와 같은 보기가 정답이 아님" % out)


def check_codeless_error(rep, where, item, q):
    """코드 없는 「오류가 나는 코드는?」·「오류 없이 … 코드는?」 문제.

    보기가 모두 print( 를 담은 코드일 때만 실행해 본다(보기가 설명 문장이면 건너뜀).
    """
    opts = item["options"]
    if not all("print(" in o for o in opts):
        return
    if "오류가 나는" in q:
        want_error = True
    elif "오류 없이" in q:
        want_error = False
    else:
        return
    errs = [bool(safe_run(rep, where, o, stdin_of(rep, where, item))["error"]) for o in opts]
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
    right = code.replace("___", chips[item["answer"]])
    check_code_shape(rep, where + ".code(정답)", right, chapter)
    good = safe_run(rep, where, right, stdin)
    if good["error"]:
        rep.err(where, "정답 칩을 넣은 코드가 오류: %s %s" % (good["error"]["type"], good["error"]["msg"]))
        return
    for i, c in enumerate(chips):
        if i == item["answer"]:
            continue
        if same_outcome(safe_run(rep, where, code.replace("___", c), stdin), good):
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
    code = "\n".join(lines)
    check_code_shape(rep, where + ".lines", code, chapter)
    if not isinstance(item.get("expect"), str):
        rep.err(where, "expect가 문자열이 아님")
        return
    r = safe_run(rep, where, code, stdin)
    why = judge(r, item["expect"])
    if why:
        rep.err(where, "정답 순서 실행 결과가 expect와 다름 — " + why)
        return
    # 정답 순서는 딱 하나여야 함(판정 C23): Pyodide가 준비되기 전에는 앱이 저장된 순서와 비교하므로.
    valid = 1
    for perm in itertools.permutations(lines):
        if list(perm) != lines and judge(safe_run(rep, where, "\n".join(perm), stdin), item["expect"]) is None:
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


REQUIRE_PREFIXES = ("Call", "Name")  # 판정 C26: "Call:print" = print(…)를 부름, "Name:price" = 이름 price를 씀


def check_require(rep, where, req):
    """require 항목: ast 마디 이름(예: "If", "Mult") 또는 "Call:<이름>"·"Name:<이름>"."""
    for name in req:
        if isinstance(name, str) and ":" in name:
            kind, _, ident = name.partition(":")
            if kind not in REQUIRE_PREFIXES or not ident.isidentifier() or keyword.iskeyword(ident):
                rep.err(where, "require %r 형식이 틀림(Call:이름 또는 Name:이름, 이름은 Python 식별자)" % (name,))
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
    if has_input and chapter < INPUT_FROM_CHAPTER:
        rep.err(where, "%d장에서는 input()을 쓰지 않음" % chapter)
    # 입력이 없는 문제는 출력이 늘 같으므로 시험 1개(공개)만 둔다. 입력이 있으면 2~4개.
    lo, hi = (2, 4) if has_input else (1, 1)
    if not (lo <= len(tests) <= hi):
        rep.err(where, "tests는 %d~%d개여야 함(input %s, 지금 %d개)"
                % (lo, hi, "있음" if has_input else "없음", len(tests)))
    if sum(1 for t in tests if isinstance(t, dict) and t.get("public") is True) != 1:
        rep.err(where, "공개 시험(public: true)은 정확히 1개")
    stdins = []
    for i, t in enumerate(tests):
        tw = "%s.tests[%d]" % (where, i)
        if not isinstance(t, dict) or set(t) != {"stdin", "expect", "public"}:
            rep.err(tw, "시험 칸은 stdin, expect, public 세 개")
            continue
        if not isinstance(t["stdin"], str) or not isinstance(t["expect"], str) or not isinstance(t["public"], bool):
            rep.err(tw, "stdin·expect는 문자열(여러 값은 \\n으로 나눔), public은 true/false")
            continue
        if not has_input and t["stdin"] != "":
            rep.err(tw, "input()이 없는 문제인데 stdin이 있음")
        stdins.append(t["stdin"])
        why = judge(safe_run(rep, tw, sol, t["stdin"], req), t["expect"])
        if why:
            rep.err(tw, "solution이 통과하지 못함 — " + why)
    if len(set(stdins)) != len(stdins):
        rep.err(where, "같은 stdin의 시험이 두 번 있음")
    if all(isinstance(t, dict) and isinstance(t.get("stdin"), str) and isinstance(t.get("expect"), str)
           and judge(safe_run(rep, where, starter, t["stdin"], req), t["expect"]) is None for t in tests):
        rep.err(where, "starter만으로 모든 시험을 통과함")


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
    want_id = "%d-%d" % (chapter, pos)
    if lesson.get("id") != want_id:
        rep.err("id", "%r 이어야 함(파일 안 순서)" % want_id)
    if lesson.get("chapter") != chapter:
        rep.err("chapter", "%r — 파일 ch%d.js와 다름" % (lesson.get("chapter"), chapter))
    exam = pos == LESSONS_PER_CHAPTER
    if bool(lesson.get("isExam")) != exam or ("isExam" in lesson and not isinstance(lesson["isExam"], bool)):
        rep.err("isExam", "장의 마지막 레슨(%d-%d)만 true" % (chapter, LESSONS_PER_CHAPTER))
    check_text(rep, "title", lesson.get("title"), TITLE_MAX)
    check_text(rep, "goal", lesson.get("goal"), GOAL_MAX)
    summ = lesson.get("summary")
    if not isinstance(summ, list) or len(summ) != 3:  # 문자열 하나도 여기서 걸림
        rep.err("summary", "정확히 3줄")
    else:
        for i, s in enumerate(summ):
            check_text(rep, "summary[%d]" % i, s, SUMMARY_MAX, need_hangul=False)

    cards = lesson.get("cards")
    if not isinstance(cards, list) or not (1 <= len(cards) <= 2):
        rep.err("cards", "개념 카드는 1~2장")
        cards = cards if isinstance(cards, list) else []
    for i, c in enumerate(cards):
        w = "cards[%d]" % i
        if not isinstance(c, dict) or not (CARD_KEYS <= set(c) <= CARD_KEYS | CARD_OPT):
            rep.err(w, "카드 칸은 say, code, out (+ 선택 stdin)")
            continue
        check_text(rep, w + ".say", c["say"], SAY_MAX, one_line=False)
        if not isinstance(c["code"], str) or not isinstance(c["out"], str):
            rep.err(w, "code와 out은 문자열이어야 함")
            continue
        check_code_shape(rep, w + ".code", c["code"], chapter)
        why = judge(safe_run(rep, w, c["code"], stdin_of(rep, w, c)), c["out"])
        if why:
            rep.err(w, "코드 실행 결과가 out과 다름 — " + why)

    items = lesson.get("items")
    if not isinstance(items, list):
        rep.err("items", "목록이 아님")
        return
    kinds = [i.get("type") if isinstance(i, dict) else None for i in items]  # 객체가 아닌 문제는 None
    touch_hi = 8 if exam else 6
    n_touch = len(items) - 2
    if (kinds.count("write") != 1 or kinds.count("check") != 1 or kinds[-2:] != ["write", "check"]
            or any(k not in TOUCH for k in kinds[:-2])):
        rep.err("items", "터치 문제들 → write 1개 → check 1개 순서여야 함(지금 %s)" % kinds)
    elif not (4 <= n_touch <= touch_hi):
        rep.err("items", "터치 문제는 4~%d개(지금 %d개)" % (touch_hi, n_touch))
    for i, item in enumerate(items):
        check_item(rep, "items[%d] %s" % (i, kinds[i]), item, chapter, concepts)


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


def main(argv):
    full = "--full" in argv
    failed = 0

    # 개념 목록
    if not os.path.exists(CONCEPTS_FILE):
        print("✗ data/concepts.js 가 없음")
        return 1
    files = sorted(f for f in os.listdir(LESSON_DIR) if re.fullmatch(r"ch\d+\.js", f)) \
        if os.path.isdir(LESSON_DIR) else []
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
            else:
                concepts[c["id"]] = c["chapter"]
    print("개념 %d개 %s" % (len(concepts), "✓" if not cerr else "✗"))
    for e in cerr:
        print("    - " + e)
    failed += len(cerr)

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

    want = list(range(1, CHAPTERS_EXPECTED + 1))
    if found != want[:len(found)]:
        print("\n✗ 장 파일이 1장부터 빠짐없이 이어져야 함: %s" % files)
        failed += 1
    absent = [c for c in want if c not in found]
    note = ""
    if absent:
        note = " (아직 없음: %s)" % ", ".join("ch%d.js" % c for c in absent)
        if full:
            print("\n✗ --full: 1~%d장이 모두 있어야 함" % CHAPTERS_EXPECTED)
            failed += 1
    print("\n합계: 레슨 %d/%d%s, 오류 %d" % (total, CHAPTERS_EXPECTED * LESSONS_PER_CHAPTER, note, failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
