"""#리아_이미지_세트2 원본 시트(art/ria_set2_sheet.svg)를 앱 데이터(data/ria_set2.js)로 바꾼다 (v0.12.4).

    python3 tools/ria_set2_import.py

- 시트: 의상 10줄 × 표정 8칸 = 80칸. 칸마다 <g transform="translate(..) scale(0.5) translate(-150 -30)"> 안에
  칸 배경 네모(<rect>) 하나 + 그림 묶음(<g stroke=..>) 하나가 들어 있다. 배경 네모는 버린다.
- 80칸은 몸·얼굴·소품 조각을 서로 나눠 쓴다. 겹치는 조각을 한 번만 담고(pieces) 칸마다 조각 순서(cells)를 적는다.
- 데이터로 다시 조립한 칸이 원본 칸과 글자 하나까지 같아야 한다(tests/py/test_ria_set2.py).
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SHEET = os.path.join(ROOT, "art", "ria_set2_sheet.svg")
DATA = os.path.join(ROOT, "data", "ria_set2.js")
NS = "http://www.w3.org/2000/svg"
OUTFITS = ["basic", "casual", "whitecoat", "hoodie", "gym", "chef", "explorer", "uniform", "wizard", "graduate"]
FACES = ["smile", "joy", "sparkle", "think", "surprise", "worry", "cheer", "wink"]
HEAD = "// 자동 생성: tools/ria_set2_import.py — 손으로 고치지 말 것. #리아_이미지_세트2 (원본 art/ria_set2_sheet.svg)\n"
PREFIX = "export const RIA_SET2 = "


def _str(el):
    s = ET.tostring(el, encoding="unicode", short_empty_elements=True)
    # ElementTree는 빈 태그 끝에 빈칸(" />")을 넣는다. 원본 시트처럼 "/>"로 되돌린다
    return s.replace(' xmlns="%s"' % NS, "").replace("ns0:", "").replace(" />", "/>")


def cells_from_sheet(path=SHEET):
    """{'basic_smile': '<g stroke=..>…</g>', …} 앱 순서(의상 줄 × 표정 칸)."""
    ET.register_namespace("", NS)
    root = ET.parse(path).getroot()
    groups = [k for k in root if k.tag == "{%s}g" % NS and (k.get("transform") or "").startswith("translate(")]
    assert len(groups) == 80, len(groups)
    out = {}
    for i, g in enumerate(groups):
        kids = list(g)
        assert len(kids) == 2 and kids[0].tag == "{%s}rect" % NS and kids[1].tag == "{%s}g" % NS, i
        out["%s_%s" % (OUTFITS[i // 8], FACES[i % 8])] = _str(kids[1])
    return out


def _split(cell):
    """'<g attrs>' + 깊이 1 조각들 + '</g>'"""
    m = re.match(r"(<g [^>]*>)(.*)</g>$", cell, re.S)
    head, body = m.group(1), m.group(2)
    pieces, depth, cur = [], 0, ""
    for tok in re.findall(r"<[^>]+>|[^<]+", body):
        cur += tok
        if tok.startswith("</"):
            depth -= 1
        elif tok.startswith("<") and not tok.endswith("/>"):
            depth += 1
        if depth == 0:
            pieces.append(cur)
            cur = ""
    assert depth == 0 and cur == "", "unbalanced"
    return head, pieces


def pack(cells):
    heads, pieces, idx, out = [], [], {}, {}
    for k, cell in cells.items():
        head, ps = _split(cell)
        if head not in heads:
            heads.append(head)
        row = [heads.index(head)]
        for p in ps:
            if p not in idx:
                idx[p] = len(pieces)
                pieces.append(p)
            row.append(idx[p])
        out[k] = row
    return {"heads": heads, "pieces": pieces, "cells": out}


SEP = "~"  # 조각 사이 구분(조각 안에 없는 글자)
B36 = "0123456789abcdefghijklmnopqrstuvwxyz"


def _b36(i):
    assert 0 <= i < 36 * 36, i
    return B36[i // 36] + B36[i % 36]


def render_data(data):
    """첫 파일 크기(상한 800KB) 때문에 짧게 담는다: 조각은 작은따옴표 문자열 하나(따옴표 탈출 없음),
    칸은 앱 순서대로 [머리 번호 + 조각 번호들]을 두 글자 36진수로 이어 쓴 글자(칸 사이 빈칸)."""
    pieces = data["pieces"]
    for x in pieces + data["heads"]:
        assert "'" not in x and "\\" not in x and "\n" not in x and SEP not in x
    keys = ["%s_%s" % (o, f) for o in OUTFITS for f in FACES]
    assert list(data["cells"]) == keys
    rows = " ".join("".join(_b36(i) for i in data["cells"][k]) for k in keys)
    js = [HEAD,
          "const O = %s, F = %s;\n" % (json.dumps(OUTFITS), json.dumps(FACES)),
          "const P = '%s';\n" % SEP.join(pieces),
          "const R = '%s';\n" % rows,
          "const d = (r) => r.match(/../g).map((x) => parseInt(x, 36));\n",
          "const K = O.flatMap((o) => F.map((f) => o + \"_\" + f));\n",
          PREFIX + "{ heads: %s, pieces: P.split(\"%s\"), cells: Object.fromEntries(R.split(\" \").map((r, i) => [K[i], d(r)])) };\n"
          % (json.dumps(data["heads"]), SEP)]
    return "".join(js)


def load_data(path=DATA):
    """render_data의 거꾸로(파이썬 시험용): {'heads', 'pieces', 'cells'}"""
    with open(path, encoding="utf-8") as f:
        s = f.read()
    P = re.search(r"^const P = '([^']*)';$", s, re.M).group(1)
    R = re.search(r"^const R = '([^']*)';$", s, re.M).group(1)
    heads = json.loads(re.search(r"heads: (\[.*?\]), pieces", s).group(1))
    keys = ["%s_%s" % (o, f) for o in OUTFITS for f in FACES]
    cells = {k: [int(r[j:j + 2], 36) for j in range(0, len(r), 2)] for k, r in zip(keys, R.split(" "))}
    return {"heads": heads, "pieces": P.split(SEP), "cells": cells}


def rebuild(data, key):
    row = data["cells"][key]
    return data["heads"][row[0]] + "".join(data["pieces"][i] for i in row[1:]) + "</g>"


def main():
    text = render_data(pack(cells_from_sheet()))
    with open(DATA, "w", encoding="utf-8") as f:
        f.write(text)
    print("data/ria_set2.js", len(text.encode()) // 1024, "KB")


if __name__ == "__main__":
    sys.exit(main())
