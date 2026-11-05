// v0.10 파이의 텃밭: 저장 칸·실행 반영·주문 판정·성장·보상 (순수 함수, 화면 없음)
// 설계: docs/specs/2026-11-05-파이의-텃밭-설계.md §4 · 계획서 작업 3
//
// 저장 save.garden (saveVer 2 그대로, 없거나 망가지면 cleanGarden이 기본값으로 채움):
//   { v:1, size, cells:[null|{crop,planted_at}] (y*size+x), pie:{x,y}, clock, store:{당근,감자}, upgrades:[id…],
//     order:{ idx, done:[주문 id…], paid:[XP를 준 주문 id…] }, program:[노드…], code:"", mode:"nodes"|"code", runs }
//   size는 저장값을 믿지 않고 성장(grid4·grid5)에서 다시 센다. 칸은 저장된 size(맞는 값이면)로 (x,y)를 읽어 옮긴다.
//   order.paid는 XP 지급 기록(grantOrderXP가 같은 주문에 두 번 주지 않게). done은 해낸 주문(판정이 넣음).
//
// v0.12(설계 docs/specs/2026-11-05-텃밭-10-17장-설계.md §2·§4): seeds(토마토 씨앗 봉투, 기본 5, 0..20),
//   files { "농장일지.txt": 끝 2000자 } 추가(saveVer 그대로, 없으면 기본값). 실행할 때 쪽지함은 runFiles가 만든다.
//
// 주문 판정은 지금 주문(order.idx) 하나만 본다. 그 주문의 장(need)을 통과하지 않았으면 기다림(판정·넘김 없음).
// passed(통과한 장 번호 Set)를 넘기지 않으면 아무 장도 통과하지 않은 것으로 본다.
import { CROPS, UPGRADES, ORDERS, DAILY_NOTES, farmSetup, START_ROWS, SEED_PACK } from "../../data/garden.js";
import { NODES, defaultProgram, kindsUsed, cleanList, PATTERNS, LOG_FILE, TOMATO } from "./nodes.js";
import { earnXp } from "../rules.js";
import { ensureQuests, tick } from "../quests.js";
import { checkBadges } from "../badges.js";
import { localDate } from "../today.js";
import { advancedOpen } from "../advanced.js";
import { isDev } from "../devgate.js";

export const GARDEN_VER = 1;
export const ORDER_XP = 5;
export const CODE_MAX = 20000;      // 코드 모드 글자 수(저장 정리 때 자름)
const PROGRAM_NODES_MAX = 200;      // 저장 정리: 노드가 이보다 많거나
const PROGRAM_DEPTH_MAX = 12;       //            이보다 깊으면 시작 프로그램으로
const SAVED_SIZE_MAX = 12;          // 저장된 size를 칸 읽기에 믿는 상한(runner FARM_SIZE_MAX와 같음)
const CROP_LIST = Object.keys(CROPS);
const UP_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
const ORDER_IDS = new Set(ORDERS.map((o) => o.id));
// v0.12 씨앗 봉투·쪽지함(runner FARM_SEEDS_DEFAULT·FARM_SEEDS_MAX·FARM_SEEDS_PER_HARVEST·FARM_JOURNAL_MAX와 같음)
export const SEEDS_DEFAULT = 5;
export const SEEDS_MAX = 20;
const SEEDS_PER_HARVEST = 2;
export const JOURNAL_MAX = 2000;

export const MSG = {
  timeout: "시간이 너무 오래 걸려서 멈췄어요. 끝나지 않는 반복이 있는지 봐요",
  tired: "파이가 지쳤어요. 한 번 실행에 행동은 500번까지예요",
  waited: "파이가 기다리다 지쳤어요 — 텃밭의 시간은 파이가 움직일 때만 흘러요.",
  tampered: "파이가 텃밭 규칙에 맞지 않는 결과를 받았어요. 코드는 텃밭 명령으로만 움직여요.",
  stopped: "파이가 중간에 멈췄어요",
  error: "오류가 나서 그 줄에서 멈췄어요",
  none: "이번 실행에는 거둔 작물이 없어요",
  noDeliver: "지금은 보낼 주문이 없어요",
  waiting: (need) => `${need}장을 끝내면 이어져요`,
  short: (list) => `${list}가 모자라요`,
  owned: "이미 가지고 있어요",
  needs: (label) => `먼저 「${label}」 성장이 필요해요`,
  unknown: "없는 성장이에요",
  seedLocked: (ch) => `${ch}장을 끝내면 살 수 있어요`,
  seedsFull: "씨앗 봉투가 가득 찼어요",
};

