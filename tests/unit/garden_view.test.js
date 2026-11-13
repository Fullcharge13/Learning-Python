// v0.10 작업 4: 텃밭 그림(src/garden/view.js) — 자람 단계, 재생 단계(replayFrames), SVG 그리기
// 재생 규칙은 src/py/runner.py의 farm 모듈과 같아야 한다: 실제 runner를 python3로 돌린 결과로 확인한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stage, replayFrames, thinFrames, render, CELL, REPLAY_FRAMES_MAX } from "../../src/garden/view.js";
import { farmConsistent } from "../../src/garden/state.js";
import { farmSetup, START_ROWS } from "../../data/garden.js";
import { codegen } from "../../src/garden/nodes.js";
import { ORDERS } from "../../data/garden.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// 실제 엔진으로 돌린 result.farm (runner.run(code, farm=…))
function runFarm(code, farm) {
  const py = `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "src", "py"))})
import runner
a = json.loads(sys.stdin.read())
r = runner.run(a["code"], farm=a["farm"])
print(json.dumps({"farm": r.get("farm"), "error": r.get("error")}, ensure_ascii=False))
`;
  const p = spawnSync("python3", ["-c", py], { input: JSON.stringify({ code, farm }), encoding: "utf-8" });
  assert.equal(p.status, 0, p.stderr);
  return JSON.parse(p.stdout);
}

const pick = (s) => ({ size: s.size, cells: s.cells, pie: s.pie, clock: s.clock, store: s.store, seeds: s.seeds });

function replaysTo(code, farm) {
  const r = runFarm(code, farm);
  const frames = replayFrames(farm, r.farm.events);
  assert.equal(frames.length, r.farm.events.length);
  frames.forEach((f, i) => assert.equal(f.event, r.farm.events[i]));
  const last = frames.length ? frames[frames.length - 1].state : farm;
  assert.deepEqual(pick(last), pick(r.farm.state));
  // 정직한 엔진 결과는 언제나 applyRun의 일관성 검사를 통과(검토 C62 I1)
  assert.ok(farmConsistent(farm, r.farm), "engine result is consistent");
  return { r, frames };
}

// ---------------------------------------------------------------- 자람 단계

test("stage: 막 심음 seed → 반쯤 grow → 다 자람 ripe (당근 8, 감자 12)", () => {
  const c = { crop: "당근", planted_at: 10 };
  assert.equal(stage(c, 10, []), "seed");
  assert.equal(stage(c, 13, []), "seed");
  assert.equal(stage(c, 14, []), "grow");
  assert.equal(stage(c, 17, []), "grow");
  assert.equal(stage(c, 18, []), "ripe");
  const p = { crop: "감자", planted_at: 0 };
  assert.equal(stage(p, 11, []), "grow");
  assert.equal(stage(p, 12, []), "ripe");
  assert.equal(stage(null, 5, []), null);
});

test("stage: 비료가 있으면 당근 6·감자 9에 다 자람", () => {
  assert.equal(stage({ crop: "당근", planted_at: 0 }, 6, ["비료"]), "ripe");
  assert.equal(stage({ crop: "당근", planted_at: 0 }, 5, ["비료"]), "grow");
  assert.equal(stage({ crop: "감자", planted_at: 0 }, 9, ["비료"]), "ripe");
});

// ---------------------------------------------------------------- 재생 (실제 엔진과 같은 끝 상태)

test("replayFrames: 시작 프로그램(이동·수확)이 엔진 끝 상태와 같다", () => {
  const farm = farmSetup(START_ROWS);
  const { frames } = replaysTo(codegen(ORDERS[0].solution).code, farm);
  assert.equal(frames[0].facing, "오른쪽");
  assert.deepEqual(frames[0].state.pie, { x: 1, y: 0 });
  assert.equal(frames[1].fx.t, "harvest");
  assert.equal(frames[1].state.store.당근, 1);
  assert.equal(farm.store.당근, 0, "start state is not mutated");
});

