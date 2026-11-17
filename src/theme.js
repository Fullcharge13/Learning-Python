// 화면 설정(v0.19.0 「밤의 연구 노트」): 시스템 따라가기 · 밝게 · 어둡게.
// 기기 단위 설정이라 학습 기록(save)과 따로 localStorage 한 칸에 둔다. src/index.html 머리 스크립트와 규칙이 같다(같은 시험으로 확인).
import { cleanDeco } from "./deco.js";

export const THEME_KEY = "ria-python.theme";
export const THEME_COLOR = { light: "#FBF6EA", dark: "#141C2B" };   // 어둡게는 --paper와 같은 값
const VALUES = ["system", "light", "dark"];

/** 저장된 설정. 없거나 이상하거나 저장소를 못 읽으면 "system" */
export function getTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return VALUES.includes(v) ? v : "system";
  } catch { return "system"; }
}

function systemDark() {
  try { return !!(globalThis.matchMedia && globalThis.matchMedia("(prefers-color-scheme: dark)").matches); } catch { return false; }
}

/** 실제로 쓰는 색: system이면 시스템 설정을 따름 */
export function resolvedTheme() {
  const v = getTheme();
  return v === "system" ? (systemDark() ? "dark" : "light") : v;
}

/** <html data-theme>·color-scheme·theme-color를 지금 값에 맞춤 */
export function applyTheme() {
  const r = resolvedTheme();
  const el = document.documentElement;
  el.dataset.theme = r;
  el.style.colorScheme = r;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[r]);
  return r;
}

/** 고른 값을 저장하고 바로 적용(저장을 못 해도 이번 화면은 바뀜) */
export function setTheme(v) {
  const val = VALUES.includes(v) ? v : "system";
  try { localStorage.setItem(THEME_KEY, val); } catch { /* 저장 불가 */ }
  return applyTheme();
}

/** 시스템 설정이 바뀌면(system일 때만) 다시 적용. 끄는 함수를 돌려줌 */
export function watchSystem() {
  let mq;
  try { mq = globalThis.matchMedia && globalThis.matchMedia("(prefers-color-scheme: dark)"); } catch { mq = null; }
  if (!mq || !mq.addEventListener) return () => {};
  const on = () => { if (getTheme() === "system") applyTheme(); };
  mq.addEventListener("change", on);
  return () => mq.removeEventListener("change", on);
}

/** v0.22.0 편집기 색(설계 2026-11-17 §5-4): 저장의 deco.on.editor를 <html data-edtheme>에(없으면 속성을 뗌).
 *  편집기 묶음(src/ui/editor.js)이 이 속성을 읽고 지켜본다. 값이 같으면 건드리지 않는다(감시가 헛돌지 않게).
 *  공간 꾸미기(텃밭·경비실·공방)는 각 화면이 그릴 때 저장에서 읽는다. 돌려줌: 단 값(없으면 null) */
export function applyDecoAttrs(save) {
  const id = cleanDeco(save && save.deco).on.editor;
  const el = typeof document !== "undefined" ? document.documentElement : null;
  if (!el) return id;
  if (id) { if (el.getAttribute("data-edtheme") !== id) el.setAttribute("data-edtheme", id); }
  else if (el.hasAttribute("data-edtheme")) el.removeAttribute("data-edtheme");
  return id;
}
