// 매일 도전 「틀」 엔진 (v0.9 작업 2, 판정 C54). 순수 함수 + 실행기를 받아 쓰는 async 하나.
//
// 틀(장 파일의 TEMPLATES) 하나:
//   { id: "N-T1", concept, type: "choice" | "blank", q, code, vars, explain, stdin?,
//     wrong: [오답 코드 2~3개] (choice),  chips: [칩 3~4개], answer: 정답 칩 번호 (blank) }
//   vars: { 대문자이름: [값, …] | { min, max } }  — q·code·wrong·chips·stdin·explain의 {이름}을 바꿔 끼움.
//   {OUT}은 예약 이름: 정답 코드를 실행한 화면 출력(q·explain에서만).
//
// 정답·오답 보기는 실제 실행 결과로 정한다(학습자 기기의 Pyodide 작업자). 같은 틀·씨앗·시도 번호면
// 언제나 같은 문제가 나온다. 보기가 겹치면(dup) 다음 시도 번호로 다시 만든다(최대 TEMPLATE_ATTEMPTS번).
// 점검기(tests/content.py)는 씨앗 0~99를 이 파일의 instantiate로 만들어 CPython으로 돌려 보고,
// 아래 judgeInstance와 같은 규칙으로 모든 씨앗이 TEMPLATE_ATTEMPTS번 안에 문제가 되는지 확인한다.
// 앱은 씨앗을 0~99에서만 고르므로 학습자가 받는 문제는 모두 점검기가 미리 돌려 본 것이다.
import { normalize } from "./grade.js";
import { t } from "./i18n.js";

export const TEMPLATE_SEEDS = 100;
export const TEMPLATE_ATTEMPTS = 5;
export const OPTION_COLS = 30;               // 보기 한 줄 폭(한글 2칸) — 점검기와 같은 값
// 오답 코드가 오류를 내면 이 보기. 화면에는 errorOption()(언어 따름)을 쓴다
export const ERROR_OPTION = "오류가 나요";   // I18N_SKIP 한국어 기준값(tests/content.py와 같은 값), 화면은 errorOption()
export const errorOption = () => t`오류가 나요`;
export const OUT_KEY = "OUT";
const VAR_RE = /\{([A-Z][A-Z0-9_]*)\}/g;

function hashStr(str) {
  // FNV-1a 32비트 (quests.js와 같음)
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export { hashStr };

/** 글에 쓰인 대문자 자리 표시 이름들(중복 없이) */
export function placeholders(text) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(VAR_RE)) out.add(m[1]);
  return [...out];
}

/** 화면 폭(한글·전각 2칸) */
export function textWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return w;
}

/** 틀에 값을 바꿔 끼운 한 벌. 실행은 하지 않는다. vars 이름은 정렬 순서로 뽑는다(점검기와 같은 순서). */
export function instantiate(t, seed, attempt = 0) {
  const rng = mulberry32(hashStr(`${t.id}|${seed}|${attempt}`));
  const vals = {};
  for (const k of Object.keys(t.vars || {}).sort()) {
    const v = t.vars[k];
    vals[k] = Array.isArray(v) ? v[Math.floor(rng() * v.length)] : v.min + Math.floor(rng() * (v.max - v.min + 1));
  }
  const fill = (s) => (typeof s === "string" ? s.replace(VAR_RE, (m, k) => (Object.hasOwn(vals, k) ? String(vals[k]) : m)) : s);
  return {
    id: t.id, seed, attempt, vals, type: t.type, concept: t.concept,
    q: fill(t.q), code: fill(t.code), stdin: fill(t.stdin ?? ""), explain: fill(t.explain ?? ""),
    wrong: (t.wrong || []).map(fill), chips: (t.chips || []).map(fill), answer: t.type === "blank" ? t.answer : 0,
  };
}

/** 실행할 코드 목록: choice → [정답, 오답…], blank → 칩마다 빈칸을 채운 코드(칩 순서) */
export function runList(inst) {
  return inst.type === "blank" ? inst.chips.map((c) => inst.code.split("___").join(c)) : [inst.code, ...inst.wrong];
}

const outText = (r) => (r && r.error ? null : normalize(r ? r.stdout : ""));

/**
 * 실행 결과로 문제를 만든다. 돌려줌 { ok: true, item } | { ok: false, why }.
 * why: "dup"(보기가 겹침 → 다음 시도) · "answer-error"(정답 코드가 오류) · "empty" · "multiline" · "wide"
 * (dup 말고는 틀을 잘못 쓴 것 — 점검기가 오류로 알린다)
 */
export function judgeInstance(inst, results) {
  const ai = inst.type === "blank" ? inst.answer : 0;
  const ans = outText(results[ai]);
  if (ans === null) return { ok: false, why: "answer-error" };
  if (!ans) return { ok: false, why: "empty" };
  const fillOut = (s) => s.split(`{${OUT_KEY}}`).join(ans);
  if (inst.type === "blank") {
    if (/\{OUT\}/.test(inst.q + inst.explain) && ans.includes("\n")) return { ok: false, why: "multiline" };
    for (let i = 0; i < results.length; i++) {
      if (i !== ai && outText(results[i]) === ans) return { ok: false, why: "dup" };
    }
    return {
      ok: true,
      item: { type: "blank", concept: inst.concept, q: fillOut(inst.q), code: inst.code, chips: inst.chips.slice(), answer: ai,
        explain: fillOut(inst.explain), ...(inst.stdin ? { stdin: inst.stdin } : {}) },
    };
  }
  const opts = results.map((r) => { const o = outText(r); return o === null ? errorOption() : o; });
  if (opts.some((o) => o.includes("\n"))) return { ok: false, why: "multiline" };
  if (opts.some((o) => !o.trim())) return { ok: false, why: "empty" };
  if (opts.some((o) => textWidth(o) > OPTION_COLS)) return { ok: false, why: "wide" };
  if (new Set(opts).size !== opts.length) return { ok: false, why: "dup" };
  return {
    ok: true,
    item: { type: "choice", concept: inst.concept, q: fillOut(inst.q), code: inst.code, options: opts, answer: 0,
      explain: fillOut(inst.explain), ...(inst.stdin ? { stdin: inst.stdin } : {}) },
  };
}

/**
 * 틀 하나 + 씨앗 → 문제(lesson.js가 그리는 choice/blank 모양 + tpl·seed·attempt). 실패하면 null.
 * @param run async (code, stdin) => { stdout, error } (앱: Pyodide 작업자)
 */
export async function makeTemplateItem(t, seed, run) {
  for (let attempt = 0; attempt < TEMPLATE_ATTEMPTS; attempt++) {
    const inst = instantiate(t, seed, attempt);
    const results = [];
    try {
      for (const code of runList(inst)) results.push(await run(code, inst.stdin));
    } catch {
      return null;
    }
    const j = judgeInstance(inst, results);
    if (j.ok) return { ...j.item, tpl: t.id, seed, attempt };
    if (j.why !== "dup") return null;
  }
  return null;
}
