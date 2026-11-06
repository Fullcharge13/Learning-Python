// v0.12.1 텃밭 QA 고침: 쪽지 주문 모자람 안내 · 조사 · 「쓴」 표지 · 패턴 값 안내 · 남은 주문 완료 창 · 값 글자 기본값
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newGarden, cleanGarden, applyRun, runInput, orderShortfall, josa, addPendingDone, dropPendingDone,
} from "../../src/garden/state.js";
import { ORDERS } from "../../data/garden.js";
import { NODES, newNode, kindsUsed, validate, unlockedKinds, valueTextReset } from "../../src/garden/nodes.js";

let seq = 0;
const N = (kind, args = {}, extra = {}) => {
  const n = { id: `q${++seq}`, kind, args: { ...newNode(kind, 0).args, ...args } };
  if (NODES[kind].body) n.body = extra.body || [];
  if (NODES[kind].handler) n.handler = extra.handler || [];
  return n;
};
const NV = (v) => ({ noteVar: v });
const RN = (file, body) => N("readnote", { file }, { body });
const FA = (pattern, body) => N("findall", { pattern }, { body });
const ALL12 = unlockedKinds(new Set(Array.from({ length: 12 }, (_, i) => i + 1)));
const byId = (id) => ORDERS.find((o) => o.id === id);
const idxOf = (id) => ORDERS.findIndex((o) => o.id === id);
const upTo = (n) => new Set(Array.from({ length: n }, (_, i) => i + 1));
const at = (g, idx) => ({ ...g, order: { ...g.order, idx, done: ORDERS.slice(0, idx).map((o) => o.id) } });

// ---- 2. 쪽지 주문 모자람 안내 ----
const farmOf = (events) => ({ farm: { events, state: {}, stopped: null, actions: events.length }, error: null });
const P = (crop) => ({ t: "plant", crop, x: 0, y: 0 });

test("orderShortfall: 쪽지와 심은 수가 다르면 쪽지·심은 것 두 줄", () => {
  const o = byId("o_note");   // 당근 2 · 감자 1
  const s = orderShortfall(o, farmOf([P("당근")]));
  assert.deepEqual(s, { lines: ["쪽지: 당근 2 · 감자 1", "이번에 심은 것: 당근 1"] });
  assert.deepEqual(orderShortfall(o, farmOf([])).lines[1], "이번에 심은 것: 없음");
  // 더 심어도 알려 줌
  assert.deepEqual(orderShortfall(o, farmOf([P("당근"), P("당근"), P("감자"), P("감자")])).lines,
    ["쪽지: 당근 2 · 감자 1", "이번에 심은 것: 당근 2 · 감자 2"]);
});

test("orderShortfall: 칸이 차서 못 심음 · 토마토 씨앗이 떨어짐 힌트", () => {
  const o = byId("o_hand");   // 당근 3 · 토마토 2 (작물+숫자)
  const occ = orderShortfall(o, farmOf([P("당근"), { t: "plant_fail", reason: "occupied", crop: "당근", x: 1, y: 0 }]));
  assert.deepEqual(occ.lines, ["쪽지: 당근 3 · 토마토 2", "이번에 심은 것: 당근 1", "빈 칸이 모자랐어요 — 먼저 거둬요"]);
  const seed = orderShortfall(o, farmOf([P("당근"), P("당근"), P("당근"), { t: "plant_fail", reason: "no_tomato_seed", crop: "토마토", x: 0, y: 1 }]));
  assert.deepEqual(seed.lines.slice(2), ["토마토 씨앗이 떨어졌어요 — 성장에서 씨앗을 사요"]);
});

test("orderShortfall: 맞게 심었거나 쪽지 주문이 아니거나 결과가 없으면 null", () => {
  assert.equal(orderShortfall(byId("o_note"), farmOf([P("당근"), P("당근"), P("감자")])), null);
  assert.equal(orderShortfall(byId("o_first"), farmOf([P("당근")])), null);
  assert.equal(orderShortfall(byId("o_note"), { error: { type: "Timeout" } }), null);
  assert.equal(orderShortfall(null, farmOf([])), null);
});

