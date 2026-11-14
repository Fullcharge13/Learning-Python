// v0.19.2 판정 H-C4·H-C5: 작업자 격리(sealRealm). 지울 수 있으면 막고 true, 못 막으면 던지지 않고 false(fail open).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sealRealm, isSealed, SEALED_NAMES } from "../../src/worker.js";

// 작업자 전역 흉내: 이름들은 프로토타입의 getter(WebIDL 속성처럼 지울 수 있음)
function fakeRealm({ pin = null } = {}) {
  const navProto = {};
  Object.defineProperty(navProto, "serviceWorker", { get() { return {}; }, configurable: true });
  const proto = {};
  for (const k of SEALED_NAMES) Object.defineProperty(proto, k, { get() { return { k }; }, configurable: true });
  const g = Object.create(proto);
  g.navigator = Object.create(navProto);
  if (pin) Object.defineProperty(g, pin, { value: { pinned: true }, writable: false, configurable: false });
  return g;
}

test("지울 수 있으면 모두 막고 true", () => {
  const g = fakeRealm();
  assert.equal(isSealed(g), false);
  assert.equal(sealRealm(g), true);
  for (const k of SEALED_NAMES) assert.equal(g[k], undefined, k);
  assert.equal(g.navigator.serviceWorker, undefined);
  for (let o = Object.getPrototypeOf(g); o; o = Object.getPrototypeOf(o)) {
    for (const k of SEALED_NAMES) assert.equal(Object.getOwnPropertyDescriptor(o, k), undefined, k);
  }
});

test("못 지우는 이름이 있으면 던지지 않고 false(fail open), 나머지는 막음", () => {
  const g = fakeRealm({ pin: "caches" });
  let r;
  assert.doesNotThrow(() => { r = sealRealm(g); });
  assert.equal(r, false);
  assert.deepEqual(g.caches, { pinned: true });
  assert.equal(g.indexedDB, undefined);
  assert.equal(g.Worker, undefined);
});

test("프로토타입 getter가 남으면(지우기 실패) 가려도 sealed=false", () => {
  const g = fakeRealm();
  const proto = Object.getPrototypeOf(g);
  Object.defineProperty(proto, "indexedDB", { get() { return {}; }, configurable: false });
  assert.equal(sealRealm(g), false, "getter가 남아 있으면 getter.call로 되찾을 수 있음");
  assert.equal(g.indexedDB, undefined, "그래도 일반 찾기는 2겹이 가림");
});

test("navigator.serviceWorker를 못 막으면 false", () => {
  const g = fakeRealm();
  Object.defineProperty(g.navigator, "serviceWorker", { value: {}, configurable: false });
  assert.equal(sealRealm(g), false);
});
