// v0.10 작업 3: 파이의 텃밭 상태·주문·성장·저장·보상 (설계서 §4)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newGarden, fillGarden, cleanGarden, runInput, applyRun, currentOrder, deliver, canBuy, buy, settle, settleAll,
  grantOrderXP, passedChapters, ORDER_XP, MSG, farmConsistent, runFiles, noteCounts, JOURNAL_MAX,
} from "../../src/garden/state.js";
import { CROPS, UPGRADES, ORDERS, DAILY_NOTES, farmSetup } from "../../data/garden.js";
import { NODES, unlockedKinds, validate, defaultProgram, newNode, kindsUsed, codegen, COND_LOCKS } from "../../src/garden/nodes.js";
import { newSave, migrate } from "../../src/save.js";

const ALL = new Set([1, 2, 3, 4, 5]);
const upTo = (n) => new Set(Array.from({ length: n }, (_, i) => i + 1));
const NOW = (d, h = 20) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00`);
const orderIdx = (kind) => ORDERS.findIndex((o) => o.goal.type === kind);
const at = (g, idx) => ({ ...g, order: { ...g.order, idx, done: ORDERS.slice(0, idx).map((o) => o.id) } });

// runner 결과 흉내: 끝 상태(over)에 맞는 사건을 만들어 준다(applyRun의 일관성 검사를 통과하는 결과).
//   over.pie → 이동 사건 하나, over.store(절댓값) → 늘어난 만큼 수확 사건, 행동 수(extra.farm.actions)·시계(over.clock)는
//   빈 칸 수확 사건으로 채운다. extra.farm.stopped·extra.error는 그대로 얹는다.
function fakeResult(garden, over = {}, extra = {}) {
  const st = runInput(garden);
  const pie = over.pie || st.pie;
  const store = { ...st.store, ...(over.store || {}) };
  const events = [];
  if (over.pie) events.push({ t: "move", line: 1, dir: "오른쪽", x: pie.x, y: pie.y });
  for (const [crop, n] of Object.entries(store)) {
    for (let k = st.store[crop] || 0; k < n; k++) events.push({ t: "harvest", line: 1, crop, x: pie.x, y: pie.y });
  }
  const want = extra.farm?.actions ?? (over.clock !== undefined ? over.clock - st.clock : events.length);
  while (events.length < want) events.push({ t: "harvest_empty", line: 1, x: pie.x, y: pie.y });
  return {
    stdout: "", stderr: "", error: null, missing: [], charts: [],
    farm: { events, state: { ...st, pie, clock: st.clock + events.length, store }, stopped: extra.farm?.stopped ?? null, actions: events.length },
    ...(extra.error ? { error: extra.error } : {}),
  };
}

// ---------------------------------------------------------------- 데이터

test("CROPS: runner와 같은 성장 시간(당근 8/6, 감자 12/9, 토마토 10/7)", () => {
  assert.deepEqual(CROPS, { 당근: { grow: 8, fert: 6 }, 감자: { grow: 12, fert: 9 }, 토마토: { grow: 10, fert: 7 } });
});

test("UPGRADES: 4가지, 값과 선행 조건", () => {
  const by = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
  assert.deepEqual(Object.keys(by), ["grid4", "grid5", "감자 씨앗", "비료"]);
  assert.deepEqual(by.grid4.cost, { 당근: 20 });
  assert.deepEqual(by.grid5.cost, { 당근: 40, 감자: 15 });
  assert.equal(by.grid5.needs, "grid4");
  assert.deepEqual(by["감자 씨앗"].cost, { 당근: 10 });
  assert.deepEqual(by["비료"].cost, { 감자: 20 });
  for (const u of UPGRADES) assert.ok(typeof u.label === "string" && u.label.length > 0);
});

test("ORDERS: 29개, 장 순서(need 1..12), 장마다 4·3·3·2·3·1·2·2·2·2·3·2개, XP 5", () => {
  assert.equal(ORDERS.length, 29);
  const needs = ORDERS.map((o) => o.need);
  assert.deepEqual(needs, [...needs].sort((a, b) => a - b));
  const per = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => needs.filter((x) => x === n).length);
  assert.deepEqual(per, [4, 3, 3, 2, 3, 1, 2, 2, 2, 2, 3, 2]);
  assert.equal(new Set(ORDERS.map((o) => o.id)).size, 29);
  for (const o of ORDERS) {
    assert.equal(o.xp, 5);
    assert.ok(["deliver", "run_harvest", "use", "grid", "plant_as_note"].includes(o.goal.type), o.id);
    assert.ok([...o.text].length <= 80, `${o.id} 글자 수`);
    assert.ok(/요[.!?]?$/.test(o.text.trim()), `${o.id} 해요체로 끝남`);
    assert.ok(!/[{}]/.test(o.text), `${o.id} 자리표시 없음`);
    assert.ok(Array.isArray(o.solution));
    assert.ok(o.setup && typeof o.setup === "object", `${o.id} setup`);
  }
});

// v0.11 설계 §2 표: 6~9장 주문 7개
test("ORDERS v0.11: 6~9장 주문 7개의 장·목표(설계 §2)", () => {
  const by = Object.fromEntries(ORDERS.map((o) => [o.id, o]));
  const want = [
    ["o_sayval", 6, "수확 보고", { type: "use", kind: "sayval" }],
    ["o_mix", 7, "섞어 심기", { type: "use", kind: "loopvar:act" }],
    ["o_patrol", 7, "한 바퀴 순찰", { type: "run_harvest", n: 3, kind: "foreach" }],
    ["o_lowstock", 8, "모자란 것만", { type: "use", kind: "cond:store" }],
    ["o_potato_book", 8, "감자 장부", { type: "deliver", crop: "감자", n: 5 }],
    ["o_where", 9, "줄 끝에서 내려가기", { type: "use", kind: "cond:pos" }],
    ["o_zigzag", 9, "지그재그 수확", { type: "run_harvest", n: 9, kind: "where" }],
  ];
  assert.deepEqual(ORDERS.slice(15, 22).map((o) => o.id), want.map((w) => w[0]));
  for (const [id, need, title, goal] of want) {
    assert.ok(by[id], id);
    assert.equal(by[id].need, need, id);
    assert.equal(by[id].title, title, id);
    assert.deepEqual(by[id].goal, goal, id);
  }
  // 섞어 심기: 목록 안의 심기가 목록 변수(crop)를 씀, 순찰: 방향 목록으로 움직임
  const json = (o) => JSON.stringify(o.solution);
  assert.match(codegen(by.o_mix.solution).code, /for crop in \[.*\]:\n\s+(.*\n\s+)*plant\(crop\)/);
  assert.match(codegen(by.o_patrol.solution).code, /for way in \[.*\]:\n(\s+.*\n)*\s+move\(way\)/);
  assert.ok(json(by.o_lowstock).includes('"store"'));
  assert.match(codegen(by.o_zigzag.solution).code, /x, y = where\(\)/);
});

// 노드가 아닌 표지(kindsUsed가 함께 돌려줌)와 그 표지가 열리는 장
const MARK_CHAPTER = { "cond:store": 8, "cond:pos": 9, loopvar: 7, "loopvar:act": 7, "crop:토마토": 10,
  "readnote:농장일지.txt": 11, "readnote:주문서.txt": 11, "readnote:손글씨주문.txt": 11, "findall:num": 12, "findall:crop_num": 12,
  "readnote:농장일지.txt:used": 11, "findall:num:used": 12 };

test("ORDERS: 다섯 가지 목표 종류를 모두 씀, use 주문은 그 장에서 열리는 노드(또는 표지)", () => {
  const kinds = new Set(ORDERS.map((o) => o.goal.type));
  assert.deepEqual([...kinds].sort(), ["deliver", "grid", "plant_as_note", "run_harvest", "use"]);
  for (const o of ORDERS.filter((x) => x.goal.type === "use" || x.goal.kind)) {
    const ch = NODES[o.goal.kind]?.chapter ?? MARK_CHAPTER[o.goal.kind];
    assert.ok(ch, `${o.id}: 노드 종류 또는 표지`);
    assert.ok(ch <= o.need, `${o.id}: need 안에서 열림`);
  }
  assert.equal(COND_LOCKS["cond:store"], MARK_CHAPTER["cond:store"]);
});

test("ORDERS: 정답 프로그램은 그 장까지 열린 노드만으로 검사 통과, use·kind 주문은 그 노드(표지)를 씀", () => {
  for (const o of ORDERS) {
    const errs = validate(o.solution, unlockedKinds(upTo(o.need)));
    assert.deepEqual(errs, [], o.id);
    if (o.goal.type === "use" || o.goal.kind) assert.ok(kindsUsed(o.solution).has(o.goal.kind), o.id);
  }
});

test("ORDERS: 정답 프로그램은 한 장 앞까지 열린 노드로는 검사에 걸림(그 장에서 배운 것을 씀, 6장부터)", () => {
  for (const o of ORDERS.filter((x) => x.need >= 6 && x.goal.type !== "deliver")) {
    assert.ok(validate(o.solution, unlockedKinds(upTo(o.need - 1))).length > 0, o.id);
  }
});

test("주문 use 표지: 창고 조건(cond:store)은 그 조건을 쓴 노드 모드 실행만", () => {
  const i = ORDERS.findIndex((o) => o.id === "o_lowstock");
  const o = ORDERS[i];
  const g = at(newGarden(), i);
  const base = { program: o.solution, mode: "nodes", passed: upTo(9) };
  assert.equal(applyRun(g, fakeResult(g), base).orderDone.id, o.id);
  const plainIf = [{ id: 1, kind: "if", args: { cond: "here_empty" }, body: [newNode("plant", 2)] }];
  assert.equal(applyRun(g, fakeResult(g), { ...base, program: plainIf }).orderDone, null, "창고 조건 없음");
  assert.equal(applyRun(g, fakeResult(g), { ...base, mode: "code" }).orderDone, null, "코드 모드");
  assert.equal(applyRun(g, fakeResult(g), { ...base, passed: upTo(7) }).orderDone, null, "8장 전에는 기다림");
});

// ---------------------------------------------------------------- 새 텃밭·저장

test("newGarden: 설계서 §4 모양", () => {
  const g = newGarden();
  assert.equal(g.v, 1);
  assert.equal(g.size, 3);
  assert.equal(g.cells.length, 9);
  const planted = g.cells.filter(Boolean);
  assert.equal(planted.length, 3);
  assert.ok(planted.every((c) => c.crop === "당근"));
  const ripe = planted.filter((c) => g.clock - c.planted_at >= CROPS.당근.grow);
  assert.ok(ripe.length >= 1 && ripe.length < 3, "일부만 다 자람");
  assert.deepEqual(g.pie, { x: 0, y: 0 });
  assert.equal(g.clock, 0);
  assert.deepEqual(g.store, { 당근: 0, 감자: 0, 토마토: 0 });
  assert.equal(g.seeds, 5);
  assert.deepEqual(g.files, { "농장일지.txt": "" });
  assert.deepEqual(g.upgrades, []);
  assert.deepEqual(g.order, { idx: 0, done: [], paid: [] });
  assert.deepEqual(g.program, defaultProgram());
  assert.equal(g.code, "");
  assert.equal(g.mode, "nodes");
  assert.equal(g.runs, 0);
});

test("newGarden: 시작 프로그램(오른쪽 이동 → 수확)이 첫 주문을 해냄", () => {
  const g = newGarden();
  const i = g.pie.y * g.size + ((g.pie.x + 1) % g.size);
  assert.ok(g.cells[i] && g.clock + 1 - g.cells[i].planted_at >= CROPS.당근.grow, "오른쪽 칸이 1틱 뒤 다 자람");
});

test("newGarden: 부를 때마다 새 객체", () => {
  const a = newGarden();
  a.cells[0] = { crop: "감자", planted_at: 0 };
  a.store.당근 = 9;
  const b = newGarden();
  assert.equal(b.cells[0], null);
  assert.equal(b.store.당근, 0);
});

test("newSave에 garden 기본값, saveVer 2 그대로", () => {
  const s = newSave();
  assert.equal(s.saveVer, 2);
  assert.deepEqual(s.garden, newGarden());
});

test("옛 저장(garden 없음) → migrate가 기본 텃밭으로 채움", () => {
  const s = migrate({ saveVer: 2, xp: 40, completed_lessons: ["1-1"] });
  assert.equal(s.saveVer, 2);
  assert.equal(s.xp, 40);
  assert.deepEqual(s.garden, newGarden());
  assert.deepEqual(fillGarden({ xp: 3 }).garden, newGarden());
});

test("fillGarden/migrate: 고장 난 칸만 고치고 나머지는 남김", () => {
  const g = newGarden();
  const raw = {
    ...g,
    v: "x",
    size: 7,                        // 성장과 안 맞음 → 업그레이드에서 다시 셈
    cells: [null, { crop: "수박", planted_at: 1 }, { crop: "당근", planted_at: "a" }, 5],
    pie: { x: 9, y: -1 },
    clock: -4,
    store: { 당근: 5.7, 감자: -2, 수박: 3 },
    upgrades: ["grid5", "감자 씨앗", "감자 씨앗", "몰라"], // grid5는 grid4 없이 못 가짐
    order: { idx: 99, done: ["o_first", "zzz", "o_first"], paid: "x" },
    program: "망가짐",
    code: 7,
    mode: "춤",
    runs: -1,
  };
  const out = fillGarden({ garden: raw }).garden;
  assert.equal(out.v, 1);
  assert.equal(out.size, 3);
  assert.equal(out.cells.length, 9);
  assert.deepEqual(out.cells.slice(0, 4), [null, null, null, null]);
  assert.deepEqual(out.pie, { x: 0, y: 0 });
  assert.equal(out.clock, 0);
  assert.deepEqual(out.store, { 당근: 5, 감자: 0, 토마토: 0 });
  assert.deepEqual(out.upgrades, ["감자 씨앗"]);
  assert.equal(out.order.idx, ORDERS.length);
  assert.deepEqual(out.order.paid, []);
  assert.deepEqual(out.program, defaultProgram());
  assert.equal(out.code, "");
  assert.equal(out.mode, "nodes");
  assert.equal(out.runs, 0);
  // migrate도 같은 정리
  assert.deepEqual(migrate({ garden: raw }).garden, out);
});

test("fillGarden: 정상 값은 그대로(4×4, 음수 planted_at, 노드 프로그램, 코드 모드)", () => {
  const g = newGarden();
  g.upgrades = ["grid4", "비료"];
  g.size = 4;
  g.cells = Array(16).fill(null);
  g.cells[5] = { crop: "당근", planted_at: -8 };
  g.pie = { x: 3, y: 2 };
  g.clock = 120;
  g.order = { idx: 3, done: ORDERS.slice(0, 3).map((o) => o.id), paid: [ORDERS[0].id] };
  g.program = [newNode("repeat", 1)];
  g.program[0].body = [newNode("harvest", 2)];
  g.code = "harvest()\n";
  g.mode = "code";
  g.runs = 12;
  assert.deepEqual(fillGarden({ garden: structuredClone(g) }).garden, g);
  assert.deepEqual(cleanGarden(structuredClone(g)), g);
});

test("cleanGarden: 저장된 크기와 성장이 다르면 크기는 성장에서, 칸은 저장된 크기로 (x,y)를 읽음", () => {
  const g = newGarden();
  // 4×4로 저장됐지만 성장이 없음 → 3×3, (1,1)의 당근은 (1,1) 그대로
  const cells4 = Array(16).fill(null);
  cells4[1 * 4 + 1] = { crop: "당근", planted_at: 3 };
  cells4[3 * 4 + 3] = { crop: "감자", planted_at: 4 }; // 밭 밖으로 나감
  const a = cleanGarden({ ...g, size: 4, cells: cells4, upgrades: [] });
  assert.equal(a.size, 3);
  assert.deepEqual(a.cells[1 * 3 + 1], { crop: "당근", planted_at: 3 });
  assert.equal(a.cells.filter(Boolean).length, 1);
  // 3×3으로 저장됐지만 grid4를 가짐 → 4×4, (2,2)는 (2,2)
  const cells3 = Array(9).fill(null);
  cells3[2 * 3 + 2] = { crop: "당근", planted_at: 5 };
  cells3[0 * 3 + 2] = { crop: "당근", planted_at: 6 };
  const b = cleanGarden({ ...g, size: 3, cells: cells3, upgrades: ["grid4"] });
  assert.equal(b.size, 4);
  assert.equal(b.cells.length, 16);
  assert.deepEqual(b.cells[2 * 4 + 2], { crop: "당근", planted_at: 5 });
  assert.deepEqual(b.cells[0 * 4 + 2], { crop: "당근", planted_at: 6 });
  assert.equal(b.cells.filter(Boolean).length, 2);
  // 크기가 이상하면 성장으로 센 크기로 읽음
  assert.deepEqual(cleanGarden({ ...g, size: "x", cells: cells3, upgrades: [] }).cells, cells3);
});

test("cleanGarden: 노드 모양이 이상하면 시작 프로그램으로", () => {
  const g = newGarden();
  for (const bad of [[{ kind: "춤", id: 1, args: {} }], [{ kind: "move" }], [null], [{ id: 1, kind: "repeat", args: { n: 2 }, body: "x" }],
    [{ id: 1, kind: "move", args: { dir: "위" } }, { id: 1, kind: "harvest", args: {} }]]) {
    assert.deepEqual(cleanGarden({ ...g, program: bad }).program, defaultProgram(), JSON.stringify(bad));
  }
});

test("cleanGarden: 목록에서 하나씩의 목록이 이상하면 그 목록만 기본 목록으로(v0.11 검토)", () => {
  const g = newGarden();
  const fe = (list) => [{ id: 1, kind: "foreach", args: { list }, body: [{ id: 2, kind: "harvest", args: {} }] }];
  const CROP_DEF = { type: "crop", items: ["당근", "감자"] };
  const DIR_DEF = { type: "dir", items: ["오른쪽", "아래"] };
  // 종류부터 이상하면 작물 기본 목록, 종류가 맞으면 그 종류의 기본 목록
  for (const [bad, want] of [
    [undefined, CROP_DEF], [null, CROP_DEF], ["당근", CROP_DEF], [{ type: "수박", items: ["당근"] }, CROP_DEF],
    [{ type: "crop" }, CROP_DEF], [{ type: "crop", items: [] }, CROP_DEF], [{ type: "crop", items: "당근" }, CROP_DEF],
    [{ type: "crop", items: ["당근", "위"] }, CROP_DEF], [{ type: "crop", items: Array(7).fill("당근") }, CROP_DEF],
    [{ type: "dir", items: ["당근"] }, DIR_DEF], [{ type: "dir", items: [] }, DIR_DEF],
  ]) {
    const out = cleanGarden({ ...g, program: fe(bad) }).program;
    assert.equal(out.length, 1, JSON.stringify(bad));
    assert.deepEqual(out[0].args.list, want, JSON.stringify(bad));
    assert.deepEqual(out[0].body, [{ id: 2, kind: "harvest", args: {} }]);
  }
  // 안쪽 목록도, 맞는 목록은 그대로(여분 칸은 버림), 원본은 그대로
  const inner = { id: 3, kind: "foreach", args: { list: { type: "dir", items: ["위", "왼쪽", "위", "위", "위", "위"], extra: 1 } }, body: [{ id: 4, kind: "move", args: { dir: { loopVar: true } } }] };
  const raw = { ...g, program: [{ id: 1, kind: "repeat", args: { n: 2 }, body: [inner, { id: 5, kind: "foreach", args: { list: { type: "dir", items: [9] } }, body: [{ id: 6, kind: "harvest", args: {} }] }] }] };
  const before = JSON.stringify(raw);
  const out = cleanGarden(raw).program;
  assert.deepEqual(out[0].body[0].args.list, { type: "dir", items: ["위", "왼쪽", "위", "위", "위", "위"] });
  assert.deepEqual(out[0].body[1].args.list, DIR_DEF);
  assert.equal(JSON.stringify(raw), before);
});

// ---------------------------------------------------------------- 실행 입력·반영

test("runInput: runner에 넘길 상태(사본)", () => {
  const g = newGarden();
  const inp = runInput(g);
  assert.deepEqual(Object.keys(inp).sort(), ["cells", "clock", "pie", "seeds", "size", "store", "tomato_ok", "upgrades"]);
  assert.equal(inp.seeds, 5);
  inp.cells[0] = { crop: "감자", planted_at: 0 };
  inp.store.당근 = 99;
  assert.equal(g.cells[0], null);
  assert.equal(g.store.당근, 0);
});

test("applyRun: 끝 상태를 텃밭에 옮기고 runs+1, 거둔 수", () => {
  const g = at(newGarden(), 1); // 주문 2(말하기)
  const r = fakeResult(g, { clock: 5, pie: { x: 1, y: 0 }, store: { 당근: 2 } });
  const out = applyRun(g, r, { program: defaultProgram(), mode: "nodes", passed: ALL });
  assert.equal(out.garden.clock, 5);
  assert.deepEqual(out.garden.pie, { x: 1, y: 0 });
  assert.deepEqual(out.garden.store, { 당근: 2, 감자: 0, 토마토: 0 });
  assert.equal(out.garden.runs, 1);
  assert.deepEqual(out.harvested, { 당근: 2 });
  assert.equal(out.orderDone, null);
  assert.equal(typeof out.message, "string");
  assert.equal(g.runs, 0, "받은 텃밭은 그대로");
});

test("applyRun: 시간 초과(farm 없음) → 텃밭 그대로, runs만 +1", () => {
  const g = newGarden();
  const out = applyRun(g, { stdout: "", error: { type: "Timeout", line: null, msg: "" } }, { program: defaultProgram(), mode: "nodes", passed: ALL });
  assert.deepEqual({ ...out.garden, runs: 0 }, g);
  assert.equal(out.garden.runs, 1);
  assert.deepEqual(out.harvested, {});
  assert.equal(out.orderDone, null);
  assert.ok(out.message.length > 0);
});

test("주문 run_harvest: 한 번 실행에 n개 이상(작물 지정), 해내면 다음 주문", () => {
  const i = ORDERS.findIndex((o) => o.goal.type === "run_harvest" && o.goal.crop === "당근" && o.goal.n >= 2 && !o.goal.max_actions);
  const o = ORDERS[i];
  const g = at(newGarden(), i);
  const short = applyRun(g, fakeResult(g, { store: { 당근: o.goal.n - 1 } }), { program: [], mode: "code", passed: ALL });
  assert.equal(short.orderDone, null);
  assert.equal(short.garden.order.idx, i);
  const wrongCrop = applyRun(g, fakeResult(g, { store: { 감자: o.goal.n } }), { program: [], mode: "code", passed: ALL });
  assert.equal(wrongCrop.orderDone, null);
  const ok = applyRun(g, fakeResult(g, { store: { 당근: o.goal.n } }), { program: [], mode: "code", passed: ALL });
  assert.equal(ok.orderDone.id, o.id);
  assert.equal(ok.garden.order.idx, i + 1);
  assert.deepEqual(ok.garden.order.done, [...g.order.done, o.id]);
  // 실행 전 창고에 있던 것은 세지 않음(이번 실행에 거둔 것만)
  const g2 = { ...g, store: { 당근: 50, 감자: 0 } };
  assert.equal(applyRun(g2, fakeResult(g2, { store: { 당근: 50 + o.goal.n - 1 } }), { program: [], mode: "code", passed: ALL }).orderDone, null);
});

test("주문 run_harvest: max_actions를 넘기면 실패", () => {
  const i = ORDERS.findIndex((o) => o.goal.type === "run_harvest" && o.goal.max_actions);
  assert.ok(i >= 0, "행동 수 제한 주문이 하나 있음");
  const o = ORDERS[i];
  const g = at(newGarden(), i);
  const crop = o.goal.crop || "당근";
  const opts = { program: o.solution, mode: "nodes", passed: ALL };
  const over = applyRun(g, fakeResult(g, { store: { [crop]: o.goal.n } }, { farm: { actions: o.goal.max_actions + 1 } }), opts);
  assert.equal(over.orderDone, null);
  const ok = applyRun(g, fakeResult(g, { store: { [crop]: o.goal.n } }, { farm: { actions: o.goal.max_actions } }), opts);
  assert.equal(ok.orderDone.id, o.id);
});

test("주문 run_harvest kind: 노드 모드에서 그 노드를 쓴 실행만(o_def_row 부르기, o_all 반복)", () => {
  assert.equal(ORDERS.find((o) => o.id === "o_def_row").goal.kind, "call");
  assert.equal(ORDERS.find((o) => o.id === "o_all").goal.kind, "repeat");
  for (const id of ["o_def_row", "o_all"]) {
    const i = ORDERS.findIndex((o) => o.id === id);
    const o = ORDERS[i];
    const g = at(newGarden(), i);
    const r = () => fakeResult(g, { store: { [o.goal.crop]: o.goal.n } });
    assert.equal(applyRun(g, r(), { program: o.solution, mode: "nodes", passed: ALL }).orderDone?.id, o.id, id);
    assert.equal(applyRun(g, r(), { program: o.solution, mode: "code", passed: ALL }).orderDone, null, `${id} 코드 모드`);
    assert.equal(applyRun(g, r(), { program: [newNode("harvest", 1)], mode: "nodes", passed: ALL }).orderDone, null, `${id} 그 노드 없음`);
  }
  // kind 없는 run_harvest는 코드 모드도 됨
  const i = ORDERS.findIndex((o) => o.id === "o_row");
  const g = at(newGarden(), i);
  assert.equal(applyRun(g, fakeResult(g, { store: { 당근: 3 } }), { program: [], mode: "code", passed: ALL }).orderDone.id, "o_row");
});

test("o_all 글은 밭 크기를 못 박지 않는다(5×5를 가졌을 수 있음)", () => {
  const o = ORDERS.find((x) => x.id === "o_all");
  assert.ok(!/\d×\d/.test(o.text), o.text);
  assert.match(o.text, /밭 전체/);
});

// ---------------------------------------------------------------- 실행 결과 일관성(검토 C62 I1)

test("applyRun: 규칙에 맞지 않는 결과는 받지 않음(텃밭 그대로·runs+1·주문 판정 없음)", () => {
  const i = ORDERS.findIndex((o) => o.id === "o_row");
  const base = { ...at(newGarden(), i), clock: 20 };
  base.cells = base.cells.map(() => null);
  base.cells[0] = { crop: "당근", planted_at: 0 };
  const good = () => fakeResult(base, { store: { 당근: 3 }, pie: { x: 1, y: 0 } });
  const tamper = {
    "창고만 늘림": (r) => { r.farm.state.store.당근 = 99; },
    "수확 사건 없이 감자": (r) => { r.farm.state.store.감자 = 1; },
    "창고가 줄어듦": (r) => { r.farm.events.pop(); r.farm.events.push({ t: "harvest_empty", line: 1, x: 1, y: 0 }); },
    "사건 없는 칸 바뀜": (r) => { r.farm.state.cells[8] = { crop: "당근", planted_at: -100 }; },
    "칸의 심은 때만 바꿈": (r) => { r.farm.state.cells[0] = { crop: "당근", planted_at: -50 }; },
    "다른 자리의 사건": (r) => { r.farm.state.cells[8] = { crop: "당근", planted_at: 3 }; r.farm.events.push({ t: "say", line: 1, text: "x" }); },
    "시계 앞당김": (r) => { r.farm.state.clock += 100; },
    "시계 되돌림": (r) => { r.farm.state.clock = 0; },
    "파이 순간 이동": (r) => { r.farm.state.pie = { x: 2, y: 2 }; },
    "행동 수 줄임": (r) => { r.farm.actions = 1; },
    "크기 바꿈": (r) => { r.farm.state.size = 4; r.farm.state.cells = Array(16).fill(null); },
    "nan 창고": (r) => { r.farm.state.store.당근 = NaN; },
  };
  assert.ok(farmConsistent(runInput(base), good().farm), "흉내 결과는 맞음");
  assert.equal(applyRun(base, good(), { program: [], mode: "code", passed: ALL }).orderDone.id, "o_row");
  for (const mode of ["code", "nodes"]) {
    for (const [why, fn] of Object.entries(tamper)) {
      const r = good();
      fn(r);
      assert.equal(farmConsistent(runInput(base), r.farm), false, why);
      const out = applyRun(base, r, { program: [newNode("harvest", 1)], mode, passed: ALL });
      assert.deepEqual({ ...out.garden, runs: base.runs }, base, `${mode} ${why}: 텃밭 그대로`);
      assert.equal(out.garden.runs, base.runs + 1);
      assert.equal(out.orderDone, null, why);
      assert.deepEqual(out.harvested, {});
      assert.equal(out.message, MSG.tampered);
      assert.equal(out.rejected, true);
    }
  }
  assert.equal(MSG.tampered, "파이가 텃밭 규칙에 맞지 않는 결과를 받았어요. 코드는 텃밭 명령으로만 움직여요.");
});

test("applyRun: 사건으로 설명되는 칸 바뀜은 받음(심기·수확·덜 자람)", () => {
  const g = { ...newGarden(), clock: 10 };
  const st = runInput(g);
  const events = [
    { t: "move", line: 1, dir: "오른쪽", x: 1, y: 0 },
    { t: "harvest", line: 2, crop: "당근", x: 1, y: 0 },
    { t: "plant", line: 3, crop: "당근", x: 1, y: 0 },
    { t: "move", line: 4, dir: "아래", x: 1, y: 1 },
    { t: "harvest_young", line: 5, crop: "당근", x: 1, y: 1 },
    { t: "say", line: 6, text: "끝" },
  ];
  const cells = st.cells.slice();
  cells[1] = { crop: "당근", planted_at: 12 };
  cells[4] = null;
  const r = { error: null, farm: { events, state: { ...st, cells, pie: { x: 1, y: 1 }, clock: 15, store: { 당근: 1, 감자: 0, 토마토: 0 } }, stopped: null, actions: 5 } };
  const out = applyRun(g, r, { program: [], mode: "code", passed: ALL });
  assert.notEqual(out.rejected, true);
  assert.deepEqual(out.harvested, { 당근: 1 });
  assert.deepEqual(out.garden.cells[1], { crop: "당근", planted_at: 12 });
  assert.equal(out.garden.clock, 15);
});

test("applyRun: 기다리다 멈춤(waited)은 시간이 움직일 때만 흐른다고 알려 줌", () => {
  const g = newGarden();
  const out = applyRun(g, fakeResult(g, {}, { farm: { stopped: "waited" } }), { program: [], mode: "code", passed: ALL });
  assert.equal(out.message, "파이가 기다리다 지쳤어요 — 텃밭의 시간은 파이가 움직일 때만 흘러요.");
  assert.equal(MSG.waited, out.message);
  const t = applyRun(g, fakeResult(g, {}, { farm: { stopped: "tired" } }), { program: [], mode: "code", passed: ALL });
  assert.equal(t.message, MSG.tired);
});

test("주문 use: 노드 모드 + 그 노드 사용 + 오류 없음 + 멈춤 없음일 때만", () => {
  const i = ORDERS.findIndex((o) => o.goal.type === "use");
  const o = ORDERS[i];
  const g = at(newGarden(), i);
  const prog = o.solution;
  const base = { program: prog, mode: "nodes", passed: ALL };
  assert.equal(applyRun(g, fakeResult(g), base).orderDone.id, o.id);
  assert.equal(applyRun(g, fakeResult(g), { ...base, mode: "code" }).orderDone, null, "코드 모드는 세지 않음");
  assert.equal(applyRun(g, fakeResult(g), { ...base, program: [newNode("harvest", 1)] }).orderDone, null, "그 노드를 안 씀");
  assert.equal(applyRun(g, fakeResult(g, {}, { error: { type: "ValueError", line: 1, msg: "x" } }), base).orderDone, null, "오류");
  assert.equal(applyRun(g, fakeResult(g, {}, { farm: { stopped: "tired" } }), base).orderDone, null, "지침");
  // kindsUsed를 바로 넘겨도 됨(계획서 인터페이스)
  assert.equal(applyRun(g, fakeResult(g), { kindsUsed: new Set([o.goal.kind]), mode: "nodes", passed: ALL }).orderDone.id, o.id);
});

test("장이 안 열린 주문은 기다림: 판정하지 않고 넘기지도 않음", () => {
  const i = ORDERS.findIndex((o) => o.need === 2);
  const o = ORDERS[i];
  const g = at(newGarden(), i);
  assert.deepEqual(currentOrder(g, upTo(1)), { order: o, waiting: true });
  assert.deepEqual(currentOrder(g, upTo(2)), { order: o, waiting: false });
  const r = applyRun(g, fakeResult(g, { store: { 당근: 99 } }), { program: o.solution, mode: "nodes", passed: upTo(1) });
  assert.equal(r.orderDone, null);
  assert.equal(r.garden.order.idx, i);
  // passed를 안 넘기면 아무 장도 안 연 것으로 본다
  assert.equal(applyRun(at(newGarden(), 0), fakeResult(newGarden(), { store: { 당근: 5 } }), { program: [], mode: "code" }).orderDone, null);
});

test("currentOrder: 다 끝나면 order null", () => {
  const g = { ...newGarden(), order: { idx: ORDERS.length, done: ORDERS.map((o) => o.id), paid: [] } };
  assert.deepEqual(currentOrder(g, ALL), { order: null, waiting: false });
  assert.equal(currentOrder(newGarden(), ALL).order.id, ORDERS[0].id);
});

test("주문 deliver: 창고에서 빼고 다음 주문, 모자라면 그대로", () => {
  const i = orderIdx("deliver");
  const o = ORDERS[i];
  const g = at(newGarden(), i);
  const poor = deliver({ ...g, store: { ...g.store, [o.goal.crop]: o.goal.n - 1 } }, ALL);
  assert.equal(poor.orderDone, null);
  assert.ok(poor.error);
  assert.equal(poor.garden.store[o.goal.crop], o.goal.n - 1);
  const rich = deliver({ ...g, store: { 당근: o.goal.n + 2, 감자: 1 } }, ALL);
  assert.equal(rich.orderDone.id, o.id);
  assert.equal(rich.error, null);
  assert.equal(rich.garden.store[o.goal.crop], 2);
  assert.equal(rich.garden.order.idx, i + 1);
  // 지금 주문이 deliver가 아니거나 장이 안 열렸으면 못 보냄
  assert.ok(deliver(at(newGarden(), 0), ALL).error);
  assert.ok(deliver({ ...g, store: { 당근: 99, 감자: 0 } }, new Set()).error);
});

// ---------------------------------------------------------------- 성장

test("canBuy/buy: 값 빼고 성장 추가, 모자라면 이유", () => {
  const g = { ...newGarden(), store: { 당근: 9, 감자: 0 } };
  const no = canBuy(g, "감자 씨앗");
  assert.equal(no.ok, false);
  assert.match(no.reason, /당근/);
  assert.deepEqual(no.short, { 당근: 1 });
  const fail = buy(g, "감자 씨앗", ALL);
  assert.equal(fail.garden, g);
  assert.ok(fail.error);
  const g2 = { ...g, store: { 당근: 12, 감자: 0 } };
  assert.equal(canBuy(g2, "감자 씨앗").ok, true);
  const r = buy(g2, "감자 씨앗", ALL);
  assert.equal(r.error, null);
  assert.deepEqual(r.garden.store, { 당근: 2, 감자: 0 });
  assert.deepEqual(r.garden.upgrades, ["감자 씨앗"]);
  assert.equal(canBuy(r.garden, "감자 씨앗").ok, false, "두 번은 못 삼");
  assert.equal(canBuy(r.garden, "몰라").ok, false);
});

test("buy grid: 선행 조건, 칸은 (x,y) 그대로, 새 칸은 빈칸, 파이 그대로", () => {
  const g = { ...newGarden(), store: { 당근: 100, 감자: 100 }, pie: { x: 2, y: 1 } };
  assert.equal(canBuy(g, "grid5").ok, false, "4×4 먼저");
  const r4 = buy(g, "grid4", ALL).garden;
  assert.equal(r4.size, 4);
  assert.equal(r4.cells.length, 16);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) assert.deepEqual(r4.cells[y * 4 + x], g.cells[y * 3 + x]);
  for (let y = 0; y < 4; y++) assert.equal(r4.cells[y * 4 + 3], null);
  for (let x = 0; x < 4; x++) assert.equal(r4.cells[12 + x], null);
  assert.deepEqual(r4.pie, { x: 2, y: 1 });
  assert.deepEqual(r4.store, { 당근: 80, 감자: 100 });
  const r5 = buy(r4, "grid5", ALL).garden;
  assert.equal(r5.size, 5);
  assert.equal(r5.cells.length, 25);
  assert.deepEqual(r5.cells[1 * 5 + 1], g.cells[1 * 3 + 1]);
  assert.deepEqual(r5.store, { 당근: 40, 감자: 85 });
  assert.deepEqual(r5.upgrades, ["grid4", "grid5"]);
});

test("주문 grid: 사면 바로 완료, 미리 샀으면 다음 실행·settle에서 완료", () => {
  const i = orderIdx("grid");
  const o = ORDERS[i];
  const id = o.goal.size === 4 ? "grid4" : "grid5";
  const g = { ...at(newGarden(), i), store: { 당근: 100, 감자: 100 }, upgrades: id === "grid5" ? ["grid4"] : [] };
  const r = buy(g, id, ALL);
  assert.equal(r.orderDone.id, o.id);
  assert.equal(r.garden.order.idx, i + 1);
  // 주문 전에 미리 산 경우
  const early = buy(at(g, i - 1), id, ALL).garden;
  const moved = { ...early, order: { ...early.order, idx: i, done: ORDERS.slice(0, i).map((x) => x.id) } };
  assert.equal(settle(moved, ALL).orderDone.id, o.id);
  assert.equal(settle(moved, new Set([1])).orderDone, o.need <= 1 ? settle(moved, ALL).orderDone : null);
  const run = applyRun(moved, fakeResult(moved), { program: [], mode: "code", passed: ALL });
  assert.equal(run.orderDone.id, o.id);
  // 다른 주문일 때 settle은 아무 일 없음
  assert.equal(settle(at(newGarden(), 0), ALL).orderDone, null);
});

test("settleAll: 주문을 해낸 뒤 지금 상태로 끝나는 주문을 이어서 정리(검토 C62 I3)", () => {
  // 감자 주문 차례에 밭 4×4를 미리 샀음 → 감자 주문을 해내면 밭 넓히기 주문도 바로 끝남
  const ip = ORDERS.findIndex((o) => o.id === "o_potato");
  assert.equal(ORDERS[ip + 1].id, "o_grid4");
  let g = { ...at(newGarden(), ip), store: { 당근: 25, 감자: 0 }, upgrades: ["감자 씨앗"] };
  const b = buy(g, "grid4", ALL);
  assert.equal(b.orderDone, null, "감자 주문 차례라 아직");
  g = b.garden;
  const ran = applyRun(g, fakeResult(g, { store: { 감자: 1 } }), { program: [], mode: "code", passed: ALL });
  assert.equal(ran.orderDone.id, "o_potato");
  const chain = settleAll(ran.garden, ALL);
  assert.deepEqual(chain.orders.map((o) => o.id), ["o_grid4"]);
  assert.equal(chain.garden.order.idx, ip + 2);
  assert.deepEqual(chain.garden.order.done.slice(-2), ["o_potato", "o_grid4"]);
  // 더 끝낼 것이 없으면 그대로
  const none = settleAll(chain.garden, ALL);
  assert.deepEqual(none.orders, []);
  assert.equal(none.garden, chain.garden);
  // 다음 주문의 장이 안 열렸으면 멈춤
  assert.deepEqual(settleAll(ran.garden, upTo(2)).orders, []);
  // 보내기 뒤에도 같은 길: o_soup(보내기) 다음은 3장 주문이라 정리할 것 없음
  const is = ORDERS.findIndex((o) => o.id === "o_soup");
  const d = deliver({ ...at(newGarden(), is), store: { 당근: 10, 감자: 0 } }, ALL);
  assert.deepEqual(settleAll(d.garden, ALL).orders, []);
});

// ---------------------------------------------------------------- 보상·장

test("grantOrderXP: XP 5, 하루 목표·연속 기록·XP 퀘스트에 반영, 같은 주문은 한 번만", () => {
  const o = ORDERS[0];
  let s = { ...newSave(), settings: { ...newSave().settings, dailyGoal: 10 }, streak: { ...newSave().streak, todayDate: "2026-11-05", todayXp: 6 } };
  const a = grantOrderXP(s, o, NOW("2026-11-05"));
  assert.equal(ORDER_XP, 5);
  assert.equal(a.result.xp, 5);
  assert.equal(a.save.xp, 5);
  assert.equal(a.save.streak.todayXp, 11);
  assert.equal(a.save.streak.days, 1);
  assert.equal(a.result.streakUp, true);
  assert.deepEqual(a.save.garden.order.paid, [o.id]);
  if (a.save.quests.ids.includes("q_xp20")) assert.equal(a.save.quests.progress.q_xp20, 5);
  assert.equal(a.save.bytes, a.result.questBytes + a.result.milestoneBytes, "바이트는 주문에서 직접 주지 않음");
  const b = grantOrderXP(a.save, o, NOW("2026-11-05"));
  assert.equal(b.result.xp, 0);
  assert.equal(b.save.xp, 5);
  assert.deepEqual(b.save.garden.order.paid, [o.id]);
  assert.equal(s.xp, 0, "받은 저장은 그대로");
  // 다른 주문은 따로
  const c = grantOrderXP(b.save, ORDERS[1], NOW("2026-11-05"));
  assert.equal(c.save.xp, 10);
  // 없는 주문·null은 아무 일 없음
  assert.equal(grantOrderXP(c.save, null, NOW("2026-11-05")).result.xp, 0);
  assert.equal(grantOrderXP(c.save, { id: "zzz", xp: 5 }, NOW("2026-11-05")).result.xp, 0);
});

test("grantOrderXP: garden 없는 옛 저장에도 동작", () => {
  const s = { ...newSave() };
  delete s.garden;
  const r = grantOrderXP(s, ORDERS[0], NOW("2026-11-05"));
  assert.equal(r.save.xp, 5);
  assert.deepEqual(r.save.garden.order.paid, [ORDERS[0].id]);
});

test("passedChapters: 장 평가(isExam, 없으면 마지막 레슨)를 끝낸 장 — 심화 해금과 같은 기준", () => {
  const ch = (n, exam = true) => ({ id: n, lessons: [1, 2, 3, 4, 5].map((k) => ({ id: `${n}-${k}`, isExam: exam && k === 5 })) });
  const chapters = [ch(1), ch(2), ch(3, false)];
  const save = { ...newSave(), completed_lessons: ["1-1", "1-2", "1-3", "1-4", "1-5", "2-1", "3-5"] };
  assert.deepEqual([...passedChapters(save, chapters)].sort(), [1, 3]);
  assert.deepEqual([...passedChapters(newSave(), chapters)], []);
});

test("모든 노드가 어떤 주문에서 가르쳐짐(use 또는 정답 프로그램에 등장)", () => {
  const seen = new Set();
  const walk = (list) => (list || []).forEach((n) => { seen.add(n.kind); walk(n.body); walk(n.orelse); });
  for (const o of ORDERS) walk(o.solution);
  for (const k of Object.keys(NODES)) assert.ok(seen.has(k), k);
});

test("grantOrderXP: 하루 퀘스트 「텃밭 주문 1개 해내기」(garden_order)를 셈, 같은 주문은 다시 세지 않음", () => {
  const today = "2026-11-05";
  const s = { ...newSave(), completed_lessons: ["1-5"],
    quests: { date: today, ids: ["q_garden", "q_lessons2", "q_perfect"], progress: {}, done: [], chest: false } };
  const a = grantOrderXP(s, ORDERS[0], NOW(today));
  assert.deepEqual(a.save.quests.done, ["q_garden"]);
  assert.equal(a.save.quests.progress.q_garden, 1);
  assert.deepEqual(a.result.finished, ["q_garden"]);
  assert.equal(a.result.questBytes, 5);
  const b = grantOrderXP(a.save, ORDERS[0], NOW(today));
  assert.equal(b.result.questBytes, 0);
  assert.deepEqual(b.result.finished, []);
});

// ================================================================ v0.12 (설계 docs/specs/2026-11-05-텃밭-10-17장-설계.md §1~§4)
const J = "농장일지.txt";
const byId = (id) => ORDERS.findIndex((o) => o.id === id);

test("ORDERS v0.12: 10~12장 주문 7개의 장·목표(설계 §3)", () => {
  const want = [
    ["o_tomato", 10, "첫 토마토", { type: "run_harvest", crop: "토마토", n: 1 }],
    ["o_try", 10, "씨앗이 떨어지면", { type: "use", kind: "try" }],
    ["o_note", 11, "주문서대로", { type: "plant_as_note", file: "주문서.txt", kind: "readnote" }],
    ["o_log", 11, "농장일지", { type: "use", kind: "writelog", journal: true }],
    ["o_readlog", 11, "어제 일지 읽기", { type: "use", kind: "readnote:농장일지.txt:used" }],
    ["o_hand", 12, "손글씨 주문", { type: "plant_as_note", file: "손글씨주문.txt", parse: "crop_num", kind: "findall" }],
    ["o_digits", 12, "숫자만 뽑기", { type: "use", kind: "findall:num:used" }],
  ];
  assert.deepEqual(ORDERS.slice(22).map((o) => o.id), want.map((w) => w[0]));
  for (const [id, need, title, goal] of want) {
    const o = ORDERS[byId(id)];
    assert.equal(o.need, need, id);
    assert.equal(o.title, title, id);
    assert.deepEqual(o.goal, goal, id);
  }
  // 쪽지: 주문서대로는 줄마다 「작물 개수」, 손글씨는 작물+숫자 패턴으로 읽힘(토마토 바로 뒤에 숫자)
  const note = ORDERS[byId("o_note")].note;
  assert.equal(note.file, "주문서.txt");
  assert.deepEqual(noteCounts(note.text), { 당근: 2, 감자: 1 });
  const hand = ORDERS[byId("o_hand")].note;
  assert.equal(hand.file, "손글씨주문.txt");
  assert.deepEqual(noteCounts(hand.text, "crop_num"), { 당근: 3, 토마토: 2 });
  assert.equal(ORDERS[byId("o_digits")].note.file, "손글씨주문.txt");
  // 정답 코드: 쪽지 읽기·줄 나누기·int(n) 반복, 일지 쓰기, 패턴 찾기(import re)
  const code = (id) => codegen(ORDERS[byId(id)].solution).code;
  assert.match(code("o_try"), /try:\n[\s\S]*plant\("토마토"\)[\s\S]*except ValueError:/);
  assert.match(code("o_note"), /with open\("주문서.txt"\) as f:\n\s+for line in f:\n\s+crop, n = line.split\(\)\n\s+for i in range\(int\(n\)\):/);
  assert.match(code("o_log"), /with open\("농장일지.txt", "a"\) as f:/);
  assert.match(code("o_readlog"), /with open\("농장일지.txt"\) as f:/);
  assert.match(code("o_hand"), /^import re\n/);
  assert.match(code("o_digits"), /re.findall\(r"\\d\+", line\)/);
});

test("ORDERS v0.12: 쪽지는 받는 쪽지 이름만, plant_as_note는 같은 파일의 쪽지를 가짐", () => {
  for (const o of ORDERS) {
    if (o.note) {
      assert.ok(["주문서.txt", "손글씨주문.txt"].includes(o.note.file), o.id);
      assert.ok(typeof o.note.text === "string" && o.note.text.length > 0 && o.note.text.length <= 200, o.id);
    }
    if (o.goal.type === "plant_as_note") {
      assert.equal(o.note?.file, o.goal.file, o.id);
      const want = noteCounts(o.note.text, o.goal.parse);
      assert.ok(Object.values(want).reduce((a, b) => a + b, 0) > 0, `${o.id} 심을 것이 있음`);
    }
  }
});

test("noteCounts: 줄마다 「작물 개수」(같은 작물은 더함, 모르는 줄은 건너뜀) / crop_num은 작물 바로 뒤 숫자", () => {
  assert.deepEqual(noteCounts("당근 2\n감자 1\n당근 1\n"), { 당근: 3, 감자: 1 });
  assert.deepEqual(noteCounts("수박 2\n\n토마토 3"), { 토마토: 3 });
  assert.deepEqual(noteCounts("리아: 당근3개 부탁! 토마토 2개도~ 감자는 됐어", "crop_num"), { 당근: 3, 토마토: 2 });
  assert.deepEqual(noteCounts("토마토도 2개", "crop_num"), {}, "작물 뒤에 다른 글자가 있으면 안 읽힘(파이썬 패턴과 같음)");
  assert.deepEqual(noteCounts(""), {});
});

test("newGarden/cleanGarden v0.12: 씨앗 5·농장일지 빈 글, 옛 저장(없음)은 기본값, 고장 난 값은 다듬음", () => {
  const old = { ...newGarden() };
  delete old.seeds;
  delete old.files;
  delete old.store.토마토;
  const a = cleanGarden(old);
  assert.equal(a.seeds, 5);
  assert.deepEqual(a.files, { [J]: "" });
  assert.equal(a.store.토마토, 0);
  assert.equal(cleanGarden({ ...newGarden(), seeds: 25 }).seeds, 20);
  assert.equal(cleanGarden({ ...newGarden(), seeds: -3 }).seeds, 0);
  assert.equal(cleanGarden({ ...newGarden(), seeds: 3.7 }).seeds, 3);
  assert.equal(cleanGarden({ ...newGarden(), seeds: "x" }).seeds, 5);
  assert.deepEqual(cleanGarden({ ...newGarden(), files: { [J]: 7, "주문서.txt": "몰래" } }).files, { [J]: "" });
  const long = "가".repeat(10) + "나".repeat(JOURNAL_MAX);
  assert.equal(cleanGarden({ ...newGarden(), files: { [J]: long } }).files[J], "나".repeat(JOURNAL_MAX), "끝 2000자만");
  assert.equal(JOURNAL_MAX, 2000);
  const ok = cleanGarden({ ...newGarden(), seeds: 12, files: { [J]: "수확 4개\n" } });
  assert.equal(ok.seeds, 12);
  assert.deepEqual(ok.files, { [J]: "수확 4개\n" });
  assert.equal(migrate({ garden: old }).garden.seeds, 5);
});

test("cleanGarden v0.12: 시도하기(handler 칸)·쪽지 값 프로그램은 그대로, handler가 이상하면 시작 프로그램", () => {
  const prog = [
    { id: 1, kind: "try", args: {}, body: [{ id: 2, kind: "plant", args: { crop: "토마토" } }],
      handler: [{ id: 3, kind: "plant", args: { crop: "당근" } }] },
    { id: 4, kind: "readnote", args: { file: "주문서.txt" }, body: [
      { id: 5, kind: "splitline", args: {} },
      { id: 6, kind: "repeat", args: { n: { value: "n" } }, body: [{ id: 7, kind: "plant", args: { crop: { noteVar: "crop" } } }] },
    ] },
    { id: 8, kind: "writelog", args: { pre: "끝", var: null, post: "" } },
  ];
  assert.deepEqual(cleanGarden({ ...newGarden(), program: prog }).program, prog);
  const bad1 = structuredClone(prog);
  bad1[0].handler = "x";
  assert.deepEqual(cleanGarden({ ...newGarden(), program: bad1 }).program, defaultProgram());
  const bad2 = structuredClone(prog);
  bad2[2].handler = [];
  assert.deepEqual(cleanGarden({ ...newGarden(), program: bad2 }).program, defaultProgram(), "handler 없는 노드에 handler");
  const bad3 = structuredClone(prog);
  bad3[0].handler = [{ id: 2, kind: "harvest", args: {} }];
  assert.deepEqual(cleanGarden({ ...newGarden(), program: bad3 }).program, defaultProgram(), "id 겹침(handler 안도 셈)");
});

test("runFiles: 지금 주문의 쪽지는 그 파일로, 다른 받는 쪽지는 실행 횟수로 정해지는 오늘의 쪽지, 농장일지는 저장에서", () => {
  assert.equal(DAILY_NOTES["주문서.txt"].length, 4);
  assert.equal(DAILY_NOTES["손글씨주문.txt"].length, 4);
  const g0 = { ...at(newGarden(), 0), runs: 6, files: { [J]: "어제 4개\n" } };
  const f0 = runFiles(g0);
  assert.deepEqual(Object.keys(f0).sort(), ["농장일지.txt", "손글씨주문.txt", "주문서.txt"]);
  assert.equal(f0["주문서.txt"], DAILY_NOTES["주문서.txt"][6 % 4]);
  assert.equal(f0["손글씨주문.txt"], DAILY_NOTES["손글씨주문.txt"][6 % 4]);
  assert.equal(f0[J], "어제 4개\n");
  assert.notEqual(runFiles({ ...g0, runs: 7 })["주문서.txt"], f0["주문서.txt"], "실행마다 바뀜");
  assert.deepEqual(runFiles(g0), f0, "같은 텃밭이면 같은 쪽지");
  const i = byId("o_note");
  const f1 = runFiles({ ...at(newGarden(), i), runs: 6 });
  assert.equal(f1["주문서.txt"], ORDERS[i].note.text);
  assert.equal(f1["손글씨주문.txt"], DAILY_NOTES["손글씨주문.txt"][2]);
  const h = byId("o_hand");
  assert.equal(runFiles(at(newGarden(), h))["손글씨주문.txt"], ORDERS[h].note.text);
  assert.equal(runFiles(at(newGarden(), ORDERS.length))["주문서.txt"], DAILY_NOTES["주문서.txt"][0], "주문을 다 끝내도 쪽지는 있음");
  // 오늘의 쪽지도 같은 규칙으로 읽힘(줄마다 작물 개수 / 작물+숫자)
  for (const t of DAILY_NOTES["주문서.txt"]) assert.ok(Object.keys(noteCounts(t)).length > 0, t);
  for (const t of DAILY_NOTES["손글씨주문.txt"]) assert.ok(Object.keys(noteCounts(t, "crop_num")).length > 0, t);
});

// 토마토 사건으로 만드는 결과(씨앗 봉투 규칙을 지킨 결과 / 꾸민 결과)
function tomatoResult(g, events, seedsOut, extra = {}) {
  const st = runInput(g);
  const cells = st.cells.slice();
  const store = { ...st.store };
  for (const e of events) {
    const i = e.y * st.size + e.x;
    if (e.t === "plant") cells[i] = { crop: e.crop, planted_at: st.clock + events.indexOf(e) };
    if (e.t === "harvest") { cells[i] = null; store[e.crop] += 1; }
  }
  return { error: extra.error ?? null, farm: { events, actions: events.length, stopped: null,
    state: { ...st, cells, store, clock: st.clock + events.length, seeds: seedsOut }, ...(extra.files ? { files: extra.files } : {}) } };
}

const T10 = upTo(10); // 토마토가 열린 학습자(C71 I1)
test("farmConsistent v0.12: 씨앗 = 시작 − 토마토 심기 + 2×다 자란 토마토 거두기(최대 20)", () => {
  const g = { ...newGarden(), cells: Array(9).fill(null), seeds: 2 };
  const P = (x) => ({ t: "plant", line: 1, crop: "토마토", x, y: 0 });
  const ok = tomatoResult(g, [P(0), P(1)], 0);
  assert.ok(farmConsistent(runInput(g, T10), ok.farm));
  assert.equal(farmConsistent(runInput(g, T10), tomatoResult(g, [P(0), P(1)], 1).farm), false, "씨앗 꾸밈");
  assert.equal(farmConsistent(runInput(g, T10), tomatoResult(g, [P(0), P(1), P(2)], 0).farm), false, "봉투가 비었는데 심음");
  assert.equal(farmConsistent(runInput({ ...g, seeds: 0 }, T10), tomatoResult({ ...g, seeds: 0 },
    [{ t: "plant_fail", line: 1, crop: "토마토", x: 0, y: 0, reason: "no_tomato_seed" }], 0).farm), true, "빈 봉투 실패");
  assert.equal(farmConsistent(runInput(g, T10), tomatoResult(g,
    [{ t: "plant_fail", line: 1, crop: "토마토", x: 0, y: 0, reason: "no_tomato_seed" }], 2).farm), false, "씨앗이 있는데 빈 봉투 실패");
  const ripe = { ...g, seeds: 19, cells: [{ crop: "토마토", planted_at: -20 }, { crop: "토마토", planted_at: -20 }, ...Array(7).fill(null)] };
  const H = (x) => ({ t: "harvest", line: 1, crop: "토마토", x, y: 0 });
  assert.ok(farmConsistent(runInput(ripe, T10), tomatoResult(ripe, [H(0), H(1)], 20).farm), "최대 20");
  assert.equal(farmConsistent(runInput(ripe, T10), tomatoResult(ripe, [H(0), H(1)], 23).farm), false);
  assert.ok(farmConsistent(runInput(ripe, T10), tomatoResult(ripe, [H(0), P(0)], 19).farm), "거둔 뒤(20) 심기 −1 = 19");
  assert.equal(farmConsistent(runInput(g, T10), { ...ok.farm, state: { ...ok.farm.state, seeds: "x" } }), false);
});

test("farmConsistent v0.12: 돌려준 파일은 농장일지 하나, 글자, 2000자까지", () => {
  const g = newGarden();
  const base = fakeResult(g).farm;
  assert.ok(farmConsistent(runInput(g), { ...base, files: { [J]: "수확 1개\n" } }));
  assert.ok(farmConsistent(runInput(g), { ...base, files: { [J]: "😀".repeat(JOURNAL_MAX) } }), "글자 수는 코드 포인트로");
  assert.equal(farmConsistent(runInput(g), { ...base, files: { [J]: "가".repeat(JOURNAL_MAX + 1) } }), false);
  assert.equal(farmConsistent(runInput(g), { ...base, files: { [J]: "", "주문서.txt": "몰래" } }), false);
  assert.equal(farmConsistent(runInput(g), { ...base, files: { [J]: 3 } }), false);
  assert.equal(farmConsistent(runInput(g), { ...base, files: "x" }), false);
});

test("applyRun v0.12: 씨앗과 농장일지를 저장, 결과에 일지가 없으면 일지는 그대로", () => {
  const g = { ...newGarden(), cells: Array(9).fill(null), seeds: 3, files: { [J]: "옛 일지\n" } };
  const r = tomatoResult(g, [{ t: "plant", line: 1, crop: "토마토", x: 0, y: 0 }], 2, { files: { [J]: "옛 일지\n새 줄\n" } });
  const out = applyRun(g, r, { program: [], mode: "code", passed: T10 });
  assert.notEqual(out.rejected, true);
  assert.equal(out.garden.seeds, 2);
  assert.deepEqual(out.garden.files, { [J]: "옛 일지\n새 줄\n" });
  assert.deepEqual(g.files, { [J]: "옛 일지\n" }, "받은 텃밭은 그대로");
  const keep = applyRun(g, fakeResult(g), { program: [], mode: "code", passed: T10 });
  assert.deepEqual(keep.garden.files, { [J]: "옛 일지\n" });
  const bad = applyRun(g, { ...r, farm: { ...r.farm, files: { [J]: "x".repeat(3000) } } }, { program: [], mode: "code", passed: T10 });
  assert.equal(bad.rejected, true);
  assert.deepEqual(bad.garden.files, g.files);
});

// 주문서대로·손글씨 주문: 이번 실행의 심기 사건(작물별 개수)이 쪽지와 같을 때만
test("주문 plant_as_note: 심은 작물·개수가 쪽지와 같고, 노드 모드에서 그 노드를 쓰고, 오류·멈춤 없을 때만", () => {
  const i = byId("o_note");
  const o = ORDERS[i];
  const g = { ...at(newGarden(), i), cells: Array(9).fill(null), upgrades: ["감자 씨앗"] };
  const P = (crop, x, y = 0) => ({ t: "plant", line: 1, crop, x, y });
  const base = { program: o.solution, mode: "nodes", passed: upTo(11) };
  const right = tomatoResult(g, [P("당근", 0), P("당근", 1), P("감자", 2)], 5);
  assert.equal(applyRun(g, right, base).orderDone?.id, o.id);
  assert.equal(applyRun(g, tomatoResult(g, [P("당근", 0), P("감자", 2)], 5), base).orderDone, null, "모자람");
  assert.equal(applyRun(g, tomatoResult(g, [P("당근", 0), P("당근", 1), P("감자", 2), P("당근", 0, 1)], 5), base).orderDone, null, "더 심음");
  assert.equal(applyRun(g, right, { ...base, mode: "code" }).orderDone, null, "코드 모드");
  assert.equal(applyRun(g, right, { ...base, program: [newNode("plant", 1)] }).orderDone, null, "쪽지 읽기 없음");
  assert.equal(applyRun(g, { ...right, error: { type: "ValueError", line: 1, msg: "x" } }, base).orderDone, null, "오류");
  assert.equal(applyRun(g, right, { ...base, passed: upTo(10) }).orderDone, null, "11장 전에는 기다림");
  // 손글씨: 작물+숫자 패턴으로 센 개수
  const h = byId("o_hand");
  const gh = { ...at(newGarden(), h), cells: Array(9).fill(null) };
  const rh = tomatoResult(gh, [P("당근", 0), P("당근", 1), P("당근", 2), P("토마토", 0, 1), P("토마토", 1, 1)], 3);
  assert.equal(applyRun(gh, rh, { program: ORDERS[h].solution, mode: "nodes", passed: upTo(12) }).orderDone?.id, "o_hand");
});

test("주문 use journal(농장일지): 일지 쓰기를 쓰고 실행 뒤 일지에 글이 있을 때만", () => {
  const i = byId("o_log");
  const g = at(newGarden(), i);
  const base = { program: ORDERS[i].solution, mode: "nodes", passed: upTo(11) };
  const r = fakeResult(g);
  assert.equal(applyRun(g, { ...r, farm: { ...r.farm, files: { [J]: "수확 0개\n" } } }, base).orderDone?.id, "o_log");
  assert.equal(applyRun(g, { ...r, farm: { ...r.farm, files: { [J]: "" } } }, base).orderDone, null, "빈 일지");
  assert.equal(applyRun(g, r, base).orderDone, null, "일지를 돌려받지 못함");
});

// ---------------------------------------------------------------- v0.12 검토 반영(C71)
import { SEED_PACK } from "../../data/garden.js";
import { SEEDS_MAX } from "../../src/garden/state.js";

test("C71 I1 runInput: tomato_ok는 10장을 통과했을 때만(passed 없으면 false)", () => {
  const g = newGarden();
  assert.equal(runInput(g, upTo(10)).tomato_ok, true);
  assert.equal(runInput(g, upTo(9)).tomato_ok, false);
  assert.equal(runInput(g).tomato_ok, false);
});

test("C71 I1 farmConsistent: 10장 전에는 토마토 심기 사건이 없고, tomato_locked 실패는 10장 전에만", () => {
  const g = { ...newGarden(), cells: Array(9).fill(null), seeds: 3 };
  const P = { t: "plant", line: 1, crop: "토마토", x: 0, y: 0 };
  const L = { t: "plant_fail", line: 1, crop: "토마토", x: 0, y: 0, reason: "tomato_locked" };
  assert.ok(farmConsistent(runInput(g, upTo(10)), tomatoResult(g, [P], 2).farm));
  assert.equal(farmConsistent(runInput(g, upTo(9)), tomatoResult(g, [P], 2).farm), false, "잠겼는데 심음");
  assert.ok(farmConsistent(runInput(g, upTo(9)), tomatoResult(g, [L], 3).farm), "잠김 실패(씨앗 그대로)");
  assert.equal(farmConsistent(runInput(g, upTo(10)), tomatoResult(g, [L], 3).farm), false, "열렸는데 잠김 실패");
  assert.equal(farmConsistent(runInput(g, upTo(9)), tomatoResult(g, [L], 2).farm), false, "잠김 실패에 씨앗이 줄면 안 됨");
  // applyRun도 같은 기준(opts.passed)
  assert.equal(applyRun(g, tomatoResult(g, [P], 2), { program: [], mode: "code", passed: upTo(9) }).rejected, true);
  assert.notEqual(applyRun(g, tomatoResult(g, [L], 3), { program: [], mode: "code", passed: upTo(9) }).rejected, true);
});

test("C71 I3 주문 use journal: 실행 뒤 일지가 보낸 일지와 달라야(길어지거나 2000자에서 바뀜)", () => {
  const i = byId("o_log");
  const base = { program: ORDERS[i].solution, mode: "nodes", passed: upTo(11) };
  const g = { ...at(newGarden(), i), files: { [J]: "수확 3개\n" } };
  const r = fakeResult(g);
  const withJ = (t) => ({ ...r, farm: { ...r.farm, files: { [J]: t } } });
  assert.equal(applyRun(g, withJ("수확 3개\n"), base).orderDone, null, "그대로면 안 됨(앞 실행의 일지)");
  assert.equal(applyRun(g, withJ("수확 3개\n수확 0개\n"), base).orderDone?.id, "o_log");
  const full = "가".repeat(JOURNAL_MAX);
  const gf = { ...g, files: { [J]: full } };
  const rf = fakeResult(gf);
  assert.equal(applyRun(gf, { ...rf, farm: { ...rf.farm, files: { [J]: full } } }, base).orderDone, null, "꽉 찬 일지 그대로");
  assert.equal(applyRun(gf, { ...rf, farm: { ...rf.farm, files: { [J]: full.slice(1) + "\n" } } }, base).orderDone?.id, "o_log", "꽉 찬 일지에 덧붙임");
});

test("C71 C2 씨앗 5개: 당근 5개, 10장 통과 뒤, 봉투 +5(최대 20), 성장 목록에는 들지 않고 여러 번 살 수 있음", () => {
  assert.equal(SEED_PACK.id, "seedpack");
  assert.equal(SEED_PACK.label, "토마토 씨앗 5개");
  assert.deepEqual(SEED_PACK.cost, { 당근: 5 });
  assert.ok(!UPGRADES.some((u) => u.id === "seedpack"));
  const g = { ...newGarden(), seeds: 0, store: { 당근: 12, 감자: 0, 토마토: 0 } };
  assert.equal(canBuy(g, "seedpack", upTo(9)).ok, false, "10장 전");
  assert.match(canBuy(g, "seedpack", upTo(9)).reason, /10장/);
  assert.equal(canBuy(g, "seedpack").ok, false, "passed 없음");
  assert.ok(canBuy(g, "seedpack", upTo(10)).ok);
  const b1 = buy(g, "seedpack", upTo(10));
  assert.equal(b1.error, null);
  assert.equal(b1.garden.seeds, 5);
  assert.equal(b1.garden.store.당근, 7);
  assert.deepEqual(b1.garden.upgrades, g.upgrades, "성장 목록에 넣지 않음");
  const b2 = buy(b1.garden, "seedpack", upTo(10));
  assert.equal(b2.garden.seeds, 10);
  assert.equal(b2.garden.store.당근, 2);
  const short = canBuy(b2.garden, "seedpack", upTo(10));
  assert.equal(short.ok, false);
  assert.deepEqual(short.short, { 당근: 3 });
  // 18개면 20까지만, 20개면 살 수 없음
  const near = { ...g, seeds: 18 };
  assert.equal(buy(near, "seedpack", upTo(10)).garden.seeds, SEEDS_MAX);
  const full = canBuy({ ...g, seeds: SEEDS_MAX }, "seedpack", upTo(10));
  assert.equal(full.ok, false);
  assert.match(full.reason, /가득/);
  // 저장 정리는 seedpack을 성장으로 받지 않음
  assert.deepEqual(cleanGarden({ ...newGarden(), upgrades: ["seedpack"] }).upgrades, []);
});

test("C71 C2 막힌 손글씨 주문: 씨앗 0·밭에 토마토 없음 → 씨앗 5개 사기 → o_hand 정답이 다시 됨", () => {
  const i = byId("o_hand");
  const o = ORDERS[i];
  const g0 = cleanGarden({ ...newGarden(), ...structuredClone(o.setup), seeds: 0,
    order: { idx: i, done: ORDERS.slice(0, i).map((x) => x.id), paid: [] } });
  assert.ok(g0.cells.every((c) => !c || c.crop !== "토마토"));
  const passed = upTo(12);
  const b = buy(g0, "seedpack", passed);
  assert.equal(b.error, null);
  assert.equal(b.garden.seeds, 5);
  // 쪽지(당근 3, 토마토 2)대로 심은 결과(씨앗 5 → 3)를 받으면 주문 완료
  const P = (crop, x, y = 0) => ({ t: "plant", line: 1, crop, x, y });
  const r = tomatoResult(b.garden, [P("당근", 0), P("당근", 1), P("당근", 2), P("토마토", 0, 1), P("토마토", 1, 1)], 3);
  const out = applyRun(b.garden, r, { program: o.solution, mode: "nodes", passed });
  assert.notEqual(out.rejected, true);
  assert.equal(out.orderDone?.id, "o_hand");
});
