// v0.21.0 프로젝트 공방: 색인·파일 나누기·불러오기 (경비실 guard_catalog.test.js와 같은 모양)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROJECT_FILE_RE, buildProjectIndex, splitProjects, projectFileName, createProjectData, ProjectLoadError,
} from "../../src/projects/catalog.js";
import { PROJECTS as KO } from "../../data/projects.js";
import { PROJECTS as EN } from "../../data/projects.en.js";

const mk = (id, need, n, title = id) => ({ id, need, icon: "play", title, blurb: title + "!", intro: "i", finale: "f",
  play: { prompt: "p" }, steps: Array.from({ length: n }, (_, k) => ({ goal: "g" + k, task: "t", tests: [], require: [], hints: [], solution: "s" })) });

test("PROJECT_FILE_RE", () => {
  assert.ok(PROJECT_FILE_RE.test("projects/P1-0123abcd.json"));
  assert.ok(PROJECT_FILE_RE.test("projects/en/P12-0123abcd.json"));
  assert.ok(!PROJECT_FILE_RE.test("projects/P0-0123abcd.json"));
  assert.ok(!PROJECT_FILE_RE.test("projects/fr/P1-0123abcd.json"));
  assert.ok(!PROJECT_FILE_RE.test("projects/P1-0123abc.json"));
  assert.equal(projectFileName("P1", "0123abcd", "ko"), "projects/P1-0123abcd.json");
  assert.equal(projectFileName("P1", "0123abcd", "en"), "projects/en/P1-0123abcd.json");
});

test("buildProjectIndex: 한·영 제목·한 줄, 단계 수", () => {
  const idx = buildProjectIndex([mk("P1", 3, 4, "가위"), mk("P2", 5, 3, "숫자")], [mk("P1", 3, 4, "RPS"), mk("P2", 5, 3, "Num")]);
  assert.deepEqual(idx[0], { id: "P1", need: 3, icon: "play", steps: 4, title: { ko: "가위", en: "RPS" }, blurb: { ko: "가위!", en: "RPS!" } });
  assert.equal(idx[1].steps, 3);
});

test("buildProjectIndex: 영어가 빠지거나 단계 수·장이 다르면 던짐", () => {
  assert.throws(() => buildProjectIndex([mk("P1", 3, 4)], []), /P1/);
  assert.throws(() => buildProjectIndex([mk("P1", 3, 4)], [mk("P1", 3, 3)]), /P1/);
  assert.throws(() => buildProjectIndex([mk("P1", 3, 4)], [mk("P1", 4, 4)]), /P1/);
  assert.throws(() => buildProjectIndex([mk("P1", 3, 4)], [mk("P1", 3, 4), mk("P2", 5, 3)]), /P2/);
});

test("splitProjects: 언어별 본문(정답은 남김, W-P1)", () => {
  const { index, bodies } = splitProjects([mk("P1", 3, 2)], [mk("P1", 3, 2, "E")]);
  assert.equal(index.length, 1);
  assert.equal(bodies.ko.P1.title, "P1");
  assert.equal(bodies.en.P1.title, "E");
  assert.equal(bodies.ko.P1.steps[0].solution, "s");
});

test("실제 데이터: P1이 있고 색인이 만들어짐", () => {
  const idx = buildProjectIndex(KO, EN);
  assert.equal(idx[0].id, "P1");
  assert.equal(idx[0].need, 3);
});

function fakeFetch(map) {
  const calls = [];
  const f = async (url) => {
    calls.push(url);
    const v = map[url];
    if (v instanceof Error) throw v;
    if (v === undefined) return { ok: false, status: 404 };
    return { ok: true, status: 200, json: async () => (typeof v === "string" ? JSON.parse(v) : v) };
  };
  f.calls = calls;
  return f;
}

test("createProjectData: 배포판은 언어별 파일을 받고, 한 번만 받음", async () => {
  const ko = mk("P1", 3, 2, "가위"), en = mk("P1", 3, 2, "RPS");
  const index = buildProjectIndex([ko], [en]);
  const files = { ko: { P1: "projects/P1-00000000.json" }, en: { P1: "projects/en/P1-11111111.json" } };
  const f = fakeFetch({ "https://x.test/app/projects/P1-00000000.json": ko, "https://x.test/app/projects/en/P1-11111111.json": en });
  const d = createProjectData({ index, files, base: "https://x.test/app/", fetch: f });
  assert.equal(d.index, index);
  const [a, b] = await Promise.all([d.load("P1", "ko"), d.load("P1", "ko")]);
  assert.equal(a.title, "가위");
  assert.equal(a, b);
  assert.equal((await d.load("P1", "en")).title, "RPS");
  assert.equal((await d.load("P1", "fr")).title, "가위", "모르는 언어는 ko");
  assert.equal(f.calls.length, 2);
});

test("createProjectData: 실패는 ProjectLoadError(404는 stale), 기억하지 않음", async () => {
  const ko = mk("P1", 3, 2);
  const index = buildProjectIndex([ko], [ko]);
  const files = { ko: { P1: "projects/P1-00000000.json" }, en: {} };
  const d = createProjectData({ index, files, fetch: fakeFetch({}) });
  await assert.rejects(d.load("P1", "ko"), (e) => e instanceof ProjectLoadError && e.stale === true && e.id === "P1");
  await assert.rejects(d.load("P1", "en"), (e) => e instanceof ProjectLoadError && e.stale === false);
  await assert.rejects(d.load("P9", "ko"), ProjectLoadError);
  const net = createProjectData({ index, files, fetch: fakeFetch({ "projects/P1-00000000.json": new Error("off") }) });
  await assert.rejects(net.load("P1", "ko"), (e) => e instanceof ProjectLoadError && e.stale === false);
  // 다른 프로젝트·단계 수가 다른 본문
  const wrong = createProjectData({ index, files, fetch: fakeFetch({ "projects/P1-00000000.json": mk("P2", 3, 2) }) });
  await assert.rejects(wrong.load("P1", "ko"), ProjectLoadError);
  const short = createProjectData({ index, files, fetch: fakeFetch({ "projects/P1-00000000.json": mk("P1", 3, 1) }) });
  await assert.rejects(short.load("P1", "ko"), ProjectLoadError);
  // 실패 뒤 다시 부르면 다시 받음
  let n = 0;
  const flaky = async () => (++n === 1 ? { ok: false, status: 500 } : { ok: true, json: async () => ko });
  const fd = createProjectData({ index, files, fetch: flaky });
  await assert.rejects(fd.load("P1", "ko"), ProjectLoadError);
  assert.equal((await fd.load("P1", "ko")).id, "P1");
});

test("createProjectData: 개발판은 원본에서(받지 않음)", async () => {
  const d = createProjectData({ projects: { ko: [mk("P1", 3, 2, "가위")], en: [mk("P1", 3, 2, "RPS")] }, fetch: () => { throw new Error("no fetch"); } });
  assert.equal(d.index[0].title.en, "RPS");
  assert.equal((await d.load("P1", "en")).title, "RPS");
  await assert.rejects(d.load("P2", "ko"), ProjectLoadError);
});
