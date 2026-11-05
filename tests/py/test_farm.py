"""「파이의 텃밭」 farm 엔진 시험 (v0.10 작업 1, 설계서 §2).

run(code, ..., farm=<상태>)는 실행마다 새 farm 모듈을 만들고, 명령마다 상태를 바꾸며 사건(events)을 남긴다.
"""

import copy
import json
import sys

from runner import run

DIR_MSG = "방향은 위·아래·왼쪽·오른쪽 중 하나예요"
CROP_MSG = "작물은 당근·감자·토마토 중 하나예요"


def farm(size=3, cells=None, x=0, y=0, clock=0, store=None, upgrades=None, seeds=5):
    return {
        "size": size,
        "cells": cells if cells is not None else [None] * (size * size),
        "pie": {"x": x, "y": y},
        "clock": clock,
        "store": store if store is not None else {"당근": 0, "감자": 0, "토마토": 0},
        "upgrades": upgrades if upgrades is not None else [],
        "seeds": seeds,
    }


def frun(code, state=None):
    return run(code, "", [], farm=state if state is not None else farm())


def kinds(r):
    return [e["t"] for e in r["farm"]["events"]]


# ------------------------------------------------------------ 모양·기존 동작


def test_no_farm_key_without_farm():
    r = run("print(1)", "", [])
    assert "farm" not in r
    assert r == run("print(1)", "", [], farm=None)
    r2 = run("import farm\n", "", [])
    assert r2["error"]["type"] == "ModuleNotFoundError"
    r3 = run("move('오른쪽')\n", "", [])
    assert r3["error"]["type"] == "NameError"


def test_result_shape():
    r = frun('move("오른쪽")\n')
    assert r["error"] is None
    f = r["farm"]
    assert set(f) == {"events", "state", "stopped", "actions"}
    assert set(f["state"]) == {"size", "cells", "pie", "clock", "store", "upgrades", "seeds"}
    assert f["stopped"] is None and f["actions"] == 1
    assert f["events"] == [{"t": "move", "line": 1, "dir": "오른쪽", "x": 1, "y": 0}]
    json.dumps(r, allow_nan=False)


def test_input_state_not_mutated():
    s = farm(cells=[{"crop": "당근", "planted_at": 0}] + [None] * 8, clock=20)
    before = copy.deepcopy(s)
    r = frun('harvest()\nmove("아래")\nplant("당근")\n', s)
    assert s == before
    assert r["farm"]["state"]["store"]["당근"] == 1


def test_module_removed_after_run():
    frun("import farm\nfarm.zz = 1\n")
    assert "farm" not in sys.modules
    r = frun("import farm\nprint(hasattr(farm, 'zz'))\n")
    assert r["stdout"] == "False\n"
    assert "farm" not in sys.modules


def test_import_styles():
    r = frun('from farm import *\nmove("오른쪽")\n'
             'import farm\nfarm.move("아래")\n'
             'from farm import harvest as h\nh()\n'
             'print(what_here(), can_harvest())\n')
    assert r["error"] is None, r
    assert kinds(r) == ["move", "move", "harvest_empty", "say"]
    assert r["stdout"] == "빈칸 False\n"


def test_syntax_error_keeps_state():
    s = farm(clock=7)
    r = frun("move(\n", s)
    assert r["error"]["type"] == "SyntaxError"
    assert r["farm"] == {"events": [], "state": s, "stopped": None, "actions": 0}


# ------------------------------------------------------------ 이동


def test_move_and_wrap_both_axes():
    r = frun('move("왼쪽")\nmove("위")\nmove("오른쪽")\nmove("아래")\nmove("아래")\n')
    assert r["error"] is None
    ev = r["farm"]["events"]
    assert [(e["dir"], e["x"], e["y"], e["line"]) for e in ev] == [
        ("왼쪽", 2, 0, 1), ("위", 2, 2, 2), ("오른쪽", 0, 2, 3), ("아래", 0, 0, 4), ("아래", 0, 1, 5)]
    st = r["farm"]["state"]
    assert st["pie"] == {"x": 0, "y": 1}
    assert st["clock"] == 5 and r["farm"]["actions"] == 5


def test_move_wrap_on_bigger_grid():
    r = frun('for i in range(5):\n    move("오른쪽")\n', farm(size=4, x=3, y=3))
    assert r["farm"]["state"]["pie"] == {"x": 0, "y": 3}  # 3 → 0 1 2 3 0


# ------------------------------------------------------------ 심기·수확


def test_plant_then_harvest_ripe():
    s = farm(cells=[{"crop": "당근", "planted_at": 0}] + [None] * 8, clock=8)
    r = frun("print(can_harvest(), what_here())\nharvest()\nprint(what_here())\n", s)
    assert r["error"] is None
    assert r["stdout"] == "True 당근\n빈칸\n"
    st = r["farm"]["state"]
    assert st["store"] == {"당근": 1, "감자": 0, "토마토": 0}
    assert st["cells"][0] is None
    assert st["clock"] == 9
    assert r["farm"]["events"][1] == {"t": "harvest", "line": 2, "crop": "당근", "x": 0, "y": 0}


def test_harvest_unripe_loses_crop():
    s = farm(cells=[None, {"crop": "당근", "planted_at": 5}] + [None] * 7, x=1, clock=12)
    r = frun("harvest()\n", s)
    st = r["farm"]["state"]
    assert st["cells"][1] is None
    assert st["store"] == {"당근": 0, "감자": 0, "토마토": 0}
    assert r["farm"]["events"] == [{"t": "harvest_young", "line": 1, "crop": "당근", "x": 1, "y": 0}]
    assert st["clock"] == 13


def test_harvest_empty_costs_time():
    r = frun("harvest()\n")
    assert r["farm"]["events"] == [{"t": "harvest_empty", "line": 1, "x": 0, "y": 0}]
    assert r["farm"]["state"]["clock"] == 1 and r["farm"]["actions"] == 1


def test_plant_records_planted_at_and_index():
    r = frun('move("아래")\nmove("오른쪽")\nmove("오른쪽")\nplant("당근")\n', farm(clock=3))
    st = r["farm"]["state"]
    assert st["cells"][1 * 3 + 2] == {"crop": "당근", "planted_at": 6}
    assert st["clock"] == 7
    assert r["farm"]["events"][-1] == {"t": "plant", "line": 4, "crop": "당근", "x": 2, "y": 1}


