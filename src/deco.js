// v0.22.0 꾸미기 저장 칸 deco (설계 2026-11-17 §5-4, §5-5). 순수 함수만.
// deco: { owned: 산 꾸미기 id[], on: { garden, guard, workshop, editor } } — 켬 칸은 null(없음) 또는 그 공간의 가진 id.
// saveVer 그대로, clean-or-default: 없거나 망가지면 기본값, 모르는 id·가지지 않은 켬 상태는 지운다.
import { SHOP_ITEMS, DECO_SPACES } from "../data/shop.js";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const DECO_KIND = new Map(SHOP_ITEMS.filter((i) => i.kind !== "outfit").map((i) => [i.id, i.kind]));
const DECO_ORDER = [...DECO_KIND.keys()];

/** 꾸미기 상품이면 그 공간 이름, 아니면 null */
export const decoSpaceOf = (id) => (typeof id === "string" && DECO_KIND.has(id) ? DECO_KIND.get(id) : null);

export const newDeco = () => ({ owned: [], on: Object.fromEntries(DECO_SPACES.map((sp) => [sp, null])) });

export function cleanDeco(raw) {
  if (!isObj(raw) || !Array.isArray(raw.owned) || (Object.hasOwn(raw, "on") && !isObj(raw.on))) return newDeco();
  const have = new Set(raw.owned.filter((x) => decoSpaceOf(x) !== null));
  const owned = DECO_ORDER.filter((id) => have.has(id)); // 상품 표 순서, 중복 없음
  const on = {};
  for (const sp of DECO_SPACES) {
    const v = isObj(raw.on) && Object.hasOwn(raw.on, sp) ? raw.on[sp] : null;
    on[sp] = have.has(v) && decoSpaceOf(v) === sp ? v : null;
  }
  return { owned, on };
}
