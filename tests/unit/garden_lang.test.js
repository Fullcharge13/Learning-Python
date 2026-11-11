// v0.13.5 텃밭 영어: 안쪽 열쇠(한국어) ↔ 파이썬·화면 이름(언어별). 설계서 영어판 §5-1
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setLang, usePack } from "../../src/i18n.js";
import { GARDEN_EN, pyName, fromPyName, cropName, fileName } from "../../src/garden/lang.js";

beforeEach(() => { usePack("en", { ui: {}, data: {} }); setLang("ko"); });

test("garden lang: 한국어 실행은 안쪽 이름 그대로", () => {
  assert.equal(pyName("crop", "당근", "ko"), "당근");
  assert.equal(pyName("dir", "위", "ko"), "위");
  assert.equal(pyName("file", "주문서.txt", "ko"), "주문서.txt");
});

test("garden lang: 영어 이름 표(설계서 §5-1)", () => {
  assert.deepEqual(GARDEN_EN.crop, { 당근: "carrot", 감자: "potato", 토마토: "tomato" });
  assert.deepEqual(GARDEN_EN.dir, { 위: "up", 아래: "down", 왼쪽: "left", 오른쪽: "right" });
  assert.deepEqual(GARDEN_EN.empty, { 빈칸: "empty" });
  assert.deepEqual(GARDEN_EN.file, { "주문서.txt": "orders.txt", "손글씨주문.txt": "handwritten.txt", "농장일지.txt": "farm_log.txt" });
  assert.equal(pyName("crop", "토마토", "en"), "tomato");
  assert.equal(pyName("file", "농장일지.txt", "en"), "farm_log.txt");
  assert.equal(pyName("crop", "모르는것", "en"), "모르는것", "unknown values pass through");
});

test("garden lang: 영어 이름 → 안쪽 열쇠, 모르면 그대로", () => {
  assert.equal(fromPyName("crop", "carrot"), "당근");
  assert.equal(fromPyName("dir", "right"), "오른쪽");
  assert.equal(fromPyName("crop", "당근"), "당근");
  assert.equal(fromPyName("crop", "kiwi"), "kiwi");
});

test("garden lang: 화면 이름은 지금 언어를 따른다", () => {
  assert.equal(cropName("감자"), "감자");
  assert.equal(fileName("손글씨주문.txt"), "손글씨주문.txt");
  setLang("en");
  assert.equal(cropName("감자"), "potato");
  assert.equal(fileName("손글씨주문.txt"), "handwritten.txt");
});