def test_plant_occupied_fails_but_costs_time():
    s = farm(cells=[{"crop": "당근", "planted_at": 0}] + [None] * 8, clock=2)
    r = frun('plant("당근")\n', s)
    assert r["error"] is None
    assert r["farm"]["events"] == [{"t": "plant_fail", "line": 1, "reason": "occupied", "crop": "당근",
                                    "x": 0, "y": 0}]
    assert r["farm"]["state"]["cells"][0] == {"crop": "당근", "planted_at": 0}
    assert r["farm"]["state"]["clock"] == 3


def test_potato_locked_without_seed():
    r = frun('plant("감자")\nprint(what_here())\n')
    assert r["error"] is None
    assert r["farm"]["events"][0] == {"t": "plant_fail", "line": 1, "reason": "no_seed", "crop": "감자",
                                      "x": 0, "y": 0}
    assert r["farm"]["state"]["cells"][0] is None
    assert r["farm"]["state"]["clock"] == 1
    assert r["stdout"] == "빈칸\n"
    ok = frun('plant("감자")\nprint(what_here())\n', farm(upgrades=["감자 씨앗"]))
    assert ok["farm"]["events"][0]["t"] == "plant"
    assert ok["farm"]["state"]["cells"][0] == {"crop": "감자", "planted_at": 0}
    assert ok["stdout"] == "감자\n"


# ------------------------------------------------------------ 자라는 시간


def _ripe_after(crop, waits, upgrades=()):
    """1×1 밭: 심고 waits번 움직인 뒤(제자리로 감싸짐) 다 자랐나."""
    code = 'plant("%s")\nfor i in range(%d):\n    move("오른쪽")\nprint(can_harvest())\n' % (crop, waits)
    r = frun(code, farm(size=1, upgrades=["감자 씨앗"] + list(upgrades)))
    assert r["error"] is None, r
    return r["stdout"] == "True\n"


def test_growth_times():
    # 심기도 시간 1: 심은 뒤 (자라는 시간 − 1)번 더 움직이면 다 자람
    assert not _ripe_after("당근", 6) and _ripe_after("당근", 7)
    assert not _ripe_after("감자", 10) and _ripe_after("감자", 11)


def test_growth_times_with_fertilizer():
    assert not _ripe_after("당근", 4, ["비료"]) and _ripe_after("당근", 5, ["비료"])
    assert not _ripe_after("감자", 7, ["비료"]) and _ripe_after("감자", 8, ["비료"])


def test_queries_take_no_time():
    r = frun("for i in range(50):\n    can_harvest()\n    what_here()\n")
    assert r["farm"]["state"]["clock"] == 0 and r["farm"]["actions"] == 0
    assert r["farm"]["events"] == []


def test_clock_persists_across_runs():
    r1 = frun('plant("당근")\nmove("오른쪽")\nmove("왼쪽")\n')
    st = r1["farm"]["state"]
    assert st["clock"] == 3
    r2 = frun('for i in range(3):\n    move("위")\nplant("당근")\nprint(can_harvest())\n', st)
    assert r2["stdout"] == "False\n"       # 제자리로 돌아옴, 차 있는 칸 심기도 시간 1 → 7 < 8
    st2 = r2["farm"]["state"]
    assert st2["clock"] == 7 and st2["pie"] == {"x": 0, "y": 0}
    r3 = frun('plant("당근")\nprint(can_harvest())\nharvest()\n', st2)
    assert r3["stdout"] == "True\n"        # 8
    assert r3["farm"]["state"]["store"]["당근"] == 1
    assert r3["farm"]["state"]["clock"] == 9
    assert r3["farm"]["actions"] == 2       # 행동 수는 실행마다 새로 셈


# ------------------------------------------------------------ 잘못된 값


def test_bad_direction_value_error():
    r = frun('move("오른쪽")\nmove("앞")\nmove("오른쪽")\n')
    assert r["error"] == {"type": "ValueError", "line": 2, "msg": DIR_MSG}
    assert r["farm"]["state"]["pie"] == {"x": 1, "y": 0}     # 오류 직전까지
    assert kinds(r) == ["move"]
    assert r["farm"]["stopped"] is None
    assert "ValueError" in r["stderr"]


def test_bad_crop_value_error():
    r = frun('x = 1\nplant("수박")\n')
    assert r["error"] == {"type": "ValueError", "line": 2, "msg": CROP_MSG}
    assert r["farm"]["state"]["clock"] == 0
    r2 = frun("move(3)\n")
    assert r2["error"]["msg"] == DIR_MSG
    r3 = frun("plant([])\n")
    assert r3["error"]["msg"] == CROP_MSG


def test_value_error_catchable():
    r = frun('try:\n    move("앞")\nexcept ValueError as e:\n    print(e)\n')
    assert r["error"] is None
    assert r["stdout"] == DIR_MSG + "\n"


def test_error_line_inside_function():
    r = frun('def go():\n    move("오른쪽")\n    move("뒤")\n\ngo()\n')
    assert r["error"]["line"] == 3
    assert r["farm"]["events"][0]["line"] == 2


# ------------------------------------------------------------ 500번 지침


def test_tired_after_500_actions():
    r = frun('while True:\n    move("오른쪽")\n', farm(clock=4))
    assert r["error"] is None, r
    assert r["stderr"] == ""
    f = r["farm"]
    assert f["stopped"] == "tired"
    assert f["actions"] == 500
    assert f["state"]["clock"] == 504
    assert len(f["events"]) == 500
    assert f["state"]["pie"] == {"x": 500 % 3, "y": 0}


def test_exactly_500_is_not_tired():
    r = frun('for i in range(500):\n    move("오른쪽")\n')
    assert r["farm"]["stopped"] is None and r["farm"]["actions"] == 500


def test_tired_counts_all_timed_actions():
    r = frun('while True:\n    plant("감자")\n    harvest()\n')
    assert r["farm"]["stopped"] == "tired" and r["farm"]["actions"] == 500
    assert r["error"] is None


