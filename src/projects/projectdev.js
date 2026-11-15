// 개발판 전용: data/projects.js·data/projects.en.js 원본을 그대로 불러온다(tools/dev.py가 esbuild로 함께 묶음).
// 배포판(build.py)은 이 모듈을 빈 모듈(loadDevProjects → { ko: [], en: [] })로 바꿔 끼워, 첫 파일에 프로젝트 본문이 들어가지 않게 한다.
// 경비실 src/guard/guarddev.js와 같은 갈래(v0.21.0).

/** 프로젝트 원본 { ko: PROJECTS, en: PROJECTS } (catalog.js createProjectData의 projects로 넘김) */
export async function loadDevProjects() {
  const [ko, en] = await Promise.all([import("../../data/projects.js"), import("../../data/projects.en.js")]);
  return { ko: ko.PROJECTS, en: en.PROJECTS };
}
