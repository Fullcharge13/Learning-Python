"""경비실 해커 「크로우」 원본 시트(art/crow_sheet.svg)를 앱 데이터(data/crow.js)로 바꾼다 (v0.15.0).

    python3 tools/crow_import.py           # data/crow.js 쓰기
    python3 tools/crow_import.py --check   # 쓰지 않고 어긋남만 알림(어긋나면 1로 끝남)

- 시트: 6칸. 칸마다 <g id="crow-<pose>" stroke=..> 안에 그림 조각이 깊이 1로 들어 있다(좌표 0~200).
  칸 배경 네모와 이름표(<text>)는 칸 바깥에 있어 버려진다.
- 6포즈는 몸통·뿔·꼬리 같은 조각을 서로 나눠 쓴다. 겹치는 조각을 한 번만 담고(pieces) 포즈마다 조각 순서(poses)를 적는다.
- 데이터로 다시 조립한 포즈가 원본 칸 안쪽과 글자 하나까지 같아야 한다(tests/py/test_crow_import.py).
- 조각 나누기는 tools/ria_set2_import.py와 같은 방식이다.
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SHEET = os.path.join(ROOT, "art", "crow_sheet.svg")
DATA = os.path.join(ROOT, "data", "crow.js")
NS = "http://www.w3.org/2000/svg"
POSES = ["wave", "wait", "shock", "loot", "cry", "rank"]
VIEWBOX = "0 0 200 200"
HEAD = "// 자동 생성: tools/crow_import.py — 손으로 고치지 말 것. 경비실 크로우 그림 (원본 art/crow_sheet.svg)\n"
SEP = "~"  # 조각 사이 구분(조각 안에 없는 글자)


def _str(el):
    s = ET.tostring(el, encoding="unicode", short_empty_elements=True)
    # ElementTree는 빈 태그 끝에 빈칸(" />")을 넣는다. 원본 시트처럼 "/>"로 되돌린다
    return s.replace(' xmlns="%s"' % NS, "").replace("ns0:", "").replace(" />", "/>")


def _groups(path):
    ET.register_namespace("", NS)
    root = ET.parse(path).getroot()
    found = {}
    for g in root.iter("{%s}g" % NS):
        gid = g.get("id") or ""
        if gid.startswith("crow-"):
            found[gid[5:]] = g
    assert list(found) == POSES, list(found)
    return found


def poses_from_sheet(path=SHEET):
    """{'wave': '<조각>…', …} — 칸마다 <g id="crow-<pose>"> 안쪽 글자(앱 순서)."""
    out = {}
    for k, g in _groups(path).items():
        s = _str(g)
        out[k] = re.match(r"<g [^>]*>(.*)</g>$", s, re.S).group(1)
    return out


def head_from_sheet(path=SHEET):
    """칸을 감싸는 <g …>(id 뺌). 6칸이 모두 같아야 한다(선 색·굵기)."""
    heads = set()
    for g in _groups(path).values():
        attrs = "".join(' %s="%s"' % (k, v) for k, v in g.attrib.items() if k != "id")
        heads.add("<g%s>" % attrs)
    assert len(heads) == 1, heads
    return heads.pop()


def _split(inner):
    """깊이 1 조각들"""
    pieces, depth, cur = [], 0, ""
    for tok in re.findall(r"<[^>]+>|[^<]+", inner):
        cur += tok
        if tok.startswith("</"):
            depth -= 1
        elif tok.startswith("<") and not tok.endswith("/>"):
            depth += 1
        if depth == 0:
            pieces.append(cur)
            cur = ""
    assert depth == 0 and cur == "", "unbalanced"
    return pieces


def pack(poses, head):
    pieces, idx, out = [], {}, {}
    for k, inner in poses.items():
        row = []
        for p in _split(inner):
            if p not in idx:
                idx[p] = len(pieces)
                pieces.append(p)
            row.append(idx[p])
        out[k] = row
    return {"head": head, "pieces": pieces, "poses": out}


def render_data(data):
    """조각은 작은따옴표 문자열 하나(따옴표 탈출 없음)를 ~로 나눈다. 포즈는 조각 번호 배열."""
    for x in data["pieces"] + [data["head"]]:
        assert "'" not in x and "\\" not in x and "\n" not in x and SEP not in x
    assert list(data["poses"]) == POSES
    poses = ", ".join("%s: %s" % (k, json.dumps(v, separators=(",", ":"))) for k, v in data["poses"].items())
    return "".join([
        HEAD,
        "const P = '%s';\n" % SEP.join(data["pieces"]),
        "export const CROW = { viewBox: %s, head: '%s', pieces: P.split(\"%s\"), poses: { %s } };\n"
        % (json.dumps(VIEWBOX), data["head"], SEP, poses),
    ])


def load_data(path=DATA):
    """render_data의 거꾸로(파이썬 시험용): {'head', 'pieces', 'poses'}"""
    with open(path, encoding="utf-8") as f:
        s = f.read()
    P = re.search(r"^const P = '([^']*)';$", s, re.M).group(1)
    head = re.search(r"head: '([^']*)'", s).group(1)
    poses = {k: json.loads(v) for k, v in re.findall(r"(\w+): (\[[0-9,]*\])", s)}
    return {"head": head, "pieces": P.split(SEP), "poses": poses}


def rebuild(data, pose):
    """포즈 안쪽 글자(감싸는 <g> 없이)"""
    return "".join(data["pieces"][i] for i in data["poses"][pose])


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    text = render_data(pack(poses_from_sheet(), head_from_sheet()))
    if "--check" in argv:
        try:
            with open(DATA, encoding="utf-8") as f:
                cur = f.read()
        except FileNotFoundError:
            cur = None
        if cur != text:
            print("data/crow.js가 art/crow_sheet.svg와 어긋남: python3 tools/crow_import.py 로 다시 만드세요")
            return 1
        print("data/crow.js OK")
        return 0
    with open(DATA, "w", encoding="utf-8") as f:
        f.write(text)
    print("data/crow.js", len(text.encode()), "bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