def test_tired_not_swallowed_by_outer_except():
    code = ('try:\n    while True:\n        move("오른쪽")\nexcept BaseException:\n    print("잡았다")\n'
            'move("위")\nprint("끝")\n')
    r = frun(code)
    assert r["error"] is None, r
    assert r["farm"]["stopped"] == "tired" and r["farm"]["actions"] == 500
    assert r["stdout"] == ""
    assert r["farm"]["state"]["pie"]["y"] == 0


def test_tired_not_swallowed_inside_loop():
    for handler in ("except BaseException:\n        pass\n", "except:\n        continue\n"):
        code = 'while True:\n    try:\n        move("오른쪽")\n    ' + handler
        r = frun(code)
        assert r["error"] is None, (handler, r)
        assert r["farm"]["stopped"] == "tired" and r["farm"]["actions"] == 500


def test_tired_not_caught_by_except_exception():
    r = frun('try:\n    while True:\n        harvest()\nexcept Exception:\n    print("x")\n')
    assert r["farm"]["stopped"] == "tired" and r["stdout"] == "" and r["error"] is None


def test_runner_usable_after_tired():
    before = sys.gettrace()
    frun('while True:\n    move("오른쪽")\n')
    assert sys.gettrace() is before        # 지침 뒤 켠 추적 함수를 되돌림
    r = run("x = 0\nfor i in range(3):\n    x += i\nprint(x)\n", "", [])
    assert r["stdout"] == "3\n" and r["error"] is None
    r2 = frun('move("오른쪽")\n')
    assert r2["farm"]["stopped"] is None and r2["farm"]["actions"] == 1


# ------------------------------------------------------------ 기다림 지침(판정 C60: 확인 2000번)


def test_busy_wait_stops_waited():
    import time
    s = farm(cells=[{"crop": "당근", "planted_at": 0}] + [None] * 8, clock=1)
    t0 = time.perf_counter()
    r = frun("while not can_harvest():\n    pass\nharvest()\n", s)
    assert time.perf_counter() - t0 < 1.0
    assert r["error"] is None, r
    assert r["stderr"] == ""
    f = r["farm"]
    assert f["stopped"] == "waited"
    assert f["actions"] == 0 and f["events"] == []
    assert f["state"]["cells"][0] == {"crop": "당근", "planted_at": 0}   # harvest()까지 가지 않음
    assert f["state"]["clock"] == 1


def test_what_here_counts_as_check():
    r = frun('while what_here() == "빈칸":\n    pass\n')
    assert r["farm"]["stopped"] == "waited" and r["error"] is None


def test_exactly_2000_checks_not_stopped():
    r = frun("for i in range(1000):\n    can_harvest()\n    what_here()\nprint('끝')\n")
    assert r["farm"]["stopped"] is None and r["stdout"] == "끝\n"
    r2 = frun("for i in range(2001):\n    can_harvest()\nprint('끝')\n")
    assert r2["farm"]["stopped"] == "waited" and r2["stdout"] == ""


def test_checks_counted_per_run():
    code = "for i in range(1500):\n    what_here()\n"
    r1 = frun(code)
    assert r1["farm"]["stopped"] is None
    r2 = frun(code, r1["farm"]["state"])
    assert r2["farm"]["stopped"] is None


def test_waited_not_swallowed():
    code = ('try:\n    while True:\n        can_harvest()\nexcept BaseException:\n    print("잡았다")\n'
            'move("위")\n')
    r = frun(code)
    assert r["error"] is None and r["farm"]["stopped"] == "waited"
    assert r["stdout"] == "" and r["farm"]["actions"] == 0


def test_normal_harvest_loop_with_checks_unaffected():
    # 9칸을 돌며 확인하고 거두는 보통 프로그램(확인 수백 번)은 멈추지 않는다
    code = ('for i in range(40):\n    if can_harvest():\n        harvest()\n'
            '    if what_here() == "빈칸":\n        plant("당근")\n    move("오른쪽")\n')
    r = frun(code, farm(cells=[{"crop": "당근", "planted_at": 0}] * 9, clock=10))
    assert r["error"] is None and r["farm"]["stopped"] is None
    assert r["farm"]["state"]["store"]["당근"] >= 9


# ------------------------------------------------------------ 말하기(print)


def test_print_records_say_and_stdout():
    r = frun('print("안녕", 3)\nprint("a", "b", sep="-", end="!")\nprint()\n')
    assert r["stdout"] == "안녕 3\na-b!\n"
    assert r["farm"]["events"] == [
        {"t": "say", "line": 1, "text": "안녕 3"},
        {"t": "say", "line": 2, "text": "a-b!"},
        {"t": "say", "line": 3, "text": ""},
    ]


def test_say_truncated_and_stderr_not_said():
    r = frun('print("가" * 50)\nimport sys\nprint("e", file=sys.stderr)\n')
    assert r["stdout"] == "가" * 50 + "\n"
    assert r["stderr"] == "e\n"
    assert r["farm"]["events"] == [{"t": "say", "line": 1, "text": "가" * 40}]


def test_print_output_limit_still_works():
    r = frun('while True:\n    print("x" * 1000)\n')
    assert r["error"]["type"] == "OutputLimit"
    assert len(r["stdout"]) == 100_000
    assert len(r["farm"]["events"]) <= 600


# ------------------------------------------------------------ 사건 줄 번호


def test_event_lines():
    code = ('def row():\n'
            '    for i in range(2):\n'
            '        move("오른쪽")\n'
            '\n'
            'row()\n'
            'print("다 했어")\n'
            'harvest()\n')
    r = frun(code)
    assert [(e["t"], e["line"]) for e in r["farm"]["events"]] == [
        ("move", 3), ("move", 3), ("say", 6), ("harvest_empty", 7)]


# ------------------------------------------------------------ 같은 코드 → 같은 결과, 격리


def test_deterministic():
    code = ('for i in range(30):\n    if can_harvest():\n        harvest()\n'
            '    elif what_here() == "빈칸":\n        plant("당근")\n    move("오른쪽")\n    move("아래")\n')
    s = farm(cells=[{"crop": "당근", "planted_at": 0}] * 9, clock=5)
    a = frun(code, s)
    b = frun(code, s)
    assert a == b
    assert a["error"] is None


