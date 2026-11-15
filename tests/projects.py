"""프로젝트 공방 데이터 검사 (v0.21.0, 설계 docs/specs/2026-11-15-프로젝트-공방-설계.md §4-1·§4-2·§5·§7).

프로젝트마다(한국어 data/projects.js·영어 data/projects.en.js 각각):
  ① id·열리는 장이 WANT와 같은 순서, 한·영 같은 id·장·단계 수(3~5), 단계마다 같은 시험 수·rand 길이·require
  ② 칸 모양: 글 칸은 비지 않은 글, icon은 앱 아이콘 묶음(src/ui/dom.js) 안, play.prompt, starter는 첫 단계만,
     tool은 { title, body, code }, 시험은 { stdin, expect, public, rand?, files? }이고 public이 하나 이상
  ③ 각 단계 solution이 그 단계 시험을 모두 통과(src/py/runner.py run(rand=…)을 CPython에서 바로 부름)
  ④ solution[i]이 step[i+1]의 시작이 됨: 다음 단계 공개 시험 하나를 오류 없이 돎
  ⑤ 그 장까지 배운 문법만(경비실 tests/guard_incidents.py의 표) + 레슨 1~2장 기본(print·input·int·float·str, f-문자열)
     + 「새 도구」 예외: import random, random.randint, random.choice (프로젝트에서만)
  ⑥ 무작위를 쓰는 단계는 시험마다 rand가 있고, randint를 쓰는 단계의 rand 값은 모두 정수(bool 아님)
  ⑦ random을 처음 쓰는 단계에 새 도구 카드(tool)가 있음
  ⑧ WRONG(흔한 오답)이 단계마다 한·영 1개 이상, 각각 그 단계 시험에서 하나 이상 실패
  ⑨ 영어 파일에 한글 없음, 한국어 단계 글에는 한글이 있음
  ⑪ 정답·시작 코드·도구 카드 코드의 한 줄이 휴대폰 편집기 폭(CODE_COLS칸, 한글 2칸) 안
  ⑩ 보상 상수 PROJECT_STEP_XP = 5, PROJECT_DONE_XP = 20

실행: python3 tests/projects.py   (하나라도 실패하면 종료 코드 1)
"""

import ast
import json
import os
import re
import subprocess
import sys
import unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "tests"))
sys.path.insert(0, os.path.join(ROOT, "src", "py"))

import guard_incidents as gi  # noqa: E402  (장별 문법 표를 함께 씀)
import runner  # noqa: E402

HELPER = os.path.join(ROOT, "tests", "projects_helper.mjs")
HANGUL = re.compile(r"[가-힣ㄱ-ㅎㅏ-ㅣ]")

# 프로젝트 id와 열리는 장(원본 순서). 작업 4·5가 늘린다.
WANT = [("P1", 3)]

# 레슨 1~2장에서 배워 3장 이후 어디서나 쓸 수 있는 것(경비실 표에는 없는 입출력)
BASE_CALLS = {"print", "input", "int", "float", "str"}
BASE_NODES = {"JoinedStr", "FormattedValue"}
# 새 도구 카드로 소개하는 것(프로젝트 검사에서만, 경비실 표는 그대로)
TOOL_MODULES = {"random"}
TOOL_FUNCS = {"randint", "choice"}

# 한 줄 폭(한글 등 넓은 글자 2칸). 레슨 카드(읽기 전용)는 38칸(tests/content.py)이지만, 프로젝트 코드는 줄을 접는
# 편집기(src/ui/editor.js lineWrapping)에 보이고 영어 손 이름("scissors")이 길어 44칸까지 둔다.
CODE_COLS = 44

TEXT_KEYS = ("title", "blurb", "intro", "finale")
STEP_TEXT_KEYS = ("goal", "task")

# P1 오답을 만들 때 쓰는 앞부분(2단계 정답까지 = HEAD, 3단계의 비김·이김 갈래까지 = JUDGE)
P1_KO_HEAD = ('import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\n'
              'if num == 1:\n    com = "가위"\nelif num == 2:\n    com = "바위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\n')
P1_KO_JUDGE = (P1_KO_HEAD + 'if me == com:\n    result = "비겼어요"\nelif me == "가위" and com == "보":\n    result = "이겼어요"\n'
               'elif me == "바위" and com == "가위":\n    result = "이겼어요"\nelif me == "보" and com == "바위":\n    result = "이겼어요"\n')
