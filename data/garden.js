// v0.10 파이의 텃밭 데이터: 작물·성장·주문 (설계서 docs/specs/2026-11-05-파이의-텃밭-설계.md §1·§4)
//
// CROPS: 자라는 시간(행동 수). 규칙은 src/py/runner.py의 farm 모듈에 있고, 이 표는 화면·시험이 같은 값을 쓰게
//        옮겨 둔 것이다(tests/garden_orders.py가 runner의 FARM_GROW·FARM_GROW_FERTILIZED와 같은지 확인).
// UPGRADES: 창고 작물로 사는 성장. id "감자 씨앗"·"비료"는 runner가 upgrades 글자로 직접 확인하므로 바꾸지 않는다.
// ORDERS: 리아 교수의 주문 29개(v0.10 1~5장 15개 + v0.11 6~9장 7개 + v0.12 10~12장 7개), 장 순서. 한 번에 하나씩 게시판에 걸린다.
//   goal.type:
//     deliver     { crop, n }               창고에서 n개 보내기(단추)
//     run_harvest { crop?, n, max_actions?, kind? } 한 번 실행에 n개 이상 거두기(crop 없으면 아무 작물), 행동 수 제한 선택.
//                 kind가 있으면 노드 모드에서 그 노드를 쓴 실행만 셈(그 장에서 배운 것을 써 보게, 검토 C62)
//     use         { kind }                  그 노드를 쓴 노드 모드 실행이 오류·멈춤 없이 끝남.
//                                           kind는 노드 종류 또는 nodes.kindsUsed의 표지("cond:store" 창고 조건,
//                                           "cond:pos" x·y 비교, "loopvar" 목록 변수를 값으로 고름,
//                                           "loopvar:act" 이동·심기 값으로 목록 변수를 고름,
//                                           v0.12.1 "readnote:<파일>:used"·"findall:<패턴>:used" 그 노드 안에서
//                                           읽은 줄·찾은 값을 노드 값으로 씀 — 숫자만 뽑기·어제 일지 읽기)
//     grid        { size }                  밭 넓히기 성장을 가짐
//     (v0.12) use에 journal: true            실행 뒤 농장일지(result.farm.files)에 글이 있어야 함(농장일지 주문)
//     plant_as_note { file, parse?, kind? }  이번 실행의 plant 사건(작물별 개수)이 그 주문 쪽지(note)에서 읽은 작물별 개수와
//                                           같음. parse 없으면 줄마다 「작물 개수」, "crop_num"이면 작물+숫자 패턴
//                                           (src/garden/state.js noteCounts). 오류·멈춤 없이, kind가 있으면 노드 모드에서 그 노드
//   note: { file, text } (v0.12) 그 주문 차례에 쪽지함에 놓이는 받는 쪽지(읽기 전용). 없으면 DAILY_NOTES에서 고름.
//   setup.files (v0.12) 그 주문 차례의 농장일지(저장 garden.files)
//   solution: 그 장까지 열린 노드만으로 만든 정답 프로그램(노드 목록).
//   setup: 정답을 확인할 때 시작하는 텃밭(그 주문 차례에 학습자가 있을 법한 상태). tests/garden_orders.py가
//          setup에서 solution을 실제 엔진으로 돌리고(deliver·grid는 그 뒤 보내기·사기까지) 주문이 끝나는지 본다.

export const CROPS = {
  당근: { grow: 8, fert: 6 },
  감자: { grow: 12, fert: 9 },
  토마토: { grow: 10, fert: 7 },   // v0.12: 10장부터 고를 수 있음(nodes.MARK_LOCKS), 씨앗 봉투에서 하나씩
};

// v0.12 쪽지함: 지금 주문에 그 파일의 note가 없을 때 놓이는 「오늘의 쪽지」(실행 횟수 runs % 4로 고름).
// 주문서.txt는 줄마다 「작물 개수」, 손글씨주문.txt는 작물 바로 뒤에 숫자(패턴 찾기 작물+숫자로 읽힘).
export const DAILY_NOTES = {
  "주문서.txt": ["당근 2\n감자 1", "감자 2\n당근 1", "당근 3", "토마토 1\n당근 2"],
  "손글씨주문.txt": [
    "리아: 당근2개 부탁해요!",
    "리아: 감자1개랑 당근2개요~",
    "리아: 토마토 2개 있으면 좋겠어요",
    "리아: 당근1개, 감자1개, 토마토1개!",
  ],
};

