// v0.10 파이의 텃밭: 노드 표 · 노드 → 파이썬 코드 생성 · 검사 · 불변 편집 (순수 함수, 화면 없음)
// 설계: docs/specs/2026-11-05-파이의-텃밭-설계.md 1·3절, v0.11 docs/specs/2026-11-05-텃밭-6-9장-설계.md 1절
//
// 노드 모양: { id, kind, args, body?: 노드[], orelse?: 노드[] }
//   body는 body 노드(만약·내 노드 만들기·반복·동안·목록에서 하나씩)에만 있고, orelse는 「만약」에 아니면을 켰을 때만 있다.
// 조건(cond): COND의 id 글자 하나,
//   또는 값 비교 { var, op, num } (2장을 끝내야 씀; var가 x·y면 9장, 위치 알기 뒤에서만),
//   또는 창고 비교 { store: { crop, op, num } } (8장을 끝내야 씀 — unlockedKinds가 "cond:store" 표지를 넣음).
// 목록 변수(v0.11 7장): 이동 dir·심기 crop 값으로 { loopVar: true } — 가장 안쪽 「목록에서 하나씩」(같은 종류)의 변수.
//   값 넣어 말하기 var는 { loopVar: true, type: "crop"|"dir" }. 변수 이름(crop·way, 겹치면 crop2·way2)은 코드 생성이 정한다.
// 위치 x·y(v0.11 9장): 「위치 알기」 뒤(같은 층·바깥 층 규칙, C64)에서만 읽는다. 내 노드 안에서는 그 내 노드 안의
//   위치 알기 뒤에서만 읽는다(파이썬에서 x, y = where()가 내 노드 안에 있으면 지역 값이 되므로, 바깥 x·y는 읽지 않게 단순화).
// v0.12(설계 docs/specs/2026-11-05-텃밭-10-17장-설계.md 1절):
//   「시도하기」 try는 body(시도) + handler(안 되면) 두 칸 → try: … except ValueError: …
//   「쪽지 읽기」 readnote는 with open(쪽지) as f: + for line in f: 두 줄(둘 다 그 노드). 안쪽은 코드로 두 칸 들여쓰지만
//   깊이(MAX_DEPTH)는 사용자에게 보이는 대로 한 단으로 센다(파이썬은 그 정도 들여쓰기에 제한이 없다).
//   쪽지 값(note): line(쪽지 읽기 안), crop·n(줄 나누기 뒤, 패턴 찾기 안). 값 칸에는 { noteVar: "line"|"crop"|"n" },
//   심기 crop에는 { noteVar: "crop" }, 반복 횟수에는 { value: "n" } → range(int(n)).
//   쪽지 n은 글자라 「값 n」(숫자)과 이름이 겹친다: 줄 나누기·패턴 찾기가 n을 덮을 수 있는 자리 뒤에서는 숫자 n을
//   더하기·비교에 못 쓴다(TypeError 막기, noteN). 내 노드 안에 n을 덮는 노드가 있으면 그 안에서 바깥 n도 못 읽는다(지역 값).
//   쪽지 crop과 작물 목록 변수가 겹치지 않게, 쪽지 읽기 안에 있거나 안에 crop을 정하는 노드가 있는 작물 목록은 crop2부터 쓴다.
//   그래서 { loopVar } 와 { noteVar: "crop" } 는 늘 다른 이름이고 둘 다 함께 쓸 수 있다.

export const MAX_NODES = 60;
export const MAX_DEPTH = 4; // 안쪽 깊이(들여쓰기 단 수) 4까지
export const DIRS = ["위", "아래", "왼쪽", "오른쪽"];
// 토마토는 10장을 끝내야 고를 수 있다(잠금 표지 "crop:토마토" — 심기·작물 목록·창고 조건 모두)
export const CROP_NAMES = ["당근", "감자", "토마토"];
export const VAR_NAMES = ["count", "n", "total"];
export const FUNC_NAMES = ["go_row", "plant_row", "harvest_row", "tend"];
export const OPS = ["<", ">", "=="];
export const LOOP_VARS = ["i", "j", "k", "m"];
export const VALUE_RANGE = { min: 0, max: 99 };
// v0.11
export const POS_NAMES = ["x", "y"];
const VALUE_NAMES = [...VAR_NAMES, ...POS_NAMES];
export const LIST_TYPES = ["crop", "dir"];
export const LIST_ITEMS = { crop: CROP_NAMES, dir: DIRS };
export const LIST_LABELS = { crop: "작물 목록", dir: "방향 목록" };
const LIST_VAR = { crop: "crop", dir: "way" };
export const LIST_MAX = 6;
// 종류마다 새 목록의 기본 칸(노드 더하기·저장 정리·목록 편집 창이 같이 씀)
export const LIST_DEFAULTS = { crop: ["당근", "감자"], dir: ["오른쪽", "아래"] };
export const SAYVAL_MAX = 10;
// 노드가 아닌 조건 잠금 표지 → 장
export const COND_LOCKS = { "cond:store": 8 };
// 노드가 아닌 잠금 표지 전부 → 장(unlockedKinds가 넣음)
export const TOMATO = "토마토";
export const MARK_LOCKS = { ...COND_LOCKS, [`crop:${TOMATO}`]: 10 };
// v0.12 쪽지함(받는 쪽지 두 개 + 남는 농장일지)
export const NOTE_FILES = ["주문서.txt", "손글씨주문.txt", "농장일지.txt"];
export const LOG_FILE = "농장일지.txt";
export const NOTE_VARS = ["line", "crop", "n"];
// 패턴 찾기: re는 파이썬 r"…" 안에 그대로 들어가는 글자, vars는 for 뒤 이름(정해지는 쪽지 값)
export const PATTERNS = {
  crop_num: { label: "작물+숫자", re: "(당근|감자|토마토)\\s*(\\d+)", vars: ["crop", "n"] },
  num: { label: "숫자만", re: "\\d+", vars: ["n"] },
  crop: { label: "작물 이름만", re: "당근|감자|토마토", vars: ["crop"] },
};
const SLOTS = ["body", "orelse", "handler"];

export const COND = [
  { id: "can_harvest", label: "다 자랐으면", code: "can_harvest()" },
  { id: "not_can_harvest", label: "덜 자랐으면", code: "not can_harvest()" },
  { id: "here_empty", label: "빈칸이면", code: 'what_here() == "빈칸"' },
  { id: "here_carrot", label: "당근이면", code: 'what_here() == "당근"' },
  { id: "here_potato", label: "감자면", code: 'what_here() == "감자"' },
];
const COND_CODE = Object.fromEntries(COND.map((c) => [c.id, c.code]));

const choice = (choices, def, loopType) => ({ type: "choice", choices, default: def, ...(loopType ? { loopType } : {}) });
const int = (min, max, def) => ({ type: "int", min, max, default: def });
const cond = (def) => ({ type: "cond", default: def });

