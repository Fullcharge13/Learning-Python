#!/usr/bin/env python3
"""README.md를 게임 데이터에서 자동으로 만든다 (계획 작업 13).

    python3 tools/readme_gen.py           # README.md를 새로 씀
    python3 tools/readme_gen.py --check   # README.md가 데이터와 어긋나면 실패(종료 코드 1)

읽는 것 (node로 ES 모듈을 불러 JSON으로 꺼냄)
- data/lessons/ch1~3.js  레슨 표
- data/concepts.js       개념 이름
- data/quests.js         일일 퀘스트
- data/badges.js         배지
- data/outfits.js        의상(가격·얻는 법)
- src/ria.js             의상·표정 한국어 이름(그림 시트 설명)
- src/app.js             게임 안 버전 표시(VERSION)
- build.py               Pyodide 판 번호, 크기 상한

README.md는 손으로 고치지 않는다. 문장을 바꾸려면 이 파일을 고치고 다시 실행한다.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
README = os.path.join(ROOT, "README.md")

NODE_SCRIPT = r"""
const root = process.argv[1];
const imp = (p) => import(new URL(p, root));
const chapters = [];
const fs = await import("node:fs");
const nums = fs.readdirSync(new URL("data/lessons/", root))
  .map((f) => /^ch(\d+)\.js$/.exec(f)).filter(Boolean).map((m) => +m[1]).sort((a, b) => a - b);
for (const n of nums) {
  const m = await imp("data/lessons/ch" + n + ".js");
  chapters.push({ chapter: m.CHAPTER, lessons: m.LESSONS });
}
const { CONCEPTS } = await imp("data/concepts.js");
const { QUESTS } = await imp("data/quests.js");
const { BADGES } = await imp("data/badges.js");
const { OUTFITS } = await imp("data/outfits.js");
const ria = await imp("src/ria.js");
console.log(JSON.stringify({ chapters, CONCEPTS, QUESTS, BADGES, OUTFITS,
  outfitKo: ria.OUTFIT_KO, faceKo: ria.FACE_KO, faces: ria.FACE_IDS }));