// ---- 3. 조사 ----
test("josa: 받침에 맞는 이에요/예요 · 으로/로(ㄹ 받침은 로) · 숫자·영어", () => {
  assert.equal(josa("첫 수확", "이에요"), "이에요");
  assert.equal(josa("파이의 인사", "이에요"), "예요");
  assert.equal(josa("씨앗 심기", "이에요"), "예요");
  assert.equal(josa("숫자만", "으로"), "으로");
  assert.equal(josa("작물+숫자", "으로"), "로");
  assert.equal(josa("작물 이름만", "으로"), "으로");
  assert.equal(josa("농장일지", "으로"), "로");
  assert.equal(josa("한 줄", "으로"), "로", "ㄹ 받침은 로");
  assert.equal(josa("감자 장부", "을"), "를");
  assert.equal(josa("첫 감자", "이"), "가");
  assert.equal(josa("밭 3", "으로"), "으로");
  assert.equal(josa("밭 4", "으로"), "로");
  assert.equal(josa("밭 1", "으로"), "로", "일 — ㄹ");
  assert.equal(josa("count", "이에요"), "예요");
});

// ---- 4. 「쓴」 표지 ----
test("kindsUsed: findall:<패턴>:used — 그 패턴 찾기 안에서 쪽지 값을 씀", () => {
  const sayN = N("sayval", { pre: "", var: NV("n"), post: "" });
  assert.ok(kindsUsed([RN("손글씨주문.txt", [FA("num", [sayN])])]).has("findall:num:used"));
  const rep = N("repeat", { n: { value: "n" } }, { body: [N("move")] });
  assert.ok(kindsUsed([RN("손글씨주문.txt", [FA("num", [rep])])]).has("findall:num:used"));
  // 안 쓰면 표지 없음(바깥 줄만 말해도)
  const k = kindsUsed([RN("손글씨주문.txt", [FA("num", [N("say", { text: "안녕" })]), N("sayval", { pre: "", var: NV("line"), post: "" })])]);
  assert.ok(k.has("findall:num") && !k.has("findall:num:used"));
  // 안쪽 줄 나누기가 n을 덮은 뒤에 쓴 n은 패턴의 n이 아님
  const k2 = kindsUsed([RN("손글씨주문.txt", [FA("num", [N("splitline"), N("sayval", { pre: "", var: NV("n"), post: "" })])])]);
  assert.ok(!k2.has("findall:num:used"));
});

test("kindsUsed: readnote:<파일>:used — 그 쪽지 읽기 안에서 쪽지 값(line·crop·n)을 씀", () => {
  const J = "농장일지.txt";
  assert.ok(kindsUsed([RN(J, [N("sayval", { pre: "일지: ", var: NV("line"), post: "" })])]).has(`readnote:${J}:used`));
  assert.ok(kindsUsed([RN(J, [N("writelog", { var: NV("line") })])]).has(`readnote:${J}:used`));
  const k = kindsUsed([RN(J, [N("say", { text: "읽었어" })])]);
  assert.ok(k.has(`readnote:${J}`) && !k.has(`readnote:${J}:used`));
  assert.ok(kindsUsed([RN("주문서.txt", [N("splitline"), N("plant", { crop: NV("crop") })])]).has("readnote:주문서.txt:used"));
});

test("주문: 숫자만 뽑기·어제 일지 읽기는 값을 써야 해냄", () => {
  assert.deepEqual(byId("o_digits").goal, { type: "use", kind: "findall:num:used" });
  assert.deepEqual(byId("o_readlog").goal, { type: "use", kind: "readnote:농장일지.txt:used" });
  for (const id of ["o_digits", "o_readlog"]) assert.ok(kindsUsed(byId(id).solution).has(byId(id).goal.kind), id);
  // 숫자만 패턴을 쓰기만 하고 n을 안 쓰면 해내지 못함
  const i = idxOf("o_digits");
  const g = at(newGarden(), i);
  const st = runInput(g, upTo(12));
  const r = { error: null, farm: { events: [], state: { ...st }, stopped: null, actions: 0 } };
  const lazy = [RN("손글씨주문.txt", [FA("num", [N("say", { text: "찾았어" })])])];
  assert.equal(applyRun(g, r, { program: lazy, mode: "nodes", passed: upTo(12) }).orderDone, null);
  assert.equal(applyRun(g, r, { program: byId("o_digits").solution, mode: "nodes", passed: upTo(12) }).orderDone?.id, "o_digits");
});

