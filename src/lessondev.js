// 개발판 전용: data/lessons/chN.js를 그대로 import한다(tools/dev.py가 esbuild로 함께 묶음).
// 배포판(build.py)은 이 모듈을 빈 모듈로 바꿔 끼워, index.html에 레슨 내용이 들어가지 않게 한다.
// 있는 장 파일만 불러온다(없는 번호는 건너뜀). chN.js를 더해도 여기는 그대로 둔다.
const MAX_CHAPTERS = 30;

// esbuild는 이 꼴의 import를 있는 파일만 묶는다. 없는 장은 여기서 거부되고 건너뛴다.
async function loadChapter(n) {
  return import(`../data/lessons/ch${n}.js`);
}

/** [{CHAPTER, LESSONS}] (있는 장만) */
export async function loadDevChapters() {
  const got = await Promise.allSettled(Array.from({ length: MAX_CHAPTERS }, (_, i) => loadChapter(i + 1)));
  return got.filter((r) => r.status === "fulfilled" && r.value && Array.isArray(r.value.LESSONS)).map((r) => r.value);
}