"""

TYPE_KO = {"choice": "객관식", "blank": "빈칸", "order": "순서", "write": "직접 작성", "check": "이해도 확인"}

UNLOCK_KO = {"start": "처음부터 입고 있음", "streak30": "30일 연속 기록 보상 (판매 안 함)"}


def load_data():
    root_url = "file://" + ROOT.rstrip("/") + "/"
    out = subprocess.run(["node", "--input-type=module", "-e", NODE_SCRIPT, root_url],
                         check=True, capture_output=True, text=True, cwd=ROOT)
    return json.loads(out.stdout)


def read_const(path, pattern):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        m = re.search(pattern, f.read())
    if not m:
        raise SystemExit(f"readme_gen: {path}에서 {pattern!r}를 찾지 못함")
    return m.group(1)


def cell(text):
    """표 칸 안에서 줄바꿈과 | 를 안전하게 바꾼다."""
    text = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return text.replace("\n", " / ").replace("|", "\\|").strip()


def first_line(text):
    return text.split("\n", 1)[0].strip()


def build(d):
    version = read_const("src/app.js", r'export const VERSION = "([^"]+)"')
    pyodide = read_const("build.py", r'PYODIDE_VERSION = "([^"]+)"')
    max_kb = int(read_const("build.py", r"MAX_RAW = (\d+) \* 1024"))
    concept_name = {c["id"]: c["name"] for c in d["CONCEPTS"]}

    lessons = [l for ch in d["chapters"] for l in ch["lessons"]]
    n_lessons = len(lessons)
    n_badges = len(d["BADGES"])
    n_outfits = len(d["OUTFITS"])
    n_quests = len(d["QUESTS"])
    n_items = sum(len(l["items"]) for l in lessons)

    L = []
    w = L.append
    w("<!-- 이 파일은 tools/readme_gen.py가 data/ 표에서 자동으로 만든다. 손으로 고치지 말 것. -->")
    w(f"# 리아와 파이썬! {version}")
    w("")
    w("리아 교수와 하루 5~10분, 아이폰 브라우저에서 Python 기초(출력·변수·조건문)를 "
      "터치 문제와 직접 코드 작성으로 익히는 듀오링고식 학습 웹앱이에요.")
    w("")
    w('<p align="center"><img src="docs/img/ria-hero.png" alt="기본 의상을 입고 미소 짓는 리아 교수" width="280"></p>')
    w("")
    w(f"- 판: **{version}** (게임 안 버전 표시, `LOG.md`의 판 번호와 같음)")
    w(f"- 내용: {len(d['chapters'])}장 · 레슨 {n_lessons}개 · 문제 {n_items}개 · 일일 퀘스트 {n_quests}종 · "
      f"배지 {n_badges}개 · 리아 교수 의상 {n_outfits}벌 · 표정 {len(d['faces'])}가지")
    w("- 서버 없음: Python 실행은 브라우저 안의 **Pyodide**(브라우저에서 돌아가는 Python) "
      f"`{pyodide}`이 맡고, 진도는 휴대폰 안(`localStorage`, 브라우저 저장 칸)에 저장돼요.")
    w("- 이 게임은 듀오링고의 학습 방식(연속 기록, 짧은 레슨, 퀘스트)만 참고했고, 듀오링고의 이름·로고·캐릭터는 쓰지 않아요.")
    w("")

    # ---- 실행 방법
    w("## 실행 방법")
    w("")
    w("처음 한 번은 `npm install`로 개발 도구(CodeMirror 입력창, esbuild 묶음 도구, 시험용 Pyodide)를 받아요.")
    w("")
    w("| 하고 싶은 일 | 명령 | 설명 |")
    w("|---|---|---|")
    w("| 개발하면서 열어 보기 | `python3 tools/dev.py` | 코드를 묶어 `http://127.0.0.1:8765/dev/`로 열어 줘요 |")
    w(f"| 배포 파일 만들기 | `python3 build.py` | `dist/`에 `index.html`(앱과 레슨 목록) + `lessons/`(장마다 문제 파일) + `manifest.webmanifest` + `sw.js` + 아이콘. **`lessons/` 폴더까지 함께** "
      f"이 폴더를 그대로 웹에 올리면 돼요 (Pyodide 제외 {max_kb}KB 이하) |")
    w("| README 다시 만들기 | `python3 tools/readme_gen.py` | 데이터 표를 바꾼 뒤 실행. `--check`는 어긋남만 검사 |")
    w("| 리아 그림 시트 다시 뽑기 | `python3 tools/ria_sheet.py` | `docs/img/ria-sheet.png`, `ria-hero.png` |")
    w("")
    w("**시험 (확인 도구)**")
    w("")
    w("| 명령 | 확인하는 것 |")
    w("|---|---|")
    w("| `npm test` | 규칙 단위 시험: 저장·옛 저장 옮기기, 연속 기록 날짜 계산, XP·바이트, 퀘스트·배지·상점, 채점 비교, 대사, 그림 |")
    w("| `python3 -m pytest tests/py -q` | 채점기(`runner.py`)를 일반 Python으로 시험: `input()` 값, 오류 줄 번호, 코드 구조 조건 |")
    w(f"| `python3 tests/content.py --full {len(d['chapters'])}` | 레슨 {n_lessons}개 전체 점검: 정답 코드가 시험을 통과하는지, 시작 코드는 통과하지 않는지, 힌트 4개 등 |")
    w("| `python3 tests/grader_browser.py` | 실제 브라우저(Chromium) 안 Pyodide 작업자: 실행, 입력, 3초 시간 초과 뒤 재시작 |")
    w("| `python3 tests/build_test.py` | 배포 파일: 한 장인지, 크기 상한, 버전 표시, 오프라인 열기 |")
    w("| `python3 tests/flow.py` | 아이폰 17 크기 화면 순회: 넘침·콘솔 오류·터치 크기·첫 레슨 끝까지·옛 저장 |")
    w("| `node tests/sim/economy.js` | 가상 학습자 30일 × 12판 바이트 경제 시뮬레이션(중앙값 표) |")
    w("")
    w("시험 중 브라우저를 쓰는 것은 Playwright(브라우저를 자동으로 조작하는 도구)의 Chromium이에요. "
      "사파리(WebKit)로는 시험하지 못해서, 실제 아이폰에서 확인할 목록을 `docs/device-checklist.md`에 따로 두었어요.")
    w("")

    # ---- 구조
    w("## 폴더 구조")
    w("")
    w("```")
    structure = [
        ("src/", "화면·규칙 코드, 리아 교수 그림(SVG), 소리, Pyodide 작업자"),
        ("src/py/runner.py", "학습자 코드를 실행·채점하는 Python 코드(Pyodide 안에서 돎)"),
        ("data/lessons/", f"1~{len(d['chapters'])}장 레슨 표 (ch1.js … ch{len(d['chapters'])}.js)"),
        ("data/", "개념·대사·퀘스트·배지·의상·오류 설명 표"),
        ("build.py", "모든 것을 HTML 한 장(dist/index.html)으로 합치기"),
        ("tools/", "개발 서버, README 생성, 그림 시트·아이콘 만들기"),
        ("tests/", "시험 도구 (unit, py, sim, 브라우저 시험)"),
        ("docs/specs/", "설계서"),
        ("docs/plans/", "계획서와 실행 기록(ledger)"),
        ("docs/img/", "README용 그림 (스크립트로 뽑음)"),
        ("docs/device-checklist.md", "실제 아이폰에서 확인할 목록"),
        ("README.md LOG.md", "설명서(자동 생성)와 개발 일지"),
    ]
    width = max(len(a) for a, _ in structure) + 2
    for a, b in structure:
        w(f"  {a.ljust(width)}{b}")
    w("```")
    w("")
    w("게임 내용(레슨·퀘스트·배지·의상)은 모두 `data/` 표에 있어요. 표를 고치면 화면 코드는 그대로 두고 내용만 바뀌어요.")
    w("")

    # ---- 레슨
    w(f"## 레슨 {n_lessons}개")
    w("")
    w("한 레슨: 학습 목표 → 개념 카드 1~2장 → 터치 문제(객관식·빈칸·순서) → 직접 작성 1문제 → 이해도 확인 → "
      "틀린 문제 다시 풀기 → 완료 요약. 레슨은 차례로 열려요.")
    w("")
    for ch in d["chapters"]:
        c = ch["chapter"]
        w(f"### {c['id']}장. {c['title']}")
        w("")
        w("| 레슨 | 제목 | 학습 목표 | 직접 작성 과제 | 핵심 개념 | 문제 |")
        w("|---|---|---|---|---|---|")
        for l in ch["lessons"]:
            writes = [i for i in l["items"] if i["type"] == "write"]
            task = "<br>".join(cell(first_line(i["task"])) for i in writes) or "-"
            concepts = []
            for i in l["items"]:
                name = concept_name.get(i["concept"], i["concept"])
                if name not in concepts:
                    concepts.append(name)
            counts = {}
            for i in l["items"]:
                counts[i["type"]] = counts.get(i["type"], 0) + 1
            kinds = " · ".join(f"{TYPE_KO.get(k, k)} {v}" for k, v in counts.items())
            title = cell(l["title"]) + (" **(장 평가)**" if l.get("isExam") else "")
            w(f"| {l['id']} | {title} | {cell(l['goal'])} | {task} | {cell(', '.join(concepts))} | {kinds} |")
        w("")

    # ---- 게임 장치 요약
    w("## 게임 장치")
    w("")
    w("- **XP**(경험치): 레슨 첫 완료 10 (장 평가 30) + 실수 없음 5 + 힌트 없이 직접 작성 통과 5. "
      "다시 하기는 10 (장 평가 15), 복습 한 판 10.")
    w("- **하루 목표와 연속 기록**: 하루 목표 10·20·30 XP(기본 20)를 채운 날마다 +1. "
      "기록 보호권(200바이트, 최대 2개)이 빠진 날을 메워 줘요. 7·30·100일에 축하와 보상.")
    w("- **바이트**: 게임 속 돈. 레슨 첫 완료 10 + 실수 없음 5, 퀘스트, 보물상자 10, 연속 7일 50. 의상과 보호권을 사요.")
    w("")
    w(f"### 일일 퀘스트 ({n_quests}종 중 매일 3개)")
    w("")
    w("날짜로 정해지는 뽑기라 같은 날에는 언제 열어도 같은 퀘스트가 나와요. 3개를 다 끝내면 보물상자(+10바이트).")
    w("")
    w("| 퀘스트 | 목표 | 보상(바이트) |")
    w("|---|---|---|")
    for q in d["QUESTS"]:
        note = " (복습할 문제가 없는 날은 나오지 않음)" if q["key"] == "review_item" else ""
        w(f"| {cell(q['name'])}{note} | {q['goal']} | {q['reward']} |")
    w("")
    w(f"### 배지 {n_badges}개")
    w("")
    w("얻기 전에는 회색 실루엣과 조건 문구가 보여요.")
    w("")
    w("| 배지 | 얻는 조건 |")
    w("|---|---|")
    for b in d["BADGES"]:
        w(f"| {cell(b['name'])} | {cell(b['desc'])} |")
    w("")
    w(f"### 리아 교수 의상 {n_outfits}벌")
    w("")
    w("| 의상 | 얻는 법 | 의상실 설명 |")
    w("|---|---|---|")
    for o in d["OUTFITS"]:
        if o.get("price") is not None:
            how = f"{o['price']}바이트"
        else:
            how = UNLOCK_KO.get(o.get("unlock"), cell(o.get("unlock", "-")))
        extra = " · 입으면 오류 설명이 탐정 말투로 바뀜" if o.get("voice") == "detective" else ""
        w(f"| {cell(o['name'])} | {how}{extra} | {cell(o.get('desc', ''))} |")
    w("")

    # ---- 리아 교수
    w("## 리아 교수 (문리아)")
    w("")
    w("컴퓨터공학 박사이자 현업 엔지니어 출신이라는 설정의 **가상 인물**이에요. 짙은 남색 올림머리에 청록 브릿지 한 줄, "
      "뱀 브로치가 특징이고, 「~해요」체로 차분하고 가볍게 장난치는 선배 교수 말투를 써요. 오류는 「단서」라고 불러요.")
    w("")
    faces = " · ".join(d["faceKo"][f] for f in d["faces"])
    w(f"그림은 이미지 파일 없이 코드(SVG)로 그려서, 의상 {n_outfits}벌 × 표정 {len(d['faces'])}가지({faces})를 자유롭게 조합해요.")
    w("")
    w(f'<p align="center"><img src="docs/img/ria-sheet.png" alt="리아 교수 의상 {n_outfits}벌 × 표정 {len(d["faces"])}가지 시트" width="100%"></p>')
    w("")
    w("홈 화면 아이콘:")
    w("")
    w('<img src="docs/img/icon-180.png" alt="앱 아이콘" width="72"> '
      '<img src="docs/img/icon-maskable-512.png" alt="안드로이드용 둥근 아이콘" width="72">')
    w("")

    # ---- 출처
    w("## 출처와 독창성")
    w("")
    w("- **리아 교수**는 이 게임을 위해 새로 만든 캐릭터예요. 실존 인물의 이름·외모·경력을 따오지 않았어요.")
    w("- **레슨 문장과 예제**는 모두 새로 썼어요. 아래 두 자료는 **장 순서와 예제 주제를 정하는 참고로만** 썼고, 문장을 옮기지 않았어요.")
    w("  - Python Tutorial 3.7 — Python Software Foundation (PSF)")
    w("  - Thomas Weise, 『Programming with Python』")
    w("- 쓰는 도구: Pyodide (MPL-2.0), CodeMirror 6 (MIT), esbuild (MIT, 빌드 때만). 소리는 Web Audio로 합성해 음원 파일이 없어요.")
    w("")

    # ---- 한계
    w("## 알려진 한계")
    w("")
    limits = [
        "실제 아이폰 사파리에서는 아직 확인하지 못했어요. 시험은 Chromium에 아이폰 17 화면 설정을 입혀서 했어요 → `docs/device-checklist.md`.",
        f"Pyodide는 처음 한 번 인터넷(jsDelivr, 공개 파일 배달망)에서 받아요(`pyodide@{pyodide}`). 이 개발 환경에서는 그 주소에 접속해 보지 못했어요.",
        "사파리는 홈 화면에 추가하지 않은 웹사이트의 저장을 7일 동안 방문이 없으면 지울 수 있어요. 첫 레슨 뒤 「홈 화면에 추가」를 안내하고, 설정에 저장 내보내기·가져오기를 두었어요.",
        "서버가 없어 「숨은 시험」도 페이지 안에 들어 있어요. 진짜로 숨기는 것은 v0.2(서버)에서 해요.",
        "코드 구조 검사(`ast`, Python이 코드를 문법 나무로 읽는 기능)로는 `elif`·`else`를 꼭 쓰게 강제할 수 없어요. 1-4(주석) 과제는 줄을 지워도 통과해요.",
        "레슨을 하던 중 앱을 닫으면 그 레슨은 처음부터 다시 해요(레슨 중간은 저장하지 않음).",
        "PC에서도 열리지만 휴대폰 폭 그대로 가운데에 놓여요.",
        "리아 교수의 외모와 대사 말투는 사용자 확인을 기다리고 있어요.",
    ]
    for x in limits:
        w(f"- {x}")
    w("")
    w("개발 과정과 결정 기록은 `LOG.md`, 설계는 `docs/specs/`, 작업 계획과 판정 기록은 `docs/plans/`에 있어요.")
    w("")
    return "\n".join(L), {"lessons": n_lessons, "badges": n_badges, "outfits": n_outfits,
                          "quests": n_quests, "items": n_items, "version": version}


def main():
    args = sys.argv[1:]
    unknown = [x for x in args if x != "--check"]
    if unknown:
        print("사용법: python3 tools/readme_gen.py [--check]  (알 수 없는 인자: %s)" % " ".join(unknown))
        sys.exit(2)
    check = "--check" in args
    text, n = build(load_data())
    summary = (f"레슨 {n['lessons']} · 문제 {n['items']} · 퀘스트 {n['quests']} · "
               f"배지 {n['badges']} · 의상 {n['outfits']} · 판 {n['version']}")
    if check:
        try:
            with open(README, encoding="utf-8") as f:
                current = f.read()
        except OSError:
            current = None
        if current != text:
            print("README.md가 데이터와 어긋나요. `python3 tools/readme_gen.py`로 다시 만드세요.")
            if current is not None:
                import difflib
                diff = list(difflib.unified_diff(current.splitlines(), text.splitlines(),
                                                 "README.md", "생성 결과", lineterm="", n=0))
                print("\n".join(diff[:40]))
            sys.exit(1)
        print(f"README.md 최신 상태 ({summary})")
        return
    with open(README, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"README.md 생성 ({summary})")


if __name__ == "__main__":
    main()
