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


# ── v0.4 E1 가상 파일 ─────────────────────────────────────────────
import os  # noqa: E402
import socket  # noqa: E402

import pytest  # noqa: E402


def test_files_readable():
    r = run('f = open("memo.txt", encoding="utf-8")\nprint(f.read())\nf.close()\n', "", [],
            files={"memo.txt": "우유\n빵\n"})
    assert r["error"] is None, r
    assert r["stdout"] == "우유\n빵\n\n"


def test_files_readable_default_encoding_and_with():
    r = run('with open("a.txt") as f:\n    for line in f:\n        print(line.strip())\n', "", [],
            files={"a.txt": "하나\n둘\n"})
    assert r["error"] is None, r
    assert r["stdout"] == "하나\n둘\n"


def test_write_then_read_same_run():
    code = ('with open("out.txt", "w") as f:\n    f.write("저장")\n'
            'with open("out.txt") as f:\n    print(f.read())\n')
    r = run(code, "", [])
    assert r["error"] is None, r
    assert r["stdout"] == "저장\n"


def test_file_gone_next_run():
    run('open("left.txt", "w").write("x")\n', "", [], files={"given.txt": "y"})
    r = run('open("left.txt")\n', "", [])
    assert r["error"]["type"] == "FileNotFoundError", r
    r2 = run('open("given.txt")\n', "", [])
    assert r2["error"]["type"] == "FileNotFoundError", r2


def test_cwd_restored_and_dir_removed():
    before = os.getcwd()
    r = run("import os\nprint(os.getcwd())\nos.chdir('/')\n", "", [], files={"m.txt": "1"})
    assert r["error"] is None, r
    run_dir = r["stdout"].strip()
    assert run_dir != before
    assert os.getcwd() == before
    assert not os.path.exists(run_dir)


def test_cwd_restored_after_error():
    before = os.getcwd()
    r = run("open('m.txt')\n1/0\n", "", [], files={"m.txt": "1"})
    assert r["error"]["type"] == "ZeroDivisionError"
    assert os.getcwd() == before


def test_missing_file_error_line():
    r = run("x = 1\nopen('nope.txt')\n", "", [], files={"m.txt": "1"})
    assert r["error"]["type"] == "FileNotFoundError"
    assert r["error"]["line"] == 2


# ── v0.4 E2 연습 서버 ─────────────────────────────────────────────
SERVER = {
    "https://ria.example/menu": {"status": 200, "body": "김밥 3000\n라면 4000", "type": "text/plain"},
    "https://ria.example/api/cat": {"status": 200, "body": '{"name": "리아"}', "type": "application/json"},
    "https://ria.example/secret": {"status": 404, "body": "없어요"},
}


@pytest.fixture
def no_socket(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("socket used")
    monkeypatch.setattr(socket, "socket", boom)
    monkeypatch.setattr(socket, "create_connection", boom)
    monkeypatch.setattr(socket, "getaddrinfo", boom)


def test_server_200(no_socket):
    code = ("import urllib.request\n"
            "r = urllib.request.urlopen('https://ria.example/menu')\n"
            "print(r.status, r.getcode())\n"
            "print(r.read().decode('utf-8'))\n")
    r = run(code, "", [], server=SERVER)
    assert r["error"] is None, r
    assert r["stdout"] == "200 200\n김밥 3000\n라면 4000\n"


def test_server_with_and_from_import(no_socket):
    code = ("from urllib.request import urlopen\n"
            "import json\n"
            "with urlopen('https://ria.example/api/cat') as r:\n"
            "    data = json.loads(r.read())\n"
            "    print(r.headers['Content-Type'])\n"
            "print(data['name'])\n")
    r = run(code, "", [], server=SERVER)
    assert r["error"] is None, r
    assert r["stdout"] == "application/json; charset=utf-8\n리아\n"


def test_server_404_http_error(no_socket):
    code = ("import urllib.request\n"
            "import urllib.error\n"
            "try:\n"
            "    urllib.request.urlopen('https://ria.example/secret')\n"
            "except urllib.error.HTTPError as e:\n"
            "    print(e.code, e.read().decode())\n"
            "urllib.request.urlopen('https://ria.example/secret')\n")
    r = run(code, "", [], server=SERVER)
    assert r["stdout"] == "404 없어요\n", r
    assert r["error"]["type"] == "HTTPError", r
    assert r["error"]["line"] == 7
    assert "404" in r["error"]["msg"]


def test_server_unknown_url_error(no_socket):
    code = ("import urllib.request\n"
            "import urllib.error\n"
            "try:\n"
            "    urllib.request.urlopen('https://naver.com')\n"
            "except urllib.error.URLError as e:\n"
            "    print(e.reason)\n")
    r = run(code, "", [], server=SERVER)
    assert r["error"] is None, r
    assert r["stdout"] == "연습 서버에 없는 주소예요\n"
    r2 = run("import urllib.request\nurllib.request.urlopen('https://naver.com')\n", "", [], server=SERVER)
    assert r2["error"]["type"] == "URLError", r2
    assert r2["error"]["line"] == 2


def test_server_request_object(no_socket):
    code = ("import urllib.request\n"
            "req = urllib.request.Request('https://ria.example/menu')\n"
            "print(urllib.request.urlopen(req, timeout=5).status)\n")
    r = run(code, "", [], server=SERVER)
    assert r["error"] is None, r
    assert r["stdout"] == "200\n"


def test_real_urlopen_restored():
    import urllib.request
    real = urllib.request.urlopen
    run("import urllib.request\nurllib.request.urlopen = None\n", "", [], server=SERVER)
    assert urllib.request.urlopen is real
    run("import urllib.request\n1/0\n", "", [], server=SERVER)
    assert urllib.request.urlopen is real


def test_server_and_files_together(no_socket):
    code = ("from urllib.request import urlopen\n"
            "text = urlopen('https://ria.example/menu').read().decode()\n"
            "with open('menu.txt', 'w') as f:\n    f.write(text)\n"
            "print(open('menu.txt').read().split()[0], open('note.txt').read())\n")
    r = run(code, "", [], files={"note.txt": "메모"}, server=SERVER)
    assert r["error"] is None, r
    assert r["stdout"] == "김밥 메모\n"


def test_backward_compatible_positional():
    r = run("print(1)", "", [])
    assert r["stdout"] == "1\n"
