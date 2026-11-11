// v0.13.5 텃밭 영어: 노드 코드 생성·새 노드 기본 글자·화면 이름(쓸 때 번역)·쪽지(영어 글)·쪽지 세기
// 설계서 docs/specs/2026-11-11-영어판-설계.md §5-1. 안쪽 열쇠(저장·노드 값·사건·판정)는 한국어 그대로.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setLang, usePack, missingKeys } from "../../src/i18n.js";
import {
  NODES, COND, LIST_LABELS, PATTERNS, MSG, codegen, condCode, patternInfo, newNode, valueTextReset, validate,
  unlockedKinds,
} from "../../src/garden/nodes.js";
import {
  runFiles, noteCounts, newGarden, MSG as SMSG, canBuy, deliver, orderShortfall, applyRun, runInput,
} from "../../src/garden/state.js";
import { ORDERS, DAILY_NOTES, UPGRADES, SEED_PACK } from "../../data/garden.js";

const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const read = (f) => JSON.parse(readFileSync(new URL(`../../i18n/en/${f}`, import.meta.url), "utf8"));
const PACK = { ui: read("ui.garden_nodes.json"), data: read("data.json") };
const ALL = unlockedKinds(new Set(Array.from({ length: 17 }, (_, i) => i + 1)));

beforeEach(() => { usePack("en", PACK); setLang("ko"); });

let seq = 0;
const N = (kind, args = {}, body) => {
  const n = { id: `e${++seq}`, kind, args: { ...newNode(kind, 0).args, ...args } };
  if (NODES[kind].body) n.body = body || [];
  if (NODES[kind].handler) n.handler = [];
  return n;
};
const en = (p) => codegen(p, { lang: "en" }).code;
const ko = (p) => codegen(p, { lang: "ko" }).code;

// ---- 1. 코드 생성 ----
test("codegen en: 작물·방향·목록은 영어 이름", () => {
  assert.equal(en([N("plant", { crop: "당근" }), N("move", { dir: "오른쪽" }), N("move", { dir: "위" })]),
    'plant("carrot")\nmove("right")\nmove("up")\n');
  assert.equal(en([N("foreach", { list: { type: "crop", items: ["당근", "감자", "토마토"] } }, [N("harvest")])]),
    'for crop in ["carrot", "potato", "tomato"]:\n    harvest()\n');
  assert.equal(en([N("foreach", { list: { type: "dir", items: ["오른쪽", "아래", "왼쪽"] } }, [N("move", { dir: { loopVar: true } })])]),
    'for way in ["right", "down", "left"]:\n    move(way)\n');
});

test("codegen en: 조건(빈칸·작물·창고)", () => {
  const ifs = (cond) => en([N("if", { cond }, [N("harvest")])]).split("\n")[0];
  assert.equal(ifs("here_empty"), 'if what_here() == "empty":');
  assert.equal(ifs("here_carrot"), 'if what_here() == "carrot":');
  assert.equal(ifs("here_potato"), 'if what_here() == "potato":');
  assert.equal(ifs("can_harvest"), "if can_harvest():");
  assert.equal(ifs({ store: { crop: "감자", op: "<", num: 10 } }), 'if store()["potato"] < 10:');
  assert.equal(condCode({ store: { crop: "토마토", op: ">", num: 1 } }, "en"), 'store()["tomato"] > 1');
  assert.equal(condCode("here_empty", "ko"), 'what_here() == "빈칸"');
});

test("codegen en: 쪽지 파일·농장일지 이름", () => {
  const p = [N("readnote", { file: "주문서.txt" }, [N("splitline")]), N("readnote", { file: "손글씨주문.txt" }, [N("say")]),
    N("readnote", { file: "농장일지.txt" }, [N("say")]), N("setvar"), N("writelog")];
  const c = en(p);
  assert.match(c, /^with open\("orders\.txt"\) as f:$/m);
  assert.match(c, /^with open\("handwritten\.txt"\) as f:$/m);
  assert.match(c, /^with open\("farm_log\.txt"\) as f:$/m);
  assert.match(c, /^with open\("farm_log\.txt", "a"\) as f:$/m);
  assert.match(c, /crop, n = line\.split\(\)/);
});

test("codegen en: 패턴 찾기 — 숫자+작물(n, crop 순), 작물만, 숫자만", () => {
  const fa = (pattern) => en([N("readnote", { file: "손글씨주문.txt" }, [N("findall", { pattern }, [N("harvest")])])]).split("\n");
  assert.equal(fa("crop_num")[0], "import re");
  assert.equal(fa("crop_num")[3].trim(), 'for n, crop in re.findall(r"(\\d+)\\s*(carrot|potato|tomato)", line):');
  assert.equal(fa("crop")[3].trim(), 'for crop in re.findall(r"carrot|potato|tomato", line):');
  assert.equal(fa("num")[3].trim(), 'for n in re.findall(r"\\d+", line):');
});

