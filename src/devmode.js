// 개발자 모드(검수용) 저장 칸 (v0.11.1). 학습 기록과 따로 저장한다(설계 선택 A).
// - 깃발 DEV_FLAG_KEY("1"이면 켜짐)는 새로고침 뒤에도 남는다.
// - 켜 있는 동안 앱은 DEV_SAVE_KEY·DEV_RESUME_KEY만 읽고 쓴다. 학습 기록(SAVE_KEY·RESUME_KEY)은 읽지도 쓰지도 않는다.
// - 끄면 학습 기록을 그대로 다시 읽는다. 개발자 저장은 지우지 않아 다음에 켜면 이어진다(없으면 newSave()).
// - 저장소가 막혀도 던지지 않는다.
import { loadEx, store, SAVE_KEY } from "./save.js";
import { RESUME_KEY } from "./resume.js";
import { DEV_MARK } from "./devgate.js";

export const DEV_FLAG_KEY = "ria-python.dev";
export const DEV_SAVE_KEY = "ria-python.dev.save";
export const DEV_RESUME_KEY = "ria-python.dev.resume";

export const keysFor = (dev) => (dev ? { save: DEV_SAVE_KEY, resume: DEV_RESUME_KEY } : { save: SAVE_KEY, resume: RESUME_KEY });

export function readDevFlag(storage) {
  try { return !!storage && storage.getItem(DEV_FLAG_KEY) === "1"; } catch { return false; }
}

export function writeDevFlag(storage, on) {
  try {
    if (on) storage.setItem(DEV_FLAG_KEY, "1");
    else storage.removeItem(DEV_FLAG_KEY);
    return true;
  } catch { return false; }
}

/** 개발자 표시를 맞춘 저장(이미 맞으면 같은 객체) */
export function markDev(save, on) {
  if (!save || typeof save !== "object") return save;
  const has = Object.hasOwn(save, DEV_MARK);
  if (on) return save[DEV_MARK] === true ? save : { ...save, [DEV_MARK]: true };
  if (!has) return save;
  const { [DEV_MARK]: _drop, ...rest } = save;
  return rest;
}

/** 지금 칸의 저장 읽기 → { save, readFailed } */
export function loadSlot(storage, dev) {
  const r = loadEx(storage, keysFor(dev).save);
  return { ...r, save: markDev(r.save, dev) };
}

/** 지금 칸에 저장 쓰기 */
export function storeSlot(storage, save, dev) {
  return store(storage, markDev(save, dev), keysFor(dev).save);
}

/** 켜고 끄기: 깃발을 남기고 그 칸의 저장을 읽어 돌려준다 */
export function setDevMode(storage, on) {
  writeDevFlag(storage, on);
  return loadSlot(storage, on);
}