P1_EN_HEAD = ('import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\n'
              'if num == 1:\n    com = "rock"\nelif num == 2:\n    com = "paper"\nelse:\n    com = "scissors"\nprint("Computer:", com)\n')
P1_EN_JUDGE = (P1_EN_HEAD + 'if me == com:\n    result = "It\'s a tie"\nelif me == "rock" and com == "scissors":\n    result = "You win"\n'
               'elif me == "paper" and com == "rock":\n    result = "You win"\nelif me == "scissors" and com == "paper":\n    result = "You win"\n')

# ⑧ 흔한 오답: (프로젝트, 단계 번호) → { "ko": [코드…], "en": [코드…] }
WRONG = {
    ("P1", 0): {
        "ko": ['me = input()\nprint(me)\n',
               'me = input()\nprint("나:" + me)\n'],
        "en": ['me = input()\nprint(me)\n',
               'me = input()\nprint("Me:" + me)\n'],
    },
    ("P1", 1): {
        # 무작위를 두 번 부름(한 번만이어야 함), 숫자와 손이 어긋남
        "ko": ['import random\n\nme = input()\nprint("나:", me)\n'
               'if random.randint(1, 3) == 1:\n    com = "가위"\nelif random.randint(1, 3) == 2:\n    com = "바위"\n'
               'else:\n    com = "보"\nprint("컴퓨터:", com)\n',
               'import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "바위"\nelif num == 2:\n    com = "가위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\n'],
        "en": ['import random\n\nme = input()\nprint("Me:", me)\n'
               'if random.randint(1, 3) == 1:\n    com = "rock"\nelif random.randint(1, 3) == 2:\n    com = "paper"\n'
               'else:\n    com = "scissors"\nprint("Computer:", com)\n',
               'import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "paper"\nelif num == 2:\n    com = "rock"\nelse:\n    com = "scissors"\nprint("Computer:", com)\n'],
    },
    ("P1", 2): {
        # 이기는 경우를 하나만 봄, 비김을 빠뜨림
        "ko": ['import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "가위"\nelif num == 2:\n    com = "바위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\n'
               'if me == com:\n    result = "비겼어요"\nelif me == "가위" and com == "보":\n    result = "이겼어요"\n'
               'else:\n    result = "졌어요"\nprint("결과:", result)\n',
               'import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "가위"\nelif num == 2:\n    com = "바위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\n'
               'if me == "가위" and com == "보" or me == "바위" and com == "가위" or me == "보" and com == "바위":\n'
               '    result = "이겼어요"\nelse:\n    result = "졌어요"\nprint("결과:", result)\n'],
        "en": ['import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "rock"\nelif num == 2:\n    com = "paper"\nelse:\n    com = "scissors"\nprint("Computer:", com)\n'
               'if me == com:\n    result = "It\'s a tie"\nelif me == "rock" and com == "scissors":\n    result = "You win"\n'
               'else:\n    result = "You lose"\nprint("Result:", result)\n',
               'import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "rock"\nelif num == 2:\n    com = "paper"\nelse:\n    com = "scissors"\nprint("Computer:", com)\n'
               'if me == "rock" and com == "scissors" or me == "paper" and com == "rock" or me == "scissors" and com == "paper":\n'
               '    result = "You win"\nelse:\n    result = "You lose"\nprint("Result:", result)\n'],
    },
    ("P1", 3): {
        # 앞 단계 그대로(else가 「졌어요」), 지는 짝을 잘못 적음(가위-보는 이미 이긴 경우라 가위-바위가 빠짐),
        # 「아니면」을 != 와 or로 묶어 늘 참
        "ko": [P1_KO_JUDGE + 'else:\n    result = "졌어요"\nprint("결과:", result)\n',
               P1_KO_JUDGE + 'elif me == "가위" and com == "보":\n    result = "졌어요"\nelif me == "바위" and com == "보":\n'
               '    result = "졌어요"\nelif me == "보" and com == "가위":\n    result = "졌어요"\n'
               'else:\n    result = "가위·바위·보만 돼요"\nprint("결과:", result)\n',
               P1_KO_HEAD + 'if me != "가위" or me != "바위" or me != "보":\n    result = "가위·바위·보만 돼요"\n'
               'elif me == com:\n    result = "비겼어요"\nelse:\n    result = "졌어요"\nprint("결과:", result)\n'],
        "en": [P1_EN_JUDGE + 'else:\n    result = "You lose"\nprint("Result:", result)\n',
               P1_EN_JUDGE + 'elif me == "rock" and com == "scissors":\n    result = "You lose"\nelif me == "paper" and com == "scissors":\n'
               '    result = "You lose"\nelif me == "scissors" and com == "rock":\n    result = "You lose"\n'
               'else:\n    result = "Please pick again"\nprint("Result:", result)\n',
               P1_EN_HEAD + 'if me != "rock" or me != "paper" or me != "scissors":\n    result = "Please pick again"\n'
               'elif me == com:\n    result = "It\'s a tie"\nelse:\n    result = "You lose"\nprint("Result:", result)\n'],
    },
}