export const NODES = {
  move: { chapter: 1, label: "이동", body: false, orelse: false, args: { dir: choice(DIRS, "오른쪽", "dir") } },
  harvest: { chapter: 1, label: "수확", body: false, orelse: false, args: {} },
  plant: { chapter: 1, label: "심기", body: false, orelse: false, args: { crop: { ...choice(CROP_NAMES, "당근", "crop"), noteVar: "crop" } } },
  say: { chapter: 1, label: "말하기", body: false, orelse: false, args: { text: { type: "text", max: 20, default: "안녕!" } } },
  setvar: {
    chapter: 2, label: "값 기억하기", body: false, orelse: false,
    args: { name: choice(VAR_NAMES, "count"), value: int(VALUE_RANGE.min, VALUE_RANGE.max, 0) },
  },
  addvar: {
    chapter: 2, label: "값 더하기", body: false, orelse: false,
    // 1부터(검토 C62 I4): 0을 더하면 값이 그대로라 「~하는 동안」이 끝나지 않는다
    args: { name: choice(VAR_NAMES, "count"), value: int(1, VALUE_RANGE.max, 1) },
  },
  if: { chapter: 3, label: "만약", body: true, orelse: true, args: { cond: cond("can_harvest") } },
  def: { chapter: 4, label: "내 노드 만들기", body: true, orelse: false, args: { name: choice(FUNC_NAMES, "go_row") } },
  call: { chapter: 4, label: "내 노드 부르기", body: false, orelse: false, args: { name: choice(FUNC_NAMES, "go_row") } },
  // 횟수는 수 또는 { value: "n" }(11장: 쪽지 n → range(int(n)))
  repeat: { chapter: 5, label: "반복", body: true, orelse: false, args: { n: { ...int(1, 25, 3), noteValue: "n" } } },
  while: { chapter: 5, label: "~하는 동안", body: true, orelse: false, args: { cond: cond("can_harvest") } },
  sayval: {
    chapter: 6, label: "값 넣어 말하기", body: false, orelse: false,
    args: {
      pre: { type: "text", min: 0, max: SAYVAL_MAX, default: "당근 " },
      var: { type: "value", default: "count" },
      post: { type: "text", min: 0, max: SAYVAL_MAX, default: "개" },
    },
  },
  foreach: {
    chapter: 7, label: "목록에서 하나씩", body: true, orelse: false,
    args: { list: { type: "list", min: 1, max: LIST_MAX, default: { type: "crop", items: LIST_DEFAULTS.crop } } },
  },
  where: { chapter: 9, label: "위치 알기", body: false, orelse: false, args: {} },
  // v0.12
  try: { chapter: 10, label: "시도하기", body: true, orelse: false, handler: true, args: {} },
  readnote: { chapter: 11, label: "쪽지 읽기", body: true, orelse: false, args: { file: choice(NOTE_FILES, "주문서.txt") } },
  splitline: { chapter: 11, label: "줄 나누기", body: false, orelse: false, args: {} },
  writelog: {
    chapter: 11, label: "일지 쓰기", body: false, orelse: false,
    // var가 null이면 글자만 쓴다(그때는 앞·뒤 글자 중 하나는 있어야 함)
    args: {
      pre: { type: "text", min: 0, max: SAYVAL_MAX, default: "수확 " },
      var: { type: "value", optional: true, default: "count" },
      post: { type: "text", min: 0, max: SAYVAL_MAX, default: "개" },
    },
  },
  findall: { chapter: 12, label: "패턴 찾기", body: true, orelse: false, args: { pattern: choice(Object.keys(PATTERNS), "crop_num") } },
};

const VAR_COND_CHAPTER = NODES.setvar.chapter;

export const MSG = {
  empty: "안에 노드를 하나 넣어요",
  locked: (ch) => `${ch}장을 끝내면 열려요`,
  defTop: "내 노드 만들기는 맨 바깥에 둬요",
  depth: `안쪽으로는 ${MAX_DEPTH}단까지 넣어요`,
  tooMany: `노드는 ${MAX_NODES}개까지예요`,
  noVar: (name) => `${name} 값을 먼저 기억해요`,
  badArgs: "고를 수 없는 값이에요",
  unknown: "모르는 노드예요",
  noDef: "그 이름의 내 노드가 없어요",
  defLater: "내 노드를 먼저 만들어요",
  selfCall: "자기 자신은 부를 수 없어요",
  dupDef: "같은 이름의 내 노드가 이미 있어요",
  defVar: "내 노드 안에서는 값을 바꿀 수 없어요 — 바깥에서 바꿔요",
  whileInDef: "내 노드 안의 ~하는 동안은 끝나지 않아요",
  whileNoChange: (name) => `반복 안에서 ${name} 값을 바꿔요`,
  noLoopVar: "목록에서 하나씩 노드 안에서만 고를 수 있어요",
  noPos: "위치 알기를 먼저 해요",
  defPos: "내 노드 안에서는 그 안에서 위치 알기를 해요",
  whileNoMove: "반복 안에서 파이가 움직여야 해요",
  // v0.12
  emptyHandler: "안 되면 칸에 노드를 하나 넣어요",
  noteOnly: "쪽지 읽기 안에서만 써요",
  noNote: (name) => `${name} 값은 줄 나누기·패턴 찾기 뒤에서만 써요`,
  // v0.12.1: 패턴 찾기 안인데 그 패턴이 그 값을 만들지 않음(예: 숫자만 + 심기 crop)
  patternLacks: (label, name, other) => `${label} 패턴에서는 ${name}이 생기지 않아요 — ${other} 패턴을 골라요`,
  noteN: "n은 쪽지에서 읽은 글자예요 — 숫자는 count·total에 기억해요",
  logReading: "농장일지를 읽는 동안에는 일지에 쓸 수 없어요",
  repeatNoAct: "쪽지 값만큼 반복할 때는 안에서 파이가 움직이거나 심거나 거둬야 해요",
};

// ---- 열린 노드 ----
export function unlockedKinds(passed) {
  const set = passed instanceof Set ? passed : new Set(passed || []);
  const out = new Set(Object.keys(NODES).filter((k) => set.has(NODES[k].chapter)));
  for (const [mark, ch] of Object.entries(MARK_LOCKS)) if (set.has(ch)) out.add(mark);
  return out;
}

// ---- 조건·값 ----
const isObj = (c) => !!c && typeof c === "object";
const isStoreCond = (c) => isObj(c) && Object.hasOwn(c, "store");
const isVarCond = (c) => isObj(c) && !isStoreCond(c);
const isPosCond = (c) => isVarCond(c) && POS_NAMES.includes(c.var);
const isLoopVar = (v) => isObj(v) && v.loopVar === true;
const isNoteVar = (v) => isObj(v) && typeof v.noteVar === "string";
const isNoteCount = (v) => isObj(v) && Object.hasOwn(v, "value");
const numOk = (n) => Number.isInteger(n) && n >= VALUE_RANGE.min && n <= VALUE_RANGE.max;

export function condCode(c) {
  if (isStoreCond(c)) return `store()[${pyStr(c.store?.crop)}] ${c.store?.op} ${c.store?.num}`;
  if (isVarCond(c)) return `${c.var} ${c.op} ${c.num}`;
  return COND_CODE[c] ?? "False";
}

