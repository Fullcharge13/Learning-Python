// 저장: localStorage 한 칸에 JSON 하나. 옛 저장은 migrate로 새 형식에 맞춘다.
// saveVer 2 (v0.6): 의상 10벌로 교체 — 옛 의상 id를 새 id로 옮기고, 없어진 의상은 바이트로 돌려준다.
import { OUTFITS, OUTFIT_RENAME_V2, OUTFIT_REFUND_V2 } from "../data/outfits.js";
import { cleanSeenUpdates } from "./newcontent.js";
import { newDaily, cleanDaily } from "./daily.js";
import { newGarden, cleanGarden } from "./garden/state.js";
import { newGuard, cleanGuard } from "./guard/state.js";
import { isDate, DAILY_GOALS } from "./rules.js";
import { t, normLang } from "./i18n.js";

export const SAVE_KEY = "ria-python.save";
export const SAVE_VER = 2;
const LOG_CAP = 50;
const BROKEN_SLOTS = 5; // .broken 다음 .broken.1 ~ .broken.5
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function newSave() {
  return {
    saveVer: SAVE_VER,
    current_chapter: 1, current_lesson: "1-1",
    completed_lessons: [],
    submission_logs: [],
    grading_results: {},
    weak_concepts: {},
    review_queue: [],
    last_active_at: null,
    xp: 0, bytes: 0,
    streak: { days: 0, best: 0, lastGoalDate: null, todayDate: null, todayXp: 0 },
    freezes: 0,
    quests: { date: null, ids: [], progress: {}, done: [], chest: false },
    badges: [], outfits: ["basic"], outfit: "basic",
    stats: { lessons: 0, perfect: 0, hintfree: 0, fixed: 0, review_items: 0 },
    settings: { sound: true, dailyGoal: 20, name: "", lang: "ko", langChosen: false }, // lang: v0.13.0 영어판(ko|en). langChosen: v0.14.3 언어 단추를 직접 눌렀는지(아니면 열 때마다 휴대폰 언어)
    pending_refund: 0, // saveVer 1→2에서 돌려준 바이트. 홈에서 한 번 알리고 0으로 (판정 C42)
    seen_updates: {},  // v0.7.1 「새 내용」 점: { 레슨 id: 끝까지 다시 본 판 "v0.7.1" }. saveVer 그대로, 없으면 {}
    daily: newDaily(), // v0.9 매일 도전 { date, picks, done, streak, best, last_done_date }. saveVer 그대로, 없으면 기본값
    garden: newGarden(), // v0.10 파이의 텃밭(src/garden/state.js). saveVer 그대로, 없거나 망가지면 기본값
    guard: newGuard(),   // v0.15 경비실(src/guard/state.js). saveVer 그대로, 없거나 망가지면 기본값
    goal_pending: null,  // v0.12.1 하루 목표 예약 { value: 10|20|30, from: "YYYY-MM-DD" } — 바꾼 목표는 다음 날부터(rules.js)
    broken_notice: null, // v0.12.1 깨진 저장을 남긴 칸 이름. 홈에서 한 번 알리고 null로
  };
}

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

// 위험한 키를 빼고 얕게 복사한다.
function safeCopy(obj) {
  const out = {};
  for (const key of Object.keys(obj)) if (!BAD_KEYS.has(key)) out[key] = obj[key];
  return out;
}

// 기본값의 종류에 맞는 옛 값만 받아들이고, 아니면 기본값을 쓴다.
function coerce(d, v) {
  if (d === null) return v;                                   // null 기본: 무엇이든 받음
  if (Array.isArray(d)) return Array.isArray(v) ? v : d;
  if (typeof d === "number") {
    if (typeof v === "number") return Number.isFinite(v) ? v : d;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    }
    return d;
  }
  if (typeof d === "boolean") return typeof v === "boolean" ? v : d;
  if (typeof d === "string") return typeof v === "string" ? v : d;
  if (isPlainObject(d)) {
    if (!isPlainObject(v)) return d;
    return Object.keys(d).length > 0 ? fill(d, v) : safeCopy(v);
  }
  return v;
}

// 기본값 위에 옛 값을 덮는다. 기본값에 없는 칸은 그대로 남긴다.
function fill(defaults, raw) {
  const out = { ...defaults };
  for (const key of Object.keys(raw)) {
    if (BAD_KEYS.has(key)) continue;
    out[key] = Object.hasOwn(defaults, key) ? coerce(defaults[key], raw[key]) : raw[key];
  }
  return out;
}

const MAX_FREEZES = 2;
const nonNegInt = (v) => Math.max(0, Math.floor(v));

