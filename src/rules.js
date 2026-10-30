// 진도 규칙 (작업 2) — 순수 함수만. 실제 시계는 읽지 않고 "YYYY-MM-DD" 문자열을 받는다.
// 모든 함수는 받은 저장을 고치지 않고, 변화가 없어도 언제나 새 객체를 돌려준다.

export const FREEZE_PRICE = 200;
export const FREEZE_MAX = 2;
export const MILESTONES = [7, 30, 100];

// ---- 날짜 계산 (UTC로 해서 서머타임 영향 없음) ----
const DAY_MS = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayNum(d) {
  const [y, m, dd] = d.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, dd) / DAY_MS);
}
function fromDayNum(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}
function prevDay(d) {
  return fromDayNum(dayNum(d) - 1);
}

// "YYYY-MM-DD" 모양이고 실제로 있는 날짜인지 (UTC로 되돌려 같은지 확인)
export function isDate(s) {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  return fromDayNum(dayNum(s)) === s;
}
function requireDate(today) {
  if (!isDate(today)) throw new Error(`날짜 형식이 잘못됨: ${String(today)}`);
}
function cleanXp(xp) {
  return typeof xp === "number" && Number.isFinite(xp) && xp > 0 ? xp : 0;
}
// 저장된 마지막 달성일: 잘못된 형식이거나 오늘보다 2일 이상 뒤(시계 되돌림이 큼)면 없는 것으로 본다.
// 하루 뒤까지는 그대로 둔다(이미 센 날로 취급).
function usableLast(last, today) {
  if (!isDate(last)) return null;
  return dayNum(last) - dayNum(today) <= 1 ? last : null;
}
export const DAILY_GOALS = [10, 20, 30];
function dailyGoal(save) {
  const g = save.settings && save.settings.dailyGoal;
  return DAILY_GOALS.includes(g) ? g : 20;
}
function copy(save) {
  return { ...save, streak: { ...save.streak } };
}

// ---- 보상 ----
// 다시 하기(판정 C24): 고정 XP 10(평가 15), 보너스·바이트 없음.
// 15레슨을 다 끝낸 뒤에도 하루 목표 20을 다시 하기 2번으로 채울 수 있게 한 값.
export function lessonReward({ firstTime, perfect, hintFreeWrite, isExam }) {
  if (!firstTime) return { xp: isExam ? 15 : 10, bytes: 0 };
  const xp = (isExam ? 30 : 10) + (perfect ? 5 : 0) + (hintFreeWrite ? 5 : 0);
  return { xp, bytes: 10 + (perfect ? 5 : 0) };
}

// 복습 한 판(판정 C24): XP 10
export function reviewReward() {
  return { xp: 10, bytes: 0 };
}

// ---- 날 넘김 (ledger C7 + 검토 판정 3·4·5) ----
// 앱을 열 때 호출. 마지막 달성일과 오늘 사이(양 끝 제외)의 빠진 날을 보호권으로 메운다.
// - 저장된 lastGoalDate가 없거나 잘못됐으면: 아무것도 바꾸지 않음
// - lastGoalDate가 오늘 이후(시계를 뒤로 돌림)면: 아무것도 바꾸지 않음
//   (2일 이상 뒤면 없는 것으로 보고, 다음 목표 달성 때 1부터 다시 셈)
// - 보호권이 모자라면: 보호권은 쓰지 않고 기록만 0 (죄책감 없는 원칙, 설계 5-2)
export function rollDay(save, today) {
  requireDate(today);
  const out = copy(save);
  const last = usableLast(save.streak.lastGoalDate, today);
  if (last === null) return { save: out, usedFreezes: 0, broke: false };
  const missed = dayNum(today) - dayNum(last) - 1;
  if (missed <= 0) return { save: out, usedFreezes: 0, broke: false };
  if (save.freezes >= missed) {
    out.freezes = save.freezes - missed;
    out.streak.lastGoalDate = prevDay(today);
    return { save: out, usedFreezes: missed, broke: false };
  }
  out.streak.days = 0;
  out.streak.lastGoalDate = null;
  return { save: out, usedFreezes: 0, broke: true };
}

