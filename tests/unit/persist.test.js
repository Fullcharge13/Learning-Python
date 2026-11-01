import { test } from "node:test";
import assert from "node:assert/strict";
import { createPersist } from "../../src/persist.js";

const fakeNav = ({ persisted = false, grant = true, rejects = false, persistedThrows = false } = {}) => {
  const calls = { persist: 0, persisted: 0 };
  return {
    calls,
    storage: {
      persisted() { calls.persisted++; if (persistedThrows) throw new Error("x"); return Promise.resolve(persisted); },
      persist() { calls.persist++; return rejects ? Promise.reject(new Error("no")) : Promise.resolve(grant); },
    },
  };
};

test("persist: 지원하고 아직 아니면 한 번 요청, 두 번째 부르면 다시 묻지 않음", async () => {
  const nav = fakeNav();
  const ask = createPersist(() => nav);
  assert.equal(await ask(), "granted");
  assert.equal(await ask(), "granted");
  assert.equal(nav.calls.persist, 1);
});

test("persist: 이미 영구 저장이면 요청하지 않음", async () => {
  const nav = fakeNav({ persisted: true });
  assert.equal(await createPersist(() => nav)(), "already");
  assert.equal(nav.calls.persist, 0);
});

test("persist: 거절되면 denied, 다음 계기(첫 저장 뒤)에 한 번 더 물을 수 있음", async () => {
  const nav = fakeNav({ grant: false });
  const ask = createPersist(() => nav);
  assert.equal(await ask(), "denied");
  assert.equal(await ask(), "denied");
  assert.equal(nav.calls.persist, 2);
});

test("persist: 지원 안 함은 기억해서 다시 보지 않음", async () => {
  let n = 0;
  const ask = createPersist(() => { n++; return {}; });
  await ask(); await ask();
  assert.equal(n, 1);
});

test("persist: 지원 안 함(navigator 없음·storage 없음·persist 없음) → unsupported, 던지지 않음", async () => {
  assert.equal(await createPersist(() => undefined)(), "unsupported");
  assert.equal(await createPersist(() => ({}))(), "unsupported");
  assert.equal(await createPersist(() => ({ storage: {} }))(), "unsupported");
  assert.equal(await createPersist(() => { throw new Error("no navigator"); })(), "unsupported");
});

test("persist: persist()가 거부(reject)되거나 persisted()가 던져도 error로 끝남", async () => {
  assert.equal(await createPersist(() => fakeNav({ rejects: true }))(), "error");
  const nav = fakeNav({ persistedThrows: true });
  const r = await createPersist(() => nav)();
  assert.ok(r === "granted" || r === "error");
});

test("persist: persisted() 없이 persist()만 있어도 요청함", async () => {
  let n = 0;
  const nav = { storage: { persist: () => { n++; return Promise.resolve(true); } } };
  assert.equal(await createPersist(() => nav)(), "granted");
  assert.equal(n, 1);
});
