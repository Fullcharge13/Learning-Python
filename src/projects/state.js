// v0.21.0 프로젝트 공방 저장·보상·언어 묶임 (설계 docs/specs/2026-11-15-프로젝트-공방-설계.md §4-5·§4-6·§7)
//
// 저장 save.projects (saveVer 2 그대로, 없거나 망가지면 cleanProjects가 기본값으로 채움):
//   { v: 1,
//     open: { P1: { lang: "ko"|"en", step: 지금 단계(0부터), code: 지금 단계 코드(""이면 시작 코드),
//                   best: XP를 받은 단계 수(다시 해도 같은 단계 XP를 또 주지 않음),
//                   kept?: { ko|en: { step, code } } — 지금 언어가 아닌 언어의 진행(지우지 않음, §7). 그 언어로 돌아오면 이어 함 } },
//     done: { P1: { at: "YYYY-MM-DD"|null, code: 완성작, lang } } }   — 진열장에서 실행하는 완성작
// 진행은 시작한 언어에 묶인다(open.<id>.lang). 다른 언어로 열면 stepState가 langMismatch로 알려 주고,
// 화면은 「그 언어로 바꿔 이어 하기」 또는 restartInLang(이 언어로 — kept에 그 언어 진행이 있으면 거기서 이어,
// 없으면 처음부터. stepState의 resume으로 미리 앎)을 고르게 한다. 어느 언어 진행도 지우지 않는다(검토 I2).
// 보상: 단계 첫 통과 XP 5(「모범 코드에서 이어 하기」면 0), 마지막 단계 통과 때 완성 XP 20(처음 완성할 때만).
//   XP는 경비실(src/guard/state.js applyGuardRun)과 같은 길: earnXp → 퀘스트 "xp" tick → 배지. 바이트는 없음.
// 단계 수는 색인(catalog.js의 projectIndexEntry 모양)에서 안다. 앱은 setProjectIndex로 한 번 넣는다
// (배포판 window.RIA_PROJECT_INDEX, 개발판 projectdev.js 원본으로 만든 색인).
// cleanProjects는 색인 없이도 돈다(그때는 id 모양만 보고 단계 범위는 맞추지 않음). passStep은 색인이 꼭 있어야 한다.
import { earnXp, isDate } from "../rules.js";
import { ensureQuests, tick } from "../quests.js";
import { checkBadges } from "../badges.js";
import { localDate } from "../today.js";

export const PROJECT_STEP_XP = 5;
export const PROJECT_DONE_XP = 20;
const PROJECTS_VER = 1;
const CODE_MAX = 8000;
const ID_RE = /^P[1-9]\d*$/;
const LANGS = ["ko", "en"];

// ---- 색인 ----
let BY_ID = null;   // 상속 이름(toString 등)이 id로 통과하지 않게 프로토타입 없는 객체로
let INDEX = null;
const okEntry = (e) => !!e && typeof e === "object" && typeof e.id === "string" && ID_RE.test(e.id)
  && Number.isInteger(e.need) && Number.isInteger(e.steps) && e.steps >= 1;

/** 프로젝트 색인 넣기(앱 시작 때 한 번). 비었거나 모양이 틀리면 던짐 */
export function setProjectIndex(entries) {
  if (!Array.isArray(entries) || entries.length === 0 || !entries.every(okEntry)) {
    throw new Error("setProjectIndex: project index must be a non-empty array of { id: \"P1\", need, steps }");
  }
  INDEX = Object.freeze(entries.map((e) => Object.freeze({ ...e })));
  BY_ID = Object.assign(Object.create(null), Object.fromEntries(INDEX.map((e) => [e.id, e])));
}
/** 시험 전용: 색인을 비운다 */
export function clearProjectIndex() {
  INDEX = null;
  BY_ID = null;
}
/** 색인 목록(원본 순서). 없으면 던짐 */
export function projectIndex() {
  if (!INDEX) throw new Error("project index is not set: call setProjectIndex() first");
  return INDEX;
}

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const nonNegInt = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
const okLang = (l) => LANGS.includes(l);
const codeOf = (v) => (typeof v === "string" ? v.slice(0, CODE_MAX) : "");
/** 저장에 둘 수 있는 id인가: 모양이 맞고, 색인이 있으면 색인에도 있음 */
const knownId = (id) => typeof id === "string" && ID_RE.test(id) && (!BY_ID || !!BY_ID[id]);
/** 단계 번호를 그 프로젝트 단계 수 안으로(색인이 없으면 음이 아닌 정수로만) */
function clampStep(id, step) {
  const n = nonNegInt(step);
  return BY_ID && BY_ID[id] ? Math.min(n, BY_ID[id].steps - 1) : n;
}