test("codegen: 한국어는 그대로, lang을 안 주면 지금 언어", () => {
  const p = [N("plant", { crop: "감자" }), N("if", { cond: "here_empty" }, [N("move", { dir: "아래" })]),
    N("readnote", { file: "손글씨주문.txt" }, [N("findall", { pattern: "crop_num" }, [N("plant", { crop: { noteVar: "crop" } })])])];
  const k = ko(p);
  assert.match(k, /plant\("감자"\)/);
  assert.match(k, /for crop, n in re\.findall\(r"\(당근\|감자\|토마토\)\\s\*\(\\d\+\)", line\):/);
  assert.equal(codegen(p).code, k, "ko 기본");
  setLang("en");
  assert.equal(codegen(p).code, en(p), "en이면 기본이 en");
  assert.equal(codegen(p, { lang: "ko" }).code, k, "lang을 주면 그 언어");
  assert.deepEqual(codegen(p, { lang: "en" }).lineMap, codegen(p, { lang: "ko" }).lineMap, "줄 표는 언어와 무관");
});

test("patternInfo: 언어별 re·vars, PATTERNS는 지금 언어", () => {
  assert.deepEqual(patternInfo("crop_num", "ko"), { re: "(당근|감자|토마토)\\s*(\\d+)", vars: ["crop", "n"] });
  assert.deepEqual(patternInfo("crop_num", "en"), { re: "(\\d+)\\s*(carrot|potato|tomato)", vars: ["n", "crop"] });
  assert.deepEqual(patternInfo("crop", "en"), { re: "carrot|potato|tomato", vars: ["crop"] });
  assert.deepEqual(patternInfo("num", "en"), { re: "\\d+", vars: ["n"] });
  assert.equal(patternInfo("nope", "en"), null);
  setLang("en");
  assert.deepEqual(PATTERNS.crop_num.vars, ["n", "crop"]);
  assert.equal(PATTERNS.crop_num.label, "number + crop");
});

test("검사(validate)는 언어와 무관: 같은 프로그램이면 같은 오류 노드", () => {
  const p = [N("readnote", { file: "손글씨주문.txt" }, [N("findall", { pattern: "num" }, [N("plant", { crop: { noteVar: "crop" } })])])];
  const a = validate(p, ALL).map((e) => e.nodeId);
  setLang("en");
  const b = validate(p, ALL);
  assert.deepEqual(b.map((e) => e.nodeId), a);
  for (const e of b) assert.ok(!HANGUL.test(e.msg), e.msg);
  assert.match(b[0].msg, /numbers only/);
});

// ---- 2. 새 노드 기본 글자 ----
test("newNode: 지금 언어의 기본 글자, 검사 통과", () => {
  assert.equal(newNode("say", 1).args.text, "안녕!");
  setLang("en");
  assert.equal(newNode("say", 1).args.text, "Hi!");
  assert.deepEqual([newNode("sayval", 1).args.pre, newNode("sayval", 1).args.post], ["carrots: ", ""]);
  assert.deepEqual([newNode("writelog", 1).args.pre, newNode("writelog", 1).args.post], ["harvest ", ""]);
  const p = [N("setvar"), N("say"), N("sayval"), N("writelog")];
  assert.deepEqual(validate(p, ALL), []);
  assert.equal(en(p), 'count = 0\nprint("Hi!")\nprint("carrots: " + str(count))\nwith open("farm_log.txt", "a") as f:\n    f.write("harvest " + str(count) + "\\n")\n');
});

test("valueTextReset: 두 언어의 기본 글자를 모두 알아본다", () => {
  assert.deepEqual(valueTextReset("sayval", { pre: "당근 ", post: "개" }, "note"), { pre: "", post: "" });
  assert.deepEqual(valueTextReset("sayval", { pre: "carrots: ", post: "" }, "note"), { pre: "", post: "" });
  assert.deepEqual(valueTextReset("writelog", { pre: "harvest ", post: "개" }, "pos"), { pre: "", post: "" });
  assert.deepEqual(valueTextReset("writelog", { pre: "got ", post: "!" }, "loop"), {});
  setLang("en");
  assert.deepEqual(valueTextReset("sayval", { pre: "당근 ", post: "개" }, "note"), { pre: "", post: "" });
  assert.deepEqual(valueTextReset("sayval", { pre: "carrots: ", post: "" }, "var"), {});
});

