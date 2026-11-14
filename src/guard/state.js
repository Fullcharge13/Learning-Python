// v0.15 경비실 저장·보상·등급 (설계 docs/specs/2026-11-12-경비실-설계.md §5)
//
// 저장 save.guard (saveVer 2 그대로, 없거나 망가지면 cleanGuard가 기본값으로 채움):
//   { v:1, solved:{ 사건id: { firstTry, how:"blank"|"code" } }, code:{ 사건id: 코드 }, blanks:{ 사건id: [고른 보기|null…] },
//     seen:[본 사건 id…], attempts:{ 사건id: 실행 횟수 }, runs }
// 보상: 경비실은 바이트를 직접 주지 않는다. 사건을 처음 해결하면 XP(GUARD_XP)만 earnXp·퀘스트("xp")로 흘려 보낸다.
// v0.16.0 작업 2: 사건 본문은 첫 파일에 없다. 이 파일은 색인(catalog.js의 guardIndexEntry 모양)만 쓴다.
//   앱은 저장을 읽기(migrate) 전에 setGuardIndex로 한 번 넣는다(판정 G2-C3: 배포판 window.RIA_GUARD_INDEX, 개발판 guarddev.js).
//   색인 없이 저장을 다듬으면 모든 id를 모른다고 보고 해결 기록을 지우게 되므로, 그때는 분명한 오류를 던진다.
//   본문(시도 목록)이 필요한 guardInput·guardConsistent·applyGuardRun은 장 파일에서 받은 사건 본문으로 부른다.
import { GUARD_XP } from "./catalog.js";
import { earnXp } from "../rules.js";
import { ensureQuests, tick } from "../quests.js";
import { checkBadges } from "../badges.js";
import { localDate } from "../today.js";
import { lang } from "../i18n.js";

const GUARD_VER = 1;
const CODE_MAX = 4000;

// ---- 색인 ----
let INDEX = null;
let BY_ID = null;   // 상속 이름(toString 등)이 id로 통과하지 않게 프로토타입 없는 객체로
const okEntry = (e) => !!e && typeof e === "object" && typeof e.id === "string" && e.id !== "" && Number.isInteger(e.need)
  && Array.isArray(e.blanks) && e.blanks.every((n) => Number.isInteger(n) && n >= 0)
  && (e.tier === undefined || e.tier === "field");   // v0.20.0: 기본은 tier 없음, 응용은 "field"만

/** 사건 색인 넣기(앱 시작 때 한 번, 저장을 읽기 전). 비었거나 모양이 틀리면 던짐 */
export function setGuardIndex(entries) {
  if (!Array.isArray(entries) || entries.length === 0 || !entries.every(okEntry)) {
    throw new Error("setGuardIndex: guard index must be a non-empty array of { id, need, blanks }");
  }
  INDEX = Object.freeze(entries.map((e) => Object.freeze({ ...e, blanks: Object.freeze([...e.blanks]) })));
  BY_ID = Object.assign(Object.create(null), Object.fromEntries(INDEX.map((e) => [e.id, e])));
}
/** 시험 전용: 색인을 비운다 */
export function clearGuardIndex() {
  INDEX = null;
  BY_ID = null;
}
function byId() {
  if (!BY_ID) throw new Error("guard index is not set: call setGuardIndex() before reading or changing guard saves");
  return BY_ID;
}
/** 색인 목록(장 순서) */
export function guardIndex() {
  byId();
  return INDEX;
}
/** 응용 사건인가(v0.20.0) */
export const isField = (entry) => !!entry && entry.tier === "field";
/** 기본 사건 색인(원본 순서) */
export const basicIndex = () => guardIndex().filter((e) => !isField(e));
/** 응용 사건 색인(원본 순서) */
export const fieldIndex = () => guardIndex().filter(isField);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const nonNeg = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);

export const RANK_IDS = ["apprentice", "keeper", "captain", "sheriff"];
/** 등급 기준(해결 수): 사건 총수 n에서 0·⌈n/3⌉·⌈2n/3⌉·n (설계 §5-3) */
export function rankThresholds(n) {
  return { apprentice: 0, keeper: Math.ceil(n / 3), captain: Math.ceil((2 * n) / 3), sheriff: n };
}