// ---- 작은 도구 ----
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v);
const nonNeg = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
const toSet = (v) => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : []));
const amounts = (obj) => Object.entries(obj).map(([crop, n]) => `${crop} ${n}개`).join(", ");
const cpLen = (s) => [...s].length;                                   // 파이썬 글자 수(코드 포인트)
const lastChars = (s, n) => { const a = [...s]; return a.length > n ? a.slice(-n).join("") : s; };
/** 씨앗 수 다듬기(runner _farm_state와 같음): 수가 아니면 기본 5, 소수는 버림, 0..20 */
export function cleanSeeds(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return SEEDS_DEFAULT;
  return Math.max(0, Math.min(SEEDS_MAX, Math.trunc(v)));
}
function cleanFiles(raw) {
  const t = isObj(raw) ? raw[LOG_FILE] : "";
  return { [LOG_FILE]: typeof t === "string" ? lastChars(t, JOURNAL_MAX) : "" };
}

// ---- 새 텃밭 ----
export function newGarden() {
  const f = farmSetup(START_ROWS);
  return {
    v: GARDEN_VER,
    size: f.size, cells: f.cells, pie: f.pie, clock: f.clock, store: f.store, upgrades: f.upgrades,
    seeds: SEEDS_DEFAULT,
    files: { [LOG_FILE]: "" },
    order: { idx: 0, done: [], paid: [] },
    program: defaultProgram(),
    code: "",
    mode: "nodes",
    runs: 0,
  };
}

// ---- 저장 정리 ----
function cleanUpgrades(raw) {
  const out = [];
  for (const id of Array.isArray(raw) ? raw : []) {
    if (typeof id !== "string" || !Object.hasOwn(UP_BY_ID, id) || out.includes(id)) continue;
    out.push(id);
  }
  // 선행 조건이 빠진 성장은 버린다(grid5는 grid4가 있어야)
  return out.filter((id) => !UP_BY_ID[id].needs || out.includes(UP_BY_ID[id].needs));
}

const sizeOf = (upgrades) => Math.max(3, ...upgrades.map((id) => UP_BY_ID[id].size || 0));

function cleanCell(c) {
  if (!isObj(c) || !CROP_LIST.includes(c.crop) || !isInt(c.planted_at)) return null;
  return { crop: c.crop, planted_at: c.planted_at };
}

// from: raw가 쓰인 한 변 칸 수(저장된 size). (x,y)가 같은 칸으로 옮기고 밭 밖은 버린다.
function cleanCells(raw, size, from = size) {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: size * size }, (_, i) => {
    const x = i % size;
    const y = Math.floor(i / size);
    return x < from && y < from ? cleanCell(list[y * from + x]) : null;
  });
}

function cleanPie(raw, size) {
  const p = isObj(raw) ? raw : {};
  const ok = (v) => isInt(v) && v >= 0 && v < size;
  return ok(p.x) && ok(p.y) ? { x: p.x, y: p.y } : { x: 0, y: 0 };
}

function cleanStore(raw) {
  const s = isObj(raw) ? raw : {};
  return Object.fromEntries(CROP_LIST.map((c) => [c, nonNeg(s[c])]));
}

function cleanIds(raw, allowed) {
  const out = [];
  for (const id of Array.isArray(raw) ? raw : []) if (allowed.has(id) && !out.includes(id)) out.push(id);
  return out;
}

function cleanOrder(raw) {
  const o = isObj(raw) ? raw : {};
  const idx = typeof o.idx === "number" && Number.isFinite(o.idx) ? Math.min(ORDERS.length, nonNeg(o.idx)) : 0;
  return { idx, done: cleanIds(o.done, ORDER_IDS), paid: cleanIds(o.paid, ORDER_IDS) };
}

