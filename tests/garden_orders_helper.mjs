// tests/garden_orders.py의 도우미: 주문 판정 규칙은 src/garden/state.js 한 곳에만 두고 여기서 부른다.
//   node tests/garden_orders_helper.mjs prepare        → 주문마다 { id, need, title, goal, code, errors, setup, files, hasRun }
//                                                         files: 그 주문 차례의 쪽지함(state.runFiles, v0.12) → runner run(files=)
//   node tests/garden_orders_helper.mjs judge < 입력    → 입력 { results: { 주문 id: runner 결과 | null } }
//                                                         출력 주문마다 { id, ok, detail }
//   node tests/garden_orders_helper.mjs stuck          → (판정 C71 C2) 씨앗 0·밭에 토마토 없는 o_hand 차례에서 「토마토 씨앗 5개」를
//                                                         산 뒤의 { code, setup, files, before: { seeds, error }, after: { seeds, store } }
//   node tests/garden_orders_helper.mjs stuck_judge < { result } → { ok, detail } (산 뒤 정답 실행 결과로 o_hand가 끝나나)
import { ORDERS } from "../data/garden.js";
import { codegen, validate, unlockedKinds } from "../src/garden/nodes.js";
import { newGarden, cleanGarden, runInput, runFiles, applyRun, deliver, buy, canBuy } from "../src/garden/state.js";
import { usePack, setLang } from "../src/i18n.js";
import fs from "node:fs";

// v0.13.5: GARDEN_LANG=en이면 영어 꾸러미를 쓰고 영어 코드·영어 쪽지로 만든다(판정은 언어와 상관없이 같은 규칙)
const LANG = process.env.GARDEN_LANG === "en" ? "en" : "ko";
if (LANG === "en") {
  const dir = new URL("../i18n/en/", import.meta.url);
  const pack = { ui: {}, data: {} };
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const part = JSON.parse(fs.readFileSync(new URL(f, dir), "utf8"));
    if (f === "data.json") Object.assign(pack.data, part); else if (f.startsWith("ui")) Object.assign(pack.ui, part);
  }
  usePack("en", pack);
  setLang("en");
}

const upTo = (n) => new Set(Array.from({ length: n }, (_, i) => i + 1));

// setup에서 시작하는 그 주문 차례의 텃밭
function gardenFor(i) {
  const o = ORDERS[i];
  const raw = { ...newGarden(), ...structuredClone(o.setup),
    order: { idx: i, done: ORDERS.slice(0, i).map((x) => x.id), paid: [] } };
  const g = cleanGarden(raw);
  const same = JSON.stringify(runInput(g)) === JSON.stringify(runInput(raw));
  return { g, same };
}

function prepare() {
  return ORDERS.map((o, i) => {
    const gen = codegen(o.solution, { lang: LANG });
    const errors = [...validate(o.solution, unlockedKinds(upTo(o.need))), ...gen.errors].map((e) => e.msg);
    const { g, same } = gardenFor(i);
    if (!same) errors.push("setup이 저장 정리(cleanGarden)에서 바뀜 — 크기·성장·칸 모양 확인");
    // 그 장까지 통과한 학습자: 토마토 잠금(tomato_ok)·쪽지함(11장부터만 넘김)도 앱과 같게(판정 C71 I1)
    const passed = upTo(o.need);
    return { id: o.id, need: o.need, title: o.title, goal: o.goal, code: gen.code, errors,
      setup: runInput(g, passed), files: passed.has(11) ? runFiles(g, LANG) : null, hasRun: o.solution.length > 0 };
  });
}

