// v0.10 작업 2: 파이의 텃밭 노드 표·코드 생성기 (설계 docs/specs/2026-11-05-파이의-텃밭-설계.md 1·3절)
// 노드 종류마다 코드, 들여쓰기·중첩, 줄→노드 표, 빈 body 막기, 잠긴 노드 거부, 불변 편집
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NODES, VAR_NAMES, FUNC_NAMES, COND, condCode, unlockedKinds, codegen, validate,
  newNode, insertNode, moveNode, removeNode, updateArgs, setElse, findNode, countNodes, kindsUsed,
  defaultProgram, MAX_NODES, MAX_DEPTH,
  LIST_TYPES, LIST_ITEMS, LIST_MAX, POS_NAMES, availableValues, loopVarAvailable,
} from "../../src/garden/nodes.js";

// ---- 작은 도우미 ----
let seq = 0;
const N = (kind, args = {}, extra = {}) => {
  const n = { id: `n${++seq}`, kind, args: { ...newNode(kind, 0).args, ...args } };
  if (NODES[kind].body) n.body = extra.body || [];
  if (extra.orelse) n.orelse = extra.orelse;
  if (extra.id) n.id = extra.id;
  return n;
};
const ALL = unlockedKinds(new Set([1, 2, 3, 4, 5]));
const deepFreeze = (o) => {
  if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); }
  return o;
};
const msgs = (errs) => errs.map((e) => e.msg);
const errOn = (errs, id) => errs.filter((e) => e.nodeId === id).map((e) => e.msg);

// ---- 표 ----
test("노드 표: 14종(v0.11 6·7·9장 추가), 장·이름·body·orelse가 설계 표와 같다", () => {
  const want = {
    move: [1, "이동"], harvest: [1, "수확"], plant: [1, "심기"], say: [1, "말하기"],
    setvar: [2, "값 기억하기"], addvar: [2, "값 더하기"],
    if: [3, "만약"], def: [4, "내 노드 만들기"], call: [4, "내 노드 부르기"],
    repeat: [5, "반복"], while: [5, "~하는 동안"],
    sayval: [6, "값 넣어 말하기"], foreach: [7, "목록에서 하나씩"], where: [9, "위치 알기"],
  };
  assert.deepEqual(Object.keys(NODES).sort(), Object.keys(want).sort());
  for (const [k, [ch, label]] of Object.entries(want)) {
    assert.equal(NODES[k].chapter, ch, k);
    assert.equal(NODES[k].label, label, k);
    assert.equal(typeof NODES[k].args, "object", k);
  }
  for (const k of ["if", "def", "repeat", "while"]) assert.equal(NODES[k].body, true, k);
  for (const k of ["move", "harvest", "plant", "say", "setvar", "addvar", "call", "sayval", "where"]) assert.equal(NODES[k].body, false, k);
  assert.equal(NODES.foreach.body, true);
  assert.equal(NODES.foreach.orelse, false);
  assert.equal(NODES.if.orelse, true);
  assert.equal(NODES.repeat.orelse, false);
  assert.deepEqual(NODES.move.args.dir.choices, ["위", "아래", "왼쪽", "오른쪽"]);
  assert.deepEqual(NODES.plant.args.crop.choices, ["당근", "감자"]);
  assert.equal(NODES.say.args.text.max, 20);
  assert.deepEqual([NODES.repeat.args.n.min, NODES.repeat.args.n.max], [1, 25]);
  assert.deepEqual([NODES.setvar.args.value.min, NODES.setvar.args.value.max], [0, 99]);
  assert.deepEqual(VAR_NAMES, ["count", "n", "total"]);
  assert.deepEqual(FUNC_NAMES, ["go_row", "plant_row", "harvest_row", "tend"]);
  assert.equal(MAX_NODES, 60);
  assert.equal(MAX_DEPTH, 4);
});

test("조건 목록과 코드", () => {
  const byId = Object.fromEntries(COND.map((c) => [c.id, c.code]));
  assert.deepEqual(byId, {
    can_harvest: "can_harvest()",
    not_can_harvest: "not can_harvest()",
    here_empty: 'what_here() == "빈칸"',
    here_carrot: 'what_here() == "당근"',
    here_potato: 'what_here() == "감자"',
  });
  for (const c of COND) assert.ok(c.label, c.id);
  assert.equal(condCode("here_empty"), 'what_here() == "빈칸"');
  assert.equal(condCode({ var: "count", op: "<", num: 9 }), "count < 9");
  assert.equal(condCode({ var: "total", op: ">", num: 0 }), "total > 0");
  assert.equal(condCode({ var: "n", op: "==", num: 3 }), "n == 3");
});

test("열린 노드: 통과한 장의 노드만", () => {
  assert.deepEqual([...unlockedKinds(new Set())], []);
  assert.deepEqual([...unlockedKinds(new Set([1]))].sort(), ["harvest", "move", "plant", "say"]);
  assert.deepEqual([...unlockedKinds(new Set([1, 3]))].sort(), ["harvest", "if", "move", "plant", "say"]);
  assert.equal(unlockedKinds(new Set([1, 2, 3, 4, 5])).size, 11);
  assert.equal(unlockedKinds(new Set([1, 2, 3, 4, 5, 6, 7])).size, 13);
  // 8장은 노드가 아니라 창고 조건 표지(cond:store)를 연다
  const u8 = unlockedKinds(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  assert.ok(u8.has("cond:store"));
  assert.equal(u8.size, 14);
  assert.equal(unlockedKinds(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])).size, 15);
  assert.ok(!unlockedKinds(new Set([1, 2, 3, 4, 5, 6, 7, 9])).has("cond:store"));
});

// ---- 기본 노드·시작 프로그램 ----
test("새 노드는 기본값을 갖고, body 노드는 빈 body", () => {
  assert.deepEqual(newNode("move", 7), { id: 7, kind: "move", args: { dir: "오른쪽" } });
  assert.deepEqual(newNode("harvest", 8), { id: 8, kind: "harvest", args: {} });
  assert.deepEqual(newNode("plant", 1).args, { crop: "당근" });
  assert.equal(typeof newNode("say", 1).args.text, "string");
  assert.deepEqual(newNode("setvar", 1).args, { name: "count", value: 0 });
  assert.deepEqual(newNode("addvar", 1).args, { name: "count", value: 1 });
  assert.deepEqual(newNode("repeat", 1), { id: 1, kind: "repeat", args: { n: 3 }, body: [] });
  assert.deepEqual(newNode("if", 1).body, []);
  assert.equal(newNode("if", 1).orelse, undefined);
  assert.equal(newNode("def", 1).args.name, "go_row");
  assert.equal(newNode("call", 1).args.name, "go_row");
  assert.equal(newNode("while", 1).args.cond, "can_harvest");
  // id 만들기 함수도 받는다
  let k = 100;
  assert.equal(newNode("harvest", () => ++k).id, 101);
  assert.throws(() => newNode("fly", 1));
});

test("시작 프로그램: 이동 오른쪽, 수확", () => {
  const p = defaultProgram();
  assert.deepEqual(p.map((n) => [n.kind, n.args]), [["move", { dir: "오른쪽" }], ["harvest", {}]]);
  assert.notEqual(p[0].id, p[1].id);
  const g = codegen(p);
  assert.equal(g.code, 'move("오른쪽")\nharvest()\n');
  assert.deepEqual(g.errors, []);
  assert.deepEqual(validate(p, unlockedKinds(new Set([1]))), []);
});

// ---- 노드마다 코드 ----
test("1장 노드 코드", () => {
  const p = [
    N("move", { dir: "위" }), N("move", { dir: "아래" }), N("move", { dir: "왼쪽" }),
    N("harvest"), N("plant", { crop: "감자" }), N("say", { text: "안녕 파이" }),
  ];
  const g = codegen(p);
  assert.equal(g.code, [
    'move("위")', 'move("아래")', 'move("왼쪽")', "harvest()", 'plant("감자")', 'print("안녕 파이")', "",
  ].join("\n"));
  assert.deepEqual(g.lineMap, { 1: p[0].id, 2: p[1].id, 3: p[2].id, 4: p[3].id, 5: p[4].id, 6: p[5].id });
  assert.deepEqual(g.errors, []);
});

test("말하기 글자는 안전하게 따옴표 처리", () => {
  const cases = [
    ['그가 "안녕"', 'print("그가 \\"안녕\\"")'],
    ["역\\슬래시", 'print("역\\\\슬래시")'],
    ["it's", 'print("it\'s")'],
    ["줄\n바꿈", 'print("줄\\n바꿈")'],
  ];
  for (const [text, line] of cases) assert.equal(codegen([N("say", { text })]).code, line + "\n", text);
});

