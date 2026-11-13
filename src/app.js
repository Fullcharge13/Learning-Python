// 리아와 파이썬! — 앱 입구. 상태는 app = { save, screen, modal } 하나, 화면 전환은 show() 하나.
import { migrate, takeRefundNotice, refundNoticeText, takeBrokenNotice, brokenNoticeText } from "./save.js";
import { t, tx, setLang, lang, EN_PUBLIC, deviceLang, packOf } from "./i18n.js";
import { loadLangPack } from "./langload.js";
import { warmLangFiles } from "./langwarm.js";
import { latestOnly } from "./latest.js";
import { readDevFlag, setDevMode, loadSlot, storeSlot, keysFor, markDev } from "./devmode.js";
import { rollDay } from "./rules.js";
import { ensureQuests } from "./quests.js";
import { say as pickLine } from "./say.js";
import { PyRun, PYODIDE_CDN } from "./pyrun.js";
import { OUTFITS } from "../data/outfits.js";
import { localDate, daysSince } from "./today.js";
import { finishLesson } from "./finish.js";
import { ensureDaily, dailyStatus, recordDaily, finishDaily, finishedItems } from "./daily.js";
import { createPersist } from "./persist.js";
import { readResume, writeResume, clearResume } from "./resume.js";
import { createLessonData, chaptersForConcepts, mergeLangLessons } from "./lessondata.js";
import { advancedIds } from "./advanced.js";
import { lessonStateOf } from "./curriculum.js";
import { loadDevChapters } from "./lessondev.js";
import { createGuardData } from "./guard/catalog.js";
import { loadDevIncidents } from "./guard/guarddev.js";
import { prefetchChunks } from "./chunks.js";
import { setGuardIndex } from "./guard/state.js";
import { createSound } from "./sound.js";
import { toast } from "./ui/dom.js";
import { statusBar } from "./ui/nav.js";
import { installHintKind, isIOS, isInAppBrowser, INSTALL_HINT_KEY, installPlatform } from "./install.js";
import { openInstallSheet } from "./ui/installsheet.js";
import * as splash from "./ui/splash.js";
import * as home from "./ui/home.js";
import * as lesson from "./ui/lesson.js";
import * as done from "./ui/done.js";
import * as badges from "./ui/badges.js";
import * as closet from "./ui/closet.js";
import * as settings from "./ui/settings.js";
import * as garden from "./ui/garden.js";
import * as guard from "./ui/guard.js";

export const VERSION = "v0.17.0";
const SCREENS = { splash, home, lesson, done, badges, closet, settings, garden, guard };

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
// 영구 저장 요청(v0.6.2 나): 앱을 열 때 + 첫 진도 저장 뒤. 던지지 않음
const requestPersist = createPersist();

// 레슨 목록과 장 가져오기(v0.3 작업 1). 배포판: build.py가 넣은 목록·장 파일 이름표 → 장은 열 때 받음.
// 개발판: 둘 다 없음 → data/lessons/chN.js를 전부 import(lessondev.js, 배포판에서는 빈 모듈).
// v0.13.1 영어 레슨: 영어면 영어 장(있는 것만, 없는 장은 한국어)으로. 목록·이름은 영어 꾸러미(lessons) 안에
async function initLessonData(l = "ko") {
  if (window.RIA_CHAPTER_FILES && window.RIA_LESSON_INDEX) {
    const ko = { index: window.RIA_LESSON_INDEX, files: window.RIA_CHAPTER_FILES };
    const m = l === "en" ? mergeLangLessons(ko, packOf("en") && packOf("en").lessons) : ko;
    return createLessonData({ index: m.index, files: m.files, base: location.href });
  }
  const mods = await loadDevChapters();
  if (l !== "en") return createLessonData({ modules: mods });
  const en = new Map((await loadDevChapters("en")).map((m) => [m.CHAPTER && m.CHAPTER.id, m]));
  return createLessonData({ modules: mods.map((m) => en.get(m.CHAPTER && m.CHAPTER.id) || m) });
}
/** 지금 언어의 레슨 목록으로(언어를 바꾼 뒤). 레슨 id는 언어와 상관없이 같다 */
// 언어를 빠르게 오가면 불러오기가 겹칠 수 있다(개발판은 장 모듈을 하나씩 불러와 느림) → 마지막 것만 쓴다(v0.13.4 검토 M2)
const loadLatest = latestOnly((l) => initLessonData(l));
async function reloadLessons() {
  const l = lang();
  try {
    const r = await loadLatest(l);
    if (r.stale || l !== lang()) return;
    app.data = r.value;
    app.chapters = app.data.index;
    app.dataLang = l;
  } catch (e) {
    console.error(e);
    return;
  }
  app.lessons = app.chapters.flatMap((c) => c.lessons);
  app.advanced = app.chapters.flatMap((c) => c.advanced || []);
}

