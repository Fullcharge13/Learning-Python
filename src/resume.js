// 하던 레슨 이어 하기 (v0.6.2 다, 판정 C44)
// 본 저장(ria-python.save)과 따로 localStorage 한 칸(RESUME_KEY)에 둔다. 모든 읽기·쓰기는 try/catch.
// 기록: { v, lessonId, mode: "lesson", flow(레슨 내용 뺀 진행 상태), combo, marks, logs, marked, write,
//        reviewCorrect, itemsSolved, item: 지금 write 문제 { index, code(초안), hintsShown, solutionSeen,
//        submits, hadError } | null, savedAt(ms) }
// 레슨을 끝냄·「처음부터」·「그만두기」·24시간 지남·없는 레슨이면 지운다.
// 터치 문제 보기 순서는 이어 할 때 다시 섞여도 된다. 문제 차례와 결과는 그대로.

export const RESUME_KEY = "ria-python.resume";
export const RESUME_MAX_MS = 24 * 60 * 60 * 1000;
const VER = 1;
const FLOW_KEYS = ["cards", "cardPos", "main", "mainPos", "check", "checkPos", "attempts", "firstTry", "solved", "gaveUp", "perfect", "answered", "phase", "_items"];
const S_KEYS = ["combo", "marks", "logs", "marked", "write", "reviewCorrect", "itemsSolved"];

const clone = (v) => JSON.parse(JSON.stringify(v));

/** 카드를 하나라도 넘겼거나 문제를 하나라도 풀었나 */
export function hasProgress(flow) {
  return !!flow && (flow.cardPos > 0 || flow.answered > 0);
}

export function packResume({ lessonId, S, item = null, now = Date.now() }) {
  const flow = {};
  for (const k of FLOW_KEYS) flow[k] = clone(S.flow[k]);
  const rec = { v: VER, lessonId: String(lessonId), mode: "lesson", flow, savedAt: now, item: null };
  for (const k of S_KEYS) rec[k] = clone(S[k] === undefined ? null : S[k]);
  if (item && Number.isInteger(item.index)) {
    rec.item = {
      index: item.index, code: String(item.code ?? ""),
      hintsShown: Math.max(0, item.hintsShown | 0), solutionSeen: !!item.solutionSeen,
      submits: Math.max(0, item.submits | 0), hadError: !!item.hadError,
    };
  }
  return rec;
}

export function writeResume(storage, rec) {
  try { storage.setItem(RESUME_KEY, JSON.stringify(rec)); return true; } catch { return false; }
}

export function clearResume(storage) {
  try { storage && storage.removeItem(RESUME_KEY); } catch { /* 막혀도 그만 */ }
}

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v) && v >= 0;

function wellFormed(r) {
  if (!isObj(r) || r.v !== VER || typeof r.lessonId !== "string" || r.mode !== "lesson") return false;
  if (typeof r.savedAt !== "number" || !Number.isFinite(r.savedAt)) return false;
  const f = r.flow;
  if (!isObj(f) || !isInt(f.cards) || !isInt(f.cardPos) || !isInt(f.mainPos) || !isInt(f.checkPos) || !isInt(f.answered)) return false;
  if (!Array.isArray(f.main) || !Array.isArray(f.check) || !Array.isArray(f._items) || !Array.isArray(f.gaveUp)) return false;
  if (!isObj(f.attempts) || !isObj(f.firstTry) || !isObj(f.solved) || typeof f.perfect !== "boolean") return false;
  if (!Array.isArray(r.marks) || !Array.isArray(r.logs) || !isObj(r.marked)) return false;
  if (!isInt(r.combo) || !isInt(r.reviewCorrect) || !isInt(r.itemsSolved)) return false;
  if (r.write !== null && !isObj(r.write)) return false;
  if (r.item !== null && !(isObj(r.item) && isInt(r.item.index) && typeof r.item.code === "string")) return false;
  return true;
}

/** 기록 읽기. 없거나 깨졌거나 24시간 지났거나 없는 레슨이면 지우고 null.
 *  @param opts { now, exists(lessonId) => boolean } */
export function readResume(storage, { now = Date.now(), exists = () => true } = {}) {
  let text = null;
  try { text = storage ? storage.getItem(RESUME_KEY) : null; } catch { return null; }
  if (text == null) return null;
  let r = null;
  try { r = JSON.parse(text); } catch { r = null; }
  let ok = wellFormed(r) && now - r.savedAt <= RESUME_MAX_MS && now - r.savedAt >= -60_000;
  if (ok) { try { ok = !!exists(r.lessonId); } catch { ok = false; } }
  if (!ok) { clearResume(storage); return null; }
  return r;
}

/** 기록을 그 레슨의 세션 S로 되살린다. 레슨 내용(카드 수·문제 수·종류)이 달라졌으면 null. */
export function restoreSession(rec, lesson) {
  if (!rec || !lesson || rec.lessonId !== lesson.id) return null;
  const items = Array.isArray(lesson.items) ? lesson.items : [];
  const cards = Array.isArray(lesson.cards) ? lesson.cards.length : 0;
  const f = rec.flow;
  const types = items.map((it) => (it && it.type) || "");
  if (f.cards !== cards || f.cardPos > cards) return null;
  if (f._items.length !== types.length || f._items.some((t, i) => t !== types[i])) return null;
  const okEntry = (e) => isObj(e) && Number.isInteger(e.i) && e.i >= 0 && e.i < items.length && typeof e.retry === "boolean";
  if (!f.main.every(okEntry) || !f.check.every(okEntry)) return null;
  if (f.mainPos > f.main.length || f.checkPos > f.check.length) return null;
  if (f.check.some((e) => types[e.i] !== "check") || f.main.some((e) => types[e.i] === "check")) return null;
  const flow = { ...clone(f), _lesson: lesson };
  const S = { flow };
  for (const k of S_KEYS) S[k] = clone(rec[k]);
  return S;
}
