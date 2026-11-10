// 저장 가져오기 검사 (v0.12.1, QA). 순수 함수만.
// - 아무 JSON이나 받아 진행을 지우지 않도록: saveVer 숫자 또는 completed_lessons 배열이 있고,
//   그 밖에 저장의 아는 키가 하나 이상 있어야 리아와 파이썬! 저장으로 본다.
// - 확인 창에 요약과, 지금보다 끝낸 레슨이 적으면 그 수를 알린다.
import { newSave } from "./save.js";
import { t } from "./i18n.js";

// 한국어 원문(시험·열쇠 대조용). 화면에는 notSaveText()로 낸다
export const NOT_SAVE_TEXT = "리아와 파이썬! 저장 파일이 아니에요. 설정의 「저장 내보내기」로 만든 파일을 골라 주세요."; // I18N_SKIP: 한국어 원문 상수, 화면은 notSaveText()
export const notSaveText = () => t`리아와 파이썬! 저장 파일이 아니에요. 설정의 「저장 내보내기」로 만든 파일을 골라 주세요.`;

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** @returns {{ ok: true } | { ok: false, reason: string }} */
export function checkImport(raw) {
  if (!isObj(raw)) return { ok: false, reason: "not-object" };
  const hasVer = typeof raw.saveVer === "number" && Number.isFinite(raw.saveVer);
  const hasDone = Array.isArray(raw.completed_lessons);
  if (!hasVer && !hasDone) return { ok: false, reason: "no-marker" };
  const known = Object.keys(newSave()).filter((k) => k !== "saveVer");
  if (!Object.keys(raw).some((k) => known.includes(k))) return { ok: false, reason: "no-known-key" };
  return { ok: true };
}

const n = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0);
const doneCount = (s) => (Array.isArray(s && s.completed_lessons) ? s.completed_lessons.length : 0);

/** 확인 창 글: 요약과 경고(끝낸 레슨이 적을 때) */
export function importCompare(current, next) {
  const fewerLessons = Math.max(0, doneCount(current) - doneCount(next));
  return {
    summary: t`끝낸 레슨 ${doneCount(next)}개, XP ${n(next.xp)}, 바이트 ${n(next.bytes)}, 연속 기록 ${n(next.streak && next.streak.days)}일`,
    fewerLessons,
    warn: fewerLessons > 0 ? t`지금보다 끝낸 레슨이 ${fewerLessons}개 적어요` : null,
  };
}
