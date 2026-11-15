"""v0.21.0 주고받기 실행(interactive)과 채점용 정해 둔 무작위(rand·seed)."""

import random

from runner import run

TWO = 'a = input("첫 번째: ")\nprint("A", a)\nb = input("두 번째: ")\nprint("B", b)\n'


def test_interactive_needs_input():
    r = run(TWO, ["x"], [], interactive=True)
    assert r["error"] is None
    assert r["need_input"] == {"prompt": "두 번째: "}
    assert "A x" in r["stdout"]
    assert "B" not in r["stdout"]
    assert "두 번째" not in r["stdout"]


def test_interactive_false_keeps_error():
    r = run(TWO, ["x"], [])
    assert r["error"]["type"] == "InputMissing"
    assert "need_input" not in r


def test_interactive_done_has_no_need_input():
    r = run(TWO, ["x", "y"], [], interactive=True)
    assert r["error"] is None
    assert "need_input" not in r
    assert "B y" in r["stdout"]


def test_interactive_swallowed_still_needs_input():
    code = 'try:\n    a = input("값: ")\nexcept BaseException:\n    print("삼킴")\n'
    r = run(code, [], [], interactive=True)
    assert r["need_input"] == {"prompt": "값: "}
    assert r["error"] is None


def test_rand_sequence():
    code = "import random\nprint(random.randint(1, 6))\nprint(random.randint(1, 6))\n"
    r = run(code, "", [], rand=[3, 1])
    assert r["error"] is None
    assert r["stdout"].split() == ["3", "1"]


def test_rand_from_import():
    code = "from random import randint\nprint(randint(1, 6))\n"
    assert run(code, "", [], rand=[5])["stdout"].split() == ["5"]


def test_rand_choice_in_seq():
    code = 'import random\nprint(random.choice(["가위", "바위", "보"]))\n'
    r = run(code, "", [], rand=["바위"])
    assert r["error"] is None
    assert r["stdout"].strip() == "바위"


def test_rand_choice_not_in_seq():
    code = 'import random\nprint(random.choice(["가위", "바위", "보"]))\n'
    r = run(code, "", [], rand=["주먹"])
    assert r["error"]["type"] == "RandMismatch"


def test_rand_choice_needs_real_sequence():
    """작업 4: 진짜 random.choice는 순서 있는 것(목록·글자)에서만 고른다. 사전·keys()를 그대로 주면
    진짜 실행(완성작)에서 KeyError·TypeError가 나므로, 정해 둔 rand로 채점할 때도 같은 오류여야 한다."""
    head = 'import random\nd = {"a": 1, "b": 2}\n'
    for expr, err in (("d", "KeyError"), ("d.keys()", "TypeError"), ("d.values()", "TypeError"),
                      ("[]", "IndexError"), ("5", "TypeError")):
        r = run(head + "print(random.choice(%s))\n" % expr, "", [], rand=["b"])
        assert r["error"] is not None and r["error"]["type"] == err, (expr, r["error"])


def test_rand_choice_list_of_dict_ok():
    code = 'import random\nd = {"a": 1, "b": 2}\nprint(random.choice(list(d)))\nprint(random.choice("xy"))\n'
    r = run(code, "", [], rand=["b", "y"])
    assert r["error"] is None
    assert r["stdout"].split() == ["b", "y"]


def test_rand_mismatch_messages_name_the_call():
    """최종 검토 I1: 오류 카드(ERROR_VARIANTS 「randint」)가 고를 수 있게 randint 범위 실패 메시지에는 randint가, choice 실패에는 없다."""
    for code, rand in (("import random\nrandom.randint(1, 2)\n", [3]),
                       ("import random\nrandom.randint(1, 2)\n", [[2, 1, 3]])):
        r = run(code, "", [], rand=rand)
        assert r["error"]["type"] == "RandMismatch" and "randint" in r["error"]["msg"], r["error"]
    r = run("import random\nrandom.choice(['a'])\n", "", [], rand=["b"])
    assert r["error"]["type"] == "RandMismatch" and "randint" not in r["error"]["msg"], r["error"]


def test_rand_randint_out_of_range():
    """작업 3 검토 I1: 정해 준 값이 randint(a, b) 범위 밖이면 RandMismatch(범위를 잘못 쓴 코드를 채점이 걸러냄)."""
    for code, val in (("import random\nprint(random.randint(1, 2))\n", 3),
                      ("import random\nprint(random.randint(1, 3))\n", 7),
                      ("import random\nprint(random.randint(1, 3))\n", 0)):
        r = run(code, "", [], rand=[val])
        assert r["error"] is not None and r["error"]["type"] == "RandMismatch", (code, val, r["error"])
        assert r["error"]["line"] == 2


def test_rand_randint_edges_ok():
    for val in (1, 3):
        r = run("import random\nprint(random.randint(1, 3))\n", "", [], rand=[val])
        assert r["error"] is None
        assert r["stdout"].strip() == str(val)


def test_rand_randint_non_int_value():
    r = run("import random\nprint(random.randint(1, 3))\n", "", [], rand=["2"])
    assert r["error"]["type"] == "RandMismatch"


def test_rand_randint_mismatch_swallowed_still_reported():
    code = "import random\ntry:\n    random.randint(1, 2)\nexcept BaseException:\n    pass\nprint('ok')\n"
    r = run(code, "", [], rand=[3])
    assert r["error"]["type"] == "RandMismatch"


def test_rand_missing():
    code = "import random\nrandom.randint(1, 6)\nrandom.randint(1, 6)\n"
    r = run(code, "", [], rand=[2])
    assert r["error"]["type"] == "RandMissing"
    assert r["error"]["line"] == 3