const charLen = (s) => [...s].length;

function argOk(spec, v) {
  switch (spec.type) {
    case "choice":
      // 목록 변수: 종류를 적었다면 이 값 칸의 종류와 같아야 한다(어느 목록 안인지는 scopeErrors가 본다)
      if (isLoopVar(v)) return !!spec.loopType && (v.type === undefined || v.type === spec.loopType);
      if (isNoteVar(v)) return !!spec.noteVar && v.noteVar === spec.noteVar;
      return spec.choices.includes(v);
    case "int":
      if (isNoteCount(v)) return !!spec.noteValue && v.value === spec.noteValue;
      return Number.isInteger(v) && v >= spec.min && v <= spec.max;
    case "text": return typeof v === "string" && charLen(v) >= (spec.min ?? 1) && charLen(v) <= spec.max;
    case "value":
      if (v === null) return !!spec.optional;
      if (isLoopVar(v)) return LIST_TYPES.includes(v.type);
      if (isNoteVar(v)) return NOTE_VARS.includes(v.noteVar);
      return VALUE_NAMES.includes(v);
    case "list":
      return isObj(v) && LIST_TYPES.includes(v.type) && Array.isArray(v.items)
        && v.items.length >= spec.min && v.items.length <= spec.max
        && v.items.every((it) => LIST_ITEMS[v.type].includes(it));
    case "cond":
      if (isStoreCond(v)) {
        const st = v.store;
        return isObj(st) && CROP_NAMES.includes(st.crop) && OPS.includes(st.op) && numOk(st.num);
      }
      if (isVarCond(v)) return VALUE_NAMES.includes(v.var) && OPS.includes(v.op) && numOk(v.num);
      return Object.hasOwn(COND_CODE, v);
    default: return false;
  }
}

function argsOk(node) {
  const specs = NODES[node.kind].args;
  const args = node.args || {};
  if (!Object.entries(specs).every(([k, spec]) => argOk(spec, args[k]))) return false;
  // 일지 쓰기: 값 없이 쓰면 글자가 하나는 있어야(빈 줄만 쓰기 막기)
  if (node.kind === "writelog" && args.var === null && args.pre === "" && args.post === "") return false;
  return true;
}

// 토마토를 쓰는 노드(10장 표지): 심기·작물 목록·창고 조건
function usesTomato(node) {
  const a = isObj(node.args) ? node.args : {};
  if (node.kind === "plant" && a.crop === TOMATO) return true;
  if (node.kind === "foreach" && isObj(a.list) && Array.isArray(a.list.items) && a.list.items.includes(TOMATO)) return true;
  return isStoreCond(a.cond) && a.cond.store?.crop === TOMATO;
}

/** 목록 값이 맞는 모양인가(종류·1~6칸·그 종류의 값) */
export const listOk = (v) => argOk(NODES.foreach.args.list, v);

/** 목록 값을 맞는 모양의 새 객체로: 맞으면 {type, items} 사본, 아니면 그 종류(모르면 작물)의 기본 목록 */
export function cleanList(v) {
  if (listOk(v)) return { type: v.type, items: v.items.slice() };
  const type = isObj(v) && LIST_TYPES.includes(v.type) ? v.type : "crop";
  return { type, items: LIST_DEFAULTS[type].slice() };
}

// 파이썬 글자 값: JSON 따옴표 규칙은 파이썬 큰따옴표 글자와 호환된다(\" \\ \n \uXXXX).
const pyStr = (s) => JSON.stringify(String(s));

// ---- 트리 돌기 ----
// 앞에서부터(프로그램 순서) 노드마다 fn(node, ctx). ctx: { depth, top(맨 바깥 조상), topIndex }
function walk(program, fn) {
  const visit = (list, depth, top, topIndex) => {
    list.forEach((node, i) => {
      const t = depth === 0 ? node : top;
      const ti = depth === 0 ? i : topIndex;
      fn(node, { depth, top: t, topIndex: ti });
      for (const slot of SLOTS) if (Array.isArray(node[slot])) visit(node[slot], depth + 1, t, ti);
    });
  };
  visit(program || [], 0, null, -1);
}

// ---- 값 범위 따라가기(검토 C62 I4·I5, v0.11 목록 변수·위치) ----
// 값이 「확실히 정해진」 자리를 블록 단위로 따라간다. 기억하기(setvar)는 같은 블록의 뒤쪽과 그 안쪽에서 쓸 수 있고,
// 블록을 나갈 때는 반복(1번 이상 돎) 안의 것만 바깥으로 이어진다. 만약·아니면·~하는 동안(한 번도 안 돌 수 있음)
// 안에서 기억한 값은 그 블록 밖 뒤쪽에서 쓰면 오류(파이썬 NameError가 날 수 있음). 내 노드 안은 그 내 노드보다
// 앞에서 기억한 값만 읽고, 안에서 바꾸기는 defVar로 따로 막는다.
// 값 비교 「~하는 동안」은 끝날 수 있어야 한다: 내 노드 안이면 오류(값을 바꿀 수 없음), 아니면 그 몸통에서
// 그 값을 「반드시」 바꿔야 한다 — 몸통 바로 안, 또는 반복·목록(1번 이상 돎) 안의 기억하기·더하기만 센다.
// 만약·아니면·안쪽 ~하는 동안 속에서만 바꾸면 조건에 따라 한 번도 안 바뀌어 끝나지 않을 수 있다(v0.11 검토).
// 내 노드 부르기는 값을 바꾸지 못하므로 세지 않는다. 「>」·「==」처럼 더해도 끝나지 않는 비교는 막지 않는다
// (파이의 행동·확인 상한과 시간 제한이 멈춤).
const ALWAYS_RUNS = new Set(["repeat", "foreach"]);
function changesVarIn(list, name) {
  return (list || []).some((n) => {
    if (!n) return false;
    if ((n.kind === "setvar" || n.kind === "addvar") && n.args?.name === name) return true;
    return ALWAYS_RUNS.has(n.kind) && changesVarIn(n.body, name);
  });
}

// 위치 x·y는 「위치 알기」로만 바뀐다(x·y 비교 ~하는 동안의 「값을 바꿔요」 검사) — 같은 규칙으로 반드시 도는 자리만
function changesValIn(list, name) {
  if (POS_NAMES.includes(name)) {
    return (list || []).some((n) => !!n
      && (n.kind === "where" || (ALWAYS_RUNS.has(n.kind) && changesValIn(n.body, name))));
  }
  return changesVarIn(list, name);
}

// 파이가 움직일 수 있는가: 이동 또는 내 노드 부르기
function movesIn(list) {
  return (list || []).some((n) => !!n && n.kind !== "def"
    && (n.kind === "move" || n.kind === "call" || SLOTS.some((s) => movesIn(n[s]))));
}

