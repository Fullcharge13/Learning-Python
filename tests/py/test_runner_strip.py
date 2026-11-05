"""판정 C66: 빌드가 runner.py의 주석·설명 글(docstring)을 빼고 넣는다. 뺀 runner가 원본과 똑같이 동작해야 한다."""
import importlib.util
import io
import json
import os
import sys
import tokenize
import types

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, ROOT)

import build  # noqa: E402
import runner  # noqa: E402

SRC = open(os.path.join(ROOT, "src", "py", "runner.py"), encoding="utf-8").read()


def _stripped_module():
    code = build.strip_runner(SRC)
    mod = types.ModuleType("runner_stripped")
    exec(compile(code, "runner_stripped.py", "exec"), mod.__dict__)
    return code, mod


def test_no_comments_or_docstrings():
    code, _ = _stripped_module()
    kinds = [t.type for t in tokenize.generate_tokens(io.StringIO(code).readline)]
    assert tokenize.COMMENT not in kinds
    import ast
    for n in ast.walk(ast.parse(code)):
        if isinstance(n, (ast.Module, ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef)):
            assert ast.get_docstring(n, clean=False) is None, getattr(n, "name", "module")
    assert len(code.encode()) < len(SRC.encode()) * 0.75


FARM = {"size": 3, "cells": [None, {"crop": "당근", "planted_at": -20}] + [None] * 7,
        "pie": {"x": 0, "y": 0}, "clock": 0, "store": {"당근": 0, "감자": 0}, "upgrades": []}

CASES = [
    ("print('안녕')\n", "", [], {}),
    ("n = int(input())\nprint(n * 2)\n", "21", ["Call:int"], {}),
    ("print(1/0)\n", "", [], {}),
    ("x = [1, 2\n", "", [], {}),
    ("import chart\nchart.bar(['a','b'], [1, 2])\nchart.show()\n", "", [], {}),
    ("move('오른쪽')\nharvest()\nprint(store(), where())\n", "", [], {"farm": FARM}),
    ("while True:\n    move('오른쪽')\n", "", [], {"farm": FARM}),
    ("while not can_harvest():\n    pass\n", "", [], {"farm": FARM}),
    ("move('앞')\n", "", [], {"farm": FARM}),
    ("with open('a.txt') as f:\n    print(f.read())\n", "", [], {"files": {"a.txt": "hi"}}),
]


def test_stripped_runner_behaves_the_same():
    _, mod = _stripped_module()
    for code, stdin, req, kw in CASES:
        a = runner.run(code, stdin, req, **kw)
        b = mod.run(code, stdin, req, **kw)
        # 오류 원문의 runner 내부 줄 번호는 다를 수 있지만 학습자 코드 기준 결과는 같아야 한다
        for key in ("stdout", "error", "missing", "charts", "farm"):
            assert json.dumps(a.get(key), sort_keys=True, ensure_ascii=False) == \
                json.dumps(b.get(key), sort_keys=True, ensure_ascii=False), (code, key)