test("2장 노드 코드", () => {
  const p = [N("setvar", { name: "total", value: 5 }), N("addvar", { name: "total", value: 2 })];
  const g = codegen(p);
  assert.equal(g.code, "total = 5\ntotal = total + 2\n");
  assert.deepEqual(g.errors, []);
});

test("만약·아니면 코드와 줄 표", () => {
  const a = N("harvest"), b = N("plant", { crop: "당근" });
  const i = N("if", { cond: "can_harvest" }, { body: [a], orelse: [b] });
  const g = codegen([i]);
  assert.equal(g.code, 'if can_harvest():\n    harvest()\nelse:\n    plant("당근")\n');
  assert.deepEqual(g.lineMap, { 1: i.id, 2: a.id, 3: i.id, 4: b.id });
  // 아니면 없음
  const j = N("if", { cond: "here_empty" }, { body: [N("plant")] });
  assert.equal(codegen([j]).code, 'if what_here() == "빈칸":\n    plant("당근")\n');
  // 다른 조건
  assert.match(codegen([N("if", { cond: "not_can_harvest" }, { body: [N("harvest")] })]).code, /^if not can_harvest\(\):/);
  assert.match(codegen([N("if", { cond: "here_potato" }, { body: [N("harvest")] })]).code, /^if what_here\(\) == "감자":/);
});

test("내 노드 만들기·부르기 코드", () => {
  const d = N("def", { name: "go_row" }, { body: [N("move", { dir: "오른쪽" }), N("harvest")] });
  const c = N("call", { name: "go_row" });
  const g = codegen([d, c]);
  assert.equal(g.code, 'def go_row():\n    move("오른쪽")\n    harvest()\ngo_row()\n');
  assert.deepEqual(g.lineMap[1], d.id);
  assert.deepEqual(g.lineMap[4], c.id);
  assert.deepEqual(g.errors, []);
});

test("내 노드 안에서는 값을 바꿀 수 없다(global은 배우지 않으므로 쓰지 않음), 읽기는 괜찮다", () => {
  const MSG_DEF_VAR = "내 노드 안에서는 값을 바꿀 수 없어요 — 바깥에서 바꿔요";
  const s = N("setvar", { name: "count", value: 0 });
  const add = N("addvar", { name: "count", value: 1 });
  const set = N("setvar", { name: "total", value: 0 });
  const deep = N("addvar", { name: "count", value: 2 });
  const d = N("def", { name: "tend" }, {
    body: [N("harvest"), add, set, N("repeat", { n: 2 }, { body: [N("if", {}, { body: [N("harvest")], orelse: [deep] })] })],
  });
  const p = [s, d, N("call", { name: "tend" })];
  const g = codegen(p);
  assert.doesNotMatch(g.code, /global/);
  assert.equal(g.code.split("\n")[1], "def tend():");
  assert.equal(g.code.split("\n")[2], "    harvest()");
  assert.deepEqual(errOn(g.errors, add.id), [MSG_DEF_VAR]);
  assert.deepEqual(errOn(g.errors, set.id), [MSG_DEF_VAR]);
  assert.deepEqual(errOn(g.errors, deep.id), [MSG_DEF_VAR]); // 안쪽 깊이 있어도
  assert.deepEqual(errOn(validate(p, ALL), add.id), [MSG_DEF_VAR]);
  assert.equal(validate(p, ALL).length, 3);
  // 바깥에서 바꾸는 것은 괜찮다
  assert.deepEqual(validate([s, N("addvar", { name: "count", value: 1 })], ALL), []);
  // 값을 읽기만 하면(값 비교 조건) 내 노드 안에서도 괜찮다
  const d2 = N("def", { name: "tend" }, { body: [N("if", { cond: { var: "count", op: "<", num: 3 } }, { body: [N("harvest")] })] });
  assert.deepEqual(validate([s, d2, N("call", { name: "tend" })], ALL), []);
  assert.doesNotMatch(codegen([s, d2]).code, /global/);
});

test("반복·동안 코드, 중첩 반복은 i j k m", () => {
  const h = N("harvest");
  const r4 = N("repeat", { n: 2 }, { body: [h] });
  const r3 = N("repeat", { n: 3 }, { body: [r4] });
  const r2 = N("repeat", { n: 4 }, { body: [r3] });
  const r1 = N("repeat", { n: 5 }, { body: [r2] });
  const g = codegen([r1]);
  assert.equal(g.code, [
    "for i in range(5):",
    "    for j in range(4):",
    "        for k in range(3):",
    "            for m in range(2):",
    "                harvest()",
    "",
  ].join("\n"));
  assert.deepEqual(g.lineMap, { 1: r1.id, 2: r2.id, 3: r3.id, 4: r4.id, 5: h.id });
  assert.deepEqual(g.errors, []);
  // 나란한 반복은 같은 이름 i를 다시 쓴다
  assert.equal(codegen([N("repeat", { n: 1 }, { body: [N("harvest")] }), N("repeat", { n: 2 }, { body: [N("harvest")] })]).code,
    "for i in range(1):\n    harvest()\nfor i in range(2):\n    harvest()\n");
  // 동안
  const s = N("setvar", { name: "count", value: 0 });
  const w = N("while", { cond: { var: "count", op: "<", num: 9 } }, { body: [N("addvar", { name: "count", value: 1 })] });
  assert.equal(codegen([s, w]).code, "count = 0\nwhile count < 9:\n    count = count + 1\n");
  assert.equal(codegen([N("while", { cond: "can_harvest" }, { body: [N("harvest")] })]).code, "while can_harvest():\n    harvest()\n");
});

test("섞인 중첩: 들여쓰기 4칸과 줄 표", () => {
  const mv = N("move", { dir: "오른쪽" });
  const hv = N("harvest"), pl = N("plant", { crop: "당근" });
  const iff = N("if", { cond: "can_harvest" }, { body: [hv], orelse: [pl] });
  const inner = N("repeat", { n: 3 }, { body: [iff, mv] });
  const d = N("def", { name: "plant_row" }, { body: [inner] });
  const dn = N("move", { dir: "아래" });
  const outer = N("repeat", { n: 3 }, { body: [N("call", { name: "plant_row" }), dn] });
  const g = codegen([d, outer]);
  assert.equal(g.code, [
    "def plant_row():",
    "    for i in range(3):",
    "        if can_harvest():",
    "            harvest()",
    "        else:",
    '            plant("당근")',
    '        move("오른쪽")',
    "for i in range(3):",
    "    plant_row()",
    '    move("아래")',
    "",
  ].join("\n"));
  assert.deepEqual(g.lineMap, {
    1: d.id, 2: inner.id, 3: iff.id, 4: hv.id, 5: iff.id, 6: pl.id, 7: mv.id,
    8: outer.id, 9: outer.body[0].id, 10: dn.id,
  });
  assert.deepEqual(g.errors, []);
  for (const line of g.code.split("\n")) assert.equal((line.match(/^ */)[0].length) % 4, 0);
});

// ---- 오류 ----
test("빈 body는 pass로 미리보기는 되지만 오류", () => {
  const r = N("repeat", { n: 2 });
  const g = codegen([r]);
  assert.equal(g.code, "for i in range(2):\n    pass\n");
  assert.deepEqual(g.lineMap, { 1: r.id, 2: r.id });
  assert.deepEqual(g.errors, [{ nodeId: r.id, msg: "안에 노드를 하나 넣어요" }]);
  // 빈 아니면도
  const i = N("if", {}, { body: [N("harvest")], orelse: [] });
  const gi = codegen([i]);
  assert.equal(gi.code, "if can_harvest():\n    harvest()\nelse:\n    pass\n");
  assert.deepEqual(msgs(gi.errors), ["안에 노드를 하나 넣어요"]);
  assert.deepEqual(errOn(validate([r], ALL), r.id), ["안에 노드를 하나 넣어요"]);
});

test("잠긴 노드는 거부: n장을 끝내면 열려요", () => {
  const ch1 = unlockedKinds(new Set([1]));
  const r = N("repeat", { n: 2 }, { body: [N("harvest")] });
  const s = N("setvar");
  assert.deepEqual(errOn(validate([r, s], ch1), r.id), ["5장을 끝내면 열려요"]);
  assert.deepEqual(errOn(validate([r, s], ch1), s.id), ["2장을 끝내면 열려요"]);
  // 값 비교 조건은 2장을 끝내야
  const ch13 = unlockedKinds(new Set([1, 3]));
  const i = N("if", { cond: { var: "count", op: "<", num: 2 } }, { body: [N("harvest")] });
  assert.ok(errOn(validate([i], ch13), i.id).includes("2장을 끝내면 열려요"));
  // 고르기 조건은 노드가 열리면 바로
  assert.deepEqual(validate([N("if", { cond: "here_carrot" }, { body: [N("harvest")] })], ch13), []);
  // codegen은 잠금을 보지 않는다
  assert.deepEqual(codegen([r]).errors, []);
});

