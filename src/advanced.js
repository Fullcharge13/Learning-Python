// 심화 레슨 (v0.7 작업 1, 설계 docs/specs/2026-10-31-심화학습-설계.md 1절). 순수 함수만.
// - id는 `N-A1`~`N-A3`, 장 파일의 ADVANCED 목록에 있고 레슨 목록(index)에서는 장의 `advanced` 칸에 따로 있다.
//   본 과정 `lessons`에는 섞지 않으므로 지금 레슨·진도 개수·과정 완주(C39)는 그대로 본 과정만 본다.
// - 열림: 그 장 평가(마지막 본 과정 레슨, 보통 N-5)를 끝내면 세 개가 함께 열림. 순서 없음, 선택.
// - 보상: 처음 끝내면 XP 15·바이트 15 (+ 보통 레슨과 같은 실수 없음·힌트 없음 보너스). 다시 하기는 기존 규칙(rules.js).

export const ADV_XP = 15;
export const ADV_BYTES = 15;
const ADV_RE = /^[1-9]\d*-A[1-9]\d*$/;

export const isAdvancedId = (id) => typeof id === "string" && ADV_RE.test(id);
export const isAdvancedLesson = (l) => !!l && (l.isAdvanced === true || isAdvancedId(l.id));

/** 그 장의 평가 레슨 id: isExam인 레슨(없으면 마지막 본 과정 레슨) */
function examId(chapter) {
  const ls = (chapter && chapter.lessons) || [];
  const exam = ls.find((l) => l.isExam) || ls[ls.length - 1];
  return exam ? exam.id : null;
}

/** 그 장의 심화가 열렸나: 장 평가를 끝냈으면 참 */
export function advancedOpen(chapter, completed) {
  const ex = examId(chapter);
  return !!ex && (completed || []).includes(ex);
}

/** 심화 id의 상태: "locked" | "open" | "done" | "perfect". 심화가 아니거나 목록에 없으면 null */
export function advancedState(chapters, save, id) {
  if (!isAdvancedId(id)) return null;
  const ch = (chapters || []).find((c) => (c.advanced || []).some((l) => l.id === id));
  if (!ch) return null;
  const completed = (save && save.completed_lessons) || [];
  if (completed.includes(id)) {
    const g = save.grading_results && save.grading_results[id];
    return g && g.perfect ? "perfect" : "done";
  }
  return advancedOpen(ch, completed) ? "open" : "locked";
}

/** 장 하나의 심화 진도 { done, total } */
export function advancedCount(chapter, completed) {
  const adv = (chapter && chapter.advanced) || [];
  const set = new Set(completed || []);
  return { done: adv.filter((l) => set.has(l.id)).length, total: adv.length };
}

/** 지금 과정에 있는 심화 id 전부(장 번호 순). 배지 「깊이 파는 사람」의 기준 */
export function advancedIds(chapters) {
  return (chapters || []).flatMap((c) => (c.advanced || []).map((l) => l.id));
}
