"""경비실 사건 정답 검사 (v0.15 작업 5, 설계서 docs/specs/2026-11-12-경비실-설계.md §3·§6).

사건마다(한국어·영어 각각):
  ① solution이 엔진(src/py/runner.py run(guard=…))에서 해결(solved)
  ② 빈칸을 정답으로 채운 코드(src/guard/blanks.js fillBlanks)도 해결
  ③ 오답 보기를 하나씩 넣은 코드는 해결에 실패
  ④ 「전부 막기」·「전부 들이기」 코드는 해결에 실패
  ⑤ solution이 그 장까지 배운 문법(AST 마디·부르는 이름)만 씀
  ⑥ 시도 1~20개, block·allow 각 1개 이상  ⑦ 사건 id 순서(장 순서), need 오름차순
  ⑧ 있는 장마다 사건이 정확히 3개
영어 실행은 시도 값을 value_en ?? value 로 만든다.

실행: python3 tests/guard_incidents.py   (하나라도 실패하면 종료 코드 1)
"""

import ast
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "src", "py"))

import runner  # noqa: E402

HELPER = os.path.join(ROOT, "tests", "guard_incidents_helper.mjs")

ENGINE_CMDS = {"block", "allow", "has_try", "next_try"}
COMMON = {"Module", "Expr", "Assign", "Name", "Constant", "Call", "BinOp"}
OPS_CTX = {"Eq", "NotEq", "Lt", "LtE", "Gt", "GtE", "In", "NotIn", "Is", "IsNot", "And", "Or", "Not", "Add", "Sub",
           "Mult", "Div", "FloorDiv", "Mod", "Pow", "USub", "UAdd", "Load", "Store", "arguments", "arg"}
# 장별 허용 문법(설계서 docs/specs/2026-11-13-경비실-사건-12개-설계.md §5-6, 누적)
NODES_BY_CH = {3: {"Compare", "BoolOp", "UnaryOp", "If"}, 4: {"FunctionDef", "Return"},
               5: {"While", "For", "AugAssign", "Break", "Continue"}, 6: {"Subscript", "Slice", "Attribute"},
               7: {"List", "Subscript", "Slice"},
               8: {"Dict"},
               9: {"Tuple", "Set", "BitAnd", "BitOr"},
               10: {"Try", "ExceptHandler", "Raise"},
               11: {"With", "withitem", "Import", "alias", "keyword"},
               13: {"ImportFrom"},
               15: {"ClassDef", "Pass"}}
# 장별로 import할 수 있는 모듈(누적)과 from-import로 가져올 이름
IMPORTS_BY_CH = {11: {"csv"}, 12: {"re"}, 13: {"urllib.parse"}, 14: {"json"}}
FROM_NAMES_BY_CH = {13: {"urlparse"}, 14: {"parse_qs"}}
CALLS_BY_CH = {4: {"len"}, 5: {"range"},
               7: {"sorted", "min", "max", "sum"},
               9: {"set"},
               10: {"int", "float"},
               11: {"open"}, 13: {"urlparse"}, 14: {"parse_qs"}, 15: {"super"}}
METHODS = {"lower", "upper", "strip", "split", "replace", "find", "count", "startswith", "endswith"}
METHODS_BY_CH = {7: {"append", "remove", "sort"}, 8: {"get", "keys", "values", "items"}, 9: {"add"},
                 11: {"reader", "readlines", "read"},
                 12: {"search", "fullmatch", "findall", "sub"}, 14: {"loads"}}
WANT_IDS = ["G1", "G2", "G7", "G3", "G8", "G9", "G4", "G5", "G10", "G6", "G11", "G12",
            "G13", "G14", "G15", "G16", "G17", "G18", "G19", "G20", "G21",
            "G22", "G23", "G24", "G25", "G26", "G27", "G28", "G29", "G30",
            "G31", "G32", "G33", "G34", "G35", "G36", "G37", "G38", "G39",
            "G40", "G41", "G42", "G43", "G44", "G45"]
