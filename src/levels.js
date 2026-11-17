// v0.22.0 레벨(설계 §5-1, §5-2, §5-5). 순수 함수만.
// 레벨은 늘 save.xp에서 계산한다(따로 저장하지 않음). save.levels에는 받은 최고 레벨(granted)만 적는다.
// 60·10(곡선)과 20·2(선물)는 작업 3 시뮬레이션 판정에서만 바꾼다 — 바꾸면 설계서 §5와 LOG도 함께 고친다.

export const LEVEL_MAX = 30;
export const LEVEL_BASE = 60;   // 1→2에 필요한 XP
export const LEVEL_STEP = 10;   // 레벨마다 더 필요한 XP
export const GIFT_BASE = 20;    // 레벨업 선물 = GIFT_BASE + GIFT_STEP × L 바이트
export const GIFT_STEP = 2;
export const WELCOME_STEP = 10; // 기존 학습자 환영 선물 = min(WELCOME_STEP × (레벨 − 1), WELCOME_CAP)
export const WELCOME_CAP = 200;

const TITLES = ["새싹", "떡잎", "정원사", "탐험가", "연구원", "마스터 파이썬"]; // I18N_SKIP: 한국어 이름표, 영어는 key로
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const okXp = (xp) => (typeof xp === "number" && Number.isFinite(xp) && xp > 0 ? xp : 0);
const clampLevel = (L) => Math.min(LEVEL_MAX, Math.max(1, Number.isFinite(L) ? Math.floor(L) : 1));

/** 레벨 L에 닿는 누적 XP. 1이면 0 */
export function xpForLevel(L) {
  const n = clampLevel(L) - 1;
  return LEVEL_BASE * n + (LEVEL_STEP / 2) * n * (n - 1);
}

/** 누적 XP의 레벨(1~30). 음수·NaN·숫자가 아니면 1 */
export function levelOf(xp) {
  const x = okXp(xp);
  let L = 1;
  while (L < LEVEL_MAX && x >= xpForLevel(L + 1)) L++;
  return L;
}

/** 다음 레벨까지의 막대용. 최고 레벨이면 need 0 */
export function levelProgress(xp) {
  const level = levelOf(xp);
  if (level >= LEVEL_MAX) return { level, into: 0, need: 0 };
  const base = xpForLevel(level);
  return { level, into: okXp(xp) - base, need: xpForLevel(level + 1) - base };
}

/** 레벨 L에 올랐을 때의 선물 바이트 */
export const levelGift = (L) => GIFT_BASE + GIFT_STEP * L;

/** 이름표: 5레벨마다 바뀐다. key는 영어판 열쇠(level.title.1~6) */
export function levelTitle(L) {
  const tier = Math.floor((clampLevel(L) - 1) / 5);
  return { ko: TITLES[tier], key: `level.title.${tier + 1}` };
}

/** 기존 학습자 환영 선물(레벨 1이면 0) */
export const welcomeGift = (L) => Math.min(WELCOME_STEP * (clampLevel(L) - 1), WELCOME_CAP);

export const newLevels = () => ({ granted: 1, pending_welcome: 0, legacy: false });

/**
 * 저장의 levels 칸 정리(clean-or-default). 망가진 granted의 기본값은 levelOf(xp) — 지나간 선물을 다시 주지 않게.
 * 망가진 legacy의 기본값은 xp > 0. 바른 granted는 그대로 둔다(지금 레벨보다 낮아도 applyLevels가 이전 XP의 레벨부터 세므로 다시 주지 않음).
 */
export function cleanLevels(raw, xp) {
  const now = levelOf(xp);
  const r = isObj(raw) ? raw : {};
  const g = r.granted;
  const granted = Number.isInteger(g) && g >= 1 ? Math.min(LEVEL_MAX, g) : now;
  const w = r.pending_welcome;
  const pending_welcome = Number.isInteger(w) && w > 0 ? Math.min(w, WELCOME_CAP) : 0;
  // 망가진 levels(객체가 아니거나 legacy가 참·거짓이 아님)는 legacy = xp > 0 — 기존 학습자가 원래 8벌 예외를 잃지 않게(판정)
  const legacy = isObj(raw) && typeof r.legacy === "boolean" ? r.legacy : okXp(xp) > 0;
  return { granted, pending_welcome, legacy };
}

/**
 * 업데이트 뒤 처음 열 때 levels 칸이 없는 저장(설계 §5-5): 지금 레벨까지는 받은 것으로 치고, 환영 선물을 한 번 준다.
 * @returns {{ levels, bytes }} bytes는 save.bytes에 더할 환영 선물
 */
export function welcomeLevels(xp) {
  const granted = levelOf(xp);
  const bytes = welcomeGift(granted);
  return { levels: { granted, pending_welcome: bytes, legacy: okXp(xp) > 0 }, bytes };
}

/**
 * XP가 바뀐 뒤 레벨업 선물을 준다. 여러 레벨이면 합해서 한 번에. 이미 받은 레벨(granted)과
 * 이전 XP의 레벨까지는 주지 않는다.
 * @returns {{ save, levelUp: { from, to, bytes } | null }}
 */
export function applyLevels(prevSave, nextSave) {
  const prevLv = isObj(prevSave?.levels) ? prevSave.levels : null;
  const granted = Number.isInteger(prevLv?.granted) ? prevLv.granted : 1;
  const from = Math.max(granted, levelOf(prevSave?.xp));
  const to = levelOf(nextSave.xp);
  if (to <= from) return { save: nextSave, levelUp: null };
  let bytes = 0;
  for (let L = from + 1; L <= to; L++) bytes += levelGift(L);
  const levels = { ...newLevels(), ...(isObj(nextSave.levels) ? nextSave.levels : {}), granted: to };
  const cur = typeof nextSave.bytes === "number" && Number.isFinite(nextSave.bytes) ? nextSave.bytes : 0;
  return { save: { ...nextSave, bytes: cur + bytes, levels }, levelUp: { from, to, bytes } };
}