test("내 노드 만들기는 맨 바깥에만", () => {
  const d = N("def", { name: "tend" }, { body: [N("harvest")] });
  const r = N("repeat", { n: 2 }, { body: [d] });
  assert.deepEqual(errOn(validate([r], ALL), d.id), ["내 노드 만들기는 맨 바깥에 둬요"]);
});

test("내 노드 부르기: 없는 이름, 먼저 만들기, 자기 부르기, 같은 이름 두 번", () => {
  const c = N("call", { name: "tend" });
  assert.deepEqual(errOn(validate([c], ALL), c.id), ["그 이름의 내 노드가 없어요"]);
  const d = N("def", { name: "tend" }, { body: [N("harvest")] });
  const c2 = N("call", { name: "tend" });
  assert.deepEqual(errOn(validate([c2, d], ALL), c2.id), ["내 노드를 먼저 만들어요"]);
  assert.deepEqual(validate([d, c2], ALL), []);
  // 반복 안의 부르기도 위쪽 정의면 괜찮고, 아래쪽이면 오류
  const c3 = N("call", { name: "tend" });
  const r = N("repeat", { n: 2 }, { body: [c3] });
  assert.deepEqual(validate([d, r], ALL), []);
  assert.deepEqual(errOn(validate([r, d], ALL), c3.id), ["내 노드를 먼저 만들어요"]);
  // 다른 내 노드 안에서 부르기: 위에서 만든 것만
  const d2 = N("def", { name: "go_row" }, { body: [N("call", { name: "tend" })] });
  assert.deepEqual(validate([d, d2], ALL), []);
  const bad = validate([d2, d], ALL);
  assert.deepEqual(errOn(bad, d2.body[0].id), ["내 노드를 먼저 만들어요"]);
  // 자기 자신
  const self = N("def", { name: "tend" }, { body: [N("call", { name: "tend" })] });
  assert.deepEqual(errOn(validate([self], ALL), self.body[0].id), ["자기 자신은 부를 수 없어요"]);
  // 같은 이름 두 번
  const dd = N("def", { name: "tend" }, { body: [N("move")] });
  assert.deepEqual(errOn(validate([d, dd], ALL), dd.id), ["같은 이름의 내 노드가 이미 있어요"]);
  // codegen도 같은 구조 오류를 낸다
  assert.deepEqual(msgs(codegen([c2, d]).errors), ["내 노드를 먼저 만들어요"]);
});

test("값은 먼저 기억해야 쓴다(값 더하기·조건)", () => {
  const a = N("addvar", { name: "count", value: 1 });
  assert.deepEqual(errOn(validate([a], ALL), a.id), ["count 값을 먼저 기억해요"]);
  const s = N("setvar", { name: "count", value: 0 });
  assert.deepEqual(validate([s, a], ALL), []);
  assert.deepEqual(errOn(validate([a, s], ALL), a.id), ["count 값을 먼저 기억해요"]);
  // 다른 이름은 따로
  const t = N("addvar", { name: "total", value: 1 });
  assert.deepEqual(errOn(validate([s, t], ALL), t.id), ["total 값을 먼저 기억해요"]);
  // 조건
  const w = N("while", { cond: { var: "n", op: "<", num: 3 } }, { body: [N("harvest"), N("addvar", { name: "n", value: 1 })] });
  assert.deepEqual(errOn(validate([w], ALL), w.id), ["n 값을 먼저 기억해요"]);
  assert.deepEqual(validate([N("setvar", { name: "n", value: 0 }), w], ALL), []);
  // 반복 안에서 기억한 값도 그 뒤에서 쓸 수 있다
  const r = N("repeat", { n: 1 }, { body: [N("setvar", { name: "total", value: 0 })] });
  assert.deepEqual(validate([r, N("addvar", { name: "total", value: 1 })], ALL), []);
});

// ---- 검토 C62 I4·I5: 끝나지 않는 「~하는 동안」, 값이 정해지는 자리 ----
test("값 더하기는 1부터(0을 더하면 값이 그대로라 반복이 끝나지 않음)", () => {
  assert.deepEqual(NODES.addvar.args.value, { type: "int", min: 1, max: 99, default: 1 });
  assert.equal(newNode("addvar", 1).args.value, 1);
  const s = N("setvar", { name: "count", value: 0 });
  const a0 = N("addvar", { name: "count", value: 0 });
  assert.deepEqual(errOn(validate([s, a0], ALL), a0.id), ["고를 수 없는 값이에요"]);
  assert.deepEqual(validate([s, N("addvar", { name: "count", value: 1 })], ALL), []);
  // 값 기억하기는 0부터 그대로
  assert.deepEqual(validate([N("setvar", { name: "count", value: 0 })], ALL), []);
});

test("내 노드 안의 값 비교 ~하는 동안은 오류(안에서 값을 바꿀 수 없어 끝나지 않음)", () => {
  const s = N("setvar", { name: "count", value: 0 });
  const w = N("while", { cond: { var: "count", op: "<", num: 3 } }, { body: [N("harvest")] });
  const d = N("def", { name: "tend" }, { body: [N("move"), N("repeat", { n: 2 }, { body: [w] })] });
  const errs = validate([s, d, N("call", { name: "tend" })], ALL);
  assert.deepEqual(errOn(errs, w.id), ["내 노드 안의 ~하는 동안은 끝나지 않아요"]);
  assert.equal(errs.length, 1);
  assert.deepEqual(errOn(codegen([s, d]).errors, w.id), ["내 노드 안의 ~하는 동안은 끝나지 않아요"]);
  // 고르기 조건(can_harvest 등)의 ~하는 동안은 내 노드 안에서도 괜찮다(파이가 움직이면 바뀜)
  const w2 = N("while", { cond: "can_harvest" }, { body: [N("harvest")] });
  assert.deepEqual(validate([N("def", { name: "tend" }, { body: [w2] })], ALL), []);
});

test("값 비교 ~하는 동안은 안에서 그 값을 바꿔야 한다", () => {
  const s = N("setvar", { name: "count", value: 0 });
  const w = N("while", { cond: { var: "count", op: "<", num: 4 } }, { body: [N("move"), N("harvest")] });
  assert.deepEqual(errOn(validate([s, w], ALL), w.id), ["반복 안에서 count 값을 바꿔요"]);
  // 다른 값을 바꾸는 것은 세지 않는다(이름이 메시지에 그대로)
  const t = N("setvar", { name: "total", value: 0 });
  const wn = N("while", { cond: { var: "total", op: "<", num: 4 } }, { body: [N("addvar", { name: "count", value: 1 })] });
  assert.deepEqual(errOn(validate([s, t, wn], ALL), wn.id), ["반복 안에서 total 값을 바꿔요"]);
  // 바로 안·안쪽 반복·목록(1번 이상 돎) 속 값 더하기/기억하기는 바꾼 것으로 센다
  const ok1 = N("while", { cond: { var: "count", op: "<", num: 4 } }, { body: [N("move"), N("addvar", { name: "count", value: 1 })] });
  const ok3 = N("while", { cond: { var: "count", op: "<", num: 4 } }, {
    body: [N("repeat", { n: 2 }, { body: [N("move"), N("setvar", { name: "count", value: 9 })] })] });
  for (const w2 of [ok1, ok3]) assert.deepEqual(validate([s, w2], ALL), [], JSON.stringify(w2));
  // 만약·아니면·안쪽 ~하는 동안 속에서만 바꾸면 조건에 따라 안 바뀌어 끝나지 않을 수 있다(v0.11 검토)
  const c4 = { var: "count", op: "<", num: 4 };
  const bad = [
    N("while", { cond: c4 }, { body: [N("if", { cond: "can_harvest" }, { body: [N("harvest"), N("addvar", { name: "count", value: 1 })] }), N("move")] }),
    N("while", { cond: c4 }, { body: [N("if", { cond: "can_harvest" }, { body: [N("harvest")], orelse: [N("addvar", { name: "count", value: 1 })] }), N("move")] }),
    N("while", { cond: c4 }, { body: [N("move"), N("while", { cond: "can_harvest" }, { body: [N("harvest"), N("addvar", { name: "count", value: 1 })] })] }),
    N("while", { cond: c4 }, { body: [N("repeat", { n: 2 }, { body: [N("if", {}, { body: [N("addvar", { name: "count", value: 1 })] })] })] }),
  ];
  for (const w2 of bad) assert.deepEqual(errOn(validate([s, w2], ALL), w2.id), ["반복 안에서 count 값을 바꿔요"], JSON.stringify(w2));
  // 내 노드 부르기는 값을 바꿀 수 없으므로(내 노드 안 값 바꾸기 금지) 세지 않는다
  const d = N("def", { name: "tend" }, { body: [N("move")] });
  const wc = N("while", { cond: { var: "count", op: "<", num: 4 } }, { body: [N("call", { name: "tend" })] });
  assert.deepEqual(errOn(validate([s, d, wc], ALL), wc.id), ["반복 안에서 count 값을 바꿔요"]);
  // 데이터의 정답 프로그램(o_while)은 그대로 통과
  assert.deepEqual(validate([s, N("while", { cond: { var: "count", op: "<", num: 4 } }, {
    body: [N("if", { cond: "here_empty" }, { body: [N("plant")] }), N("move"), N("addvar", { name: "count", value: 1 })] })], ALL), []);
});