// 반드시 시간 1짜리 행동을 하는가(판정 C71 C1a): 몸통 바로 안, 또는 반복·목록(1번 이상 돎) 안의 이동·심기·수확·
// 내 노드 부르기. 만약·시도하기·~하는 동안 안에만 있으면 세지 않는다. 쪽지 n은 아주 큰 수일 수 있어서
// 행동 없는 반복은 행동 상한(500)에 걸리지 않고 시간 제한까지 돌기 때문(검토에서 「9999999999」 일지로 멈춤).
const ACTS = new Set(["move", "plant", "harvest", "call"]);
function actsIn(list) {
  return (list || []).some((n) => !!n && (ACTS.has(n.kind) || (ALWAYS_RUNS.has(n.kind) && actsIn(n.body))));
}

// ---- 쪽지 값(v0.12) ----
// 그 노드가 정하는 쪽지 값 이름(줄 나누기: crop·n, 패턴 찾기: 패턴의 vars)
function noteBinds(n) {
  if (n.kind === "splitline") return ["crop", "n"];
  if (n.kind === "findall") return PATTERNS[n.args?.pattern]?.vars ?? [];
  return [];
}
// 목록 안(내 노드 만들기 안은 빼고, 노드 자신 포함) 어디든 쪽지 값을 정하는 노드가 정하는 이름들
function noteBindsIn(list, out = new Set()) {
  for (const n of Array.isArray(list) ? list : []) {
    if (!n || n.kind === "def") continue;
    for (const v of noteBinds(n)) out.add(v);
    for (const s of SLOTS) noteBindsIn(n[s], out);
  }
  return out;
}
// 숫자 값 이름 중 그 목록 안에서 쪽지 글자로 덮일 수 있는 것(지금은 n 하나)
const clobbers = (list) => [...noteBindsIn(list)].filter((v) => VAR_NAMES.includes(v));

// 작물 목록 변수 이름이 쪽지 crop과 겹치지 않게: 쪽지 읽기 안이거나 몸통에 crop을 정하는 노드가 있으면 crop2부터.
// 바깥 같은 종류 목록이 쓰는 이름은 건너뛴다(쪽지가 없으면 v0.11과 같은 crop, crop2, …).
function listVarName(type, lists, reading, body) {
  const reserve = type === "crop" && (reading > 0 || noteBindsIn(body).has("crop"));
  const used = new Set(lists.filter((l) => l.type === type).map((l) => l.name));
  let k = reserve ? 1 : 0;
  while (used.has(loopVarName(type, k))) k += 1;
  return loopVarName(type, k);
}

// 목록 변수 이름: 같은 종류 목록이 k번째(0부터)로 겹치면 crop, crop2, crop3…
const loopVarName = (type, k) => (k === 0 ? LIST_VAR[type] : `${LIST_VAR[type]}${k + 1}`);

// 프로그램 순서로 노드마다 visit(node, env). env: { known(그 노드 앞에서 정해진 숫자·위치 값 이름 Set — 읽기만), inDef,
//   loops(바깥→안쪽 목록 [{ type, name }]), ok(값 모양이 맞음),
//   outerPos(내 노드 안에서: 그 내 노드 앞 바깥에서 위치 알기를 했음 — 오류 글을 고르는 데만 씀),
//   notes(쓸 수 있는 쪽지 값 Set: line·crop·n), stale(쪽지 글자로 덮였을 수 있는 숫자 값 — 오류 글 고르기용),
//   reading(바깥→안쪽 쪽지 읽기의 파일 이름들) }
// 기억하기(setvar)·위치 알기(where)·줄 나누기는 같은 블록의 뒤쪽과 그 안쪽에서 쓸 수 있고, 블록을 나갈 때는 반복·목록(1번 이상 돎)
// 안의 것만 바깥으로 이어진다. 만약·아니면·~하는 동안·시도하기·쪽지 읽기·패턴 찾기(한 번도 안 돌거나 중간에 멈출 수 있음)
// 안에서 정한 값은 블록 밖 뒤쪽에서 못 쓴다. 시도하기의 안 되면 칸은 시도하기 앞의 값만 쓴다.
// 내 노드 안은 그 내 노드보다 앞에서 기억한 값만 읽고(x·y는 빼고, 그 안에서 n을 덮으면 n도 빼고), 쪽지 값은 그 안에서 정한 것만.
// 쪽지 n이 숫자 n을 덮는 일(v0.12): 덮을 수 있는 노드가 든 블록을 나가면 숫자 n은 「확실하지 않음」(stale), 반복하는 블록은
// 두 번째 바퀴를 생각해 시작부터 숫자 n을 뺀다.
function scopeWalk(program, visit) {
  const copy = (S) => ({ cur: new Set(S.cur), notes: new Set(S.notes), stale: new Set(S.stale) });
  const drop = (S, names) => { for (const v of names) { S.cur.delete(v); S.stale.add(v); } };
  const bind = (S, names) => { for (const v of names) S.notes.add(v); drop(S, names.filter((v) => VAR_NAMES.includes(v))); };
  // 반복하는 블록의 몸통 시작: 몸통이 덮는 숫자 값은 두 번째 바퀴부터 글자일 수 있다
  const loopStart = (S, body) => { const T = copy(S); drop(T, clobbers(body)); return T; };
  const block = (list, S, ctx) => {
    for (const n of Array.isArray(list) ? list : []) {
      if (!n) continue;
      const spec = NODES[n.kind];
      const ok = !!spec && argsOk(n);
      const a = isObj(n.args) ? n.args : {};
      visit(n, { known: S.cur, notes: S.notes, stale: S.stale, inDef: ctx.inDef, loops: ctx.loops, ok, outerPos: ctx.outerPos, reading: ctx.reading, finding: ctx.finding });
      if (ok && n.kind === "setvar" && !ctx.inDef) { S.cur.add(a.name); S.notes.delete(a.name); S.stale.delete(a.name); }
      if (ok && n.kind === "where") POS_NAMES.forEach((v) => S.cur.add(v));
      if (ok && n.kind === "splitline") bind(S, noteBinds(n));
      if (n.kind === "foreach" || (ok && n.kind === "repeat")) {
        let loops = ctx.loops;
        const type = a.list?.type;
        if (n.kind === "foreach" && LIST_TYPES.includes(type)) {
          loops = [...loops, { type, name: listVarName(type, ctx.loops, ctx.reading.length, n.body) }];
        }
        const got = block(n.body, loopStart(S, n.body), { ...ctx, loops });
        if (ok) Object.assign(S, got); // 1번 이상 돎: 몸통 끝 상태가 이어진다
        else drop(S, clobbers([n]));
      } else if (n.kind === "def") {
        const T = { cur: new Set([...S.cur].filter((v) => !POS_NAMES.includes(v))), notes: new Set(), stale: new Set(S.stale) };
        drop(T, clobbers(n.body)); // 내 노드 안에서 덮는 이름은 지역 값 — 바깥 값을 못 읽음
        block(n.body, T, { inDef: true, loops: [], outerPos: POS_NAMES.some((v) => S.cur.has(v)), reading: [], finding: null });
      } else if (n.kind === "readnote") {
        const T = loopStart(S, n.body);
        T.notes.add("line");
        block(n.body, T, { ...ctx, reading: [...ctx.reading, a.file] });
        drop(S, clobbers([n]));
      } else if (n.kind === "findall") {
        const T = loopStart(S, n.body);
        if (ok) bind(T, noteBinds(n));
        block(n.body, T, ok ? { ...ctx, finding: a.pattern } : ctx);
        drop(S, clobbers([n]));
      } else if (n.kind === "while") {
        block(n.body, loopStart(S, n.body), ctx);
        drop(S, clobbers([n]));
      } else if (SLOTS.some((slot) => Array.isArray(n[slot]))) {
        // 만약·아니면·시도하기(두 칸 모두 그 노드 앞 상태에서 시작)
        for (const slot of SLOTS) block(n[slot], copy(S), ctx);
        drop(S, clobbers([n]));
      }
    }
    return S;
  };
  block(program, { cur: new Set(), notes: new Set(), stale: new Set() }, { inDef: false, loops: [], outerPos: false, reading: [], finding: null });
}