def test_chart_and_farm_together():
    code = ('import chart\nmove("오른쪽")\nchart.bar(["당근"], [1])\nchart.show()\nprint("끝")\n')
    r = frun(code)
    assert r["error"] is None, r
    assert r["charts"] == [{"kind": "bar", "labels": ["당근"], "values": [1]}]
    assert kinds(r) == ["move", "say"]
    assert "chart" not in sys.modules and "farm" not in sys.modules


def test_survives_deleted_builtins():
    r = frun('import builtins\ndel builtins.isinstance\ndel builtins.len\ndel builtins.str\n'
             'move("오른쪽")\nplant("당근")\nharvest()\nprint("x")\n')
    assert r["error"] is None, r
    assert kinds(r) == ["move", "plant", "harvest_young", "say"]


def test_bad_input_state_normalized():
    r = frun('move("오른쪽")\n', {"size": 2, "cells": [None, {"crop": "수박", "planted_at": 0}, 5],
                                 "pie": {"x": 9, "y": -1}})
    assert r["error"] is None
    st = r["farm"]["state"]
    assert st["size"] == 2
    assert st["cells"] == [None, None, None, None]
    assert st["pie"] == {"x": 0, "y": 1}   # (9 % 2 = 1) → 오른쪽 → 0, (−1 % 2 = 1)
    assert st["store"] == {"당근": 0, "감자": 0, "토마토": 0}
    assert st["upgrades"] == [] and st["clock"] == 1


# ------------------------------------------------------------ 검토 C62(I1·I2) 고침


def test_say_events_capped_at_100_stdout_kept():
    # I2: 말풍선(say)은 100개까지만 남기고, 출력(stdout)은 그대로
    r = frun("for i in range(700):\n    print(i)\n")
    assert r["error"] is None
    assert len(r["farm"]["events"]) == 100
    assert all(e["t"] == "say" for e in r["farm"]["events"])
    assert r["stdout"].count("\n") == 700


def test_timed_events_never_dropped_by_says():
    # I2: 말하기가 아무리 많아도 시간 1짜리 사건은 모두 남아 재생 끝 상태 == 결과 상태
    code = ('for i in range(400):\n    print(i)\n    if i < 300:\n        move("오른쪽")\n'
            '        if i % 7 == 0:\n            plant("당근")\n')
    s = farm(size=4, clock=3)
    r = frun(code, s)
    assert r["error"] is None, r
    ev = r["farm"]["events"]
    moves = [e for e in ev if e["t"] == "move"]
    timed = [e for e in ev if e["t"] != "say"]
    assert len(moves) == 300
    assert len([e for e in ev if e["t"] == "say"]) == 100
    st = r["farm"]["state"]
    assert len(timed) == r["farm"]["actions"]
    assert st["clock"] == 3 + len(timed)
    assert st["pie"] == {"x": moves[-1]["x"], "y": moves[-1]["y"]}
    # 사건만으로 다시 만든 칸 == 결과 칸
    cells = [None] * 16
    t = 3
    for e in timed:
        if e["t"] == "plant":
            cells[e["y"] * 4 + e["x"]] = {"crop": e["crop"], "planted_at": t}
        t += 1
    assert cells == st["cells"]


def _tamper_code():
    # 실행 1: 모듈 전역(move.__globals__)과 닫힘(__closure__)으로 닿는 규칙 표를 모두 망가뜨림
    return (
        "g = move.__globals__\n"
        "for k in list(g):\n"
        "    v = g[k]\n"
        "    if isinstance(v, int) and not isinstance(v, bool) and k.startswith('FARM'):\n"
        "        g[k] = 1\n"
        "    elif isinstance(v, dict) and k.startswith('FARM'):\n"
        "        try:\n"
        "            for kk in list(v):\n"
        "                v[kk] = 0\n"
        "        except TypeError:\n"
        "            g[k] = {'당근': 0, '감자': 0, '토마토': 0}\n"
        "g['FARM_GROW'] = {'당근': 0, '감자': 0, '토마토': 0}\n"
        "g['FARM_DIRS'] = {'위': (5, 5)}\n"
        "g['_farm_copy'] = lambda st: {'size': 3, 'cells': [], 'pie': {}, 'clock': 0, 'store': {'당근': 999}, 'upgrades': []}\n"
        "seen = set()\n"
        "def poke(f):\n"
        "    if id(f) in seen or not hasattr(f, '__closure__'):\n"
        "        return\n"
        "    seen.add(id(f))\n"
        "    for c in f.__closure__ or ():\n"
        "        try:\n"
        "            v = c.cell_contents\n"
        "        except ValueError:\n"
        "            continue\n"
        "        if isinstance(v, dict) and '당근' in v and isinstance(v['당근'], int):\n"
        "            v['당근'] = 0\n"
        "            v['감자'] = 0\n"
        "        elif isinstance(v, int) and not isinstance(v, bool):\n"
        "            pass\n"
        "        elif callable(v):\n"
        "            poke(v)\n"
        "for f in (move, plant, harvest, can_harvest, what_here, print):\n"
        "    poke(f)\n"
    )


def test_rules_reset_after_tampering_run():
    # I1: 한 실행에서 규칙 표·상한·도구 함수를 바꿔도 다음 실행은 원래 규칙
    frun(_tamper_code())
    import runner as R
    assert dict(R.FARM_GROW) == {"당근": 8, "감자": 12, "토마토": 10}
    assert dict(R.FARM_GROW_FERTILIZED) == {"당근": 6, "감자": 9, "토마토": 7}
    assert R.FARM_ACTIONS_MAX == 500 and R.FARM_CHECKS_MAX == 2000
    # 자라는 시간 그대로(심고 6번 움직임 → 아직, 7번 → 다 자람)
    assert not _ripe_after("당근", 6) and _ripe_after("당근", 7)
    assert not _ripe_after("감자", 7, ["비료"]) and _ripe_after("감자", 8, ["비료"])
    # 방향·상한 그대로
    r = frun('while True:\n    move("오른쪽")\n')
    assert r["farm"]["stopped"] == "tired" and r["farm"]["actions"] == 500
    assert r["farm"]["state"]["pie"] == {"x": 500 % 3, "y": 0}
    r2 = frun('harvest()\n', farm(cells=[{"crop": "당근", "planted_at": 0}] + [None] * 8, clock=8))
    assert r2["farm"]["state"]["store"] == {"당근": 1, "감자": 0, "토마토": 0}
    assert r2["farm"]["events"] == [{"t": "harvest", "line": 1, "crop": "당근", "x": 0, "y": 0}]