function judge(results) {
  return ORDERS.map((o, i) => {
    const passed = upTo(o.need); // 정확히 그 장까지 통과한 학습자
    let { g } = gardenFor(i);
    const notes = [];
    let done = null;
    if (o.solution.length) {
      const r = results[o.id];
      if (!r) return { id: o.id, ok: false, detail: "실행 결과 없음" };
      if (r.error) notes.push(`오류 ${r.error.type}: ${r.error.msg}`);
      if (r.farm && r.farm.stopped) notes.push(`멈춤 ${r.farm.stopped}`);
      const a = applyRun(g, r, { program: o.solution, mode: "nodes", passed });
      g = a.garden;
      done = a.orderDone;
      notes.push(`행동 ${r.farm ? r.farm.actions : "?"}, ${a.message}`);
    }
    if (!done && o.goal.type === "deliver") {
      const d = deliver(g, passed);
      done = d.orderDone;
      notes.push(d.error ? `보내기 실패: ${d.error}` : `보내기 → 창고 ${JSON.stringify(d.garden.store)}`);
    }
    if (!done && o.goal.type === "grid") {
      const b = buy(g, o.goal.size === 4 ? "grid4" : "grid5", passed);
      done = b.orderDone;
      notes.push(b.error ? `사기 실패: ${b.error}` : `밭 ${b.garden.size}×${b.garden.size}`);
    }
    const ok = !!done && done.id === o.id && !notes.some((n) => n.startsWith("오류") || n.startsWith("멈춤"));
    return { id: o.id, ok, detail: notes.join(" · ") };
  });
}

// 판정 C71 C2: 씨앗이 0이고 밭에 토마토가 없으면 o_hand(토마토 2개 심기)를 해낼 길이 없었다 → 씨앗 5개 사기
function stuckGarden() {
  const i = ORDERS.findIndex((o) => o.id === "o_hand");
  const o = ORDERS[i];
  const g = cleanGarden({ ...newGarden(), ...structuredClone(o.setup), seeds: 0,
    order: { idx: i, done: ORDERS.slice(0, i).map((x) => x.id), paid: [] } });
  return { o, g, passed: upTo(o.need) };
}
function stuck() {
  const { o, g, passed } = stuckGarden();
  const can = canBuy(g, "seedpack", passed);
  const b = buy(g, "seedpack", passed);
  return { code: codegen(o.solution, { lang: LANG }).code, before: { seeds: g.seeds, tomatoes: g.cells.filter((c) => c?.crop === "토마토").length, can: can.ok },
    setup0: runInput(g, passed), files0: runFiles(g, LANG),
    setup: runInput(b.garden, passed), files: runFiles(b.garden, LANG), after: { seeds: b.garden.seeds, store: b.garden.store, error: b.error } };
}
function stuckJudge({ result0, result }) {
  const { o, g, passed } = stuckGarden();
  const a0 = applyRun(g, result0, { program: o.solution, mode: "nodes", passed });
  const b = buy(g, "seedpack", passed);
  const a = applyRun(b.garden, result, { program: o.solution, mode: "nodes", passed });
  const ok = !a0.orderDone && !a.rejected && a.orderDone?.id === "o_hand";
  return { ok, detail: `사기 전: ${a0.orderDone ? "완료" : "못 함"} (${result0.error ? result0.error.msg : "오류 없음"}) · 산 뒤: ${a.orderDone?.id ?? "못 함"} · 씨앗 ${a.garden.seeds}` };
}

const mode = process.argv[2];
if (mode === "prepare") {
  process.stdout.write(JSON.stringify(prepare()));
} else if (mode === "stuck") {
  process.stdout.write(JSON.stringify(stuck()));
} else if (mode === "stuck_judge") {
  let text = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => { text += c; });
  process.stdin.on("end", () => process.stdout.write(JSON.stringify(stuckJudge(JSON.parse(text)))));
} else if (mode === "judge") {
  let text = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => { text += c; });
  process.stdin.on("end", () => process.stdout.write(JSON.stringify(judge(JSON.parse(text).results))));
} else {
  process.stderr.write("사용법: node tests/garden_orders_helper.mjs prepare|judge|stuck|stuck_judge\n");
  process.exit(2);
}
