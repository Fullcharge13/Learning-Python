// 상점 사기 규칙(v0.22.0 설계 2026-11-17 §5-4, §5-5). 의상·꾸미기 공통. 성공하면 새 Save, 실패하면 Error(.reason)
// 레벨은 늘 save.xp에서 센다(levelOf). legacy 저장(save.levels.legacy)은 legacyFree 상품(원래 8벌)을 레벨 없이 산다.
// 가진 상품은 레벨과 상관없이 계속 가진다. 기록 보호권은 src/rules.js(buyFreeze) 그대로.
import { OUTFITS } from "../data/outfits.js";
import { SHOP_ITEMS, DECO_SPACES } from "../data/shop.js";
import { levelOf } from "./levels.js";
import { cleanDeco, decoSpaceOf } from "./deco.js";
import { t } from "./i18n.js";

const ITEMS = new Map(SHOP_ITEMS.map((i) => [i.id, i]));
const itemOf = (id) => (typeof id === "string" && ITEMS.has(id) ? ITEMS.get(id) : null);
const decoOf = (save) => cleanDeco(save && save.deco);
const isLegacy = (save) => !!(save && save.levels && save.levels.legacy === true);

/** 가지고 있나: 의상은 save.outfits, 꾸미기는 save.deco.owned */
export function owns(save, id) {
  if (typeof id !== "string") return false;
  if (decoSpaceOf(id)) return decoOf(save).owned.includes(id);
  return Array.isArray(save && save.outfits) && save.outfits.includes(id);
}

/**
 * 살 수 있나. 순서: notsold(표에 없음: 기본복장·졸업 가운·모르는 id) → owned → level → bytes.
 * needLevel: 이 저장에 필요한 레벨(legacy 예외면 1). 팔지 않으면 null.
 * legacy: 기존 학습자 예외(원래 8벌을 레벨 없이)가 이 상품에 걸렸나. 상점의 「예전부터 함께한 학습자」 표시가 이것만 본다(작업 5 검토 M1)
 * @returns {{ ok: boolean, reason: "owned"|"level"|"bytes"|"notsold"|null, needLevel: number|null, legacy: boolean }}
 */
export function canBuy(save, id) {
  const item = itemOf(id);
  if (!item) return { ok: false, reason: "notsold", needLevel: null, legacy: false };
  const legacy = !!item.legacyFree && isLegacy(save);
  const needLevel = legacy ? 1 : item.level;
  const r = (ok, reason) => ({ ok, reason, needLevel, legacy });
  if (owns(save, id)) return r(false, "owned");
  if (levelOf(save && save.xp) < needLevel) return r(false, "level");
  const bytes = (save && save.bytes) || 0;
  if (bytes < item.price) return r(false, "bytes");
  return r(true, null);
}

function fail(reason, msg) {
  const e = new Error(msg);
  e.reason = reason;
  return e;
}

/** 산다. 의상은 save.outfits에, 꾸미기는 save.deco.owned에(켜지는 않음). 입은 옷·켠 꾸미기는 그대로 */
export function buyItem(save, id) {
  const c = canBuy(save, id);
  const item = itemOf(id);
  const bytes = save.bytes || 0;
  if (c.reason === "notsold") {
    return fail("notsold", OUTFITS.some((o) => o.id === id) ? t`판매하지 않는 의상이에요` : t`없는 상품이에요: ${id}`);
  }
  if (c.reason === "owned") return fail("owned", item.kind === "outfit" ? t`이미 가지고 있는 의상이에요` : t`이미 가지고 있어요`);
  if (c.reason === "level") return fail("level", t`Lv ${c.needLevel}에 열려요`);
  if (c.reason === "bytes") return fail("bytes", t`바이트가 모자라요 (${bytes}/${item.price})`);
  const paid = { ...save, bytes: bytes - item.price };
  if (item.kind === "outfit") return { ...paid, outfits: [...(save.outfits || []), id] };
  const deco = decoOf(save);
  return { ...paid, deco: cleanDeco({ ...deco, owned: [...deco.owned, id] }) };
}

/** 예전 이름(의상실 src/ui/closet.js가 씀). buyItem 그대로 */
export const buy = (save, id) => buyItem(save, id);

/** 공간의 꾸미기를 켠다(id) 또는 끈다(null). 가진 것, 그 공간의 것만. 레벨과 상관없음. Error.reason: "space"|"notowned" */
export function setDeco(save, space, id) {
  if (!DECO_SPACES.includes(space)) return fail("space", t`모르는 꾸미기 자리예요: ${space}`);
  const deco = decoOf(save);
  if (id !== null) {
    if (decoSpaceOf(id) !== space) return fail("space", t`이 자리에 쓰는 꾸미기가 아니에요`);
    if (!deco.owned.includes(id)) return fail("notowned", t`아직 가지고 있지 않아요`);
  }
  return { ...save, deco: { owned: deco.owned, on: { ...deco.on, [space]: id } } };
}