def test_tampered_values_cleaned_for_json():
    # 결과 상태·사건에 nan·이상한 값이 들어가도 결과는 JSON(allow_nan=False)으로 바뀐다
    code = (
        "for c in harvest.__closure__:\n"
        "    v = c.cell_contents\n"
        "    if isinstance(v, dict) and 'store' in v:\n"
        "        v['store']['당근'] = float('nan')\n"
        "        v['store']['감자'] = object()\n"
        "        v['clock'] = float('inf')\n"
        "        v['pie']['x'] = 'a'\n"
        "        v['cells'][0] = {'crop': object(), 'planted_at': float('nan')}\n"
        "        v['cells'][1] = {'crop': '당근', 'planted_at': 2 ** 80}\n"
        "        v['upgrades'].append(object())\n"
        "    if isinstance(v, list):\n"
        "        v.append({'t': 'harvest', 'line': object(), 'crop': '당근', 'x': float('nan'), 'y': 0})\n"
        "        v.append(object())\n"
        "    if isinstance(v, dict) and 'actions' in v:\n"
        "        v['actions'] = float('nan')\n"
        "        v['stopped'] = object()\n"
    )
    r = frun(code, farm(cells=[{"crop": "당근", "planted_at": 0}] + [None] * 8, clock=8))
    f = r["farm"]
    json.dumps(f, allow_nan=False)
    st = f["state"]
    assert isinstance(st["clock"], int) and isinstance(st["store"]["당근"], int)
    assert all(c is None or (type(c["crop"]) is str and type(c["planted_at"]) is int) for c in st["cells"])
    assert all(type(u) is str for u in st["upgrades"])
    assert f["stopped"] in (None, "tired", "waited") and type(f["actions"]) is int
    assert all(type(e) is dict and type(e["t"]) is str for e in f["events"])


# ------------------------------------------------------------ v0.11: store()·where() (설계서 2026-11-05 6~9장 §1)


def test_store_and_where_values_after_actions():
    s = farm(cells=[{"crop": "당근", "planted_at": 0}] + [None] * 8, clock=20,
             store={"당근": 3, "감자": 2})
    r = frun('print(where(), store())\nharvest()\nmove("오른쪽")\nmove("아래")\n'
             'print(where(), store())\nx, y = where()\nprint(x + y, store()["당근"])\n', s)
    assert r["error"] is None, r
    assert r["stdout"] == ("(0, 0) {'당근': 3, '감자': 2, '토마토': 0}\n"
                           "(1, 1) {'당근': 4, '감자': 2, '토마토': 0}\n"
                           "2 4\n")


def test_where_is_tuple_and_store_is_plain_dict():
    r = frun('w = where()\ns = store()\nprint(type(w) is tuple, len(w), type(s) is dict, list(s))\n')
    assert r["stdout"] == "True 2 True ['당근', '감자', '토마토']\n", r


def test_store_and_where_take_no_time_no_events():
    r = frun('where()\nstore()\nprint(1)\n')
    f = r["farm"]
    assert f["actions"] == 0 and f["state"]["clock"] == 0
    assert [e["t"] for e in f["events"]] == ["say"]


def test_store_copy_isolated():
    s = farm(cells=[{"crop": "당근", "planted_at": 0}] + [None] * 8, clock=20)
    r = frun('a = store()\na["당근"] = 99\na["수박"] = 1\ndel a["감자"]\n'
             'print(store())\nharvest()\nprint(a, store())\n', s)
    assert r["error"] is None, r
    assert r["stdout"] == ("{'당근': 0, '감자': 0, '토마토': 0}\n"
                           "{'당근': 99, '토마토': 0, '수박': 1} {'당근': 1, '감자': 0, '토마토': 0}\n")
    assert r["farm"]["state"]["store"] == {"당근": 1, "감자": 0, "토마토": 0}


def test_store_key_error_for_unknown_crop():
    r = frun('print(store()["수박"])\n')
    assert r["error"]["type"] == "KeyError" and r["error"]["line"] == 1


def test_store_counts_as_check():
    r = frun('while store()["당근"] < 10:\n    pass\n')
    assert r["error"] is None and r["farm"]["stopped"] == "waited"


def test_where_counts_as_check():
    r = frun('while where() == (0, 0):\n    pass\n')
    assert r["error"] is None and r["farm"]["stopped"] == "waited"


def test_store_where_share_2000_check_cap():
    r = frun("for i in range(500):\n    store()\n    where()\n    can_harvest()\n    what_here()\nprint('끝')\n")
    assert r["farm"]["stopped"] is None and r["stdout"] == "끝\n"
    r2 = frun("for i in range(1000):\n    store()\n    where()\nwhere()\nprint('끝')\n")
    assert r2["farm"]["stopped"] == "waited" and r2["stdout"] == ""


def test_store_where_import_styles():
    r = frun('from farm import *\nprint(where(), store()["감자"])\n'
             'import farm\nfarm.move("왼쪽")\nprint(farm.where(), farm.store())\n'
             'from farm import where as w\nprint(w())\n')
    assert r["error"] is None, r
    assert r["stdout"] == "(0, 0) 0\n(2, 0) {'당근': 0, '감자': 0, '토마토': 0}\n(2, 0)\n"


def test_store_where_in_module_all():
    r = frun('import farm\nprint("store" in farm.__all__, "where" in farm.__all__)\n')
    assert r["stdout"] == "True True\n"


def test_store_where_deterministic():
    code = ('for i in range(12):\n    x, y = where()\n    if store()["당근"] < 3 and can_harvest():\n'
            '        harvest()\n    elif what_here() == "빈칸":\n        plant("당근")\n'
            '    if x < 2:\n        move("오른쪽")\n    else:\n        move("아래")\n'
            'print(where(), store())\n')
    s = farm(cells=[{"crop": "당근", "planted_at": 0}] * 9, clock=10)
    a = frun(code, s)
    b = frun(code, s)
    assert a == b and a["error"] is None, a


