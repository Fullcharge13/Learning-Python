#!/usr/bin/env python3
"""점검기(tests/content.py)의 차트 칸·show_only 카드 시험 (v0.5 작업 1, 판정 C38).

실행: python3 tests/content_chart_test.py   (pytest로도 돌아감)
장별 문법 규칙(chart·sqlite3 import 허용 등)은 작업 2 몫이라, 여기서는 그 오류(「…장에서 …」)를 빼고 본다.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content  # noqa: E402
from content import Lesson, chart_of, chart_mismatch, check_choice, check_blank, check_order, check_write, check_lesson  # noqa: E402

BAR = {"kind": "bar", "labels": ["사과", "배"], "values": [3, 5]}
CODE = "import chart\nchart.bar(['사과', '배'], [3, 5])\nchart.show()\nprint('끝')"


def errs_of(rep):
    """장 문법 규칙 오류를 뺀 나머지"""
    return [e for e in rep.errors if "장에서" not in e]


def has(errors, word):
    return any(word in e for e in errors)


# ── 비교 규칙: src/chart.js chartMismatch와 같은 말 ───────────────────────
def test_mismatch_rules_match_js():
    assert chart_mismatch(BAR, [{"kind": "bar", "labels": ["사과", "배"], "values": [3.0, 5.0]}]) is None
    assert chart_mismatch({"kind": "line", "labels": [2024], "values": [0.3]},
                          [{"kind": "line", "labels": ["2024"], "values": [0.1 + 0.2]}]) is None
    assert chart_mismatch(BAR, [dict(BAR, title="자유")]) is None
    assert "그려지지 않았어요" in chart_mismatch(BAR, [])
    assert "개수가 달라요" in chart_mismatch(BAR, [BAR, BAR])
    assert "종류가 달라요" in chart_mismatch(BAR, [dict(BAR, kind="line")])
    assert "이름(가로축 항목)이 달라요" in chart_mismatch(BAR, [dict(BAR, labels=["배", "사과"])])
    assert "그래프 값이 달라요" in chart_mismatch(BAR, [dict(BAR, values=[3, 6])])
    assert "제목이 달라요" in chart_mismatch(dict(BAR, title="과일"), [BAR])
    assert "2번째" in chart_mismatch([BAR, BAR], [BAR, dict(BAR, values=[1, 1])])


def test_chart_shape():
    def shape(v):
        rep = Lesson("t")
        return chart_of(rep, "x", {"chart": v}), rep.errors
    assert shape(BAR) == (BAR, [])
    assert shape([BAR, dict(BAR, kind="line", title="t", xlabel="a", ylabel="b")])[1] == []
    assert chart_of(Lesson("t"), "x", {}) is None
    for bad in ({}, [], [BAR] * 4, dict(BAR, kind="pie"), dict(BAR, values=[1]), dict(BAR, values=["3", 5]),
                dict(BAR, values=[True, 5]), dict(BAR, labels=[None, "a"]), dict(BAR, color="red"),
                dict(BAR, title=3), {"kind": "bar", "labels": [], "values": []},
                {"kind": "bar", "values": [1]}, dict(BAR, labels=[str(i) for i in range(25)], values=list(range(25)))):
        v, errs = shape(bad)
        assert v is None and has(errs, "chart"), (bad, errs)


# ── 칸이 허용되는 곳 ───────────────────────────────────────────────────
def test_keys_allowed():
    assert "chart" in content.TEST_OPT
    assert {"chart", "show_only"} <= content.CARD_OPT
    for kind in ("choice", "check", "blank", "order"):
        assert "chart" in content.ITEM_KEYS[kind][1], kind
    for kind in content.ITEM_KEYS:
        assert "show_only" not in content.ITEM_KEYS[kind][0] | content.ITEM_KEYS[kind][1], kind


# ── 터치 문제: 저장된 chart가 코드를 돌린 그림과 같아야 함 ──────────────────
def test_choice_chart_checked():
    item = {"type": "choice", "concept": "bar", "q": "출력은?", "code": CODE, "options": ["끝", "사과", "오류"],
            "answer": 0, "explain": "막대를 그리고 끝을 출력해요.", "chart": BAR}
    rep = Lesson("t")
    check_choice(rep, "items[0]", item, 17)
    assert errs_of(rep) == [], rep.errors
    rep = Lesson("t")
    check_choice(rep, "items[0]", dict(item, chart=dict(BAR, values=[3, 6])), 17)
    assert has(errs_of(rep), "그래프 값이 달라요"), rep.errors


def test_blank_and_order_chart():
    blank = {"type": "blank", "concept": "bar", "q": "빈칸은?", "code": "import chart\nchart.___(['a'], [1])\nchart.show()",
             "chips": ["bar", "line", "pie"], "answer": 0, "explain": "막대예요.",
             "chart": {"kind": "bar", "labels": ["a"], "values": [1]}}
    rep = Lesson("t")
    check_blank(rep, "items[0]", blank, 17)
    # line도 오류 없이 같은 출력("")을 내지만 그림이 다르므로 「정답이 둘」이 아님
    assert errs_of(rep) == [], rep.errors
    rep = Lesson("t")
    check_blank(rep, "items[0]", dict(blank, chart={"kind": "line", "labels": ["a"], "values": [1]}), 17)
    assert has(errs_of(rep), "종류가 달라요"), rep.errors
    order = {"type": "order", "concept": "bar", "q": "순서대로", "expect": "",
             "lines": ["import chart", "chart.bar(['a'], [1])", "chart.title('t')", "chart.show()"],
             "explain": "그리고 보여 줘요.", "chart": {"kind": "bar", "labels": ["a"], "values": [1], "title": "t"}}
    rep = Lesson("t")
    check_order(rep, "items[0]", order, 17)
    # bar와 title을 바꾼 순서도 같은 그림 → 정답 순서가 둘
    assert has(errs_of(rep), "2가지"), rep.errors


# ── 직접 작성: 출력과 그림을 둘 다 ───────────────────────────────────────
def write_item(**kw):
    item = {"type": "write", "concept": "bar", "task": "사과 3, 배 5 막대 그래프를 그리고 끝을 출력해요.",
            "starter": "import chart\n", "tests": [{"stdin": "", "expect": "끝", "public": True, "chart": BAR}],
            "require": [], "hints": ["다시 봐요.", "bar를 써요.", "show로 보여 줘요.", "chart.bar(___, ___)"],
            "solution": CODE, "explain": "막대 그래프예요."}
    item.update(kw)
    return item


def test_write_chart():
    rep = Lesson("t")
    check_write(rep, "items[0] write", write_item(), 17)
    assert errs_of(rep) == [], rep.errors
    rep = Lesson("t")
    check_write(rep, "items[0] write", write_item(tests=[{"stdin": "", "expect": "끝", "public": True,
                                                          "chart": dict(BAR, values=[3, 4])}]), 17)
    assert has(errs_of(rep), "그래프 값이 달라요"), rep.errors
    # 그림을 그리는 정답인데 시험에 chart가 없으면 채점이 그림을 보지 못함
    rep = Lesson("t")
    check_write(rep, "items[0] write", write_item(tests=[{"stdin": "", "expect": "끝", "public": True}]), 17)
    assert has(errs_of(rep), "chart"), rep.errors
    # 출력만 맞는 starter는 그림이 없으니 통과하지 못함(「starter만으로 통과」 아님)
    rep = Lesson("t")
    check_write(rep, "items[0] write", write_item(starter="print('끝')"), 17)
    assert not has(errs_of(rep), "starter만으로"), rep.errors


# ── 카드: chart와 show_only ────────────────────────────────────────────
def lesson_with(card):
    return {"id": "17-1", "chapter": 17, "title": "막대", "goal": "막대 그래프를 그려요", "summary": ["a", "b", "c"],
            "cards": [card], "items": []}


def card_errs(card):
    rep = Lesson("t")
    check_lesson(rep, lesson_with(card), 17, 1, {"bar": 17})
    return [e for e in errs_of(rep) if e.startswith("cards")]


def test_card_chart():
    assert card_errs({"say": "막대를 그려요.", "code": CODE, "out": "끝", "chart": BAR}) == []
    assert has(card_errs({"say": "막대를 그려요.", "code": CODE, "out": "끝", "chart": dict(BAR, labels=["a", "b"])}),
               "이름(가로축 항목)이 달라요")
    # 카드는 실행하지 않고 보여 주므로, 그림을 그리는 코드면 chart를 적어야 학습자가 그림을 봄
    assert has(card_errs({"say": "막대를 그려요.", "code": CODE, "out": "끝"}), "chart")


MPL = "import matplotlib.pyplot as plt\nplt.bar(names, values, color='red')\nplt.show()"


def test_show_only_card():
    ok = {"say": "실제 컴퓨터에서는 이렇게 써요.", "code": MPL, "show_only": True}
    assert card_errs(ok) == []
    assert card_errs(dict(ok, out="")) == []
    rep = Lesson("t")
    check_lesson(rep, lesson_with(ok), 17, 1, {"bar": 17})
    assert not any("matplotlib" in e or "모듈" in e for e in rep.errors), rep.errors   # 문법·모듈 검사 안 함
    assert has(card_errs(dict(ok, out="그림")), "out")                               # 출력 칸은 비워야 함
    assert has(card_errs(dict(ok, code="x = '" + "가" * 40 + "'")), "넓음")           # 폭 검사는 함
    assert has(card_errs(dict(ok, show_only=1)), "show_only")                         # true만
    assert has(card_errs(dict(ok, chart=BAR)), "show_only")                           # 실행 관련 칸과 함께 못 씀
    assert has(card_errs({"say": "그냥 카드예요.", "code": "print(1)"}), "카드 칸")     # 보통 카드는 out 필수


def test_show_only_not_on_items():
    rep = Lesson("t")
    item = {"type": "choice", "concept": "bar", "q": "어느 것?", "options": ["a", "b", "c"], "answer": 0,
            "explain": "설명이에요.", "show_only": True}
    content.check_item(rep, "items[0] choice", item, 17, {"bar": 17})
    assert has(rep.errors, "모르는 칸: show_only"), rep.errors


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    bad = 0
    for name, fn in tests:
        try:
            fn()
            print("✓ " + name)
        except Exception as e:  # noqa: BLE001
            bad += 1
            print("✗ %s: %s: %s" % (name, type(e).__name__, e))
    print("\n%d/%d 통과" % (len(tests) - bad, len(tests)))
    sys.exit(1 if bad else 0)
