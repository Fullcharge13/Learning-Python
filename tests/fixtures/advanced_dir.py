"""시험용 장 폴더 만들기: data/lessons를 복사하고, 고른 장에 시험 심화(tests/fixtures/advanced.js)를 끼운다.

    from fixtures.advanced_dir import make
    make(src_dir, dst_dir, chapters=(1,))   # dst_dir/ch1.js = 원래 ch1 + ADVANCED 3개(1-A1..1-A3)

원래 chN.js는 chN.orig.mjs로 옮겨 그대로 다시 내보낸다(빌드는 chN.js 이름만 읽음).
"""
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "advanced.js")


def make(src_dir, dst_dir, chapters=(1,)):
    shutil.rmtree(dst_dir, ignore_errors=True)
    shutil.copytree(src_dir, dst_dir)
    for n in chapters:
        orig = "ch%d.orig.mjs" % n
        os.rename(os.path.join(dst_dir, "ch%d.js" % n), os.path.join(dst_dir, orig))
        with open(os.path.join(dst_dir, "ch%d.js" % n), "w", encoding="utf-8") as f:
            f.write('export * from "./%s";\n' % orig)
            f.write('import { advancedFixture } from "file://%s";\n' % FIXTURE)
            f.write("export const ADVANCED = advancedFixture(%d);\n" % n)
    return dst_dir
