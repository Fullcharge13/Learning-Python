"""홈 화면 앱 아이콘 PNG를 만든다 (작업 10).

    python3 tools/icon.py                      # dist/icons/ 에 씀
    python3 tools/icon.py --update-docs-icons  # docs/img/ 복사본도 갱신
    python3 tools/icon.py --out DIR            # DIR/icons/ 에 씀

- 리아 교수 얼굴(src/ria.js의 riaSVG, 기본 의상·기쁨)을 머리 부분만 잘라 쓴다. 그림 파일 없이 코드로 그린다.
- 배경: 크림색 종이(--paper) 위에 청록(--teal) 원.
  - icon-180 / icon-192 / icon-512: 모서리가 둥근 사각형(바깥은 투명)
  - apple-touch-icon(180): 꽉 찬 사각형(iOS가 모서리를 직접 깎고, 투명한 곳은 검게 칠하기 때문)
  - icon-maskable-512: 꽉 찬 사각형 + 그림을 가운데 80% 안전 영역 안에 둠(안드로이드 마스크용)
- SVG 문자열은 node로 src/ria.js를 불러 얻고, Playwright Chromium으로 찍는다.
"""
import argparse
import json
import pathlib
import shutil
import subprocess

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAPER = "#FBF6EA"   # style.css --paper
TEAL = "#1F9E93"    # style.css --teal
TEAL_SOFT = "#DDF1EC"
HEAD_VIEWBOX = "25 6 150 150"  # riaSVG 좌표(200×260)에서 머리·올림머리·어깨 윗부분

NODE_SCRIPT = """
const m = await import(process.argv[1]);
console.log(JSON.stringify(m.riaSVG({ outfit: 'basic', face: 'joy', size: 200 })));
"""

# 이름: (한 변 픽셀, 모양)
ICONS = {
    "icon-180.png": (180, "round"),
    "icon-192.png": (192, "round"),
    "icon-512.png": (512, "round"),
    "apple-touch-icon.png": (180, "full"),
    "icon-maskable-512.png": (512, "maskable"),
}
DOC_COPIES = ("icon-180.png", "icon-512.png", "icon-maskable-512.png")


def ria_head_svg():
    url = (ROOT / "src" / "ria.js").as_uri()
    out = subprocess.run(["node", "--input-type=module", "-e", NODE_SCRIPT, url],
                         check=True, capture_output=True, text=True, cwd=ROOT)
    svg = json.loads(out.stdout)
    # 보기 상자를 머리 부분으로 바꾸고 크기는 감싼 상자를 따르게 한다.
    svg = svg.replace('viewBox="0 0 200 260"', 'viewBox="%s"' % HEAD_VIEWBOX, 1)
    svg = svg.replace('width="200" height="260"', 'width="100%" height="100%"', 1)
    assert HEAD_VIEWBOX in svg and 'width="100%"' in svg, "riaSVG output shape changed"
    return svg


def icon_html(svg, px, shape):
    radius = "22%" if shape == "round" else "0"
    # 원과 얼굴의 크기: 마스크용은 안전 영역(지름 80%) 안에 들어가게 작게
    disc = 0.70 if shape == "maskable" else 0.84
    face = 0.66 if shape == "maskable" else 0.80
    return f"""<!doctype html><meta charset=utf-8><style>
html,body{{margin:0;background:transparent}}
#i{{width:{px}px;height:{px}px;border-radius:{radius};background:{PAPER};position:relative;overflow:hidden;
  background-image:linear-gradient(rgba(34,48,74,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(34,48,74,.06) 1px,transparent 1px);
  background-size:{px / 12:.2f}px {px / 12:.2f}px}}
#d{{position:absolute;left:50%;top:50%;width:{disc * 100}%;height:{disc * 100}%;transform:translate(-50%,-50%);
  border-radius:50%;background:{TEAL_SOFT};box-shadow:inset 0 0 0 {px * 0.028:.2f}px {TEAL}}}
#f{{position:absolute;left:50%;top:52%;width:{face * 100}%;height:{face * 100}%;transform:translate(-50%,-50%)}}
#f svg{{display:block}}
</style><div id=i><div id=d></div><div id=f>{svg}</div></div>"""


def render(out_dir, update_docs=False):
    out_dir = pathlib.Path(out_dir)
    icons = out_dir / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    svg = ria_head_svg()
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        try:
            for name, (px, shape) in ICONS.items():
                pg = b.new_page(viewport={"width": px, "height": px}, device_scale_factor=1)
                pg.set_content(icon_html(svg, px, shape))
                pg.locator("#i").screenshot(path=str(icons / name), omit_background=(shape == "round"))
                pg.close()
        finally:
            b.close()
    if update_docs:
        docs = ROOT / "docs" / "img"
        docs.mkdir(parents=True, exist_ok=True)
        for name in DOC_COPIES:
            shutil.copy(icons / name, docs / name)
    return sorted(p.name for p in icons.iterdir())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "dist"))
    ap.add_argument("--update-docs-icons", action="store_true", help="docs/img/ 복사본도 갱신")
    a = ap.parse_args()
    names = render(a.out, update_docs=a.update_docs_icons)
    print("아이콘 %d개: %s" % (len(names), ", ".join(names)))


if __name__ == "__main__":
    main()