// 노드 모양만 본다(값이 맞는지·빈 칸은 nodes.validate가 화면에서 알려 줌).
function programOk(program) {
  if (!Array.isArray(program)) return false;
  const ids = new Set();
  let count = 0;
  const ok = (list, depth) => {
    if (!Array.isArray(list) || depth > PROGRAM_DEPTH_MAX) return false;
    for (const n of list) {
      if (!isObj(n) || !Object.hasOwn(NODES, n.kind) || !isObj(n.args)) return false;
      if (!(isInt(n.id) || (typeof n.id === "string" && n.id !== "")) || ids.has(n.id)) return false;
      ids.add(n.id);
      if (++count > PROGRAM_NODES_MAX) return false;
      const spec = NODES[n.kind];
      if (spec.body ? !ok(n.body, depth + 1) : n.body !== undefined) return false;
      if (n.orelse !== undefined && (!spec.orelse || !ok(n.orelse, depth + 1))) return false;
      if (spec.handler ? !ok(n.handler, depth + 1) : n.handler !== undefined) return false;   // v0.12 시도하기
    }
    return true;
  };
  return ok(program, 0);
}

// 모양이 맞는 프로그램의 사본. 목록에서 하나씩의 목록이 이상하면(종류·칸 수·값) 그 목록만 기본 목록으로 바꾼다
// (목록 편집 창과 코드 생성이 목록 모양을 믿으므로).
function cleanProgram(program) {
  const fix = (list) => list.map((n) => {
    const out = { ...n, args: n.kind === "foreach" ? { ...n.args, list: cleanList(n.args.list) } : structuredClone(n.args) };
    if (Array.isArray(n.body)) out.body = fix(n.body);
    if (Array.isArray(n.orelse)) out.orelse = fix(n.orelse);
    if (Array.isArray(n.handler)) out.handler = fix(n.handler);
    return out;
  });
  return fix(program);
}

/** 저장의 garden 칸 하나를 모양·범위에 맞춘 새 객체로. 객체가 아니면 새 텃밭 */
export function cleanGarden(raw) {
  if (!isObj(raw)) return newGarden();
  const upgrades = cleanUpgrades(raw.upgrades);
  const size = sizeOf(upgrades);
  const saved = isInt(raw.size) && raw.size >= 1 && raw.size <= SAVED_SIZE_MAX ? raw.size : size;
  return {
    v: GARDEN_VER,
    size,
    cells: cleanCells(raw.cells, size, saved),
    pie: cleanPie(raw.pie, size),
    clock: nonNeg(raw.clock),
    store: cleanStore(raw.store),
    upgrades,
    seeds: cleanSeeds(raw.seeds),
    files: cleanFiles(raw.files),
    order: cleanOrder(raw.order),
    program: programOk(raw.program) ? cleanProgram(structuredClone(raw.program)) : defaultProgram(),
    code: typeof raw.code === "string" ? raw.code.slice(0, CODE_MAX) : "",
    mode: raw.mode === "code" ? "code" : "nodes",
    runs: nonNeg(raw.runs),
  };
}

/** 저장에 garden을 채우거나 고친 새 저장(save.js migrate와 같은 정리) */
export function fillGarden(save) {
  const s = isObj(save) ? save : {};
  return { ...s, garden: cleanGarden(s.garden) };
}

// ---- 실행 ----
const TOMATO_CHAPTER = SEED_PACK.need;   // 토마토가 열리는 장(nodes.MARK_LOCKS crop:토마토와 같음)
/**
 * runner.run(farm=…)에 넘길 상태(사본). passed(통과한 장)로 tomato_ok를 정한다(판정 C71 I1: 10장 전이면 false →
 * runner의 plant("토마토")가 tomato_locked로 실패). passed를 넘기지 않으면 아무 장도 통과하지 않은 것으로 본다.
 */
export function runInput(garden, passed) {
  return {
    size: garden.size,
    cells: garden.cells.map((c) => (c ? { crop: c.crop, planted_at: c.planted_at } : null)),
    pie: { x: garden.pie.x, y: garden.pie.y },
    clock: garden.clock,
    // 작물 칸은 runner처럼 늘 셋 다(v0.12 토마토 — 손으로 만든 옛 모양 창고도 같은 결과 모양이 되게)
    store: Object.fromEntries(CROP_LIST.map((c) => [c, garden.store?.[c] ?? 0])),
    upgrades: [...garden.upgrades],
    seeds: cleanSeeds(garden.seeds),
    tomato_ok: toSet(passed).has(TOMATO_CHAPTER),
  };
}