# ------------------------------------------------------------ v0.12: 토마토·씨앗 봉투·seeds() (설계서 2026-11-05 10~17장 §1)

TOMATO_EMPTY_MSG = "토마토 씨앗이 떨어졌어요"
NOTE_RO_MSG = "받은 쪽지는 읽기만 해요"
JOURNAL = "농장일지.txt"


def test_tomato_growth_times():
    assert not _ripe_after("토마토", 8) and _ripe_after("토마토", 9)
    assert not _ripe_after("토마토", 5, ["비료"]) and _ripe_after("토마토", 6, ["비료"])


def test_tomato_needs_no_upgrade_and_uses_seed():
    r = frun('plant("토마토")\nprint(what_here(), seeds())\n')
    assert r["error"] is None, r
    assert r["farm"]["events"][0] == {"t": "plant", "line": 1, "crop": "토마토", "x": 0, "y": 0}
    assert r["stdout"] == "토마토 4\n"
    assert r["farm"]["state"]["seeds"] == 4
    assert r["farm"]["state"]["cells"][0] == {"crop": "토마토", "planted_at": 0}


def test_seeds_default_5_and_clamped():
    assert frun("print(seeds())\n")["stdout"] == "5\n"
    s = farm()
    s.pop("seeds")
    assert frun("print(seeds())\n", s)["farm"]["state"]["seeds"] == 5
    assert frun("print(seeds())\n", farm(seeds=99))["stdout"] == "20\n"
    assert frun("print(seeds())\n", farm(seeds=-3))["farm"]["state"]["seeds"] == 0
    assert frun("print(seeds())\n", farm(seeds="많이"))["farm"]["state"]["seeds"] == 5


def test_tomato_harvest_gives_two_seeds_capped_at_20():
    ripe = {"crop": "토마토", "planted_at": 0}
    r = frun("harvest()\nprint(seeds(), store())\n", farm(cells=[ripe] + [None] * 8, clock=10, seeds=3))
    assert r["error"] is None, r
    assert r["stdout"] == "5 {'당근': 0, '감자': 0, '토마토': 1}\n"
    assert r["farm"]["events"][0] == {"t": "harvest", "line": 1, "crop": "토마토", "x": 0, "y": 0}
    r2 = frun("harvest()\n", farm(cells=[ripe] + [None] * 8, clock=10, seeds=19))
    assert r2["farm"]["state"]["seeds"] == 20
    # 덜 자란 토마토는 씨앗을 주지 않는다
    r3 = frun("harvest()\n", farm(cells=[ripe] + [None] * 8, clock=9, seeds=3))
    assert r3["farm"]["events"][0]["t"] == "harvest_young" and r3["farm"]["state"]["seeds"] == 3


def test_tomato_occupied_keeps_seed():
    r = frun('plant("토마토")\n', farm(cells=[{"crop": "당근", "planted_at": 0}] + [None] * 8))
    assert r["farm"]["events"][0]["reason"] == "occupied"
    assert r["farm"]["state"]["seeds"] == 5


def test_empty_seed_bag_event_then_value_error():
    r = frun('move("오른쪽")\nplant("토마토")\nprint("안 옴")\n', farm(seeds=0))
    assert r["error"] == {"type": "ValueError", "line": 2, "msg": TOMATO_EMPTY_MSG}, r
    f = r["farm"]
    assert f["events"][-1] == {"t": "plant_fail", "line": 2, "reason": "no_tomato_seed", "crop": "토마토",
                               "x": 1, "y": 0}
    assert f["state"]["clock"] == 2 and f["actions"] == 2   # 실패한 심기도 시간 1
    assert f["state"]["cells"][1] is None and f["state"]["seeds"] == 0
    assert r["stdout"] == ""


def test_empty_seed_bag_catchable_and_continues():
    code = ('for i in range(3):\n    try:\n        plant("토마토")\n    except ValueError as e:\n'
            '        print(e)\n        plant("당근")\n    move("오른쪽")\nprint(seeds())\n')
    r = frun(code, farm(seeds=1))
    assert r["error"] is None, r
    assert r["stdout"] == "토마토 씨앗이 떨어졌어요\n토마토 씨앗이 떨어졌어요\n0\n"
    assert [c and c["crop"] for c in r["farm"]["state"]["cells"][:3]] == ["토마토", "당근", "당근"]
    assert kinds(r).count("plant_fail") == 2


def test_seeds_counts_as_check_no_time_no_event():
    r = frun("seeds()\nseeds()\n")
    assert r["farm"]["actions"] == 0 and r["farm"]["events"] == [] and r["farm"]["state"]["clock"] == 0
    w = frun("while seeds() > 0:\n    pass\n")
    assert w["error"] is None and w["farm"]["stopped"] == "waited"
    r2 = frun("for i in range(1000):\n    seeds()\n    store()\nwhere()\n")
    assert r2["farm"]["stopped"] == "waited"


def test_seeds_import_styles_and_all():
    r = frun('import farm\nprint(farm.seeds(), "seeds" in farm.__all__)\nfrom farm import *\nprint(seeds())\n')
    assert r["error"] is None and r["stdout"] == "5 True\n5\n", r


def test_store_has_tomato_and_what_here():
    r = frun('print(list(store()), store()["토마토"])\n',
             farm(store={"당근": 1, "감자": 2, "토마토": 3}))
    assert r["stdout"] == "['당근', '감자', '토마토'] 3\n"
    s = farm()
    s["store"] = {"당근": 1}
    assert frun("print(store())\n", s)["farm"]["state"]["store"] == {"당근": 1, "감자": 0, "토마토": 0}


def test_crop_message_lists_tomato():
    r = frun('plant("수박")\n')
    assert r["error"]["msg"] == "작물은 당근·감자·토마토 중 하나예요"


