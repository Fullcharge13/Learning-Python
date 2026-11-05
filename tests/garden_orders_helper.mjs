// tests/garden_orders.py의 도우미: 주문 판정 규칙은 src/garden/state.js 한 곳에만 두고 여기서 부른다.
//   node tests/garden_orders_helper.mjs prepare        → 주문마다 { id, need, title, goal, code, errors, setup, hasRun }
//   node tests/garden_orders_helper.mjs judge < 입력    → 입력 { results: { 주문 id: runner 결과 | null } }
//                                                         출력 주문마다 { id, ok, detail }
import { ORDERS } from "../data/garden.js";
import { codegen, validate, unlockedKinds } from "../src/garden/nodes.js";
import { newGarden, cleanGarden, runInput, applyRun, deliver, buy } from "../src/garden/state.js";

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
    const gen = codegen(o.solution);
    const errors = [...validate(o.solution, unlockedKinds(upTo(o.need))), ...gen.errors].map((e) => e.msg);
    const { g, same } = gardenFor(i);
    if (!same) errors.push("setup이 저장 정리(cleanGarden)에서 바뀜 — 크기·성장·칸 모양 확인");
    return { id: o.id, need: o.need, title: o.title, goal: o.goal, code: gen.code, errors,
      setup: runInput(g), hasRun: o.solution.length > 0 };
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

const mode = process.argv[2];
if (mode === "prepare") {
  process.stdout.write(JSON.stringify(prepare()));
} else if (mode === "judge") {
  let text = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => { text += c; });
  process.stdin.on("end", () => process.stdout.write(JSON.stringify(judge(JSON.parse(text).results))));
} else {
  process.stderr.write("사용법: node tests/garden_orders_helper.mjs prepare|judge\n");
  process.exit(2);
}