const innermost = (loops, type) => {
  for (let i = loops.length - 1; i >= 0; i--) if (loops[i].type === type) return loops[i];
  return null;
};
// x·y를 못 읽을 때: 바깥에서 위치 알기를 했는데 내 노드 안이면 「그 안에서 해요」
const noValMsg = (name, outerPos = false) => (POS_NAMES.includes(name) ? (outerPos ? MSG.defPos : MSG.noPos) : MSG.noVar(name));

// 쪽지 값을 못 쓸 때: line은 쪽지 읽기 안에서만, crop·n은 줄 나누기·패턴 찾기 뒤에서만.
// (v0.12.1) 패턴 찾기 안인데 그 패턴이 그 값을 만들지 않으면 그 값을 만드는 패턴을 고르라고 알린다.
const noNoteMsg = (name, finding = null) => {
  if (name === "line") return MSG.noteOnly;
  const p = finding && Object.hasOwn(PATTERNS, finding) ? PATTERNS[finding] : null;
  const other = Object.values(PATTERNS).find((q) => q.vars.includes(name));
  return p && other && !p.vars.includes(name) ? MSG.patternLacks(p.label, name, other.label) : MSG.noNote(name);
};

// 일지를 쓰는 내 노드 이름들(바로 쓰거나, 쓰는 내 노드를 부름 — 앞에서 만든 것만 부를 수 있으므로 순서대로 한 번)
function logWriterDefs(program) {
  const out = new Set();
  const writes = (list) => (Array.isArray(list) ? list : []).some((n) => !!n
    && (n.kind === "writelog" || (n.kind === "call" && out.has(n.args?.name)) || SLOTS.some((s) => writes(n[s]))));
  for (const n of Array.isArray(program) ? program : []) {
    if (n?.kind === "def" && writes(n.body)) out.add(n.args?.name);
  }
  return out;
}

// 노드 객체 → 값 오류 글 목록
function varErrors(program) {
  const out = new Map();
  const add = (node, msg) => {
    if (!out.has(node)) out.set(node, []);
    out.get(node).push(msg);
  };
  const writers = logWriterDefs(program);
  scopeWalk(program, (n, { known, notes, stale, inDef, loops, ok, outerPos, reading, finding }) => {
    if (!ok) return;
    const a = n.args;
    // 숫자로 쓰는 값(더하기·비교): 없으면 「먼저 기억해요」, 쪽지 글자로 덮였을 수 있으면 noteN
    const numMsg = (name) => (stale.has(name) || notes.has(name) ? MSG.noteN : noValMsg(name, outerPos));
    const changes = n.kind === "setvar" || n.kind === "addvar";
    if (changes && inDef) return; // 내 노드 안 값 바꾸기는 defVar 하나만 알린다
    if (n.kind === "addvar" && !known.has(a.name)) add(n, numMsg(a.name));
    if ((n.kind === "if" || n.kind === "while") && isVarCond(a.cond) && !known.has(a.cond.var)) add(n, numMsg(a.cond.var));
    if (n.kind === "while" && isVarCond(a.cond)) {
      if (known.has(a.cond.var) && clobbers(n.body).includes(a.cond.var)) add(n, MSG.noteN); // 두 번째 비교에서 글자일 수 있음
      else if (isPosCond(a.cond)) {
        // 위치는 「위치 알기」로 다시 알아야 바뀌고(내 노드 안에서도 지역 값으로 됨), 파이가 움직여야 달라진다
        if (!changesValIn(n.body, a.cond.var)) add(n, MSG.whileNoChange(a.cond.var));
        if (!movesIn(n.body)) add(n, MSG.whileNoMove);
      } else if (inDef) add(n, MSG.whileInDef);
      else if (!changesVarIn(n.body, a.cond.var)) add(n, MSG.whileNoChange(a.cond.var));
    }
    if (n.kind === "sayval" || n.kind === "writelog") {
      const v = a.var;
      if (v === null) { /* 글자만 쓰는 일지 */ } else if (isLoopVar(v)) { if (!innermost(loops, v.type)) add(n, MSG.noLoopVar); }
      else if (isNoteVar(v)) { if (!notes.has(v.noteVar)) add(n, noNoteMsg(v.noteVar, finding)); }
      else if (!known.has(v) && !notes.has(v)) add(n, numMsg(v)); // str(n)은 숫자·쪽지 글자 모두 됨
    }
    if (n.kind === "plant" && isNoteVar(a.crop) && !notes.has("crop")) add(n, noNoteMsg("crop", finding));
    if (n.kind === "repeat" && isNoteCount(a.n) && !notes.has("n")) add(n, noNoteMsg("n", finding));
    if (n.kind === "repeat" && isNoteCount(a.n) && !actsIn(n.body)) add(n, MSG.repeatNoAct);
    if ((n.kind === "splitline" || n.kind === "findall") && !notes.has("line")) add(n, MSG.noteOnly);
    if (reading.includes(LOG_FILE) && (n.kind === "writelog" || (n.kind === "call" && writers.has(a.name)))) add(n, MSG.logReading);
    for (const [k, spec] of Object.entries(NODES[n.kind].args)) {
      if (spec.type === "choice" && spec.loopType && isLoopVar(a[k]) && !innermost(loops, spec.loopType)) add(n, MSG.noLoopVar);
    }
  });
  return out;
}