def test_tomato_deterministic():
    code = ('for i in range(40):\n    if can_harvest():\n        harvest()\n    elif what_here() == "빈칸":\n'
            '        try:\n            plant("토마토")\n        except ValueError:\n            plant("당근")\n'
            '    move("오른쪽")\nprint(seeds(), store())\n')
    a = frun(code, farm(seeds=2))
    b = frun(code, farm(seeds=2))
    assert a == b and a["error"] is None, a


# ------------------------------------------------------------ v0.12: 쪽지함(받는 쪽지 읽기 전용·농장일지) (§2)


def nrun(code, files, state=None):
    return run(code, "", [], files=files, farm=state if state is not None else farm())


NOTES = {"주문서.txt": "당근 2\n감자 1\n", JOURNAL: "1일째\n"}


def test_note_read_and_split():
    code = ('with open("주문서.txt") as f:\n    for line in f:\n        crop, n = line.split()\n'
            '        for i in range(int(n)):\n            plant(crop)\n            move("오른쪽")\n')
    r = nrun(code, NOTES, farm(upgrades=["감자 씨앗"]))
    assert r["error"] is None, r
    assert [e["crop"] for e in r["farm"]["events"] if e["t"] == "plant"] == ["당근", "당근", "감자"]
    assert r["farm"]["files"] == {JOURNAL: "1일째\n"}


def test_files_key_only_with_files():
    assert "files" not in frun("print(1)\n")["farm"]
    r = nrun("print(1)\n", {"주문서.txt": "당근 1"})
    assert r["farm"]["files"] == {JOURNAL: ""}   # 일지가 없었고 만들지도 않음


def test_read_only_note_write_modes():
    for code in ('open("주문서.txt", "w")\n', 'open("주문서.txt", "a")\n', 'open("주문서.txt", mode="r+")\n',
                 'import io\nio.open("주문서.txt", "a", encoding="utf-8")\n',
                 'import pathlib\npathlib.Path("주문서.txt").write_text("x")\n',
                 'import os\nos.chdir(".")\nopen(os.path.abspath("주문서.txt"), "wb")\n'):
        r = nrun(code, NOTES)
        assert r["error"] is not None and r["error"]["type"] == "PermissionError", (code, r)
        assert r["error"]["msg"] == NOTE_RO_MSG, (code, r)
    ok = nrun('with open("주문서.txt", "r") as f:\n    print(f.read().split()[0])\n'
              'with open("주문서.txt", "rb") as f:\n    print(len(f.read()) > 0)\n', NOTES)
    assert ok["error"] is None and ok["stdout"] == "당근\nTrue\n", ok


def test_read_only_note_permission_error_catchable():
    r = nrun('try:\n    open("주문서.txt", "w")\nexcept PermissionError as e:\n    print(e)\n'
             'with open("주문서.txt") as f:\n    print(f.read() == "당근 2\\n감자 1\\n")\n', NOTES)
    assert r["error"] is None and r["stdout"] == NOTE_RO_MSG + "\nTrue\n", r


def test_journal_append_persists_when_fed_back():
    code = 'with open("농장일지.txt", "a") as f:\n    f.write("수확 " + str(store()["당근"]) + "\\n")\n'
    r1 = nrun(code, {JOURNAL: ""})
    assert r1["error"] is None, r1
    assert r1["farm"]["files"] == {JOURNAL: "수확 0\n"}
    r2 = nrun(code, {JOURNAL: r1["farm"]["files"][JOURNAL]}, farm(store={"당근": 3, "감자": 0}))
    assert r2["farm"]["files"] == {JOURNAL: "수확 0\n수확 3\n"}
    r3 = nrun('with open("농장일지.txt") as f:\n    print(f.read().count("수확"))\n',
              {JOURNAL: r2["farm"]["files"][JOURNAL]})
    assert r3["stdout"] == "2\n"


def test_journal_write_mode_and_tail_2000():
    r = nrun('with open("농장일지.txt", "w") as f:\n    for i in range(500):\n        f.write("가나다%d\\n" % i)\n',
             {JOURNAL: "옛 내용"})
    text = r["farm"]["files"][JOURNAL]
    assert len(text) == 2000
    assert text.endswith("가나다499\n") and "옛 내용" not in text
    full = "".join("가나다%d\n" % i for i in range(500))
    assert text == full[-2000:]
    r2 = nrun("pass\n", {JOURNAL: "x" * 2500 + "끝"})
    assert r2["farm"]["files"][JOURNAL] == ("x" * 2500 + "끝")[-2000:]


def test_journal_returned_on_error_and_stops():
    w = 'with open("농장일지.txt", "a") as f:\n    f.write("시작\\n")\n'
    e = nrun(w + "print(1/0)\n", {JOURNAL: ""})
    assert e["error"]["type"] == "ZeroDivisionError" and e["farm"]["files"] == {JOURNAL: "시작\n"}
    t = nrun(w + 'while True:\n    move("오른쪽")\n', {JOURNAL: ""})
    assert t["farm"]["stopped"] == "tired" and t["farm"]["files"] == {JOURNAL: "시작\n"}
    wt = nrun(w + "while not can_harvest():\n    pass\n", {JOURNAL: ""})
    assert wt["farm"]["stopped"] == "waited" and wt["farm"]["files"] == {JOURNAL: "시작\n"}
    s = nrun("move(\n", {JOURNAL: "어제\n"})
    assert s["error"]["type"] == "SyntaxError" and s["farm"]["files"] == {JOURNAL: "어제\n"}
    x = nrun(w + "import sys\nsys.exit()\n", {JOURNAL: ""})
    assert x["error"] is None and x["farm"]["files"] == {JOURNAL: "시작\n"}


def test_deleting_journal_returns_empty():
    r = nrun('import os\nos.remove("농장일지.txt")\n', {JOURNAL: "많은 기록\n"})
    assert r["error"] is None and r["farm"]["files"] == {JOURNAL: ""}
    d = nrun('import os\nos.remove("농장일지.txt")\nos.mkdir("농장일지.txt")\n', {JOURNAL: "a"})
    assert d["error"] is None and d["farm"]["files"] == {JOURNAL: ""}


