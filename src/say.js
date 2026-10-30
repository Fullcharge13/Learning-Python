// 리아 교수 대사 고르기 (설계서 6-3)
import { LINES, FALLBACK_LINE } from "../data/lines.js";

const VALUE_KEYS = ["streak", "xp", "outfit"];
const has = (v) => v !== undefined && v !== null && String(v).trim() !== "";

// 이 줄에 필요한 값({streak}·{xp}·{outfit})이 vars에 모두 있는가
function usable(text, vars) {
  return VALUE_KEYS.every((k) => !text.includes(`{${k}}`) || has(vars[k]));
}

// 자리 표시를 한 번에 채운다(바꿔 넣은 글자를 다시 바꾸지 않음, $ 패턴 해석 없음).
// 이름이 비면 줄 맨 앞 「{name}님, 」 덩어리를 통째로 뺀다(대사 표는 이 꼴로만 씀 — 시험 name_form).
function fill(text, vars) {
  const name = has(vars.name) ? String(vars.name).trim() : "";
  const out = text.replace(/\{name\}님, ?|\{(name|streak|xp|outfit)\}/g, (m, key) => {
    if (key === undefined) return name ? `${name}님, ` : ""; // 「{name}님, 」 덩어리
    if (key === "name") return name;
    return has(vars[key]) ? String(vars[key]) : "";
  });
  return out.replace(/\s{2,}/g, " ").trim();
}

// rng 값을 [0, 1) 안으로 맞춘다. NaN·음수·무한 → 0
function unit(rng) {
  const v = Number(rng());
  if (!Number.isFinite(v) || v < 0) return 0;
  return v >= 1 ? 1 - Number.EPSILON : v;
}

/**
 * 상황에 맞는 리아 교수 대사 한 줄을 고른다.
 * @param {string} situation  ledger 「대사 상황 id」(greet, correct, …)
 * @param {{name?:string, streak?:number, xp?:number, outfit?:string}} [vars]
 *   자리 표시 값. outfit은 의상 표의 short 이름. 값이 없는 자리 표시를 쓰는 줄은 건너뛴다.
 * @param {() => number} [rng]  0 이상 1 미만을 돌려주는 난수 함수
 * @param {number|null} [last]  **같은 상황**에서 직전에 고른 줄 번호(돌려받은 index). 이 줄은 다시 고르지 않는다.
 * @returns {{text:string, face:string, index:number}}  index는 LINES[situation] 안의 번호, 대체 대사면 -1
 */
export function say(situation, vars = {}, rng = Math.random, last = null) {
  vars = vars ?? {};
  if (typeof rng !== "function") rng = Math.random;
  const lines = Array.isArray(LINES[situation]) ? LINES[situation] : [];
  const ok = lines.map((l, i) => i).filter((i) => usable(lines[i].text, vars));
  // 고를 줄이 둘 이상이면 직전 줄을 뺀다
  const pool = ok.length >= 2 ? ok.filter((i) => i !== last) : ok;
  if (pool.length === 0) {
    return { text: fill(FALLBACK_LINE.text, vars), face: FALLBACK_LINE.face, index: -1 };
  }
  const index = pool[Math.min(pool.length - 1, Math.floor(unit(rng) * pool.length))];
  return { text: fill(lines[index].text, vars), face: lines[index].face, index };
}