// ---- 구조 검사(잠금 제외) ----
function structuralErrors(program) {
  const errors = [];
  const add = (nodeId, msg) => errors.push({ nodeId, msg });
  // 맨 바깥 내 노드 만들기: 이름 → 맨 바깥 순서(처음 것)
  const defs = new Map();
  (program || []).forEach((n, i) => {
    if (n.kind === "def" && argsOk(n) && !defs.has(n.args.name)) defs.set(n.args.name, { index: i, id: n.id });
  });
  const vErr = varErrors(program);
  let count = 0;
  walk(program, (node, { depth, top, topIndex }) => {
    count += 1;
    if (count === MAX_NODES + 1) add(node.id, MSG.tooMany);
    const spec = NODES[node.kind];
    if (!spec) { add(node.id, MSG.unknown); return; }
    const ok = argsOk(node);
    if (!ok) add(node.id, MSG.badArgs);
    if (depth > MAX_DEPTH) add(node.id, MSG.depth);
    if (spec.body && (!Array.isArray(node.body) || node.body.length === 0)) add(node.id, MSG.empty);
    if (Array.isArray(node.orelse) && node.orelse.length === 0) add(node.id, MSG.empty);
    if (spec.handler && (!Array.isArray(node.handler) || node.handler.length === 0)) add(node.id, MSG.emptyHandler);
    if (node.kind === "def") {
      if (depth > 0) add(node.id, MSG.defTop);
      else if (ok && defs.get(node.args.name).id !== node.id) add(node.id, MSG.dupDef);
    }
    if (!ok) return;
    const a = node.args;
    if (node.kind === "call") {
      const d = defs.get(a.name);
      if (!d) add(node.id, MSG.noDef);
      else if (top.kind === "def" && top.args?.name === a.name && depth > 0) add(node.id, MSG.selfCall);
      else if (d.index >= topIndex) add(node.id, MSG.defLater);
    }
    // 함수 안 대입은 파이썬에서 지역 값이 되어 오류가 나고, global은 배우지 않으므로 막는다(읽기는 괜찮다).
    const changesVar = node.kind === "setvar" || node.kind === "addvar";
    if (changesVar && depth > 0 && top.kind === "def") { add(node.id, MSG.defVar); return; }
    for (const msg of vErr.get(node) || []) add(node.id, msg);
  });
  return errors;
}

// ---- 검사 ----
export function validate(program, unlocked) {
  const open = unlocked instanceof Set ? unlocked : new Set(unlocked || []);
  const lockErr = new Map();
  walk(program, (node) => {
    const spec = NODES[node.kind];
    if (!spec) return;
    const msgs = [];
    const c = node.args?.cond;
    if (!open.has(node.kind)) msgs.push(MSG.locked(spec.chapter));
    else if (spec.args.cond && isStoreCond(c) && !open.has("cond:store")) msgs.push(MSG.locked(COND_LOCKS["cond:store"]));
    else if (spec.args.cond && isPosCond(c) && !open.has("where")) msgs.push(MSG.locked(NODES.where.chapter));
    else if (spec.args.cond && isVarCond(c) && !open.has("setvar")) msgs.push(MSG.locked(VAR_COND_CHAPTER));
    else if (usesTomato(node) && !open.has(`crop:${TOMATO}`)) msgs.push(MSG.locked(MARK_LOCKS[`crop:${TOMATO}`]));
    if (msgs.length) lockErr.set(node.id, msgs);
  });
  // 노드 순서대로: 잠금 오류를 그 노드의 다른 오류 앞에
  const rest = structuralErrors(program);
  const out = [];
  const done = new Set();
  walk(program, (node) => {
    if (done.has(node.id)) return;
    done.add(node.id);
    for (const msg of lockErr.get(node.id) || []) out.push({ nodeId: node.id, msg });
    for (const e of rest) if (e.nodeId === node.id) out.push(e);
  });
  return out;
}

// ---- 코드 생성 ----
// 패턴 찾기가 하나라도 있으면 맨 위에 import re 한 줄(줄 표에서는 프로그램 순서로 첫 패턴 찾기 노드).
export function codegen(program) {
  const lines = [];
  const lineMap = {};
  const emit = (indent, text, id) => {
    lines.push("    ".repeat(indent) + text);
    lineMap[lines.length] = id;
  };
  // ctx: loops(겹친 range 반복 수 — i j k m), lists(바깥→안쪽 목록 [{ type, name }]), reading(바깥 쪽지 읽기 수)
  const block = (list, indent, ctx, owner) => {
    if (!list || list.length === 0) { emit(indent, "pass", owner); return; }
    for (const n of list) node(n, indent, ctx);
  };
  // 목록 변수 값은 가장 안쪽 같은 종류 목록의 이름(틀린 자리면 미리보기용 기본 이름 — 오류는 따로 알림)
  const lv = (lists, type) => innermost(lists, type)?.name ?? LIST_VAR[type] ?? "None";
  const nv = (v) => (NOTE_VARS.includes(v.noteVar) ? v.noteVar : "None");
  const val = (v, lists, type) => (isLoopVar(v) ? lv(lists, type ?? v.type) : isNoteVar(v) ? nv(v) : pyStr(v));
  const valName = (v, lists) => (isLoopVar(v) ? lv(lists, v.type) : isNoteVar(v) ? nv(v) : String(v));
  // 말하기·일지에 넣는 값 글자: 쪽지 line은 줄 끝 줄바꿈을 떼어(line.strip()) 쓰고, 나머지는 str(값)
  const valText = (v, lists) => (isNoteVar(v) && v.noteVar === "line" ? "line.strip()" : `str(${valName(v, lists)})`);
  const node = (n, indent, ctx) => {
    const a = n.args || {};
    const { loops, lists } = ctx;
    switch (n.kind) {
      case "move": emit(indent, `move(${val(a.dir, lists, "dir")})`, n.id); break;
      case "harvest": emit(indent, "harvest()", n.id); break;
      case "plant": emit(indent, `plant(${val(a.crop, lists, "crop")})`, n.id); break;
      case "where": emit(indent, "x, y = where()", n.id); break;
      case "sayval": {
        const parts = [];
        if (typeof a.pre === "string" && a.pre !== "") parts.push(pyStr(a.pre));
        parts.push(valText(a.var, lists));
        if (typeof a.post === "string" && a.post !== "") parts.push(pyStr(a.post));
        emit(indent, `print(${parts.join(" + ")})`, n.id);
        break;
      }
      case "foreach": {
        const L = isObj(a.list) ? a.list : {};
        const type = LIST_TYPES.includes(L.type) ? L.type : "crop";
        const name = listVarName(type, lists, ctx.reading, n.body);
        const items = Array.isArray(L.items) ? L.items.map(pyStr).join(", ") : "";
        emit(indent, `for ${name} in [${items}]:`, n.id);
        block(n.body, indent + 1, { ...ctx, lists: [...lists, { type, name }] }, n.id);
        break;
      }
      case "say": emit(indent, `print(${pyStr(a.text)})`, n.id); break;
      case "setvar": emit(indent, `${a.name} = ${a.value}`, n.id); break;
      case "addvar": emit(indent, `${a.name} = ${a.name} + ${a.value}`, n.id); break;
      case "call": emit(indent, `${a.name}()`, n.id); break;
      case "if":
        emit(indent, `if ${condCode(a.cond)}:`, n.id);
        block(n.body, indent + 1, ctx, n.id);
        if (Array.isArray(n.orelse)) {
          emit(indent, "else:", n.id);
          block(n.orelse, indent + 1, ctx, n.id);
        }
        break;
      case "while":
        emit(indent, `while ${condCode(a.cond)}:`, n.id);
        block(n.body, indent + 1, ctx, n.id);
        break;
      case "repeat": {
        const v = LOOP_VARS[loops] ?? `i${loops + 1}`;
        emit(indent, `for ${v} in range(${isNoteCount(a.n) ? "int(n)" : a.n}):`, n.id);
        block(n.body, indent + 1, { ...ctx, loops: loops + 1 }, n.id);
        break;
      }
      case "def":
        emit(indent, `def ${a.name}():`, n.id);
        block(n.body, indent + 1, { loops: 0, lists: [], reading: 0 }, n.id);
        break;
      case "try":
        emit(indent, "try:", n.id);
        block(n.body, indent + 1, ctx, n.id);
        emit(indent, "except ValueError:", n.id);
        block(n.handler, indent + 1, ctx, n.id);
        break;
      case "readnote":
        emit(indent, `with open(${pyStr(a.file)}) as f:`, n.id);
        emit(indent + 1, "for line in f:", n.id);
        block(n.body, indent + 2, { ...ctx, reading: ctx.reading + 1 }, n.id);
        break;
      case "splitline": emit(indent, "crop, n = line.split()", n.id); break;
      case "findall": {
        const pat = PATTERNS[a.pattern] ?? PATTERNS.crop_num;
        emit(indent, `for ${pat.vars.join(", ")} in re.findall(r"${pat.re}", line):`, n.id);
        block(n.body, indent + 1, ctx, n.id);
        break;
      }
      case "writelog": {
        const pre = typeof a.pre === "string" ? a.pre : "";
        const post = typeof a.post === "string" ? a.post : "";
        let text;
        if (a.var === null || a.var === undefined) text = pyStr(`${pre}${post}\n`);
        else text = [...(pre !== "" ? [pyStr(pre)] : []), valText(a.var, lists), pyStr(`${post}\n`)].join(" + ");
        emit(indent, `with open(${pyStr(LOG_FILE)}, "a") as f:`, n.id);
        emit(indent + 1, `f.write(${text})`, n.id);
        break;
      }
      default: emit(indent, "pass", n.id);
    }
  };
  for (const n of program || []) node(n, 0, { loops: 0, lists: [], reading: 0 });
  let firstFind = null;
  walk(program, (n) => { if (firstFind === null && n.kind === "findall") firstFind = n; });
  if (firstFind) {
    lines.unshift("import re");
    const shifted = { 1: firstFind.id };
    for (const [k, v] of Object.entries(lineMap)) shifted[Number(k) + 1] = v;
    return { code: lines.join("\n") + "\n", lineMap: shifted, errors: structuralErrors(program) };
  }
  return { code: lines.length ? lines.join("\n") + "\n" : "", lineMap, errors: structuralErrors(program) };
}