test("값이 정해지는 자리: 만약·아니면·동안 안에서 기억한 값은 바깥 뒤쪽에서 못 씀, 반복 안은 씀", () => {
  const NO = "count 값을 먼저 기억해요";
  // 검토 C62의 NameError: 만약 안에서만 기억하고 바깥에서 더하기 → 다 자라지 않았으면 count가 없음
  const a = N("addvar", { name: "count", value: 1 });
  const p = [N("if", { cond: "can_harvest" }, { body: [N("harvest"), N("setvar", { name: "count", value: 0 })] }), a];
  assert.deepEqual(errOn(validate(p, ALL), a.id), [NO]);
  // 아니면 쪽도 같다(양쪽 다 기억해도 첫 판은 단순하게: 바깥에서 기억해요)
  const a2 = N("addvar", { name: "count", value: 1 });
  const p2 = [N("if", { cond: "can_harvest" }, { body: [N("setvar", { name: "count", value: 0 })], orelse: [N("setvar", { name: "count", value: 1 })] }), a2];
  assert.deepEqual(errOn(validate(p2, ALL), a2.id), [NO]);
  // ~하는 동안 안(한 번도 안 돌 수 있음)
  const a3 = N("addvar", { name: "count", value: 1 });
  const p3 = [N("while", { cond: "can_harvest" }, { body: [N("harvest"), N("setvar", { name: "count", value: 0 })] }), a3];
  assert.deepEqual(errOn(validate(p3, ALL), a3.id), [NO]);
  // 조건에서 읽기도 같다
  const w = N("while", { cond: { var: "count", op: "<", num: 3 } }, { body: [N("addvar", { name: "count", value: 1 })] });
  const p4 = [N("if", { cond: "can_harvest" }, { body: [N("setvar", { name: "count", value: 0 })] }), w];
  assert.deepEqual(errOn(validate(p4, ALL), w.id), [NO]);
  // 같은 만약 안에서 기억한 뒤 쓰는 것은 괜찮다
  assert.deepEqual(validate([N("if", { cond: "can_harvest" }, { body: [N("setvar", { name: "count", value: 0 }), N("addvar", { name: "count", value: 1 })] })], ALL), []);
  // 바깥에서 기억한 값은 안쪽 어디서든
  assert.deepEqual(validate([N("setvar", { name: "count", value: 0 }), N("if", { cond: "can_harvest" }, { body: [N("addvar", { name: "count", value: 1 })], orelse: [N("addvar", { name: "count", value: 2 })] })], ALL), []);
  // 반복(1번 이상) 안에서 기억한 값은 반복 뒤에서도, 겹친 반복도
  const r = N("repeat", { n: 2 }, { body: [N("repeat", { n: 1 }, { body: [N("setvar", { name: "count", value: 0 })] })] });
  assert.deepEqual(validate([r, N("addvar", { name: "count", value: 1 })], ALL), []);
  // 반복 안이라도 그 안의 만약 속이면 못 씀
  const a5 = N("addvar", { name: "count", value: 1 });
  const r2 = N("repeat", { n: 2 }, { body: [N("if", { cond: "can_harvest" }, { body: [N("setvar", { name: "count", value: 0 })] })] });
  assert.deepEqual(errOn(validate([r2, a5], ALL), a5.id), [NO]);
  // 내 노드 안은 그 내 노드보다 앞(바깥)에서 기억한 값만 읽음
  const i = N("if", { cond: { var: "count", op: "<", num: 3 } }, { body: [N("harvest")] });
  const d = N("def", { name: "tend" }, { body: [i] });
  assert.deepEqual(errOn(validate([d, N("setvar", { name: "count", value: 0 }), N("call", { name: "tend" })], ALL), i.id), [NO]);
  assert.deepEqual(validate([N("setvar", { name: "count", value: 0 }), d, N("call", { name: "tend" })], ALL), []);
});

test("깊이 4단까지", () => {
  const h = N("harvest");
  let node = h;
  for (let d = 0; d < 4; d++) node = N("repeat", { n: 1 }, { body: [node] });
  assert.deepEqual(validate([node], ALL), []); // 반복 4겹 안의 수확 = 들여쓰기 4단
  const deeper = N("repeat", { n: 1 }, { body: [node] });
  const errs = validate([deeper], ALL);
  assert.deepEqual(errOn(errs, h.id), ["안쪽으로는 4단까지 넣어요"]);
  assert.equal(errs.length, 1);
});

test("노드는 60개까지", () => {
  const p = Array.from({ length: 60 }, () => N("harvest"));
  assert.deepEqual(validate(p, ALL), []);
  const extra = N("harvest");
  const big = [...p, extra];
  assert.deepEqual(validate(big, ALL), [{ nodeId: extra.id, msg: "노드는 60개까지예요" }]);
  // 안쪽 노드도 센다
  const r = N("repeat", { n: 1 }, { body: Array.from({ length: 59 }, () => N("harvest")) });
  assert.equal(countNodes([r]), 60);
  assert.deepEqual(validate([r], ALL), []);
  const last = N("move");
  assert.deepEqual(validate([r, last], ALL), [{ nodeId: last.id, msg: "노드는 60개까지예요" }]);
});

test("잘못된 값은 거부", () => {
  const bad = [
    N("move", { dir: "앞" }),
    N("plant", { crop: "수박" }),
    N("say", { text: "가".repeat(21) }),
    N("say", { text: "" }),
    N("say", { text: 3 }),
    N("setvar", { name: "x", value: 0 }),
    N("setvar", { name: "count", value: 100 }),
    N("setvar", { name: "count", value: 1.5 }),
    N("addvar", { name: "count", value: -1 }),
    N("repeat", { n: 0 }, { body: [N("harvest")] }),
    N("repeat", { n: 26 }, { body: [N("harvest")] }),
    N("if", { cond: "rain" }, { body: [N("harvest")] }),
    N("if", { cond: { var: "count", op: "<=", num: 1 } }, { body: [N("harvest")] }),
    N("if", { cond: { var: "count", op: "<", num: 100 } }, { body: [N("harvest")] }),
    N("if", { cond: { var: "zzz", op: "<", num: 1 } }, { body: [N("harvest")] }),
    N("def", { name: "fly" }, { body: [N("harvest")] }),
    N("call", { name: "fly" }),
  ];
  const pre = [N("setvar", { name: "count", value: 0 })];
  for (const n of bad) {
    const errs = errOn(validate([...pre, n], ALL), n.id);
    assert.ok(errs.includes("고를 수 없는 값이에요"), `${n.kind} ${JSON.stringify(n.args)} → ${errs}`);
  }
  // 20자는 괜찮다(한글·이모지 모두 글자 하나)
  assert.deepEqual(validate([N("say", { text: "가".repeat(20) })], ALL), []);
  assert.deepEqual(validate([N("say", { text: "🥕".repeat(20) })], ALL), []);
  // 모르는 종류
  const u = { id: "u1", kind: "fly", args: {} };
  assert.deepEqual(errOn(validate([u], ALL), "u1"), ["모르는 노드예요"]);
  assert.deepEqual(msgs(codegen([u]).errors), ["모르는 노드예요"]);
  // 경계값 통과
  assert.deepEqual(validate([N("repeat", { n: 1 }, { body: [N("harvest")] }), N("repeat", { n: 25 }, { body: [N("harvest")] }),
    N("setvar", { name: "total", value: 99 })], ALL), []);
});

