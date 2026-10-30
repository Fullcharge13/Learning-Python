"""리아 교수 그림 확인용 PNG를 만든다 (작업 8).

    python3 tools/ria_sheet.py

- docs/img/ria-sheet.png : 의상 9(줄) x 표정 8(칸) = 72칸, 이름표 포함
- docs/img/ria-hero.png  : 기본 의상·미소, 크게

SVG 문자열은 `node`로 src/ria.js를 불러 얻고, Playwright Chromium으로 찍는다.
"""
import json
import pathlib
import subprocess

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "img"

NODE_SCRIPT = """
const m = await import(process.argv[1]);
const cell = {};
for (const o of m.OUTFIT_IDS) for (const f of m.FACE_IDS) cell[o + '/' + f] = m.riaSVG({ outfit: o, face: f, size: 150 });
console.log(JSON.stringify({ outfits: m.OUTFIT_IDS, faces: m.FACE_IDS, outfitKo: m.OUTFIT_KO, faceKo: m.FACE_KO, cell, hero: m.riaSVG({ size: 480 }) }));
"""


def load():
    url = (ROOT / "src" / "ria.js").as_uri()
    out = subprocess.run(["node", "--input-type=module", "-e", NODE_SCRIPT, url],
                         check=True, capture_output=True, text=True, cwd=ROOT)
    return json.loads(out.stdout)


def sheet_html(d):
    head = "".join(f"<th>{f}<br><small>{d['faceKo'][f]}</small></th>" for f in d["faces"])
    rows = []
    for o in d["outfits"]:
        cells = "".join(f"<td>{d['cell'][o + '/' + f]}</td>" for f in d["faces"])
        rows.append(f"<tr><th class=r>{o}<br><small>{d['outfitKo'][o]}</small></th>{cells}</tr>")
    return f"""<!doctype html><meta charset=utf-8><style>
body{{margin:0;background:#FBF7F0;font-family:system-ui,'Noto Sans CJK KR',sans-serif;color:#3B2C35}}
table{{border-collapse:collapse;margin:12px}} th{{font-size:14px;padding:4px}} th.r{{width:90px;text-align:right;padding-right:10px}}
td{{padding:2px;border:1px solid #EFE6D8;background:#FFFDF9}} td svg{{display:block}} small{{color:#8a7a70}}
</style><table><tr><th></th>{head}</tr>{''.join(rows)}</table>"""


def hero_html(d):
    return f"""<!doctype html><meta charset=utf-8><style>
body{{margin:0;background:#FBF7F0}} div{{padding:20px;display:inline-block}} svg{{display:block}}</style><div>{d['hero']}</div>"""


def main():
    d = load()
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        try:
            pg = b.new_page(viewport={"width": 1400, "height": 900}, device_scale_factor=1)
            pg.set_content(sheet_html(d))
            pg.locator("table").screenshot(path=str(OUT / "ria-sheet.png"))
            pg.set_content(hero_html(d))
            pg.locator("div").screenshot(path=str(OUT / "ria-hero.png"))
        finally:
            b.close()
    print("wrote", OUT / "ria-sheet.png", "and", OUT / "ria-hero.png")


if __name__ == "__main__":
    main()
