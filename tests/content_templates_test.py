#!/usr/bin/env python3
"""점검기(tests/content.py)의 매일 도전 틀(TEMPLATES) 검사 시험 (v0.9 작업 2, 판정 C54).

실행: python3 tests/content_templates_test.py   (pytest로도 돌아감)
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content  # noqa: E402
from content import check_templates, template_count_errors, judge_instance, instantiate_templates  # noqa: E402

CONCEPTS = {"print": 1, "string": 1, "arith": 1, "assign": 2, "convert": 2, "if": 3,
            "fmtspec": content.AdvancedChapter(1)}

GOOD = {
    "id": "1-T1", "concept": "arith", "type": "choice",
    "q": "화면에 무엇이 출력될까요?",
    "code": "print({A} + {B} * {C})",
    "wrong": ["print(({A} + {B}) * {C})", "print({A} + {B} + {C})"],
    "vars": {"A": {"min": 2, "max": 9}, "B": {"min": 3, "max": 9}, "C": {"min": 2, "max": 5}},
    "explain": "곱셈을 먼저 해서 {OUT}이 돼요.",
}
BLANK = {
    "id": "1-T2", "concept": "arith", "type": "blank",
    "q": "{FOOD} {N}개를 {K}명이 똑같이 나누고 남는 개수가 나오게 빈칸을 채워 보세요.",
    "code": "print({N} ___ {K})",
    "chips": ["%", "//", "/"], "answer": 0,
    "vars": {"FOOD": ["사탕", "귤", "쿠키"], "N": {"min": 13, "max": 29}, "K": {"min": 3, "max": 6}},
    "explain": "남는 개수는 나머지 % 로 구해요.",
}


def errs(templates, chapter=1):
    return check_templates(templates, chapter, CONCEPTS)[0]


def has(errors, word):
    return any(word in e for e in errors)


def test_good_choice_and_blank_pass():
    e, stats = check_templates([GOOD, BLANK], 1, CONCEPTS)
    assert e == [], e
    assert stats["instances"] == 200
    # 나머지와 몫이 같아지는 씨앗(예: 15 % 4 == 15 // 4)은 다시 만들기로 넘어감 — 오류 아님
    assert stats["retried"] >= 1, stats


def test_instances_come_from_js_engine():
    inst = instantiate_templates([GOOD])["1-T1"]
    assert len(inst) == content.TEMPLATE_SEEDS and len(inst[0]) == content.TEMPLATE_ATTEMPTS
    i = inst[7][0]
    a, b, c = i["vals"]["A"], i["vals"]["B"], i["vals"]["C"]
    assert i["code"] == "print(%d + %d * %d)" % (a, b, c)


def test_schema_errors():
    bad = dict(GOOD, id="2-T1", extra=1)
    e = errs([bad])
    assert has(e, "id") and has(e, "모르는 칸")
    assert has(errs([dict(GOOD, vars={"a": [1, 2]})]), "대문자")
    assert has(errs([dict(GOOD, vars={"OUT": [1, 2], "A": [1, 2], "B": [3, 4], "C": [2, 3]})]), "OUT")
    assert has(errs([dict(GOOD, vars=dict(GOOD["vars"], D={"min": 1, "max": 3}))]), "쓰지 않는 값")
    assert has(errs([dict(GOOD, code="print({A} + {B} * {Z})")]), "Z")
    assert has(errs([dict(GOOD, vars=dict(GOOD["vars"], A={"min": 5, "max": 5}))]), "min")
    assert has(errs([dict(GOOD, wrong=["print(1)"])]), "wrong")
    assert has(errs([dict(BLANK, chips=["%", "%", "/"])]), "같은 값")
    assert has(errs([dict(BLANK, code="print({N} {K})")]), "___")
    assert has(errs([GOOD, dict(GOOD)]), "중복")
    assert has(errs([dict(GOOD, concept="if")]), "3장")
    assert has(errs([dict(GOOD, concept="fmtspec")]), "심화")
    assert has(errs([dict(GOOD, code="print({A} + {B} * {C}) {OUT}")]), "OUT")


def test_answer_error_is_an_error():
    e = errs([dict(GOOD, code='print("{A}" + {B} * {C})')])
    assert has(e, "정답 코드가 오류"), e


def test_distractor_always_same_fails():
    e = errs([dict(GOOD, wrong=["print({B} * {C} + {A})", "print({A} + {B} + {C})"])])
    assert has(e, "겹치지 않는 보기"), e


def test_blank_wrong_chip_same_output_fails():
    t = dict(BLANK, code="print({N} ___ 1)", chips=["*", "//", "+"])
    e = errs([t])
    assert has(e, "겹치지 않는 보기"), e


def test_chapter_rules_apply_main_level():
    t = dict(GOOD, code="x = {A}\nprint(x + {B} * {C})")
    assert has(errs([t], 1), "1장")                          # 1장은 변수 없음
    assert errs([dict(t, id="2-T1", concept="assign")], 2) == []
    f = dict(GOOD, code='print(f"{{A}:>3}")', wrong=['print("{A}")', 'print({A} + 1)'], vars={"A": {"min": 10, "max": 99}},
             q="화면에 무엇이 출력될까요?", explain="오른쪽 맞춤")
    assert has(errs([f]), "심화")                            # 서식 지정자는 심화 전용


def test_width_and_text_limits():
    long_code = dict(GOOD, code="print({A} + {B} * {C} + 1000000000000000000000)")
    assert has(errs([long_code]), "넓음")
    assert has(errs([dict(GOOD, q="가" * 90)]), "너무 김")
    assert has(errs([dict(GOOD, explain="x")]), "한국어")
    wide = dict(GOOD, code='print("{W}")', wrong=['print("{W}!")', 'print("{W}?")'],
                vars={"W": ["가나다라마바사아자차카타파하가나", "나다라마바사아자차카타파하가나다"]}, explain="글자 그대로 나와요.")
    assert has(errs([wide]), "보기")


def test_slow_code_fails():
    t = dict(GOOD, code="n = 0\nfor i in range({A} * 20000000):\n    n += 1\nprint({A} + {B} * {C})", concept="arith")
    assert has(check_templates([dict(t, id="5-T1")], 5, CONCEPTS)[0], "초")


def test_template_count_flag():
    assert template_count_errors({1: 4, 2: 4}, None) == []
    assert template_count_errors({1: 4, 2: 4}, 2) == []
    e = template_count_errors({1: 4, 2: 3}, 3)
    assert len(e) == 2 and has(e, "2장") and has(e, "3장"), e


def test_judge_instance_mirrors_js_rules():
    inst = {"type": "choice", "answer": 0, "q": "q", "explain": "e"}
    ok = lambda s: {"stdout": s + "\n", "error": None}  # noqa: E731
    bad = {"stdout": "", "error": {"type": "TypeError"}}
    assert judge_instance(inst, [ok("1"), ok("2"), bad]) is None
    assert judge_instance(inst, [ok("1"), bad, bad]) == "dup"
    assert judge_instance(inst, [bad, ok("1"), ok("2")]) == "answer-error"
    assert judge_instance(inst, [ok("1 "), ok("1"), ok("2")]) == "dup"
    assert judge_instance(inst, [ok("a\nb"), ok("1"), ok("2")]) == "multiline"
    assert judge_instance(inst, [ok("가" * 16), ok("1"), ok("2")]) == "wide"
    b = {"type": "blank", "answer": 1, "q": "{OUT}", "explain": ""}
    assert judge_instance(b, [bad, ok("3"), bad]) is None
    assert judge_instance(b, [ok("3"), ok("3"), bad]) == "dup"


if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("✓", name)
            except AssertionError as ex:
                fails += 1
                print("✗", name, ex)
    sys.exit(1 if fails else 0)