// ---- 쪽지함(v0.12) ----
const NOTE_RE = { crop_num: () => new RegExp(PATTERNS.crop_num.re, "g") };

/**
 * 쪽지 글에서 작물별 개수. parse 없음: 줄마다 「작물 개수」(파이썬 crop, n = line.split()과 같은 읽기, 모르는 줄은 건너뜀),
 * "crop_num": 패턴 찾기 작물+숫자(nodes.PATTERNS.crop_num, 파이썬 re.findall과 같은 패턴). 같은 작물은 더한다.
 */
export function noteCounts(text, parse) {
  const out = {};
  const add = (crop, n) => {
    if (!Object.hasOwn(CROPS, crop) || !/^\d+$/.test(n)) return;
    out[crop] = (out[crop] || 0) + Number(n);
  };
  const t = typeof text === "string" ? text : "";
  if (parse === "crop_num") {
    for (const m of t.matchAll(NOTE_RE.crop_num())) add(m[1], m[2]);
  } else {
    for (const line of t.split("\n")) {
      const w = line.trim().split(/\s+/);
      if (w.length === 2) add(w[0], w[1]);
    }
  }
  return out;
}

/**
 * 이번 실행의 쪽지함(runner run(…, files=)): 받는 쪽지 주문서.txt·손글씨주문.txt(읽기 전용) + 농장일지.txt(저장에서).
 * 받는 쪽지는 지금 주문에 그 파일의 note가 있으면 그 글, 없으면 오늘의 쪽지 DAILY_NOTES[파일][runs % 4].
 * 받는 쪽지 두 개가 늘 있으므로 검사를 통과한 쪽지 읽기는 FileNotFoundError 없이 돈다.
 */
export function runFiles(garden) {
  const order = ORDERS[garden?.order?.idx] ?? null;
  const k = nonNeg(garden?.runs);
  const out = {};
  for (const [file, list] of Object.entries(DAILY_NOTES)) {
    out[file] = order?.note?.file === file ? order.note.text : list[k % list.length];
  }
  out[LOG_FILE] = cleanFiles(garden?.files)[LOG_FILE];
  return out;
}

const cloneGarden = (g) => structuredClone(g);

function advance(garden, order) {
  const o = garden.order;
  return {
    ...garden,
    order: { idx: o.idx + 1, done: o.done.includes(order.id) ? [...o.done] : [...o.done, order.id], paid: [...o.paid] },
  };
}

/** 지금 주문 { order, waiting }. 다 끝났으면 order null */
export function currentOrder(garden, passed) {
  const order = ORDERS[garden?.order?.idx] ?? null;
  return { order, waiting: !!order && !toSet(passed).has(order.need) };
}

// 지금 주문이 이 실행(또는 지금 상태)으로 끝났나. deliver는 단추로만.
function goalMet(order, garden, run) {
  const g = order.goal;
  switch (g.type) {
    case "grid": return garden.size >= g.size;
    case "run_harvest": {
      if (!run || !run.farm) return false;
      // kind가 있으면 노드 모드에서 그 노드를 쓴 실행만(예: o_all은 반복, o_def_row는 내 노드 부르기)
      if (g.kind && !(run.mode === "nodes" && run.kinds.has(g.kind))) return false;
      const got = g.crop ? run.harvested[g.crop] || 0 : Object.values(run.harvested).reduce((a, b) => a + b, 0);
      return got >= g.n && (!g.max_actions || nonNeg(run.farm.actions) <= g.max_actions);
    }
    case "use":
      if (!(!!run && !!run.farm && run.mode === "nodes" && run.kinds.has(g.kind) && !run.error && run.farm.stopped == null)) return false;
      return !g.journal || journalGrew(run);
    case "plant_as_note": {
      if (!run || !run.farm || run.error || run.farm.stopped != null) return false;
      if (g.kind && !(run.mode === "nodes" && run.kinds.has(g.kind))) return false;
      if (order.note?.file !== g.file) return false;
      const want = noteCounts(order.note.text, g.parse);
      const got = {};
      for (const e of run.farm.events) if (e.t === "plant") got[e.crop] = (got[e.crop] || 0) + 1;
      return CROP_LIST.every((c) => (got[c] || 0) === (want[c] || 0));
    }
    default: return false;
  }
}

