import { test } from "node:test";
import assert from "node:assert/strict";
import { curriculum, upcomingChapters, pathEndText, UPCOMING } from "../../src/curriculum.js";

const mk = (no, title) => ({
  id: no, title,
  lessons: [1, 2, 3, 4, 5].map((k) => ({ id: `${no}-${k}`, chapter: no, title: `${title} ${k}`, goal: `목표 ${no}-${k}`, isExam: k === 5 })),
});
const CH = [mk(1, "첫 코드"), mk(2, "변수와 표현식"), mk(3, "조건문")];

test("cur_status: 완료·지금·잠김과 개수", () => {
  const c = curriculum({ chapters: CH, completed: ["1-1", "1-2"], currentId: "1-3" });
  assert.equal(c.total, 15);
  assert.equal(c.done, 2);
  assert.deepEqual(c.current, { id: "1-3", title: "첫 코드 3" });
  const st = c.chapters[0].lessons.map((l) => l.status);
  assert.deepEqual(st, ["done", "done", "current", "locked", "locked"]);
  assert.equal(c.chapters[0].done, 2);
  assert.equal(c.chapters[0].total, 5);
  assert.equal(c.chapters[1].lessons[0].status, "locked");
  assert.equal(c.chapters[0].lessons[2].goal, "목표 1-3");
  assert.match(c.chapters[0].topics, /첫 코드 1/);
});

test("cur_unlocked_not_current: 열렸지만 지금이 아닌 레슨은 open", () => {
  const c = curriculum({ chapters: CH, completed: ["1-1"], currentId: null });
  assert.equal(c.chapters[0].lessons[1].status, "open");
  assert.equal(c.current, null);
});

test("cur_upcoming: 4장부터, 이미 있는 장은 숨김", () => {
  assert.equal(UPCOMING.length, 14);
  const up = upcomingChapters(CH);
  assert.deepEqual(up[0], { no: 4, title: "함수" });
  assert.equal(up.length, 14);
  const up2 = upcomingChapters([...CH, mk(4, "함수")]);
  assert.deepEqual(up2[0], { no: 5, title: "반복문" });
  assert.equal(up2.length, 13);
});

test("path_end_text: 남은 레슨이 있을 때와 모두 끝냈을 때", () => {
  assert.equal(pathEndText({ chapters: CH, completed: ["1-1"] }),
    "3장까지가 지금 판의 전부예요. 4장(함수)부터는 다음 업데이트에서 열려요");
  const all = CH.flatMap((c) => c.lessons.map((l) => l.id));
  assert.equal(pathEndText({ chapters: CH, completed: all }), "지금 판의 레슨을 모두 끝냈어요! 복습으로 실력을 다져요");
  assert.equal(pathEndText({ chapters: [...CH, mk(4, "함수")], completed: [] }),
    "4장까지가 지금 판의 전부예요. 5장(반복문)부터는 다음 업데이트에서 열려요");
});

import { chapterWindow } from "../../src/curriculum.js";
const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

test("window_middle: 지금 장과 앞뒤 하나씩", () => {
  assert.deepEqual(chapterWindow({ chapterIds: IDS, currentChapter: 5 }), { shown: [4, 5, 6], hidden: [1, 2, 3, 7, 8, 9, 10] });
});

test("window_start_end: 처음이면 1~3, 마지막이면 끝 셋", () => {
  assert.deepEqual(chapterWindow({ chapterIds: IDS, currentChapter: 1 }).shown, [1, 2, 3]);
  assert.deepEqual(chapterWindow({ chapterIds: IDS, currentChapter: 10 }).shown, [8, 9, 10]);
});

test("window_all_done: 지금 장이 없으면(모두 끝냄) 끝 셋", () => {
  const w = chapterWindow({ chapterIds: IDS, currentChapter: null });
  assert.deepEqual(w.shown, [8, 9, 10]);
  assert.equal(w.hidden.length, 7);
});

test("window_few: 장이 3개 이하면 모두 보이고 숨김 없음", () => {
  assert.deepEqual(chapterWindow({ chapterIds: [1, 2], currentChapter: 2 }), { shown: [1, 2], hidden: [] });
  assert.deepEqual(chapterWindow({ chapterIds: [1, 2, 3], currentChapter: 1 }), { shown: [1, 2, 3], hidden: [] });
  assert.deepEqual(chapterWindow({ chapterIds: [], currentChapter: null }), { shown: [], hidden: [] });
});

import { courseJustFinished } from "../../src/curriculum.js";
const FULL = Array.from({ length: 17 }, (_, i) => mk(i + 1, i + 4 <= 17 && i >= 3 ? UPCOMING[i - 3] : `장${i + 1}`));
const FULL_IDS = FULL.flatMap((c) => c.lessons.map((l) => l.id));

test("course_end_path: 17장 전부 끝내면 과정 완주 문구(다음 업데이트 말 없음)", () => {
  assert.equal(pathEndText({ chapters: FULL, completed: FULL_IDS }), "과정을 모두 끝냈어요! 복습으로 실력을 다져요");
  assert.equal(pathEndText({ chapters: FULL, completed: [] }), "17장이 마지막 장이에요. 끝까지 함께 가 봐요");
});

test("course_just_finished: 처음으로 마지막 레슨까지 끝낸 순간만 참", () => {
  assert.equal(courseJustFinished({ chapters: FULL, completed: FULL_IDS, firstTime: true }), true);
  assert.equal(courseJustFinished({ chapters: FULL, completed: FULL_IDS, firstTime: false }), false); // 다시 하기·복습
  assert.equal(courseJustFinished({ chapters: FULL, completed: FULL_IDS.slice(1), firstTime: true }), false); // 빠진 레슨
  assert.equal(courseJustFinished({ chapters: CH, completed: CH.flatMap((c) => c.lessons.map((l) => l.id)), firstTime: true }), false); // 다음 장이 남은 판
});
