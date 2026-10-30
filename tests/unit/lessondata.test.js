// 장 따로 불러오기 (v0.3 작업 1): 레슨 목록 만들기, 장 파일 이름표, 가져오기·실패 뒤 다시 시도
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLessonIndex, chapterFileName, CHAPTER_FILE_RE, chaptersForConcepts, createLessonData, ChapterLoadError,
} from "../../src/lessondata.js";

const mod = (n, k = 2) => ({
  CHAPTER: { id: n, title: `${n}장 제목` },
  LESSONS: Array.from({ length: k }, (_, i) => ({
    id: `${n}-${i + 1}`, chapter: n, title: `레슨 ${n}-${i + 1}`, goal: `목표 ${n}-${i + 1}`,
    summary: [`요약 ${n}-${i + 1}`], isExam: i === k - 1 ? true : undefined,
    cards: [{ say: `카드 ${n}-${i + 1}`, code: "print(1)", out: "1" }],
    items: [
      { type: "choice", concept: `c${n}a`, q: `문제 ${n}-${i + 1}`, options: ["a", "b"], answer: 0 },
      { type: "write", concept: `c${n}b`, task: `작성 ${n}-${i + 1}`, tests: [] },
      { type: "check", concept: `c${n}a`, q: "확인", options: ["a", "b"], answer: 1 },
    ],
  })),
});

test("index_build: 장·레슨 목록만 담고 문제·카드는 뺀다", () => {
  const idx = buildLessonIndex([mod(2), mod(1)]);
  assert.deepEqual(idx.map((c) => c.id), [1, 2], "장 번호 순서");
  assert.equal(idx[0].title, "1장 제목");
  const l = idx[0].lessons[1];
  assert.deepEqual(l, { id: "1-2", chapter: 1, title: "레슨 1-2", goal: "목표 1-2", summary: ["요약 1-2"], isExam: true, concepts: ["c1a", "c1b"] });
  assert.equal(idx[0].lessons[0].isExam, false);
  const text = JSON.stringify(idx);
  assert.ok(!text.includes("카드 1-1") && !text.includes("작성 1-1") && !text.includes("문제 1-1"), text);
});

test("index_build: CHAPTER가 없으면 첫 레슨의 chapter로, LESSONS가 없는 모듈은 건너뜀", () => {
  const m = mod(3);
  delete m.CHAPTER;
  const idx = buildLessonIndex([m, { nothing: 1 }, null]);
  assert.equal(idx.length, 1);
  assert.equal(idx[0].id, 3);
  assert.equal(idx[0].title, "");
});

test("file_name: 장 번호와 지문 8자", () => {
  assert.equal(chapterFileName(6, "0123abcd"), "lessons/ch6-0123abcd.json");
  assert.match(chapterFileName(12, "deadbeef"), CHAPTER_FILE_RE);
  assert.throws(() => chapterFileName(1, "xyz"));
  assert.throws(() => chapterFileName(0, "0123abcd"));
  assert.ok(!CHAPTER_FILE_RE.test("lessons/ch6.json"));
});

test("concepts_chapters: 복습 개념이 들어 있는 장만", () => {
  const idx = buildLessonIndex([mod(1), mod(2), mod(3)]);
  assert.deepEqual(chaptersForConcepts(idx, ["c3b", "c1a"]), [1, 3]);
  assert.deepEqual(chaptersForConcepts(idx, ["없음"]), []);
  assert.deepEqual(chaptersForConcepts(idx, []), []);
});

function fakeFetch(table) {
  const calls = [];
  const fn = async (url) => {
    calls.push(String(url));
    const r = table(String(url), calls.length);
    if (r instanceof Error) throw r;
    return r;
  };
  fn.calls = calls;
  return fn;
}
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const FILES = { 1: "lessons/ch1-11111111.json", 2: "lessons/ch2-22222222.json" };
const BASE = "https://x.test/app/index.html";

test("fetch_once: 주소는 기준 주소 기준, 한 번 받은 장은 메모리에서", async () => {
  const f = fakeFetch(() => ok(mod(2)));
  const d = createLessonData({ index: buildLessonIndex([mod(1), mod(2)]), files: FILES, base: BASE, fetch: f });
  assert.equal(d.split, true);
  const [a, b] = await Promise.all([d.getChapter(2), d.getChapter(2)]);
  assert.equal(a, b, "동시에 불러도 한 번만");
  await d.getChapter(2);
  assert.deepEqual(f.calls, ["https://x.test/app/lessons/ch2-22222222.json"]);
  assert.equal(a.LESSONS[0].items.length, 3);
  assert.deepEqual(d.fileList(), Object.values(FILES));
  const l = await d.getLesson("2-2");
  assert.equal(l.cards[0].say, "카드 2-2");
  assert.equal(await d.getLesson("9-9"), null, "없는 레슨은 null");
  assert.equal(d.lessons.length, 4);
  assert.equal(d.chapterOf("1-2"), 1);
});

test("retry: 실패는 기억하지 않고 다음 부름에서 다시 받음", async () => {
  let fail = true;
  const f = fakeFetch(() => (fail ? new TypeError("Failed to fetch") : ok(mod(1))));
  const d = createLessonData({ index: buildLessonIndex([mod(1)]), files: FILES, base: BASE, fetch: f });
  await assert.rejects(d.getChapter(1), (e) => e instanceof ChapterLoadError && e.chapter === 1 && e.stale === false);
  fail = false;
  const c = await d.getChapter(1);
  assert.equal(c.CHAPTER.id, 1);
  assert.equal(f.calls.length, 2);
});

test("stale: 404면 옛 판 표시(stale), 내용이 다른 장이면 실패", async () => {
  const f404 = fakeFetch(() => ({ ok: false, status: 404, json: async () => ({}) }));
  const d = createLessonData({ index: buildLessonIndex([mod(1)]), files: FILES, base: BASE, fetch: f404 });
  await assert.rejects(d.getChapter(1), (e) => e instanceof ChapterLoadError && e.stale === true);
  const wrong = fakeFetch(() => ok(mod(2)));
  const d2 = createLessonData({ index: buildLessonIndex([mod(1)]), files: FILES, base: BASE, fetch: wrong });
  await assert.rejects(d2.getChapter(1), ChapterLoadError);
  const nofile = createLessonData({ index: buildLessonIndex([mod(1)]), files: {}, base: BASE, fetch: wrong });
  await assert.rejects(nofile.getChapter(1), ChapterLoadError);
});

test("dev_mode: 장 파일 표가 없으면 불러온 모듈을 그대로 씀(네트워크 없음)", async () => {
  const mods = [mod(1), mod(2)];
  const f = fakeFetch(() => { throw new Error("no network in dev"); });
  const d = createLessonData({ modules: mods, fetch: f });
  assert.equal(d.split, false);
  assert.deepEqual(d.index.map((c) => c.id), [1, 2]);
  assert.deepEqual(d.fileList(), []);
  const l = await d.getLesson("2-1");
  assert.equal(l.items[1].task, "작성 2-1");
  assert.equal(f.calls.length, 0);
});