// 농장일지 주문(v0.12, 판정 C71 I3): 실행 뒤 일지가 보낸 일지와 달라야 한다 — 더 길어졌거나, 2000자로 꽉 찬 일지가 바뀜.
// (앞 실행이 남긴 일지만으로는 해내지 못하게)
function journalGrew(run) {
  const after = isObj(run.farm.files) ? run.farm.files[LOG_FILE] : undefined;
  if (typeof after !== "string" || after === "" || after === run.journalBefore) return false;
  return cpLen(after) > cpLen(run.journalBefore) || cpLen(after) === JOURNAL_MAX;
}

function judge(garden, passed, run) {
  const { order, waiting } = currentOrder(garden, passed);
  if (!order || waiting || !goalMet(order, garden, run)) return { garden, orderDone: null };
  return { garden: advance(garden, order), orderDone: order };
}

function runMessage(result, farm, harvested) {
  if (!farm) return MSG.timeout;
  if (farm.stopped === "tired") return MSG.tired;
  if (farm.stopped === "waited") return MSG.waited;
  if (farm.stopped) return MSG.stopped;
  const got = Object.fromEntries(Object.entries(harvested).filter(([, n]) => n > 0));
  const head = Object.keys(got).length ? `${amounts(got)}를 거뒀어요` : MSG.none;
  return result && result.error ? `${MSG.error} · ${head}` : head;
}

// ---- 실행 결과 일관성(검토 C62 I1) ----
const TIMED = new Set(["move", "plant", "plant_fail", "harvest", "harvest_young", "harvest_empty"]);
const CELL_EVENTS = new Set(["plant", "harvest", "harvest_young"]);
const sameCell = (a, b) => (a == null && b == null) || (!!a && !!b && a.crop === b.crop && a.planted_at === b.planted_at);
const cellShapeOk = (c) => c === null || (isObj(c) && CROP_LIST.includes(c.crop) && isInt(c.planted_at));

/**
 * runner 결과(result.farm)가 보낸 상태(input = runInput)와 사건만으로 설명되나.
 * (v0.12) 씨앗 봉투: 사건 순서대로 토마토 심기 −1(봉투가 비었으면 그런 심기는 없음), 토마토 수확 +2(최대 20),
 *   빈 봉투 실패(no_tomato_seed)는 봉투가 0일 때만. 돌려준 파일은 농장일지 하나뿐이고 2000자까지.
 *   (C71 I1) input.tomato_ok가 false면 토마토 심기 사건이 없어야 하고, 잠김 실패(tomato_locked)는 그때만.
 * 코드 모드의 학습자 코드는 닫힘(__closure__)으로 엔진 상태를 바로 바꿀 수 있으므로 끝 상태를 그대로 믿지 않는다:
 *   - 크기는 그대로, 창고는 작물마다 「harvest 사건 수」만큼만 늘어남
 *   - 바뀐 칸마다 그 (x,y)에 심기·수확·덜 자람 사건이 있음
 *   - 시계 = 보낸 시계 + 시간 1짜리 사건 수, 행동 수(actions) = 시간 1짜리 사건 수
 *   - 파이 = 마지막 이동 사건의 자리(이동이 없으면 그대로)
 * runner는 시간 1짜리 사건을 하나도 버리지 않으므로(말풍선만 100개 상한) 정직한 실행은 언제나 맞는다.
 */
