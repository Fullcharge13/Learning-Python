"""영어 레슨 짝 시험 (v0.13.1~, 설계 docs/specs/2026-11-11-영어판-설계.md §3).

    python3 tests/lesson_parity.py            있는 영어 장(data/lessons/en/chN.js)만
    python3 tests/lesson_parity.py --full N   1~N장 영어가 모두 있어야 통과

1. 모양이 같다: 한국어 장과 같은 레슨·카드·문제 순서, 구조 칸(STRUCT_KEYS) 값이 같고, 배열 길이·객체 열쇠가 같다.
   글자 칸(그 밖의 문자열)만 다를 수 있다.
2. 영어 장의 모든 문자열에 한글이 없다.
3. 예제 코드의 실제 실행 결과·채점(정답 코드가 시험 통과 등)은 tests/content.py --lang en 이 본다(같은 점검기).
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
KO_DIR = os.path.join(ROOT, "data", "lessons")
EN_DIR = os.path.join(KO_DIR, "en")
HANGUL = re.compile(r"[가-힣ㄱ-ㅎㅏ-ㅣ]")
# 언어와 상관없이 같아야 하는 칸(채점·진도·잠금이 쓰는 값)
STRUCT_KEYS = {"id", "chapter", "isAdvanced", "isExam", "updated", "type", "concept", "answer", "public", "require",
               "min", "max", "kind", "status", "show_only", "task"}

NODE_LOAD = r"""
const [p] = process.argv.slice(1);
const m = await import("file://" + p);
console.log(JSON.stringify({ CHAPTER: m.CHAPTER, LESSONS: m.LESSONS, ADVANCED: m.ADVANCED || null, TEMPLATES: m.TEMPLATES || null }));
"""


def load(path):
    r = subprocess.run(["node", "--input-type=module", "-e", NODE_LOAD, path], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        raise AssertionError("could not load %s: %s" % (path, r.stderr[-400:]))
    return json.loads(r.stdout)


def compare(ko, en, path, errs):
    if isinstance(ko, dict):
        if not isinstance(en, dict):
            errs.append("%s: 객체가 아님" % path)
            return
        if set(ko) != set(en):
            errs.append("%s: 열쇠 다름 %s / %s" % (path, sorted(set(ko) - set(en)), sorted(set(en) - set(ko))))
        for k in ko:
            if k not in en:
                continue
            if k in STRUCT_KEYS and k != "task":
                if ko[k] != en[k]:
                    errs.append("%s.%s: 구조 값 다름 %r / %r" % (path, k, ko[k], en[k]))
                continue
            compare(ko[k], en[k], "%s.%s" % (path, k), errs)
    elif isinstance(ko, list):
        if not isinstance(en, list) or len(ko) != len(en):
            errs.append("%s: 배열 길이 다름 %s / %s" % (path, len(ko), len(en) if isinstance(en, list) else type(en).__name__))
            return
        for i, (a, b) in enumerate(zip(ko, en)):
            compare(a, b, "%s[%d]" % (path, i), errs)
    elif isinstance(ko, str):
        if not isinstance(en, str):
            errs.append("%s: 문자열이 아님" % path)
    elif ko != en:
        errs.append("%s: 값 다름 %r / %r" % (path, ko, en))


def hangul(o, path, errs):
    if isinstance(o, dict):
        for k, v in o.items():
            if HANGUL.search(k):
                errs.append("%s: 열쇠에 한글 %r" % (path, k))
            hangul(v, "%s.%s" % (path, k), errs)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            hangul(v, "%s[%d]" % (path, i), errs)
    elif isinstance(o, str) and HANGUL.search(o):
        errs.append("%s: 한글 %r" % (path, o[:60]))


def ko_chapters():
    return sorted(int(m.group(1)) for f in os.listdir(KO_DIR) for m in [re.match(r"^ch([1-9]\d*)\.js$", f)] if m)


def en_chapters():
    if not os.path.isdir(EN_DIR):
        return []
    return sorted(int(m.group(1)) for f in os.listdir(EN_DIR) for m in [re.match(r"^ch([1-9]\d*)\.js$", f)] if m)


def check_chapter(n):
    ko = load(os.path.join(KO_DIR, "ch%d.js" % n))
    en = load(os.path.join(EN_DIR, "ch%d.js" % n))
    errs = []
    compare(ko, en, "ch%d" % n, errs)
    hangul(en, "ch%d" % n, errs)
    return errs


def main(argv):
    full = None
    if "--full" in argv:
        full = int(argv[argv.index("--full") + 1])
    chs = en_chapters()
    fails = 0
    if "--ch" in argv:  # 장 하나만(번역하는 사람용)
        chs = [int(argv[argv.index("--ch") + 1])]
    elif sorted(chs) != ko_chapters():
        # v0.13.4: 모든 장이 영어다. 한국어 장을 새로 넣으면 영어도 같이 넣어야 한다(검토 M5)
        print("FAIL 영어 장 %r ≠ 한국어 장 %r" % (chs, ko_chapters()))
        fails += 1
    if full is not None and chs != list(range(1, full + 1)):
        print("FAIL --full %d: 영어 장 %r" % (full, chs))
        fails += 1
    for n in chs:
        if not os.path.exists(os.path.join(KO_DIR, "ch%d.js" % n)) or not os.path.exists(os.path.join(EN_DIR, "ch%d.js" % n)):
            fails += 1
            print("FAIL ch%d: 한국어나 영어 파일이 없음" % n)
            continue
        errs = check_chapter(n)
        if errs:
            fails += 1
            print("FAIL ch%d (%d)" % (n, len(errs)))
            for e in errs[:25]:
                print("   ", e)
        else:
            print("ok   ch%d" % n)
    print("lesson parity: %d chapter(s), %d failed" % (len(chs), fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
