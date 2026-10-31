"""리아 교수 그림 확인용 PNG를 만든다 (작업 8).

    python3 tools/ria_sheet.py

- docs/img/ria-sheet.png   : 의상 10(줄) x 표정 8(칸) = 80칸, 이름표 포함
- docs/img/ria-hero.png    : 기본 의상·미소, 크게
- docs/img/ria-compare.png : 참고 그림(docs/ref/ria-outfits-2026-10-31.png)과 코드 그림 10벌을 나란히 (v0.6 비교용)

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
// 비교용: 참고 그림과 같은 표정
const REF_FACE = { basic: 'smile', casual: 'smile', whitecoat: 'smile', hoodie: 'wink', gym: 'wink', chef: 'wink', explorer: 'smile', uniform: 'smile', wizard: 'smile', graduate: 'joy' };
const cmp = {};
for (const o of m.OUTFIT_IDS) cmp[o] = m.riaSVG({ outfit: o, face: REF_FACE[o], size: 230 });
const { OUTFITS } = await import(process.argv[2]);
console.log(JSON.stringify({ outfits: m.OUTFIT_IDS, faces: m.FACE_IDS, outfitKo: m.OUTFIT_KO, faceKo: m.FACE_KO, cell, cmp, table: OUTFITS, hero: m.riaSVG({ size: 480 }) }));
"""


def load():
    url = (ROOT / "src" / "ria.js").as_uri()
    out = subprocess.run(["node", "--input-type=module", "-e", NODE_SCRIPT, url, (ROOT / "data" / "outfits.js").as_uri()],
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


REF = ROOT / "docs" / "ref" / "ria-outfits-2026-10-31.png"
# 참고 그림의 칸 순서(3x3)에 맞춘 차례 + 졸업 가운
CMP_ORDER = ["basic", "casual", "whitecoat", "hoodie", "gym", "wizard", "explorer", "chef", "uniform", "graduate"]


def compare_html(d):
    info = {o["id"]: o for o in d["table"]}
    cells = "".join(
        f"<figure>{d['cmp'][o]}<figcaption><b>{info[o]['name']}</b><br>{info[o]['desc']}</figcaption></figure>"
        for o in CMP_ORDER)
    ref = REF.as_uri()
    return f"""<!doctype html><meta charset=utf-8><style>
body{{margin:0;background:#FBF7F0;font-family:system-ui,'Noto Sans CJK KR',sans-serif;color:#3B2C35}}
#w{{display:flex;gap:16px;padding:14px;align-items:flex-start;width:max-content}} h2{{margin:0 0 8px;font-size:18px}}
.ref img{{width:900px;display:block;border-radius:10px}}
.grid{{display:grid;grid-template-columns:repeat(4,240px);gap:8px}} figure{{margin:0;background:#fff;border:1px solid #EFE6D8;border-radius:12px;padding:4px;text-align:center}}
figure svg{{display:block;margin:auto}} figcaption{{font-size:13px;line-height:1.35}}
</style><div id=w><div class=ref><h2>참고 그림 (사용자 제공)</h2><img src="{ref}"></div><div><h2>코드 그림 (src/ria.js)</h2><div class=grid>{cells}</div></div></div>"""


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
            if REF.exists():
                tmp = OUT / "_compare.html"
                tmp.write_text(compare_html(d), encoding="utf-8")
                try:
                    pg.goto(tmp.as_uri())
                    pg.wait_for_load_state("load")
                    pg.locator("#w").screenshot(path=str(OUT / "ria-compare.png"))
                finally:
                    tmp.unlink()
        finally:
            b.close()
    print("wrote", OUT / "ria-sheet.png", OUT / "ria-hero.png", OUT / "ria-compare.png")


if __name__ == "__main__":
    main()