// ---- 불변 편집 ----
test("넣기: 맨 바깥·body·orelse, 원본은 그대로", () => {
  const r = N("repeat", { n: 2 }, { body: [N("harvest")] });
  const i = N("if", {}, { body: [N("harvest")] });
  const p = deepFreeze([r, i]);
  const m = newNode("move", "new1");
  const p1 = insertNode(p, null, "body", 1, m);
  assert.deepEqual(p1.map((n) => n.id), [r.id, "new1", i.id]);
  const p2 = insertNode(p, r.id, "body", 0, m);
  assert.deepEqual(findNode(p2, r.id).body.map((n) => n.kind), ["move", "harvest"]);
  assert.equal(p2[1], p[1]); // 건드리지 않은 가지는 그대로 공유
  const p3 = insertNode(p, i.id, "orelse", 0, newNode("plant", "new2"));
  assert.deepEqual(findNode(p3, i.id).orelse.map((n) => n.id), ["new2"]);
  assert.equal(codegen(p3).code.includes("else:"), true);
  // 끝 너머 index는 맨 끝으로
  assert.deepEqual(insertNode(p, null, "body", 99, m).map((n) => n.id), [r.id, i.id, "new1"]);
  // 원본은 바뀌지 않았다(얼린 객체라 바뀌었다면 이미 오류)
  assert.equal(p.length, 2);
  assert.equal(r.body.length, 1);
  // body가 없는 노드 안에는 못 넣음
  assert.throws(() => insertNode(p, r.body[0].id, "body", 0, m));
  assert.throws(() => insertNode(p, r.id, "orelse", 0, m));
  assert.throws(() => insertNode(p, "nope", "body", 0, m));
});

test("옮기기: 같은 형제 안에서 위·아래, 끝에서는 그대로", () => {
  const a = N("move"), b = N("harvest"), c = N("plant");
  const x = N("move"), y = N("harvest");
  const r = N("repeat", { n: 2 }, { body: [x, y] });
  const p = deepFreeze([a, b, c, r]);
  assert.deepEqual(moveNode(p, b.id, -1).map((n) => n.id), [b.id, a.id, c.id, r.id]);
  assert.deepEqual(moveNode(p, b.id, 1).map((n) => n.id), [a.id, c.id, b.id, r.id]);
  assert.deepEqual(moveNode(p, a.id, -1).map((n) => n.id), [a.id, b.id, c.id, r.id]);
  assert.deepEqual(moveNode(p, r.id, 1).map((n) => n.id), [a.id, b.id, c.id, r.id]);
  const p2 = moveNode(p, y.id, -1);
  assert.deepEqual(findNode(p2, r.id).body.map((n) => n.id), [y.id, x.id]);
  assert.deepEqual(r.body.map((n) => n.id), [x.id, y.id]);
});

test("지우기·값 바꾸기·아니면 켜고 끄기, 원본 그대로", () => {
  const h = N("harvest");
  const r = N("repeat", { n: 2 }, { body: [h, N("move")] });
  const i = N("if", {}, { body: [N("harvest")] });
  const p = deepFreeze([r, i, N("say", { text: "hi" })]);
  const p1 = removeNode(p, h.id);
  assert.equal(findNode(p1, r.id).body.length, 1);
  assert.equal(findNode(p1, h.id), null);
  assert.equal(countNodes(removeNode(p, r.id)), 3); // 반복과 그 안 2개가 함께 사라짐
  const p2 = updateArgs(p, r.id, { n: 7 });
  assert.equal(findNode(p2, r.id).args.n, 7);
  assert.equal(r.args.n, 2);
  assert.match(codegen(p2).code, /range\(7\)/);
  const p3 = setElse(p, i.id, true);
  assert.deepEqual(findNode(p3, i.id).orelse, []);
  const p4 = setElse(p3, i.id, false);
  assert.equal(findNode(p4, i.id).orelse, undefined);
  assert.equal(i.orelse, undefined);
  assert.throws(() => setElse(p, r.id, true));
  assert.equal(findNode(p, "없음"), null);
});

test("세기와 쓴 노드 종류", () => {
  const p = [
    N("setvar"),
    N("def", { name: "tend" }, { body: [N("if", {}, { body: [N("harvest")], orelse: [N("plant")] })] }),
    N("repeat", { n: 2 }, { body: [N("call", { name: "tend" })] }),
  ];
  assert.equal(countNodes(p), 7);
  assert.deepEqual([...kindsUsed(p)].sort(), ["call", "def", "harvest", "if", "plant", "repeat", "setvar"]);
  assert.deepEqual([...kindsUsed([])], []);
  assert.equal(countNodes([]), 0);
  assert.deepEqual(codegen([]), { code: "", lineMap: {}, errors: [] });
});

test("codegen·validate는 입력을 바꾸지 않는다", () => {
  const p = deepFreeze([
    N("setvar"),
    N("def", { name: "tend" }, { body: [N("addvar")] }),
    N("repeat", { n: 2 }, { body: [N("repeat", { n: 2 }, { body: [] })] }),
  ]);
  const before = JSON.stringify(p);
  codegen(p);
  validate(p, ALL);
  kindsUsed(p);
  assert.equal(JSON.stringify(p), before);
});