// 경비실 사건(v0.16.0 작업 2). 배포판: build.py가 넣은 색인·장 파일 이름표 → 본문은 사건을 열 때 받음(곧바로, 기다림 없음).
// 개발판: 둘 다 없음 → data/guard.js를 불러옴(guarddev.js, 배포판에서는 []를 돌려주는 빈 모듈).
function prodGuardData() {
  if (!window.RIA_GUARD_INDEX || !window.RIA_GUARD_FILES) return null;
  return createGuardData({ index: window.RIA_GUARD_INDEX, files: window.RIA_GUARD_FILES, base: location.href });
}
/**
 * 판정 G2-C3: 색인은 저장을 읽기(migrate → cleanGuard) 전에 넣어야 한다. 색인 없이 다듬으면 해결 기록을 지우게 되므로
 * state.js는 색인이 없으면 던지고, 색인을 못 만들면(배포판인데 이름표가 없음 등) setGuardIndex가 던져 앱 시작이 멈춘다.
 */
async function initGuard() {
  const data = prodGuardData() || createGuardData({ incidents: await loadDevIncidents() });
  setGuardIndex(data.index);
  app.guard = data;
}

const app = {
  save: null, screen: null, params: null, modal: null,
  chapters: [], lessons: [],   // 레슨 목록(문제·카드 없음). 전체는 ctx.getLesson / getChapter. lessons는 본 과정만
  advanced: [],                // 심화 레슨 목록(v0.7, 선택 레슨)
  data: null,
  guard: null,           // 경비실 사건 { index, load(장) } (v0.16.0, src/guard/catalog.js createGuardData)
  dataLang: null,        // app.data(레슨 목록·장 파일)가 어느 언어로 불러온 것인지(v0.13.4)
  swChanged: false,      // 이 페이지를 다루던 서비스 작업자가 새 판으로 바뀜 → 장 파일 이름표가 옛것일 수 있음
  cleanup: null,
  greetOverride: null,   // 다음 홈 인사 한 번: "welcome_back" | "streak_broken"
  lastLine: {},          // 대사 상황별 직전 줄 번호
  py: null, pyStatus: "loading", pyPhase: "first-load", pyListeners: new Set(),
  storeFailedShown: false,
  dev: false,            // 개발자 모드(검수용, v0.11.1): 켜 있으면 저장·이어 하기를 따로 둔 칸에서 읽고 씀(src/devmode.js)
};

const sound = createSound(() => app.save && app.save.settings && app.save.settings.sound !== false);

// ---- Python 작업자 ----
function initPy() {
  const indexURL = (typeof window !== "undefined" && window.RIA_PYODIDE_URL) || PYODIDE_CDN;
  // build.py가 작업자·runner를 HTML에 넣으면 이 두 값을 채운다(판정 C29). 개발판에서는 undefined → 기본 동작
  const py = new PyRun({ indexURL, workerURL: window.RIA_WORKER_URL, runnerURL: window.RIA_RUNNER_URL });
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
  if (r.usedFreezes > 0) toast(t`기록 보호권 ${r.usedFreezes}개로 연속 기록을 지켰어요.`);
  s = ensureQuests(s, today);
  s = ensureDaily(s, today, app.chapters);
  if (JSON.stringify(s) !== before) commit(s);
  else app.save = s;
}