test("replayFrames: 심기·실패·덜 자람·빈칸·말하기·감싸기", () => {
  const farm = farmSetup(["C.c", "...", "..."], { clock: 3 });
  const code = [
    'plant("당근")',      // 차 있음 → plant_fail occupied
    'move("왼쪽")',        // 감싸기 → x 2
    'harvest()',           // 덜 자람 → harvest_young
    'harvest()',           // 빈칸
    'plant("감자")',       // 씨앗 없음
    'plant("당근")',
    'print("안녕, 친구들!")',
    'move("위")',          // 감싸기 → y 2
  ].join("\n") + "\n";
  const { frames } = replaysTo(code, farm);
  const ts = frames.map((f) => f.event.t);
  assert.deepEqual(ts, ["plant_fail", "move", "harvest_young", "harvest_empty", "plant_fail", "plant", "say", "move"]);
  assert.equal(frames[6].say, "안녕, 친구들!");
  assert.equal(frames[7].say, null, "bubble ends with the next action");
  assert.equal(frames[7].facing, "위");
  assert.equal(frames[0].fx.t, "plant_fail");
});

test("replayFrames: 감자 씨앗·비료 성장, 여러 줄 반복", () => {
  const farm = farmSetup(["....", "....", "....", "...."], { clock: 50, upgrades: ["grid4", "감자 씨앗", "비료"] });
  const code = 'for i in range(4):\n    plant("감자")\n    move("오른쪽")\nfor i in range(8):\n    move("아래")\nfor i in range(4):\n    harvest()\n    move("오른쪽")\n';
  const { r } = replaysTo(code, farm);
  assert.ok(r.farm.state.store.감자 >= 1);
});

test("replayFrames: 500번에 지친 실행도 끝 상태가 같다", () => {
  const farm = farmSetup(START_ROWS);
  const { r, frames } = replaysTo('while True:\n    move("오른쪽")\n', farm);
  assert.equal(r.farm.stopped, "tired");
  assert.equal(frames.length, 500);
});

test("replayFrames: 오류가 나도 그 직전까지 같다", () => {
  const farm = farmSetup(START_ROWS);
  const { r } = replaysTo('move("오른쪽")\nharvest()\nmove("앞")\n', farm);
  assert.equal(r.error.type, "ValueError");
});

test("replayFrames: 말하기가 많아도(400번) 이동 300번이 모두 남아 끝 상태가 같다(검토 C62 I2)", () => {
  const farm = farmSetup(["C...", ".c..", "....", "...."], { clock: 30, upgrades: ["grid4"] });
  const code = 'for i in range(400):\n    print(i)\n    if i < 300:\n        move("오른쪽")\n        if i % 5 == 0:\n            harvest()\n            plant("당근")\n';
  const { r } = replaysTo(code, farm);
  assert.equal(r.farm.events.filter((e) => e.t === "move").length, 300);
  assert.equal(r.farm.events.filter((e) => e.t === "say").length, 100);
});

test("replayFrames: 기다리다 멈춤·문법 오류도 일관성 검사 통과", () => {
  const farm = farmSetup(START_ROWS);
  assert.equal(replaysTo('move("아래")\nwhile not can_harvest():\n    pass\n', farm).r.farm.stopped, "waited");
  assert.equal(replaysTo("move(\n", farm).r.error.type, "SyntaxError");
});

test("thinFrames: 150장이 넘으면 k장마다 하나만, 수확·심기·말하기와 마지막 장은 남김", () => {
  assert.equal(REPLAY_FRAMES_MAX, 150);
  const farm = farmSetup(START_ROWS);
  const short = replayFrames(farm, runFarm('for i in range(150):\n    move("오른쪽")\n', farm).farm.events);
  assert.equal(thinFrames(short), short, "150장 이하면 그대로");
  const code = 'for i in range(480):\n    move("오른쪽")\n    if i % 40 == 0:\n        harvest()\n        plant("당근")\n        print(i)\n';
  const r = runFarm(code, farm);
  const all = replayFrames(farm, r.farm.events);
  const thin = thinFrames(all);
  const n = all.length;
  const k = Math.ceil(n / 150);
  const keep = all.filter((f) => ["harvest", "plant", "say"].includes(f.event.t));
  assert.ok(thin.length < n && thin.length <= Math.ceil(n / k) + keep.length, `${thin.length} of ${n}`);
  for (const f of keep) assert.ok(thin.includes(f), `keeps ${f.event.t}`);
  assert.equal(thin[thin.length - 1], all[n - 1], "마지막 장 그대로");
  assert.deepEqual(pick(thin[thin.length - 1].state), pick(r.farm.state));
  // 순서는 그대로, 빠진 이동 사이 간격은 k 이하
  const idx = thin.map((f) => all.indexOf(f));
  for (let i = 1; i < idx.length; i++) assert.ok(idx[i] > idx[i - 1] && idx[i] - idx[i - 1] <= k);
});