export const UPGRADES = [
  { id: "grid4", label: "밭 4×4", cost: { 당근: 20 }, size: 4 },
  { id: "grid5", label: "밭 5×5", cost: { 당근: 40, 감자: 15 }, size: 5, needs: "grid4" },
  { id: "감자 씨앗", label: "감자 씨앗", cost: { 당근: 10 } },
  { id: "비료", label: "비료", cost: { 감자: 20 } },
];

// v0.12 검토(판정 C71 C2): 토마토 씨앗 5개 — 여러 번 살 수 있는 소모품(성장 목록 upgrades에는 넣지 않음).
// 봉투에 seeds개를 더하고(최대 20), 10장(need)을 통과해야 살 수 있다. 씨앗이 0이고 밭에 토마토가 없어 막혔을 때 다시 시작하는 길.
export const SEED_PACK = { id: "seedpack", label: "토마토 씨앗 5개", cost: { 당근: 5 }, seeds: 5, need: 10 };

// ---- 정답 프로그램 만들기(노드 id는 prog가 앞에서부터 1, 2, 3… 매김) ----
const mv = (dir) => ({ kind: "move", args: { dir } });
const hv = () => ({ kind: "harvest", args: {} });
const pl = (crop) => ({ kind: "plant", args: { crop } });
const say = (text) => ({ kind: "say", args: { text } });
const setv = (name, value) => ({ kind: "setvar", args: { name, value } });
const addv = (name, value) => ({ kind: "addvar", args: { name, value } });
const iff = (cond, body, orelse) => ({ kind: "if", args: { cond }, body, ...(orelse ? { orelse } : {}) });
const defn = (name, body) => ({ kind: "def", args: { name }, body });
const call = (name) => ({ kind: "call", args: { name } });
const rep = (n, body) => ({ kind: "repeat", args: { n }, body });
const whl = (cond, body) => ({ kind: "while", args: { cond }, body });
// v0.11
const sv = (pre, v, post) => ({ kind: "sayval", args: { pre, var: v, post } });
const fe = (type, items, body) => ({ kind: "foreach", args: { list: { type, items } }, body });
const wh = () => ({ kind: "where", args: {} });
// v0.12
const tr = (body, handler) => ({ kind: "try", args: {}, body, handler });
const rd = (file, body) => ({ kind: "readnote", args: { file }, body });
const split = () => ({ kind: "splitline", args: {} });
const wl = (pre, v, post) => ({ kind: "writelog", args: { pre, var: v, post } });
const fa = (pattern, body) => ({ kind: "findall", args: { pattern }, body });
const NV = (name) => ({ noteVar: name });                                 // 쪽지 값 line·crop·n
const NC = { value: "n" };                                                // 반복 횟수 int(n)
const LV = { loopVar: true };                                            // 가장 안쪽 목록의 변수(crop·way)
const storeLt = (crop, num) => ({ store: { crop, op: "<", num } });       // store()["감자"] < 10
const pos = (v, num) => ({ var: v, op: "==", num });                      // x == 3

function prog(...list) {
  let id = 0;
  const number = (nodes) => nodes.map((n) => {
    const out = { id: ++id, kind: n.kind, args: structuredClone(n.args) };
    if (n.body) out.body = number(n.body);
    if (n.orelse) out.orelse = number(n.orelse);
    if (n.handler) out.handler = number(n.handler);
    return out;
  });
  return number(list);
}

