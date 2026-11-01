// 레슨 한 번의 누적 결과 (v0.6.2 다): 화면(ui/lesson.js)과 이어 하기(resume.js)가 같이 쓰는 순수 함수.
// S = { flow, combo, marks, logs, marked, write, reviewCorrect, itemsSolved } (+ 화면 전용 칸은 여기서 안 봄)
// 보상은 finishInfo(S)만 보고 정하므로, S를 그대로 저장했다 되살리면 보상도 같다.
import { startFlow, summary } from "./lessonflow.js";

export function newSession(lesson) {
  return { flow: startFlow(lesson), combo: 0, marks: [], logs: [], marked: {}, write: null, reviewCorrect: 0, itemsSolved: 0 };
}

/** 개념 점수 표시: 같은 문제·같은 결과는 한 번만 */
export function mark(S, index, concept, outcome) {
  if (!concept) return;
  const key = index + ":" + outcome;
  if (S.marked[key]) return;
  S.marked[key] = true;
  S.marks.push([concept, outcome]);
}

/** 터치 문제 채점. 돌려줌: { combo } (3연속마다 true) */
export function touchResult(S, cur, ok, review) {
  const it = cur.item;
  if (ok) {
    S.combo++;
    S.itemsSolved++;
    if (review) S.reviewCorrect++;
    if (cur.attempt === 1) mark(S, cur.index, it.concept, "right");
  } else {
    S.combo = 0;
    mark(S, cur.index, it.concept, "wrong");
  }
  return { combo: ok && S.combo >= 3 && S.combo % 3 === 0 };
}

/** 직접 작성 통과. 돌려줌: { clean, flowCorrect } (flowCorrect는 answer()에 넘길 값) */
export function writePass(S, cur, { solutionSeen, hintUsed, hadError, firstSubmit }) {
  const w = S.write || { passed: false, hintUsed: false, solutionSeen: false, fixedError: false };
  S.write = { passed: true, hintUsed: w.hintUsed || hintUsed, solutionSeen: w.solutionSeen || solutionSeen, fixedError: w.fixedError || hadError };
  const it = cur.item;
  if (hintUsed || solutionSeen) mark(S, cur.index, it.concept, "hint");
  if (firstSubmit && !hintUsed && !solutionSeen) mark(S, cur.index, it.concept, "right");
  const clean = !solutionSeen;
  if (clean) { S.combo++; S.itemsSolved++; } else S.combo = 0;
  return { clean, flowCorrect: clean && firstSubmit };
}

export function writeWrong(S, cur) {
  S.combo = 0;
  mark(S, cur.index, cur.item.concept, "wrong");
}

export function writeHint(S, cur) {
  mark(S, cur.index, cur.item.concept, "hint");
}

export function logSubmit(S, lessonId, index, pass, at) {
  S.logs.push({ lesson: lessonId, item: index, pass: !!pass, at });
}

/** ctx.finish에 넘길 값(nextLessonId·nextChapter는 앱이 붙임) */
export function finishInfo(S, lesson, review) {
  const sum = summary(S.flow);
  return {
    lesson, mode: review ? "review" : "lesson", perfect: sum.perfect, accuracy: sum.accuracy,
    marks: S.marks, write: S.write, itemsSolved: S.itemsSolved, reviewCorrect: S.reviewCorrect, logs: S.logs,
  };
}
