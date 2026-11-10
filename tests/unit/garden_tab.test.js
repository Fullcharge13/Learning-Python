// v0.12.5: 하단 메뉴 「텃밭」 칸 — 잠김·새 소식 점·칸 순서
import { test } from "node:test";
import assert from "node:assert/strict";
import { gardenTab, newGarden, addPendingDone } from "../../src/garden/state.js";
import { ORDERS } from "../../data/garden.js";
import { tabBar } from "../../src/ui/nav.js";

const upTo = (n) => new Set(Array.from({ length: n }, (_, i) => i + 1));
const SOUP = ORDERS.findIndex((o) => o.id === "o_soup");
const at = (g, idx, extra = {}) => ({ ...g, order: { ...g.order, idx, done: ORDERS.slice(0, idx).map((o) => o.id) }, ...extra });

test("garden_tab: 1장 전에는 잠김", () => {
  assert.equal(gardenTab(newGarden(), new Set()), "locked");
  assert.equal(gardenTab(undefined, new Set()), "locked");
});

test("garden_tab: 막 열리고 한 번도 실행하지 않았으면 새 소식", () => {
  assert.equal(gardenTab(newGarden(), upTo(1)), "news");
  assert.equal(gardenTab({ ...newGarden(), runs: 1 }, upTo(1)), "open");
});

test("garden_tab: 주문 완료 창이 남아 있으면 새 소식", () => {
  const g = addPendingDone({ ...newGarden(), runs: 3 }, ["o_first"]);
  assert.equal(gardenTab(g, upTo(1)), "news");
});

test("garden_tab: 보내기 주문인데 창고가 충분하면 새 소식, 모자라면 아님", () => {
  assert.equal(ORDERS[SOUP].goal.type, "deliver");
  const base = { ...newGarden(), runs: 5 };
  const need = ORDERS[SOUP].goal.n;
  assert.equal(gardenTab(at(base, SOUP, { store: { ...base.store, 당근: need } }), upTo(2)), "news");
  assert.equal(gardenTab(at(base, SOUP, { store: { ...base.store, 당근: need - 1 } }), upTo(2)), "open");
  // 주문이 아직 장을 기다리면(2장 전) 보낼 수 없으니 점 없음
  assert.equal(gardenTab(at(base, SOUP, { store: { ...base.store, 당근: need } }), upTo(1)), "open");
});

test("garden_tab: 주문을 모두 끝냈으면 점 없음", () => {
  const g = at({ ...newGarden(), runs: 9 }, ORDERS.length);
  assert.equal(gardenTab(g, upTo(17)), "open");
});

test("tab_bar: 칸 순서는 학습·텃밭·배지·의상실·설정", () => {
  const html = tabBar("home", "open");
  assert.deepEqual([...html.matchAll(/data-go="([^"]+)"/g)].map((m) => m[1]), ["home", "garden", "badges", "closet", "settings"]);
  assert.match(html, />텃밭</);
});

test("tab_bar: 잠긴 텃밭 칸은 자물쇠·안내 이름표, 새 소식은 점·이름표", () => {
  const locked = tabBar("home", "locked");
  assert.match(locked, /data-go="garden"[^>]*data-locked="1"/);
  assert.match(locked, /aria-label="텃밭, 잠김, 1장을 끝내면 열려요"/);
  const news = tabBar("badges", "news");
  assert.match(news, /data-go="garden"[^>]*aria-label="텃밭, 새 소식 있음"/);
  assert.match(news, /class="tab-dot"/);
  const open = tabBar("closet", "open");
  assert.doesNotMatch(open, /tab-dot|data-locked/);
  // 상태를 안 주면(옛 호출) 열린 칸으로
  assert.doesNotMatch(tabBar("settings"), /tab-dot|data-locked/);
});
