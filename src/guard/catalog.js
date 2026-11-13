// 경비실 사건 장별 파일 (v0.16.0 작업 1, 설계 docs/specs/2026-11-13-경비실-사건-12개-설계.md §5-1·§5-2)
//
// - 원본은 data/guard.js의 INCIDENTS 한 곳. build.py가 이 파일의 splitGuard로 나눈다(레슨의 lessondata.js와 같은 갈래).
// - 색인(index, 첫 파일의 window.RIA_GUARD_INDEX): 사건마다 { id, need, title, blanks: [보기 수, …] } (mode·tag는 장 파일 본문에만 — 45개 색인이 첫 파일을 키우지 않게, 판정 G2-C6).
//   목록·등급·배지·저장 다듬기는 색인만 쓴다.
// - 장 파일(guard/chN-<지문8자>.json): 그 장 사건들의 본문 배열(원본에서 solution만 뺀 것, 원본 순서).
//   이름표는 window.RIA_GUARD_FILES = { "N": "guard/chN-xxxxxxxx.json" }.
// - 개발판(tools/dev.py)은 이름표가 없다 → guarddev.js가 data/guard.js를 불러 incidents로 넘긴다(받지 않음).
// 이 파일은 데이터 파일을 import하지 않는다.

export const GUARD_XP = 5; // 사건을 처음 해결했을 때 받는 XP (판정 G2-C1: data/guard.js는 이것을 다시 내보냄)

export const GUARD_FILE_RE = /^guard\/ch([1-9]\d*)-([0-9a-f]{8})\.json$/;

/** 사건 하나의 색인 칸. blanks는 빈칸마다 보기 수 */
export function guardIndexEntry(incident) {
  const { id, need, title } = incident;
  return { id, need, title, blanks: (incident.blanks || []).map((b) => (b && Array.isArray(b.options) ? b.options.length : 0)) };
}

/** 색인 목록(원본 순서) */
export function buildGuardIndex(incidents) {
  return (incidents || []).map(guardIndexEntry);
}

/** 장 파일에 넣는 본문: solution(시험 전용 정답)만 뺀 사본 */
export function guardBody(incident) {
  const body = { ...incident };
  delete body.solution;
  return body;
}

/** { index, chapters: { need: [본문, …] } } — 장마다 원본 순서 */
export function splitGuard(incidents) {
  const chapters = {};
  for (const inc of incidents || []) (chapters[inc.need] ||= []).push(guardBody(inc));
  return { index: buildGuardIndex(incidents), chapters };
}

export class GuardLoadError extends Error {
  /** stale: 서버에 그 이름의 파일이 없음(404) → 화면이 옛 판일 가능성이 큼 */
  constructor(chapter, message, { stale = false, cause } = {}) {
    super(message);
    this.name = "GuardLoadError";
    this.chapter = chapter;
    this.stale = stale;
    if (cause) this.cause = cause;
  }
}

/**
 * @param o.index     색인(배포판). 개발판은 incidents에서 만든다
 * @param o.files     { n: "guard/chN-xxxxxxxx.json" } (배포판). 없으면 개발판
 * @param o.incidents 원본 사건 목록(개발판)
 * @param o.base      장 파일 주소의 기준(보통 location.href)
 * @param o.fetch     fetch 대신(시험용)
 * @returns {{ index, load(chapter) }} load는 그 장 사건 본문 배열. 실패는 GuardLoadError로 거부하고 기억하지 않는다
 */
export function createGuardData({ index, files, incidents, base, fetch: fetchImpl } = {}) {
  const split = !!files;
  const idx = split ? (index || []) : buildGuardIndex(incidents);
  const done = new Map();     // n → [본문]
  const pending = new Map();  // n → Promise (동시에 여러 번 불러도 한 번만 받음)
  if (!split) {
    for (const [n, list] of Object.entries(splitGuard(incidents).chapters)) done.set(Number(n), list);
  }

  async function fetchChapter(n) {
    const name = files[n];
    if (!name) throw new GuardLoadError(n, `no guard file for chapter ${n}`);
    const url = base ? new URL(name, base).href : name;
    const f = fetchImpl || ((u) => fetch(u));
    let res;
    try {
      res = await f(url);
    } catch (e) {
      throw new GuardLoadError(n, `guard chapter ${n}: network error`, { cause: e });
    }
    if (!res || !res.ok) {
      throw new GuardLoadError(n, `guard chapter ${n}: HTTP ${res ? res.status : "?"}`, { stale: !!res && res.status === 404 });
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new GuardLoadError(n, `guard chapter ${n}: bad JSON`, { cause: e });
    }
    if (!Array.isArray(data) || !data.every((x) => x && typeof x.id === "string" && x.need === n)) {
      throw new GuardLoadError(n, `guard chapter ${n}: file does not hold chapter ${n} incidents`);
    }
    return data;
  }

  function load(chapter) {
    const n = Number(chapter);
    if (done.has(n)) return Promise.resolve(done.get(n));
    if (pending.has(n)) return pending.get(n);
    if (!split) return Promise.reject(new GuardLoadError(n, `no guard incidents for chapter ${n}`));
    const p = fetchChapter(n).then(
      (list) => { done.set(n, list); pending.delete(n); return list; },
      (e) => { pending.delete(n); throw e; },
    );
    pending.set(n, p);
    return p;
  }

  return { index: idx, load };
}
