// 학습 내용 요약 (판정 C33). 순수 함수. 불러온 장 파일에서 계산하므로 ch4.js를 넣어도 화면 코드는 그대로다.

// 다음 판에 열릴 장 제목. UPCOMING[i]는 (i + 4)장. 이미 불러온 장 번호는 자동으로 숨긴다.
export const UPCOMING = ["함수", "반복문", "문자열 다루기", "리스트", "딕셔너리", "튜플과 집합", "예외 처리", "파일",
  "정규표현식", "네트워크 기초", "웹 API와 JSON", "객체지향", "데이터베이스와 SQL", "데이터 시각화"];
const UPCOMING_FROM = 4;

/** 아직 없는 다음 장들: [{ no, title }] */
export function upcomingChapters(chapters) {
  const have = new Set((chapters || []).map((c) => c.id));
  return UPCOMING.map((title, i) => ({ no: UPCOMING_FROM + i, title })).filter((u) => !have.has(u.no));
}

/**
 * @param {{ chapters: {id,title,lessons}[], completed: string[], currentId: string|null }} o
 * 레슨 상태: done(완료) · current(지금) · open(열렸지만 지금이 아님) · locked(잠김). 앞 레슨을 끝내야 열림.
 */
export function curriculum({ chapters, completed, currentId }) {
  const doneSet = new Set(completed || []);
  const all = (chapters || []).flatMap((c) => c.lessons);
  const statusOf = (l, i) => {
    if (doneSet.has(l.id)) return "done";
    const unlocked = i === 0 || doneSet.has(all[i - 1].id);
    if (!unlocked) return "locked";
    return l.id === currentId ? "current" : "open";
  };
  let idx = 0;
  const out = (chapters || []).map((c) => {
    const lessons = c.lessons.map((l) => ({ id: l.id, title: l.title, goal: l.goal || "", isExam: !!l.isExam, status: statusOf(l, idx++) }));
    return {
      id: c.id, title: c.title,
      topics: c.lessons.filter((l) => !l.isExam).map((l) => l.title).join(" · "),
      done: lessons.filter((l) => l.status === "done").length,
      total: lessons.length,
      lessons,
    };
  });
  const cur = all.find((l) => l.id === currentId && !doneSet.has(l.id));
  return {
    total: all.length,
    done: all.filter((l) => doneSet.has(l.id)).length,
    current: cur ? { id: cur.id, title: cur.title } : null,
    chapters: out,
    upcoming: upcomingChapters(chapters),
  };
}

/** 홈 학습 길 끝 문구 */
export function pathEndText({ chapters, completed }) {
  const doneSet = new Set(completed || []);
  const all = (chapters || []).flatMap((c) => c.lessons);
  const last = (chapters || []).reduce((m, c) => Math.max(m, c.id), 0);
  const next = upcomingChapters(chapters)[0];
  if (all.length && all.every((l) => doneSet.has(l.id))) {
    return next ? "지금 판의 레슨을 모두 끝냈어요! 복습으로 실력을 다져요" : "과정을 모두 끝냈어요! 복습으로 실력을 다져요";
  }
  if (!next) return `${last}장이 마지막 장이에요. 끝까지 함께 가 봐요`;
  return `${last}장까지가 지금 판의 전부예요. ${next.no}장(${next.title})부터는 다음 업데이트에서 열려요`;
}

/**
 * 학습 내용 카드에 처음부터 보일 장 (판정 C35): 지금 장과 앞뒤, 모두 끝냈으면(지금 장 없음) 끝 셋.
 * 처음·끝에서는 창을 안쪽으로 밀어 늘 size개를 채운다. 나머지는 「더 보기」로.
 * @returns {{ shown: number[], hidden: number[] }} 둘 다 장 번호 순
 */
export function chapterWindow({ chapterIds, currentChapter, size = 3 }) {
  const ids = [...(chapterIds || [])];
  if (ids.length <= size) return { shown: ids, hidden: [] };
  let at = ids.indexOf(currentChapter);
  if (at < 0) at = ids.length - 1;
  const start = Math.min(Math.max(0, at - Math.floor(size / 2)), ids.length - size);
  const shown = ids.slice(start, start + size);
  return { shown, hidden: ids.filter((id) => !shown.includes(id)) };
}

/** 과정 완주(판정 C39): 다음 장 예정이 없고, 이번이 처음 끝낸 레슨이며, 모든 레슨을 끝냈을 때만 참 */
export function courseJustFinished({ chapters, completed, firstTime }) {
  if (!firstTime || upcomingChapters(chapters).length) return false;
  const doneSet = new Set(completed || []);
  const all = (chapters || []).flatMap((c) => c.lessons);
  return all.length > 0 && all.every((l) => doneSet.has(l.id));
}
