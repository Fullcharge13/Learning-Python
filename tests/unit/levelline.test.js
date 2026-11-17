// v0.22.0 작업 4: 레벨 축하 한 줄(설계 §5-3)과 상태 줄 레벨 표시. 화면(DOM) 없이 만든 HTML 글자를 본다.
import "./_guard_index.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { levelLineHTML, levelLineText, newItemsCount, levelName } from "../../src/ui/levelline.js";
import { statusBar } from "../../src/ui/nav.js";
import { newSave, welcomeNoticeText } from "../../src/save.js";
import { SHOP_ITEMS } from "../../data/shop.js";
import { xpForLevel, levelGift } from "../../src/levels.js";
import { usePack, setLang } from "../../src/i18n.js";
import fs from "node:fs";

const plain = (html) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

test("levelLineHTML: null이면 빈 글", () => {
  assert.equal(levelLineHTML(null), "");
  assert.equal(levelLineHTML(undefined), "");
  assert.equal(levelLineHTML({ from: "x", to: 3, bytes: 1 }), "");   // 망가진 모양도 빈 글
});

test("levelLineHTML: 레벨·이름·선물·새 상품 수(from < level <= to)", () => {
  const h = levelLineHTML({ from: 2, to: 3, bytes: levelGift(3) });
  assert.match(h, /class="level-line"/);
  // 같은 이름 단계 안(검토 I1): 새 이름을 얻었다고 말하지 않는다
  assert.equal(plain(h), "레벨 3으로 올랐어요! · +16바이트 · 새 상품 2개");
  // 새 상품이 없으면 그 부분은 뺀다
  assert.equal(plain(levelLineHTML({ from: 1, to: 2, bytes: levelGift(2) })), "레벨 2로 올랐어요! · +14바이트");
  assert.equal(levelLineText({ from: 6, to: 7, bytes: levelGift(7) }), "레벨 7로 올랐어요! · +24바이트");
  // 이름 단계가 바뀔 때만 「…이 됐어요」. 조사: 떡잎이, 정원사가
  assert.equal(levelLineText({ from: 5, to: 6, bytes: levelGift(6) }), "레벨 6! 떡잎이 됐어요 · +22바이트");
  assert.equal(levelLineText({ from: 10, to: 11, bytes: levelGift(11) }), "레벨 11! 정원사가 됐어요 · +32바이트");
  // 여러 레벨이 한 번에 단계를 넘으면 바뀐 것으로 친다(4→7: 새싹 → 떡잎)
  assert.equal(levelLineText({ from: 4, to: 7, bytes: 1 }), "레벨 7! 떡잎이 됐어요 · +1바이트 · 새 상품 2개");
  // 조사 「으로/로」: 받침 있는 숫자 3·6·10, 없는 2·4·5
  assert.ok(levelLineText({ from: 9, to: 10, bytes: 1 }).startsWith("레벨 10으로 올랐어요!"));
  assert.ok(levelLineText({ from: 3, to: 4, bytes: 1 }).startsWith("레벨 4로 올랐어요!"));
  // 여러 레벨이 한 번에: 사이 상품을 모두 센다
  assert.equal(levelLineText({ from: 1, to: 5, bytes: 1 }).endsWith("새 상품 4개"), true);
});

test("newItemsCount: SHOP_ITEMS에서 from < level <= to", () => {
  for (const [from, to] of [[1, 2], [2, 3], [7, 8], [1, 30], [29, 30]]) {
    assert.equal(newItemsCount(from, to), SHOP_ITEMS.filter((i) => from < i.level && i.level <= to).length);
  }
  assert.equal(newItemsCount(2, 3), 2);
  assert.equal(newItemsCount(1, 2), 0);
});

test("levelName: 5레벨마다 바뀌는 이름", () => {
  assert.deepEqual([1, 6, 11, 16, 21, 26, 30].map(levelName), ["새싹", "떡잎", "정원사", "탐험가", "연구원", "마스터 파이썬", "마스터 파이썬"]);
});

