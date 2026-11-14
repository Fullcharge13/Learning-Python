// 리아와 파이썬! 서비스 작업자 (설계서 8장, 계획 작업 10)
// build.py가 밑줄 두 개로 감싼 RIA 자리 표시를 채워 dist/sw.js로 내보낸다. 이 파일을 그대로 쓰지 않는다.
//
// - 게임 파일(index.html, manifest, 아이콘): 네트워크 먼저 → 끊기거나 4초 넘게 느리면 저장본. 새 판이 바로 보이게.
//   저장본은 설치 때만 채운다(받은 새 판을 옛 저장본에 섞지 않음 → 오프라인은 언제나 한 판이 통째로).
// - Pyodide 파일(주소가 PYODIDE_PREFIX로 시작): 저장본 먼저 → 없으면 받아서 저장. 버전 고정 주소라 바뀌지 않음.
// - 장 파일(lessons/chN-<지문8자>.json, v0.3 작업 1): 설치 때 모두 미리 받음(하나가 실패해도 설치는 계속, 처음 열 때 받음).
//   이름에 내용 지문이 있어 바뀌지 않으므로 저장본 먼저. 게임 저장본에 함께 들어 있어 새 판 활성화 때 함께 지워진다.
//   Python 실행기(py/runner-<지문>.py, v0.14.0 판정 C80)·경비실 장(guard/chN-<지문>.json, v0.16.0)·
//   편집기·오류 안내 묶음(js/editor-<지문>.js, js/errors-<지문>.js, v0.17.0)도 같은 방법(설치 때 미리 받음).
// - 영어 장(lessons/en/, v0.14.0 판정 C81): 설치 때 미리 받지 않고, 처음 열 때·영어 사용자의 앱이 미리 받을 때
//   판과 상관없는 저장소(ria-lang-en)에 넣는다. 새 판이 켜지면 그 판 목록에 없는 옛 영어 장만 지운다.
// - GET이 아닌 요청, 다른 주소의 요청은 건드리지 않는다.
// - 게임 저장본 이름에 판 번호와 내용 지문이 들어 있어, 새 판을 올리면 활성화 때 옛 저장본을 지운다.
//   Pyodide 저장본은 Pyodide 버전으로만 이름이 바뀐다(판을 올려도 10MB를 다시 받지 않게).
//   (v0.19.2: 엔진은 같은 사이트 pyodide/에서. 옛 jsDelivr 저장본은 새 이름 덕에 쓰이지 않고 activate에서 지워짐)