def node_data():
    p = subprocess.run(["node", HELPER], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=60)
    if p.returncode != 0:
        raise SystemExit("projects_helper.mjs failed:\n" + p.stderr)
    return json.loads(p.stdout)


def icon_names():
    with open(os.path.join(ROOT, "src", "ui", "dom.js"), encoding="utf-8") as f:
        src = f.read()
    block = src[src.index("const P = {"):]
    block = block[:block.index("\n};")]
    return set(re.findall(r"^\s*(\w+):", block, re.M))


# ---------------------------------------------------------------- 문법
def _is_tool_attr(n):
    return isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name) and n.value.id in TOOL_MODULES \
        and n.attr in TOOL_FUNCS


def width(line):
    return sum(2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1 for ch in line)


def grammar_problems(code, need):
    """경비실 표(gi.allowed) + 기본 입출력 + 새 도구 예외로 code를 검사. 문제 목록(빈 목록이면 통과)."""
    nodes, calls, methods, modules, from_names = gi.allowed(need)
    nodes = nodes | BASE_NODES
    calls = calls | BASE_CALLS
    tree = ast.parse(code)
    defined = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.ClassDef))}
    tool_imports = {id(n) for n in ast.walk(tree)
                    if isinstance(n, ast.Import) and all(a.name in TOOL_MODULES and a.asname is None for a in n.names)}
    tool_aliases = {id(a) for n in ast.walk(tree) if id(n) in tool_imports for a in n.names}
    bad = []
    for n in ast.walk(tree):
        name = type(n).__name__
        if id(n) in tool_imports or id(n) in tool_aliases or _is_tool_attr(n):
            continue
        if name not in nodes:
            bad.append("마디 " + name)
        if isinstance(n, ast.Import):
            bad += ["모듈 " + a.name for a in n.names if a.name not in modules]
        if isinstance(n, ast.ImportFrom):
            bad.append("모듈 " + str(n.module))
        if isinstance(n, ast.Call):
            f = n.func
            if isinstance(f, ast.Name):
                if f.id not in calls and f.id not in defined:
                    bad.append("부르는 이름 " + f.id)
            elif _is_tool_attr(f):
                pass
            elif isinstance(f, ast.Attribute):
                if f.attr not in methods and f.attr not in defined:
                    bad.append("메서드 " + f.attr)
            else:
                bad.append("부르는 대상 " + name)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "print" and n.keywords:
            if "keyword" not in nodes:
                bad.append("print의 이름 붙은 인자")
    return bad


def uses_random(code):
    """random.randint·random.choice를 부르는 이름 집합"""
    return {n.func.attr for n in ast.walk(ast.parse(code)) if isinstance(n, ast.Call) and _is_tool_attr(n.func)}


