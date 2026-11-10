// 의상 구매. 성공하면 새 Save, 실패하면 Error
import { OUTFITS } from "../data/outfits.js";
import { t } from "./i18n.js";

export function buy(save, id) {
  const o = OUTFITS.find((x) => x.id === id);
  if (!o) return new Error(t`없는 의상이에요: ${id}`);
  if ((save.outfits || []).includes(id)) return new Error(t`이미 가지고 있는 의상이에요`);
  if (o.price == null) return new Error(t`판매하지 않는 의상이에요`);
  const bytes = save.bytes || 0;
  if (bytes < o.price) return new Error(t`바이트가 모자라요 (${bytes}/${o.price})`);
  return { ...save, bytes: bytes - o.price, outfits: [...(save.outfits || []), id] };
}
