// 한국어 조사(v0.12.1 src/garden/state.js에서 옮김, v0.22.0 검토 M4). 텃밭·레벨 줄이 같이 쓴다. 화면(DOM)과 언어 표를 모른다.
// 숫자를 읽었을 때 끝소리(0 영·1 일·2 이·3 삼·4 사·5 오·6 육·7 칠·8 팔·9 구): 받침 있음 true, ㄹ 받침 "ㄹ"
// 한국어 조사 규칙(데이터, 화면 문구 아님)
const DIGIT_END = { 0: true, 1: "ㄹ", 2: false, 3: true, 4: false, 5: false, 6: true, 7: "ㄹ", 8: "ㄹ", 9: false }; // I18N_SKIP 받침 표지
const JOSA = { 이에요: ["이에요", "예요"], 으로: ["으로", "로"], 을: ["을", "를"], 이: ["이", "가"], 은: ["은", "는"], 과: ["과", "와"] }; // I18N_SKIP 조사 표
/**
 * 앞말(word) 끝소리에 맞는 조사. kind: "이에요"|"으로"|"을"|"이"|"은"|"과" (받침 있을 때 꼴로 부름).
 * 으로는 ㄹ 받침이면 「로」. 한글이 아닌 끝 글자는 숫자만 읽어 보고 나머지(영어 등)는 받침 없음으로 본다.
 */
export function josa(word, kind) {
  const [yes, no] = JOSA[kind] || JOSA.이;
  const last = String(word ?? "").trim().replace(/[\s」』)\]"'.!?~]+$/u, "").slice(-1);
  const code = last.charCodeAt(0);
  let end = false;
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    end = jong === 0 ? false : jong === 8 ? "ㄹ" : true; // I18N_SKIP 받침 표지
  } else if (/[0-9]/.test(last)) end = DIGIT_END[last];
  if (kind === "으로") return end === true ? yes : no; // I18N_SKIP 조사 이름
  return end ? yes : no;
}
