// 언어 (v0.13.0 영어판 기반, 설계 docs/specs/2026-11-11-영어판-설계.md §2)
//
// gettext 방식: 한국어 문구는 코드 자리에 그대로 두고 「열쇠」로 쓴다. 영어 표(lang/en-<지문>.json)만 따로 불러온다.
// - t`한국어 ${x} 문구` : 열쇠 = 고정 글자들을 {}로 이은 것 → "한국어 {} 문구". 영어면 표에서 찾아 {}(또는 {0}·{1}) 자리에 값.
// - tx("badge.first.name", "첫걸음") : 데이터 표(배지·의상·퀘스트·대사·개념·오류·텃밭) 번역. 열쇠 = 표.id.칸.
// - 영어 표에 없는 열쇠는 원문(한국어)으로 두고 missingKeys()에 모은다(시험·개발 확인용).
// 한국어 조사(josa)는 한국어 문구 쪽에서만 쓴다. 이 파일은 화면(DOM)을 모른다.

export const LANGS = Object.freeze(["ko", "en"]);
// 공개 전(v0.13.x)에는 「한국어 / English」 고르기가 개발자 모드에서만 보인다. v0.14.0에서 true.
export const EN_PUBLIC = true;   // v0.14.0 공개(누구나 고를 수 있고, 처음 언어는 휴대폰 언어)

let cur = "ko";
const packs = { en: null };
const missing = new Set();

export const normLang = (v) => (v === "en" || v === "ko" ? v : "ko");
export const lang = () => cur;
export const hasPack = (l) => l === "ko" || !!packs[l];

/** 언어 꾸러미 넣기(null이면 뺌). 꾸러미 = { ui: {열쇠: 영어}, data: {표.id.칸: 영어}, ... } */
export function usePack(l, pack) {
  if (l === "ko") return;
  packs[l] = pack && typeof pack === "object" ? pack : null;
  if (!packs[l] && cur === l) cur = "ko";
  missing.clear();
}
export const packOf = (l) => packs[l] || null;

/** 언어 바꾸기. 꾸러미가 없거나 모르는 언어면 바꾸지 않고 false */
export function setLang(l) {
  if (!LANGS.includes(l) || !hasPack(l)) return false;
  cur = l;
  return true;
}

export const keyOf = (strings) => Array.from(strings).join("{}");

// {} 차례대로 · {0} 번호 · {0|day|days} 복수형(그 값이 1이면 앞 말, 아니면 뒤 말 — 영어 표에서만 씀)
function fillSlots(tpl, vals) {
  let i = 0;
  return tpl.replace(/\{(\d*)(?:\|([^|{}]*)\|([^|{}]*))?\}/g, (m, n, one, many) => {
    if (one !== undefined) return Number(vals[Number(n || 0)]) === 1 ? one : many;
    const v = n === "" ? vals[i++] : vals[Number(n)];
    return v === undefined || v === null ? "" : String(v);
  });
}

function joinRaw(strings, vals) {
  let s = strings[0];
  for (let i = 0; i < vals.length; i++) s += String(vals[i] ?? "") + strings[i + 1];
  return s;
}

/** 태그 붙은 템플릿: t`문구 ${x}` */
export function t(strings, ...vals) {
  if (cur === "ko") return joinRaw(strings, vals);
  const key = keyOf(strings);
  const en = packs[cur]?.ui?.[key];
  if (typeof en !== "string") { missing.add(key); return joinRaw(strings, vals); }
  return fillSlots(en, vals);
}

/** 열쇠를 직접 주는 판(동적으로 고른 한국어 문구). 값 자리는 {} */
export function tk(key, ...vals) {
  if (cur === "ko") return fillSlots(key, vals);
  const en = packs[cur]?.ui?.[key];
  if (typeof en !== "string") { missing.add(key); return fillSlots(key, vals); }
  return fillSlots(en, vals);
}

/** 같은 한국어가 뜻에 따라 영어가 다를 때: tp("cancel", "그만두기") → 열쇠 "cancel::그만두기". 한국어면 원문 */
export function tp(context, koText, ...vals) {
  if (cur === "ko") return fillSlots(koText, vals);
  const key = `${context}::${koText}`;
  const en = packs[cur]?.ui?.[key];
  if (typeof en !== "string") { missing.add(key); return fillSlots(koText, vals); }
  return fillSlots(en, vals);
}

/** 데이터 표 번역 */
export function tx(key, fallback) {
  if (cur === "ko") return fallback;
  const en = packs[cur]?.data?.[key];
  if (typeof en !== "string") { missing.add(key); return fallback; }
  return en;
}

export const missingKeys = () => [...missing];

/**
 * 처음 언어. 저장이 있는 사람(쓰던 사람)은 저장 값(없으면 ko)이 정하므로 여기서는 ko.
 * 공개 뒤 처음 여는 사람: 휴대폰 첫 언어가 ko로 시작하면 ko, 그 밖은 en. 공개 전에는 늘 ko.
 */
export function pickStartLang(navLangs, hasSave, pub = EN_PUBLIC) {
  if (hasSave || !pub) return "ko";
  const first = Array.isArray(navLangs) && navLangs.length ? String(navLangs[0]).toLowerCase() : "";
  if (!first) return "ko";
  return first.startsWith("ko") ? "ko" : "en";
}

/**
 * v0.14.3: 이번에 열 때 쓸 언어. 언어 단추를 직접 누른 적이 있으면 저장 언어, 없으면 열 때마다 휴대폰 언어.
 * @param {{lang?: string, langChosen?: boolean}} settings
 */
export function deviceLang(settings, navLangs, pub = EN_PUBLIC) {
  if (settings?.langChosen) return normLang(settings.lang);
  return pickStartLang(navLangs, false, pub);
}