// ---- 하루 XP와 연속 기록 ----
// 날이 바뀌었으면 rollDay를 먼저 적용(앱이 rollDay를 건너뛰고 이어서 실행된 경우 대비).
// 하루 목표가 10·20·30이 아니면 20으로 본다.
// 오늘 합계가 목표 이상이고 오늘이 아직 인정되지 않았으면 그날을 인정한다.
export function addDailyXp(save, xp, today) {
  requireDate(today);
  const add = cleanXp(xp);
  let s = copy(save);
  if (s.streak.todayDate !== today) {
    s = rollDay(s, today).save;
    s.streak.todayDate = today;
    s.streak.todayXp = 0;
  }
  const st = s.streak;
  st.todayXp += add;
  s.xp = save.xp + add;

  const last = usableLast(st.lastGoalDate, today);
  const alreadyCounted = last !== null && dayNum(last) >= dayNum(today); // 오늘 또는 미래(시계 되돌림)
  if (!alreadyCounted && st.todayXp >= dailyGoal(save)) {
    st.days = last === prevDay(today) ? st.days + 1 : 1;
    st.lastGoalDate = today;
    st.best = Math.max(st.best || 0, st.days);
  }
  return s;
}

// ---- 연속 기록 이정표 (설계 5-2): 7일 50바이트, 30일 우주인 의상, 100일 배지 ----
// 각 보상은 평생 한 번 — 이전 저장의 best가 그 숫자보다 작을 때만 준다.
export function applyMilestones(prevSave, nextSave) {
  const prevBest = prevSave.streak.best || 0;
  const days = nextSave.streak.days;
  const out = { ...nextSave, streak: { ...nextSave.streak }, outfits: [...nextSave.outfits], badges: [...nextSave.badges] };
  let milestone = null;
  for (const n of MILESTONES) {
    if (days < n || prevBest >= n) continue;
    if (n === 7) out.bytes += 50;
    if (n === 30 && !out.outfits.includes("astronaut")) out.outfits.push("astronaut");
    if (n === 100 && !out.badges.includes("streak100")) out.badges.push("streak100");
    milestone = n;
  }
  return { save: out, milestone };
}

// 앱이 쓰는 XP 적립 입구: 하루 XP·연속 기록 + 이정표 보상
export function earnXp(save, xp, today) {
  const next = addDailyXp(save, xp, today);
  return applyMilestones(save, next);
}

// ---- 보호권 구매 ----
export function buyFreeze(save) {
  if (save.freezes >= FREEZE_MAX) return new Error("보호권은 최대 2개까지 가질 수 있어요");
  if (save.bytes < FREEZE_PRICE) return new Error("바이트가 모자라요");
  return { ...save, bytes: save.bytes - FREEZE_PRICE, freezes: save.freezes + 1 };
}

// ---- 취약 개념 점수 ----
const DELTA = { wrong: 2, hint: 1, right: -1 };

export function markConcept(save, concept, outcome) {
  if (typeof outcome !== "string" || !Object.hasOwn(DELTA, outcome)) {
    throw new Error(`알 수 없는 결과: ${String(outcome)}`);
  }
  const prev = Object.hasOwn(save.weak_concepts, concept) ? save.weak_concepts[concept] : 0;
  const score = Math.max(0, prev + DELTA[outcome]);
  const weak_concepts = { ...save.weak_concepts, [concept]: score };
  const queued = save.review_queue.includes(concept);
  let review_queue;
  if (score >= 2 && !queued) review_queue = [...save.review_queue, concept];
  else if (score === 0 && queued) review_queue = save.review_queue.filter((c) => c !== concept);
  else review_queue = [...save.review_queue];
  return { ...save, weak_concepts, review_queue };
}
