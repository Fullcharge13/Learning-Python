"""시험용 장 폴더 만들기: data/lessons를 복사하고, 고른 장에 시험 심화(tests/fixtures/advanced.js)를 끼운다.

    from fixtures.advanced_dir import make
    make(src_dir, dst_dir, chapters=(1,))   # dst_dir/ch1.js = 원래 ch1 + ADVANCED 3개(1-A1..1-A3)
    make(src_dir, dst_dir, chapters=(), updated={"1-2": "v0.7.1"})   # v0.7.1: 1-2에 updated 칸만 더함

원래 chN.js는 chN.orig.mjs로 옮겨 그대로 다시 내보낸다(빌드는 chN.js 이름만 읽음).
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "advanced.js")


def make(src_dir, dst_dir, chapters=(1,), updated=None):
    updated = dict(updated or {})
    shutil.rmtree(dst_dir, ignore_errors=True)
    shutil.copytree(src_dir, dst_dir)
    upd_ch = {int(k.split("-")[0]) for k in updated}
    for n in sorted(set(chapters) | upd_ch):
        orig = "ch%d.orig.mjs" % n
        os.rename(os.path.join(dst_dir, "ch%d.js" % n), os.path.join(dst_dir, orig))
        mine = {k: v for k, v in updated.items() if int(k.split("-")[0]) == n}
        with open(os.path.join(dst_dir, "ch%d.js" % n), "w", encoding="utf-8") as f:
            f.write('export * from "./%s";\n' % orig)
            if mine:
                f.write('import * as M from "./%s";\n' % orig)
                f.write("const U = %s;\n" % json.dumps(mine, ensure_ascii=False))
                f.write("const up = (l) => (U[l.id] ? { ...l, updated: U[l.id] } : l);\n")
                f.write("export const LESSONS = M.LESSONS.map(up);\n")
            if n in chapters:
                f.write('import { advancedFixture } from "file://%s";\n' % FIXTURE)
                f.write("export const ADVANCED = advancedFixture(%d)%s;\n" % (n, ".map(up)" if mine else ""))
            elif any("-A" in k for k in mine):
                f.write("export const ADVANCED = M.ADVANCED.map(up);\n")
    return dst_dir
