// 첫 사용 튜토리얼의 순수 함수(v0.18.0). 화면은 src/ui/tutorial.js.
// 입력칸 글자를 파이썬 코드에 넣기 전에 안전한 문자열 리터럴로 만든다.
export const TUTORIAL_MAX = 30; // 입력칸 최대 글자 수(코드 포인트)

// 줄바꿈(\r, \n)·NUL(\0)·짝 없는 서로게이트를 빼고 30자(코드 포인트)로 자른 뒤 \ 와 "를 이스케이프해 "..." 꼴로.
// 자르기 전에 줄바꿈을 빼므로 이스케이프로 길이가 늘어나도 30자는 넘지 않는다.
export function pyStringLiteral(text) {
  const clean = String(text ?? "")
    .replace(/[\r\n\0]/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, ""); // 짝 없는 서로게이트: 파이썬 코드가 컴파일되게
  const chars = Array.from(clean).slice(0, TUTORIAL_MAX);
  return '"' + chars.join("").replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

export const tutorialCode = (text) => "print(" + pyStringLiteral(text) + ")";

// 개발자 모드 저장(검수용)에서는 자동으로 띄우지 않는다.
export const shouldShowTutorial = (save, { dev } = {}) => !dev && !!save && save.tutorial == null;
