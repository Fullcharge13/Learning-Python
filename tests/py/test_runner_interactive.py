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
