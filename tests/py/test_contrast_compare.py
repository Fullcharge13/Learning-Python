"""tests/contrast.py compare(): 같은 색의 줄이 하나 더 생기는 것(요일 따라 붙는 배지 줄 등)은 차이가 아님,
색이 바뀌거나 새 색 조합이 생기면 차이."""
import json, os, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import contrast


def _base(tmp, digests):
    p = os.path.join(tmp, "b.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump({"digests": digests}, f)
    return p


def test_extra_same_color_row_is_not_a_difference():
    with tempfile.TemporaryDirectory() as t:
        b = _base(t, {"done": ["li > span|#22304a|#fffdf8"]})
        assert contrast.compare(b, {"digests": {"done": ["li > span|#22304a|#fffdf8"] * 2}}) == []


def test_changed_color_is_a_difference():
    with tempfile.TemporaryDirectory() as t:
        b = _base(t, {"done": ["li > span|#22304a|#fffdf8"]})
        d = contrast.compare(b, {"digests": {"done": ["li > span|#ffffff|#fffdf8"]}})
        assert "done: - li > span|#22304a|#fffdf8" in d and "done: + li > span|#ffffff|#fffdf8" in d


def test_missing_screen_is_a_difference():
    with tempfile.TemporaryDirectory() as t:
        b = _base(t, {"done": ["a|#000000|#ffffff"]})
        assert contrast.compare(b, {"digests": {}}) == ["done: screen missing"]


def test_app_init_freezes_the_day():
    """화면 내용이 요일·날짜에 따라 달라지지 않게, 대비 도구의 페이지는 늘 같은 날(수요일 2026-11-11)로 시작."""
    import shutil, subprocess
    js = contrast.FROZEN_DATE_JS
    node = shutil.which("node")
    assert node
    out = subprocess.run([node, "-e", "globalThis.window = globalThis;" + js +
                          ";const d=new Date();console.log(d.getFullYear(),d.getMonth()+1,d.getDate(),"
                          "Date.now()===Date.now()||Date.now()>0, new Date(2020,0,1).getFullYear())"],
                         capture_output=True, text=True, env={"TZ": "Asia/Seoul"})
    assert out.stdout.split() == ["2026", "11", "11", "true", "2020"], out.stdout + out.stderr