// v0.12: 토마토와 씨앗 봉투(심기 −1, 다 자란 토마토 거두기 +2, 최대 20, 빈 봉투면 plant_fail no_tomato_seed + ValueError)
test("replayFrames v0.12: 토마토 심기·거두기·덜 자람에 따라 씨앗 봉투가 엔진과 같다", () => {
  const farm = farmSetup(["T.t", "...", "..."], { clock: 30 });
  assert.equal(farm.seeds, 5, "farmSetup 기본 씨앗 5");
  assert.equal(farm.store.토마토, 0);
  const code = [
    'harvest()',            // 다 자란 토마토 → +2 (5 → 7)
    'plant("토마토")',      // −1 (6)
    'move("오른쪽")',
    'plant("토마토")',      // −1 (5)
    'move("오른쪽")',
    'harvest()',            // 덜 자란 토마토 → 씨앗 그대로
    'print(seeds())',
  ].join("\n") + "\n";
  const { r, frames } = replaysTo(code, farm);
  assert.equal(r.farm.state.seeds, 5);
  assert.deepEqual(frames.map((f) => f.state.seeds), [7, 6, 6, 5, 5, 5, 5]);
  assert.equal(frames[0].state.store.토마토, 1);
});

test("replayFrames v0.12: 씨앗은 20개까지, 빈 봉투는 plant_fail(no_tomato_seed) 뒤 ValueError", () => {
  const full = farmSetup(["TTT", "...", "..."], { clock: 30, seeds: 19 });
  const a = replaysTo('for i in range(3):\n    harvest()\n    move("오른쪽")\n', full);
  assert.equal(a.r.farm.state.seeds, 20);
  const empty = farmSetup(["...", "...", "..."], { clock: 3, seeds: 0 });
  const b = replaysTo('plant("당근")\nmove("오른쪽")\nplant("토마토")\n', empty);
  assert.equal(b.r.error.type, "ValueError");
  const last = b.frames[b.frames.length - 1];
  assert.equal(last.event.reason, "no_tomato_seed");
  assert.equal(last.fx.t, "plant_fail");
  assert.equal(last.state.seeds, 0);
  assert.equal(last.state.cells[1], null);
});

test("replayFrames v0.12: 씨앗·토마토 칸이 없는 옛 시작 상태도 엔진처럼 기본값(씨앗 5, 창고 토마토 0)", () => {
  const farm = farmSetup(START_ROWS);
  delete farm.seeds;
  delete farm.store.토마토;
  const { frames } = replaysTo('plant("토마토")\n', farm);
  assert.equal(frames[0].state.seeds, 4);
  assert.equal(frames[0].state.store.토마토, 0);
});

test("replayFrames: 사건이 없으면 빈 목록", () => {
  assert.deepEqual(replayFrames(farmSetup(START_ROWS), []), []);
  assert.deepEqual(replayFrames(farmSetup(START_ROWS), undefined), []);
});

// ---------------------------------------------------------------- 그리기

