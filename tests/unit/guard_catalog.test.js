// 경비실 사건 장별 파일 (v0.16.0 작업 1, 설계 docs/specs/2026-11-13-경비실-사건-12개-설계.md §5-1·§5-2)
// 색인 만들기, 본문(정답 빼기), 장별 나누기, 장 파일 불러오기(기억·동시 부름·실패 뒤 다시 시도), 개발판
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GUARD_FILE_RE, GUARD_XP, guardIndexEntry, buildGuardIndex, guardBody, splitGuard, GuardLoadError, createGuardData,
} from "../../src/guard/catalog.js";
import { INCIDENTS, GUARD_XP as DATA_XP } from "../../data/guard.js";

const G1 = INCIDENTS.find((i) => i.id === "G1");

test("GUARD_XP: catalog.js에 있고 data/guard.js는 같은 값을 다시 내보낸다", () => {
  assert.equal(GUARD_XP, 5);
  assert.equal(DATA_XP, GUARD_XP);
});

test("GUARD_FILE_RE: guard/chN-<지문8자>.json", () => {
  assert.ok(GUARD_FILE_RE.test("guard/ch3-0123abcd.json"));
  assert.ok(GUARD_FILE_RE.test("guard/ch17-deadbeef.json"));
  assert.ok(!GUARD_FILE_RE.test("guard/ch0-0123abcd.json"));
  assert.ok(!GUARD_FILE_RE.test("guard/ch3-0123ABCD.json"));
  assert.ok(!GUARD_FILE_RE.test("lessons/ch3-0123abcd.json"));
  assert.ok(!GUARD_FILE_RE.test("guard/ch3-0123abc.json"));
});

test("guardIndexEntry(G1): id·need·mode·tag·title·빈칸마다 보기 수", () => {
  assert.deepEqual(guardIndexEntry(G1), { id: "G1", need: 3, mode: "script", tag: "respond", title: "창고 문 암호", blanks: [3, 2, 3] });
  assert.deepEqual(guardIndexEntry(G1).blanks, G1.blanks.map((b) => b.options.length));
});

test("buildGuardIndex: 원본 순서 그대로, 사건마다 한 칸", () => {
  const idx = buildGuardIndex(INCIDENTS);
  assert.deepEqual(idx.map((e) => e.id), INCIDENTS.map((i) => i.id));
  assert.deepEqual(idx, INCIDENTS.map(guardIndexEntry));
  assert.ok(!JSON.stringify(idx).includes("solution"));
});

test("guardBody: solution만 빼고 나머지 칸은 원본과 같다(원본은 그대로)", () => {
  const b = guardBody(G1);
  assert.ok(!("solution" in b));
  const { solution, ...rest } = G1;
  assert.ok(solution, "G1 has a solution in the source");
  assert.deepEqual(b, rest);
  assert.ok("solution" in G1, "source must not be changed");
});

test("splitGuard: 장 열쇠 = need 모음, 장마다 원본 순서, 본문에 solution 없음", () => {
  const { index, chapters } = splitGuard(INCIDENTS);
  assert.deepEqual(index, buildGuardIndex(INCIDENTS));
  const needs = [...new Set(INCIDENTS.map((i) => String(i.need)))].sort();
  assert.deepEqual(Object.keys(chapters).sort(), needs);
  for (const n of needs) {
    assert.deepEqual(chapters[n].map((b) => b.id), INCIDENTS.filter((i) => String(i.need) === n).map((i) => i.id));
    for (const b of chapters[n]) assert.ok(!("solution" in b), b.id);
  }
});

// ---- 불러오기

const ch3 = () => INCIDENTS.filter((i) => i.need === 3).map(guardBody);

function fakeFetch(responses) {
  const calls = [];
  const f = async (url) => {
    calls.push(url);
    const r = responses.length > 1 ? responses.shift() : responses[0];
    if (r instanceof Error) throw r;
    return r;
  };
  f.calls = calls;
  return f;
}
const okRes = (data) => ({ ok: true, status: 200, json: async () => data });

const deployed = (fetch) => createGuardData({
  index: buildGuardIndex(INCIDENTS), files: { 3: "guard/ch3-aaaaaaaa.json" }, base: "https://x.example/", fetch,
});

test("load: 받은 장은 기억(두 번 불러도 한 번 받음), 주소는 base 기준", async () => {
  const fetch = fakeFetch([okRes(ch3())]);
  const d = deployed(fetch);
  assert.deepEqual(d.index, buildGuardIndex(INCIDENTS));
  const a = await d.load(3);
  const b = await d.load(3);
  assert.deepEqual(a, ch3());
  assert.ok(a.length > 0 && a.every((x) => x.need === 3));
  assert.equal(a, b);
  assert.deepEqual(fetch.calls, ["https://x.example/guard/ch3-aaaaaaaa.json"]);
});

test("load: 같은 장을 동시에 두 번 → 같은 약속, 한 번만 받음", async () => {
  const fetch = fakeFetch([okRes(ch3())]);
  const d = deployed(fetch);
  const p1 = d.load(3), p2 = d.load(3);
  assert.equal(p1, p2);
  await Promise.all([p1, p2]);
  assert.equal(fetch.calls.length, 1);
});

test("load: 네트워크 오류 → GuardLoadError, 기억하지 않고 다시 받음", async () => {
  const fetch = fakeFetch([new TypeError("offline"), okRes(ch3())]);
  const d = deployed(fetch);
  await assert.rejects(d.load(3), (e) => e instanceof GuardLoadError && e.chapter === 3);
  const got = await d.load(3);
  assert.deepEqual(got, ch3());
  assert.equal(fetch.calls.length, 2);
});

test("load: ok:false → GuardLoadError(404면 stale), 그다음 다시 받음", async () => {
  const fetch = fakeFetch([{ ok: false, status: 404, json: async () => null }, okRes(ch3())]);
  const d = deployed(fetch);
  await assert.rejects(d.load(3), (e) => e instanceof GuardLoadError && e.stale === true);
  assert.deepEqual(await d.load(3), ch3());
  assert.equal(fetch.calls.length, 2);
});

test("load: 내용이 그 장 사건 목록이 아니면 GuardLoadError", async () => {
  const d = deployed(fakeFetch([okRes({ not: "array" })]));
  await assert.rejects(d.load(3), GuardLoadError);
  const wrong = INCIDENTS.filter((i) => i.need !== 3).map(guardBody);
  const d2 = deployed(fakeFetch([okRes(wrong)]));
  await assert.rejects(d2.load(3), GuardLoadError);
});

test("load: files에 없는 장 → GuardLoadError(받지 않음)", async () => {
  const fetch = fakeFetch([okRes([])]);
  const d = deployed(fetch);
  await assert.rejects(d.load(4), (e) => e instanceof GuardLoadError && e.chapter === 4);
  assert.equal(fetch.calls.length, 0);
});

test("개발판(incidents): 받지 않고 그 장 사건들을 돌려줌, 색인은 원본에서", async () => {
  let called = 0;
  const d = createGuardData({ incidents: INCIDENTS, fetch: async () => { called += 1; return okRes([]); } });
  assert.deepEqual(d.index, buildGuardIndex(INCIDENTS));
  const got = await d.load(4);
  assert.deepEqual(got.map((x) => x.id), INCIDENTS.filter((i) => i.need === 4).map((i) => i.id));
  assert.ok(got.length > 0);
  assert.equal(called, 0);
  assert.equal(await d.load(4), got, "같은 장은 같은 목록");
});