export function farmConsistent(input, farm) {
  if (!isObj(farm) || !isObj(farm.state) || !Array.isArray(farm.events)) return false;
  const st = farm.state;
  const size = input.size;
  if (st.size !== size) return false;
  let timed = 0;
  let pie = { x: input.pie.x, y: input.pie.y };
  const got = {};
  const touched = new Set();
  let seeds = cleanSeeds(input.seeds);
  for (const e of farm.events) {
    if (!isObj(e)) return false;
    if (e.t === "say") continue;
    if (!TIMED.has(e.t)) return false;
    timed += 1;
    if (e.t === "move") {
      if (!isInt(e.x) || !isInt(e.y)) return false;
      pie = { x: e.x, y: e.y };
    }
    if (CELL_EVENTS.has(e.t)) {
      if (!isInt(e.x) || !isInt(e.y) || !CROP_LIST.includes(e.crop)) return false;
      touched.add(e.y * size + e.x);
    }
    if (e.t === "harvest") got[e.crop] = (got[e.crop] || 0) + 1;
    if (e.crop === TOMATO) {
      // 10장 전(input.tomato_ok false, 판정 C71 I1): 토마토 심기는 없고 tomato_locked 실패만. 열렸으면 그 실패는 없음
      if (e.t === "plant_fail" && e.reason === "tomato_locked" && input.tomato_ok !== false) return false;
      if (e.t === "plant" && input.tomato_ok === false) return false;
      if (e.t === "plant") { if (seeds <= 0) return false; seeds -= 1; }
      if (e.t === "harvest") seeds = Math.min(SEEDS_MAX, seeds + SEEDS_PER_HARVEST);
      if (e.t === "plant_fail" && e.reason === "no_tomato_seed" && seeds !== 0) return false;
    }
  }
  if (st.seeds !== seeds) return false;
  if (farm.files !== undefined) {
    if (!isObj(farm.files)) return false;
    const names = Object.keys(farm.files);
    const j = farm.files[LOG_FILE];
    if (names.length !== 1 || typeof j !== "string" || cpLen(j) > JOURNAL_MAX) return false;
  }
  if (st.clock !== input.clock + timed || farm.actions !== timed) return false;
  if (!isObj(st.pie) || st.pie.x !== pie.x || st.pie.y !== pie.y) return false;
  if (!isObj(st.store)) return false;
  for (const c of CROP_LIST) {
    const out = st.store[c];
    if (!isInt(out) || out - (input.store[c] || 0) !== (got[c] || 0)) return false;
  }
  if (!Array.isArray(st.cells) || st.cells.length !== size * size) return false;
  for (let i = 0; i < size * size; i++) {
    const b = st.cells[i] ?? null;
    if (!cellShapeOk(b)) return false;
    if (!sameCell(input.cells[i], b) && !touched.has(i)) return false;
  }
  return true;
}

/**
 * 실행 결과를 텃밭에 반영하고 지금 주문을 판정한다.
 * @param result runner 결과(result.farm 없음 = 시간 초과 등 → 텃밭 그대로, runs만 +1)
 * @param opts { program?, kindsUsed?, mode: "nodes"|"code", passed: Set<장> }
 * @returns { garden, harvested: {작물: n}, orderDone: 주문|null, message, rejected? }
 *   결과가 텃밭 규칙으로 설명되지 않으면(farmConsistent) 노드·코드 모드 모두 받지 않는다:
 *   텃밭은 그대로(runs만 +1), 주문 판정 없음, rejected: true, message = MSG.tampered.
 */
export function applyRun(garden, result, opts = {}) {
  let g = cloneGarden(garden);
  g.runs = nonNeg(g.runs) + 1;
  const farm = result && isObj(result.farm) && isObj(result.farm.state) ? result.farm : null;
  if (!farm) return { garden: g, harvested: {}, orderDone: null, message: MSG.timeout };
  if (!farmConsistent(runInput(garden, opts.passed), farm)) {
    return { garden: g, harvested: {}, orderDone: null, message: MSG.tampered, rejected: true };
  }

  const st = farm.state;
  const before = g.store;
  const journalBefore = cleanFiles(g.files)[LOG_FILE];
  g.cells = cleanCells(st.cells, g.size);
  g.pie = cleanPie(st.pie, g.size);
  g.clock = st.clock;
  g.store = cleanStore(st.store);
  g.seeds = cleanSeeds(st.seeds);
  if (isObj(farm.files)) g.files = cleanFiles(farm.files);
  const harvested = {};
  for (const c of CROP_LIST) if (g.store[c] > before[c]) harvested[c] = g.store[c] - before[c];

  const kinds = opts.kindsUsed !== undefined ? toSet(opts.kindsUsed) : kindsUsed(opts.program || []);
  const run = { farm, harvested, kinds, mode: opts.mode, error: result.error || null, journalBefore };
  const j = judge(g, opts.passed, run);
  return { garden: j.garden, harvested, orderDone: j.orderDone, message: runMessage(result, farm, harvested) };
}