test("render: 칸 size², 파이 하나, 작물 단계 표시, 접근성 이름", () => {
  const farm = farmSetup(START_ROWS, { clock: 0 });
  const svg = render(farm, {});
  assert.match(svg, /^<svg[^>]*viewBox="0 0 \d+ \d+"/);
  assert.equal((svg.match(/data-cell=/g) || []).length, 9);
  assert.equal((svg.match(/class="g-pie/g) || []).length, 1);
  assert.equal((svg.match(/data-stage="ripe"/g) || []).length, 2);
  assert.equal((svg.match(/data-stage="seed"/g) || []).length, 1);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="[^"]*3×3[^"]*"/);
  for (const size of [3, 4, 5]) {
    const f = farmSetup(Array.from({ length: size }, () => ".".repeat(size)));
    const s = render(f, {});
    assert.equal((s.match(/data-cell=/g) || []).length, size * size);
    const [, w] = s.match(/viewBox="0 0 (\d+) \d+"/);
    assert.equal(Number(w), size * CELL + 16);
  }
});

test("render: 말풍선 글은 이스케이프되고, 효과·방향이 그려진다", () => {
  const farm = farmSetup(START_ROWS);
  const svg = render(farm, { say: '<b>"안녕"</b> & 반가워', facing: "왼쪽", fx: { t: "harvest", x: 1, y: 0, crop: "당근" } });
  assert.ok(!svg.includes("<b>"));
  assert.match(svg, /&lt;b&gt;/);
  assert.match(svg, /class="g-bubble"/);
  assert.match(svg, /class="g-fx harvest"/);
  assert.match(svg, /data-facing="왼쪽"/);
  const long = render(farm, { say: "가".repeat(40) });
  assert.match(long, /…/);
  assert.match(render(farm, { fx: { t: "plant_fail", x: 0, y: 0 } }), /class="g-fx plant_fail"/);
  assert.match(render(farm, { fx: { t: "harvest_young", x: 0, y: 0, crop: "당근" } }), /class="g-fx harvest_young"/);
});

test("render: 말풍선 판·글자는 CSS 이름표를 따른다(v0.19.0 어둡게, 밝게는 같은 값)", () => {
  const farm = farmSetup(START_ROWS);
  const b = render(farm, { say: "안녕" }).match(/<g class="g-bubble">[\s\S]*?<\/g>/)[0];
  // style(이름표)이 표현 속성(밝게 값, 대비용 예비)보다 앞선다
  assert.match(b, /<rect [^>]*fill="#FFFDF8" stroke="#22304A" style="fill:var\(--card\);stroke:var\(--ink\)"/);
  assert.match(b, /<path [^>]*style="fill:var\(--card\);stroke:var\(--ink\)"/);
  assert.match(b, /<path [^>]*style="stroke:var\(--card\)"/);
  assert.match(b, /<text [^>]*style="fill:var\(--ink\)"/);
  assert.equal((b.match(/style="/g) || []).length, 4, b);
  const e = render(farm, { fx: { t: "harvest_empty", x: 0, y: 0 } });
  assert.match(e, /<circle [^>]*style="fill:var\(--card\)"/);
});

test("render: 같은 입력이면 같은 글자(id·defs 없음)", () => {
  const farm = farmSetup(START_ROWS);
  assert.equal(render(farm, { say: "a" }), render(farm, { say: "a" }));
  assert.ok(!/ id="/.test(render(farm, {})));
});

test("render v0.12: 토마토는 단계마다 다른 그림(씨앗 떡잎 → 풋열매 → 빨간 열매), 당근·감자 그림과 다름", () => {
  const T = (planted_at) => ({ crop: "토마토", planted_at });
  const st = { size: 3, cells: [T(0), T(15), T(19), { crop: "당근", planted_at: 0 }, null, null, null, null, null],
    pie: { x: 2, y: 2 }, clock: 20, upgrades: [] };
  const svg = render(st);
  assert.match(svg, /data-cell="0" data-crop="토마토" data-stage="ripe"/);
  assert.match(svg, /data-cell="1" data-crop="토마토" data-stage="grow"/);
  assert.match(svg, /data-cell="2" data-crop="토마토" data-stage="seed"/);
  const crops = [...svg.matchAll(/<g class="g-crop">([\s\S]*?)<\/g>(?=<g class="g-crop">|<g class="g-pie")/g)].map((m) => m[1]);
  assert.equal(crops.length, 4);
  assert.match(crops[0], /#E2483A/);              // 다 자란 토마토: 빨간 열매
  assert.doesNotMatch(crops[1], /#E2483A/);       // 자라는 중: 아직 빨갛지 않음
  assert.match(crops[1], /#8CC63F/);
  assert.doesNotMatch(crops[2], /#8CC63F|#E2483A/);
  assert.doesNotMatch(crops[3], /#E2483A/);       // 당근은 그대로
  assert.equal(render(st), svg);                   // 같은 입력 같은 글자
});