def self_test():
    cases = [
        (3, 'me = input()\nprint("나:", me)\n', True),
        (3, 'import random\nn = random.randint(1, 3)\nif n == 1 and n != 2:\n    print(f"{n}")\n', True),
        (3, 'import random\nprint(random.choice("ab"))\n', True),
        (3, 'import random as r\nprint(r.randint(1, 3))\n', False),
        (3, 'import random\nprint(random.random())\n', False),
        (3, 'import os\n', False),
        (3, 'from random import randint\n', False),
        (3, 'x = "a".upper()\n', False),
        (3, 'for i in range(3):\n    print(i)\n', False),
        (5, 'n = 0\nwhile n < 3:\n    n += 1\n', True),
        (3, 'print(len("ab"))\n', False),
        (3, 'print("a", end="")\n', False),
        (8, 'import random\nd = {"a": 1}\nprint(random.choice(list(d)))\n', False),   # list()는 경비실 표에 없음
    ]
    bad = 0
    for ch, code, want in cases:
        got = not grammar_problems(code, ch)
        if got != want:
            bad += 1
            print("FAIL 문법 검사기 자체 시험 %d장 %r → %s (기대 %s): %s" % (ch, code, got, want, grammar_problems(code, ch)))
    print("%s 문법 검사기 자체 시험 %d개" % ("ok  " if not bad else "FAIL", len(cases)))
    return bad


# ---------------------------------------------------------------- 실행
def normalize(text):
    """src/grade.js normalize와 같음: \r\n → \n, 줄 끝 공백·끝 줄바꿈 제거"""
    s = "" if text is None else str(text)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    return re.sub(r"\n+$", "", "\n".join(line.rstrip() for line in s.split("\n")))


def run_test(code, step, t, lang):
    files = t.get("files") or step.get("files")
    kw = {"lang": lang}
    if files:
        kw["files"] = files
    if t.get("rand") is not None:
        kw["rand"] = t["rand"]
    return runner.run(code, t.get("stdin"), step.get("require") or [], **kw)


def test_fails(code, step, t, lang):
    """시험 하나를 돌려 실패 이유(통과면 None)"""
    r = run_test(code, step, t, lang)
    if r.get("error"):
        return "오류 %s" % (r["error"].get("type") if isinstance(r["error"], dict) else r["error"])
    if normalize(r.get("stdout")) != normalize(t.get("expect")):
        return "출력 %r ≠ 기대 %r" % (normalize(r.get("stdout")), normalize(t.get("expect")))
    if r.get("missing"):
        return "빠진 문법 %s" % r["missing"]
    return None


def _text(v):
    return isinstance(v, str) and v.strip() != ""


def shape_problems(p, icons):
    bad = []
    for k in TEXT_KEYS:
        if not _text(p.get(k)):
            bad.append("%s 칸이 빈 글" % k)
    if p.get("icon") not in icons:
        bad.append("icon %r은 아이콘 묶음에 없음" % p.get("icon"))
    play = p.get("play")
    if not (isinstance(play, dict) and _text(play.get("prompt"))):
        bad.append("play.prompt가 없음")
    elif set(play) - {"prompt", "files"}:
        bad.append("play에 모르는 칸 %s" % sorted(set(play) - {"prompt", "files"}))
    steps = p.get("steps")
    if not (isinstance(steps, list) and 3 <= len(steps) <= 5):
        bad.append("단계는 3~5개")
        return bad
    for k, s in enumerate(steps):
        where = "%d단계 " % (k + 1)
        for key in STEP_TEXT_KEYS:
            if not _text(s.get(key)):
                bad.append(where + key + " 칸이 빈 글")
        if not _text(s.get("solution")):
            bad.append(where + "solution 없음")
        if "starter" in s and k > 0:
            bad.append(where + "starter는 첫 단계만(이후 단계는 앞 단계 코드에서 시작)")
        if "starter" in s and not isinstance(s["starter"], str):
            bad.append(where + "starter가 글이 아님")
        if "tool" in s:
            tool = s["tool"]
            if not (isinstance(tool, dict) and set(tool) == {"title", "body", "code"} and all(_text(tool[x]) for x in tool)):
                bad.append(where + "tool은 { title, body, code } 모두 글")
        if not (isinstance(s.get("hints"), list) and s["hints"] and all(_text(h) for h in s["hints"])):
            bad.append(where + "hints는 비지 않은 글 목록")
        if not (isinstance(s.get("require"), list) and all(isinstance(x, str) for x in s["require"])):
            bad.append(where + "require는 글 목록")
        tests = s.get("tests")
        if not (isinstance(tests, list) and tests):
            bad.append(where + "시험이 없음")
            continue
        if not any(t.get("public") is True for t in tests):
            bad.append(where + "공개 시험(public)이 없음")
        for i, t in enumerate(tests):
            extra = set(t) - {"stdin", "expect", "public", "rand", "files"}
            if extra:
                bad.append(where + "시험 %d에 모르는 칸 %s" % (i, sorted(extra)))
            if not isinstance(t.get("expect"), str) or not isinstance(t.get("stdin", ""), str) \
                    or not isinstance(t.get("public"), bool):
                bad.append(where + "시험 %d 모양(stdin 글, expect 글, public 참/거짓)" % i)
            if "rand" in t and not (isinstance(t["rand"], list) and t["rand"]):
                bad.append(where + "시험 %d rand는 비지 않은 목록" % i)
    return bad