def test_rand_restored_after_run():
    real_randint, real_choice = random.randint, random.choice
    run("import random\nrandom.randint(1, 6)\n", "", [], rand=[2])
    assert random.randint is real_randint
    assert random.choice is real_choice
    # 오류로 끝나도 되돌린다
    run("import random\nrandom.randint(1, 6)\nrandom.randint(1, 6)\n", "", [], rand=[2])
    assert random.randint is real_randint
    assert random.choice is real_choice
    # 다음 실행은 진짜 무작위(rand 없음)
    r = run("import random\nprint(random.randint(1, 1))\n", "", [])
    assert r["stdout"].strip() == "1"


def test_rand_none_is_real_random():
    r = run("import random\nprint(random.randint(5, 5))\n", "", [])
    assert r["stdout"].strip() == "5"


def test_seed_repeatable():
    code = "import random\nprint([random.randint(1, 1000) for _ in range(5)])\n"
    a = run(code, "", [], seed=7)["stdout"]
    b = run(code, "", [], seed=7)["stdout"]
    c = run(code, "", [], seed=8)["stdout"]
    assert a == b
    assert a != c



def test_seed_does_not_leak_into_next_run():
    """최종 검토 M4: 시드를 준 실행(주고받기)이 끝나면 전역 random 상태를 되돌린다 → 다음 보통 실행은 그 시드로 정해지지 않는다."""
    import random as _r
    code = "import random\nprint([random.randint(1, 10**9) for _ in range(5)])\n"
    before = _r.getstate()
    run(code, "", [], seed=7)
    assert _r.getstate() == before
    # 시드가 남았다면 다음 실행은 seed 7의 6~10번째 값과 같다
    leak = _r.Random(7)
    [leak.randint(1, 10**9) for _ in range(5)]
    leaked = str([leak.randint(1, 10**9) for _ in range(5)])
    run(code, "", [], seed=7)
    after = run(code, "", [])["stdout"].strip()
    assert after != leaked

def test_rand_missing_swallowed_by_except_exception():
    code = "import random\ntry:\n    n = random.randint(1, 3)\n    m = random.randint(1, 3)\nexcept Exception:\n    pass\n"
    r = run(code, "", [], rand=[2])
    assert r["error"]["type"] == "RandMissing"
    assert r["error"]["line"] == 4


def test_rand_mismatch_swallowed_by_bare_except():
    code = 'import random\ntry:\n    random.choice(["a", "b"])\nexcept:\n    pass\n'
    r = run(code, "", [], rand=["z"])
    assert r["error"]["type"] == "RandMismatch"
    assert r["error"]["line"] == 3


def test_rand_swallowed_keeps_first_failure():
    code = "import random\ntry:\n    random.randint(1, 3)\nexcept BaseException:\n    pass\nrandom.randint(1, 3)\n"
    r = run(code, "", [], rand=[])
    assert r["error"]["type"] == "RandMissing"
    assert r["error"]["line"] == 3


def test_learner_monkeypatch_does_not_leak():
    real_randint, real_choice = random.randint, random.choice
    run("import random\nrandom.randint = lambda a, b: 99\nrandom.choice = lambda s: 99\n", "", [])
    assert random.randint is real_randint and random.choice is real_choice
    r = run("import random\nprint(random.randint(1, 1))\n", "", [])
    assert r["stdout"].strip() == "1"
    # rand 실행 중 바꿔도 끝나면 진짜로
    run("import random\nrandom.randint = lambda a, b: 99\n", "", [], rand=[1])
    assert random.randint is real_randint and random.choice is real_choice


def test_need_input_clears_stderr():
    code = 'try:\n    a = input("값: ")\nexcept BaseException:\n    pass\nraise ValueError("죽음")\n'
    r = run(code, [], [], interactive=True)
    assert r["need_input"] == {"prompt": "값: "}
    assert r["error"] is None
    assert r["stderr"] == ""


def test_rand_randint_exact_call():
    """작업 4 검토 I1: rand 값 [v, a, b]는 「randint(a, b)를 불렀고 v를 돌려줌」. 범위가 넓은 코드(randint(1, 100))도
    다른 범위로 부른 것이라 RandMismatch. 값만 주면 범위가 좁은 것만 걸러지고 넓은 것은 못 거른다."""
    ok = run("import random\nprint(random.randint(1, 50))\n", "", [], rand=[[37, 1, 50]])
    assert ok["error"] is None and ok["stdout"].strip() == "37"
    for code in ("import random\nprint(random.randint(1, 100))\n", "import random\nprint(random.randint(0, 50))\n",
                 "import random\nprint(random.randint(1, 51))\n", "import random\nprint(random.randint(2, 50))\n"):
        r = run(code, "", [], rand=[[37, 1, 50]])
        assert r["error"] is not None and r["error"]["type"] == "RandMismatch", (code, r["error"])


def test_rand_randint_exact_bad_shape():
    code = "import random\nprint(random.randint(1, 50))\n"
    for val in ([37, 1], [37, 1, 50, 9], [True, 1, 50], [51, 1, 50], ["37", 1, 50]):
        r = run(code, "", [], rand=[val])
        assert r["error"] is not None and r["error"]["type"] == "RandMismatch", (val, r["error"])


def test_rand_choice_exact_form_rejected():
    r = run('import random\nprint(random.choice([1, 2]))\n', "", [], rand=[[1, 1, 2]])
    assert r["error"]["type"] == "RandMismatch"
