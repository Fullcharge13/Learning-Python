// v0.10 파이의 텃밭 그림: 자람 단계 · 재생 단계(replayFrames) · SVG 그리기(render). 순수 함수, 화면 없음.
// 설계: docs/specs/2026-11-05-파이의-텃밭-설계.md §2(기록 재생)·§5(그림)
//
// 재생 규칙은 src/py/runner.py의 farm 모듈을 따라간다(시험 tests/unit/garden_view.test.js가 실제 엔진 결과와 맞춰 봄):
//   시간 1짜리 사건(move·plant·plant_fail·harvest·harvest_young·harvest_empty)은 지금 clock에 일어나고 clock += 1.
//   plant는 planted_at = 그때 clock. say는 시간이 들지 않는다.
//   (v0.12) 창고는 늘 CROPS의 작물 전부(없으면 0), 토마토 씨앗 봉투 seeds(없거나 이상하면 5, 0..20):
//   토마토 plant −1, 토마토 harvest +2(최대 20). plant_fail(no_tomato_seed 등)·harvest_young은 봉투 그대로.
// 그림은 이미지 파일 없이 SVG 글자로 만든다. 파이는 snake.js의 뱀 친구 그림(snake, 세트1에서 옮김)을 작게 다시 쓴다.
// <defs>·id를 쓰지 않아 같은 입력이면 같은 글자이고, 한 화면에 여러 장이어도 충돌하지 않는다.
import { CROPS } from "../../data/garden.js";
import { cleanSeeds, SEEDS_MAX } from "./state.js";
import { snake } from "../snake.js";
import { t } from "../i18n.js";

export const CELL = 64;   // 칸 한 변(SVG 단위)
const PAD = 8;            // 밭 바깥 여백
const FERT = "비료"; // I18N_SKIP 성장 id(안쪽 열쇠)

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r1 = (v) => Math.round(v * 10) / 10;

/** 자라는 시간(행동 수). 비료가 있으면 짧아진다 */
export function growTime(crop, upgrades) {
  const c = CROPS[crop];
  if (!c) return Infinity;
  return (upgrades || []).includes(FERT) ? c.fert : c.grow;
}

/** 칸의 자람 단계: null(빈칸) | "seed"(막 심음, 절반 전) | "grow"(자라는 중) | "ripe"(다 자람) */
export function stage(cell, clock, upgrades) {
  if (!cell) return null;
  const g = growTime(cell.crop, upgrades);
  const age = clock - cell.planted_at;
  if (age >= g) return "ripe";
  return age * 2 >= g ? "grow" : "seed";
}

// ---- 재생 ----
function copyState(s) {
  return {
    size: s.size,
    cells: (s.cells || []).map((c) => (c ? { crop: c.crop, planted_at: c.planted_at } : null)),
    pie: { x: s.pie.x, y: s.pie.y },
    clock: s.clock,
    store: Object.fromEntries(Object.keys(CROPS).map((c) => [c, s.store?.[c] ?? 0])),
    upgrades: [...(s.upgrades || [])],
    seeds: cleanSeeds(s.seeds),
  };
}
const TOMATO = "토마토"; // I18N_SKIP 작물 열쇠
const SEEDS_PER_HARVEST = 2;   // runner FARM_SEEDS_PER_HARVEST

const TIMED = new Set(["move", "plant", "plant_fail", "harvest", "harvest_young", "harvest_empty"]);

/**
 * 사건마다 그 사건 뒤의 텃밭 한 장면. 시작 상태는 고치지 않는다.
 * @returns [{ event, line, state, facing, say: 글|null, fx: {t,x,y,crop?,reason?}|null }]
 */