// ---- 시작 텃밭 만들기 ----
// rows[y]의 글자 x: "." 빈칸, "C" 다 자란 당근, "c" 막 심은 당근, "P" 다 자란 감자, "p" 막 심은 감자,
// "T" 다 자란 토마토, "t" 막 심은 토마토(v0.12).
// 다 자람 = clock − 자라는 시간(비료 없을 때)에 심음 → 비료가 있어도 다 자람.
// seeds: 토마토 씨앗 봉투(기본 5). files: 주문 차례의 농장일지 { "농장일지.txt": 글 } (준 때만 붙음 — runner는 쓰지 않음)
const CELL = { C: ["당근", true], c: ["당근", false], P: ["감자", true], p: ["감자", false], T: ["토마토", true], t: ["토마토", false] };
export function farmSetup(rows, { pie = { x: 0, y: 0 }, clock = 0, store = {}, upgrades = [], seeds = 5, files } = {}) {
  const size = rows.length;
  const cells = [];
  for (const row of rows) {
    if ([...row].length !== size) throw new Error(`텃밭 줄 길이가 ${size}칸이 아님: ${row}`);
    for (const ch of row) {
      if (ch === ".") { cells.push(null); continue; }
      const [crop, ripe] = CELL[ch] || [];
      if (!crop) throw new Error(`모르는 칸 글자: ${ch}`);
      cells.push({ crop, planted_at: ripe ? clock - CROPS[crop].grow : clock });
    }
  }
  const out = { size, cells, pie: { ...pie }, clock, store: { 당근: 0, 감자: 0, 토마토: 0, ...store }, upgrades: [...upgrades], seeds };
  if (files) out.files = { ...files };
  return out;
}

// 처음 텃밭(newGarden이 씀): 3×3, 당근 3개 중 오른쪽 두 개는 다 자람
export const START_ROWS = [".CC", ".c.", "..."];

const G4 = ["grid4"];
const SEED = ["감자 씨앗"];