/** 지금 상태만으로 끝나는 주문(미리 산 밭 넓히기)을 정리. 화면을 열 때 부른다 */
export function settle(garden, passed) {
  return judge(garden, passed, null);
}

/**
 * settle을 끝날 때까지 이어서(검토 C62 I3): 주문을 해낸 뒤(실행·보내기·사기) 다음 주문이 이미 이뤄져 있으면
 * (예: 미리 산 밭 넓히기) 그것도 바로 끝낸다. → { garden, orders: [해낸 주문…] } (없으면 받은 garden 그대로)
 */
export function settleAll(garden, passed) {
  let g = garden;
  const orders = [];
  for (let k = 0; k < ORDERS.length; k++) {
    const j = judge(g, passed, null);
    if (!j.orderDone) break;
    g = j.garden;
    orders.push(j.orderDone);
  }
  return { garden: g, orders };
}

// ---- 보내기 ----
/** deliver 주문: 창고에서 빼고 다음 주문. 못 하면 { garden(그대로), orderDone:null, error } */
export function deliver(garden, passed) {
  const { order, waiting } = currentOrder(garden, passed);
  if (!order || order.goal.type !== "deliver") return { garden, orderDone: null, error: MSG.noDeliver };
  if (waiting) return { garden, orderDone: null, error: MSG.waiting(order.need) };
  const { crop, n } = order.goal;
  const have = nonNeg(garden.store[crop]);
  if (have < n) return { garden, orderDone: null, error: MSG.short(amounts({ [crop]: n - have })) };
  const g = cloneGarden(garden);
  g.store[crop] = have - n;
  return { garden: advance(g, order), orderDone: order, error: null };
}

// ---- 성장 ----
const shortOf = (garden, cost) => {
  const short = {};
  for (const [crop, n] of Object.entries(cost)) {
    const have = nonNeg(garden.store?.[crop]);
    if (have < n) short[crop] = n - have;
  }
  return short;
};

/**
 * { ok, reason: 글|null, short: {작물: 모자란 수} }. passed(통과한 장)는 씨앗 5개(SEED_PACK, 10장부터)에만 쓴다.
 * 씨앗 5개는 여러 번 살 수 있고, 봉투가 가득(20)이면 살 수 없다(판정 C71 C2).
 */
export function canBuy(garden, id, passed) {
  if (id === SEED_PACK.id) {
    if (!toSet(passed).has(SEED_PACK.need)) return { ok: false, reason: MSG.seedLocked(SEED_PACK.need), short: {} };
    if (cleanSeeds(garden.seeds) >= SEEDS_MAX) return { ok: false, reason: MSG.seedsFull, short: {} };
    const short = shortOf(garden, SEED_PACK.cost);
    if (Object.keys(short).length) return { ok: false, reason: MSG.short(amounts(short)), short };
    return { ok: true, reason: null, short: {} };
  }
  const up = Object.hasOwn(UP_BY_ID, id) ? UP_BY_ID[id] : null;
  if (!up) return { ok: false, reason: MSG.unknown, short: {} };
  const owned = garden.upgrades || [];
  if (owned.includes(id)) return { ok: false, reason: MSG.owned, short: {} };
  if (up.needs && !owned.includes(up.needs)) return { ok: false, reason: MSG.needs(UP_BY_ID[up.needs].label), short: {} };
  const short = {};
  for (const [crop, n] of Object.entries(up.cost)) {
    const have = nonNeg(garden.store?.[crop]);
    if (have < n) short[crop] = n - have;
  }
  if (Object.keys(short).length) return { ok: false, reason: MSG.short(amounts(short)), short };
  return { ok: true, reason: null, short: {} };
}

function resize(garden, size) {
  const old = garden.size;
  const cells = Array.from({ length: size * size }, (_, i) => {
    const x = i % size;
    const y = Math.floor(i / size);
    return x < old && y < old ? garden.cells[y * old + x] : null;
  });
  return { ...garden, size, cells };
}

