// 경비실 빈칸 채우기: 시작 코드의 {n} 자리에 고른 보기를 넣어 코드를 만든다. 순수 함수.
// {{ 와 }} 는 글자 { } 로 (파이썬 dict·f-문자열 대비).

import { shuffleChoices } from "../shuffle.js";

/** 시작 코드를 조각으로 나눔: {text} 글자, {n,line,col} 빈칸. line은 1부터, col은 0부터(원문 기준) */
function scan(start) {
  const parts = [];
  let line = 1;
  let col = 0;
  let i = 0;
  const advance = (s) => {
    for (const ch of s) {
      if (ch === "\n") { line++; col = 0; } else col++;
    }
  };
  while (i < start.length) {
    const two = start.slice(i, i + 2);
    if (two === "{{" || two === "}}") {
      parts.push({ text: two[0] });
      advance(two);
      i += 2;
      continue;
    }
    const m = start[i] === "{" ? /^\{(\d+)\}/.exec(start.slice(i)) : null;
    if (m) {
      parts.push({ n: Number(m[1]), line, col });
      advance(m[0]);
      i += m[0].length;
      continue;
    }
    parts.push({ text: start[i] });
    advance(start[i]);
    i++;
  }
  return parts;
}

function isPicked(blank, pick) {
  return Number.isInteger(pick) && pick >= 0 && !!blank && pick < blank.options.length;
}

/** 채우기. 고르지 않은 빈칸이 있으면 code는 null, missing에 빈칸 번호 */
export function fillBlanks(start, blanks, picks) {
  const parts = scan(start);
  const missing = [];
  let code = "";
  for (const p of parts) {
    if (p.text !== undefined) { code += p.text; continue; }
    if (isPicked(blanks[p.n], picks[p.n])) code += blanks[p.n].options[picks[p.n]];
    else if (!missing.includes(p.n)) missing.push(p.n);
  }
  return missing.length ? { code: null, missing } : { code, missing: [] };
}

/** 정답 번호 목록 */
export function answerPicks(blanks) {
  return blanks.map((b) => b.answer);
}

/** 빈칸 단추가 놓일 자리 */
export function blankSpots(start) {
  return scan(start)
    .filter((p) => p.n !== undefined)
    .map(({ n, line, col }) => ({ n, line, col }));
}

/** 보기 화면 순서(시험·스크린샷이 안정되게 사건 id와 빈칸 번호로 정함): 화면 자리 -> 데이터 번호 */
export function optionOrder(id, n, count) {
  let h = 2166136261;
  for (const ch of `${id}#${n}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return shuffleChoices(new Array(count).fill(0), 0, h >>> 0).order;
}
