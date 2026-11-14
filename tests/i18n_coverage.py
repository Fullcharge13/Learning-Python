"""영어판 문구 빠짐 시험 (v0.13.0, 설계 docs/specs/2026-11-11-영어판-설계.md §7).

    python3 tests/i18n_coverage.py

1. 코드에 t``/tk 없이 남은 한글 화면 문구가 없다(tools/i18n_scan.mjs). 텃밭 파일도 v0.13.5부터 검사한다.
2. 코드가 쓰는 모든 열쇠가 영어 표(i18n/en/ui*.json)에 있고, 영어 표에 쓰이지 않는 열쇠가 없다.
3. 데이터 표(대사·배지·의상·퀘스트·개념·오류)의 모든 칸이 i18n/en/data.json에 있고 남는 열쇠가 없다.
4. 영어 문구에 한글이 없다.
5. 값 자리 수가 맞다: 열쇠의 {} 수 = 영어의 {} 수(또는 {0}…{n-1} 번호 자리), 데이터 표는 {name} 같은 이름 자리가 같다.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
EN = os.path.join(ROOT, "i18n", "en")
HANGUL = re.compile(r"[가-힣ㄱ-ㅎㅏ-ㅣ]")

NODE_DATA_KEYS = r"""
const imp = (p) => import("file://" + process.cwd() + "/" + p);
const out = {};
const { LINES, FALLBACK_LINE } = await imp("data/lines.js");
for (const [sit, arr] of Object.entries(LINES)) arr.forEach((l, i) => { out[`line.${sit}.${i}`] = l.text; });
out["line._fallback.0"] = FALLBACK_LINE.text;
const { BADGES } = await imp("data/badges.js");
for (const b of BADGES) { out[`badge.${b.id}.name`] = b.name; out[`badge.${b.id}.desc`] = b.desc; }
const { OUTFITS } = await imp("data/outfits.js");
for (const o of OUTFITS) for (const f of ["short", "name", "desc"]) out[`outfit.${o.id}.${f}`] = o[f];
const { QUESTS } = await imp("data/quests.js");
for (const q of QUESTS) out[`quest.${q.id}.name`] = q.name;
const { CONCEPTS } = await imp("data/concepts.js");
for (const c of CONCEPTS) out[`concept.${c.id}.name`] = c.name;
const { ERRORS } = await imp("data/errors.js");
for (const [k, e] of Object.entries(ERRORS)) for (const f of ["title", "body", "detective"]) if (typeof e[f] === "string") out[`error.${k}.${f}`] = e[f];
// v0.13.5 텃밭: 주문 제목·글·쪽지, 성장 이름, 씨앗 봉투, 오늘의 쪽지(파일 이름은 안쪽 이름)
const G = await imp("data/garden.js");
for (const o of G.ORDERS) {
  out[`garden.order.${o.id}.title`] = o.title;
  out[`garden.order.${o.id}.text`] = o.text;
  if (o.note) out[`garden.order.${o.id}.note`] = o.note.text;
}
for (const u of G.UPGRADES) out[`garden.upgrade.${u.id}.label`] = u.label;
out["garden.seedpack.label"] = G.SEED_PACK.label;
for (const [f, list] of Object.entries(G.DAILY_NOTES)) list.forEach((s, i) => { out[`garden.note.${f}.${i}`] = s; });
// v0.15 경비실: 사건 글과 시도 「왜?」 설명
const GD = await imp("data/guard.js");
for (const g of GD.INCIDENTS) {
  for (const f of ["title", "brief", "ria", "concept", "crowIntro", "crowLose"]) out[`guard.${g.id}.${f}`] = g[f];
  g.tries.forEach((t, i) => { out[`guard.${g.id}.why.${i}`] = t.why; });
  // v0.20.0 응용 사건 카드(alias는 이미 영어라 열쇠 없음)
  if (g.file) {
    for (const f of ["attack", "real", "todo"]) out[`guard.${g.id}.file.${f}`] = g.file[f];
    g.file.search.forEach((s, i) => { out[`guard.${g.id}.file.search.${i}`] = s; });
  }
}
console.log(JSON.stringify(out));
"""


def load(name):
    with open(os.path.join(EN, name), encoding="utf-8") as f:
        return json.load(f)


def ui_table():
    ui = {}
    for f in sorted(os.listdir(EN)):
        if f.startswith("ui") and f.endswith(".json"):
            ui.update(load(f))
    return ui


def scan():
    r = subprocess.run(["node", "tools/i18n_scan.mjs", "--json"], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def data_keys():
    r = subprocess.run(["node", "--input-type=module", "-e", NODE_DATA_KEYS], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def slots(s):
    return re.findall(r"\{(\d*)\}", s)


def test_no_raw_korean_in_code():
    raw = scan()["raw"]
    assert not raw, "\n".join("%s:%s %s" % (x["file"], x["line"], x["text"][:60]) for x in raw[:30])


def test_ui_keys_match():
    keys = set(scan()["keys"])
    ui = ui_table()
    missing = sorted(keys - set(ui))
    extra = sorted(set(ui) - keys)
    assert not missing, "영어 표에 없는 열쇠 %d개: %r" % (len(missing), missing[:20])
    assert not extra, "쓰이지 않는 영어 열쇠 %d개: %r" % (len(extra), extra[:20])


def test_ui_values():
    for k, v in ui_table().items():
        assert isinstance(v, str) and v.strip(), k
        assert not HANGUL.search(v), (k, v)
        n = k.count("{}")
        got = slots(v)
        nums = [int(x) for x in got if x != ""]
        if nums:  # 번호 자리({0}{1})를 쓰면 번호 없는 {}와 섞지 않는다. 한국어 조사 자리처럼 영어가 안 쓰는 값은 빠져도 됨
            assert "" not in got, "번호 자리와 {} 섞임: %r → %r" % (k, v)
            assert set(nums) <= set(range(n)), "번호 자리 범위 밖: %r → %r" % (k, v)
        else:
            assert len(got) == n, "값 자리 수 다름: %r → %r" % (k, v)


def test_data_keys_match():
    ko = data_keys()
    en = load("data.json")
    missing = sorted(set(ko) - set(en))
    extra = sorted(set(en) - set(ko))
    assert not missing, "data.json에 없는 열쇠 %d개: %r" % (len(missing), missing[:20])
    assert not extra, "data.json에 남는 열쇠: %r" % extra[:20]
    for k, v in en.items():
        assert isinstance(v, str) and v.strip() and not HANGUL.search(v), (k, v)
        names = lambda s: sorted(re.findall(r"\{([a-z]+)\}", s))
        assert names(v) == names(ko[k]), "이름 자리 다름 %s: %r / %r" % (k, ko[k], v)
        if "{name}" in v:
            assert v.startswith("{name}, ") and v.count("{name}") == 1, (k, v)


def test_error_variant_keys():
    # v0.16.1: ERROR_VARIANTS의 key마다 한국어 항목(ERRORS)과 영어 title·body·detective가 있다
    r = subprocess.run(["node", "--input-type=module", "-e",
                        'const m = await import("file://" + process.cwd() + "/data/errors.js");'
                        'console.log(JSON.stringify({ v: m.ERROR_VARIANTS, e: Object.keys(m.ERRORS) }));'],
                       cwd=ROOT, capture_output=True, text=True, check=True)
    d = json.loads(r.stdout)
    en = load("data.json")
    assert len(d["v"]) == 9, d["v"]
    for v in d["v"]:
        assert v["key"] in d["e"], v
        for f in ("title", "body", "detective"):
            assert "error.%s.%s" % (v["key"], f) in en, (v["key"], f)


def main():
    fails = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("ok  ", name)
            except AssertionError as e:
                fails += 1
                print("FAIL", name, "-", str(e)[:1500])
    print("i18n coverage: %d failed" % fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
