// 채점 핵심 (설계서 4-3, 4-5). 실행은 runner.py(작업 5에서 Pyodide 작업자)가 하고,
// 이 파일은 실행 결과를 비교하고 오류를 설명할 뿐이다.
import { ERRORS, ERROR_ALIASES } from "../data/errors.js";

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

// results[i]는 tests[i]의 실행 결과 { stdout, error, missing, timeout? }.
// 공개 시험이 틀리면 publicDiff(기대·실제 출력), 숨은 시험이 틀리면 번호만.
export function judge(results, tests) {
  const list = results || [];
  for (let i = 0; i < tests.length; i++) {
    const r = list[i];
    let reason = null;
    if (!r) reason = "error";
    else if (r.timeout) reason = "timeout";
    else if (r.error) reason = "error";
    else if (normalize(r.stdout) !== normalize(tests[i].expect)) reason = "output";
    else if (r.missing && r.missing.length) reason = "missing";
    if (reason) {
      const out = { pass: false, failedIndex: i, reason };
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
    s = s.replace(/\[\[[^\]]*\]\]/g, "").replace(/\{line\}번째 줄/g, "코드 어딘가");
  } else {
    s = s.replace(/\[\[|\]\]/g, "");
  }
  return s
    .replace(/\{line\}/g, line == null ? "" : String(line))
    .replace(/\{type\}/g, type || "오류")
    .replace(/\{seconds\}/g, String(seconds));
}

// error: { type, line, msg } (또는 { type: "Timeout" }). 모르는 오류여도 예외를 던지지 않는다.
// opts.seconds: 시간 초과 문구의 제한 시간(기본 3초).
export function explain(error, outfit, opts = {}) {
  const seconds = opts && opts.seconds != null ? opts.seconds : 3;
  const type = error && typeof error.type === "string" && error.type ? error.type : "";
  const rawLine = error ? error.line : null;
  const line = Number.isInteger(rawLine) && rawLine > 0 ? rawLine : null;
  const has = (k) => Object.prototype.hasOwnProperty.call(ERRORS, k) && k !== "_default";
  const key = has(type) ? type
    : (Object.prototype.hasOwnProperty.call(ERROR_ALIASES, type) ? ERROR_ALIASES[type] : "_default");
  const entry = ERRORS[key];
  const body = outfit === "detective" && entry.detective ? entry.detective : entry.body;
  return { title: fill(entry.title, line, type, seconds), body: fill(body, line, type, seconds), line };
}
