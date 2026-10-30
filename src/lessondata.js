// 장 따로 불러오기 (v0.3 작업 1, 설계 docs/specs/2026-10-30-장-따로-불러오기-설계.md)
//
// - 레슨 목록(index): 장 번호·제목, 레슨 id·title·goal·summary·isExam, 레슨이 쓰는 개념 id. 학습 길·설정·진도·배지는 이것만 쓴다.
// - 장 파일(lessons/chN-<지문8자>.json): 장 하나의 { CHAPTER, LESSONS } 전체. 레슨을 열 때 getChapter(n)으로 받는다.
// - 배포판: build.py가 window.RIA_LESSON_INDEX와 window.RIA_CHAPTER_FILES를 index.html에 넣는다 → 네트워크(서비스 작업자 저장본)로.
// - 개발판(tools/dev.py): 두 값이 없다 → app.js가 data/lessons/chN.js를 import해 modules로 넘긴다(네트워크 없음).
// 이 파일은 데이터 파일을 import하지 않는다(build.py도 레슨 목록·파일 이름을 이 함수로 만든다).

export const CHAPTER_FILE_RE = /^lessons\/ch([1-9]\d*)-([0-9a-f]{8})\.json$/;

/** 장 파일 이름: lessons/ch6-0123abcd.json */
export function chapterFileName(n, hash8) {
  if (!Number.isInteger(n) || n < 1) throw new Error("chapter number must be a positive integer: " + n);
  if (!/^[0-9a-f]{8}$/.test(String(hash8))) throw new Error("chapter hash must be 8 hex chars: " + hash8);
  return `lessons/ch${n}-${hash8}.json`;
}

function chapterOfModule(m) {
  if (!m || !Array.isArray(m.LESSONS)) return null;
  const ch = m.CHAPTER || { id: m.LESSONS[0] && m.LESSONS[0].chapter, title: "" };
  return { id: ch.id, title: ch.title || "", lessons: m.LESSONS };
}

/** 레슨 하나의 목록 칸(문제·카드 없음) */
export function lessonStub(l, chapterId) {
  const concepts = [];
  for (const it of Array.isArray(l.items) ? l.items : []) {
    if (it && it.concept && !concepts.includes(it.concept)) concepts.push(it.concept);
  }
  return {
    id: l.id, chapter: l.chapter ?? chapterId, title: l.title, goal: l.goal || "",
    summary: Array.isArray(l.summary) ? l.summary.slice() : [], isExam: !!l.isExam, concepts,
  };
}

/** 장 모듈들({CHAPTER, LESSONS}) → 레슨 목록 [{ id, title, lessons: [stub] }] (장 번호 순) */
export function buildLessonIndex(modules) {
  const out = [];
  for (const m of modules || []) {
    const ch = chapterOfModule(m);
    if (!ch) continue;
    out.push({ id: ch.id, title: ch.title, lessons: ch.lessons.map((l) => lessonStub(l, ch.id)) });
  }
  return out.sort((a, b) => a.id - b.id);
}

/** 복습: 이 개념들이 들어 있는 장 번호(오름차순) */
export function chaptersForConcepts(index, concepts) {
  const want = new Set(concepts || []);
  if (!want.size) return [];
  return (index || []).filter((c) => c.lessons.some((l) => (l.concepts || []).some((k) => want.has(k)))).map((c) => c.id);
}

export class ChapterLoadError extends Error {
  /** stale: 서버에 그 이름의 파일이 없음(404) → 화면이 옛 판일 가능성이 큼. 새로고침하면 새 이름표를 받는다 */
  constructor(chapter, message, { stale = false, cause } = {}) {
    super(message);
    this.name = "ChapterLoadError";
    this.chapter = chapter;
    this.stale = stale;
    if (cause) this.cause = cause;
  }
}

/**
 * @param o.index    레슨 목록(배포판). 개발판은 modules에서 만든다
 * @param o.files    { n: "lessons/chN-xxxxxxxx.json" } (배포판). 없으면 개발판
 * @param o.modules  [{CHAPTER, LESSONS}] (개발판: 이미 불러온 장)
 * @param o.base     장 파일 주소의 기준(보통 location.href)
 * @param o.fetch    fetch 대신(시험용)
 */
export function createLessonData({ index, files, modules, base, fetch: fetchImpl } = {}) {
  const split = !!files;
  const idx = split ? (index || []) : buildLessonIndex(modules);
  const done = new Map();     // n → {CHAPTER, LESSONS}
  const pending = new Map();  // n → Promise (동시에 여러 번 불러도 한 번만 받음)
  if (!split) {
    for (const m of modules || []) {
      const ch = chapterOfModule(m);
      if (ch) done.set(ch.id, { CHAPTER: { id: ch.id, title: ch.title }, LESSONS: ch.lessons });
    }
  }
  const lessons = idx.flatMap((c) => c.lessons);
  const chapterOf = (id) => { const l = lessons.find((x) => x.id === id); return l ? l.chapter : null; };

  async function fetchChapter(n) {
    const name = files[n];
    if (!name) throw new ChapterLoadError(n, `no file for chapter ${n}`);
    const url = base ? new URL(name, base).href : name;
    const f = fetchImpl || ((u) => fetch(u));
    let res;
    try {
      res = await f(url);
    } catch (e) {
      throw new ChapterLoadError(n, `chapter ${n}: network error`, { cause: e });
    }
    if (!res || !res.ok) {
      throw new ChapterLoadError(n, `chapter ${n}: HTTP ${res ? res.status : "?"}`, { stale: !!res && res.status === 404 });
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new ChapterLoadError(n, `chapter ${n}: bad JSON`, { cause: e });
    }
    const ch = chapterOfModule(data);
    if (!ch || ch.id !== n) throw new ChapterLoadError(n, `chapter ${n}: file holds chapter ${ch && ch.id}`);
    return { CHAPTER: { id: ch.id, title: ch.title }, LESSONS: ch.lessons };
  }

  /** 장 n의 { CHAPTER, LESSONS }. 실패는 기억하지 않아 다음 부름에서 다시 받는다 */
  function getChapter(n) {
    n = Number(n);
    if (done.has(n)) return Promise.resolve(done.get(n));
    if (pending.has(n)) return pending.get(n);
    if (!split) return Promise.reject(new ChapterLoadError(n, `chapter ${n} not loaded`));
    const p = fetchChapter(n).then(
      (c) => { done.set(n, c); pending.delete(n); return c; },
      (e) => { pending.delete(n); throw e; },
    );
    pending.set(n, p);
    return p;
  }

  /** 레슨 하나 전체(cards, items). 목록에 없는 id는 null */
  async function getLesson(id) {
    const n = chapterOf(id);
    if (n == null) return null;
    const c = await getChapter(n);
    return c.LESSONS.find((l) => l.id === id) || null;
  }

  return {
    split, index: idx, lessons, chapterOf, getChapter, getLesson,
    isLoaded: (n) => done.has(Number(n)),
    fileList: () => (split ? Object.values(files) : []),
  };
}