def rand_problems(p):
    """⑥ 무작위를 쓰는 단계는 시험마다 rand, randint를 쓰면 rand 값은 모두 정수(bool 아님). ⑦ 처음 쓰는 단계에 tool."""
    bad = []
    first = True
    for k, s in enumerate(p["steps"]):
        used = uses_random(s["solution"])
        if not used:
            continue
        if first and "tool" not in s:
            bad.append("%d단계: random을 처음 쓰는 단계에 새 도구 카드(tool)가 없음" % (k + 1))
        first = False
        for i, t in enumerate(s["tests"]):
            if "rand" not in t:
                bad.append("%d단계 시험 %d: 무작위를 쓰는데 rand가 없음(채점이 매번 달라짐)" % (k + 1, i))
            elif "randint" in used and not all(type(v) is int for v in t["rand"]):
                bad.append("%d단계 시험 %d: randint에 넘길 rand 값이 정수가 아님 %r" % (k + 1, i, t["rand"]))
    return bad


def rand_self_test():
    good = {"steps": [{"solution": "print(1)", "tests": [{}]},
                      {"solution": "import random\nn = random.randint(1, 3)\n", "tool": {}, "tests": [{"rand": [1]}]}]}
    cases = [
        (good, True),
        ({"steps": [{"solution": "import random\nn = random.randint(1, 3)\n", "tests": [{"rand": [1]}]}]}, False),
        ({"steps": [{"solution": "import random\nn = random.randint(1, 3)\n", "tool": {}, "tests": [{}]}]}, False),
        ({"steps": [{"solution": "import random\nn = random.randint(1, 3)\n", "tool": {}, "tests": [{"rand": ["1"]}]}]}, False),
        ({"steps": [{"solution": "import random\nn = random.randint(1, 3)\n", "tool": {}, "tests": [{"rand": [True]}]}]}, False),
        ({"steps": [{"solution": "import random\nn = random.randint(1, 3)\n", "tool": {}, "tests": [{"rand": [1.0]}]}]}, False),
        ({"steps": [{"solution": 'import random\nn = random.choice("ab")\n', "tool": {}, "tests": [{"rand": ["a"]}]}]}, True),
    ]
    bad = 0
    for p, want in cases:
        if (not rand_problems(p)) != want:
            bad += 1
            print("FAIL rand 검사기 자체 시험 %r: %s" % (p, rand_problems(p)))
    print("%s rand 검사기 자체 시험 %d개" % ("ok  " if not bad else "FAIL", len(cases)))
    return bad


def strings(v):
    if isinstance(v, str):
        yield v
    elif isinstance(v, dict):
        for x in v.values():
            yield from strings(x)
    elif isinstance(v, list):
        for x in v:
            yield from strings(x)


