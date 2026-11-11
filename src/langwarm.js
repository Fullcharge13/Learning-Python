// v0.14.0(판정 C81, 검토 I1·I2): 영어로 배우는 사람은 영어 장 파일을 미리 받아 둔다.
// 서비스 작업자가 받는 영어 장을 판과 상관없는 저장소(ria-lang-en)에 넣으므로, 한 번 받으면 새 판에도 남는다.
// 한국어 사용자는 받지 않는다(설치 때 미리 받지 않는 것과 같은 이유).

/**
 * 저장 안 된 파일만 차례로 받는다. 받기가 실패하면 거기서 멈춘다(오프라인·서버 오류 — 다음에 다시).
 * @param {string[]} files
 * @param {{ has(f: string): Promise<boolean>, get(f: string): Promise<boolean> }} io
 * @returns {Promise<number>} 새로 받은 수
 */
export async function warmFiles(files, io) {
  let n = 0;
  for (const f of files) {
    try {
      if (await io.has(f)) continue;
      if (!(await io.get(f))) return n;
      n += 1;
    } catch {
      return n;
    }
  }
  return n;
}

/** 브라우저: 서비스 작업자가 다루는 배포판에서만(개발판·작업자 없음이면 아무것도 안 함). 받은 수를 돌려준다. */
export async function warmLangFiles(files) {
  if (typeof caches === "undefined" || typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return 0;
  if (navigator.onLine === false) return 0;
  return warmFiles(files, {
    has: async (f) => !!(await caches.match(f, { ignoreSearch: true })),
    // 서비스 작업자(chapterFirst)가 저장소에 넣는다. 저장 공간이 모자라 못 넣었으면 실패로 쳐서 멈춘다
    // (켤 때마다 17개를 다시 받지 않게, v0.14.0 검토 I3)
    get: async (f) => (await fetch(f)).ok && !!(await caches.match(f, { ignoreSearch: true })),
  });
}