export function replayFrames(start, events, facing = "오른쪽") { // I18N_SKIP 방향 열쇠
  if (!Array.isArray(events) || events.length === 0) return [];
  let st = copyState(start);
  let face = facing;
  let say = null;
  const frames = [];
  for (const e of events) {
    st = copyState(st);
    let fx = null;
    const at = Number.isInteger(e.x) && Number.isInteger(e.y) ? e.y * st.size + e.x : -1;
    if (TIMED.has(e.t)) {
      const now = st.clock;
      st.clock = now + 1;
      say = null;
      switch (e.t) {
        case "move":
          st.pie = { x: e.x, y: e.y };
          if (e.dir) face = e.dir;
          break;
        case "plant":
          if (at >= 0) st.cells[at] = { crop: e.crop, planted_at: now };
          if (e.crop === TOMATO) st.seeds = Math.max(0, st.seeds - 1);
          fx = { t: "plant", x: e.x, y: e.y, crop: e.crop };
          break;
        case "harvest":
          if (at >= 0) st.cells[at] = null;
          st.store[e.crop] = (st.store[e.crop] || 0) + 1;
          if (e.crop === TOMATO) st.seeds = Math.min(SEEDS_MAX, st.seeds + SEEDS_PER_HARVEST);
          fx = { t: "harvest", x: e.x, y: e.y, crop: e.crop };
          break;
        case "harvest_young":
          if (at >= 0) st.cells[at] = null;
          fx = { t: "harvest_young", x: e.x, y: e.y, crop: e.crop };
          break;
        default: // plant_fail · harvest_empty
          fx = { t: e.t, x: e.x, y: e.y, crop: e.crop, reason: e.reason };
      }
    } else if (e.t === "say") {
      say = String(e.text ?? "");
    }
    frames.push({ event: e, line: e.line ?? null, state: st, facing: face, say, fx });
  }
  return frames;
}

// ---- 긴 재생 줄이기(검토 C62) ----
export const REPLAY_FRAMES_MAX = 150;
const KEEP_FRAMES = new Set(["harvest", "plant", "say"]);

/**
 * 장면이 REPLAY_FRAMES_MAX보다 많으면 k = ceil(n / 150)장마다 하나만 그린다(나머지는 다음 그리는 장면에 합쳐짐 —
 * 장면마다 그때까지의 상태를 다 갖고 있으므로 건너뛰어도 상태는 맞다). 수확·심기·말하기 장면과 마지막 장면은 언제나
 * 남겨 끝 상태가 정확하다. 150장 이하면 받은 배열 그대로.
 */
export function thinFrames(frames, max = REPLAY_FRAMES_MAX) {
  const n = Array.isArray(frames) ? frames.length : 0;
  if (n <= max) return frames;
  const k = Math.ceil(n / max);
  return frames.filter((f, i) => i === n - 1 || (i + 1) % k === 0 || KEEP_FRAMES.has(f.event?.t));
}

// ---- 그리기 ----
const COL = {
  soil: "#CFA273", soil2: "#C39568", soilEdge: "#8A5A34", furrow: "#B3845A",
  leaf: "#5CB85C", leafD: "#3E8E41", leafL: "#9BDB7A", ol: "#3B2C35",
  carrot: "#F28C28", carrotD: "#C9661A", potato: "#D9B77A", potatoD: "#A88550", potLeaf: "#4F9A55",
  pieRing: "#FFD43B", teal: "#1F9E93", ink: "#22304A", card: "#FFFDF8", coral: "#E4664F", coralInk: "#B03A25",
  sun: "#FFD43B", gray: "#8A90A0",
  tomato: "#E2483A", tomatoD: "#B32E24", tomatoL: "#FF8A7A", tomatoG: "#8CC63F", tomLeaf: "#3F8F3A", stake: "#9C6B3E",
};

const leafPath = (x, y, h, w, rot) =>
  `<path d="M${x},${y} Q${r1(x - w)},${r1(y - h * 0.55)} ${x},${r1(y - h)} Q${r1(x + w)},${r1(y - h * 0.55)} ${x},${y}Z" transform="rotate(${rot} ${x} ${y})"/>`;

