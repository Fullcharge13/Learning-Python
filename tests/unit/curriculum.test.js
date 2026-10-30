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