const VERSION = "v0.20.2";
const GAME_CACHE = "ria-game-v0.20.2-45dcb65d72";
// v0.19.2(H-C1): 엔진을 같은 사이트 pyodide/에서 받으므로 저장소 이름을 새로 한다("-self").
// 옛 저장소 ria-pyodide-<판>은 jsDelivr 주소가 키라 쓸 수 없고, 이름 앞부분(ria-)이 같아 activate가 지워 준다.
const PY_CACHE = "ria-pyodide-314.0.7-self";
const PYODIDE_PREFIX = new URL("./pyodide/", self.location.href).href;
const GAME_FILES = ["./", "index.html", "manifest.webmanifest", "manifest.en.webmanifest", "licenses.txt", "icons/apple-touch-icon.png", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
// v0.14.0(판정 C81): 영어 장 파일은 판과 상관없는 저장소에 둔다(이름이 내용 지문 → 새 판에도 그대로 쓸 수 있음).
// 설치 때 미리 받지 않고(한국어 사용자가 판마다 영어를 더 받지 않게) 처음 열 때·영어 사용자의 앱이 미리 받을 때 저장.
// 새 판이 켜질 때 이번 판 목록(LANG_CHAPTER_FILES)에 없는 옛 파일만 지운다.
const LANG_CACHE = "ria-lang-en";
const LANG_CHAPTER_FILES = ["lessons/en/ch1-d67772a9.json", "lessons/en/ch10-56dcb00e.json", "lessons/en/ch11-135a31eb.json", "lessons/en/ch12-3f1d4216.json", "lessons/en/ch13-0af10dbe.json", "lessons/en/ch14-6cfdc76a.json", "lessons/en/ch15-7b8ae211.json", "lessons/en/ch16-b9d55954.json", "lessons/en/ch17-47ca806b.json", "lessons/en/ch2-d8af68e3.json", "lessons/en/ch3-081d5b36.json", "lessons/en/ch4-0912eb86.json", "lessons/en/ch5-c5450c84.json", "lessons/en/ch6-ae9efe89.json", "lessons/en/ch7-4513680e.json", "lessons/en/ch8-3854d93a.json", "lessons/en/ch9-85fc0189.json"];
const LANG_CHAPTER_RE = /\/lessons\/en\/ch[1-9]\d*-[0-9a-f]{8}\.json$/;
const CHAPTER_FILES = ["lessons/ch1-335d9e46.json", "lessons/ch2-89b60a90.json", "lessons/ch3-a4e6ec46.json", "lessons/ch4-a480e773.json", "lessons/ch5-cb9026b3.json", "lessons/ch6-ba5538f0.json", "lessons/ch7-6a49b6c8.json", "lessons/ch8-364dbb0d.json", "lessons/ch9-4b400353.json", "lessons/ch10-6c525f3e.json", "lessons/ch11-fcb52ebe.json", "lessons/ch12-f90cf7ba.json", "lessons/ch13-b92a0458.json", "lessons/ch14-b306b667.json", "lessons/ch15-eb9bff22.json", "lessons/ch16-dc387c35.json", "lessons/ch17-d4d588a5.json", "guard/ch3-afb8cde4.json", "guard/ch4-b39d89df.json", "guard/ch5-f0869adb.json", "guard/ch6-a5e92e32.json", "guard/ch7-18e928d4.json", "guard/ch8-c8d4b777.json", "guard/ch9-89e9068c.json", "guard/ch10-557360a4.json", "guard/ch11-8f5cd760.json", "guard/ch12-1ae005e4.json", "guard/ch13-7e16c77b.json", "guard/ch14-2c9b4307.json", "guard/ch15-8e2f4282.json", "guard/ch16-98e0a1ce.json", "guard/ch17-8374bffa.json", "lang/en-42829d17.json", "py/runner-29b6db5a.py", "js/editor-b5d0bce9.js", "js/errors-f0ba3d37.js"];
const CHAPTER_RE = /\/((lessons\/(en\/)?ch[1-9]\d*|guard\/ch[1-9]\d*|lang\/[a-z]{2})-[0-9a-f]{8}\.json|py\/runner-[0-9a-f]{8}\.py|js\/(editor|errors)-[0-9a-f]{8}\.js)$/; // 장 파일·경비실 장(v0.16.0)·언어 꾸러미(v0.13.0)·편집기/오류 안내 묶음(v0.17.0): 이름에 지문이 있어 저장본 먼저(?r=N 다시 받기 주소도 ignoreSearch로 같은 저장본)
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
    // 엔진: 처음 방문이면 실패해도 설치를 계속(쓸 때 다시 받음). 이미 옛 작업자가 있으면(= 업데이트) 엔진 5개가 다 저장되지
    // 않았을 때 설치를 실패시켜 옛 작업자·옛 엔진 저장소를 그대로 둔다(활성화가 옛 저장소를 지우므로). 다음 방문에 다시 시도.
    const replacing = !!self.registration.active;
    let missingAfter = [];
    try {
      const py = await caches.open(PY_CACHE);
      const missing = [];
      for (const f of PY_CORE) {
        const url = PYODIDE_PREFIX + f;
        if (!(await py.match(url))) missing.push(url);
      }
      await Promise.all(missing.map(async (url) => {
        try {
          const res = await fetch(new Request(url, { mode: "cors", credentials: "omit", cache: "no-cache" }));
          if (res.ok) await py.put(url, res);
        } catch (_) { /* 아래에서 빠진 것을 다시 센다 */ }
      }));
      for (const url of missing) if (!(await py.match(url))) missingAfter.push(url);
    } catch (_) { missingAfter = PY_CORE.map((f) => PYODIDE_PREFIX + f); /* 저장소를 못 열면 */ }
    if (replacing && missingAfter.length) throw new Error("engine precache incomplete: " + missingAfter.join(", "));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("ria-") && key !== GAME_CACHE && key !== PY_CACHE && key !== LANG_CACHE) await caches.delete(key);
    }
    try {
      const lc = await caches.open(LANG_CACHE);
      for (const req of await lc.keys()) {
        const path = new URL(req.url).pathname;
        if (!LANG_CHAPTER_FILES.some((f) => path.endsWith("/" + f))) await lc.delete(req);
      }
    } catch (_) { /* 저장소를 못 열면 다음 판에서 */ }
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
  const cache = await caches.open(LANG_CHAPTER_RE.test(new URL(request.url).pathname) ? LANG_CACHE : GAME_CACHE);
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
