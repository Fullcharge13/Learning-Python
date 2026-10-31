// v0.5 E3 차트: 실행 결과의 charts(runner.py의 chart 모듈)를 비교하고 SVG로 그린다.
// 순수 함수만 둔다(Node 단위 시험). tests/content.py의 chart_mismatch()가 같은 비교 규칙을 따른다.
//
// 그림 하나 = { kind: "bar" | "line", labels: [글자], values: [수], title?, xlabel?, ylabel? }
// 채점: 기대(레슨 데이터의 chart)에 적힌 칸만 비교한다. 값은 수로(3 == 3.0, 아주 작은 소수 오차는 같음),
//       이름은 글자로(2024 == "2024"), 제목·축 이름은 앞뒤 빈칸을 빼고 비교한다.
//       chart가 객체면 그림이 정확히 1개, 목록이면 같은 수·같은 차례여야 한다.

export const CHART_MAX = 3;
const KINDS = { bar: "막대 그래프", line: "꺾은선 그래프" };
const TEXT_KEYS = [["title", "그래프 제목이 달라요"], ["xlabel", "가로축 이름이 달라요"], ["ylabel", "세로축 이름이 달라요"]];

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function sameNumber(a, b) {
  if (typeof a !== "number" || typeof b !== "number" || !Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** 작업자에서 온 charts를 믿지 않고 모양을 다듬는다(모르는 종류·깨진 그림은 버림, 최대 3개) */
export function cleanCharts(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const c of list) {
    if (!c || typeof c !== "object" || !KINDS[c.kind] || !Array.isArray(c.labels) || !Array.isArray(c.values)) continue;
    if (!c.labels.length || c.labels.length !== c.values.length || !c.values.every((v) => typeof v === "number" && Number.isFinite(v))) continue;
    const g = { kind: c.kind, labels: c.labels.map(String), values: c.values.slice() };
    for (const [k] of TEXT_KEYS) if (c[k] != null) g[k] = String(c[k]);
    out.push(g);
    if (out.length >= CHART_MAX) break;
  }
  return out;
}

function oneMismatch(exp, got) {
  if (exp.kind != null && exp.kind !== got.kind) return `그래프 종류가 달라요(기대: ${KINDS[exp.kind] || exp.kind})`;
  if (exp.labels != null) {
    const a = exp.labels.map(String), b = (got.labels || []).map(String);
    if (a.length !== b.length || a.some((x, i) => x !== b[i])) return "그래프 이름(가로축 항목)이 달라요";
  }
  if (exp.values != null) {
    const b = got.values || [];
    if (exp.values.length !== b.length || exp.values.some((x, i) => !sameNumber(x, b[i]))) return "그래프 값이 달라요";
  }
  for (const [k, msg] of TEXT_KEYS) {
    if (exp[k] != null && String(exp[k]).trim() !== String(got[k] ?? "").trim()) return msg;
  }
  return null;
}

/** 기대 차트(객체 또는 목록)와 실행 결과 charts가 맞으면 null, 아니면 쉬운 말 한 줄 */
export function chartMismatch(expected, charts) {
  const want = Array.isArray(expected) ? expected : [expected];
  const got = Array.isArray(charts) ? charts : [];
  if (!got.length) return "그래프가 그려지지 않았어요. 마지막에 chart.show()를 불렀는지 확인해 봐요";
  if (got.length !== want.length) return `그래프 개수가 달라요(기대 ${want.length}개, 내 코드 ${got.length}개)`;
  for (let i = 0; i < want.length; i++) {
    const why = oneMismatch(want[i] || {}, got[i] || {});
    if (why) return want.length > 1 ? `${i + 1}번째 ${why}` : why;
  }
  return null;
}

// 화면에 보이는 수: 3 → "3", 0.1 + 0.2 → "0.3"
export function fmtNum(v) {
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(Number(v).toPrecision(6)));
}

/** 읽기 프로그램·글로 보는 설명: 「막대 그래프 「제목」(가로축 x, 세로축 y): 사과 3, 배 5」 */
export function chartText(c) {
  let s = KINDS[c.kind] || "그래프";
  if (c.title) s += ` 「${c.title}」`;
  const ax = [c.xlabel ? `가로축 ${c.xlabel}` : "", c.ylabel ? `세로축 ${c.ylabel}` : ""].filter(Boolean);
  if (ax.length) s += `(${ax.join(", ")})`;
  return s + ": " + c.labels.map((l, i) => `${l} ${fmtNum(c.values[i])}`).join(", ");
}