// 토마토(v0.12): 막대에 기대 자라는 줄기 — 씨앗(떡잎 둘) → 자람(줄기·잎·작은 풋열매) → 다 자람(빨간 열매 둘, 꼭지 별)
function tomatoSVG(st, cx, cy) {
  const L = COL.tomLeaf;
  const calyx = (x, y) => `<path d="M${x - 5},${y - 5} L${x},${y - 3} L${x + 5},${y - 5} L${x + 2},${y - 1} L${x},${y - 8} L${x - 2},${y - 1}Z" fill="${L}" stroke="${COL.ol}" stroke-width="1.1" stroke-linejoin="round"/>`;
  if (st === "seed") {
    return `<path d="M${cx},${cy + 12} L${cx},${cy + 4}" stroke="${L}" stroke-width="2.4" stroke-linecap="round"/>`
      + `<g fill="${L}" stroke="${COL.ol}" stroke-width="1.6"><ellipse cx="${cx - 6}" cy="${cy + 3}" rx="6" ry="3.2" transform="rotate(-20 ${cx - 6} ${cy + 3})"/>`
      + `<ellipse cx="${cx + 6}" cy="${cy + 3}" rx="6" ry="3.2" transform="rotate(20 ${cx + 6} ${cy + 3})"/></g>`
      + `<ellipse cx="${cx}" cy="${cy + 13}" rx="7" ry="2.5" fill="${COL.furrow}"/>`;
  }
  let s = `<path d="M${cx + 13},${cy + 20} L${cx + 13},${cy - 18}" stroke="${COL.stake}" stroke-width="3" stroke-linecap="round"/>`;
  s += `<path d="M${cx},${cy + 20} Q${cx - 3},${cy + 4} ${cx + 2},${cy - 12}" fill="none" stroke="${L}" stroke-width="3" stroke-linecap="round"/>`;
  s += `<g fill="${L}" stroke="${COL.ol}" stroke-width="1.5">${leafPath(cx - 1, cy + 6, 14, 5, -60)}${leafPath(cx, cy - 2, 13, 5, 55)}${leafPath(cx + 1, cy - 10, 11, 4, -40)}</g>`;
  if (st === "grow") {
    s += `<circle cx="${cx - 6}" cy="${cy + 10}" r="4.5" fill="${COL.tomatoG}" stroke="${COL.ol}" stroke-width="1.5"/>`;
    return s;
  }
  // ripe: 둥근 빨간 열매 둘(빛 반사 한 점) + 반짝
  for (const [x, y, r] of [[cx - 7, cy + 12, 9], [cx + 6, cy + 2, 7.5]]) {
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${COL.tomato}" stroke="${COL.ol}" stroke-width="1.8"/>`;
    s += `<path d="M${r1(x - r * 0.55)},${r1(y - r * 0.15)} Q${r1(x - r * 0.45)},${r1(y - r * 0.6)} ${r1(x - r * 0.05)},${r1(y - r * 0.65)}" fill="none" stroke="${COL.tomatoL}" stroke-width="2" stroke-linecap="round"/>`;
    s += calyx(x, y - r + 3);
  }
  s += `<path d="M${cx + 20},${cy - 22} l2,5 5,2 -5,2 -2,5 -2,-5 -5,-2 5,-2z" fill="${COL.sun}" stroke="${COL.ol}" stroke-width="1.2"/>`;
  return s;
}

