"""README 생성기(tools/readme_gen.py): 심화 레슨(v0.7)을 장 표에 「심화」로 넣고 머리말에 개수를 적는다."""
import copy
import functools
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import readme_gen  # noqa: E402


@functools.lru_cache(maxsize=1)
def _data():
    return readme_gen.load_data()


def _adv(n, k):
    return {"id": "%d-A%d" % (n, k), "chapter": n, "isAdvanced": True, "title": "심화 제목 %d" % k,
            "goal": "심화 목표 %d" % k,
            "items": [{"type": "choice", "concept": "print"},
                      {"type": "write", "concept": "print", "task": "심화 과제 %d-%d\n둘째 줄" % (n, k)}]}


def _with_adv(chapters=(1,)):
    d = copy.deepcopy(_data())
    for ch in d["chapters"]:
        ch["advanced"] = [_adv(ch["chapter"]["id"], k) for k in (1, 2, 3)] if ch["chapter"]["id"] in chapters else []
    return d


def test_loader_reads_advanced_key():
    d = _data()
    assert all("advanced" in ch and isinstance(ch["advanced"], list) for ch in d["chapters"])


def test_advanced_rows_and_counts():
    d = _with_adv((1, 2))
    text, n = readme_gen.build(d)
    assert n["advanced"] == 6
    assert "| 1-A1 | 심화 제목 1 **(심화)** | 심화 목표 1 | 심화 과제 1-1 |" in text
    assert "| 2-A3 | 심화 제목 3 **(심화)** |" in text
    lessons = sum(len(ch["lessons"]) for ch in d["chapters"])
    assert "레슨 %d개 · 심화 레슨 6개 ·" % lessons in text
    assert "## 레슨 %d개 + 심화 6개" % lessons in text
    # 심화 줄은 그 장의 본 과정 레슨 다음
    i5, ia = text.index("| 1-5 |"), text.index("| 1-A1 |")
    assert i5 < ia < text.index("### 2장")


def test_no_advanced_keeps_old_wording():
    d = _with_adv(())
    text, n = readme_gen.build(d)
    assert n["advanced"] == 0
    assert "심화 레슨 0개" not in text and "**(심화)**" not in text
    lessons = sum(len(ch["lessons"]) for ch in d["chapters"])
    assert "## 레슨 %d개\n" % lessons in text
