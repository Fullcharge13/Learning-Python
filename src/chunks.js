// v0.17.0: 첫 파일 밖에서 따로 받는 묶음(편집기 js/editor-<지문>.js, 오류 안내 js/errors-<지문>.js).
// 배포판은 첫 파일의 이름표 window.RIA_CHUNKS에서 주소를 찾아 import(), 이름표에 없으면(개발판) chunkdev.js가 바로 import.
// 같은 이름은 한 번만 받고(약속 재사용), 실패하면 약속을 지워 다음에 다시 받는다.
// 실패 까닭(.kind): "stale" — 파일이 없음(404·410, 새 판이 나온 뒤 옛 탭) / "offline" — 그 밖(연결 없음 등)
import { devChunk } from "./chunkdev.js";

/** 새 판이 나와 옛 묶음 파일이 서버에 없음(404 등) */
export class ChunkMissingError extends Error {
  constructor(name, status) {
    super(`chunk ${name} is missing (${status})`);
    this.name = "ChunkMissingError";
    this.kind = "stale";
    this.status = status;
  }
}

function offlineError(name, cause) {
  const e = new Error(`chunk ${name} could not be loaded`);
  e.kind = "offline";
  e.cause = cause;
  return e;
}

/**
 * 시험할 수 있게 바깥 일을 넘겨받는 묶음 받기.
 * @param {{ chunks(): object|undefined, base(): string, importer(url: string): Promise<object>,
 *           probe(url: string): Promise<{ ok: boolean, status: number }>, devChunk(name: string): Promise<object> }} io
 */
export function createChunkLoader(io) {
  const loading = new Map();
  const tries = new Map();   // 묶음 이름마다 따로 센다(편집기가 실패했다고 오류 묶음 주소가 바뀌지 않게)
  async function fetchChunk(name, attempt) {
    const path = io.chunks()?.[name];
    if (!path) {
      try { return await io.devChunk(name); } catch (e) { throw offlineError(name, e); }
    }
    const url = new URL(path, io.base()).href;
    // 브라우저가 실패한 모듈 주소를 기억해 같은 주소로는 다시 받지 않을 수 있어, 다시 받을 때는 주소 뒤에 표시를 붙인다
    try {
      return await io.importer(attempt ? `${url}?r=${attempt}` : url);
    } catch (e) {
      let res = null;
      try { res = await io.probe(url); } catch { /* 연결 없음 */ }
      if (res && !res.ok && (res.status === 404 || res.status === 410)) throw new ChunkMissingError(name, res.status);
      throw offlineError(name, e);
    }
  }
  function loadChunk(name) {
    let p = loading.get(name);
    if (!p) {
      const attempt = tries.get(name) || 0;
      p = fetchChunk(name, attempt);
      loading.set(name, p);
      p.catch(() => { tries.set(name, attempt + 1); if (loading.get(name) === p) loading.delete(name); });
    }
    return p;
  }
  /** 쉬는 틈에 두 묶음을 미리 받는다(실패는 조용히 — 화면을 열 때 다시) */
  function prefetchChunks({ idle } = {}) {
    const later = idle || ((fn) => {
      if (typeof requestIdleCallback === "function") requestIdleCallback(() => fn(), { timeout: 5000 });
      else setTimeout(fn, 1500);
    });
    later(() => Promise.all(["editor", "errors"].map((n) => loadChunk(n).catch(() => null))));
  }
  return { loadChunk, prefetchChunks };
}

const g = typeof window !== "undefined" ? window : globalThis;
const browser = createChunkLoader({
  chunks: () => g.RIA_CHUNKS,
  base: () => g.location.href,
  importer: (url) => import(url),
  probe: (url) => fetch(url, { method: "HEAD", cache: "no-store" }),
  devChunk,
});

export const loadChunk = browser.loadChunk;
export const prefetchChunks = browser.prefetchChunks;
