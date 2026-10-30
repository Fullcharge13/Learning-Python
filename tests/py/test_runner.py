import builtins
import sys

from runner import run


def test_stdin():
    code = "a = input()\nb = input()\nprint(a, b)"
    short = run(code, ["1"], [])
    assert short["error"]["type"] == "InputMissing"
    assert short["error"]["line"] == 2
    ok = run(code, ["1", "2", "3"], [])
    assert ok["error"] is None
    assert ok["stdout"] == "1 2\n"


def test_lines():
    r = run('a = 1\nb = 2\nprin("x")\n', [], [])
    assert r["error"]["type"] == "NameError"
    assert r["error"]["line"] == 3
    assert "prin" in r["error"]["msg"]


def test_require():
    r = run("print(1)", [], ["If"])
    assert r["missing"] == ["If"]
    assert r["stdout"] == "1\n"
    r2 = run("x = 3\nif x > 1:\n    print(x)\n", [], ["If"])
    assert r2["missing"] == []


def test_restores_streams_after_exception():
    out, err, inp = sys.stdout, sys.stderr, builtins.input
    r = run("print('a')\n1/0\n", [], [])
    assert r["error"]["type"] == "ZeroDivisionError"
    assert r["error"]["line"] == 2
    assert r["stdout"] == "a\n"
    assert sys.stdout is out and sys.stderr is err and builtins.input is inp


def test_syntax_error_line():
    r = run('print("a")\nx = 1\nif x > 0\n    print(x)\n', [], ["If"])
    assert r["error"]["type"] == "SyntaxError"
    assert r["error"]["line"] == 3
    assert r["missing"] == []
    assert r["stdout"] == ""


def test_indentation_error_line():
    r = run("x = 1\nif x:\nprint(x)\n", [], [])
    assert r["error"]["type"] == "IndentationError"
    assert r["error"]["line"] == 3


def test_input_prompt_echo():
    r = run('n = input("이름? ")\nprint("안녕", n)', ["리아"], [])
    assert r["error"] is None
    assert r["stdout"] == "이름? 안녕 리아\n"


def test_exit_is_normal_end():
    r = run('print(1)\nexit()\nprint(2)\n', [], [])
    assert r["error"] is None
    assert r["stdout"] == "1\n"
    r2 = run('import sys\nprint(1)\nsys.exit(0)\n', [], [])
    assert r2["error"] is None
    assert r2["stdout"] == "1\n"


def test_fresh_globals_and_main():
    r = run("print(__name__)\nleak = 1\n", [], [])
    assert r["stdout"] == "__main__\n"
    r2 = run("print(leak)", [], [])
    assert r2["error"]["type"] == "NameError"


def test_stderr_captured():
    r = run("import sys\nprint('e', file=sys.stderr)\n", [], [])
    assert r["stderr"] == "e\n"
    assert r["error"] is None


# --- 검토 C18 ---

def test_stdin_string_format():
    r = run("a = int(input())\nb = int(input())\nprint(a + b)", "12\n30", [])
    assert r["error"] is None
    assert r["stdout"] == "42\n"
    r2 = run("a = int(input())\nb = int(input())\nprint(a + b)", "12\n30\n", [])
    assert r2["stdout"] == "42\n"
    r3 = run("input()", "", [])
    assert r3["error"]["type"] == "InputMissing"


def test_builtins_restored_after_override():
    run("import builtins\nbuiltins.print = lambda *a, **k: None\nbuiltins.zz = 1\n", [], [])
    r = run("print('ok')", [], [])
    assert r["stdout"] == "ok\n"
    assert not hasattr(builtins, "zz")
    assert builtins.print is print


def test_recursion_limit_restored():
    before = sys.getrecursionlimit()
    run("import sys\nsys.setrecursionlimit(123456)\n", [], [])
    assert sys.getrecursionlimit() == before


def test_new_modules_removed():
    assert "this" not in sys.modules
    run("import this\n", [], [])
    assert "this" not in sys.modules


