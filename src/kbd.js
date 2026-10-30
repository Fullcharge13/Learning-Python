// 화면 키보드 판정과 기호 줄 순서 (판정 C30). 순수 함수.
// 아이폰 사파리는 키보드가 열려도 창(innerHeight)은 그대로이고 보이는 높이(visualViewport)만 준다.
// 안드로이드 크롬·시험 흉내는 창 자체가 줄어든다. 그래서 「같은 폭에서 본 가장 큰 높이」도 기준으로 쓴다.

export const KEYBOARD_MIN = 150;

export function keyboardOpen({ focused, vvHeight, innerHeight, baseHeight }) {
  if (!focused) return false;
  const shrink = Math.max(innerHeight - vvHeight, (baseHeight || 0) - vvHeight);
  return shrink > KEYBOARD_MIN;
}

/** 기준 높이 갱신: 같은 폭이면 큰 값을 남기고, 폭이 바뀌면(화면 회전) 지금 높이로 새로 */
export function nextBaseHeight(prev, height, width) {
  if (!prev || prev.width !== width) return { base: height, width };
  return { base: Math.max(prev.base, height), width };
}

// 자주 쓰는 순서. ins: 넣을 글자, back: 넣은 뒤 커서를 뒤로 옮길 칸 수, act: 명령
export const SYMBOL_ORDER = [
  { label: ":", ins: ":" },
  { label: "(", ins: "(" },
  { label: ")", ins: ")" },
  { label: '" "', ins: '""', back: 1, aria: "따옴표" },
  { label: "=", ins: " = " },
  { label: "+", ins: " + " },
  { label: "들여쓰기", act: "indent" },
  { label: "내어쓰기", act: "dedent" },
  { label: "<", ins: " < " },
  { label: ">", ins: " > " },
];
