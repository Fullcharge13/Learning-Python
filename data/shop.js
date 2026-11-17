// v0.22.0 상점 상품 표 (설계 2026-11-17 §5-4 표가 기준). 값은 작업 3 시뮬레이션 판정에서만 바꾼다.
// kind: "outfit"(data/outfits.js의 id) | 꾸미기 공간 "garden"|"guard"|"workshop"|"editor"
// level: 열리는 레벨(1~30). price: 바이트. legacyFree: 기존 학습자(levels.legacy)는 레벨과 상관없이 산다(원래 8벌만, §5-5).
// 졸업 가운(30일 연속)과 기본복장(처음부터)은 팔지 않으므로 표에 없다. 기록 보호권은 src/rules.js(buyFreeze) 그대로.
// 새 의상 id new1~3은 작업 7에서 이름·그림만 정하고 id는 바꾸지 않는다(저장과 맞추기 위해).
const o = (id, level, price, legacyFree) => (legacyFree ? { id, kind: "outfit", level, price, legacyFree: true } : { id, kind: "outfit", level, price });
const d = (id, kind, level, price) => ({ id, kind, level, price });

export const SHOP_ITEMS = Object.freeze([
  o("casual", 1, 100, true), d("ed_paper", "editor", 1, 100),
  o("hoodie", 3, 180, true), d("gd_fence", "garden", 3, 100),
  o("gym", 5, 180, true), d("ed_forest", "editor", 5, 100),
  o("chef", 8, 180, true), d("gu_night", "guard", 8, 120),
  o("whitecoat", 10, 180, true), d("ws_wood", "workshop", 10, 120),
  o("explorer", 13, 240, true), d("gd_flowers", "garden", 13, 140),
  o("uniform", 15, 240, true), d("ed_sea", "editor", 15, 150),
  o("new1", 18, 300), d("gu_control", "guard", 18, 180),
  o("wizard", 20, 300, true), d("ws_metal", "workshop", 20, 180),
  o("new2", 23, 360), d("ed_night", "editor", 23, 200),
  d("gd_greenhouse", "garden", 26, 240),
  o("new3", 28, 400),
].map(Object.freeze));

/** 꾸미기 공간. 공간마다 한 번에 하나를 켠다(기본 「없음」 = null) */
export const DECO_SPACES = Object.freeze(["garden", "guard", "workshop", "editor"]);