// 글자 폭 어림(px): 한글·한자 등 넓은 글자는 1em, 나머지는 0.6em
function textW(s, size) {
  let w = 0;
  for (const ch of String(s)) w += /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? size : size * 0.6;
  return w;
}

function fit(s, max, size) {
  s = String(s);
  if (textW(s, size) <= max) return s;
  let out = "";
  for (const ch of s) {
    if (textW(out + ch + "…", size) > max) break;
    out += ch;
  }
  return (out || s[0]) + "…";
}

function niceStep(span) {
  const raw = span / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

const W = 340, H = 220;
const r1 = (v) => Math.round(v * 10) / 10;

/** 그림 하나를 SVG 글자로. 색은 style.css의 .chart 규칙(--teal 등)을 따른다 */
export function chartSVG(c) {
  const n = c.labels.length;
  const vals = c.values;
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  if (hi === lo) hi = lo + 1;
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step + 1e-9) * step;
  hi = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.abs(t) < step / 1e6 ? 0 : t);
  const tickW = Math.max(...ticks.map((t) => textW(fmtNum(t), 11)));
  const padL = 8 + tickW + 6 + (c.ylabel ? 18 : 0);
  const padR = 10;
  const padT = (c.title ? 30 : 10) + 14; // 값 글자 자리
  const padB = 22 + (c.xlabel ? 20 : 0);
  const pw = W - padL - padR, ph = H - padT - padB;
  const y = (v) => r1(padT + ph - ((v - lo) / (hi - lo)) * ph);
  const band = pw / n;
  const cx = (i) => r1(padL + band * (i + 0.5));
  const parts = [];
  if (c.title) parts.push(`<text class="c-title" x="${W / 2}" y="20" text-anchor="middle">${esc(fit(c.title, W - 20, 14))}</text>`);
  for (const t of ticks) {
    parts.push(`<line class="c-grid${t === 0 ? " c-zero" : ""}" x1="${r1(padL)}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/>`);
    parts.push(`<text class="c-yt" x="${r1(padL - 6)}" y="${y(t) + 4}" text-anchor="end">${esc(fmtNum(t))}</text>`);
  }
  if (c.ylabel) parts.push(`<text class="c-axis" transform="translate(13 ${r1(padT + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(fit(c.ylabel, ph, 11))}</text>`);
  if (c.xlabel) parts.push(`<text class="c-axis" x="${r1(padL + pw / 2)}" y="${H - 6}" text-anchor="middle">${esc(fit(c.xlabel, pw, 11))}</text>`);
  // 가로축 이름: 칸이 좁으면 몇 개 건너 하나씩, 길면 줄임
  const every = Math.max(1, Math.ceil(26 / band));
  const room = band * every - 4;
  c.labels.forEach((l, i) => {
    if (i % every) return;
    parts.push(`<text class="c-xl" x="${cx(i)}" y="${r1(padT + ph + 16)}" text-anchor="middle">${esc(fit(l, room, 11))}</text>`);
  });
  const showVals = n <= 12;
  const valText = (i, yy) => showVals
    ? `<text class="c-val" x="${cx(i)}" y="${r1(yy)}" text-anchor="middle">${esc(fit(fmtNum(vals[i]), band + 8, 10))}</text>` : "";
  if (c.kind === "bar") {
    const bw = Math.max(2, Math.min(band * 0.62, 44));
    vals.forEach((v, i) => {
      const top = Math.min(y(v), y(0)), h = Math.max(1, Math.abs(y(v) - y(0)));
      parts.push(`<rect class="c-bar" x="${r1(cx(i) - bw / 2)}" y="${r1(top)}" width="${r1(bw)}" height="${r1(h)}" rx="2"/>`);
      parts.push(valText(i, v >= 0 ? top - 4 : top + h + 11));
    });
  } else {
    parts.push(`<polyline class="c-line" points="${vals.map((v, i) => `${cx(i)},${y(v)}`).join(" ")}"/>`);
    vals.forEach((v, i) => {
      parts.push(`<circle class="c-dot" cx="${cx(i)}" cy="${y(v)}" r="3.5"/>`);
      parts.push(valText(i, y(v) - 8));
    });
  }
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${parts.join("")}</svg>`;
}

/** 그림 목록 → <figure>들(그림 + 보이는 글 설명). 그림은 aria-hidden, 설명이 읽힌다 */
export function chartsHTML(charts) {
  const list = cleanCharts(Array.isArray(charts) ? charts : charts ? [charts] : []);
  return list.map((c) => `<figure class="chart">${chartSVG(c)}<figcaption class="chart-desc">${esc(chartText(c))}</figcaption></figure>`).join("");
}
