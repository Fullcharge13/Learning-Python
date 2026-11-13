// v0.19.0 화면 설정: 저장·해석·적용, 그리고 index.html 머리 스크립트와 같은 규칙인지
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { THEME_KEY, THEME_COLOR, getTheme, setTheme, resolvedTheme, applyTheme, watchSystem } from "../../src/theme.js";

function fakeEnv({ stored, systemDark = false, throwing = false } = {}) {
  const m = new Map(stored === undefined ? [] : [[THEME_KEY, stored]]);
  const root = { dataset: {}, style: {}, setAttribute(k, v) { if (k === "data-theme") this.dataset.theme = v; } };
  const meta = { content: "#FBF6EA", setAttribute(k, v) { this[k] = v; } };
  const listeners = [];
  const mq = { get matches() { return env.systemDark; },
    addEventListener: (_, f) => listeners.push(f), removeEventListener: (_, f) => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); } };
  const env = { systemDark, listeners, m, root, meta,
    localStorage: {
      getItem: (k) => { if (throwing) throw new Error("denied"); return m.has(k) ? m.get(k) : null; },
      setItem: (k, v) => { if (throwing) throw new Error("denied"); m.set(k, String(v)); },
    },
    document: { documentElement: root, querySelector: (q) => (q.includes("theme-color") ? meta : null) },
    matchMedia: () => mq };
  return env;
}
function install(env) {
  for (const k of ["localStorage", "document", "matchMedia"]) Object.defineProperty(globalThis, k, { value: env[k], configurable: true, writable: true });
}
beforeEach(() => install(fakeEnv()));

test("저장 없음·이상한 값·저장소 오류는 system", () => {
  assert.equal(getTheme(), "system");
  install(fakeEnv({ stored: "x" }));
  assert.equal(getTheme(), "system");
  install(fakeEnv({ throwing: true }));
  assert.equal(getTheme(), "system");
  assert.equal(resolvedTheme(), "light");
});

test("setTheme: 저장하고 data-theme·color-scheme·theme-color를 바꿈", () => {
  const env = fakeEnv(); install(env);
  assert.equal(setTheme("dark"), "dark");
  assert.equal(env.m.get(THEME_KEY), "dark");
  assert.equal(env.root.dataset.theme, "dark");
  assert.equal(env.root.style.colorScheme, "dark");
  assert.equal(env.meta.content, THEME_COLOR.dark);
  setTheme("light");
  assert.equal(env.root.dataset.theme, "light");
  assert.equal(env.meta.content, "#FBF6EA");
  setTheme("zzz");   // 이상한 값은 system으로
  assert.equal(env.m.get(THEME_KEY), "system");
});

test("setTheme: 저장소를 못 써도 이번 화면은 바뀜", () => {
  const env = fakeEnv({ throwing: true }); install(env);
  setTheme("dark");
  assert.equal(env.root.dataset.theme, getTheme() === "dark" ? "dark" : "light");
});

test("system은 시스템 설정을 따름, 고른 값은 시스템을 이김", () => {
  install(fakeEnv({ systemDark: true }));
  assert.equal(resolvedTheme(), "dark");
  install(fakeEnv({ stored: "light", systemDark: true }));
  assert.equal(resolvedTheme(), "light");
  install(fakeEnv({ stored: "dark", systemDark: false }));
  assert.equal(resolvedTheme(), "dark");
});

test("watchSystem: system일 때만 따라가고, 끄면 멈춤", () => {
  const env = fakeEnv({ systemDark: false }); install(env);
  const stop = watchSystem();
  env.systemDark = true; env.listeners.forEach((f) => f());
  assert.equal(env.root.dataset.theme, "dark");
  setTheme("light");
  env.systemDark = false; env.systemDark = true; env.listeners.forEach((f) => f());
  assert.equal(env.root.dataset.theme, "light", "밝게를 골랐으면 시스템이 바뀌어도 그대로");
  stop();
  assert.equal(env.listeners.length, 0);
});

test("index.html 머리 스크립트와 resolvedTheme은 모든 경우에 같은 답", () => {
  const html = fs.readFileSync(new URL("../../src/index.html", import.meta.url), "utf8");
  const code = html.split("<script>").map((s) => s.split("</script>")[0]).find((s) => s.includes("ria-python.theme"));
  assert.ok(code, "머리 스크립트가 있어야 함");
  assert.ok(html.indexOf("ria-python.theme") < html.indexOf("<!-- RIA:STYLE -->"), "CSS보다 먼저");
  for (const stored of [undefined, "system", "light", "dark", "x"]) for (const systemDark of [false, true]) for (const throwing of [false, true]) {
    const env = fakeEnv({ stored, systemDark, throwing });
    vm.runInNewContext(code, { localStorage: env.localStorage, document: env.document, matchMedia: env.matchMedia });
    install(env);
    const want = resolvedTheme();
    const tag = JSON.stringify({ stored, systemDark, throwing });
    assert.equal(env.root.dataset.theme, want, tag);
    assert.equal(env.root.style.colorScheme, want, tag);
    assert.equal(env.meta.content, THEME_COLOR[want], tag);
  }
});
