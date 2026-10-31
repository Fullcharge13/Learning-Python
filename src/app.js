// 리아와 파이썬! — 앱 입구. 상태는 app = { save, screen, modal } 하나, 화면 전환은 show() 하나.
import { loadEx, store, migrate } from "./save.js";
import { rollDay } from "./rules.js";
import { ensureQuests } from "./quests.js";
import { say as pickLine } from "./say.js";
import { PyRun, PYODIDE_CDN } from "./pyrun.js";
import { OUTFITS } from "../data/outfits.js";
import { localDate, daysSince } from "./today.js";
import { finishLesson } from "./finish.js";
import { createLessonData, chaptersForConcepts } from "./lessondata.js";
import { loadDevChapters } from "./lessondev.js";
import { createSound } from "./sound.js";
import { toast } from "./ui/dom.js";
import { statusBar } from "./ui/nav.js";
import { installHintKind, isIOS, isInAppBrowser, INSTALL_HINT_KEY } from "./install.js";
import { openInstallSheet } from "./ui/installsheet.js";
import * as splash from "./ui/splash.js";
import * as home from "./ui/home.js";
import * as lesson from "./ui/lesson.js";
import * as done from "./ui/done.js";
import * as badges from "./ui/badges.js";
import * as closet from "./ui/closet.js";
import * as settings from "./ui/settings.js";

export const VERSION = "v0.5";
const SCREENS = { splash, home, lesson, done, badges, closet, settings };

