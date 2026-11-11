// v0.14.0(v0.13.4 검토 M2): 겹친 불러오기 중 마지막 것만 쓴다(늦게 끝난 옛 결과가 새 결과를 덮지 않게)
import { test } from "node:test";
import assert from "node:assert/strict";
import { latestOnly } from "../../src/latest.js";

test("latestOnly: 먼저 시작해 늦게 끝난 호출은 stale", async () => {
  const resolvers = [];
  const f = latestOnly((v) => new Promise((res) => resolvers.push(() => res(v))));
  const a = f("old");
  const b = f("new");
  resolvers[1]();
  resolvers[0]();
  assert.deepEqual(await b, { stale: false, value: "new" });
  assert.deepEqual(await a, { stale: true, value: "old" });
});

test("latestOnly: 오류는 그대로 던진다(마지막 호출일 때)", async () => {
  const f = latestOnly(async () => { throw new Error("boom"); });
  await assert.rejects(f(), /boom/);
});
