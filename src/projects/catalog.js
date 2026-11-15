// v0.21.0 프로젝트 공방: 색인·파일 나누기·불러오기 (설계 docs/specs/2026-11-15-프로젝트-공방-설계.md §3·§4-1·§7)
// 경비실 src/guard/catalog.js와 같은 갈래.
//
// - 원본은 data/projects.js(한국어)·data/projects.en.js(영어)의 PROJECTS. build.py가 이 파일의 splitProjects로 나눈다.
// - 색인(첫 파일의 window.RIA_PROJECT_INDEX): [{ id, need, icon, steps(단계 수), title: { ko, en }, blurb: { ko, en } }].
//   공방 목록·진열장·저장 다듬기는 색인만 쓴다.
// - 본문 파일: projects/<id>-<지문8자>.json(한국어), projects/en/<id>-<지문8자>.json(영어). 프로젝트 하나 전체.
//   단계 solution은 남긴다(「정답 보기」·「모범 코드에서 이어 하기」에 필요, 판정 W-P1).
//   이름표는 window.RIA_PROJECT_FILES = { ko: { P1: "projects/P1-xxxxxxxx.json" }, en: { P1: "projects/en/P1-…" } }.
// - 개발판(tools/dev.py)은 이름표가 없다 → projectdev.js가 원본을 불러 projects: { ko, en }로 넘긴다(받지 않음).
// 이 파일은 데이터 파일을 import하지 않는다.

export const PROJECT_FILE_RE = /^projects\/(en\/)?(P[1-9]\d*)-([0-9a-f]{8})\.json$/;

const normLang = (l) => (l === "en" ? "en" : "ko");

/** 본문 파일 이름 */
export function projectFileName(id, hash, lang) {
  return `projects/${normLang(lang) === "en" ? "en/" : ""}${id}-${hash}.json`;
}

/** 프로젝트 하나의 색인 칸(한·영 짝) */
export function projectIndexEntry(ko, en) {
  return {
    id: ko.id, need: ko.need, icon: ko.icon, steps: ko.steps.length,
    title: { ko: ko.title, en: en.title }, blurb: { ko: ko.blurb, en: en.blurb },
  };
}

/** 색인 목록(한국어 원본 순서). 영어에 같은 id·장·단계 수가 없거나 영어에만 있는 id가 있으면 던진다(빌드가 멈춤) */
export function buildProjectIndex(ko, en) {
  const koList = ko || [];
  const enById = new Map((en || []).map((p) => [p.id, p]));
  const koIds = new Set(koList.map((p) => p.id));
  for (const p of en || []) {
    if (!koIds.has(p.id)) throw new Error(`project ${p.id} is only in the English file`);
  }
  return koList.map((p) => {
    const e = enById.get(p.id);
    if (!e) throw new Error(`project ${p.id} has no English version`);
    if (e.need !== p.need) throw new Error(`project ${p.id}: English need ${e.need} != ${p.need}`);
    if (!Array.isArray(p.steps) || !Array.isArray(e.steps) || e.steps.length !== p.steps.length) {
      throw new Error(`project ${p.id}: English step count differs`);
    }
    return projectIndexEntry(p, e);
  });
}

/** { index, bodies: { ko: { id: 본문 }, en: { id: 본문 } } } */
export function splitProjects(ko, en) {
  const index = buildProjectIndex(ko, en);
  const bodies = { ko: {}, en: {} };
  for (const p of ko || []) bodies.ko[p.id] = p;
  for (const p of en || []) bodies.en[p.id] = p;
  return { index, bodies };
}

export class ProjectLoadError extends Error {
  /** stale: 서버에 그 이름의 파일이 없음(404) → 화면이 옛 판일 가능성이 큼 */
  constructor(id, message, { stale = false, cause } = {}) {
    super(message);
    this.name = "ProjectLoadError";
    this.id = id;
    this.stale = stale;
    if (cause) this.cause = cause;
  }
}

/**
 * @param o.index    색인(배포판). 개발판은 projects에서 만든다
 * @param o.files    { ko: { id: 이름 }, en: { id: 이름 } } (배포판). 없으면 개발판
 * @param o.projects { ko: [원본], en: [원본] } (개발판)
 * @param o.base     파일 주소의 기준(보통 location.href)
 * @param o.fetch    fetch 대신(시험용)
 * @returns {{ index, load(id, lang) }} load는 그 언어의 프로젝트 본문. 실패는 ProjectLoadError로 거부하고 기억하지 않는다
 */
export function createProjectData({ index, files, projects, base, fetch: fetchImpl } = {}) {
  const split = !!files;
  const idx = split ? (index || []) : buildProjectIndex(projects?.ko, projects?.en);
  const steps = new Map(idx.map((e) => [e.id, e.steps]));
  const done = new Map();     // "lang:id" → 본문
  const pending = new Map();  // "lang:id" → Promise (동시에 여러 번 불러도 한 번만 받음)
  if (!split) {
    const { bodies } = splitProjects(projects?.ko, projects?.en);
    for (const l of ["ko", "en"]) for (const [id, p] of Object.entries(bodies[l])) done.set(`${l}:${id}`, p);
  }

  async function fetchOne(id, l) {
    const name = files[l] && Object.hasOwn(files[l], id) ? files[l][id] : null;
    if (!name) throw new ProjectLoadError(id, `no ${l} project file for ${id}`);
    const url = base ? new URL(name, base).href : name;
    const f = fetchImpl || ((u) => fetch(u));
    let res;
    try {
      res = await f(url);
    } catch (e) {
      throw new ProjectLoadError(id, `project ${id} (${l}): network error`, { cause: e });
    }
    if (!res || !res.ok) {
      throw new ProjectLoadError(id, `project ${id} (${l}): HTTP ${res ? res.status : "?"}`, { stale: !!res && res.status === 404 });
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new ProjectLoadError(id, `project ${id} (${l}): bad JSON`, { cause: e });
    }
    if (!data || typeof data !== "object" || data.id !== id || !Array.isArray(data.steps)
        || (steps.has(id) && data.steps.length !== steps.get(id))) {
      throw new ProjectLoadError(id, `project ${id} (${l}): file does not hold this project`);
    }
    return data;
  }

  function load(id, lang) {
    const l = normLang(lang);
    const key = `${l}:${id}`;
    if (done.has(key)) return Promise.resolve(done.get(key));
    if (pending.has(key)) return pending.get(key);
    if (!split) return Promise.reject(new ProjectLoadError(id, `no project ${id}`));
    const p = fetchOne(id, l).then(
      (body) => { done.set(key, body); pending.delete(key); return body; },
      (e) => { pending.delete(key); throw e; },
    );
    pending.set(key, p);
    return p;
  }

  return { index: idx, load };
}
