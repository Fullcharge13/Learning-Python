// 개발판 전용: data/guard.js의 사건 원본을 그대로 불러온다(tools/dev.py가 esbuild로 함께 묶음).
// 배포판(build.py)은 이 모듈을 빈 모듈(loadDevIncidents → [])로 바꿔 끼워, 첫 파일에 사건 본문이 들어가지 않게 한다.
// 레슨의 src/lessondev.js와 같은 갈래(v0.16.0 작업 1).

/** 사건 원본 전체(INCIDENTS) */
export async function loadDevIncidents() {
  const m = await import("../../data/guard.js");
  return m.INCIDENTS;
}
