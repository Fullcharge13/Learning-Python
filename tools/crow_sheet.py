"""경비실 크로우 그림 확인용 PNG를 만든다 (v0.15.0 작업 1, 사용자 승인용 시안).

    python3 tools/crow_sheet.py

- docs/img/crow-sheet.png : 6포즈를 한 장에. 큰 그림(160px) 줄 + 실제 화면 크기(80px) 줄, 이름표 포함

SVG 문자열은 `node`로 src/guard/crow.js를 불러 얻고, Playwright Chromium으로 찍는다(tools/ria_sheet.py와 같은 방식).
"""
import json
import pathlib
import subprocess

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "img"

NODE_SCRIPT = """
const m = await import(process.argv[1]);
const big = {}, small = {};
for (const p of m.CROW_POSES) { big[p] = m.crowSVG({ pose: p, size: 160 }); small[p] = m.crowSVG({ pose: p, size: 80 }); }
console.log(JSON.stringify({ poses: m.CROW_POSES, big, small }));
"""

# 이름표(한국어 기준, 사용자 확인용 그림에만 씀)
POSE_KO = {"wave": "등장·손 흔들기", "wait": "대기·둥지", "shock": "막힘·깜짝", "loot": "뚫림·보석 뜯기", "cry": "해결·울기", "rank": "등급·세계 정복"}


def load():
    url = (ROOT / "src" / "guard" / "crow.js").as_uri()
    out = subprocess.run(["node", "--input-type=module", "-e", NODE_SCRIPT, url],
                         check=True, capture_output=True, text=True, cwd=ROOT)
    return json.loads(out.stdout)


def sheet_html(d):
    head = "".join(f"<th>{p}<br><small>{POSE_KO[p]}</small></th>" for p in d["poses"])
    big = "".join(f"<td>{d['big'][p]}</td>" for p in d["poses"])
    small = "".join(f"<td class=s>{d['small'][p]}</td>" for p in d["poses"])
    return f"""<!doctype html><meta charset=utf-8><style>
body{{margin:0;background:#FBF7F0;font-family:system-ui,'Noto Sans CJK KR',sans-serif;color:#3B2C35}}
table{{border-collapse:collapse;margin:12px}} th{{font-size:14px;padding:4px}}
td{{padding:4px;border:1px solid #EFE6D8;background:#FFFDF9}} td svg{{display:block;margin:auto}} td.s{{padding:8px}} small{{color:#8a7a70}}
</style><table><tr>{head}</tr><tr>{big}</tr><tr>{small}</tr></table>"""


def main():
    d = load()
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        try:
            pg = b.new_page(viewport={"width": 1200, "height": 600}, device_scale_factor=1)
            pg.set_content(sheet_html(d))
            pg.locator("table").screenshot(path=str(OUT / "crow-sheet.png"))
        finally:
            b.close()
    print("wrote", OUT / "crow-sheet.png")


if __name__ == "__main__":
    main()
