// v0.13.5 텃밭 영어: 안쪽 열쇠(한국어, 저장·엔진·노드 값) ↔ 파이썬이 보는 이름·화면 이름(언어별).
// 설계서 docs/specs/2026-11-11-영어판-설계.md §5-1. 같은 표가 src/py/runner.py(FARM_EN)에도 있고
// tests/py/test_runner_lang.py(test_name_tables_match_js)가 둘이 같은지 본다.
// I18N_SKIP 이 파일의 한글은 데이터 열쇠(화면 문구 아님)
import { lang } from "../i18n.js";

export const GARDEN_EN = Object.freeze({
  crop: Object.freeze({ 당근: "carrot", 감자: "potato", 토마토: "tomato" }), // I18N_SKIP 열쇠
  dir: Object.freeze({ 위: "up", 아래: "down", 왼쪽: "left", 오른쪽: "right" }), // I18N_SKIP 열쇠
  empty: Object.freeze({ 빈칸: "empty" }), // I18N_SKIP 열쇠
  file: Object.freeze({ "주문서.txt": "orders.txt", "손글씨주문.txt": "handwritten.txt", "농장일지.txt": "farm_log.txt" }), // I18N_SKIP 열쇠
});

const BACK = Object.freeze(Object.fromEntries(Object.entries(GARDEN_EN).map(([k, m]) => [k, Object.fromEntries(Object.entries(m).map(([ko, en]) => [en, ko]))])));

/** 안쪽 열쇠 → 그 언어로 파이썬이 보는 이름. 표에 없으면 그대로. kind: crop·dir·empty·file */
export function pyName(kind, v, l = lang()) {
  if (l !== "en") return v;
  const m = GARDEN_EN[kind];
  return m && Object.hasOwn(m, v) ? m[v] : v;
}

/** 영어 이름 → 안쪽 열쇠. 이미 안쪽 열쇠거나 모르면 그대로 */
export function fromPyName(kind, v) {
  const m = BACK[kind];
  return m && Object.hasOwn(m, v) ? m[v] : v;
}

// 화면에 보이는 이름(지금 언어)
export const cropName = (c) => pyName("crop", c);
export const dirName = (d) => pyName("dir", d);
export const fileName = (f) => pyName("file", f);