// ======================================================================
// v0.11 작업 2: 6~9장 노드(설계 docs/specs/2026-11-05-텃밭-6-9장-설계.md 1절)
// ======================================================================
const ALL9 = unlockedKinds(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
const NO_LOOP = "목록에서 하나씩 노드 안에서만 고를 수 있어요";
const NO_POS = "위치 알기를 먼저 해요";
const NO_MOVE = "반복 안에서 파이가 움직여야 해요";
const LV = { loopVar: true };
const cropList = (...items) => ({ type: "crop", items });
const dirList = (...items) => ({ type: "dir", items });

// ---- 6장 값 넣어 말하기 ----
test("6장 sayval: 앞 글자 + str(값) + 뒤 글자, 빈 조각은 뺀다", () => {
  assert.deepEqual(Object.keys(NODES.sayval.args).sort(), ["post", "pre", "var"]);
  assert.equal(NODES.sayval.args.pre.max, 10);
  assert.equal(NODES.sayval.args.post.max, 10);
  const s = N("setvar", { name: "count", value: 3 });
  const v = N("sayval", { pre: "당근 ", var: "count", post: "개" });
  const g = codegen([s, v]);
  assert.equal(g.code, 'count = 3\nprint("당근 " + str(count) + "개")\n');
  assert.equal(g.lineMap[2], v.id);
  assert.deepEqual(g.errors, []);
  assert.equal(codegen([s, N("sayval", { pre: "", var: "count", post: "개" })]).code.split("\n")[1], 'print(str(count) + "개")');
  assert.equal(codegen([s, N("sayval", { pre: "수: ", var: "count", post: "" })]).code.split("\n")[1], 'print("수: " + str(count))');
  assert.equal(codegen([s, N("sayval", { pre: "", var: "count", post: "" })]).code.split("\n")[1], "print(str(count))");
  // 따옴표 안전
  assert.equal(codegen([s, N("sayval", { pre: '"a\\', var: "count", post: "\n" })]).code.split("\n")[1],
    'print("\\"a\\\\" + str(count) + "\\n")');
  assert.deepEqual(validate([s, v], ALL9), []);
  // 기본값
  const d = newNode("sayval", 1).args;
  assert.equal(typeof d.pre, "string");
  assert.equal(typeof d.post, "string");
  assert.equal(d.var, "count");
});

test("6장 sayval: 글자 수·값 이름 검사, 먼저 기억한 값만", () => {
  const s = N("setvar", { name: "count", value: 0 });
  for (const args of [{ pre: "가".repeat(11) }, { post: "가".repeat(11) }, { pre: 3 }, { var: "zzz" }, { var: 5 },
    { var: { loopVar: true, type: "fruit" } }, { var: { loopVar: false, type: "crop" } }]) {
    const n = N("sayval", args);
    assert.ok(errOn(validate([s, n], ALL9), n.id).includes("고를 수 없는 값이에요"), JSON.stringify(args));
  }
  assert.deepEqual(validate([s, N("sayval", { pre: "가".repeat(10), post: "🥕".repeat(10) })], ALL9), []);
  // 기억하지 않은 값
  const n1 = N("sayval", { var: "total" });
  assert.deepEqual(errOn(validate([s, n1], ALL9), n1.id), ["total 값을 먼저 기억해요"]);
  // 만약 안에서만 기억한 값(C64)
  const n2 = N("sayval", { var: "count" });
  assert.deepEqual(errOn(validate([N("if", {}, { body: [N("setvar", { name: "count", value: 1 })] }), n2], ALL9), n2.id),
    ["count 값을 먼저 기억해요"]);
  // 반복 안에서 기억한 값은 뒤에서 씀
  assert.deepEqual(validate([N("repeat", { n: 1 }, { body: [N("setvar", { name: "count", value: 1 })] }), N("sayval", { var: "count" })], ALL9), []);
  // 내 노드 안에서 읽기는 괜찮다(앞에서 기억했으면)
  assert.deepEqual(validate([s, N("def", { name: "tend" }, { body: [N("sayval", { var: "count" })] })], ALL9), []);
  // 잠김
  const ch5 = unlockedKinds(new Set([1, 2, 3, 4, 5]));
  const n3 = N("sayval");
  assert.deepEqual(errOn(validate([s, n3], ch5), n3.id), ["6장을 끝내면 열려요"]);
});

// ---- 7장 목록에서 하나씩 ----
test("7장 foreach: 작물 목록 crop, 방향 목록 way, 겹치면 crop2·way2", () => {
  assert.deepEqual(LIST_TYPES, ["crop", "dir"]);
  assert.deepEqual(LIST_ITEMS, { crop: ["당근", "감자"], dir: ["위", "아래", "왼쪽", "오른쪽"] });
  assert.equal(LIST_MAX, 6);
  const p1 = N("plant", { crop: LV });
  const f1 = N("foreach", { list: cropList("당근", "감자", "당근") }, { body: [p1, N("move", { dir: "오른쪽" })] });
  const g = codegen([f1]);
  assert.equal(g.code, 'for crop in ["당근", "감자", "당근"]:\n    plant(crop)\n    move("오른쪽")\n');
  assert.deepEqual(g.lineMap, { 1: f1.id, 2: p1.id, 3: f1.body[1].id });
  assert.deepEqual(validate([f1], ALL9), []);
  // 방향
  const m = N("move", { dir: LV });
  const f2 = N("foreach", { list: dirList("오른쪽", "아래") }, { body: [m, N("harvest")] });
  assert.equal(codegen([f2]).code, 'for way in ["오른쪽", "아래"]:\n    move(way)\n    harvest()\n');
  assert.deepEqual(validate([f2], ALL9), []);
  // 같은 종류가 겹치면 안쪽은 crop2, 목록 변수는 가장 안쪽 것
  const pin = N("plant", { crop: LV });
  const inner = N("foreach", { list: cropList("감자") }, { body: [pin] });
  const mid = N("foreach", { list: dirList("위") }, { body: [inner, N("move", { dir: LV })] });
  const outer = N("foreach", { list: cropList("당근") }, { body: [mid, N("plant", { crop: LV })] });
  assert.equal(codegen([outer]).code, [
    'for crop in ["당근"]:',
    '    for way in ["위"]:',
    '        for crop2 in ["감자"]:',
    "            plant(crop2)",
    "        move(way)",
    "    plant(crop)",
    "",
  ].join("\n"));
  assert.deepEqual(validate([outer], ALL9), []);
  // 나란한 목록은 같은 이름을 다시
  const a = N("foreach", { list: dirList("위") }, { body: [N("move", { dir: LV })] });
  const b = N("foreach", { list: dirList("아래") }, { body: [N("move", { dir: LV })] });
  assert.equal(codegen([a, b]).code, 'for way in ["위"]:\n    move(way)\nfor way in ["아래"]:\n    move(way)\n');
  // 반복(range)과 섞여도 i 이름은 그대로
  const r = N("repeat", { n: 2 }, { body: [N("foreach", { list: cropList("당근") }, { body: [N("plant", { crop: LV })] })] });
  assert.equal(codegen([r]).code, 'for i in range(2):\n    for crop in ["당근"]:\n        plant(crop)\n');
  // 기본값은 노드마다 따로(공유 객체가 아님)
  const n1 = newNode("foreach", 1), n2 = newNode("foreach", 2);
  assert.deepEqual(n1.body, []);
  assert.deepEqual(n1.args.list.type, "crop");
  assert.ok(n1.args.list.items.length >= 1);
  assert.notEqual(n1.args.list, n2.args.list);
  assert.notEqual(n1.args.list.items, n2.args.list.items);
});

test("7장 foreach: 목록 검사(종류·개수 1~6·값), 빈 body, 잠김", () => {
  const bad = [
    { type: "fruit", items: ["당근"] },
    cropList(),
    cropList("당근", "당근", "당근", "당근", "당근", "당근", "당근"),
    cropList("수박"),
    cropList("위"),
    dirList("당근"),
    dirList("앞"),
    { type: "dir" },
    "당근",
    null,
  ];
  for (const list of bad) {
    const f = N("foreach", { list }, { body: [N("harvest")] });
    assert.ok(errOn(validate([f], ALL9), f.id).includes("고를 수 없는 값이에요"), JSON.stringify(list));
  }
  assert.deepEqual(validate([N("foreach", { list: cropList("당근", "감자", "당근", "감자", "당근", "감자") }, { body: [N("harvest")] })], ALL9), []);
  assert.deepEqual(validate([N("foreach", { list: dirList("위", "아래", "왼쪽", "오른쪽", "위", "위") }, { body: [N("harvest")] })], ALL9), []);
  const empty = N("foreach", { list: cropList("당근") });
  assert.deepEqual(errOn(validate([empty], ALL9), empty.id), ["안에 노드를 하나 넣어요"]);
  assert.equal(codegen([empty]).code, 'for crop in ["당근"]:\n    pass\n');
  const ch6 = unlockedKinds(new Set([1, 2, 3, 4, 5, 6]));
  const f = N("foreach", { list: cropList("당근") }, { body: [N("harvest")] });
  assert.deepEqual(errOn(validate([f], ch6), f.id), ["7장을 끝내면 열려요"]);
  // 깊이: 목록도 한 단으로 센다
  const h = N("harvest");
  let node = h;
  for (let d = 0; d < 5; d++) node = N("foreach", { list: dirList("위") }, { body: [node] });
  assert.deepEqual(errOn(validate([node], ALL9), h.id), ["안쪽으로는 4단까지 넣어요"]);
});

test("7장 목록 변수: 맞는 종류의 목록 안에서만", () => {
  // 바깥
  const p = N("plant", { crop: LV });
  assert.deepEqual(errOn(validate([p], ALL9), p.id), [NO_LOOP]);
  const m = N("move", { dir: LV });
  assert.deepEqual(errOn(validate([N("repeat", { n: 2 }, { body: [m] })], ALL9), m.id), [NO_LOOP]);
  // 다른 종류의 목록 안
  const p2 = N("plant", { crop: LV });
  assert.deepEqual(errOn(validate([N("foreach", { list: dirList("위") }, { body: [p2] })], ALL9), p2.id), [NO_LOOP]);
  // 목록 뒤(밖)
  const p3 = N("plant", { crop: LV });
  assert.deepEqual(errOn(validate([N("foreach", { list: cropList("당근") }, { body: [N("harvest")] }), p3], ALL9), p3.id), [NO_LOOP]);
  // 안쪽 만약·반복 속은 괜찮다
  assert.deepEqual(validate([N("foreach", { list: cropList("당근") }, {
    body: [N("if", { cond: "here_empty" }, { body: [N("repeat", { n: 1 }, { body: [N("plant", { crop: LV })] })] })] })], ALL9), []);
  // 내 노드 안의 목록 안은 괜찮고, 부르는 쪽이 목록 안이어도 내 노드 안에서는 못 씀
  const pd = N("plant", { crop: LV });
  const d = N("def", { name: "tend" }, { body: [pd] });
  assert.deepEqual(errOn(validate([d, N("foreach", { list: cropList("당근") }, { body: [N("call", { name: "tend" })] })], ALL9), pd.id), [NO_LOOP]);
  assert.deepEqual(validate([N("def", { name: "tend" }, { body: [N("foreach", { list: cropList("감자") }, { body: [N("plant", { crop: LV })] })] })], ALL9), []);
  // 종류를 적어도 되지만 노드와 맞아야 함
  assert.deepEqual(validate([N("foreach", { list: cropList("당근") }, { body: [N("plant", { crop: { loopVar: true, type: "crop" } })] })], ALL9), []);
  const pw = N("plant", { crop: { loopVar: true, type: "dir" } });
  assert.ok(errOn(validate([N("foreach", { list: dirList("위") }, { body: [pw] })], ALL9), pw.id).includes("고를 수 없는 값이에요"));
  // 말하기·harvest 등 다른 노드에는 목록 변수가 없음
  const sy = N("say", { text: LV });
  assert.ok(errOn(validate([N("foreach", { list: cropList("당근") }, { body: [sy] })], ALL9), sy.id).includes("고를 수 없는 값이에요"));
});

test("7장 값 넣어 말하기에 목록 변수", () => {
  const sv = N("sayval", { pre: "", var: { loopVar: true, type: "crop" }, post: " 심기" });
  const f = N("foreach", { list: cropList("당근", "감자") }, { body: [sv] });
  assert.equal(codegen([f]).code, 'for crop in ["당근", "감자"]:\n    print(str(crop) + " 심기")\n');
  assert.deepEqual(validate([f], ALL9), []);
  const out = N("sayval", { var: { loopVar: true, type: "dir" } });
  assert.deepEqual(errOn(validate([f, out], ALL9), out.id), [NO_LOOP]);
});

test("목록 안에서 기억한 값은 목록 뒤에서도 쓴다(목록은 1개 이상이라 한 번은 돎)", () => {
  const f = N("foreach", { list: cropList("당근") }, { body: [N("setvar", { name: "total", value: 0 }), N("where")] });
  assert.deepEqual(validate([f, N("addvar", { name: "total", value: 1 }), N("sayval", { var: "x" })], ALL9), []);
});

// ---- 8장 창고 조건 ----
test("8장 창고 조건: store()[작물] 비교, 8장을 끝내야", () => {
  const c = { store: { crop: "당근", op: "<", num: 10 } };
  assert.equal(condCode(c), 'store()["당근"] < 10');
  assert.equal(condCode({ store: { crop: "감자", op: "==", num: 0 } }), 'store()["감자"] == 0');
  const w = N("while", { cond: c }, { body: [N("harvest")] });
  assert.equal(codegen([w]).code, 'while store()["당근"] < 10:\n    harvest()\n');
  // 창고 조건 ~하는 동안은 값 바꾸기 검사가 없다(거두면 창고가 바뀜), 내 노드 안에서도 괜찮다
  assert.deepEqual(validate([w], ALL9), []);
  assert.deepEqual(validate([N("def", { name: "tend" }, { body: [N("while", { cond: c }, { body: [N("move")] })] })], ALL9), []);
  const i = N("if", { cond: { store: { crop: "감자", op: ">", num: 99 } } }, { body: [N("harvest")] });
  assert.deepEqual(validate([i], ALL9), []);
  // 잠김: 1~7장만 끝냈으면
  const u7 = unlockedKinds(new Set([1, 2, 3, 4, 5, 6, 7]));
  assert.deepEqual(errOn(validate([w], u7), w.id), ["8장을 끝내면 열려요"]);
  assert.deepEqual(validate([w], unlockedKinds(new Set([1, 3, 5, 8]))), []);
  // 잘못된 값
  for (const st of [{ crop: "수박", op: "<", num: 1 }, { crop: "당근", op: "<=", num: 1 }, { crop: "당근", op: "<", num: 100 },
    { crop: "당근", op: "<", num: -1 }, { crop: "당근", op: "<", num: 1.5 }, null, "당근"]) {
    const n = N("if", { cond: { store: st } }, { body: [N("harvest")] });
    assert.ok(errOn(validate([n], ALL9), n.id).includes("고를 수 없는 값이에요"), JSON.stringify(st));
  }
});

// ---- 9장 위치 알기 ----
test("9장 where: x, y = where(), 뒤에서 x·y를 조건과 값 넣어 말하기에", () => {
  assert.deepEqual(POS_NAMES, ["x", "y"]);
  assert.deepEqual(NODES.where.args, {});
  const wh = N("where");
  const i = N("if", { cond: { var: "x", op: "<", num: 3 } }, { body: [N("move", { dir: "오른쪽" })] });
  const sv = N("sayval", { pre: "y는 ", var: "y", post: "" });
  const g = codegen([wh, i, sv]);
  assert.equal(g.code, 'x, y = where()\nif x < 3:\n    move("오른쪽")\nprint("y는 " + str(y))\n');
  assert.equal(g.lineMap[1], wh.id);
  assert.deepEqual(validate([wh, i, sv], ALL9), []);
  // 위치 알기 전에는 못 씀
  const i2 = N("if", { cond: { var: "y", op: "==", num: 0 } }, { body: [N("harvest")] });
  assert.deepEqual(errOn(validate([i2, N("where")], ALL9), i2.id), [NO_POS]);
  const sv2 = N("sayval", { var: "x" });
  assert.deepEqual(errOn(validate([sv2], ALL9), sv2.id), [NO_POS]);
  // 만약 안의 위치 알기는 바깥 뒤에서 못 씀(C64), 반복 안은 씀
  const sv3 = N("sayval", { var: "x" });
  assert.deepEqual(errOn(validate([N("if", {}, { body: [N("where")] }), sv3], ALL9), sv3.id), [NO_POS]);
  assert.deepEqual(validate([N("repeat", { n: 1 }, { body: [N("where")] }), N("sayval", { var: "x" })], ALL9), []);
  // x·y는 기억하기·더하기로 바꿀 수 없다
  for (const k of ["setvar", "addvar"]) {
    const n = N(k, { name: "x", value: 1 });
    assert.ok(errOn(validate([N("where"), n], ALL9), n.id).includes("고를 수 없는 값이에요"), k);
  }
  // 잠김: x·y 조건은 9장
  const u8 = unlockedKinds(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  const w0 = N("where");
  const iz = N("if", { cond: { var: "x", op: "<", num: 3 } }, { body: [N("harvest")] });
  const errs = validate([w0, iz], u8);
  assert.deepEqual(errOn(errs, w0.id), ["9장을 끝내면 열려요"]);
  assert.deepEqual(errOn(errs, iz.id), ["9장을 끝내면 열려요"]);
});

test("9장 x·y 비교 ~하는 동안: 안에서 움직이고 위치를 다시 알아야 끝난다", () => {
  const cx = { var: "x", op: "<", num: 4 };
  const ok = N("while", { cond: cx }, { body: [N("move", { dir: "오른쪽" }), N("where")] });
  assert.deepEqual(validate([N("where"), ok], ALL9), []);
  assert.equal(codegen([N("where"), ok]).code, 'x, y = where()\nwhile x < 4:\n    move("오른쪽")\n    x, y = where()\n');
  // 움직이지 않음
  const still = N("while", { cond: cx }, { body: [N("harvest"), N("where")] });
  assert.deepEqual(errOn(validate([N("where"), still], ALL9), still.id), [NO_MOVE]);
  // 위치를 다시 알지 않음(x가 그대로)
  const stale = N("while", { cond: cx }, { body: [N("move")] });
  assert.deepEqual(errOn(validate([N("where"), stale], ALL9), stale.id), ["반복 안에서 x 값을 바꿔요"]);
  // 둘 다 없으면 둘 다
  const both = N("while", { cond: { var: "y", op: "<", num: 4 } }, { body: [N("harvest")] });
  assert.deepEqual(errOn(validate([N("where"), both], ALL9), both.id), ["반복 안에서 y 값을 바꿔요", NO_MOVE]);
  // 내 노드 부르기는 움직임으로 센다(움직임은 안쪽 만약 속이어도 됨), 위치 알기는 반복·목록 속도 센다
  const d = N("def", { name: "go_row" }, { body: [N("move")] });
  const wc = N("while", { cond: cx }, { body: [N("call", { name: "go_row" }), N("repeat", { n: 1 }, { body: [N("where")] })] });
  assert.deepEqual(validate([d, N("where"), wc], ALL9), []);
  const wm = N("while", { cond: cx }, { body: [N("if", {}, { body: [N("move")] }), N("foreach", { list: dirList("위") }, { body: [N("where")] })] });
  assert.deepEqual(validate([N("where"), wm], ALL9), []);
  // 위치 알기가 만약·아니면·안쪽 ~하는 동안 속에만 있으면 x가 안 바뀔 수 있다(v0.11 검토)
  for (const inner of [
    N("if", {}, { body: [N("where")] }),
    N("if", {}, { body: [N("harvest")], orelse: [N("where")] }),
    N("while", { cond: "can_harvest" }, { body: [N("harvest"), N("where")] }),
  ]) {
    const wi = N("while", { cond: cx }, { body: [N("call", { name: "go_row" }), inner] });
    assert.deepEqual(errOn(validate([d, N("where"), wi], ALL9), wi.id), ["반복 안에서 x 값을 바꿔요"], JSON.stringify(inner));
  }
});

test("v0.11 검토: 위치 조건 만약 속에서만 count를 더하는 ~하는 동안은 끝나지 않을 수 있어 막는다", () => {
  // x, y = where(); count = 0; while count < 5: if x > 50: count = count + 1
  const w = N("while", { cond: { var: "count", op: "<", num: 5 } }, {
    body: [N("if", { cond: { var: "x", op: ">", num: 50 } }, { body: [N("addvar", { name: "count", value: 1 })] })] });
  const p = [N("where"), N("setvar", { name: "count", value: 0 }), w];
  assert.deepEqual(errOn(validate(p, ALL9), w.id), ["반복 안에서 count 값을 바꿔요"]);
  assert.deepEqual(errOn(codegen(p).errors, w.id), ["반복 안에서 count 값을 바꿔요"]);
});

test("9장 내 노드 안의 x·y: 그 내 노드 안에서 위치 알기를 한 뒤에만", () => {
  // 바깥 위치 알기만으로는 내 노드 안에서 못 씀(문서화한 단순 규칙)
  const i = N("if", { cond: { var: "x", op: "<", num: 3 } }, { body: [N("harvest")] });
  const d = N("def", { name: "tend" }, { body: [i] });
  // 바깥에서 위치 알기를 했으면 「먼저 해요」가 아니라 내 노드 안에서 하라고 알린다(v0.11 검토)
  const DEF_POS = "내 노드 안에서는 그 안에서 위치 알기를 해요";
  assert.deepEqual(errOn(validate([N("where"), d, N("call", { name: "tend" })], ALL9), i.id), [DEF_POS]);
  const svd = N("sayval", { var: "y" });
  const wd = N("while", { cond: { var: "x", op: "<", num: 3 } }, { body: [N("move"), N("where")] });
  const errs4 = validate([N("repeat", { n: 1 }, { body: [N("where")] }), N("def", { name: "tend" }, { body: [svd, wd] })], ALL9);
  assert.deepEqual(errOn(errs4, svd.id), [DEF_POS]);
  assert.deepEqual(errOn(errs4, wd.id), [DEF_POS]);
  // 바깥 어디에도 (앞에서) 위치 알기가 없으면 그대로 「먼저 해요」
  const i0 = N("if", { cond: { var: "x", op: "<", num: 3 } }, { body: [N("harvest")] });
  assert.deepEqual(errOn(validate([N("def", { name: "tend" }, { body: [i0] }), N("call", { name: "tend" })], ALL9), i0.id), [NO_POS]);
  // 내 노드 안에서 먼저 위치 알기
  const d2 = N("def", { name: "tend" }, { body: [N("where"), N("sayval", { var: "x" }),
    N("while", { cond: { var: "x", op: "<", num: 5 } }, { body: [N("move"), N("where")] })] });
  assert.deepEqual(validate([d2, N("call", { name: "tend" })], ALL9), []);
  assert.doesNotMatch(codegen([d2]).code, /global/);
  // 내 노드 안의 위치 알기는 바깥(부른 뒤)에서 x를 정하지 않는다(지역 값)
  const sv = N("sayval", { var: "x" });
  assert.deepEqual(errOn(validate([d2, N("call", { name: "tend" }), sv], ALL9), sv.id), [NO_POS]);
  // 내 노드 안 위치 알기 뒤에도 일반 값 바꾸기는 여전히 막힘
  const a = N("setvar", { name: "count", value: 1 });
  assert.deepEqual(errOn(validate([N("def", { name: "tend" }, { body: [N("where"), a] })], ALL9), a.id),
    ["내 노드 안에서는 값을 바꿀 수 없어요 — 바깥에서 바꿔요"]);
});

// ---- UI 도우미 ----
test("availableValues: 그 노드 자리에서 고를 수 있는 값 이름", () => {
  const sv = N("sayval");
  const pin = N("plant", { crop: LV });
  const inner = N("foreach", { list: cropList("감자") }, { body: [pin] });
  const outer = N("foreach", { list: cropList("당근") }, { body: [N("move", { dir: "오른쪽" }), inner] });
  const fd = N("foreach", { list: dirList("위") }, { body: [outer] });
  const s = N("setvar", { name: "total", value: 0 });
  const first = N("harvest");
  const p = [first, s, N("where"), fd, sv];
  const names = (id) => availableValues(p, id).map((v) => v.name);
  assert.deepEqual(names(first.id), []);
  assert.deepEqual(names(s.id), []);
  assert.deepEqual(names(sv.id), ["total", "x", "y"]);
  assert.deepEqual(availableValues(p, sv.id), [
    { name: "total", arg: "total", source: "var" },
    { name: "x", arg: "x", source: "pos" },
    { name: "y", arg: "y", source: "pos" },
  ]);
  // 안쪽: 목록 변수는 종류마다 가장 안쪽 것
  assert.deepEqual(availableValues(p, pin.id), [
    { name: "total", arg: "total", source: "var" },
    { name: "x", arg: "x", source: "pos" },
    { name: "y", arg: "y", source: "pos" },
    { name: "crop2", arg: { loopVar: true, type: "crop" }, source: "loop" },
    { name: "way", arg: { loopVar: true, type: "dir" }, source: "loop" },
  ]);
  assert.deepEqual(names(outer.body[0].id), ["total", "x", "y", "crop", "way"]);
  assert.deepEqual(availableValues(p, "없음"), []);
  // 내 노드 안은 x·y가 빠진다
  const inDef = N("harvest");
  const p2 = [N("setvar", { name: "count", value: 0 }), N("where"), N("def", { name: "tend" }, { body: [inDef] })];
  assert.deepEqual(availableValues(p2, inDef.id).map((v) => v.name), ["count"]);
  // loopVarAvailable
  assert.equal(loopVarAvailable(p, pin.id, "crop"), "crop2");
  assert.equal(loopVarAvailable(p, pin.id, "dir"), "way");
  assert.equal(loopVarAvailable(p, outer.body[0].id, "crop"), "crop");
  assert.equal(loopVarAvailable(p, sv.id, "crop"), null);
  assert.equal(loopVarAvailable(p, first.id, "dir"), null);
  assert.equal(loopVarAvailable(p, "없음", "dir"), null);
});

test("kindsUsed: cond:store·cond:pos·loopvar 표지", () => {
  const p = [
    N("where"),
    N("if", { cond: { var: "x", op: "<", num: 3 } }, { body: [N("harvest")] }),
    N("while", { cond: { store: { crop: "당근", op: "<", num: 5 } } }, { body: [N("harvest")] }),
    N("foreach", { list: cropList("당근") }, { body: [N("plant", { crop: LV })] }),
  ];
  const k = kindsUsed(p);
  for (const m of ["where", "if", "while", "foreach", "plant", "harvest", "cond:store", "cond:pos", "loopvar"]) assert.ok(k.has(m), m);
  // 표지는 쓴 때만
  const k2 = kindsUsed([N("setvar"), N("if", { cond: { var: "count", op: "<", num: 3 } }, { body: [N("plant")] }),
    N("foreach", { list: cropList("당근") }, { body: [N("plant", { crop: "감자" })] })]);
  assert.ok(!k2.has("cond:store") && !k2.has("cond:pos") && !k2.has("loopvar"));
  // 말하기 값의 목록 변수와 y 비교 ~하는 동안도
  const k3 = kindsUsed([N("where"), N("while", { cond: { var: "y", op: "<", num: 3 } }, { body: [N("move"), N("where")] }),
    N("foreach", { list: dirList("위") }, { body: [N("sayval", { var: { loopVar: true, type: "dir" } })] })]);
  assert.ok(k3.has("cond:pos") && k3.has("loopvar") && k3.has("sayval"));
  // loopvar:act는 이동·심기 값으로 목록 변수를 쓸 때만(말하기만으로는 아님 — 섞어 심기 주문)
  assert.ok(k.has("loopvar:act"));
  assert.ok(!k3.has("loopvar:act"));
  assert.ok(kindsUsed([N("foreach", { list: dirList("위") }, { body: [N("move", { dir: LV })] })]).has("loopvar:act"));
  assert.ok(!k2.has("loopvar:act"));
});

test("v0.11 노드도 codegen·validate가 입력을 바꾸지 않는다", () => {
  const p = deepFreeze([
    N("where"),
    N("foreach", { list: cropList("당근", "감자") }, { body: [N("plant", { crop: LV }), N("sayval", { var: "x" })] }),
    N("while", { cond: { store: { crop: "당근", op: "<", num: 3 } } }, { body: [N("harvest")] }),
  ]);
  const before = JSON.stringify(p);
  codegen(p); validate(p, ALL9); kindsUsed(p); availableValues(p, p[1].body[0].id); loopVarAvailable(p, p[1].body[0].id, "crop");
  assert.equal(JSON.stringify(p), before);
});
