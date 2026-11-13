// 채점 핵심 (설계서 4-3, 4-5). 실행은 runner.py(작업 5에서 Pyodide 작업자)가 하고,
// 이 파일은 실행 결과를 비교하고 오류를 설명할 뿐이다.
import { OUTFITS } from "../data/outfits.js";
import { chartMismatch } from "./chart.js";
import { t, tx, lang } from "./i18n.js";
import { loadChunk } from "./chunks.js";

// v0.17.0: 오류 설명 자료(data/errors.js)는 첫 파일 밖의 묶음(js/errors-<지문>.js)이라, 받아 온 뒤에야 있다.
// useErrorData(모듈): 시험·개발판이 직접 넣음 / ensureErrorData(): 묶음을 받아 넣고(실패해도 던지지 않음) / hasErrorData(): 있나
let data = null;
let pending = null;
export function useErrorData(d) {
  data = d && d.ERRORS ? { ERRORS: d.ERRORS, ERROR_ALIASES: d.ERROR_ALIASES || {}, ERROR_VARIANTS: d.ERROR_VARIANTS || [] } : null;
}
export function hasErrorData() { return data !== null; }
export const ERROR_DATA_TIMEOUT_MS = 8000;
/** 못 받거나 ~8초 안에 안 오면 던지지 않고 끝난다(간단 카드로 남음). 늦게라도 오면 쓰고, 다음 오류 때는 같은 받기를 이어 기다린다. */
export function ensureErrorData({ load = () => loadChunk("errors"), timeoutMs = ERROR_DATA_TIMEOUT_MS } = {}) {
  if (data) return Promise.resolve();
  if (!pending) {
    let timer;
    const timeout = new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); });
    const got = load().then(useErrorData, () => {});   // 실패하면 간단 카드로 남고, 다음 오류 때 다시 받아 봄
    const p = pending = Promise.race([got, timeout])
      .finally(() => { clearTimeout(timer); if (pending === p) pending = null; });
  }
  return pending;
}

// 줄마다 오른쪽 공백 제거, \r\n → \n, 끝 줄바꿈 제거.
export function normalize(text) {
  if (text == null) return "";
  return String(text)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

// results[i]는 tests[i]의 실행 결과 { stdout, error, missing, charts?, timeout? }.
// 공개 시험이 틀리면 publicDiff(기대·실제 출력), 숨은 시험이 틀리면 번호만.
// 시험에 chart가 있으면 출력과 그래프를 둘 다 맞혀야 통과(v0.5 E3). 틀리면 reason "chart", chartWhy(쉬운 말).
export function judge(results, tests) {
  const list = results || [];
  for (let i = 0; i < tests.length; i++) {
    const r = list[i];
    let reason = null;
    let chartWhy = null;
    if (!r) reason = "error";
    else if (r.timeout) reason = "timeout";
    else if (r.error) reason = "error";
    else if (normalize(r.stdout) !== normalize(tests[i].expect)) reason = "output";
    else if (tests[i].chart != null && (chartWhy = chartMismatch(tests[i].chart, r.charts))) reason = "chart";
    else if (r.missing && r.missing.length) reason = "missing";
    if (reason) {
      const out = { pass: false, failedIndex: i, reason };
      if (chartWhy) out.chartWhy = chartWhy;
      if (tests[i].public) {
        out.publicDiff = { expected: normalize(tests[i].expect), actual: normalize(r && r.stdout) };
      }
      return out;
    }
  }
  return { pass: true, failedIndex: -1 };
}

function fill(text, line, type, seconds) {
  let s = String(text);
  if (line == null) {
    // 줄 번호가 있을 때만 말이 되는 부분을 빼고, 줄을 「코드 어딘가」로 바꾼다(data/errors.js 머리말).
    // 영어판 문구는 「line {line}」을 쓰고, 없으면 「somewhere in your code」(문장 첫머리 Line이면 대문자로).
    const where = t`코드 어딘가`;
    const lineRe = lang() === "en" ? /\b[Ll]ine \{line\}/g : /\{line\}번째 줄/g;
    s = s.replace(/\[\[[^\]]*\]\]/g, "").replace(lineRe, (m) => (m[0] === "L" ? where[0].toUpperCase() + where.slice(1) : where));
  } else {
    s = s.replace(/\[\[|\]\]/g, "");
  }
  return s
    .replace(/\{line\}/g, line == null ? "" : String(line))
    .replace(/\{type\}/g, type || t`오류`)
    .replace(/\{seconds\}/g, String(seconds));
}