export function newGuard() {
  return { v: GUARD_VER, solved: {}, code: {}, blanks: {}, seen: [], attempts: {}, runs: 0 };
}

/** 저장의 guard 칸 하나를 모양·범위에 맞춘 새 객체로. 객체가 아니면 새 경비실 */
export function cleanGuard(raw) {
  const BY_ID = byId();
  if (!isObj(raw)) return newGuard();
  const g = newGuard();
  if (isObj(raw.solved)) {
    for (const [id, v] of Object.entries(raw.solved)) {
      if (BY_ID[id] && isObj(v) && typeof v.firstTry === "boolean" && (v.how === "blank" || v.how === "code")) {
        g.solved[id] = { firstTry: v.firstTry, how: v.how };
      }
    }
  }
  if (isObj(raw.code)) {
    for (const [id, v] of Object.entries(raw.code)) {
      if (BY_ID[id] && typeof v === "string") g.code[id] = v.slice(0, CODE_MAX);
    }
  }
  if (isObj(raw.blanks)) {
    for (const [id, arr] of Object.entries(raw.blanks)) {
      const inc = BY_ID[id];
      if (!inc || !Array.isArray(arr)) continue;
      g.blanks[id] = inc.blanks.map((n, k) => (Number.isInteger(arr[k]) && arr[k] >= 0 && arr[k] < n ? arr[k] : null));
    }
  }
  if (Array.isArray(raw.seen)) g.seen = [...new Set(raw.seen.filter((id) => typeof id === "string" && BY_ID[id]))];
  if (isObj(raw.attempts)) {
    for (const [id, v] of Object.entries(raw.attempts)) if (BY_ID[id]) g.attempts[id] = nonNeg(v);
  }
  g.runs = nonNeg(raw.runs);
  return g;
}

const toSet = (p) => (p instanceof Set ? p : new Set(p || []));
/** 경비실이 열렸나(3장 통과) */
export const guardOpen = (passed) => toSet(passed).has(3);
/** 같은 장의 기본 사건 중 아직 해결 못 한 수(색인과 저장만 봄) */
export function basicLeft(entry, guard) {
  const solved = cleanGuard(guard).solved;
  return basicIndex().filter((i) => i.need === entry.need && !solved[i.id]).length;
}
/**
 * 이 사건이 열렸나. 기본은 필요한 장 통과. 응용는 거기에 더해 그 장의 기본을 모두 해결(개발자 모드는 건너뜀).
 * 색인 칸이나 본문 모두 need가 있다.
 */
export function incidentOpen(incident, passed, guard = null, dev = false) {
  if (!toSet(passed).has(incident.need)) return false;
  if (!isField(incident)) return true;
  return dev === true || basicLeft(incident, guard) === 0;
}

/** 열린 사건 중 아직 본 적 없는 것이 있나(하단 메뉴 새 소식 점) */
export function guardNews(guard, passed, dev = false) {
  const seen = new Set(cleanGuard(guard).seen);
  return guardIndex().some((i) => incidentOpen(i, passed, guard, dev) && !seen.has(i.id));
}

export function markSeen(guard, id) {
  const g = cleanGuard(guard);
  if (!byId()[id] || g.seen.includes(id)) return g;
  return { ...g, seen: [...g.seen, id] };
}

/** 엔진에 넘길 입력(받은 사건 본문으로). 영어면 value_en ?? value. password·files는 있으면 그대로 */
export function guardInput(incident, l = lang()) {
  const tries = incident.tries.map((t) => ({ value: l === "en" ? (t.value_en ?? t.value) : t.value, expect: t.expect }));
  const input = { mode: incident.mode, tries };
  if (incident.password !== undefined) input.password = incident.password;
  if (incident.files !== undefined) input.files = incident.files;
  return input;
}