// 값의 범위를 맞춘다(타입은 fill에서 이미 숫자로 맞춰져 있음).
function clampRanges(s) {
  s.settings.lang = normLang(s.settings.lang); // v0.13.0: 모르는 값은 ko
  s.freezes = Math.min(MAX_FREEZES, nonNegInt(s.freezes));
  s.xp = nonNegInt(s.xp);
  s.bytes = nonNegInt(s.bytes);
  s.pending_refund = nonNegInt(s.pending_refund);
  s.streak.days = nonNegInt(s.streak.days);
  s.streak.best = nonNegInt(s.streak.best);
  for (const k of Object.keys(s.stats)) {
    if (typeof s.stats[k] === "number") s.stats[k] = nonNegInt(s.stats[k]);
  }
  const wc = {};
  for (const [k, v] of Object.entries(s.weak_concepts)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) wc[k] = v;
  }
  s.weak_concepts = wc;
  s.seen_updates = cleanSeenUpdates(s.seen_updates);
  cleanTypes(s);
  s.daily = cleanDaily(s.daily);
  s.garden = cleanGarden(s.garden);
  s.guard = cleanGuard(s.guard);
  return s;
}

const strs = (a) => a.filter((x) => typeof x === "string");
const dateOrNull = (v) => (isDate(v) ? v : null);
const BROKEN_KEY_RE = /^ria-python\.(dev\.)?save\.broken(\.[1-9])?$/;

// 칸 안쪽 값의 종류를 맞춘다(v0.12.1, QA): 배열 속 이상한 값, 숫자가 아닌 통계, 날짜가 아닌 날짜 칸 등
function cleanTypes(s) {
  s.completed_lessons = [...new Set(strs(s.completed_lessons))];
  s.review_queue = [...new Set(strs(s.review_queue))];
  s.badges = [...new Set(strs(s.badges))];
  s.submission_logs = s.submission_logs.filter(isPlainObject);
  const gr = {};
  for (const [k, v] of Object.entries(s.grading_results)) if (isPlainObject(v)) gr[k] = v;
  s.grading_results = gr;
  for (const k of Object.keys(s.stats)) {
    const v = s.stats[k];
    s.stats[k] = typeof v === "number" && Number.isFinite(v) ? nonNegInt(v) : 0;
  }
  s.streak.lastGoalDate = dateOrNull(s.streak.lastGoalDate);
  s.streak.todayDate = dateOrNull(s.streak.todayDate);
  s.streak.todayXp = Math.max(0, s.streak.todayXp);
  if (typeof s.last_active_at !== "string") s.last_active_at = null;
  const q = s.quests;
  q.date = dateOrNull(q.date);
  q.ids = strs(q.ids);
  q.done = strs(q.done);
  const prog = {};
  for (const [k, v] of Object.entries(q.progress)) if (typeof v === "number" && Number.isFinite(v) && v >= 0) prog[k] = v;
  q.progress = prog;
  const gp = s.goal_pending;
  s.goal_pending = isPlainObject(gp) && DAILY_GOALS.includes(gp.value) && isDate(gp.from) ? { value: gp.value, from: gp.from } : null;
  s.broken_notice = typeof s.broken_notice === "string" && BROKEN_KEY_RE.test(s.broken_notice) ? s.broken_notice : null;
  return s;
}

const OUTFIT_ORDER = OUTFITS.map((o) => o.id);

// 가진 의상·입은 의상 정리. fromV1이면 옛 id를 옮기고 없어진 의상 값을 돌려준다(한 벌에 한 번).
// 결과: 의상 표 순서, 중복 없음, basic 항상 포함, 표에 없는 id는 버림. 입은 옷이 가진 옷이 아니면 basic.
function migrateOutfits(s, fromV1) {
  const raw = new Set(s.outfits.filter((x) => typeof x === "string"));
  const owned = new Set(["basic"]);
  let refund = 0;
  for (const id of raw) {
    if (fromV1 && Object.hasOwn(OUTFIT_REFUND_V2, id)) refund += OUTFIT_REFUND_V2[id];
    else owned.add(fromV1 && Object.hasOwn(OUTFIT_RENAME_V2, id) ? OUTFIT_RENAME_V2[id] : id);
  }
  s.outfits = OUTFIT_ORDER.filter((id) => owned.has(id));
  let worn = typeof s.outfit === "string" ? s.outfit : "basic";
  if (fromV1 && Object.hasOwn(OUTFIT_RENAME_V2, worn)) worn = OUTFIT_RENAME_V2[worn];
  s.outfit = s.outfits.includes(worn) ? worn : "basic";
  s.bytes += refund;
  if (fromV1) s.pending_refund += refund;
  return s;
}