export function newProjects() {
  return { v: PROJECTS_VER, open: {}, done: {} };
}

function cleanOpen(id, v) {
  const lang = okLang(v.lang) ? v.lang : "ko";
  const step = clampStep(id, v.step);
  let best = Math.max(step, nonNegInt(v.best));
  if (BY_ID && BY_ID[id]) best = Math.min(best, BY_ID[id].steps);
  const out = { lang, step, code: codeOf(v.code), best };
  if (isObj(v.kept)) {
    const kept = {};
    for (const l of LANGS) {
      if (l !== lang && isObj(v.kept[l])) kept[l] = { step: clampStep(id, v.kept[l].step), code: codeOf(v.kept[l].code) };
    }
    if (Object.keys(kept).length) out.kept = kept;
  }
  return out;
}

/** 저장의 projects 칸 하나를 모양·범위에 맞춘 새 객체로. 객체가 아니면 새 공방 */
export function cleanProjects(raw) {
  const p = newProjects();
  if (!isObj(raw)) return p;
  if (isObj(raw.open)) {
    for (const [id, v] of Object.entries(raw.open)) if (knownId(id) && isObj(v)) p.open[id] = cleanOpen(id, v);
  }
  if (isObj(raw.done)) {
    for (const [id, v] of Object.entries(raw.done)) {
      if (!knownId(id) || !isObj(v)) continue;
      p.done[id] = { at: isDate(v.at) ? v.at : null, code: codeOf(v.code), lang: okLang(v.lang) ? v.lang : "ko" };
    }
  }
  return p;
}

const toSet = (p) => (p instanceof Set ? p : new Set(p || []));
/** 이 프로젝트가 열렸나: 필요한 장(entry.need) 통과, 개발자 모드면 모두 */
export const projectOpen = (entry, passed, dev = false) => dev === true || (!!entry && toSet(passed).has(entry.need));

/**
 * 지금 단계와 코드. 진행이 없으면 { step: 0, code: "" }(코드가 ""이면 화면은 시작 코드).
 * langMismatch: 진행이 다른 언어에 묶여 있으면 그 언어("ko"|"en"), 아니면 null. 그때 step·code는 그 언어의 것이다.
 * resume: langMismatch일 때 lang 쪽에 남겨 둔 진행이 있으면 { step }(restartInLang이 거기서 이어 함), 아니면 null.
 */
export function stepState(save, id, lang) {
  const p = cleanProjects(save?.projects);
  const cur = knownId(id) ? p.open[id] : undefined;
  if (!cur) return { step: 0, code: "", langMismatch: null, resume: null };
  if (cur.lang === lang) return { step: cur.step, code: cur.code, langMismatch: null, resume: null };
  const k = cur.kept && cur.kept[lang];
  return { step: cur.step, code: cur.code, langMismatch: cur.lang, resume: k ? { step: k.step } : null };
}

function withProjects(save, projects) {
  return { ...save, projects };
}

/** 지금 단계의 초안 저장. 지금 단계·같은 언어일 때만(아니면 같은 저장). 진행이 없으면 첫 단계에서 시작 */
export function saveDraft(save, id, lang, step, code) {
  if (!knownId(id) || !okLang(lang) || typeof code !== "string") return save;
  const p = cleanProjects(save?.projects);
  const cur = p.open[id] || { lang, step: 0, code: "", best: 0 };
  if (cur.lang !== lang || cur.step !== step) return save;
  p.open[id] = { ...cur, code: codeOf(code) };
  return withProjects(save, p);
}

/**
 * 단계 통과를 저장에 반영하고 XP를 준다(earnXp → 퀘스트 "xp" → 배지, 경비실과 같은 길).
 * 지금 단계·같은 언어가 아니면 아무것도 하지 않는다(xp 0).
 * XP: 아직 XP를 받지 않은 단계(best 이상)이고 usedSolution이 아니면 PROJECT_STEP_XP.
 *     마지막 단계면 완성: done[id] = { at, code, lang }, open에서 뺌, 처음 완성이면 + PROJECT_DONE_XP(usedSolution이어도).
 *     이미 완성한 프로젝트를 다시 만들면 XP 없이 진열장 코드만 새것으로.
 * @param now Date(지금 시각) 또는 "YYYY-MM-DD"
 * @returns { save, xp, completed, streakUp, milestone, levelUp, levelBytes, finished, chest, newBadges }
 */
