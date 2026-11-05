// v0.10 작업 3: 파이의 텃밭 상태·주문·성장·저장·보상 (설계서 §4)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newGarden, fillGarden, cleanGarden, runInput, applyRun, currentOrder, deliver, canBuy, buy, settle, settleAll,
  grantOrderXP, passedChapters, ORDER_XP, MSG, farmConsistent,
} from "../../src/garden/state.js";
import { CROPS, UPGRADES, ORDERS } from "../../data/garden.js";
import { NODES, unlockedKinds, validate, defaultProgram, newNode } from "../../src/garden/nodes.js";
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

test("CROPS: runner와 같은 성장 시간(당근 8/6, 감자 12/9)", () => {
  assert.deepEqual(CROPS, { 당근: { grow: 8, fert: 6 }, 감자: { grow: 12, fert: 9 } });
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

test("ORDERS: 15개, 장 순서(need 1..5), 장마다 4·3·3·2·3개, XP 5", () => {
  assert.equal(ORDERS.length, 15);
  const needs = ORDERS.map((o) => o.need);
  assert.deepEqual(needs, [...needs].sort((a, b) => a - b));
  const per = [1, 2, 3, 4, 5].map((n) => needs.filter((x) => x === n).length);
  assert.deepEqual(per, [4, 3, 3, 2, 3]);
  assert.equal(new Set(ORDERS.map((o) => o.id)).size, 15);
  for (const o of ORDERS) {
    assert.equal(o.xp, 5);
    assert.ok(["deliver", "run_harvest", "use", "grid"].includes(o.goal.type), o.id);
    assert.ok([...o.text].length <= 80, `${o.id} 글자 수`);
    assert.ok(/요[.!?]?$/.test(o.text.trim()), `${o.id} 해요체로 끝남`);
    assert.ok(!/[{}]/.test(o.text), `${o.id} 자리표시 없음`);
    assert.ok(Array.isArray(o.solution));
    assert.ok(o.setup && typeof o.setup === "object", `${o.id} setup`);
  }
});

test("ORDERS: 네 가지 목표 종류를 모두 씀, use 주문은 그 장에서 열리는 노드", () => {
  const kinds = new Set(ORDERS.map((o) => o.goal.type));
  assert.deepEqual([...kinds].sort(), ["deliver", "grid", "run_harvest", "use"]);
  for (const o of ORDERS.filter((x) => x.goal.type === "use")) {
    assert.ok(NODES[o.goal.kind], `${o.id}: 노드 종류`);
    assert.ok(NODES[o.goal.kind].chapter <= o.need, `${o.id}: need 안에서 열림`);
  }
});

test("ORDERS: 정답 프로그램은 그 장까지 열린 노드만으로 검사 통과, use 주문은 그 노드를 씀", () => {
  for (const o of ORDERS) {
    const errs = validate(o.solution, unlockedKinds(upTo(o.need)));
    assert.deepEqual(errs, [], o.id);
    if (o.goal.type === "use") {
      const json = JSON.stringify(o.solution);
      assert.ok(json.includes(`"kind":"${o.goal.kind}"`), o.id);
    }
  }
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
  assert.deepEqual(g.store, { 당근: 0, 감자: 0 });
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
  assert.deepEqual(out.store, { 당근: 5, 감자: 0 });
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

// ---------------------------------------------------------------- 실행 입력·반영

test("runInput: runner에 넘길 상태(사본)", () => {
  const g = newGarden();
  const inp = runInput(g);
  assert.deepEqual(Object.keys(inp).sort(), ["cells", "clock", "pie", "size", "store", "upgrades"]);
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
  assert.deepEqual(out.garden.store, { 당근: 2, 감자: 0 });
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
  const r = { error: null, farm: { events, state: { ...st, cells, pie: { x: 1, y: 1 }, clock: 15, store: { 당근: 1, 감자: 0 } }, stopped: null, actions: 5 } };
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