// ---- 새 노드·시작 프로그램 ----
export function newNode(kind, nextId) {
  const spec = NODES[kind];
  if (!spec) throw new Error(`모르는 노드 종류: ${kind}`);
  const id = typeof nextId === "function" ? nextId() : nextId;
  // 목록 같은 객체 기본값은 노드마다 새로(공유하지 않음)
  const args = Object.fromEntries(Object.entries(spec.args).map(([k, s]) => [k, isObj(s.default) ? structuredClone(s.default) : s.default]));
  const n = { id, kind, args };
  if (spec.body) n.body = [];
  if (spec.handler) n.handler = [];
  return n;
}

export function defaultProgram() {
  return [newNode("move", 1), newNode("harvest", 2)];
}

// ---- 찾기·세기 ----
export function findNode(program, id) {
  let found = null;
  walk(program, (n) => { if (found === null && n.id === id) found = n; });
  return found;
}

export function countNodes(program) {
  let c = 0;
  walk(program, () => { c += 1; });
  return c;
}

// 쓴 노드 종류 + 표지: "cond:store"(창고 조건), "cond:pos"(x·y 비교 조건), "loopvar"(목록 변수를 값으로 고름),
// "loopvar:act"(이동·심기 값으로 목록 변수를 고름 — 값 넣어 말하기만으로는 아님, 섞어 심기 주문),
// v0.12: "crop:토마토"(토마토를 심기·목록·창고 조건에 씀), "readnote:<파일>", "findall:<패턴 id>"
// (try·readnote·splitline·writelog·findall은 노드 종류 그대로)
// v0.12.1: "readnote:<파일>:used"(그 쪽지 읽기 안에서 읽은 줄 — line 또는 거기서 나눈·찾은 crop·n — 을 노드 값으로 씀),
//   "findall:<패턴 id>:used"(그 패턴 찾기 안에서 패턴이 만든 값을 씀). 숫자만 뽑기·어제 일지 읽기 주문이 값을 실제로 쓰게.
// 노드가 값으로 읽는 쪽지 값 이름들(값 넣어 말하기·일지 쓰기 값, 심기 crop, 반복 int(n))
function noteRefs(n) {
  const a = isObj(n.args) ? n.args : {};
  if ((n.kind === "sayval" || n.kind === "writelog") && isNoteVar(a.var)) return [a.var.noteVar];
  if (n.kind === "plant" && isNoteVar(a.crop)) return [a.crop.noteVar];
  if (n.kind === "repeat" && isNoteCount(a.n)) return [a.n.value];
  return [];
}
// list 안에서 live 이름의 쪽지 값을 읽는가. derive(쪽지 읽기): 안의 줄 나누기·패턴 찾기가 만든 값도 그 줄에서 온 값.
// 아니면(패턴 찾기): 안쪽 줄 나누기·패턴 찾기가 같은 이름을 다시 정하면 그 뒤·그 안은 다른 값. 안쪽 쪽지 읽기는 다른 쪽지.
function readsNote(list, live, derive) {
  let cur = new Set(live);
  for (const n of Array.isArray(list) ? list : []) {
    if (!n) continue;
    if (noteRefs(n).some((v) => cur.has(v))) return true;
    if (n.kind === "readnote") continue;
    const binds = noteBinds(n);
    const inner = new Set(cur);
    for (const v of binds) derive ? inner.add(v) : inner.delete(v);
    if (n.kind === "findall") { if (readsNote(n.body, inner, derive)) return true; continue; }
    if (SLOTS.some((s) => readsNote(n[s], cur, derive))) return true;
    if (n.kind === "splitline") cur = inner;
  }
  return false;
}
export function kindsUsed(program) {
  const s = new Set();
  walk(program, (n) => {
    s.add(n.kind);
    const a = isObj(n.args) ? n.args : {};
    if (isStoreCond(a.cond)) s.add("cond:store");
    if (isPosCond(a.cond)) s.add("cond:pos");
    if (Object.values(a).some(isLoopVar)) s.add("loopvar");
    if ((n.kind === "move" && isLoopVar(a.dir)) || (n.kind === "plant" && isLoopVar(a.crop))) s.add("loopvar:act");
    if (usesTomato(n)) s.add(`crop:${TOMATO}`);
    if (n.kind === "readnote" && typeof a.file === "string") {
      s.add(`readnote:${a.file}`);
      if (readsNote(n.body, ["line"], true)) s.add(`readnote:${a.file}:used`);
    }
    if (n.kind === "findall" && typeof a.pattern === "string") {
      s.add(`findall:${a.pattern}`);
      const vars = Object.hasOwn(PATTERNS, a.pattern) ? PATTERNS[a.pattern].vars : [];
      if (readsNote(n.body, vars, false)) s.add(`findall:${a.pattern}:used`);
    }
  });
  return s;
}