// ---- 3. 화면 이름은 쓸 때 번역 ----
test("화면 이름: 노드·조건·목록·패턴·검사 글은 쓸 때 언어를 따른다", () => {
  assert.equal(NODES.move.label, "이동");
  setLang("en");
  assert.equal(NODES.move.label, "Move");
  for (const [k, s] of Object.entries(NODES)) assert.ok(s.label && !HANGUL.test(s.label), k);
  for (const c of COND) assert.ok(!HANGUL.test(c.label) && !HANGUL.test(c.code), c.id);
  assert.equal(COND.find((c) => c.id === "here_empty").code, 'what_here() == "empty"');
  for (const v of Object.values(LIST_LABELS)) assert.ok(!HANGUL.test(v), v);
  for (const p of Object.values(PATTERNS)) assert.ok(!HANGUL.test(p.label), p.label);
  for (const [k, v] of Object.entries(MSG)) {
    const s = typeof v === "function" ? v("A", "B", "C") : v;
    assert.ok(typeof s === "string" && !HANGUL.test(s), `${k}: ${s}`);
  }
  assert.equal(MSG.locked(3), "Opens after Chapter 3");
  setLang("ko");
  assert.equal(MSG.locked(3), "3장을 끝내면 열려요");
});

// ---- 4·5. 쪽지 ----
test("noteCounts en: 줄마다 「crop n」, 숫자+작물(복수형도), 안쪽 열쇠로", () => {
  assert.deepEqual(noteCounts("carrot 2\npotato 1\ncarrot 1\n", undefined, "en"), { 당근: 3, 감자: 1 });
  assert.deepEqual(noteCounts("kiwi 2\n\ntomato 3", undefined, "en"), { 토마토: 3 });
  assert.deepEqual(noteCounts("Ria: 3 carrots, please! And 2 tomatoes~", "crop_num", "en"), { 당근: 3, 토마토: 2 });
  assert.deepEqual(noteCounts("Ria: 1 potato and 2carrots", "crop_num", "en"), { 감자: 1, 당근: 2 });
  assert.deepEqual(noteCounts("당근 2", undefined, "ko"), { 당근: 2 }, "ko 그대로");
});

test("영어 쪽지는 한국어 쪽지와 작물별 개수가 같다(오늘의 쪽지·주문 쪽지 전부)", () => {
  setLang("en");
  const parse = { "주문서.txt": undefined, "손글씨주문.txt": "crop_num" };
  for (const [file, list] of Object.entries(DAILY_NOTES)) {
    list.forEach((ko, i) => {
      const g = { ...newGarden(), order: { idx: ORDERS.length, done: [], paid: [] }, runs: i };
      const text = runFiles(g, "en")[file];
      assert.ok(!HANGUL.test(text), text);
      assert.deepEqual(noteCounts(text, parse[file], "en"), noteCounts(ko, parse[file]), `${file} ${i}`);
    });
  }
  const withNote = ORDERS.map((o, i) => [o, i]).filter(([o]) => o.note);
  assert.equal(withNote.length, 3);
  for (const [o, i] of withNote) {
    const text = runFiles({ ...newGarden(), order: { idx: i, done: [], paid: [] } }, "en")[o.note.file];
    assert.ok(!HANGUL.test(text), text);
    const p = parse[o.note.file];
    assert.deepEqual(noteCounts(text, p, "en"), noteCounts(o.note.text, p), o.id);
    if (o.note.file === "손글씨주문.txt") assert.deepEqual(noteCounts(text, "crop_num", "en"), noteCounts(o.note.text, "crop_num"), `${o.id} crop_num`);
    if (o.id === "o_digits") assert.deepEqual(text.match(/\d+/g), o.note.text.match(/\d+/g), "숫자만 패턴도 같은 숫자");
  }
});

test("runFiles: 열쇠는 안쪽 이름, 글은 실행 언어(기본 지금 언어), 농장일지는 그대로", () => {
  const g = { ...newGarden(), files: { "농장일지.txt": "수확 4개\n" } };
  const k = runFiles(g, "ko");
  const e = runFiles(g, "en");
  assert.deepEqual(Object.keys(e), Object.keys(k));
  assert.deepEqual(Object.keys(e).sort(), ["농장일지.txt", "손글씨주문.txt", "주문서.txt"].sort());
  assert.equal(e["주문서.txt"], "carrot 2\npotato 1");
  assert.equal(e["농장일지.txt"], "수확 4개\n", "학습자가 쓴 일지는 그대로");
  assert.deepEqual(runFiles(g), k, "ko 기본");
  setLang("en");
  assert.deepEqual(runFiles(g), e, "지금 언어가 기본");
  assert.deepEqual(runFiles(g, "ko"), k);
});