WANT_CHAPTERS = [3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9,
                 10, 10, 10, 11, 11, 11, 12, 12, 12, 13, 13, 13, 14, 14, 14, 15, 15, 15, 16, 16, 16, 17, 17, 17]


def allowed(need):
    nodes = set(COMMON) | OPS_CTX
    calls = set(ENGINE_CMDS)
    methods = set(METHODS)
    for ch in range(3, need + 1):
        nodes |= NODES_BY_CH.get(ch, set())
        calls |= CALLS_BY_CH.get(ch, set())
        methods |= METHODS_BY_CH.get(ch, set())
    modules, from_names = set(), set()
    for ch in range(3, need + 1):
        modules |= IMPORTS_BY_CH.get(ch, set())
        from_names |= FROM_NAMES_BY_CH.get(ch, set())
    return nodes, calls, methods, modules, from_names


def grammar_problems(code, need):
    nodes, calls, methods, modules, from_names = allowed(need)
    tree = ast.parse(code)
    # 정답이 스스로 정의한 함수·클래스·메서드 이름은 부를 수 있다(4장부터 함수, 15장부터 클래스)
    defined = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.ClassDef))}
    bad = []
    for n in ast.walk(tree):
        name = type(n).__name__
        if name not in nodes:
            bad.append("마디 " + name)
        if isinstance(n, ast.Import):
            bad += ["모듈 " + a.name for a in n.names if a.name not in modules]
        if isinstance(n, ast.ImportFrom):
            if n.module != "urllib.parse" or n.module not in modules:
                bad.append("모듈 " + str(n.module))
            bad += ["가져오는 이름 " + a.name for a in n.names if a.name not in from_names]
        if isinstance(n, ast.Call):
            f = n.func
            if isinstance(f, ast.Name):
                if f.id not in calls and f.id not in defined:
                    bad.append("부르는 이름 " + f.id)
            elif isinstance(f, ast.Attribute):
                if f.attr not in methods and f.attr not in defined:
                    bad.append("메서드 " + f.attr)
            else:
                bad.append("부르는 대상 " + name)
    return bad


GATE = """class Gate:
    def __init__(self, names):
        self.names = names
    def allows(self, x):
        return x in self.names
gate = Gate(["ria"])
ok = gate.allows(attempt)
"""
SUB = """class Base:
    def __init__(self, n):
        self.n = n
class Kid(Base):
    def __init__(self, n):
        super().__init__(n)
k = Kid(1)
"""


def self_test():
    """허용 문법 검사기 자체 시험(사건 시험 전에 돈다)."""
    cases = [
        (13, 'from urllib.parse import urlparse\nok = urlparse(attempt).hostname == "x"\n', True),
        (14, 'from urllib.parse import parse_qs\nq = parse_qs(attempt)\n', True),
        (14, 'import json\nd = json.loads(attempt)\n', True),
        (15, GATE, True),
        (15, SUB, True),
        (14, GATE, False),
        (12, "import os\n", False),
        (14, "import os\n", False),
        (12, "import csv\nimport re\nre.search(\"a\", attempt)\n", True),
        (12, "import json\n", False),
        (7, "class A:\n    pass\n", False),
        (6, "x = [1, 2]\n", False),
        (9, "s = set()\ns.add(attempt)\n", True),
        (8, "s = set()\n", False),
        (13, "from os import path\n", False),
        (13, "from urllib.parse import parse_qs\n", False),
    ]
    bad = 0
    for ch, code, want in cases:
        got = not grammar_problems(code, ch)
        if got != want:
            bad += 1
            print("FAIL 자체 시험 %d장 %r → %s (기대 %s)" % (ch, code[:40], got, want))
    print("%s 허용 문법 검사기 자체 시험 %d개" % ("ok  " if not bad else "FAIL", len(cases)))
    return bad


def node_data():
    p = subprocess.run(["node", HELPER], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=60)
    if p.returncode != 0:
        print(p.stderr)
        raise SystemExit("도우미 실패")
    return json.loads(p.stdout)


