// 리아와 파이썬! 서비스 작업자 (설계서 8장, 계획 작업 10)
// build.py가 밑줄 두 개로 감싼 RIA 자리 표시를 채워 dist/sw.js로 내보낸다. 이 파일을 그대로 쓰지 않는다.
//
// - 게임 파일(index.html, manifest, 아이콘): 네트워크 먼저 → 끊기거나 4초 넘게 느리면 저장본. 새 판이 바로 보이게.
// - Pyodide 파일(주소가 PYODIDE_PREFIX로 시작): 저장본 먼저 → 없으면 받아서 저장. 버전 고정 주소라 바뀌지 않음.
// - GET이 아닌 요청, 다른 주소의 요청은 건드리지 않는다.
// - 게임 저장본 이름에 판 번호와 내용 지문이 들어 있어, 새 판을 올리면 활성화 때 옛 저장본을 지운다.
//   Pyodide 저장본은 Pyodide 버전으로만 이름이 바뀐다(판을 올려도 10MB를 다시 받지 않게).

const VERSION = "v0.1";
const GAME_CACHE = "ria-game-v0.1-f4693fddf8";
const PY_CACHE = "ria-pyodide-314.0.7";
const PYODIDE_PREFIX = new URL("https://cdn.jsdelivr.net/npm/pyodide@314.0.7/", self.location.href).href;
const GAME_FILES = ["./", "index.html", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
const NETWORK_TIMEOUT_MS = 4000; // 게임 파일: 이보다 느리면 저장본을 먼저 보여 줌
// 처음 설치 때 미리 받아 두는 Pyodide 핵심 파일(실패해도 설치는 계속, 쓸 때 다시 받음)
const PY_CORE = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const game = await caches.open(GAME_CACHE);
    await game.addAll(GAME_FILES.map((f) => new Request(f, { cache: "reload" })));
    try {
      const py = await caches.open(PY_CACHE);
      const missing = [];
      for (const f of PY_CORE) {
        const url = PYODIDE_PREFIX + f;
        if (!(await py.match(url))) missing.push(url);
      }
      await Promise.all(missing.map(async (url) => {
        const res = await fetch(url, { mode: "cors", credentials: "omit" });
        if (res.ok) await py.put(url, res);
      }));
    } catch (_) { /* 네트워크가 약하면 나중에 실제로 쓸 때 저장한다 */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("ria-") && key !== GAME_CACHE && key !== PY_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function pyodideFirst(request) {
  const cache = await caches.open(PY_CACHE);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && (res.type === "basic" || res.type === "cors")) {
    try { await cache.put(request.url, res.clone()); } catch (_) { /* 저장 공간 부족 등 */ }
  }
  return res;
}

async function fromCache(cache, request) {
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  if (request.mode === "navigate") return (await cache.match("index.html")) || (await cache.match("./")) || null;
  return null;
}

// 네트워크 먼저. 끊기면 바로, 느리면 NETWORK_TIMEOUT_MS 뒤 저장본. 저장본이 없으면 네트워크를 계속 기다린다.
async function networkFirst(request) {
  const cache = await caches.open(GAME_CACHE);
  const net = fetch(request).then(async (res) => {
    if (res.ok && res.type === "basic") {
      try { await cache.put(request, res.clone()); } catch (_) { /* 무시 */ }
    }
    return res;
  });
  net.catch(() => {}); // 저장본으로 이미 답한 뒤 늦게 실패해도 경고를 남기지 않게
  let timer;
  const slow = new Promise((resolve) => { timer = setTimeout(resolve, NETWORK_TIMEOUT_MS, "timeout"); });
  try {
    const first = await Promise.race([net, slow]);
    if (first !== "timeout") return first;
    const hit = await fromCache(cache, request);
    return hit || (await net);
  } catch (err) {
    const hit = await fromCache(cache, request);
    if (hit) return hit;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.url.startsWith(PYODIDE_PREFIX)) {
    event.respondWith(pyodideFirst(req));
    return;
  }
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(req));
});

self.addEventListener("message", (event) => {
  if (event.data === "version" && event.source) event.source.postMessage({ version: VERSION, cache: GAME_CACHE });
});
