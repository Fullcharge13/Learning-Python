// 개발판(빌드 안 한 src/index.html)의 묶음 받기: 바로 import한다.
// 배포판(build.py)은 이 파일을 바꿔 끼워, 따로 나간 묶음(js/editor-<지문>.js 등)이 첫 파일에 다시 묶이지 않게 한다.
export function devChunk(name) {
  return name === "editor" ? import("./ui/editor.js") : import("../data/errors.js");
}