// error: { type, line, msg } (또는 { type: "Timeout" }). 모르는 오류여도 예외를 던지지 않는다.
// opts.seconds: 시간 초과 문구의 제한 시간(기본 3초).
// opts.starterNames: 경비실 화면이 넘기는 그 사건 시작 코드의 이름 목록(NameError_starter용).
export function explain(error, outfit, opts = {}) {
  const seconds = opts && opts.seconds != null ? opts.seconds : 3;
  const type = error && typeof error.type === "string" && error.type ? error.type : "";
  const rawLine = error ? error.line : null;
  const line = Number.isInteger(rawLine) && rawLine > 0 ? rawLine : null;
  if (!data) {
    // 오류 안내 묶음을 못 받았을 때: 종류와 줄 번호만 있는 간단 카드
    return { title: type ? t`${type} 오류` : t`오류`, body: line == null ? t`코드를 살펴보세요` : t`${line}번째 줄 근처를 살펴보세요`, line };
  }
  const { ERRORS, ERROR_ALIASES, ERROR_VARIANTS } = data;
  const has = (k) => Object.prototype.hasOwnProperty.call(ERRORS, k) && k !== "_default";
  const key = has(type) ? type
    : (Object.prototype.hasOwnProperty.call(ERROR_ALIASES, type) ? ERROR_ALIASES[type] : "_default");
  // 같은 종류 안 원인별 변형: 메시지가 무늬와 맞는 첫 변형(설계서 §2-4). starter는 화면이 넘긴 이름 목록에 있을 때만.
  const msg = error && typeof error.msg === "string" ? error.msg : "";
  const starter = opts && Array.isArray(opts.starterNames) ? opts.starterNames : [];
  let variant = null;
  if (msg && key !== "_default") {
    for (const v of ERROR_VARIANTS) {
      if (v.type !== key) continue;
      const m = new RegExp(v.pattern).exec(msg);
      if (!m) continue;
      if (v.key === "NameError_starter" && !starter.includes(m[1])) continue;
      variant = v.key;
      break;
    }
  }
  const useKey = variant || key;
  const entry = ERRORS[useKey];
  const o = typeof outfit === "string" ? OUTFITS.find((x) => x.id === outfit) : null;
  const voice = o && o.voice;   // 탐험가 → "detective" (판정 C42)
  // 영어판: 같은 칸 이름으로 tx("error.<종류>.title|body|detective")에서 찾는다(없으면 한국어 원문)
  const body = voice && typeof entry[voice] === "string" ? tx(`error.${useKey}.${voice}`, entry[voice]) : tx(`error.${useKey}.body`, entry.body);
  const title = tx(`error.${useKey}.title`, entry.title);
  return { title: fill(title, line, type, seconds), body: fill(body, line, type, seconds), line };
}

// 시작 코드가 「만드는」 이름만 뽑는다(NameError_starter용): import한 이름(from x import y 포함)·def/class 이름·
// 대입·for 대상. 쓰기만 하는 이름(예: 빈칸이 채워져야 생기는 것)과 함수 매개변수는 뺀다. 글자 따옴표 안·# 주석·{0} 자리는 무시. 중복 없음.
export function definedNames(code) {
  if (typeof code !== "string") return [];
  const bare = code
    .replace(/("""|\'\'\')[\s\S]*?\1/g, " ")
    .replace(/(["'])(?:\\.|(?!\1)[^\n\\])*\1/g, " ")
    .replace(/#[^\n]*/g, " ");
  const out = new Set();
  const id = "[A-Za-z_]\\w*";
  const ids = (text) => (text.match(new RegExp(id, "g")) || []);
  const imports = (list, top) => {
    for (const part of list.replace(/[()]/g, "").split(",")) {
      const [a, b] = part.trim().split(/\s+as\s+/);
      const n = (b || (top ? a.split(".")[0] : a) || "").trim();
      if (new RegExp(`^${id}$`).test(n)) out.add(n);
    }
  };
  for (const line of bare.split("\n")) {
    let m;
    if ((m = line.match(/^\s*import\s+(.+)/))) imports(m[1], true);
    else if ((m = line.match(/^\s*from\s+\S+\s+import\s+(.+)/))) imports(m[1], false);
    else if ((m = line.match(new RegExp(`^\\s*(?:def|class)\\s+(${id})`)))) out.add(m[1]);
    else if ((m = line.match(/^\s*for\s+(.+?)\s+in\b/))) ids(m[1]).forEach((n) => out.add(n));
    else if ((m = line.match(new RegExp(`^\\s*(${id}(?:\\s*,\\s*${id})*)\\s*=(?!=)`)))) ids(m[1]).forEach((n) => out.add(n));
  }
  return [...out];
}
