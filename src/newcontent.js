// 「새 내용」 점 (v0.7.1, 설계 docs/specs/2026-11-01-기초-보강-1-6장-설계.md 3절). 순수 함수만.
// - 보강한 레슨에는 데이터에 updated: "v0.7.1"(판 이름)이 있고, 레슨 목록 stub에도 옮겨진다(lessondata.js).
// - 저장의 seen_updates = { 레슨 id: 마지막으로 끝까지 본 판 }. saveVer는 그대로(없으면 {}).
// - 점: 끝낸 레슨 + updated 있음 + seen_updates[id] !== updated 일 때만.
// - 기록 시점: 레슨을 **끝까지 마쳤을 때**(finishLesson, 처음·다시 하기·이어 하기 모두). 열기만 하고 그만두면 점이 남는다.
//   복습(mode "review")은 레슨을 다시 본 것이 아니라서 기록하지 않는다.

export const UPDATED_RE = /^v\d+\.\d+(\.\d+)?$/;
export const UPDATED_MAX = 16;

/** 레슨(또는 stub)의 보강 판 이름. 형식이 맞지 않으면 null */
export function lessonUpdated(l) {
  const u = l && l.updated;
  return typeof u === "string" && u.length <= UPDATED_MAX && UPDATED_RE.test(u) ? u : null;
}

/** 이 레슨 노드에 「새 내용」 점을 띄우나 */
export function hasNewContent(stub, save) {
  const u = lessonUpdated(stub);
  if (!u || !save || !Array.isArray(save.completed_lessons) || !save.completed_lessons.includes(stub.id)) return false;
  const seen = save.seen_updates && typeof save.seen_updates === "object" ? save.seen_updates : {};
  return !Object.hasOwn(seen, stub.id) || seen[stub.id] !== u;
}

/** 레슨을 끝까지 본 뒤: updated가 있으면 그 판을 기록한 새 저장, 없으면 같은 저장 */
export function markSeen(save, lesson) {
  const u = lessonUpdated(lesson);
  if (!u || !lesson.id) return save;
  return { ...save, seen_updates: { ...(save.seen_updates || {}), [lesson.id]: u } };
}

/** 저장 불러올 때 정리: 글자 판 이름만 남긴다(위험한 키는 fill에서 이미 빠짐) */
export function cleanSeenUpdates(v) {
  const out = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, u] of Object.entries(v)) {
    if (typeof k === "string" && k.length <= 16 && lessonUpdated({ updated: u })) out[k] = u;
  }
  return out;
}