test("statusBar: XP 옆 Lv와 막대, 읽기 글에 이름과 남은 XP", () => {
  const s = { ...newSave(), xp: xpForLevel(2) + 20 };
  const h = statusBar(s);
  const lv = h.slice(h.indexOf('class="stat lv"'));
  assert.ok(h.indexOf('class="stat xp"') < h.indexOf('class="stat lv"'), "Lv는 XP 뒤");
  assert.match(lv, /<b>Lv 2<\/b>/);
  assert.match(lv, /lv-bar/);
  assert.match(lv, /aria-valuenow="20"/);
  assert.match(lv, /레벨 2 새싹, 다음 레벨까지 20 XP/);
  const top = statusBar({ ...newSave(), xp: 99999 });
  assert.match(top, /<b>Lv 30<\/b>/);
  assert.match(top, /레벨 30 마스터 파이썬, 가장 높은 레벨/);
});

test("welcomeNoticeText: 「Lv 13 · +120바이트」", () => {
  assert.ok(welcomeNoticeText(13, 120).includes("Lv 13 · +120바이트"), welcomeNoticeText(13, 120));
});

test("영어: 레벨 줄·이름·환영 알림에 한글 없음", () => {
  const ui = {};
  for (const f of fs.readdirSync("i18n/en")) if (f.startsWith("ui") && f.endsWith(".json")) Object.assign(ui, JSON.parse(fs.readFileSync(`i18n/en/${f}`, "utf8")));
  const data = JSON.parse(fs.readFileSync("i18n/en/data.json", "utf8"));
  usePack("en", { ui, data });
  assert.ok(setLang("en"));
  try {
    assert.equal(levelLineText({ from: 2, to: 3, bytes: 16 }), "You reached Level 3! · +16 Bytes · 2 new items in the shop");
    assert.equal(levelLineText({ from: 7, to: 8, bytes: 26 }).endsWith("· 2 new items in the shop"), true);
    assert.equal(levelLineText({ from: 5, to: 6, bytes: 22 }), "Level 6! New rank: Seedling · +22 Bytes");
    assert.equal(levelLineText({ from: 25, to: 26, bytes: 62 }), "Level 26! New rank: Python Master · +62 Bytes · 1 new item in the shop");
    assert.ok(welcomeNoticeText(13, 120).includes("Lv 13 · +120 Bytes"));
    const h = statusBar({ ...newSave(), xp: 1100 });
    assert.doesNotMatch(h, /[가-힣]/);
    assert.match(h, /Level 13 Gardener/);
  } finally {
    setLang("ko");
  }
});

test("levelLineHTML: 글자는 escape", () => {
  // 숫자가 아닌 값은 받지 않으므로 공격 글자가 들어갈 자리가 없다 — 모양이 틀리면 빈 글
  assert.equal(levelLineHTML({ from: 1, to: '<img src=x onerror="x">', bytes: 1 }), "");
  // 이름(영어 표에서 옴)에 HTML 글자가 있어도 글자 그대로(검토 M6)
  usePack("en", { ui: { "레벨 {}! {}{} 됐어요": "Level {0}! New rank: {1}" }, data: { "level.title.2": '<img src=x onerror="x">' } });
  assert.ok(setLang("en"));
  try {
    const h = levelLineHTML({ from: 5, to: 6, bytes: 0 });
    assert.doesNotMatch(h, /<img/);
    assert.match(h, /&lt;img src=x onerror=&quot;x&quot;&gt;/);
  } finally {
    setLang("ko");
  }
});

// 검토 M2: 기존 학습자(legacy)는 원래 8벌을 레벨과 상관없이 살 수 있으므로 「새 상품」에서 뺀다
test("새 상품 수: legacy 저장은 legacyFree 의상을 세지 않음", () => {
  assert.equal(newItemsCount(2, 3, true), 1);   // 후드티 빼고 울타리만
  assert.equal(newItemsCount(2, 3, false), 2);
  assert.equal(levelLineText({ from: 2, to: 3, bytes: 16 }, { levels: { legacy: true } }), "레벨 3으로 올랐어요! · +16바이트 · 새 상품 1개");
  assert.equal(levelLineText({ from: 17, to: 18, bytes: 1 }, { levels: { legacy: true } }).endsWith("새 상품 2개"), true);   // new1·관제실은 누구나 새것
  assert.equal(plain(levelLineHTML({ from: 2, to: 3, bytes: 16 }, { levels: { legacy: false } })).endsWith("새 상품 2개"), true);
});
