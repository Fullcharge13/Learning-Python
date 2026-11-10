// v0.13.0 영어판 기반: t``(한국어 원문이 열쇠) · tx(데이터 표) · 언어 고르기 · 처음 언어
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { t, tx, tp, keyOf, lang, setLang, usePack, pickStartLang, normLang, EN_PUBLIC, LANGS, missingKeys } from "../../src/i18n.js";

beforeEach(() => { usePack("en", null); setLang("ko"); });

test("key: 고정 글자들을 {}로 잇는다", () => {
  assert.equal(keyOf(["안녕 ", " 님"]), "안녕 {} 님");
  assert.equal(keyOf(["시작하기"]), "시작하기");
});

test("t: 한국어면 원문 그대로(값 채움)", () => {
  assert.equal(t`안녕 ${"리아"} 님`, "안녕 리아 님");
  assert.equal(t`시작하기`, "시작하기");
});

test("t: 영어면 영어 표에서 찾고 {} 자리에 값을 차례로", () => {
  usePack("en", { ui: { "안녕 {} 님": "Hi {}", "{}개 중 {}개": "{1} of {0}" } });
  setLang("en");
  assert.equal(t`안녕 ${"Ria"} 님`, "Hi Ria");
  assert.equal(t`${10}개 중 ${3}개`, "3 of 10"); // 번호 자리 {0}·{1}로 순서 바꾸기
});

test("t: 영어 표에 없으면 원문으로 두고 빠진 열쇠를 모은다", () => {
  usePack("en", { ui: {} });
  setLang("en");
  assert.equal(t`없는 ${1} 문구`, "없는 1 문구");
  assert.ok(missingKeys().includes("없는 {} 문구"));
});

test("t: 값 안의 {} 글자는 다시 바꾸지 않는다", () => {
  usePack("en", { ui: { "이름: {}": "Name: {}" } });
  setLang("en");
  assert.equal(t`이름: ${"{}"}`, "Name: {}");
});

test("tx: 데이터 표 번역, 없으면 넘겨준 원문", () => {
  usePack("en", { data: { "badge.first.name": "First steps" } });
  assert.equal(tx("badge.first.name", "첫걸음"), "첫걸음"); // 한국어일 때
  setLang("en");
  assert.equal(tx("badge.first.name", "첫걸음"), "First steps");
  assert.equal(tx("badge.none.name", "없음"), "없음");
});

test("setLang: 영어 꾸러미가 없으면 바꾸지 않고 false", () => {
  usePack("en", null);
  assert.equal(setLang("en"), false);
  assert.equal(lang(), "ko");
  usePack("en", { ui: {} });
  assert.equal(setLang("en"), true);
  assert.equal(lang(), "en");
  assert.equal(setLang("fr"), false); // 모르는 언어
  assert.equal(lang(), "en");
});

test("normLang: 저장 값 → ko/en, 이상하면 ko", () => {
  assert.equal(normLang("en"), "en");
  assert.equal(normLang("ko"), "ko");
  assert.equal(normLang(undefined), "ko");
  assert.equal(normLang("EN"), "ko");
  assert.equal(normLang(3), "ko");
  assert.deepEqual(LANGS, ["ko", "en"]);
});

test("pickStartLang: 공개 뒤 처음 여는 사람은 휴대폰 언어, 쓰던 사람·공개 전은 한국어", () => {
  assert.equal(pickStartLang(["en-US", "ko"], false, true), "en");
  assert.equal(pickStartLang(["ko-KR"], false, true), "ko");
  assert.equal(pickStartLang(["ko"], false, true), "ko");
  assert.equal(pickStartLang([], false, true), "ko");
  assert.equal(pickStartLang(undefined, false, true), "ko");
  assert.equal(pickStartLang(["ja-JP"], false, true), "en");
  assert.equal(pickStartLang(["en-US"], true, true), "ko");   // 저장이 있으면(쓰던 사람) 저장 값이 정함 → 기본 ko
  assert.equal(pickStartLang(["en-US"], false, false), "ko"); // 공개 전
});

test("EN_PUBLIC: v0.13.x 동안은 공개 전", () => {
  assert.equal(EN_PUBLIC, false);
});

test("tp: 뜻이 다른 같은 한국어는 문맥 열쇠로, 없으면 한국어 원문(열쇠 글자가 보이지 않게)", () => {
  assert.equal(tp("cancel", "그만두기"), "그만두기");
  usePack("en", { ui: { "cancel::그만두기": "Cancel" } });
  setLang("en");
  assert.equal(tp("cancel", "그만두기"), "Cancel");
  assert.equal(tp("quit", "그만두기"), "그만두기");
  assert.ok(missingKeys().includes("quit::그만두기"));
});

test("복수형: 영어 값의 {0|day|days}는 그 값이 1이면 앞, 아니면 뒤", () => {
  usePack("en", { ui: { "연속 {}일": "{0}-{0|day|days} streak", "{}바이트": "{0} {0|Byte|Bytes}", "unit-day::일": "{0|day|days}" } });
  setLang("en");
  assert.equal(t`연속 ${1}일`, "1-day streak");
  assert.equal(t`${1}바이트`, "1 Byte");
  assert.equal(t`${30}바이트`, "30 Bytes");
  assert.equal(tp("unit-day", "일", 2), "days");
  assert.equal(tp("unit-day", "일", 1), "day");
  setLang("ko");
  assert.equal(tp("unit-day", "일", 2), "일");
});
