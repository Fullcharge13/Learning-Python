// v0.10 파이의 텃밭 데이터: 작물·성장·주문 (설계서 docs/specs/2026-11-05-파이의-텃밭-설계.md §1·§4)
//
// CROPS: 자라는 시간(행동 수). 규칙은 src/py/runner.py의 farm 모듈에 있고, 이 표는 화면·시험이 같은 값을 쓰게
//        옮겨 둔 것이다(tests/garden_orders.py가 runner의 FARM_GROW·FARM_GROW_FERTILIZED와 같은지 확인).
// UPGRADES: 창고 작물로 사는 성장. id "감자 씨앗"·"비료"는 runner가 upgrades 글자로 직접 확인하므로 바꾸지 않는다.
// ORDERS: 리아 교수의 주문 15개, 장 순서. 한 번에 하나씩 게시판에 걸린다.
//   goal.type:
//     deliver     { crop, n }               창고에서 n개 보내기(단추)
//     run_harvest { crop?, n, max_actions?, kind? } 한 번 실행에 n개 이상 거두기(crop 없으면 아무 작물), 행동 수 제한 선택.
//                 kind가 있으면 노드 모드에서 그 노드를 쓴 실행만 셈(그 장에서 배운 것을 써 보게, 검토 C62)
//     use         { kind }                  그 노드를 쓴 노드 모드 실행이 오류·멈춤 없이 끝남
//     grid        { size }                  밭 넓히기 성장을 가짐
//   solution: 그 장까지 열린 노드만으로 만든 정답 프로그램(노드 목록).
//   setup: 정답을 확인할 때 시작하는 텃밭(그 주문 차례에 학습자가 있을 법한 상태). tests/garden_orders.py가
//          setup에서 solution을 실제 엔진으로 돌리고(deliver·grid는 그 뒤 보내기·사기까지) 주문이 끝나는지 본다.

export const CROPS = {
  당근: { grow: 8, fert: 6 },
  감자: { grow: 12, fert: 9 },
};

export const UPGRADES = [
  { id: "grid4", label: "밭 4×4", cost: { 당근: 20 }, size: 4 },
  { id: "grid5", label: "밭 5×5", cost: { 당근: 40, 감자: 15 }, size: 5, needs: "grid4" },
  { id: "감자 씨앗", label: "감자 씨앗", cost: { 당근: 10 } },
  { id: "비료", label: "비료", cost: { 감자: 20 } },
];

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

function prog(...list) {
  let id = 0;
  const number = (nodes) => nodes.map((n) => {
    const out = { id: ++id, kind: n.kind, args: { ...n.args } };
    if (n.body) out.body = number(n.body);
    if (n.orelse) out.orelse = number(n.orelse);
    return out;
  });
  return number(list);
}

// ---- 시작 텃밭 만들기 ----
// rows[y]의 글자 x: "." 빈칸, "C" 다 자란 당근, "c" 막 심은 당근, "P" 다 자란 감자, "p" 막 심은 감자.
// 다 자람 = clock − 자라는 시간(비료 없을 때)에 심음 → 비료가 있어도 다 자람.
const CELL = { C: ["당근", true], c: ["당근", false], P: ["감자", true], p: ["감자", false] };
export function farmSetup(rows, { pie = { x: 0, y: 0 }, clock = 0, store = {}, upgrades = [] } = {}) {
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
  return { size, cells, pie: { ...pie }, clock, store: { 당근: 0, 감자: 0, ...store }, upgrades: [...upgrades] };
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
];