def test_other_new_files_discarded_and_not_returned():
    r = nrun('with open("메모.txt", "w") as f:\n    f.write("hi")\n'
             'with open("메모.txt") as f:\n    print(f.read())\n', NOTES)
    assert r["error"] is None and r["stdout"] == "hi\n"
    assert r["farm"]["files"] == {JOURNAL: "1일째\n"}
    r2 = nrun('import os\nprint(sorted(os.listdir(".")))\n', NOTES)
    assert r2["stdout"] == "['농장일지.txt', '주문서.txt']\n", r2


def test_journal_cleaned_for_json_bad_bytes():
    r = nrun('with open("농장일지.txt", "wb") as f:\n    f.write(b"ok\\xff\\xfe")\n', {JOURNAL: ""})
    text = r["farm"]["files"][JOURNAL]
    assert type(text) is str and text.startswith("ok")
    json.dumps(r, allow_nan=False)


def test_open_restored_after_farm_files_run():
    import builtins
    import io
    before = (builtins.open, io.open)
    nrun('open("주문서.txt", "w")\n', NOTES)
    assert (builtins.open, io.open) == before
    # 텃밭 없이 files만 준 실행은 예전 그대로 쓸 수 있다
    r = run('with open("주문서.txt", "w") as f:\n    f.write("x")\nprint(open("주문서.txt").read())\n',
            "", [], files=dict(NOTES))
    assert r["error"] is None and r["stdout"] == "x\n" and "farm" not in r


def test_input_files_not_mutated_and_deterministic():
    files = dict(NOTES)
    code = ('with open("농장일지.txt", "a") as f:\n    f.write("또\\n")\nplant("토마토")\n')
    a = nrun(code, files)
    b = nrun(code, files)
    assert files == NOTES and a == b and a["error"] is None


# ------------------------------------------------------------ v0.12 검토 반영(C71)

TOMATO_LOCKED_MSG = "토마토는 10장을 끝내면 심을 수 있어요"


def test_journal_open_counts_toward_action_cap():
    # C71 C1(b): 농장일지를 쓰기·덧붙이기로 여는 것은 행동 상한(500)에 하나씩 든다 — 끝없는 일지 반복은 「지침」
    import time
    code = ('for i in range(25):\n    for j in range(25):\n        for k in range(25):\n            for m in range(25):\n'
            '                with open("농장일지.txt", "a") as f:\n                    f.write("수확 개\\n")\n')
    t = time.time()
    r = nrun(code, {JOURNAL: ""})
    assert time.time() - t < 1.0
    assert r["error"] is None and r["farm"]["stopped"] == "tired", r["error"]
    assert r["farm"]["actions"] == 0 and r["farm"]["state"]["clock"] == 0 and r["farm"]["events"] == []
    assert r["farm"]["files"][JOURNAL] == ("수확 개\n" * 500)[-2000:]   # 500번 열고 501번째에 멈춤(끝 2000자)
    # 쓰기 모드("w")·pathlib도 센다
    w = nrun('import pathlib\nfor i in range(600):\n    pathlib.Path("농장일지.txt").write_text("x")\n', {JOURNAL: ""})
    assert w["farm"]["stopped"] == "tired", w


def test_journal_opens_share_cap_with_actions():
    # 행동 300 + 일지 열기 200 = 500까지는 멈추지 않고, 하나 더면 지침
    ok = nrun('for i in range(300):\n    move("오른쪽")\nfor i in range(200):\n    open("농장일지.txt", "a").close()\n',
              {JOURNAL: ""})
    assert ok["error"] is None and ok["farm"]["stopped"] is None and ok["farm"]["actions"] == 300, ok
    over = nrun('for i in range(200):\n    open("농장일지.txt", "a").close()\nfor i in range(301):\n    move("오른쪽")\n',
                {JOURNAL: ""})
    assert over["farm"]["stopped"] == "tired" and over["farm"]["actions"] == 300, over
    # 읽기로 여는 것은 세지 않는다
    rd = nrun('for i in range(700):\n    open("농장일지.txt").close()\n', {JOURNAL: "a\n"})
    assert rd["error"] is None and rd["farm"]["stopped"] is None


def test_journal_open_swallowed_still_stops():
    r = nrun('while True:\n    try:\n        open("농장일지.txt", "a").close()\n    except BaseException:\n        pass\n',
             {JOURNAL: ""})
    assert r["error"] is None and r["farm"]["stopped"] == "tired"


def test_read_journal_ignores_symlink(tmp_path):
    import os
    import runner
    target = tmp_path / "secret.txt"
    target.write_text("비밀")
    d = tmp_path / "run"
    d.mkdir()
    os.symlink(str(target), str(d / JOURNAL))
    assert runner._read_journal(str(d)) == ""
    r = nrun('import os\nos.remove("농장일지.txt")\nos.symlink("주문서.txt", "농장일지.txt")\n', NOTES)
    assert r["error"] is None and r["farm"]["files"] == {JOURNAL: ""}, r


def test_tomato_locked_before_chapter_10():
    # C71 I1: tomato_ok가 False면 plant("토마토")는 시간 1을 쓰고 plant_fail(tomato_locked) 뒤 ValueError
    s = farm(seeds=5)
    s["tomato_ok"] = False
    r = frun('move("오른쪽")\nplant("토마토")\n', s)
    assert r["error"] == {"type": "ValueError", "line": 2, "msg": TOMATO_LOCKED_MSG}, r
    f = r["farm"]
    assert f["events"][-1] == {"t": "plant_fail", "line": 2, "reason": "tomato_locked", "crop": "토마토", "x": 1, "y": 0}
    assert f["actions"] == 2 and f["state"]["clock"] == 2 and f["state"]["seeds"] == 5
    assert f["state"]["cells"][1] is None
    assert "tomato_ok" not in f["state"]
    # seeds()는 그대로 되고, 당근은 심어진다
    ok = frun('print(seeds())\nplant("당근")\n', s)
    assert ok["error"] is None and ok["stdout"] == "5\n" and kinds(ok) == ["say", "plant"]
    # 잠김이 빈 봉투보다 먼저
    s0 = dict(s, seeds=0)
    assert frun('plant("토마토")\n', s0)["farm"]["events"][0]["reason"] == "tomato_locked"
    # 없거나 True면 예전처럼
    assert frun('plant("토마토")\n', dict(s, tomato_ok=True))["error"] is None
    assert frun('plant("토마토")\n')["error"] is None
