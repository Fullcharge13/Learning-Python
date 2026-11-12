"""v0.15.0 경비실: 크로우 그림 — 원본 시트(art/crow_sheet.svg)와 앱 데이터(data/crow.js)가 어긋나지 않는다."""
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, os.path.join(ROOT, "tools"))

import crow_import as imp  # noqa: E402

SHEET = os.path.join(ROOT, "art", "crow_sheet.svg")
DATA = os.path.join(ROOT, "data", "crow.js")
POSES = ["wave", "wait", "shock", "loot", "cry", "rank"]


def test_sheet_has_6_poses_in_app_order():
    assert list(imp.poses_from_sheet(SHEET)) == POSES


def test_roundtrip():
    """데이터로 다시 조립한 포즈 묶음 = 시트의 <g id="crow-<pose>"> 안쪽 글자."""
    poses = imp.poses_from_sheet(SHEET)
    data = imp.load_data(DATA)
    for k, inner in poses.items():
        assert imp.rebuild(data, k) == inner, k


def test_data_file_is_up_to_date():
    with open(DATA, encoding="utf-8") as f:
        assert f.read() == imp.render_data(imp.pack(imp.poses_from_sheet(SHEET), imp.head_from_sheet(SHEET)))


def test_check_mode_reports_ok():
    assert imp.main(["--check"]) == 0


def test_no_text_ids_or_defs_inside_poses():
    for k, s in imp.poses_from_sheet(SHEET).items():
        assert "<text" not in s and " id=" not in s and "<defs" not in s, k
        assert " />" not in s, k


def test_body_horns_tail_are_shared():
    """몸통·뿔·꼬리 조각은 6포즈가 함께 쓴다."""
    data = imp.load_data(DATA)
    shared = set.intersection(*(set(v) for v in data["poses"].values()))
    assert len(shared) >= 3
    assert len(data["pieces"]) == len(set(data["pieces"]))


def test_data_size_limit():
    assert os.path.getsize(DATA) <= 15 * 1024