// ---- 저장 ----
function commit(next) {
  next = markDev(next, app.dev);   // 지금 칸에 맞는 개발자 표시(가져오기 등으로 빠지거나 섞여 들어와도)
  app.save = next;
  const ok = storeSlot(storage, next, app.dev);
  if (!ok && !app.storeFailedShown) {
    app.storeFailedShown = true;
    toast(t`저장하지 못했어요. 브라우저 저장 공간이 꽉 찼거나 막혀 있어요. 설정에서 저장 내보내기를 해 두면 안전해요.`, "warn");
  }
  if (ok) app.storeFailedShown = false;
  // 화면에 있는 상태 줄(연속 기록·바이트·XP)을 새 값으로
  const bar = document.querySelector("#app .status");
  if (bar) {
    const tpl = document.createElement("template");
    tpl.innerHTML = statusBar(next).trim();
    bar.replaceWith(tpl.content.firstElementChild);
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
function lessonById(id) { return app.lessons.find((l) => l.id === id) || app.advanced.find((l) => l.id === id); }
// 심화(v0.7): 장 평가를 끝내면 열림. 개발자 모드 저장이면 모두 열림(src/devgate.js). 지금 레슨 계산(아래)은 본 과정 lessons만 본다
function lessonState(id) {
  return lessonStateOf(app.chapters, app.save, id);
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
  return o ? tx(`outfit.${o.id}.short`, o.short) : "";
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
  const { save, result } = finishLesson(app.save, { ...info, nextLessonId, nextChapter, advancedIds: advancedIds(app.chapters) }, new Date());
  commit(save);
  if (firstEver) {
    requestPersist();
    app.installHintPending = true;
  }
  return result;
}

// ---- 매일 도전 (v0.9) ----
/** 오늘 문제를 저장에 고정(필요할 때만 저장)하고 홈 카드 상태를 돌려준다 */
function daily() {
  const today = localDate();
  const next = ensureDaily(app.save, today, app.chapters);
  if (next !== app.save) commit(next);
  return dailyStatus(app.save, today, app.chapters);
}
/** 도전 화면이 문제를 하나 끝낼 때마다: 끝난 문제 번호(+건너뛴 문제)와 새 개념 점수를 바로 저장 */
function dailyStep(lesson, S) {
  const idx = finishedItems(S.flow).map((i) => lesson.items[i] && lesson.items[i].dailyIndex).filter(Number.isInteger);
  const marks = S.marks.slice(S.dailyMarked || 0);
  S.dailyMarked = S.marks.length;
  const next = recordDaily(app.save, lesson.date, [...idx, ...(lesson.skipped || [])], marks);
  if (JSON.stringify(next.daily) !== JSON.stringify(app.save.daily) || marks.length) commit(next);
}
function finishDailyChallenge(info) {
  const { save, result } = finishDaily(app.save, { ...info, advancedIds: advancedIds(app.chapters) }, new Date());
  commit(save);
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
  return openInstallSheet({ outfit: app.save.outfit, kind: k, platform: installPlatform(ua) });
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

// 하던 레슨 기록(v0.6.2 다): 본 저장과 따로 한 칸. 없는 레슨·24시간 지난 기록은 읽을 때 지운다
// 개발자 모드에서는 따로 둔 칸(keysFor(true).resume)
const resume = {
  read: () => readResume(storage, { now: Date.now(), exists: (id) => !!lessonById(id), key: keysFor(app.dev).resume, lang: lang() }),
  write: (rec) => writeResume(storage, { ...rec, lang: lang() }, keysFor(app.dev).resume),
  clear: () => clearResume(storage, keysFor(app.dev).resume),
};

// ---- 개발자 모드 (검수용, v0.11.1) ----
function paintDev() {
  try {
    document.documentElement.classList.toggle("dev-on", app.dev);
    const b = document.getElementById("dev-banner");
    if (b) { b.hidden = !app.dev; b.textContent = t`개발자 모드`; } // index.html의 글자를 언어에 맞춤(v0.13.0)
  } catch { /* 화면 없음 */ }
}
/** 켜고 끄기: 깃발을 남기고 그 칸의 저장으로 바꾼 뒤 오늘에 맞춤. 학습 기록은 켜 있는 동안 읽지도 쓰지도 않는다 */
// ---- 언어 (v0.13.0) ----
// 공개 전(EN_PUBLIC=false)에는 개발자 모드에서만 고를 수 있고 영어가 적용된다
const langAllowed = () => EN_PUBLIC || app.dev;
function applyLang(l) {
  setLang(l === "en" && langAllowed() ? "en" : "ko");
  document.documentElement.lang = lang();
  document.title = t`리아와 파이썬` + "!";
  // v0.14.0: 홈 화면에 추가할 때의 앱 이름도 언어별(안드로이드는 manifest, 아이폰은 apple-mobile-web-app-title)
  const man = document.querySelector('link[rel="manifest"]');
  if (man) man.setAttribute("href", lang() === "en" ? "manifest.en.webmanifest" : "manifest.webmanifest");
  const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (apple) apple.setAttribute("content", t`리아와 파이썬`);
  paintDev();
}
/** 지금 저장의 언어로 맞춘다(영어 꾸러미가 없으면 받아 옴). 못 받으면 한국어로 두고 false */
const wantLang = () => (app.save.settings.lang === "en" && langAllowed() ? "en" : "ko");
/** 지금 저장의 언어로 맞춘다(영어 꾸러미가 없으면 받아 옴). 못 받으면 한국어. 돌려주는 값: 언어가 바뀌었는가 */
async function syncLang() {
  const before = lang();
  const want = wantLang();
  if (want === "en" && !(await loadLangPack("en"))) applyLang("ko");
  else applyLang(want);
  if (app.data && app.dataLang !== lang()) await reloadLessons();
  return lang() !== before;
}
/** v0.14.0(판정 C81): 영어로 배우면 영어 장 파일을 미리 받아 둔다(오프라인). 배포판·작업자가 있을 때만, 조용히 */
let warmTimer = null;
function warmLang(delayMs = 4000) {
  clearTimeout(warmTimer);
  if (lang() !== "en" || !app.data) return;
  warmTimer = setTimeout(() => {
    if (lang() !== "en" || !app.data) return;
    warmLangFiles(app.data.fileList().filter((f) => f.startsWith("lessons/en/"))).catch(() => {});
  }, delayMs);
}
/**
 * v0.14.3: 언어 단추를 직접 누른 적이 없으면 열 때마다 휴대폰 언어를 따른다(저장 값만 맞춤, 화면은 뒤에서 그림).
 * 직접 고른 사람·쓰던 사람(langChosen true)은 그대로.
 */
function followPhoneLang() {
  const want = deviceLang(app.save.settings, navigator.languages || [navigator.language], EN_PUBLIC);
  if (want !== app.save.settings.lang) commit({ ...app.save, settings: { ...app.save.settings, lang: want } });
}
/** 언어 바꾸기(시작 화면·설정). 바꾸면 지금 화면을 다시 그린다 */
async function setLanguage(l) {
  if (l !== "ko" && l !== "en") return false;
  const dev = app.dev;
  if (l === "en" && !(await loadLangPack("en"))) {
    toast(t`인터넷에 연결되면 바꿀 수 있어요.`, "warn");
    return false;
  }
  if (dev !== app.dev) return false; // 받는 동안 개발자 모드 칸이 바뀌었으면 다른 저장에 쓰지 않는다(검토 I4)
  commit({ ...app.save, settings: { ...app.save.settings, lang: l, langChosen: true } }); // 직접 고름: 이제 휴대폰 언어를 따르지 않음(v0.14.3)
  applyLang(l);
  if (app.dataLang !== lang()) await reloadLessons();
  show(app.screen, app.params);
  warmLang(1000);
  return true;
}

function setDev(on) {
  on = !!on;
  if (on === app.dev) return;
  const { save, readFailed, brokenKey } = setDevMode(storage, on);
  app.dev = on;
  app.save = save;
  followPhoneLang();
  if (brokenKey) commit({ ...app.save, broken_notice: brokenKey });   // 깨진 저장 안내(홈에서 한 번)
  app.storeFailedShown = false;
  app.greetOverride = null;
  if (readFailed) toast(t`저장을 읽지 못해 새로 시작해요. 이 브라우저의 저장 공간 설정을 확인해 주세요.`, "warn");
  // 개발자 모드 칸마다 언어가 다를 수 있다(공개 전 영어는 개발자 모드만). 꾸러미가 이미 있으면 바로 맞춰
  // 오늘 안내(dayStart)도 그 언어로 나오게 한다(검토 I2). 아직 없으면 받은 뒤, 언어가 바뀐 때만 다시 그림(검토 I1)
  applyLang(wantLang());
  paintDev();
  if (app.lessons.length) resume.read();
  dayStart();
  if (wantLang() !== lang()) syncLang().then((changed) => { if (changed && app.screen) show(app.screen, app.params); });
  else if (app.data && app.dataLang !== lang()) reloadLessons().then(() => { if (app.screen) show(app.screen, app.params); });
}

const ctx = {
  app, resume,
  afterDone, showInstallSheet,
  version: VERSION,
  get save() { return app.save; },
  get dev() { return app.dev; },
  setDev,
  setLanguage,
  get langPicker() { return langAllowed(); },
  commit, show, say, sound, toast, finish,
  daily, dailyStep, finishDaily: finishDailyChallenge,
  get chapters() { return app.chapters; },
  get lessons() { return app.lessons; },
  get guard() { return app.guard; },
  get advanced() { return app.advanced; },
  advancedIds: () => advancedIds(app.chapters),
  lessonById,
  getLesson: (id) => (app.data ? app.data.getLesson(id) : Promise.resolve(null)),
  getChapter: (n) => app.data.getChapter(n),
  chaptersForConcepts: (concepts) => chaptersForConcepts(app.chapters, concepts, app.save.completed_lessons),
  swChanged: () => app.swChanged,
  // 오프라인 준비에 필요한 파일: 지금 언어의 장 파일 + Python 실행기(v0.14.0 판정 C80: 첫 파일 밖)
  get chapterFiles() { return [...(app.data ? app.data.fileList() : []), ...(window.RIA_RUNNER_URL ? [window.RIA_RUNNER_URL] : [])]; },
  lessonState, currentLessonId,
  today: () => localDate(),
  get py() { return app.py; },
  pyState: () => ({ status: app.pyStatus, phase: app.pyPhase }),
  onPy(f) { app.pyListeners.add(f); return () => app.pyListeners.delete(f); },
  dayStart,
  takeGreeting() { const g = app.greetOverride; app.greetOverride = null; return g; },
  // 의상 교체로 돌려준 바이트 안내(판정 C42): 처음 한 번만. 깃발을 내린 저장을 바로 남긴다
  takeNotice() {
    const r = takeRefundNotice(app.save);
    if (!r.bytes) return null;
    commit(r.save);
    return { text: refundNoticeText(r.bytes), face: "wink", situation: "refund" };
  },
  // 깨진 저장 안내(v0.12.1): 처음 한 번만. 깃발을 내린 저장을 바로 남기고 { text, key }
  takeBrokenNotice() {
    const r = takeBrokenNotice(app.save);
    if (!r.key) return null;
    commit(r.save);
    return { text: brokenNoticeText(), key: r.key };
  },
  /** 남겨 둔 깨진 저장 원문을 파일로 받기. 없으면 false */
  exportBroken(key) {
    let text = null;
    try { text = storage.getItem(key); } catch { text = null; }
    if (text === null || text === undefined) return false;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = `ria-python-old-save-${localDate()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return true;
  },
  migrate,
};

async function boot() {
  const root = document.getElementById("app");
  await initGuard();   // 저장을 읽기 전에(판정 G2-C3)
  app.dev = readDevFlag(storage);
  paintDev();
  const { save, readFailed, brokenKey } = loadSlot(storage, app.dev);
  app.save = save;
  followPhoneLang();
  // 깨진 저장(v0.12.1, QA 5): 새 저장에 남긴 칸 이름을 적어 바로 저장 → 홈에서 한 번 안내(새로고침해도 다시 .broken으로 남기지 않음)
  if (brokenKey) commit({ ...app.save, broken_notice: brokenKey });
  if (readFailed) toast(t`저장을 읽지 못해 새로 시작해요. 이 브라우저의 저장 공간 설정을 확인해 주세요.`, "warn");
  initPy();
  requestPersist();
  try {
    // 처음 설치(작업자 없음 → 생김)는 새 판이 아님. 다루던 작업자가 바뀔 때만
    const sw = navigator.serviceWorker;
    if (sw && sw.controller) sw.addEventListener("controllerchange", () => { app.swChanged = true; });
  } catch { /* 지원 안 함 */ }
  await syncLang();   // 오늘 안내(dayStart)보다 먼저: 안내가 고른 언어로(검토 I2). 레슨 목록도 이 언어로(v0.13.1)
  try {
    app.data = await initLessonData(lang());
    app.chapters = app.data.index;
    app.dataLang = lang();
  } catch (e) {
    console.error(e);
    app.chapters = [];
  }
  app.lessons = app.chapters.flatMap((c) => c.lessons);
  app.advanced = app.chapters.flatMap((c) => c.advanced || []);
  if (app.lessons.length) resume.read();   // 낡은 기록 치우기(레슨 목록을 못 받았으면 건드리지 않음)
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
  // v0.17.0: 따로 나간 묶음(편집기·오류 안내)은 첫 화면을 그린 뒤 쉬는 틈에 미리 받는다(첫 그리기와 다투지 않게:
  // 다음 그리기 직전 rAF → 그린 뒤 setTimeout → requestIdleCallback)
  requestAnimationFrame(() => setTimeout(() => prefetchChunks(), 0));
  warmLang();
  window.addEventListener("online", () => warmLang(1000));
  // 처음 여는 사람: 서비스 작업자 설치(Pyodide 미리 받기)가 끝나 페이지를 다루기 시작할 때 다시(v0.14.0 검토 I1)
  try { navigator.serviceWorker?.addEventListener("controllerchange", () => warmLang(1000)); } catch { /* 지원 안 함 */ }
  // 시험 도구가 상태를 볼 수 있게
  window.__ria = { app, ctx };
}

boot().catch((e) => {
  console.error(e);
  const root = document.getElementById("app");
  if (root) root.innerHTML = `<p class="fatal">${t`앱을 시작하지 못했어요. 새로고침해 주세요.`}</p>`;
});
