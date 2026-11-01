// 보기·칩·줄 섞기 (판정 C23·C26)와 코드 조건(require) 이름의 한국어 표기. 순수 함수.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function perm(n, seed) {
  const rng = mulberry32(seed >>> 0);
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

/** 보기 섞기. order[k] = 원래 번호. answer는 섞인 배열 안의 정답 번호 */
export function shuffleChoices(options, answer, seed) {
  const order = perm(options.length, seed);
  return { order, options: order.map((i) => options[i]), answer: order.indexOf(answer) };
}

/** 순서 문제 줄 섞기: 저장된(정답) 순서와 글자가 다른 순서를 돌려줌 */
export function shuffleOrder(lines, seed) {
  const n = lines.length;
  if (n < 2) return Array.from({ length: n }, (_, i) => i);
  const same = (p) => p.every((v, i) => lines[v] === lines[i]);
  for (let t = 0; t < 20; t++) {
    const p = perm(n, (seed + t * 7919) >>> 0);
    if (!same(p)) return p;
  }
  return Array.from({ length: n }, (_, i) => (i + 1) % n); // 한 칸 돌리기
}

/** 새 씨앗 (한 번의 풀이 동안 고정해서 씀) */
export function newSeed() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

const REQ_KO = { If: "if 문", BoolOp: "and/or", Mult: "곱하기 *", Add: "더하기 +", Sub: "빼기 -", Div: "나누기 /", Compare: "비교(==, < 같은 것)", For: "for 문", While: "while 문",
  Comment: "# 주석", Elif: "elif", Else: "else",   // 판정 C44
  SelfCall: "재귀 호출", FormatSpec: "f-문자열 서식", TripleStr: "세 따옴표 문자열",   // 판정 C45
  ListComp: "리스트 컴프리헨션", Lambda: "lambda", NamedGroup: "이름 붙인 묶음", Reraise: "다시 던지기 raise" };   // v0.8 7~12장 심화

// 판정 C45: 「…를 써서」로 읽히지 않는 조건은 문장째 쓴다(…해서 풀어야 해요)
const REQ_PHRASE = {
  SelfCall: "함수 안에서 자기 자신을 다시 불러서",
  FormatSpec: "f-문자열 안에 :로 서식(자릿수·정렬)을 넣어서",
  TripleStr: '큰따옴표 세 개(""")로 여러 줄 문자열을 써서',
  NamedGroup: "패턴에 (?P<이름>…)으로 묶음에 이름을 붙여서",   // v0.8 12장 심화
  Reraise: "except에서 받은 오류를 raise 한 단어로 다시 던져서",   // v0.8 10장 심화
};

// v0.9(13~17장 심화): Def:<이름> — 함수·메서드 정의(__이름__이면 「메서드」), SQL:<낱말> — SQL 글 안의 낱말
const defKind = (n) => (/^__\w+__$/.test(n) ? "메서드" : "함수");
// 영어 낱말을 한글로 읽었을 때 받침이 있으면 「을」(JOIN 조인, HAVING 해빙, LIMIT 리밋), 없으면 「를」(WHERE, COUNT)
const sqlEul = (w) => (/(?:[NML]|NG|P|[AEIOU]T)$/.test(w) ? "을" : "를");

export function requireKo(name) {
  const s = String(name);
  if (Object.hasOwn(REQ_KO, s)) return REQ_KO[s];
  const m = /^(Call|Name|Def|SQL):(.+)$/.exec(s);
  if (m && m[1] === "Def") return `${m[2]} ${defKind(m[2])}`;
  if (m && m[1] === "SQL") return `SQL ${m[2]}`;
  if (m) return m[1] === "Call" ? `${m[2]}()` : `변수 ${m[2]}`;
  return s;
}

/** 「…를 써서」로 읽히지 않는 조건의 문장(없으면 null) */
function reqPhrase(s) {
  if (Object.hasOwn(REQ_PHRASE, s)) return REQ_PHRASE[s];
  const m = /^(Def|SQL):(.+)$/.exec(s);
  if (!m) return null;
  return m[1] === "Def" ? `${m[2]} ${defKind(m[2])}를 만들어서` : `SQL에 ${m[2]}${sqlEul(m[2])} 써서`;
}

/** 받침에 맞는 목적격 조사 */
function eul(word) {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 ? "을" : "를";
  if (/[)\]]$/.test(last)) return "를"; // int() → 「int()를」 (괄호로 읽음)
  if (/[0-9]/.test(last)) return "을";
  return "를";
}

export function missingMessage(missing) {
  const list = (missing || []).map(String);
  const words = list.filter((n) => reqPhrase(n) == null).map(requireKo).join(", ");
  const parts = words ? [`${words}${eul(words)} 써서`] : [];
  for (const n of list) if (reqPhrase(n) != null) parts.push(reqPhrase(n));
  return `정답은 나왔지만 이번 문제는 ${parts.join(", ")} 풀어야 해요.`;
}