export function passStep(save, id, lang, step, code, { usedSolution = false } = {}, now = new Date()) {
  const entry = projectIndex().find((e) => e.id === id);
  const none = { save, xp: 0, completed: false, streakUp: false, milestone: null, levelUp: null, levelBytes: 0, finished: [], chest: false, newBadges: [] };
  if (!entry || !okLang(lang) || typeof code !== "string") return none;
  const p0 = cleanProjects(save?.projects);
  const cur = p0.open[id] || { lang, step: 0, code: "", best: 0 };
  if (cur.lang !== lang || cur.step !== step) return none;

  const already = !!p0.done[id];
  const last = step === entry.steps - 1;
  const p = structuredClone(p0);
  let xp = 0;
  if (!already && !usedSolution && step >= cur.best) xp += PROJECT_STEP_XP;
  const best = Math.max(cur.best, step + 1);
  const date = typeof now === "string" && isDate(now) ? now : localDate(now instanceof Date ? now : new Date());
  if (last) {
    if (!already) xp += PROJECT_DONE_XP;
    p.done[id] = { at: date, code: codeOf(code), lang };
    // 다른 언어에 남겨 둔 진행이 있으면 그것이 open으로 돌아온다(지우지 않음, §7). 없으면 open에서 뺌
    const other = cur.kept && LANGS.find((l) => l !== lang && cur.kept[l]);
    if (other) p.open[id] = { lang: other, step: cur.kept[other].step, code: cur.kept[other].code, best };
    else delete p.open[id];
  } else {
    p.open[id] = { ...cur, step: step + 1, code: codeOf(code), best };
  }
  let s = withProjects(structuredClone(save), p);
  const out = { xp, completed: last, streakUp: false, milestone: null, levelUp: null, levelBytes: 0, finished: [], chest: false, newBadges: [] };
  if (xp > 0) {
    const goalBefore = s.streak?.lastGoalDate;
    const earned = earnXp(s, xp, date);
    s = earned.save;
    out.streakUp = s.streak.lastGoalDate === date && goalBefore !== date;
    out.milestone = earned.milestone;
    out.levelUp = earned.levelUp; // v0.22.0 레벨업 선물(바이트는 이미 저장에 들어 있음)
    out.levelBytes = earned.levelUp ? earned.levelUp.bytes : 0;
    s = ensureQuests(s, date);
    const q = tick(s, "xp", date, xp);
    s = q.save;
    out.finished = q.finished;
    out.chest = q.chest;
  }
  const at = now instanceof Date ? now : new Date();
  s.last_active_at = at.toISOString();
  const got = checkBadges(s, { hour: at.getHours(), lessonDone: false, advancedIds: [] });
  if (got.length) s.badges = [...(s.badges || []), ...got];
  const had = new Set(save?.badges || []);
  out.newBadges = (s.badges || []).filter((b) => !had.has(b));
  return { save: s, ...out };
}

/**
 * 이 언어로 하기(§7 「아니면 이 언어로」). 지금 언어 진행은 kept로 옮기고(지우지 않음), kept에 이 언어 진행이 있으면
 * 거기서 이어, 없으면 처음부터. 받은 XP 기록(best)은 그대로(같은 단계 XP를 또 주지 않음).
 * 지금 언어와 같은 언어면 그 언어만 처음부터(다른 언어 kept는 그대로).
 */
export function restartInLang(save, id, lang) {
  if (!knownId(id) || !okLang(lang)) return save;
  const p = cleanProjects(save?.projects);
  const cur = p.open[id];
  if (!cur) {
    p.open[id] = { lang, step: 0, code: "", best: 0 };
    return withProjects(save, p);
  }
  const kept = { ...(cur.kept || {}) };
  let from = null;
  if (cur.lang !== lang) {
    from = kept[lang] || null;
    delete kept[lang];
    kept[cur.lang] = { step: cur.step, code: cur.code };
  }
  const next = { lang, step: from ? from.step : 0, code: from ? from.code : "", best: cur.best };
  if (Object.keys(kept).length) next.kept = kept;
  p.open[id] = next;
  return withProjects(save, p);
}
