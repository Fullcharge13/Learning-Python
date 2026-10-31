// 오프라인 준비 판정 (판정 C32, v0.3: 장 파일 전부 저장됨도 조건). 순수 함수 + 브라우저에서 값을 모으는 얇은 함수.
// 홈 화면 앱은 사파리와 저장 공간이 따로라서, 인터넷이 될 때 한 번 열어 Pyodide 파일을 받아 둬야
// 비행기 모드에서도 열리고 코드가 실행된다.

export const PYODIDE_CACHE_PREFIX = "ria-pyodide-";
export const GAME_CACHE_PREFIX = "ria-game-";
// v0.5: 16장 sqlite3는 따로 받을 꾸러미가 없다(Pyodide 314.0.7은 _sqlite3를 pyodide.asm.wasm에, sqlite3 모듈을
// python_stdlib.zip에 넣어 둠). 그래서 이 네 파일이 있으면 sqlite3도 오프라인에서 돈다(tests/build_test.py가 지킴).
export const PYODIDE_REQUIRED = ["pyodide.asm.wasm", "python_stdlib.zip", "pyodide.mjs", "pyodide.asm.mjs"];

// URL 마지막 조각이 정확히 그 파일 이름인지 (pyodide.asm.mjs를 pyodide.mjs로 착각하지 않게)
function fileName(url) {
  const path = String(url).split(/[?#]/)[0];
  return path.slice(path.lastIndexOf("/") + 1);
}

// 저장된 주소가 장 파일 이름(lessons/chN-xxxxxxxx.json)으로 끝나는지. 앞 글자가 /여야 같은 파일
function endsWithFile(url, rel) {
  const path = String(url).split(/[?#]/)[0];
  return path === rel || path.endsWith("/" + rel);
}

/**
 * @param {{ controlled: boolean, cacheNames: string[] | null, urlsByCache: Record<string, string[]> | null,
 *           chapterFiles?: string[] }} o  chapterFiles: 배포판의 장 파일 이름 전부(개발판은 빈 목록)
 * @returns {{ ready: boolean, missing: string[], reason: "ok" | "no-controller" | "no-caches" | "missing-files" | "missing-chapters" }}
 */
export function offlineStatus({ controlled, cacheNames, urlsByCache, chapterFiles = [] }) {
  const all = () => [...PYODIDE_REQUIRED, ...chapterFiles];
  if (!controlled) return { ready: false, missing: all(), reason: "no-controller" };
  if (!Array.isArray(cacheNames) || !urlsByCache) return { ready: false, missing: all(), reason: "no-caches" };
  const have = new Set();
  const gameUrls = [];
  for (const name of cacheNames) {
    const n = String(name);
    if (n.startsWith(PYODIDE_CACHE_PREFIX)) for (const url of urlsByCache[name] || []) have.add(fileName(url));
    if (n.startsWith(GAME_CACHE_PREFIX)) gameUrls.push(...(urlsByCache[name] || []));
  }
  const missingPy = PYODIDE_REQUIRED.filter((f) => !have.has(f));
  const missingCh = chapterFiles.filter((rel) => !gameUrls.some((u) => endsWithFile(u, rel)));
  const missing = [...missingPy, ...missingCh];
  const reason = missingPy.length ? "missing-files" : missingCh.length ? "missing-chapters" : "ok";
  return { ready: missing.length === 0, missing, reason };
}

/** 브라우저에서 판정에 필요한 값을 모은다. caches가 없거나 막혀 있으면 「준비 안 됨」 쪽으로 */
export async function collectOfflineStatus(chapterFiles = []) {
  const controlled = !!(typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.controller);
  if (typeof caches === "undefined") return offlineStatus({ controlled, cacheNames: null, urlsByCache: null, chapterFiles });
  try {
    const cacheNames = (await caches.keys()).filter((n) => n.startsWith(PYODIDE_CACHE_PREFIX) || n.startsWith(GAME_CACHE_PREFIX));
    const urlsByCache = {};
    for (const name of cacheNames) {
      const c = await caches.open(name);
      urlsByCache[name] = (await c.keys()).map((r) => r.url);
    }
    return offlineStatus({ controlled, cacheNames, urlsByCache, chapterFiles });
  } catch {
    return offlineStatus({ controlled, cacheNames: null, urlsByCache: null, chapterFiles });
  }
}