// ---- 데이터 표·상태 글 ----
test("주문·성장·씨앗 봉투 이름은 지금 언어(data.json), 주문 판정 쪽지는 한국어 그대로", () => {
  const o = ORDERS[0];
  assert.equal(o.title, "첫 수확");
  setLang("en");
  for (const x of ORDERS) assert.ok(!HANGUL.test(x.title) && !HANGUL.test(x.text), x.id);
  for (const u of UPGRADES) assert.ok(!HANGUL.test(u.label), u.id);
  assert.ok(!HANGUL.test(SEED_PACK.label));
  assert.equal(ORDERS.find((x) => x.id === "o_note").note.text, "당근 2\n감자 1");
  assert.deepEqual(missingKeys().filter((k) => k.startsWith("garden.")), []);
});

test("상태 글(state MSG·보내기·사기·실행 결과·쪽지 모자람)은 영어에서 한글이 없다", () => {
  setLang("en");
  for (const [k, v] of Object.entries(SMSG)) {
    const s = typeof v === "function" ? v("X") : v;
    assert.ok(!HANGUL.test(s), `${k}: ${s}`);
  }
  const g = newGarden();
  const lunch = ORDERS.findIndex((o) => o.id === "o_lunch");
  const d = deliver({ ...g, order: { idx: lunch, done: [], paid: [] }, store: { 당근: 1, 감자: 0, 토마토: 0 } }, new Set([1]));
  assert.equal(d.error, "Short by 2 carrots");
  const one = deliver({ ...g, order: { idx: lunch, done: [], paid: [] }, store: { 당근: 2, 감자: 0, 토마토: 0 } }, new Set([1]));
  assert.equal(one.error, "Short by 1 carrot");
  const b = canBuy(g, "grid5", new Set([1]));
  assert.ok(!HANGUL.test(b.reason), b.reason);
  const c = canBuy(g, "비료", new Set([1]));
  assert.equal(c.reason, "Short by 20 potatoes");
  // 실행 결과 글: 거둔 작물
  const input = runInput(g);
  const cells = input.cells.slice();
  cells[1] = null;
  const farm = { state: { ...input, cells, pie: { x: 1, y: 0 }, clock: input.clock + 2, store: { ...input.store, 당근: 1 } },
    events: [{ t: "move", x: 1, y: 0 }, { t: "harvest", x: 1, y: 0, crop: "당근" }], actions: 2 };
  assert.equal(applyRun(g, { farm }, { mode: "nodes", program: [] }).message, "Harvested 1 carrot");
  // 쪽지 모자람
  const on = ORDERS.find((o) => o.id === "o_note");
  const sf = orderShortfall(on, { farm: { events: [{ t: "plant", crop: "당근" }, { t: "plant_fail", reason: "occupied" }] } });
  for (const l of sf.lines) assert.ok(!HANGUL.test(l), l);
  assert.equal(sf.lines[0], "Note: carrot 2 · potato 1");
});

// v0.13.5 검토 I1: 코드 모드에서 노드가 만든 코드를 고치지 않았다면, 언어를 바꾼 뒤 그 언어 코드로 바뀐다(고친 코드는 그대로)
test("codeForLang: 고치지 않은 코드는 지금 언어로, 고친 코드는 그대로", async () => {
  const { codeForLang, codeMatchesNodes } = await import("../../src/garden/state.js");
  const { codegen } = await import("../../src/garden/nodes.js");
  const program = [{ id: 1, kind: "move", args: { dir: "오른쪽" } }, { id: 2, kind: "plant", args: { crop: "당근" } }];
  const ko = codegen(program, { lang: "ko" }).code;
  const en = codegen(program, { lang: "en" }).code;
  const g = { mode: "code", program, code: ko };
  assert.equal(codeForLang(g, "en").code, en);
  assert.equal(codeForLang({ ...g, code: en }, "ko").code, ko);
  assert.equal(codeForLang(g, "ko"), g, "same language: unchanged object");
  const edited = { ...g, code: ko + 'print("hi")\n' };
  assert.equal(codeForLang(edited, "en"), edited, "edited code kept");
  assert.equal(codeForLang({ ...g, mode: "nodes" }, "en").code, ko, "node mode untouched");
  assert.ok(codeMatchesNodes(program, ko) && codeMatchesNodes(program, en), "either language counts as not edited");
  assert.ok(!codeMatchesNodes(program, ko + "x = 1\n"));
});
