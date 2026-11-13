// 화면 설정(v0.19.0 「밤의 연구 노트」): 시스템 따라가기 · 밝게 · 어둡게.
// 기기 단위 설정이라 학습 기록(save)과 따로 localStorage 한 칸에 둔다. src/index.html 머리 스크립트와 규칙이 같다(같은 시험으로 확인).
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