// ---- 5. 패턴에 없는 쪽지 값 ----
test("validate: 숫자만 패턴 안의 심기 crop → 패턴을 바꾸라는 안내", () => {
  const pl = N("plant", { crop: NV("crop") });
  const errs = validate([RN("손글씨주문.txt", [FA("num", [pl])])], ALL12);
  assert.deepEqual(errs.filter((e) => e.nodeId === pl.id).map((e) => e.msg),
    ["숫자만 패턴에서는 crop이 생기지 않아요 — 작물+숫자 패턴을 골라요"]);
  const rep = N("repeat", { n: { value: "n" } }, { body: [N("move")] });
  const e2 = validate([RN("손글씨주문.txt", [FA("crop", [rep])])], ALL12);
  assert.deepEqual(e2.filter((e) => e.nodeId === rep.id).map((e) => e.msg),
    ["작물 이름만 패턴에서는 n이 생기지 않아요 — 작물+숫자 패턴을 골라요"]);
  // 패턴 찾기 밖은 예전 안내 그대로
  const pl2 = N("plant", { crop: NV("crop") });
  assert.deepEqual(validate([RN("주문서.txt", [pl2])], ALL12).map((e) => e.msg), ["crop 값은 줄 나누기·패턴 찾기 뒤에서만 써요"]);
  // 바깥 줄 나누기가 crop을 정했으면 오류 없음
  const pl3 = N("plant", { crop: NV("crop") });
  assert.deepEqual(validate([RN("주문서.txt", [N("splitline"), FA("num", [pl3, N("move")])])], ALL12), []);
});

// ---- 6. 남은 주문 완료 창 ----
test("pendingDone: 새 텃밭 []·저장 정리(모르는 id·겹침 버림)·더하기·빼기는 새 객체", () => {
  assert.deepEqual(newGarden().pendingDone, []);
  assert.deepEqual(cleanGarden({ ...newGarden(), pendingDone: ["o_first", "nope", "o_first", 3, "o_hello"] }).pendingDone, ["o_first", "o_hello"]);
  const old = { ...newGarden() };
  delete old.pendingDone;
  assert.deepEqual(cleanGarden(old).pendingDone, []);
  const g = newGarden();
  const a = addPendingDone(g, ["o_first", "o_hello"]);
  assert.deepEqual(a.pendingDone, ["o_first", "o_hello"]);
  assert.deepEqual(g.pendingDone, [], "받은 텃밭은 그대로");
  assert.deepEqual(addPendingDone(a, ["o_first"]).pendingDone, ["o_first", "o_hello"]);
  const b = dropPendingDone(a, "o_first");
  assert.deepEqual(b.pendingDone, ["o_hello"]);
  assert.deepEqual(a.pendingDone, ["o_first", "o_hello"]);
  assert.equal(dropPendingDone(b, "o_zzz"), b, "없는 id면 그대로");
});

// ---- 8. 값 글자 기본값 ----
test("valueTextReset: 쪽지 값·위치·목록 값을 고르면 기본 앞·뒤 글자만 비움", () => {
  const sv = N("sayval");
  assert.deepEqual(valueTextReset("sayval", sv.args, "note"), { pre: "", post: "" });
  assert.deepEqual(valueTextReset("sayval", sv.args, "pos"), { pre: "", post: "" });
  assert.deepEqual(valueTextReset("sayval", sv.args, "loop"), { pre: "", post: "" });
  assert.deepEqual(valueTextReset("sayval", sv.args, "var"), {});
  assert.deepEqual(valueTextReset("sayval", { ...sv.args, pre: "거둔 " }, "note"), { post: "" }, "고친 앞 글자는 둠");
  const wl = N("writelog");
  assert.deepEqual(valueTextReset("writelog", wl.args, "note"), { pre: "", post: "" });
  assert.deepEqual(valueTextReset("say", {}, "note"), {});
});

// ---- 3·4. 주문 목표 글(화면) ----
test("goalText: 「쓴」 표지 주문 글 · 패턴 이름 뒤 으로/로", async () => {
  const { goalText } = await import("../../src/ui/garden.js");
  assert.equal(goalText(byId("o_digits")), "「패턴 찾기: 숫자만」으로 찾은 값(n)을 노드에 넣어 끝까지 실행하기");
  assert.equal(goalText(byId("o_readlog")), "「쪽지 읽기」로 농장일지.txt를 열어 읽은 줄(line)을 노드에 넣어 끝까지 실행하기");
  assert.equal(goalText({ goal: { type: "use", kind: "findall:crop_num" } }), "「패턴 찾기: 작물+숫자」로 끝까지 실행하기");
  assert.equal(goalText({ goal: { type: "use", kind: "findall:crop" } }), "「패턴 찾기: 작물 이름만」으로 끝까지 실행하기");
  for (const o of ORDERS) assert.doesNotMatch(goalText(o), /:used|undefined/, o.id);
});
