// 일일 퀘스트: 날짜로 3개 뽑기, 사건 집계, 보물상자
import { QUESTS } from "../data/quests.js";
import { ORDERS } from "../data/garden.js";

export const CHEST_BYTES = 10;

function hashStr(str) {
  // FNV-1a 32비트
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 텃밭 퀘스트(v0.11 설계 §3) ----
// 장 평가 레슨 id. 모든 장의 평가가 「N-5」임은 tests/unit/quests.test.js가 실제 장 파일로 확인한다
// (장 목록 없이 저장만으로 판단해야 해서: ensureQuests는 장 목록을 받지 않고, src/garden/state.js는 이 파일을 부르므로
//  state.js의 passedChapters를 여기서 부르면 순환이 된다).
const examId = (chapter) => `${chapter}-5`;
const GARDEN_CHAPTER = 1;   // 텃밭은 1장 평가를 통과하면 열림(src/ui/home.js·garden.js와 같음)

/** 오늘 텃밭 주문을 해낼 수 있나: 텃밭이 열렸고(1장 평가), 텃밭을 한 번 이상 실행했고(garden.runs > 0, 판정 C65 —
 *  텃밭을 하지 않는 학습자는 v0.10 퀘스트 그대로), 남은 주문이 있고, 지금 주문의 장 평가를 끝냄(기다림 아님) */
export function gardenOrderOpen(save) {
  const done = save && Array.isArray(save.completed_lessons) ? save.completed_lessons : [];
  if (!done.includes(examId(GARDEN_CHAPTER))) return false;
  const runs = save.garden?.runs;
  if (!(typeof runs === "number" && Number.isFinite(runs) && runs > 0)) return false;
  const raw = save.garden?.order?.idx;
  const idx = Number.isInteger(raw) && raw >= 0 ? raw : 0;   // 없거나 이상하면 state.js cleanGarden처럼 첫 주문
  const order = ORDERS[idx];
  return !!order && done.includes(examId(order.need));
}

const NEEDS = { garden: gardenOrderOpen };
const BASE = QUESTS.filter((q) => !q.needs).map((q) => q.id);
const EXTRA = QUESTS.filter((q) => q.needs);

/** 같은 날짜 → 같은 3개. 조건 없는 6개를 날짜 씨앗으로 섞은 뒤, 복습 목록이 비면 q_review3을 빼고 앞의 3개.
 *  (섞는 대상이 늘 6개라서 복습 목록 유무와 관계없이 나머지 순서가 같음)
 *  조건 퀘스트(q_garden, 조건 gardenOrderOpen)는 조건이 맞을 때만, 같은 씨앗을 이어 써서 후보 n개 + 1개 중 3개를 고르는 것과 같은 확률(3/(n+1))로
 *  앞의 3개 중 한 자리를 바꾼다. 조건이 안 맞으면 씨앗을 더 쓰지 않으므로 v0.10과 똑같은 3개. */
export function pickQuests(today, save) {
  const rng = mulberry32(hashStr(String(today)));
  const order = [...BASE];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const reviewEmpty = !save || !Array.isArray(save.review_queue) || save.review_queue.length === 0;
  const pool = order.filter((id) => !(reviewEmpty && id === "q_review3"));
  const picks = pool.slice(0, 3);
  let n = pool.length;
  for (const q of EXTRA) {
    if (!NEEDS[q.needs] || !NEEDS[q.needs](save)) continue;
    n += 1;
    if (rng() < 3 / n) picks[Math.floor(rng() * 3)] = q.id;
  }
  return picks;
}

const KNOWN = new Set(QUESTS.map((q) => q.id));
const DAY_MS = 86400000;

/** "YYYY-MM-DD"이고 실제 있는 날짜면 UTC 자정 밀리초, 아니면 NaN */
function dayMs(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return NaN;
  const ms = Date.parse(str + "T00:00:00Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== str) return NaN;
  return ms;
}

function wellFormed(q) {
  return !!q && typeof q === "object" && typeof q.date === "string" &&
    Array.isArray(q.ids) && q.ids.length === 3 && new Set(q.ids).size === 3 &&
    q.ids.every((id) => KNOWN.has(id)) &&
    Array.isArray(q.done) &&
    !!q.progress && typeof q.progress === "object" && !Array.isArray(q.progress);
}

/** 저장된 목록을 그대로 쓸지: 오늘 것이거나, 시계가 뒤로 간 경우 하루 앞 날짜까지만 */
function keepStored(q, today) {
  if (!wellFormed(q)) return false;
  const stored = dayMs(q.date), now = dayMs(today);
  if (!Number.isFinite(stored)) return false;
  if (q.date === today) return true;
  return Number.isFinite(now) && stored > now && stored - now <= DAY_MS;
}

/** 오늘의 퀘스트 목록을 저장에 고정. 이미 오늘 것(또는 시계가 하루 뒤로 간 경우 내일 것)이면 그대로 돌려줌 */
export function ensureQuests(save, today) {
  if (keepStored(save.quests, today)) return save;
  return { ...save, quests: { date: today, ids: pickQuests(today, save), progress: {}, done: [], chest: false } };
}

/** 순수 함수. 입력 save를 바꾸지 않고 새 save를 돌려줌 */
export function tick(save, event, today, amount = 1) {
  const base = ensureQuests(save, today);
  // 시계가 뒤로 간 경우(저장된 날짜가 today보다 하루 뒤): 저장된 퀘스트를 그대로 두고 아무것도 집계하지 않음
  if (base.quests.date !== today) return { save: base, finished: [], chest: false };
  const n = typeof amount === "number" && Number.isFinite(amount) && amount > 0 ? amount : 0;
  const quests = {
    ...base.quests,
    ids: [...base.quests.ids],
    progress: { ...base.quests.progress },
    done: [...base.quests.done],
  };
  let bytes = base.bytes || 0;
  const finished = [];
  if (n > 0) {
    for (const id of quests.ids) {
      const q = QUESTS.find((x) => x.id === id);
      if (!q || q.key !== event || quests.done.includes(id)) continue;
      const cur = quests.progress[id];
      const prev = typeof cur === "number" && Number.isFinite(cur) && cur > 0 ? cur : 0;
      const p = Math.min(q.goal, prev + n);
      quests.progress[id] = p;
      if (p >= q.goal) {
        quests.done.push(id);
        finished.push(id);
        bytes += q.reward;
      }
    }
  }
  let chest = false;
  if (!quests.chest && quests.ids.length > 0 && quests.ids.every((id) => quests.done.includes(id))) {
    quests.chest = true;
    chest = true;
    bytes += CHEST_BYTES;
  }
  return { save: { ...base, bytes, quests }, finished, chest };
}
