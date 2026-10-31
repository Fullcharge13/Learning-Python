// 리아와 파이썬! 서비스 작업자 (설계서 8장, 계획 작업 10)
// build.py가 밑줄 두 개로 감싼 RIA 자리 표시를 채워 dist/sw.js로 내보낸다. 이 파일을 그대로 쓰지 않는다.
//
// - 게임 파일(index.html, manifest, 아이콘): 네트워크 먼저 → 끊기거나 4초 넘게 느리면 저장본. 새 판이 바로 보이게.
//   저장본은 설치 때만 채운다(받은 새 판을 옛 저장본에 섞지 않음 → 오프라인은 언제나 한 판이 통째로).
// - Pyodide 파일(주소가 PYODIDE_PREFIX로 시작): 저장본 먼저 → 없으면 받아서 저장. 버전 고정 주소라 바뀌지 않음.
// - 장 파일(lessons/chN-<지문8자>.json, v0.3 작업 1): 설치 때 모두 미리 받음(하나가 실패해도 설치는 계속, 처음 열 때 받음).
//   이름에 내용 지문이 있어 바뀌지 않으므로 저장본 먼저. 게임 저장본에 함께 들어 있어 새 판 활성화 때 함께 지워진다.
// - GET이 아닌 요청, 다른 주소의 요청은 건드리지 않는다.
// - 게임 저장본 이름에 판 번호와 내용 지문이 들어 있어, 새 판을 올리면 활성화 때 옛 저장본을 지운다.
//   Pyodide 저장본은 Pyodide 버전으로만 이름이 바뀐다(판을 올려도 10MB를 다시 받지 않게).

const VERSION = "v0.6.1";
const GAME_CACHE = "ria-game-v0.6.1-0a6ed9821b";
const PY_CACHE = "ria-pyodide-314.0.7";
const PYODIDE_PREFIX = new URL("https://cdn.jsdelivr.net/npm/pyodide@314.0.7/", self.location.href).href;
const GAME_FILES = ["./", "index.html", "manifest.webmanifest", "licenses.txt", "icons/apple-touch-icon.png", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
const CHAPTER_FILES = ["lessons/ch1-08439fba.json", "lessons/ch2-e70bd7ca.json", "lessons/ch3-bf81b364.json", "lessons/ch4-cd55d27e.json", "lessons/ch5-00033ad1.json", "lessons/ch6-74b3a52f.json", "lessons/ch7-c1d8e921.json", "lessons/ch8-d5b64adf.json", "lessons/ch9-89ed61fb.json", "lessons/ch10-ba15556a.json", "lessons/ch11-b3074b4c.json", "lessons/ch12-526a2218.json", "lessons/ch13-ad936be5.json", "lessons/ch14-4ae616a7.json", "lessons/ch15-e5394585.json", "lessons/ch16-f8cdac70.json", "lessons/ch17-664329fe.json"];
const CHAPTER_RE = /\/lessons\/ch[1-9]\d*-[0-9a-f]{8}\.json$/;
const NETWORK_TIMEOUT_MS = 4000; // 게임 파일: 이보다 느리면 저장본을 먼저 보여 줌
// 처음 설치 때 미리 받아 두는 Pyodide 핵심 파일(실패해도 설치는 계속, 쓸 때 다시 받음)
// sqlite3(16장)도 여기에 들어 있다: _sqlite3는 pyodide.asm.wasm에, sqlite3 모듈은 python_stdlib.zip에(Pyodide 314.0.7)
const PY_CORE = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const game = await caches.open(GAME_CACHE);
    await game.addAll(GAME_FILES.map((f) => new Request(f, { cache: "reload" })));
    await Promise.all(CHAPTER_FILES.map(async (f) => {
      try {
        if (await game.match(f)) return;
        const res = await fetch(new Request(f, { cache: "reload" }));
        if (res.ok) await game.put(f, res);
      } catch (_) { /* 이 장은 처음 열 때 받는다 */ }
    }));
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

// 장 파일: 저장본 먼저 → 없으면 받아서 저장(이름이 내용 지문이라 바뀌지 않음)
async function chapterFirst(request) {
  const cache = await caches.open(GAME_CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") {
    try { await cache.put(request, res.clone()); } catch (_) { /* 저장 공간 부족 등 */ }
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
  // 받은 것을 저장본에 쓰지 않는다: 게임 저장본은 설치 때만 채운다(v0.3). 새 판 index.html을 옛 저장본에 쓰면
  // 새 작업자 설치가 실패했을 때 오프라인에서 저장 안 된 새 장 파일을 찾게 된다.
  const net = fetch(request);
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
  if (CHAPTER_RE.test(url.pathname)) {
    event.respondWith(chapterFirst(req));
    return;
  }
  event.respondWith(networkFirst(req));
});

self.addEventListener("message", (event) => {
  if (event.data === "version" && event.source) event.source.postMessage({ version: VERSION, cache: GAME_CACHE });
});
