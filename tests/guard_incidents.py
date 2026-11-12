"""경비실 사건 정답 검사 (v0.15 작업 5, 설계서 docs/specs/2026-11-12-경비실-설계.md §3·§6).

사건마다(한국어·영어 각각):
  ① solution이 엔진(src/py/runner.py run(guard=…))에서 해결(solved)
  ② 빈칸을 정답으로 채운 코드(src/guard/blanks.js fillBlanks)도 해결
  ③ 오답 보기를 하나씩 넣은 코드는 해결에 실패
  ④ 「전부 막기」·「전부 들이기」 코드는 해결에 실패
  ⑤ solution이 그 장까지 배운 문법(AST 마디·부르는 이름)만 씀
  ⑥ 시도 1~20개, block·allow 각 1개 이상  ⑦ 사건 id 순서 G1~G6, need 3,3,4,5,5,6
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
NODES_BY_CH = {3: {"Compare", "BoolOp", "UnaryOp", "If"}, 4: {"FunctionDef", "Return"},
               5: {"While", "For", "AugAssign", "Break", "Continue"}, 6: {"Subscript", "Slice", "Attribute"}}
CALLS_BY_CH = {4: {"len"}, 5: {"range"}}
METHODS = {"lower", "upper", "strip", "split", "replace", "find", "count", "startswith", "endswith"}
WANT_IDS = ["G1", "G2", "G3", "G4", "G5", "G6"]
WANT_NEED = [3, 3, 4, 5, 5, 6]


def allowed(need):
    nodes = set(COMMON) | OPS_CTX
    calls = set(ENGINE_CMDS)
    for ch in range(3, need + 1):
        nodes |= NODES_BY_CH.get(ch, set())
        calls |= CALLS_BY_CH.get(ch, set())
    return nodes, calls


def grammar_problems(code, need):
    nodes, calls = allowed(need)
    bad = []
    for n in ast.walk(ast.parse(code)):
        name = type(n).__name__
        if name not in nodes:
            bad.append("마디 " + name)
        if isinstance(n, ast.Call):
            f = n.func
            if isinstance(f, ast.Name):
                if f.id not in calls:
                    bad.append("부르는 이름 " + f.id)
            elif isinstance(f, ast.Attribute):
                if f.attr not in METHODS:
                    bad.append("메서드 " + f.attr)
            else:
                bad.append("부르는 대상 " + name)
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
    r = runner.run(code, lang=lang, guard=guard)
    g = r.get("guard") or {}
    return bool(g.get("solved")), r.get("error"), g


def main():
    data = node_data()
    incs, filled = data["incidents"], data["filled"]
    fails = 0

    def check(ok, label, extra=""):
        nonlocal fails
        if not ok:
            fails += 1
        print("%s %s%s" % ("ok  " if ok else "FAIL", label, (" — " + extra) if extra else ""))

    check([i["id"] for i in incs] == WANT_IDS and [i["need"] for i in incs] == WANT_NEED, "⑦ 사건 id 순서·장 번호")
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
        if inc["id"] == "G5":
            check(all(t.get("value_en") and t["value_en"] != t["value"] for t in inc["tries"]), "   G5 value_en")

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
