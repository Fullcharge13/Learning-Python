"""경비실 판정 엔진(guard.py + run(guard=), 설계서 2026-11-12 경비실 §2)."""
from runner import run

T = lambda *pairs: [{"value": v, "expect": e} for v, e in pairs]  # noqa: E731


def G(mode, tries, **kw):
    g = {"mode": mode, "tries": tries}
    g.update(kw)
    return g


def verdicts(r):
    return [e["verdict"] for e in r["guard"]["events"]]


def err_type(r):
    return (r["error"] or {}).get("type")


G1 = 'if attempt == password:\n    allow()\nelse:\n    block()\n'
G2 = 'if attempt >= 9 and attempt < 18:\n    allow()\nelse:\n    block()\n'
G3 = ('def check(attempt):\n    if attempt == "0000" or attempt == "1234" or attempt == "1111":\n'
      '        return False\n    return True\n')
G5 = ('count = 0\nwhile has_try():\n    next_try()\n    if count < 5:\n        allow()\n'
      '        count = count + 1\n    else:\n        block()\n')


def test_script_basic():
    r = run(G1, guard=G("script", T(("sunflower77", "allow"), ("123456", "block")), password="sunflower77"))
    assert r["error"] is None
    g = r["guard"]
    assert g["solved"] is True
    assert verdicts(r) == ["allow", "block"]
    assert g["stats"] == {"attacks_blocked": 1, "attacks_total": 1, "guests_allowed": 1, "guests_total": 1}
    assert g["stopped"] is None


def test_script_none_is_allow():
    r = run("pass\n", guard=G("script", T(("x", "block"))))
    e = r["guard"]["events"][0]
    assert e["verdict"] == "none"
    assert e["ok"] is False
    assert r["guard"]["solved"] is False


def test_script_fresh_namespace():
    code = 'n = globals().get("n", 0) + 1\nif n > 1:\n    block()\nelse:\n    allow()\n'
    r = run(code, guard=G("script", T(("a", "allow"), ("b", "allow"))))
    assert verdicts(r) == ["allow", "allow"]


def test_twice_ignored():
    r = run("block()\nallow()\n", guard=G("script", T(("a", "block"))))
    e = r["guard"]["events"][0]
    assert e["verdict"] == "block"
    assert e["twice"] is True


def test_loop_reads_all():
    tries = T(*[("주문 %d" % k, "allow" if k <= 5 else "block") for k in range(1, 11)])
    r = run(G5, guard=G("loop", tries))
    assert r["error"] is None
    assert r["guard"]["solved"] is True


def test_loop_leftover_is_none():
    r = run("next_try()\nblock()\n", guard=G("loop", T(("a", "block"), ("b", "block"), ("c", "allow"))))
    assert r["error"] is None
    assert verdicts(r) == ["block", "none", "none"]


def test_loop_no_more_tries():
    r = run("while True:\n    next_try()\n    block()\n", guard=G("loop", T(("a", "block"), ("b", "block"))))
    assert err_type(r) == "GuardUsageError"
    assert len(r["guard"]["events"]) == 2
    assert r["guard"]["stopped"] == "error"
    assert r["guard"]["solved"] is False


def test_swallowed_usage_error_reported():
    code = "while True:\n    try:\n        next_try()\n    except:\n        break\n    block()\n"
    r = run(code, guard=G("loop", T(("a", "block"), ("b", "block"))))
    assert err_type(r) == "GuardUsageError"


def test_swallow_forever_ends():
    # Review Focus 2 그대로: 삼키고 계속 돌아도 시간 초과가 아니라 첫 사용 오류(그 줄)로 끝남
    code = "while True:\n    try:\n        next_try()\n    except:\n        pass\n"
    r = run(code, guard=G("loop", T(("a", "block"))))
    assert err_type(r) == "GuardUsageError"
    assert r["error"]["line"] == 3


def test_func_bool():
    tries = T(("4821", "allow"), ("0000", "block"), ("1234", "block"), ("7305", "allow"),
              ("1111", "block"), ("9064", "allow"))
    r = run(G3, guard=G("func", tries))
    assert r["error"] is None
    assert r["guard"]["solved"] is True


def test_func_non_bool():
    r = run('def check(attempt):\n    return "yes"\n', guard=G("func", T(("a", "allow"))))
    assert err_type(r) == "GuardAnswerError"
    assert r["error"]["line"] is not None


def test_check_not_callable():
    r = run("check = 3\n", guard=G("func", T(("a", "allow"))))
    assert err_type(r) == "GuardUsageError"


def test_check_missing():
    r = run("", guard=G("func", T(("a", "allow"))))
    assert err_type(r) == "GuardUsageError"


def test_check_wrong_arity():
    r = run("def check():\n    return True\n", guard=G("func", T(("a", "allow"))))
    assert err_type(r) == "TypeError"
    assert r["error"]["line"] == 1


def test_block_shadowed():
    r = run("block = None\nblock()\n", guard=G("script", T(("a", "block"))))
    assert err_type(r) == "TypeError"
    assert r["error"]["line"] == 2


def test_func_forbids_commands():
    r = run("def check(attempt):\n    block()\n    return False\n", guard=G("func", T(("a", "block"))))
    assert err_type(r) == "GuardUsageError"


def test_error_stops_and_keeps_events():
    code = 'if attempt == "b":\n    1/0\nblock()\n'
    r = run(code, guard=G("script", T(("a", "block"), ("b", "block"), ("c", "block"))))
    assert len(r["guard"]["events"]) == 1
    assert err_type(r) == "ZeroDivisionError"


def test_limit_20():
    r = run("block()\n", guard=G("script", T(*[("x%d" % k, "block") for k in range(25)])))
    assert len(r["guard"]["events"]) == 20


def test_int_attempt_stays_int():
    r = run(G2, guard=G("script", T((9, "allow"), (18, "block"))))
    assert r["error"] is None
    assert r["guard"]["solved"] is True


def test_deterministic():
    g = G("script", T(("sunflower77", "allow"), ("123456", "block"), ("x", "allow")), password="sunflower77")
    assert run(G1, guard=g)["guard"] == run(G1, guard=g)["guard"]


def test_lang_en_message():
    en = run("next_try()\n", guard=G("loop", []), lang="en")
    assert "no more tries" in en["error"]["msg"].lower()
    ko = run("next_try()\n", guard=G("loop", []))
    assert "더 이상 시도가 없어요" in ko["error"]["msg"]


def test_farm_untouched():
    assert "guard" not in run("print(1)")


def test_guard_survives_sys_tampering():
    """앞 실행이 sys._getframe·settrace를 망가뜨려도, 삼킨 사용 오류가 다음 실행에서 끝난다(3초 시간 초과 아님)."""
    import sys
    saved = {k: getattr(sys, k) for k in ("_getframe", "settrace")}
    try:
        run("import sys\nsys._getframe = None\nsys.settrace = print\n")
        code = "while True:\n    try:\n        next_try()\n    except:\n        pass\n"
        r = run(code, guard=G("loop", T(("a", "block"))))
        assert err_type(r) == "GuardUsageError", r["error"]
        assert r["error"]["line"] == 3, r["error"]
    finally:
        for k, v in saved.items():
            setattr(sys, k, v)