// ---- 화면 도우미(v0.11) ----
/**
 * (v0.12.1) 값 넣어 말하기·일지 쓰기에서 값을 고를 때: 기억한 값(source "var")이 아니면 — 쪽지 값(line·crop·n)·
 * 위치(x·y)·목록 값 — 기본 앞·뒤 글자(「당근 」·「개」, 「수확 」·「개」)는 맞지 않으므로 비울 칸 { pre?: "", post?: "" }.
 * 기본값과 다른(학습자가 고친) 글자는 두고, 다른 노드면 {}. 화면은 이번에 고친 글자인지도 따로 본다.
 */
export function valueTextReset(kind, args, source) {
  if ((kind !== "sayval" && kind !== "writelog") || source === "var") return {};
  const out = {};
  for (const k of ["pre", "post"]) if ((args?.[k] ?? "") === NODES[kind].args[k].default) out[k] = "";
  return out;
}

// id 노드 자리(그 노드가 실행되기 직전)의 범위 정보. 못 찾으면 null.
function envAt(program, id) {
  let found = null;
  scopeWalk(program, (n, env) => {
    if (found === null && n.id === id) {
      found = { known: new Set(env.known), notes: new Set(env.notes), loops: env.loops.slice(), inDef: env.inDef };
    }
  });
  return found;
}

/**
 * 그 노드 자리에서 고를 수 있는 값 목록(값 넣어 말하기·값 비교 조건 고르기 창용).
 * 순서: 기억한 값(VAR_NAMES 순) → x·y → 목록 변수(종류마다 가장 안쪽 것, LIST_TYPES 순) → 쪽지 값(line·crop·n).
 * @returns {{ name: string, arg: string|{loopVar:true,type:string}|{noteVar:string}, source: "var"|"pos"|"loop"|"note" }[]}
 *   arg는 노드 args에 그대로 넣을 값(값 넣어 말하기·일지 쓰기). 값 비교 조건에는 source가 "var"·"pos"인 것만 쓴다.
 *   숫자 n과 쪽지 n은 같은 자리에 함께 나오지 않는다.
 */
export function availableValues(program, nodeId) {
  const env = envAt(program, nodeId);
  if (!env) return [];
  const out = [];
  for (const v of VAR_NAMES) if (env.known.has(v)) out.push({ name: v, arg: v, source: "var" });
  for (const v of POS_NAMES) if (env.known.has(v)) out.push({ name: v, arg: v, source: "pos" });
  for (const type of LIST_TYPES) {
    const l = innermost(env.loops, type);
    if (l) out.push({ name: l.name, arg: { loopVar: true, type }, source: "loop" });
  }
  for (const v of NOTE_VARS) if (env.notes.has(v)) out.push({ name: v, arg: { noteVar: v }, source: "note" });
  return out;
}

/** 그 노드 자리에서 쪽지 값(name: "line"|"crop"|"n")을 쓸 수 있으면 그 이름, 아니면 null(심기 crop·반복 int(n) 고르기용) */
export function noteVarAvailable(program, nodeId, name) {
  const env = envAt(program, nodeId);
  return env && NOTE_VARS.includes(name) && env.notes.has(name) ? name : null;
}

/** 그 노드 자리에서 type("crop"|"dir") 목록 변수를 쓸 수 있으면 그 이름(crop·way·crop2…), 아니면 null */
export function loopVarAvailable(program, nodeId, type) {
  const env = envAt(program, nodeId);
  return (env && innermost(env.loops, type)?.name) || null;
}

// ---- 불변 편집(바뀐 길만 새로 만들고 나머지는 공유) ----
// id 노드를 fn(node)로 바꾼 새 목록. 못 찾으면 null.
function replaceNode(list, id, fn) {
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (n.id === id) {
      const out = list.slice();
      out[i] = fn(n);
      return out;
    }
    for (const slot of SLOTS) {
      if (!Array.isArray(n[slot])) continue;
      const sub = replaceNode(n[slot], id, fn);
      if (sub) {
        const out = list.slice();
        out[i] = { ...n, [slot]: sub };
        return out;
      }
    }
  }
  return null;
}

// id 노드가 들어 있는 형제 목록을 fn(list, index)로 바꾼 새 프로그램. 못 찾으면 null.
function replaceSiblings(list, id, fn) {
  const idx = list.findIndex((n) => n.id === id);
  if (idx >= 0) return fn(list, idx);
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    for (const slot of SLOTS) {
      if (!Array.isArray(n[slot])) continue;
      const sub = replaceSiblings(n[slot], id, fn);
      if (sub) {
        const out = list.slice();
        out[i] = { ...n, [slot]: sub };
        return out;
      }
    }
  }
  return null;
}

const must = (r, id) => {
  if (!r) throw new Error(`노드를 찾을 수 없어요: ${id}`);
  return r;
};

const spliceIn = (list, index, node) => {
  const at = Math.max(0, Math.min(Number.isInteger(index) ? index : list.length, list.length));
  return [...list.slice(0, at), node, ...list.slice(at)];
};

export function insertNode(program, parentId, slot, index, node) {
  if (parentId === null || parentId === undefined) return spliceIn(program, index, node);
  return must(replaceNode(program, parentId, (p) => {
    const spec = NODES[p.kind];
    const allowed = slot === "orelse" ? spec?.orelse : slot === "handler" ? spec?.handler : spec?.body;
    if (!allowed || !SLOTS.includes(slot)) throw new Error(`${p.kind}에는 ${slot}이 없어요`);
    return { ...p, [slot]: spliceIn(Array.isArray(p[slot]) ? p[slot] : [], index, node) };
  }), parentId);
}

export function moveNode(program, id, delta) {
  return must(replaceSiblings(program, id, (list, i) => {
    const j = Math.max(0, Math.min(list.length - 1, i + delta));
    if (j === i) return list.slice();
    const out = list.slice();
    const [n] = out.splice(i, 1);
    out.splice(j, 0, n);
    return out;
  }), id);
}

export function removeNode(program, id) {
  return must(replaceSiblings(program, id, (list, i) => [...list.slice(0, i), ...list.slice(i + 1)]), id);
}

export function updateArgs(program, id, args) {
  return must(replaceNode(program, id, (n) => ({ ...n, args: { ...n.args, ...args } })), id);
}

// 「만약」의 아니면 켜기(빈 orelse)·끄기(orelse 지움)
export function setElse(program, id, on) {
  return must(replaceNode(program, id, (n) => {
    if (!NODES[n.kind]?.orelse) throw new Error(`${n.kind}에는 아니면이 없어요`);
    if (on) return Array.isArray(n.orelse) ? n : { ...n, orelse: [] };
    const { orelse, ...rest } = n;
    return rest;
  }), id);
}