export const ORDERS = [
  // ---- 1장: 이동 · 수확 · 심기 · 말하기 ----
  {
    id: "o_first", need: 1, title: "첫 수확",
    text: "파이와 함께 첫 당근을 거둬 볼까요? 다 자란 당근이 바로 오른쪽 칸에 있어요.",
    goal: { type: "run_harvest", crop: "당근", n: 1 },
    xp: 5,
    solution: prog(mv("오른쪽"), hv()),
    setup: farmSetup(START_ROWS),
  },
  {
    id: "o_hello", need: 1, title: "파이의 인사",
    text: "말하기 노드를 넣으면 파이가 말풍선으로 말해요. 텃밭 친구들에게 인사해 봐요!",
    goal: { type: "use", kind: "say" },
    xp: 5,
    solution: prog(say("안녕, 친구들!")),
    setup: farmSetup(["..C", ".c.", "..."], { pie: { x: 1, y: 0 }, clock: 2, store: { 당근: 1 } }),
  },
  {
    id: "o_plant", need: 1, title: "씨앗 심기",
    text: "빈칸에 심기 노드로 당근을 심어 봐요. 행동을 할 때마다 시간이 흘러 작물이 자라요.",
    goal: { type: "use", kind: "plant" },
    xp: 5,
    solution: prog(pl("당근"), say("쑥쑥 자라라!")),
    setup: farmSetup(["..C", ".c.", "..."], { pie: { x: 1, y: 0 }, clock: 2, store: { 당근: 1 } }),
  },
  {
    id: "o_lunch", need: 1, title: "급식실 당근",
    text: "급식실에서 당근 3개를 부탁했어요. 창고에 모이면 보내기 단추를 눌러 주세요.",
    goal: { type: "deliver", crop: "당근", n: 3 },
    xp: 5,
    solution: prog(mv("오른쪽"), hv(), mv("오른쪽"), hv()),
    setup: farmSetup([".CC", ".c.", "..."], { clock: 12, store: { 당근: 1 } }),
  },
  // ---- 2장: 값 기억하기 · 값 더하기 ----
  {
    id: "o_count", need: 2, title: "수확 세기",
    text: "값 기억하기로 count를 0에서 시작하고, 거둘 때마다 값 더하기로 1씩 늘려 봐요.",
    goal: { type: "use", kind: "addvar" },
    xp: 5,
    solution: prog(setv("count", 0), mv("오른쪽"), hv(), addv("count", 1), say("하나 거뒀어!")),
    setup: farmSetup([".CC", "...", "..."], { clock: 20 }),
  },
  {
    id: "o_row", need: 2, title: "한 줄 거두기",
    text: "윗줄의 당근 세 개를 한 번 실행으로 모두 거둬 봐요. 이동과 수확을 번갈아 써요.",
    goal: { type: "run_harvest", crop: "당근", n: 3 },
    xp: 5,
    solution: prog(
      setv("count", 0),
      hv(), addv("count", 1), mv("오른쪽"),
      hv(), addv("count", 1), mv("오른쪽"),
      hv(), addv("count", 1),
    ),
    setup: farmSetup(["CCC", "...", "..."], { clock: 20 }),
  },
  {
    id: "o_soup", need: 2, title: "당근 수프",
    text: "과학실 수프 모임에 당근 10개가 필요해요. 모아서 보내 주면 정말 고맙겠어요.",
    goal: { type: "deliver", crop: "당근", n: 10 },
    xp: 5,
    solution: prog(hv(), mv("오른쪽"), hv(), mv("오른쪽"), hv()),
    setup: farmSetup(["CCC", "...", "..."], { clock: 40, store: { 당근: 7 } }),
  },
  // ---- 3장: 만약 · 아니면 ----
  {
    id: "o_if", need: 3, title: "다 자랐을 때만",
    text: "덜 자란 작물을 거두면 사라져요. 만약 노드로 다 자란 것만 골라 거둬 봐요.",
    goal: { type: "use", kind: "if" },
    xp: 5,
    solution: prog(
      mv("오른쪽"),
      iff("can_harvest", [hv()], [say("아직 덜 자랐어")]),
      mv("오른쪽"),
      iff("can_harvest", [hv()], [say("아직 덜 자랐어")]),
    ),
    setup: farmSetup([".Cc", "...", "..."], { clock: 60 }),
  },
  {
    id: "o_potato", need: 3, title: "첫 감자",
    text: "감자 씨앗을 사서 감자를 키워 봐요. 다 자란 감자를 한 번 실행에 하나 거두면 돼요.",
    goal: { type: "run_harvest", crop: "감자", n: 1 },
    xp: 5,
    solution: prog(
      mv("오른쪽"),
      iff("can_harvest", [hv(), pl("감자")]),
    ),
    setup: farmSetup([".P.", "...", "..."], { clock: 80, upgrades: SEED }),
  },
  {
    id: "o_grid4", need: 3, title: "밭 넓히기",
    text: "작물이 늘어서 텃밭이 좁아요. 당근 20개를 모아 밭을 4×4로 넓혀 봐요.",
    goal: { type: "grid", size: 4 },
    xp: 5,
    solution: prog(
      iff("can_harvest", [hv()]),
      mv("오른쪽"),
      iff("can_harvest", [hv()]),
    ),
    setup: farmSetup(["CC.", "...", "..."], { clock: 100, store: { 당근: 18, 감자: 1 }, upgrades: SEED }),
  },
  // ---- 4장: 내 노드 만들기 · 내 노드 부르기 ----
  {
    id: "o_def", need: 4, title: "내 노드 만들기",
    text: "자주 쓰는 순서를 내 노드로 묶어 두고, 내 노드 부르기로 여러 번 불러 봐요.",
    goal: { type: "use", kind: "call" },
    xp: 5,
    solution: prog(
      defn("tend", [iff("can_harvest", [hv()]), mv("오른쪽")]),
      call("tend"),
      call("tend"),
    ),
    setup: farmSetup(["CC..", "....", "....", "...."], { clock: 120, upgrades: [...SEED, ...G4] }),
  },
  {
    id: "o_def_row", need: 4, title: "내 노드로 한 줄",
    text: "한 줄을 거두는 내 노드를 만들어, 밭 윗줄의 당근 4개를 한 번에 거둬 봐요.",
    goal: { type: "run_harvest", crop: "당근", n: 4, kind: "call" },
    xp: 5,
    solution: prog(
      defn("harvest_row", [hv(), mv("오른쪽"), hv(), mv("오른쪽"), hv(), mv("오른쪽"), hv(), mv("오른쪽")]),
      call("harvest_row"),
    ),
    setup: farmSetup(["CCCC", "....", "....", "...."], { clock: 140, upgrades: [...SEED, ...G4] }),
  },
  // ---- 5장: 반복 n번 · ~하는 동안 ----
  {
    id: "o_repeat", need: 5, title: "반복으로 한 줄",
    text: "같은 노드를 여러 번 넣는 대신, 반복 노드 하나로 한 줄을 다 거둬 봐요.",
    goal: { type: "use", kind: "repeat" },
    xp: 5,
    solution: prog(rep(4, [hv(), mv("오른쪽")])),
    setup: farmSetup(["CCCC", "....", "....", "...."], { clock: 160, upgrades: [...SEED, ...G4] }),
  },
  {
    id: "o_while", need: 5, title: "~하는 동안",
    text: "count가 4보다 작은 동안 빈칸에 당근을 심고 옆으로 가요. ~하는 동안 노드를 써 봐요.",
    goal: { type: "use", kind: "while" },
    xp: 5,
    solution: prog(
      setv("count", 0),
      whl({ var: "count", op: "<", num: 4 }, [
        iff("here_empty", [pl("당근")]),
        mv("오른쪽"),
        addv("count", 1),
      ]),
    ),
    setup: farmSetup(["....", "....", "....", "...."], { clock: 180, upgrades: [...SEED, ...G4] }),
  },
  {
    id: "o_all", need: 5, title: "밭 전체 수확",
    text: "밭 전체를 돌며 당근 16개를 행동 40번 안에 한 번에 거둬요. 반복 안에 반복을 넣어 봐요.",
    goal: { type: "run_harvest", crop: "당근", n: 16, max_actions: 40, kind: "repeat" },
    xp: 5,
    solution: prog(rep(4, [rep(4, [hv(), mv("오른쪽")]), mv("아래")])),
    setup: farmSetup(["CCCC", "CCCC", "CCCC", "CCCC"], { clock: 200, upgrades: [...SEED, ...G4] }),
  },
  // ---- 6장: 값 넣어 말하기 (v0.11) ----
  {
    id: "o_sayval", need: 6, title: "수확 보고",
    text: "count로 거둔 당근 수를 세고, 값 넣어 말하기로 「당근 4개 거뒀어」처럼 알려 줘요.",
    goal: { type: "use", kind: "sayval" },
    xp: 5,
    solution: prog(
      setv("count", 0),
      rep(4, [iff("can_harvest", [hv(), addv("count", 1)]), mv("오른쪽")]),
      sv("당근 ", "count", "개 거뒀어"),
    ),
    setup: farmSetup(["CCCC", "....", "....", "...."], { clock: 220, store: { 당근: 40, 감자: 6 }, upgrades: [...SEED, ...G4] }),
  },
  // ---- 7장: 목록에서 하나씩 ----
  {
    id: "o_mix", need: 7, title: "섞어 심기",
    text: "작물 목록에 당근·감자를 번갈아 넣고, 목록 안의 심기 노드에서 crop을 골라 심어 봐요.",
    goal: { type: "use", kind: "loopvar:act" },
    xp: 5,
    solution: prog(fe("crop", ["당근", "감자", "당근", "감자"], [iff("here_empty", [pl(LV)]), mv("오른쪽")])),
    setup: farmSetup(["....", "....", "....", "...."], { clock: 240, store: { 당근: 44, 감자: 6 }, upgrades: [...SEED, ...G4] }),
  },
  {
    id: "o_patrol", need: 7, title: "한 바퀴 순찰",
    text: "방향 목록을 하나씩 따라 움직이며, 다 자란 작물 3개를 한 번 실행에 거둬 봐요.",
    goal: { type: "run_harvest", n: 3, kind: "foreach" },
    xp: 5,
    solution: prog(fe("dir", ["오른쪽", "아래", "왼쪽"], [mv(LV), iff("can_harvest", [hv()])])),
    setup: farmSetup([".C..", "CC..", "....", "...."], { clock: 260, store: { 당근: 44, 감자: 6 }, upgrades: [...SEED, ...G4] }),
  },
  // ---- 8장: 창고 보기(조건) ----
  {
    id: "o_lowstock", need: 8, title: "모자란 것만",
    text: "창고 보기 조건으로 감자가 10개보다 적으면 감자를, 아니면 당근을 심어 봐요.",
    goal: { type: "use", kind: "cond:store" },
    xp: 5,
    solution: prog(rep(4, [
      iff(storeLt("감자", 10), [iff("here_empty", [pl("감자")])], [iff("here_empty", [pl("당근")])]),
      mv("오른쪽"),
    ])),
    setup: farmSetup(["....", "....", "....", "...."], { clock: 280, store: { 당근: 47, 감자: 6 }, upgrades: [...SEED, ...G4] }),
  },
  {
    id: "o_potato_book", need: 8, title: "감자 장부",
    text: "감자 장부를 채우려면 감자 5개가 필요해요. 창고에 모이면 보내기 단추를 눌러 주세요.",
    goal: { type: "deliver", crop: "감자", n: 5 },
    xp: 5,
    solution: prog(whl(storeLt("감자", 5), [iff("can_harvest", [hv(), pl("감자")]), mv("오른쪽")])),
    setup: farmSetup(["PP..", "....", "....", "...."], { clock: 300, store: { 당근: 47, 감자: 3 }, upgrades: [...SEED, ...G4] }),
  },
  // ---- 9장: 위치 알기 ----
  {
    id: "o_where", need: 9, title: "줄 끝에서 내려가기",
    text: "위치 알기로 x를 알아내, 줄 끝 칸에 닿으면 아래로, 아니면 오른쪽으로 가 봐요.",
    goal: { type: "use", kind: "cond:pos" },
    xp: 5,
    solution: prog(rep(4, [
      iff("can_harvest", [hv()]),
      wh(),
      iff(pos("x", 3), [mv("아래")], [mv("오른쪽")]),
    ])),
    setup: farmSetup(["CCCC", "....", "....", "...."], { clock: 320, store: { 당근: 47, 감자: 5 }, upgrades: [...SEED, ...G4] }),
  },
  {
    id: "o_zigzag", need: 9, title: "지그재그 수확",
    text: "위치 알기로 줄 끝을 알아채며 지그재그로 움직여, 다 자란 작물 9개를 한 번에 거둬요.",
    goal: { type: "run_harvest", n: 9, kind: "where" },
    xp: 5,
    solution: prog(rep(9, [
      iff("can_harvest", [hv()]),
      wh(),
      iff(pos("y", 1),
        [iff(pos("x", 0), [mv("아래")], [mv("왼쪽")])],
        [iff(pos("x", 3), [mv("아래")], [mv("오른쪽")])]),
    ])),
    setup: farmSetup(["CCCC", "CCCC", "C...", "...."], { clock: 340, store: { 당근: 51, 감자: 5 }, upgrades: [...SEED, ...G4] }),
  },
  // ---- 10장: 예외 — 토마토와 씨앗 봉투 (v0.12) ----
  {
    id: "o_tomato", need: 10, title: "첫 토마토",
    text: "토마토 씨앗 봉투가 왔어요. 토마토는 행동 10번이면 자라요. 다 자란 토마토를 한 번에 하나 거둬 봐요.",
    goal: { type: "run_harvest", crop: "토마토", n: 1 },
    xp: 5,
    solution: prog(mv("오른쪽"), iff("can_harvest", [hv(), pl("토마토")])),
    setup: farmSetup([".T..", "....", "....", "...."], { clock: 360, store: { 당근: 67, 감자: 5 }, upgrades: [...SEED, ...G4], seeds: 4 }),
  },
  {
    id: "o_try", need: 10, title: "씨앗이 떨어지면",
    text: "씨앗 봉투가 비면 토마토 심기가 오류를 내요. 시도하기로 토마토를 심고, 안 되면 당근을 심어 봐요.",
    goal: { type: "use", kind: "try" },
    xp: 5,
    solution: prog(rep(4, [tr([pl("토마토")], [pl("당근")]), mv("오른쪽")])),
    setup: farmSetup(["....", "....", "....", "...."], { clock: 380, store: { 당근: 67, 감자: 5, 토마토: 1 }, upgrades: [...SEED, ...G4], seeds: 2 }),
  },
  // ---- 11장: 파일 — 쪽지함 (v0.12) ----
  {
    id: "o_note", need: 11, title: "주문서대로",
    text: "주문서가 쪽지함에 왔어요. 쪽지 읽기·줄 나누기로 작물과 개수를 알아내 빈 칸에 그만큼 심어요. 밭이 차 있으면 먼저 거둬요.",
    goal: { type: "plant_as_note", file: "주문서.txt", kind: "readnote" },
    note: { file: "주문서.txt", text: "당근 2\n감자 1" },
    xp: 5,
    solution: prog(rd("주문서.txt", [split(), rep(NC, [pl(NV("crop")), mv("오른쪽")])])),
    setup: farmSetup(["....", "....", "....", "...."], { clock: 400, store: { 당근: 71, 감자: 5, 토마토: 1 }, upgrades: [...SEED, ...G4], seeds: 2 }),
  },
  {
    id: "o_log", need: 11, title: "농장일지",
    text: "오늘 거둔 수를 count로 세어 일지 쓰기로 농장일지에 남겨요. 일지는 다음 실행에도 남아 있어요.",
    goal: { type: "use", kind: "writelog", journal: true },
    xp: 5,
    solution: prog(
      setv("count", 0),
      rep(4, [iff("can_harvest", [hv(), addv("count", 1)]), mv("오른쪽")]),
      wl("수확 ", "count", "개"),
    ),
    setup: farmSetup(["CCPC", "....", "....", "...."], { clock: 420, store: { 당근: 71, 감자: 5, 토마토: 1 }, upgrades: [...SEED, ...G4], seeds: 2 }),
  },
  {
    id: "o_readlog", need: 11, title: "어제 일지 읽기",
    text: "쪽지 읽기로 농장일지를 열어, 지난번에 적은 줄을 파이가 하나씩 말하게 해 봐요.",
    goal: { type: "use", kind: "readnote:농장일지.txt:used" },
    xp: 5,
    solution: prog(rd("농장일지.txt", [sv("일지: ", NV("line"), "")])),
    setup: farmSetup(["....", "....", "....", "...."], { clock: 440, store: { 당근: 74, 감자: 6, 토마토: 1 }, upgrades: [...SEED, ...G4], seeds: 2,
      files: { "농장일지.txt": "수확 4개\n" } }),
  },
  // ---- 12장: 정규식 — 손글씨 주문서 (v0.12) ----
  {
    id: "o_hand", need: 12, title: "손글씨 주문",
    text: "리아 교수가 손글씨 쪽지를 보냈어요. 패턴 찾기로 작물과 숫자를 뽑아 그만큼 심어 봐요.",
    goal: { type: "plant_as_note", file: "손글씨주문.txt", parse: "crop_num", kind: "findall" },
    note: { file: "손글씨주문.txt", text: "리아: 당근3개 부탁! 토마토 2개도~" },
    xp: 5,
    solution: prog(rd("손글씨주문.txt", [fa("crop_num", [rep(NC, [pl(NV("crop")), mv("오른쪽")]), mv("아래")])])),
    setup: farmSetup(["....", "....", "....", "...."], { clock: 460, store: { 당근: 74, 감자: 6, 토마토: 1 }, upgrades: [...SEED, ...G4], seeds: 4,
      files: { "농장일지.txt": "수확 4개\n" } }),
  },
  {
    id: "o_digits", need: 12, title: "숫자만 뽑기",
    text: "이번 손글씨 쪽지에서는 숫자만 뽑아 봐요. 패턴을 숫자만으로 바꾸고, 찾은 숫자를 파이가 말하게 해요.",
    goal: { type: "use", kind: "findall:num:used" },
    note: { file: "손글씨주문.txt", text: "리아: 감자4개랑 당근 1개 줄래요?" },
    xp: 5,
    solution: prog(rd("손글씨주문.txt", [fa("num", [sv("숫자 ", NV("n"), "")])])),
    setup: farmSetup(["....", "....", "....", "...."], { clock: 480, store: { 당근: 74, 감자: 6, 토마토: 1 }, upgrades: [...SEED, ...G4], seeds: 2 }),
  },
];