const VERDICTS = new Set(["block", "allow", "none"]);
/** 엔진 결과가 입력과 앞뒤가 맞나: stats·solved를 events로 다시 계산해 같은지 */
export function guardConsistent(input, r) {
  if (!isObj(input) || !Array.isArray(input.tries) || !isObj(r) || !Array.isArray(r.events) || !isObj(r.stats)) return false;
  const n = input.tries.length;
  const ev = r.events;
  if (ev.length > n) return false;
  const stats = { attacks_blocked: 0, attacks_total: 0, guests_allowed: 0, guests_total: 0 };
  for (const t of input.tries) stats[t.expect === "block" ? "attacks_total" : "guests_total"]++;
  for (let k = 0; k < ev.length; k++) {
    const e = ev[k];
    if (!isObj(e) || e.i !== k || !VERDICTS.has(e.verdict)) return false;
    const expect = input.tries[k].expect;
    const ok = e.verdict === expect;   // v0.16.1: "none"(판정 안 함)은 손님에서도 틀림
    if (e.ok !== ok) return false;
    if (ok) stats[expect === "block" ? "attacks_blocked" : "guests_allowed"]++;
  }
  for (const k of Object.keys(stats)) if (r.stats[k] !== stats[k]) return false;
  const stopped = r.stopped === "error" ? "error" : null;
  if (r.stopped !== null && r.stopped !== undefined && r.stopped !== "error") return false;
  const solved = !stopped && n > 0 && ev.length === n && ev.every((e) => e.ok);
  return r.solved === solved;
}

/** 해결한 기본 사건 수로 등급 id(기준은 색인의 기본 사건 수, 응용는 세지 않음) */
export function rankOf(guard) {
  const solved = cleanGuard(guard).solved;
  const basic = basicIndex();
  const n = basic.filter((i) => solved[i.id]).length;
  const th = rankThresholds(basic.length);
  let id = RANK_IDS[0];
  for (const r of RANK_IDS) if (n >= th[r]) id = r;
  return id;
}

/**
 * 실행 결과를 저장에 반영. 결과 대조(guardConsistent)가 틀리면 저장 그대로·solved:false.
 * incident: 장 파일에서 받은 사건 본문(시도 목록으로 결과를 대조). id가 색인에 없으면 저장 그대로.
 * 첫 해결이면 XP(GUARD_XP): grantOrderXP와 같은 길(earnXp → 퀘스트 "xp"만 tick → 배지). 바이트는 직접 주지 않는다.
 * @returns { save, outcome: { solved, firstSolve, firstTry, xp, streakUp, streak, milestone, finished, chest, newBadges } }
 */
export function applyGuardRun(save, incident, result, how, now = new Date()) {
  if (!isObj(incident) || !Array.isArray(incident.tries)) {
    throw new TypeError("applyGuardRun: pass the loaded incident body (with tries), not an id");
  }
  const BY_ID = byId();
  const id = incident.id;
  const inc = typeof id === "string" ? BY_ID[id] : undefined;
  const g0 = cleanGuard(save?.guard);
  const none = { solved: false, firstSolve: false, firstTry: false, xp: 0, streakUp: false,
    streak: save?.streak?.days ?? 0, milestone: null, finished: [], chest: false, newBadges: [] };
  if (!inc || !guardConsistent(guardInput(incident), result)) return { save, outcome: none };

  const solved = result.solved === true;
  const already = !!g0.solved[id];
  const attemptsBefore = g0.attempts[id] ?? 0;
  let s = structuredClone(save);
  const g = cleanGuard(s.guard);
  g.attempts[id] = attemptsBefore + 1;
  g.runs += 1;
  s.guard = g;

  if (!solved || already) {
    return { save: s, outcome: { ...none, solved, streak: s.streak?.days ?? 0 } };
  }

  const firstTry = attemptsBefore === 0;
  g.solved[id] = { firstTry, how: how === "code" ? "code" : "blank" };
  const today = localDate(now);
  const goalBefore = s.streak.lastGoalDate;
  const earned = earnXp(s, GUARD_XP, today);
  s = earned.save;
  const streakUp = s.streak.lastGoalDate === today && goalBefore !== today;
  s = ensureQuests(s, today);
  const q = tick(s, "xp", today, GUARD_XP);
  s = q.save;
  s.last_active_at = now.toISOString();

  const got = checkBadges(s, { hour: now.getHours(), lessonDone: false, advancedIds: [] });
  s.badges = [...s.badges, ...got];
  const had = new Set(save.badges || []);
  return {
    save: s,
    outcome: { solved: true, firstSolve: true, firstTry, xp: GUARD_XP, streakUp, streak: s.streak.days,
      milestone: earned.milestone, finished: q.finished, chest: q.chest, newBadges: s.badges.filter((b) => !had.has(b)) },
  };
}