/** 성장 사기: 값 빼고 upgrades에 넣음(밭 넓히기는 칸을 (x,y) 그대로 옮김). 밭 넓히기 주문이면 바로 판정 */
export function buy(garden, id, passed) {
  const can = canBuy(garden, id, passed);
  if (!can.ok) return { garden, orderDone: null, error: can.reason };
  if (id === SEED_PACK.id) {
    // 씨앗 5개: 값 빼고 봉투 +5(최대 20). 성장 목록(upgrades)에는 넣지 않음
    const g = cloneGarden(garden);
    for (const [crop, n] of Object.entries(SEED_PACK.cost)) g.store[crop] = nonNeg(g.store[crop]) - n;
    g.seeds = Math.min(SEEDS_MAX, cleanSeeds(g.seeds) + SEED_PACK.seeds);
    const j = judge(g, passed, null);
    return { garden: j.garden, orderDone: j.orderDone, error: null };
  }
  const up = UP_BY_ID[id];
  let g = cloneGarden(garden);
  for (const [crop, n] of Object.entries(up.cost)) g.store[crop] = nonNeg(g.store[crop]) - n;
  g.upgrades = [...g.upgrades, id];
  if (up.size && up.size > g.size) g = resize(g, up.size);
  const j = judge(g, passed, null);
  return { garden: j.garden, orderDone: j.orderDone, error: null };
}

// ---- 보상 ----
/**
 * 주문 XP(5): 레슨·매일 도전과 같은 길(earnXp → 하루 목표·연속 기록·이정표, XP 퀘스트, 배지). 바이트는 주지 않음.
 * 하루 퀘스트 사건 "garden_order"(q_garden)도 1 센다(v0.11).
 * 같은 주문 id에는 한 번만(garden.order.paid). 데이터에 없는 주문이면 아무 일 없음.
 * @returns { save, result: { xp, streakUp, streak, milestone, milestoneBytes, questBytes, finished, chest, newBadges } }
 */
export function grantOrderXP(save, order, now = new Date()) {
  let s = fillGarden(save);
  const known = order && ORDERS.find((o) => o.id === order.id);
  const empty = { xp: 0, streakUp: false, streak: s.streak?.days ?? 0, milestone: null, milestoneBytes: 0,
    questBytes: 0, finished: [], chest: false, newBadges: [] };
  if (!known || s.garden.order.paid.includes(known.id)) return { save: s, result: empty };

  const xp = known.xp ?? ORDER_XP;
  const today = localDate(now);
  s = structuredClone(s);
  s.garden.order.paid = [...s.garden.order.paid, known.id];

  const goalBefore = s.streak.lastGoalDate;
  const bytesBefore = nonNeg(s.bytes);
  const earned = earnXp(s, xp, today);
  s = earned.save;
  const milestoneBytes = nonNeg(s.bytes) - bytesBefore;
  const streakUp = s.streak.lastGoalDate === today && goalBefore !== today;

  s = ensureQuests(s, today);
  const qBefore = s.bytes;
  const q = tick(s, "xp", today, xp);
  // 하루 퀘스트 「텃밭 주문 1개 해내기」(v0.11 설계 §3): 주문을 처음 해낼 때만(위에서 같은 주문은 걸러짐)
  const qg = tick(q.save, "garden_order", today, 1);
  s = qg.save;
  const questBytes = s.bytes - qBefore;
  s.last_active_at = now.toISOString();

  const got = checkBadges(s, { hour: now.getHours(), lessonDone: false, advancedIds: [] });
  s.badges = [...s.badges, ...got];
  const had = new Set(save.badges || []);
  return {
    save: s,
    result: { xp, streakUp, streak: s.streak.days, milestone: earned.milestone, milestoneBytes, questBytes,
      finished: [...q.finished, ...qg.finished], chest: q.chest || qg.chest, newBadges: s.badges.filter((b) => !had.has(b)) },
  };
}

// ---- 장 ----
/** 통과한 장 번호 Set: 장 평가를 끝낸 장(심화 해금 advancedOpen과 같은 기준). 개발자 모드 저장이면 모든 장 */
export function passedChapters(save, chapters) {
  if (isDev(save)) return new Set((chapters || []).map((c) => c.id));
  const completed = (save && save.completed_lessons) || [];
  return new Set((chapters || []).filter((c) => advancedOpen(c, completed)).map((c) => c.id));
}