def main():
    data = node_data()
    fails = self_test() + rand_self_test()

    def check(ok, label, extra=""):
        nonlocal fails
        if ok:
            print("ok   " + label)
        else:
            fails += 1
            print("FAIL " + label + ((" — " + extra) if extra else ""))

    check(data["stepXp"] == 5 and data["doneXp"] == 20, "⑩ PROJECT_STEP_XP = 5, PROJECT_DONE_XP = 20")
    ko, en = data["ko"], data["en"]
    check([(p["id"], p["need"]) for p in ko] == WANT, "① 한국어 id·장 = WANT", str([(p.get("id"), p.get("need")) for p in ko]))
    check([(p["id"], p["need"]) for p in en] == WANT, "① 영어 id·장 = WANT", str([(p.get("id"), p.get("need")) for p in en]))
    icons = icon_names()
    en_by_id = {p["id"]: p for p in en}
    for p in ko:
        e = en_by_id.get(p["id"])
        if e is None:
            continue
        pid = p["id"]
        for lang, q in (("ko", p), ("en", e)):
            bad = shape_problems(q, icons)
            check(not bad, "② %s %s 칸 모양" % (pid, lang), "; ".join(bad))
        if not (isinstance(p.get("steps"), list) and isinstance(e.get("steps"), list)):
            continue
        same = len(p["steps"]) == len(e["steps"])
        detail = []
        if same:
            for k, (a, b) in enumerate(zip(p["steps"], e["steps"])):
                if len(a["tests"]) != len(b["tests"]):
                    detail.append("%d단계 시험 수" % (k + 1))
                    continue
                for i, (ta, tb) in enumerate(zip(a["tests"], b["tests"])):
                    if len(ta.get("rand") or []) != len(tb.get("rand") or []) or ta.get("public") != tb.get("public"):
                        detail.append("%d단계 시험 %d rand 길이·public" % (k + 1, i))
                if a.get("require") != b.get("require"):
                    detail.append("%d단계 require" % (k + 1))
                if ("tool" in a) != ("tool" in b):
                    detail.append("%d단계 tool" % (k + 1))
        check(same and not detail, "① %s 한·영 단계 수·시험 수·rand 길이·require·tool 같음" % pid, ", ".join(detail))
        hangul_en = [s for s in strings(e) if HANGUL.search(s)]
        check(not hangul_en, "⑨ %s 영어 파일에 한글 없음" % pid, repr(hangul_en[:3]))
        no_ko = [k + 1 for k, s in enumerate(p["steps"]) if not (HANGUL.search(s.get("task", "")) and HANGUL.search(s.get("goal", "")))]
        check(not no_ko, "⑨ %s 한국어 단계 글에 한글" % pid, str(no_ko))

        for lang, q in (("ko", p), ("en", e)):
            steps = q["steps"]
            bad = rand_problems(q)
            check(not bad, "⑥⑦ %s %s 무작위 시험 값·새 도구 카드" % (pid, lang), "; ".join(bad))
            for k, s in enumerate(steps):
                tag = "%s %s %d단계" % (pid, lang, k + 1)
                # ⑤ 문법
                codes = [("solution", s["solution"])]
                if "starter" in s:
                    codes.append(("starter", s["starter"]))
                if "tool" in s:
                    codes.append(("tool.code", s["tool"]["code"]))
                gbad = []
                for what, code in codes:
                    try:
                        gbad += ["%s: %s" % (what, x) for x in grammar_problems(code, q["need"])]
                    except SyntaxError as ex:
                        gbad.append("%s: 문법 오류 %s" % (what, ex))
                check(not gbad, "⑤ %s %d장까지 문법(+새 도구)" % (tag, q["need"]), "; ".join(gbad))
                wide = ["%s: %r(%d칸)" % (what, line, width(line)) for what, code in codes for line in code.split("\n")
                        if width(line) > CODE_COLS]
                check(not wide, "⑪ %s 코드 줄 폭 %d칸 이하" % (tag, CODE_COLS), "; ".join(wide))
                # ③ 정답이 시험 통과
                why = [(i, test_fails(s["solution"], s, t, lang)) for i, t in enumerate(s["tests"])]
                why = [(i, w) for i, w in why if w]
                check(not why, "③ %s solution이 시험 %d개 통과" % (tag, len(s["tests"])), "; ".join("시험 %d %s" % x for x in why))
                # ④ 다음 단계의 시작
                if k + 1 < len(steps):
                    nxt = steps[k + 1]
                    t = next((t for t in nxt["tests"] if t.get("public")), nxt["tests"][0])
                    r = run_test(s["solution"], nxt, t, lang)
                    check(not r.get("error"), "④ %s solution이 %d단계 공개 시험에서 오류 없이 돎" % (tag, k + 2),
                          str(r.get("error")))
                # ⑧ 오답
                wrong = WRONG.get((pid, k), {}).get(lang, [])
                check(len(wrong) >= 1, "⑧ %s 오답 1개 이상" % tag, "WRONG[(%r, %d)][%r] 없음" % (pid, k, lang))
                for j, code in enumerate(wrong):
                    failed = any(test_fails(code, s, t, lang) for t in s["tests"])
                    check(failed, "⑧ %s 오답 %d은 시험에서 실패" % (tag, j + 1))
    print("실패 %d" % fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