def all_code(inc, verdict):
    if inc["mode"] == "script":
        return verdict + "()\n"
    if inc["mode"] == "loop":
        return "while has_try():\n    next_try()\n    %s()\n" % verdict
    return "def check(attempt):\n    return %s\n" % ("False" if verdict == "block" else "True")


def solved(inc, code, lang):
    tries = [{"value": t.get("value_en", t["value"]) if lang == "en" else t["value"], "expect": t["expect"]}
             for t in inc["tries"]]
    guard = {"mode": inc["mode"], "tries": tries}
    if inc.get("password") is not None:
        guard["password"] = inc["password"]
    if inc.get("files"):
        r = runner.run(code, lang=lang, guard=guard, files=inc["files"])
    else:
        r = runner.run(code, lang=lang, guard=guard)
    g = r.get("guard") or {}
    return bool(g.get("solved")), r.get("error"), g


def main():
    data = node_data()
    incs, filled = data["incidents"], data["filled"]
    fails = self_test()

    def check(ok, label, extra=""):
        nonlocal fails
        if not ok:
            fails += 1
        print("%s %s%s" % ("ok  " if ok else "FAIL", label, (" — " + extra) if extra else ""))

    check([i["id"] for i in incs] == WANT_IDS and [i["need"] for i in incs] == WANT_CHAPTERS, "⑦ 사건 id 순서·장 번호")
    per = {}
    for i in incs:
        per[i["need"]] = per.get(i["need"], 0) + 1
    check(len(incs) == 45 and sorted(per) == list(range(3, 18)) and all(n == 3 for n in per.values()),
          "⑧ 3~17장 모두 있고 장마다 정확히 3개(1·2장 없음)", str(per))
    ids = [i["id"] for i in incs]
    check(sorted(ids, key=lambda x: int(x[1:])) == ["G%d" % n for n in range(1, 46)] and len(set(ids)) == 45,
          "⑨ id가 G1~G45 모두 한 번씩")
    check(data["xp"] == 5, "GUARD_XP = 5")
    for inc in incs:
        n = len(inc["tries"])
        exp = {t["expect"] for t in inc["tries"]}
        check(1 <= n <= 20 and exp == {"block", "allow"}, "⑥ %s 시도 %d개, block·allow 모두 있음" % (inc["id"], n))
        bad = grammar_problems(inc["solution"], inc["need"])
        check(not bad, "⑤ %s 정답이 %d장 문법 안" % (inc["id"], inc["need"]), ", ".join(bad))
        for key in ("title", "brief", "ria", "concept", "crowIntro", "crowLose"):
            check(bool(inc.get(key)), "   %s.%s 글 있음" % (inc["id"], key)) if not inc.get(key) else None
        check(all(t.get("why") for t in inc["tries"]), "   %s 시도마다 why" % inc["id"])
        if inc["id"] in ("G5", "G12"):
            check(all(t.get("value_en") and t["value_en"] != t["value"] for t in inc["tries"]), "   %s value_en" % inc["id"])

    for lang in ("ko", "en"):
        print("== %s" % ("한국어" if lang == "ko" else "English (value_en ?? value, runner lang=en)"))
        for inc in incs:
            f = filled[inc["id"]]
            ok, err, _ = solved(inc, inc["solution"], lang)
            check(ok, "① %s solution → 해결" % inc["id"], str(err) if err else "")
            check(f["answer"]["code"] == inc["solution"], "② %s 정답 채우기 = solution 코드" % inc["id"])
            ok, err, _ = solved(inc, f["answer"]["code"], lang)
            check(ok, "② %s 빈칸 정답으로 채움 → 해결" % inc["id"], str(err) if err else "")
            for w in f["wrong"]:
                ok, err, _ = solved(inc, w["code"], lang)
                check(not ok, "③ %s 칸%d 오답 %r → 실패" % (inc["id"], w["blank"], w["option"]),
                      "해결됨(보기 바꿔야 함)" if ok else "")
            for verdict, name in (("block", "전부 막기"), ("allow", "전부 들이기")):
                ok, _, _ = solved(inc, all_code(inc, verdict), lang)
                check(not ok, "④ %s %s → 실패" % (inc["id"], name))
    print("실패 %d" % fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
