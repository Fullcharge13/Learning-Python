// 오프라인 준비 판정 (판정 C32). 순수 함수 + 브라우저에서 값을 모으는 얇은 함수.
// 홈 화면 앱은 사파리와 저장 공간이 따로라서, 인터넷이 될 때 한 번 열어 Pyodide 파일을 받아 둬야
// 비행기 모드에서도 열리고 코드가 실행된다.

export const PYODIDE_CACHE_PREFIX = "ria-pyodide-";
export const PYODIDE_REQUIRED = ["pyodide.asm.wasm", "python_stdlib.zip", "pyodide.mjs", "pyodide.asm.mjs"];

// URL 마지막 조각이 정확히 그 파일 이름인지 (pyodide.asm.mjs를 pyodide.mjs로 착각하지 않게)
function fileName(url) {
  const path = String(url).split(/[?#]/)[0];
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * @param {{ controlled: boolean, cacheNames: string[] | null, urlsByCache: Record<string, string[]> | null }} o
 * @returns {{ ready: boolean, missing: string[], reason: "ok" | "no-controller" | "no-caches" | "missing-files" }}
 */
export function offlineStatus({ controlled, cacheNames, urlsByCache }) {
  if (!controlled) return { ready: false, missing: [...PYODIDE_REQUIRED], reason: "no-controller" };
  if (!Array.isArray(cacheNames) || !urlsByCache) return { ready: false, missing: [...PYODIDE_REQUIRED], reason: "no-caches" };
  const have = new Set();
  for (const name of cacheNames) {
    if (!String(name).startsWith(PYODIDE_CACHE_PREFIX)) continue;
    for (const url of urlsByCache[name] || []) have.add(fileName(url));
  }
  const missing = PYODIDE_REQUIRED.filter((f) => !have.has(f));
  return { ready: missing.length === 0, missing, reason: missing.length ? "missing-files" : "ok" };
}

/** 브라우저에서 판정에 필요한 값을 모은다. caches가 없거나 막혀 있으면 「준비 안 됨」 쪽으로 */
export async function collectOfflineStatus() {
  const controlled = !!(typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.controller);
  if (typeof caches === "undefined") return offlineStatus({ controlled, cacheNames: null, urlsByCache: null });
  try {
    const cacheNames = (await caches.keys()).filter((n) => n.startsWith(PYODIDE_CACHE_PREFIX));
    const urlsByCache = {};
    for (const name of cacheNames) {
      const c = await caches.open(name);
      urlsByCache[name] = (await c.keys()).map((r) => r.url);
    }
    return offlineStatus({ controlled, cacheNames, urlsByCache });
  } catch {
    return offlineStatus({ controlled, cacheNames: null, urlsByCache: null });
  }
}
