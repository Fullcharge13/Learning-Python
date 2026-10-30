// 보기·정답 글이 코드처럼 보여야 하는지 (코드 글꼴 + 줄바꿈·빈칸 그대로). 순수 함수.
// 여러 줄 출력(예: "3\n2\n1")도 코드로 본다. 그래야 줄바꿈이 한 줄로 뭉개지지 않는다.
export function isCodey(s) {
  const t = String(s ?? "");
  return t.includes("\n") || /[()"'=+*<>#]|print/.test(t);
}