export function migrate(raw) {
  if (!isPlainObject(raw)) return newSave();
  const oldVer = raw.saveVer;
  const ver = typeof oldVer === "number" && Number.isFinite(oldVer) ? oldVer : 1; // saveVer 없음 = 첫 판(1)
  // v0.14.3: langChosen 칸이 없던 저장(쓰던 사람)은 「고른 것」으로 친다 — 열었을 때 갑자기 언어가 바뀌지 않게.
  // false로 저장된 것만 휴대폰 언어를 따른다(이상한 값도 「고른 것」).
  const rawSet = isPlainObject(raw.settings) ? raw.settings : {};
  const chosen = Object.hasOwn(rawSet, "langChosen") ? rawSet.langChosen !== false : true;
  const s = clampRanges(fill(newSave(), structuredClone(raw)));
  s.settings.langChosen = chosen;
  migrateOutfits(s, ver < 2);
  s.saveVer = ver > SAVE_VER ? ver : SAVE_VER;
  return s;
}

// 환불 안내(판정 C42): 알릴 금액과 깃발을 내린(0) 새 저장. 알릴 것이 없으면 같은 저장을 그대로 돌려준다.
export function takeRefundNotice(save) {
  const bytes = save && Number.isInteger(save.pending_refund) && save.pending_refund > 0 ? save.pending_refund : 0;
  return bytes ? { save: { ...save, pending_refund: 0 }, bytes } : { save, bytes: 0 };
}
// 깨진 저장 안내(v0.12.1, QA): 남긴 칸 이름과 깃발을 내린(null) 새 저장. 없으면 같은 저장
export function takeBrokenNotice(save) {
  const key = save && typeof save.broken_notice === "string" ? save.broken_notice : null;
  return key ? { save: { ...save, broken_notice: null }, key } : { save, key: null };
}
// 한국어 원문(시험용). 화면에는 brokenNoticeText()로 낸다
export const BROKEN_NOTICE_TEXT = "저장을 읽지 못해 새로 시작했어요. 설정 → 저장 가져오기로 옛 기록을 되살릴 수 있어요"; // I18N_SKIP: 한국어 원문 상수, 화면은 brokenNoticeText()
export const brokenNoticeText = () => t`저장을 읽지 못해 새로 시작했어요. 설정 → 저장 가져오기로 옛 기록을 되살릴 수 있어요`;

export const refundNoticeText = (n) => t`없어진 옷 값 ${n}바이트를 돌려 드렸어요. 새 옷도 구경해 보세요!`;

// 깨진 원본을 남긴다. 이미 남긴 것은 덮지 않고 .broken.1 ~ .broken.5 중 빈 칸에 쓴다(모두 차면 .broken.5를 덮음).
// key: 저장 칸(기본 학습 기록. 개발자 모드 저장은 src/devmode.js가 자기 키를 넘김)
function keepBroken(storage, text, key = SAVE_KEY) {
  const keys = [key + ".broken"];
  for (let i = 1; i <= BROKEN_SLOTS; i++) keys.push(`${key}.broken.${i}`);
  try {
    const free = keys.find((k) => storage.getItem(k) === null);
    const at = free ?? keys[keys.length - 1];
    storage.setItem(at, text);
    return at;
  } catch { return null; /* 남기지 못해도 새 저장으로 시작 */ }
}

export function loadEx(storage, key = SAVE_KEY) {
  let text;
  try {
    text = storage.getItem(key);
  } catch {
    return { save: newSave(), readFailed: true, brokenKey: null, fresh: false };
  }
  if (text === null || text === undefined) return { save: newSave(), readFailed: false, brokenKey: null, fresh: true }; // fresh: v0.13.0 처음 여는 사람
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { save: newSave(), readFailed: false, brokenKey: keepBroken(storage, text, key), fresh: false };
  }
  if (!isPlainObject(raw)) {
    return { save: newSave(), readFailed: false, brokenKey: keepBroken(storage, text, key), fresh: false };
  }
  return { save: migrate(raw), readFailed: false, brokenKey: null, fresh: false };
}

export function load(storage, key = SAVE_KEY) {
  return loadEx(storage, key).save;
}

export function store(storage, save, key = SAVE_KEY) {
  const logs = Array.isArray(save.submission_logs) ? save.submission_logs.slice(-LOG_CAP) : [];
  try {
    storage.setItem(key, JSON.stringify({ ...save, submission_logs: logs }));
    return true;
  } catch {
    return false;
  }
}