function cropSVG(cell, st, cx, cy) {
  if (cell.crop === TOMATO) return tomatoSVG(st, cx, cy);
  const potato = cell.crop === "감자"; // I18N_SKIP 작물 열쇠
  const leaf = potato ? COL.potLeaf : COL.leaf;
  let s = "";
  if (st === "seed") {
    s += `<g fill="${leaf}" stroke="${COL.ol}" stroke-width="1.6">${leafPath(cx, cy + 10, 12, 5, -30)}${leafPath(cx, cy + 10, 12, 5, 30)}</g>`;
    s += `<ellipse cx="${cx}" cy="${cy + 11}" rx="7" ry="2.5" fill="${COL.furrow}"/>`;
    return s;
  }
  if (st === "grow") {
    if (potato) {
      s += `<g fill="${leaf}" stroke="${COL.ol}" stroke-width="1.6">${[-50, -15, 15, 50].map((a) => leafPath(cx, cy + 12, 20, 8, a)).join("")}</g>`;
    } else {
      s += `<ellipse cx="${cx}" cy="${cy + 13}" rx="7" ry="4" fill="${COL.carrot}" stroke="${COL.ol}" stroke-width="1.6"/>`;
      s += `<g fill="${leaf}" stroke="${COL.ol}" stroke-width="1.6">${[-35, 0, 35].map((a) => leafPath(cx, cy + 10, 22, 5, a)).join("")}</g>`;
    }
    return s;
  }
  // ripe
  if (potato) {
    s += `<g fill="${leaf}" stroke="${COL.ol}" stroke-width="1.6">${[-60, -25, 25, 60].map((a) => leafPath(cx, cy + 6, 22, 9, a)).join("")}</g>`;
    s += `<g fill="${COL.potato}" stroke="${COL.ol}" stroke-width="1.8">
      <ellipse cx="${cx - 9}" cy="${cy + 15}" rx="10" ry="8"/><ellipse cx="${cx + 9}" cy="${cy + 16}" rx="9" ry="7.5"/></g>`;
    s += `<g fill="${COL.potatoD}"><circle cx="${cx - 12}" cy="${cy + 13}" r="1.3"/><circle cx="${cx - 6}" cy="${cy + 18}" r="1.3"/><circle cx="${cx + 11}" cy="${cy + 14}" r="1.3"/></g>`;
  } else {
    s += `<g fill="${leaf}" stroke="${COL.ol}" stroke-width="1.6">${[-40, -14, 14, 40].map((a) => leafPath(cx, cy + 2, 26, 6, a)).join("")}</g>`;
    s += `<path d="M${cx - 11},${cy + 4} Q${cx},${cy} ${cx + 11},${cy + 4} L${cx + 2},${cy + 26} Q${cx},${cy + 28} ${cx - 2},${cy + 26}Z" fill="${COL.carrot}" stroke="${COL.ol}" stroke-width="1.8"/>`;
    s += `<path d="M${cx - 5},${cy + 10} L${cx + 1},${cy + 10} M${cx - 2},${cy + 17} L${cx + 3},${cy + 17}" stroke="${COL.carrotD}" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  // 다 자람 반짝
  s += `<path d="M${cx + 20},${cy - 22} l2,5 5,2 -5,2 -2,5 -2,-5 -5,-2 5,-2z" fill="${COL.sun}" stroke="${COL.ol}" stroke-width="1.2"/>`;
  return s;
}

// 방향 표시: 칸 가장자리의 작은 세모
function facingMark(face, x0, y0) {
  const c = CELL / 2;
  const tri = {
    위: [[x0 + c - 6, y0 + 9], [x0 + c + 6, y0 + 9], [x0 + c, y0 + 2]],
    아래: [[x0 + c - 6, y0 + CELL - 9], [x0 + c + 6, y0 + CELL - 9], [x0 + c, y0 + CELL - 2]],
    왼쪽: [[x0 + 9, y0 + c - 6], [x0 + 9, y0 + c + 6], [x0 + 2, y0 + c]],
    오른쪽: [[x0 + CELL - 9, y0 + c - 6], [x0 + CELL - 9, y0 + c + 6], [x0 + CELL - 2, y0 + c]],
  }[face];
  if (!tri) return "";
  return `<path d="M${tri.map(([a, b]) => `${a},${b}`).join(" L")}Z" fill="${COL.teal}" stroke="${COL.ol}" stroke-width="1.4"/>`;
}

function pieSVG(pie, face, onCrop) {
  const x0 = PAD + pie.x * CELL;
  const y0 = PAD + pie.y * CELL;
  const flip = face === "왼쪽" ? -1 : 1; // I18N_SKIP 방향 열쇠
  // snake(0,0)은 똬리 가운데 바닥이 (0,0), 머리가 위로 약 70. 칸 아래쪽에 바닥을 둔다.
  // 작물이 있는 칸이면 작게 왼쪽 아래 구석에 앉아 작물이 가려지지 않게 한다
  const k = onCrop ? 0.4 : 0.6;
  const cx = onCrop ? x0 + 17 : x0 + CELL / 2 + 1;
  const cy = onCrop ? y0 + CELL - 5 : y0 + CELL - 7;
  return `<g class="g-pie" data-facing="${esc(face)}" data-x="${pie.x}" data-y="${pie.y}">
    <rect x="${x0 + 3}" y="${y0 + 3}" width="${CELL - 6}" height="${CELL - 6}" rx="10" fill="none" stroke="${COL.pieRing}" stroke-width="3.5"/>
    ${facingMark(face, x0, y0)}
    <g transform="translate(${cx} ${cy}) scale(${flip * k} ${k})">${snake(0, 0, 1)}</g>
  </g>`;
}

// 글자 폭 어림(px, 13px 굵은 글꼴): 한글·전각 13, 그 밖 7.5
const charW = (ch) => (/[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 13 : 7.5);

function wrapText(text, maxW, maxLines = 2) {
  const lines = [];
  let cur = "";
  let w = 0;
  const chars = [...String(text).replace(/\s+/g, " ").trim()];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const cw = charW(ch);
    if (w + cw > maxW && cur) {
      lines.push(cur);
      if (lines.length === maxLines) {
        // 남은 글이 있으면 마지막 줄 끝을 …로
        let last = lines[maxLines - 1];
        let lw = [...last].reduce((a, c) => a + charW(c), 0);
        while (lw + 13 > maxW && last.length) { const arr = [...last]; lw -= charW(arr.pop()); last = arr.join(""); }
        lines[maxLines - 1] = last + "…";
        return { lines, width: Math.min(maxW, Math.max(...lines.map((l) => [...l].reduce((a, c) => a + charW(c), 0)))) };
      }
      cur = ch === " " ? "" : ch;
      w = ch === " " ? 0 : cw;
    } else {
      cur += ch;
      w += cw;
    }
  }
  if (cur || !lines.length) lines.push(cur);
  return { lines, width: Math.max(...lines.map((l) => [...l].reduce((a, c) => a + charW(c), 0))) };
}

// v0.19.0: 말풍선 판·글자는 그림이 아니라 글자 → CSS 이름표(밝게는 #FFFDF8·#22304A 그대로, 어둡게는 밤 색).
// 표현 속성(fill="…") 안의 var()는 브라우저마다 달라 style로 주고, 속성 값은 밝게 색으로 남겨 둔다
const V_PLATE = "fill:var(--card);stroke:var(--ink)";

function bubbleSVG(text, pie, W, H) {
  const maxW = W - 2 * PAD - 24;
  const { lines, width } = wrapText(text, maxW);
  const bw = Math.max(44, width + 24);
  const bh = lines.length * 18 + 14;
  const px = PAD + pie.x * CELL + CELL / 2;
  const top = PAD + pie.y * CELL;
  const above = top - bh - 8 >= 0;
  const by = above ? top - bh + 4 : top + CELL - 4;
  const bx = Math.min(Math.max(px - bw / 2, 4), W - bw - 4);
  const tail = above
    ? `M${px - 7},${by + bh - 1} L${px},${by + bh + 9} L${px + 7},${by + bh - 1}`
    : `M${px - 7},${by + 1} L${px},${by - 9} L${px + 7},${by + 1}`;
  const tx = bx + bw / 2;
  const tspans = lines.map((l, i) => `<tspan x="${r1(tx)}" y="${r1(by + 21 + i * 18)}">${esc(l)}</tspan>`).join("");
  void H;
  return `<g class="g-bubble">
    <rect x="${r1(bx)}" y="${r1(by)}" width="${r1(bw)}" height="${bh}" rx="12" fill="${COL.card}" stroke="${COL.ink}" style="${V_PLATE}" stroke-width="2.2"/>
    <path d="${tail}" fill="${COL.card}" stroke="${COL.ink}" style="${V_PLATE}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M${px - 5.5},${above ? by + bh - 1.2 : by + 1.2} L${px + 5.5},${above ? by + bh - 1.2 : by + 1.2}" stroke="${COL.card}" style="stroke:var(--card)" stroke-width="3"/>
    <text text-anchor="middle" font-size="13" font-weight="700" fill="${COL.ink}" style="fill:var(--ink)">${tspans}</text>
  </g>`;
}

function fxSVG(fx, size) {
  if (!fx || !Number.isInteger(fx.x) || !Number.isInteger(fx.y) || fx.x >= size || fx.y >= size) return "";
  const x0 = PAD + fx.x * CELL;
  const y0 = PAD + fx.y * CELL;
  const bx = x0 + CELL - 14;
  const by = y0 + 14;
  let body = "";
  switch (fx.t) {
    case "harvest":
      body = `<rect x="${bx - 17}" y="${by - 11}" width="30" height="22" rx="11" fill="${COL.sun}" stroke="${COL.ol}" stroke-width="2"/>
        <text x="${bx - 2}" y="${by + 5}" text-anchor="middle" font-size="13" font-weight="800" fill="${COL.ink}">+1</text>`;
      break;
    case "plant":
      body = `<circle cx="${bx}" cy="${by}" r="9" fill="${COL.leafL}" stroke="${COL.ol}" stroke-width="2"/>
        <path d="M${bx - 4},${by} L${bx + 4},${by} M${bx},${by - 4} L${bx},${by + 4}" stroke="${COL.ol}" stroke-width="2.2" stroke-linecap="round"/>`;
      break;
    case "plant_fail":
      body = `<circle cx="${bx}" cy="${by}" r="10" fill="${COL.coral}" stroke="${COL.ol}" stroke-width="2"/>
        <path d="M${bx - 4},${by - 4} L${bx + 4},${by + 4} M${bx + 4},${by - 4} L${bx - 4},${by + 4}" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
      break;
    case "harvest_young":
      body = `<rect x="${bx - 17}" y="${by - 11}" width="30" height="22" rx="11" fill="${COL.coralInk}" stroke="${COL.ol}" stroke-width="2"/>
        <text x="${bx - 2}" y="${by + 5}" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">${t`앗`}</text>`;
      break;
    case "harvest_empty":
      body = `<circle cx="${bx}" cy="${by}" r="10" fill="${COL.card}" style="fill:var(--card)" stroke="${COL.gray}" stroke-width="2" stroke-dasharray="3 2"/>
        <text x="${bx}" y="${by + 4.5}" text-anchor="middle" font-size="13" font-weight="800" fill="${COL.gray}">?</text>`;
      break;
    default:
      return "";
  }
  return `<g class="g-fx ${esc(fx.t)}">${body}</g>`;
}