def test_output_limit_single_print():
    r = run("print('x' * 10**6)\n", [], [])
    assert r["error"]["type"] == "OutputLimit"
    assert r["error"]["line"] == 1
    assert len(r["stdout"]) + len(r["stderr"]) <= 100_000 + 500


def test_output_limit_loop():
    r = run("for i in range(10**5):\n    print(i, 'abcdefghij')\n", [], [])
    assert r["error"]["type"] == "OutputLimit"
    assert r["error"]["line"] == 2
    assert len(r["stdout"]) <= 100_000


def test_learner_closes_stdout():
    out = sys.stdout
    r = run("import sys\nprint('a')\nsys.stdout.close()\nprint('b')\n", [], [])
    assert r["error"] is None
    assert r["stdout"] == "a\nb\n"
    assert sys.stdout is out


def test_input_missing_even_if_caught():
    r = run("try:\n    input()\nexcept:\n    pass\nprint('after')\n", [], [])
    assert r["error"]["type"] == "InputMissing"
    assert r["error"]["line"] == 2


# --- 재검토 후속 ---

def test_deleted_builtin_str_still_returns_result():
    r = run("import builtins\ndel builtins.str\nraise ValueError()\n", [], [])
    assert isinstance(r, dict)
    assert r["error"]["type"] == "ValueError"
    assert r["error"]["line"] == 3
    r2 = run("print(str(5))", [], [])
    assert r2["error"] is None and r2["stdout"] == "5\n"


def test_deleted_builtins_during_print_capture():
    r = run("import builtins\ndel builtins.len\ndel builtins.str\ndel builtins.super\nprint('hi', 3)\n", [], [])
    assert r["error"] is None
    assert r["stdout"] == "hi 3\n"


def test_bad_str_exception_message_falls_back():
    code = "class Boom(Exception):\n    def __str__(self):\n        raise RuntimeError('no')\nraise Boom()\n"
    r = run(code, [], [])
    assert r["error"]["type"] == "Boom"
    assert r["error"]["msg"] == "Boom"
    assert r["error"]["line"] == 4


def test_compile_non_syntax_error_reported():
    r = run("-" * 200000 + "1", [], [])
    assert r["error"]["type"] == "MemoryError"
    assert r["missing"] == []
    assert run("print(1)", [], [])["stdout"] == "1\n"


# --- C26: Call:<이름> / Name:<이름> ---

def test_require_call():
    assert run("x = 1.5\nprint(type(x))", [], ["Call:type"])["missing"] == []
    assert run("print(\"<class 'float'>\")", [], ["Call:type"])["missing"] == ["Call:type"]
    # 메서드 호출(obj.type())은 이름 호출이 아님
    assert run("class A:\n    def type(self):\n        return 1\nprint(A().type())", [], ["Call:type"])["missing"] == ["Call:type"]


def test_require_name_read():
    assert run("count = 3\nprint(1300*3)", [], ["Name:count"])["missing"] == ["Name:count"]
    assert run("count = 3\nprint(1300*count)", [], ["Name:count"])["missing"] == []


def test_require_mixed_kinds_order_kept():
    r = run("print(1)", [], ["If", "Call:int", "Name:n", "Call"])
    assert r["missing"] == ["If", "Call:int", "Name:n"]


# --- C34: Method:<이름> ---

def test_require_method():
    assert run('d = {"a": 1}\nprint(d.get("a", 0))', [], ["Method:get"])["missing"] == []
    assert run('d = {"a": 1}\nprint(d["a"])', [], ["Method:get"])["missing"] == ["Method:get"]
    assert run("x = []\nx.append(1)\nprint(x)", [], ["Method:append"])["missing"] == []
    r = run("def append(v):\n    return v\nappend(1)", [], ["Method:append"])
    assert r["missing"] == ["Method:append"]
    # 호출 없이 속성만 읽는 것은 메서드 호출이 아님
    assert run("x = []\nf = x.append\nprint(1)", [], ["Method:append"])["missing"] == ["Method:append"]