// ---- 저장소 (사파리 사생활 보호 모드 등에서 localStorage 접근이 막혀도 앱은 돈다) ----
function pickStorage() {
  try {
    const s = window.localStorage;
    s.getItem("ria-python.probe");
    return s;
  } catch {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
}
const storage = pickStorage();

// 레슨 목록과 장 가져오기(v0.3 작업 1). 배포판: build.py가 넣은 목록·장 파일 이름표 → 장은 열 때 받음.
// 개발판: 둘 다 없음 → data/lessons/chN.js를 전부 import(lessondev.js, 배포판에서는 빈 모듈).
async function initLessonData() {
  if (window.RIA_CHAPTER_FILES && window.RIA_LESSON_INDEX) {
    return createLessonData({ index: window.RIA_LESSON_INDEX, files: window.RIA_CHAPTER_FILES, base: location.href });
  }
  return createLessonData({ modules: await loadDevChapters() });
}

const app = {
  save: null, screen: null, params: null, modal: null,
  chapters: [], lessons: [],   // 레슨 목록(문제·카드 없음). 전체는 ctx.getLesson / getChapter
  data: null,
  swChanged: false,      // 이 페이지를 다루던 서비스 작업자가 새 판으로 바뀜 → 장 파일 이름표가 옛것일 수 있음
  cleanup: null,
  greetOverride: null,   // 다음 홈 인사 한 번: "welcome_back" | "streak_broken"
  lastLine: {},          // 대사 상황별 직전 줄 번호
  py: null, pyStatus: "loading", pyPhase: "first-load", pyListeners: new Set(),
  storeFailedShown: false,
};

const sound = createSound(() => app.save && app.save.settings && app.save.settings.sound !== false);

// ---- Python 작업자 ----
function initPy() {
  const indexURL = (typeof window !== "undefined" && window.RIA_PYODIDE_URL) || PYODIDE_CDN;
  // build.py가 작업자·runner를 HTML에 넣으면 이 두 값을 채운다(판정 C29). 개발판에서는 undefined → 기본 동작
  const py = new PyRun({ indexURL, workerURL: window.RIA_WORKER_URL, runnerSource: window.RIA_RUNNER_SRC });
  let everReady = false;
  py.onstatus = (status, phase) => {
    if (status === "ready") everReady = true;
    // 옛 모양(phase 없음)에도 동작하도록: 한 번이라도 준비됐으면 다시 준비로 봄
    app.pyPhase = phase === "first-load" || phase === "restart" ? phase : (everReady ? "restart" : "first-load");
    app.pyStatus = status;
    for (const f of app.pyListeners) { try { f(status, app.pyPhase); } catch (e) { console.error(e); } }
  };
  app.py = py;
  py.preload().catch(() => { /* 상태 표시가 알려 줌. run()이 다시 시도 */ });
}

// ---- 날 넘김: 앱을 열 때, 다시 보일 때 ----
function dayStart() {
  const today = localDate();
  let s = app.save;
  const before = JSON.stringify(s);
  const r = rollDay(s, today);
  s = r.save;
  const away = daysSince(app.save.last_active_at);
  if (away != null && away >= 3) app.greetOverride = "welcome_back";
  else if (r.broke) app.greetOverride = "streak_broken";
  if (r.usedFreezes > 0) toast(`기록 보호권 ${r.usedFreezes}개로 연속 기록을 지켰어요.`);
  s = ensureQuests(s, today);
  if (JSON.stringify(s) !== before) commit(s);
  else app.save = s;
}

// ---- 저장 ----
function commit(next) {
  app.save = next;
  const ok = store(storage, next);
  if (!ok && !app.storeFailedShown) {
    app.storeFailedShown = true;
    toast("저장하지 못했어요. 브라우저 저장 공간이 꽉 찼거나 막혀 있어요. 설정에서 저장 내보내기를 해 두면 안전해요.", "warn");
  }
  if (ok) app.storeFailedShown = false;
  // 화면에 있는 상태 줄(연속 기록·바이트·XP)을 새 값으로
  const bar = document.querySelector("#app .status");
  if (bar) {
    const t = document.createElement("template");
    t.innerHTML = statusBar(next).trim();
    bar.replaceWith(t.content.firstElementChild);
  }
  return ok;
}

// ---- 화면 전환 ----
function show(name, params = {}) {
  if (typeof app.cleanup === "function") { try { app.cleanup(); } catch (e) { console.error(e); } }
  app.cleanup = null;
  app.screen = name;
  app.params = params;
  const root = document.getElementById("app");
  root.innerHTML = "";
  root.dataset.screen = name;
  document.body.dataset.screen = name;
  window.scrollTo(0, 0);
  const out = SCREENS[name].render(root, ctx, params);
  if (typeof out === "function") app.cleanup = out;
  const h = root.querySelector("h1, [data-autofocus]");
  if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}

// ---- 레슨 길 ----
function lessonIndex(id) { return app.lessons.findIndex((l) => l.id === id); }
function lessonState(id) {
  const s = app.save;
  const i = lessonIndex(id);
  if (i < 0) return "locked";
  if (s.completed_lessons.includes(id)) return s.grading_results[id] && s.grading_results[id].perfect ? "perfect" : "done";
  if (i === 0 || s.completed_lessons.includes(app.lessons[i - 1].id)) return "open";
  return "locked";
}
function currentLessonId() {
  const s = app.save;
  const cur = app.lessons.find((l) => l.id === s.current_lesson);
  if (cur && lessonState(cur.id) === "open") return cur.id;
  const next = app.lessons.find((l) => lessonState(l.id) === "open");
  return next ? next.id : (app.lessons.length ? app.lessons[app.lessons.length - 1].id : null);
}

function outfitShort() {
  const o = OUTFITS.find((x) => x.id === app.save.outfit);
  return o ? o.short : "";
}

/** 대사 고르기: 상황별 직전 줄을 따로 기억(C17) */
function say(situation, vars = {}) {
  const v = { name: app.save.settings.name, streak: app.save.streak.days || undefined, outfit: outfitShort(), ...vars };
  const r = pickLine(situation, v, Math.random, app.lastLine[situation] ?? null);
  app.lastLine[situation] = r.index;
  return r;
}

function finish(info) {
  const all = app.lessons;
  let nextLessonId = null, nextChapter = null;
  if (info.mode !== "review") {
    const doneSet = new Set([...app.save.completed_lessons, info.lesson.id]);
    const next = all.find((l) => !doneSet.has(l.id)) || all[all.length - 1];
    nextLessonId = next.id;
    nextChapter = next.chapter;
  }
  const firstEver = info.mode !== "review" && app.save.completed_lessons.length === 0;
  const { save, result } = finishLesson(app.save, { ...info, nextLessonId, nextChapter }, new Date());
  commit(save);
  if (firstEver) {
    try { navigator.storage?.persist?.().catch(() => {}); } catch { /* 지원 안 함 */ }
    app.installHintPending = true;
  }
  return result;
}

// ---- 홈 화면에 추가 안내 (표시 여부는 저장과 따로 둔 칸에) ----
function installShown() {
  try { return localStorage.getItem(INSTALL_HINT_KEY) === "1"; } catch { return false; }
}
function isStandalone() {
  try { return navigator.standalone === true || matchMedia("(display-mode: standalone)").matches; } catch { return false; }
}
/** 설정 단추: 언제든 열기(앱 안 브라우저면 사파리로 열라는 안내) */
function showInstallSheet(kind) {
  const ua = navigator.userAgent;
  const k = kind || (isIOS(ua, navigator.maxTouchPoints) && isInAppBrowser(ua) ? "inapp" : "safari");
  return openInstallSheet({ outfit: app.save.outfit, kind: k });
}
/** 첫 레슨 완료 화면이 끝난 뒤 한 번만 */
async function afterDone() {
  if (!app.installHintPending) return;
  app.installHintPending = false;
  const kind = installHintKind({ ua: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, standalone: isStandalone(), shown: installShown() });
  if (!kind) return;
  try { localStorage.setItem(INSTALL_HINT_KEY, "1"); } catch { /* 못 남겨도 안내는 보임 */ }
  await showInstallSheet(kind);
}

const ctx = {
  app,
  afterDone, showInstallSheet,
  version: VERSION,
  get save() { return app.save; },
  commit, show, say, sound, toast, finish,
  get chapters() { return app.chapters; },
  get lessons() { return app.lessons; },
  lessonById: (id) => app.lessons.find((l) => l.id === id),
  getLesson: (id) => (app.data ? app.data.getLesson(id) : Promise.resolve(null)),
  getChapter: (n) => app.data.getChapter(n),
  chaptersForConcepts: (concepts) => chaptersForConcepts(app.chapters, concepts),
  swChanged: () => app.swChanged,
  get chapterFiles() { return app.data ? app.data.fileList() : []; },
  lessonState, currentLessonId,
  today: () => localDate(),
  get py() { return app.py; },
  pyState: () => ({ status: app.pyStatus, phase: app.pyPhase }),
  onPy(f) { app.pyListeners.add(f); return () => app.pyListeners.delete(f); },
  dayStart,
  takeGreeting() { const g = app.greetOverride; app.greetOverride = null; return g; },
  migrate,
};

async function boot() {
  const root = document.getElementById("app");
  const { save, readFailed } = loadEx(storage);
  app.save = save;
  if (readFailed) toast("저장을 읽지 못해 새로 시작해요. 이 브라우저의 저장 공간 설정을 확인해 주세요.", "warn");
  initPy();
  try {
    // 처음 설치(작업자 없음 → 생김)는 새 판이 아님. 다루던 작업자가 바뀔 때만
    const sw = navigator.serviceWorker;
    if (sw && sw.controller) sw.addEventListener("controllerchange", () => { app.swChanged = true; });
  } catch { /* 지원 안 함 */ }
  try {
    app.data = await initLessonData();
    app.chapters = app.data.index;
  } catch (e) {
    console.error(e);
    app.chapters = [];
  }
  app.lessons = app.chapters.flatMap((c) => c.lessons);
  dayStart();
  show("splash");
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const before = app.save.quests.date + "|" + app.save.streak.lastGoalDate;
    dayStart();
    const after = app.save.quests.date + "|" + app.save.streak.lastGoalDate;
    if (app.screen === "home" && (before !== after || app.greetOverride)) show("home");
  });
  root.removeAttribute("aria-busy");
  // 시험 도구가 상태를 볼 수 있게
  window.__ria = { app, ctx };
}

boot().catch((e) => {
  console.error(e);
  const root = document.getElementById("app");
  if (root) root.innerHTML = `<p class="fatal">앱을 시작하지 못했어요. 새로고침해 주세요.</p>`;
});
