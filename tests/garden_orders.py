"""파이의 텃밭 주문 정답 검사 (v0.10 작업 3, 설계서 §6).

주문마다:
  1. 정답 프로그램(노드)이 그 장까지 열린 노드만으로 검사(validate)를 통과하고 코드가 만들어지는지
  2. 주문의 setup 텃밭에서 그 코드를 실제 엔진(src/py/runner.py run(farm=…))으로 돌림
  3. 판정은 src/garden/state.js(applyRun · deliver · buy)를 node로 불러 같은 규칙으로 — 주문이 끝나야 통과
또 data/garden.js의 CROPS가 runner의 성장 시간과 같은지 본다.

실행: python3 tests/garden_orders.py   (하나라도 실패하면 종료 코드 1)
"""

import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "src", "py"))

import runner  # noqa: E402

HELPER = os.path.join(ROOT, "tests", "garden_orders_helper.mjs")


def node(mode, payload=None):
    p = subprocess.run(["node", HELPER, mode], cwd=ROOT, input=None if payload is None else json.dumps(payload),
                       capture_output=True, text=True, encoding="utf-8", timeout=60)
    if p.returncode != 0:
        print(p.stderr)
        raise SystemExit("도우미 실패: " + mode)
    return json.loads(p.stdout)


def crops_match():
    js = node_eval('import("./data/garden.js").then(m => console.log(JSON.stringify(m.CROPS)))')
    want = {c: {"grow": runner.FARM_GROW[c], "fert": runner.FARM_GROW_FERTILIZED[c]} for c in runner.FARM_CROPS}
    ups = node_eval('import("./data/garden.js").then(m => console.log(JSON.stringify(m.UPGRADES.map(u => u.id))))')
    ok = js == want and runner.FARM_POTATO_SEED in ups and runner.FARM_FERTILIZER in ups
    return ok, js, want, ups


def node_eval(code):
    p = subprocess.run(["node", "--input-type=module", "-e", code], cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", timeout=60)
    if p.returncode != 0:
        print(p.stderr)
        raise SystemExit("node 실패")
    return json.loads(p.stdout)


def goal_text(g):
    return " ".join(f"{k}={v}" for k, v in g.items())


def main():
    fails = 0
    ok, js, want, ups = crops_match()
    if not ok:
        fails += 1
        print(f"FAIL 작물·성장 이름이 runner와 다름: data {js} / runner {want} / 성장 {ups}")
    else:
        print("ok   작물 성장 시간·성장 이름이 runner와 같음")

    orders = node("prepare")
    results = {}
    for o in orders:
        if o["errors"] or not o["hasRun"]:
            continue
        results[o["id"]] = runner.run(o["code"], "", [], farm=o["setup"])
    verdicts = {v["id"]: v for v in node("judge", {"results": results})}

    passed = 0
    for o in orders:
        v = verdicts[o["id"]]
        good = not o["errors"] and v["ok"]
        passed += good
        why = "; ".join(o["errors"]) if o["errors"] else v["detail"]
        print(f"{'ok  ' if good else 'FAIL'} {o['id']:<10} {o['need']}장 {o['title']} [{goal_text(o['goal'])}] — {why}")
    fails += len(orders) - passed
    print(f"주문 {passed}/{len(orders)} 통과")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
