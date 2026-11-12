// v0.15 경비실 저장·보상·등급 (설계 docs/specs/2026-11-12-경비실-설계.md §5)
//
// 저장 save.guard (saveVer 2 그대로, 없거나 망가지면 cleanGuard가 기본값으로 채움):
//   { v:1, solved:{ 사건id: { firstTry, how:"blank"|"code" } }, code:{ 사건id: 코드 }, blanks:{ 사건id: [고른 보기|null…] },
//     seen:[본 사건 id…], attempts:{ 사건id: 실행 횟수 }, runs }
// 보상: 경비실은 바이트를 직접 주지 않는다. 사건을 처음 해결하면 XP(GUARD_XP)만 earnXp·퀘스트("xp")로 흘려 보낸다.
import { INCIDENTS, GUARD_XP } from "../../data/guard.js";
import { earnXp } from "../rules.js";
import { ensureQuests, tick } from "../quests.js";
import { checkBadges } from "../badges.js";
import { localDate } from "../today.js";
import { lang } from "../i18n.js";

const GUARD_VER = 1;
const CODE_MAX = 4000;
// 상속 이름(toString 등)이 id로 통과하지 않게 프로토타입 없는 객체로
const BY_ID = Object.assign(Object.create(null), Object.fromEntries(INCIDENTS.map((i) => [i.id, i])));
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const nonNeg = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);

export const RANKS = [
  { id: "apprentice", min: 0 },
  { id: "keeper", min: 2 },
  { id: "captain", min: 4 },
  { id: "sheriff", min: 6 },
];

export function newGuard() {
  return { v: GUARD_VER, solved: {}, code: {}, blanks: {}, seen: [], attempts: {}, runs: 0 };
}

/** 저장의 guard 칸 하나를 모양·범위에 맞춘 새 객체로. 객체가 아니면 새 경비실 */
export function cleanGuard(raw) {
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
      g.blanks[id] = inc.blanks.map((b, k) => (Number.isInteger(arr[k]) && arr[k] >= 0 && arr[k] < b.options.length ? arr[k] : null));
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
/** 이 사건이 열렸나(필요한 장 통과) */
export const incidentOpen = (incident, passed) => toSet(passed).has(incident.need);

/** 열린 사건 중 아직 본 적 없는 것이 있나(하단 메뉴 새 소식 점) */
export function guardNews(guard, passed) {
  const p = toSet(passed);
  const seen = new Set(cleanGuard(guard).seen);
  return INCIDENTS.some((i) => p.has(i.need) && !seen.has(i.id));
}

export function markSeen(guard, id) {
  const g = cleanGuard(guard);
  if (!BY_ID[id] || g.seen.includes(id)) return g;
  return { ...g, seen: [...g.seen, id] };
}

/** 엔진에 넘길 입력. 영어면 value_en ?? value */
export function guardInput(incident, l = lang()) {
  const tries = incident.tries.map((t) => ({ value: l === "en" ? (t.value_en ?? t.value) : t.value, expect: t.expect }));
  const input = { mode: incident.mode, tries };
  if (incident.password !== undefined) input.password = incident.password;
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
    const ok = expect === "block" ? e.verdict === "block" : e.verdict !== "block";
    if (e.ok !== ok) return false;
    if (ok) stats[expect === "block" ? "attacks_blocked" : "guests_allowed"]++;
  }
  for (const k of Object.keys(stats)) if (r.stats[k] !== stats[k]) return false;
  const stopped = r.stopped === "error" ? "error" : null;
  if (r.stopped !== null && r.stopped !== undefined && r.stopped !== "error") return false;
  const solved = !stopped && n > 0 && ev.length === n && ev.every((e) => e.ok);
  return r.solved === solved;
}

/** 해결한 사건 수로 등급 id */
export function rankOf(guard) {
  const n = Object.keys(cleanGuard(guard).solved).length;
  let id = RANKS[0].id;
  for (const r of RANKS) if (n >= r.min) id = r.id;
  return id;
}

/**
 * 실행 결과를 저장에 반영. 결과 대조(guardConsistent)가 틀리면 저장 그대로·solved:false.
 * 첫 해결이면 XP(GUARD_XP): grantOrderXP와 같은 길(earnXp → 퀘스트 "xp"만 tick → 배지). 바이트는 직접 주지 않는다.
 * @returns { save, outcome: { solved, firstSolve, firstTry, xp, streakUp, streak, milestone, finished, chest, newBadges } }
 */
export function applyGuardRun(save, id, result, how, now = new Date()) {
  const inc = BY_ID[id];
  const g0 = cleanGuard(save?.guard);
  const none = { solved: false, firstSolve: false, firstTry: false, xp: 0, streakUp: false,
    streak: save?.streak?.days ?? 0, milestone: null, finished: [], chest: false, newBadges: [] };
  if (!inc || !guardConsistent(guardInput(inc), result)) return { save, outcome: none };

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
