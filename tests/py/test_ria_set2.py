"""v0.12.4: #리아_이미지_세트2 — 원본 시트(art/ria_set2_sheet.svg)와 앱 데이터(data/ria_set2.js)가 어긋나지 않는다."""
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, os.path.join(ROOT, "tools"))

import ria_set2_import as imp  # noqa: E402

SHEET = os.path.join(ROOT, "art", "ria_set2_sheet.svg")
DATA = os.path.join(ROOT, "data", "ria_set2.js")
OUTFITS = ["basic", "casual", "whitecoat", "hoodie", "gym", "chef", "explorer", "uniform", "wizard", "graduate"]
FACES = ["smile", "joy", "sparkle", "think", "surprise", "worry", "cheer", "wink"]


def test_sheet_has_80_cells_in_app_order():
    cells = imp.cells_from_sheet(SHEET)
    assert list(cells) == ["%s_%s" % (o, f) for o in OUTFITS for f in FACES]


def test_cells_drop_background_box():
    for k, s in imp.cells_from_sheet(SHEET).items():
        assert 'width="380" height="440"' not in s, k
        assert "#fffdf6" not in s.lower(), k
        assert " id=" not in s and "<text" not in s and "<defs" not in s, k


def test_data_rebuilds_every_cell_exactly():
    cells = imp.cells_from_sheet(SHEET)
    data = imp.load_data(DATA)
    for k, s in cells.items():
        assert imp.rebuild(data, k) == s, k


def test_data_file_is_up_to_date():
    with open(DATA, encoding="utf-8") as f:
        assert f.read() == imp.render_data(imp.pack(imp.cells_from_sheet(SHEET)))


def test_cells_keep_sheet_markup():
    """칸 문자열 안의 빈 태그는 원본 시트처럼 '/>'로 끝난다(빈칸 없음)."""
    for k, s in imp.cells_from_sheet(SHEET).items():
        assert " />" not in s, k


def test_data_is_deduplicated():
    data = imp.load_data(DATA)
    assert len(data["pieces"]) == len(set(data["pieces"]))
    assert len(data["pieces"]) < 400
    assert os.path.getsize(DATA) < 45_000
