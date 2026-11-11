"""v0.13.5 영어판: runner의 언어(설계서 영어판 §5·§5-1).

텃밭 영어 실행: 작물·방향은 두 언어 이름을 다 받고, 돌려주는 값(what_here·store)은 영어, 쪽지 파일은 영어 이름으로
놓이며 결과 files는 안쪽 이름(농장일지.txt). 사건·끝 상태는 언어와 상관없이 안쪽 열쇠(한국어) 그대로.
오류·안내 문구(텃밭·차트·연습 서버)는 실행 언어로.
"""

import json
import os
import re
import subprocess

from runner import run, FARM_JOURNAL

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
HANGUL = re.compile(r"[가-힣]")


def farm(lang=None, **kw):
    st = {"size": 3, "cells": [None] * 9, "pie": {"x": 0, "y": 0}, "clock": 0,
          "store": {"당근": 0, "감자": 0, "토마토": 0}, "upgrades": ["감자 씨앗"], "seeds": 5}
    st.update(kw)
    if lang:
        st["lang"] = lang
    return st


def erun(code, state=None, files=None):
    return run(code, "", [], files=files, farm=state if state is not None else farm("en"))


def test_english_names_accepted_and_events_stay_internal():
    r = erun('move("right")\nplant("carrot")\nmove("down")\nplant("감자")\n')
    assert r["error"] is None, r
    ev = r["farm"]["events"]
    assert [e.get("dir") for e in ev if e["t"] == "move"] == ["오른쪽", "아래"]
    assert [e["crop"] for e in ev if e["t"] == "plant"] == ["당근", "감자"]
    assert r["farm"]["state"]["cells"][1]["crop"] == "당근"


def test_korean_run_also_accepts_english_names():
    r = run('move("left")\nplant("tomato")\n', "", [], farm=farm())
    assert r["error"] is None, r
    assert [e["crop"] for e in r["farm"]["events"] if e["t"] == "plant"] == ["토마토"]


def test_english_return_values():
    st = farm("en", store={"당근": 2, "감자": 0, "토마토": 1})
    st["cells"][0] = {"crop": "당근", "planted_at": -20}
    r = erun('print(what_here())\nmove("right")\nprint(what_here())\nprint(store())\n', st)
    assert r["error"] is None, r
    assert r["stdout"] == "carrot\nempty\n{'carrot': 2, 'potato': 0, 'tomato': 1}\n"
    k = run('print(what_here())\nprint(store())\n', "", [], farm=farm(store={"당근": 2, "감자": 0, "토마토": 1}))
    assert k["stdout"] == "빈칸\n{'당근': 2, '감자': 0, '토마토': 1}\n"


def test_english_error_messages():
    for code in ('move("north")\n', 'plant("kiwi")\n'):
        r = erun(code)
        assert r["error"]["type"] == "ValueError"
        assert not HANGUL.search(r["error"]["msg"]) and not HANGUL.search(r["stderr"]), r
    r = erun('plant("tomato")\n', farm("en", seeds=0))
    assert r["error"]["type"] == "ValueError" and not HANGUL.search(r["error"]["msg"])
    st = farm("en"); st["tomato_ok"] = False
    r = erun('plant("tomato")\n', st)
    assert r["error"]["type"] == "ValueError" and not HANGUL.search(r["error"]["msg"])


def test_english_note_files():
    files = {"주문서.txt": "carrot 2\npotato 1\n", "손글씨주문.txt": "Ria: 2 carrots, please!",
             FARM_JOURNAL: "Day 1\n"}
    code = ('import os\nprint(sorted(os.listdir(".")))\n'
            'with open("orders.txt") as f:\n    for line in f:\n        crop, n = line.split()\n'
            '        for i in range(int(n)):\n            plant(crop)\n            move("right")\n'
            'with open("farm_log.txt", "a") as f:\n    f.write("planted\\n")\n')
    r = erun(code, files=files)
    assert r["error"] is None, r
    assert r["stdout"] == "['farm_log.txt', 'handwritten.txt', 'orders.txt']\n"
    assert [e["crop"] for e in r["farm"]["events"] if e["t"] == "plant"] == ["당근", "당근", "감자"]
    assert r["farm"]["files"] == {FARM_JOURNAL: "Day 1\nplanted\n"}
    w = erun('open("orders.txt", "w")\n', files=files)
    assert w["error"]["type"] == "PermissionError" and not HANGUL.search(w["error"]["msg"])


def test_chart_and_server_messages_follow_lang():
    r = run('import chart\nchart.bar([1], [1, 2])\n', "", [], lang="en")
    assert r["error"]["type"] == "ValueError" and not HANGUL.search(r["error"]["msg"]), r
    k = run('import chart\nchart.bar([1], [1, 2])\n', "", [])
    assert HANGUL.search(k["error"]["msg"])
    s = run('from urllib.request import urlopen\nurlopen("https://nowhere.example/")\n', "", [],
            server={"https://ria.example/": {"status": 200, "body": "hi"}}, lang="en")
    assert s["error"]["type"] == "URLError" and not HANGUL.search(s["error"]["msg"]), s
    # 텃밭 실행은 farm["lang"]을 따른다
    f = run('import chart\nchart.title(5.5)\nchart.bar([], [])\n', "", [], farm=farm("en"))
    assert f["error"] is not None and not HANGUL.search(f["error"]["msg"]), f


def test_english_docs():
    r = erun('import farm\nprint(farm.__doc__)\nprint(move.__doc__)\nprint(what_here.__doc__)\n')
    assert r["error"] is None and not HANGUL.search(r["stdout"]), r["stdout"]


def test_name_tables_match_js():
    out = subprocess.run(["node", "--input-type=module", "-e",
                          'import("file://" + process.cwd() + "/src/garden/lang.js").then(m => '
                          'console.log(JSON.stringify(m.GARDEN_EN)))'],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout
    import runner
    assert json.loads(out) == runner.FARM_EN


def test_farm_messages_match_garden_errors_js():
    """화면의 친절한 설명(src/garden/errors.js)은 runner 영어 문구를 글자 그대로 알아본다 → 둘이 같아야 함."""
    out = subprocess.run(["node", "--input-type=module", "-e",
                          'import("file://" + process.cwd() + "/src/garden/errors.js").then(m => '
                          'console.log(JSON.stringify(m.FARM_MSG_EN)))'],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout
    js = json.loads(out)
    import runner
    en = runner._EN
    assert js["dir"] == en[runner.FARM_DIR_MSG]
    assert js["crop"] == en[runner.FARM_CROP_MSG]
    assert js["seed"] == en[runner.FARM_NO_TOMATO_SEED_MSG]
    assert js["readonly"] == en[runner.FARM_NOTE_READONLY_MSG]
    assert js["locked"] == en[runner.FARM_TOMATO_LOCKED_MSG]