function label(state, overlay, counts) {
  const p = state.pie;
  let s = t`텃밭 ${state.size}×${state.size}. 파이는 위에서 ${p.y + 1}번째 줄, 왼쪽에서 ${p.x + 1}번째 칸에 있어요.`;
  s += t` 다 자란 작물 ${counts.ripe}개, 자라는 작물 ${counts.young}개, 빈칸 ${counts.empty}개.`;
  if (overlay.say) s += t` 파이의 말: ${overlay.say}`;
  return s;
}

/**
 * 텃밭 SVG 글자.
 * @param state { size, cells, pie, clock, upgrades }
 * @param overlay { facing?: 방향, say?: 글, fx?: {t,x,y,crop?}, now?: 칸 강조 없음 }
 */
export function render(state, overlay = {}) {
  const size = state.size;
  const W = size * CELL + 2 * PAD;
  const H = W;
  const counts = { ripe: 0, young: 0, empty: 0 };
  let soil = "";
  let crops = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const x0 = PAD + x * CELL;
      const y0 = PAD + y * CELL;
      const cell = state.cells[i] || null;
      const st = stage(cell, state.clock, state.upgrades);
      if (!st) counts.empty++;
      else if (st === "ripe") counts.ripe++;
      else counts.young++;
      const fill = (x + y) % 2 ? COL.soil2 : COL.soil;
      soil += `<g data-cell="${i}"${cell ? ` data-crop="${esc(cell.crop)}" data-stage="${st}"` : ""}>`
        + `<rect x="${x0 + 3}" y="${y0 + 3}" width="${CELL - 6}" height="${CELL - 6}" rx="10" fill="${fill}" stroke="${COL.soilEdge}" stroke-width="2"/>`
        + `<path d="M${x0 + 12},${y0 + 22} L${x0 + CELL - 12},${y0 + 22} M${x0 + 12},${y0 + 42} L${x0 + CELL - 12},${y0 + 42}" stroke="${COL.furrow}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`
        + `</g>`;
      if (cell) crops += `<g class="g-crop">${cropSVG(cell, st, x0 + CELL / 2, y0 + CELL / 2 - 6)}</g>`;
    }
  }
  const face = overlay.facing || "오른쪽"; // I18N_SKIP 방향 열쇠
  const pie = pieSVG(state.pie, face, !!state.cells[state.pie.y * size + state.pie.x]);
  const fx = fxSVG(overlay.fx, size);
  const bubble = overlay.say ? bubbleSVG(overlay.say, state.pie, W, H) : "";
  const aria = label(state, overlay, counts);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="g-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">`
    + `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="#A8794E" stroke="${COL.soilEdge}" stroke-width="2"/>`
    + soil + crops + pie + fx + bubble + `</svg>`;
}
