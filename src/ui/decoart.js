// v0.22.0 꾸미기 그림(설계 2026-11-17 §5-4): 상점 견본, 텃밭 장식 띠, 공방 진열장 받침.
// 그림은 SVG 글자, <defs>·id 없음(ria.js 규칙). 모두 장식이라 aria-hidden — 글자 위에 겹치지 않아 대비를 바꾸지 않는다.
// 경비실 테마·편집기 색은 그림이 아니라 색 묶음: 경비실은 style.css [data-deco-guard], 편집기는 src/ui/editor.js(ED).
// 견본의 편집기 색·경비실 색은 밝게·어둡게 두 벌(.sw-l / .sw-d, style.css가 하나만 보임)

const svg = (vb, body, attrs = "") => `<svg viewBox="${vb}" aria-hidden="true" focusable="false"${attrs}>${body}</svg>`;
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join("");

// ---- 텃밭 ----
// 꽃 하나: (x, y) 가운데, 꽃잎 색 c
const flower = (x, y, c, r = 2.6) => `<path d="M${x} ${y + r}v${r * 2.4}" stroke="#4E9A5A" stroke-width="${r * 0.6}"/>`
  + `<g fill="${c}"><circle cx="${x - r}" cy="${y}" r="${r}"/><circle cx="${x + r}" cy="${y}" r="${r}"/><circle cx="${x}" cy="${y - r}" r="${r}"/><circle cx="${x}" cy="${y + r}" r="${r}"/></g>`
  + `<circle cx="${x}" cy="${y}" r="${r * 0.7}" fill="#FFE59A"/>`;
const PETALS = ["#E86A92", "#F2C23A", "#A98BE0", "#F08A5D"];

const fence = (w, h) => `<g fill="#C68D55" stroke="#7A4E25" stroke-width="1.2" stroke-linejoin="round">`
  + `<rect x="0" y="${h * 0.38}" width="${w}" height="${h * 0.13}"/><rect x="0" y="${h * 0.7}" width="${w}" height="${h * 0.13}"/>`
  + rep(Math.ceil(w / 25), (i) => `<path d="M${i * 25 + 6} ${h - 1}V${h * 0.3}l6.5-${h * 0.24} 6.5 ${h * 0.24}V${h - 1}z"/>`) + `</g>`;

const path = (w, h) => `<rect x="0" y="${h - 10}" width="${w}" height="9" rx="4.5" fill="#E2C996"/>`
  + rep(Math.ceil(w / 40), (i) => `<ellipse cx="${i * 40 + 18}" cy="${h - 5.5}" rx="9" ry="2.8" fill="#C7A971"/>`)
  + rep(Math.ceil(w / 30), (i) => flower(i * 30 + 12, h - 22 + (i % 2) * 4, PETALS[i % 4], 3.6));

// 둥근 유리 지붕: 2차 곡선(0,h)→(w/2,-0.6h)→(w,h). x가 t에 비례하므로 살대 끝 y는 곡선 식 그대로
const roofY = (t, h) => h * ((1 - t) ** 2 + t ** 2) - 1.2 * h * t * (1 - t);
const roof = (w, h) => `<path d="M0 ${h}Q${w / 2} ${-h * 0.6} ${w} ${h}z" fill="#CDEFF2" fill-opacity=".75" stroke="#3F8A74" stroke-width="2"/>`
  + `<g stroke="#3F8A74" stroke-width="1.4">${rep(Math.floor(w / 40) - 1, (i) => `<path d="M${(i + 1) * 40} ${h}V${roofY((i + 1) * 40 / w, h).toFixed(1)}"/>`)}</g>`
  + `<path d="M${w * 0.2} ${h * 0.75}q${w * 0.1} -${h * 0.4} ${w * 0.22} -${h * 0.5}" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>`;
const sill = (w, h) => `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="3" fill="#CDEFF2" fill-opacity=".75" stroke="#3F8A74" stroke-width="2"/>`
  + `<g stroke="#3F8A74" stroke-width="1.4">${rep(Math.floor(w / 40) - 1, (i) => `<path d="M${(i + 1) * 40} 1V${h - 1}"/>`)}</g>`;

const W = 300;   // 띠 viewBox 폭(휴대폰의 판 폭 약 300px과 비슷하게 — 가로로 늘이지 않음)
const strip = (place, h, body) => `<div class="g-deco g-deco-${place}" aria-hidden="true">${svg(`0 0 ${W} ${h}`, body, ` preserveAspectRatio="xMidYMax meet"`)}</div>`;
const GARDEN = {
  gd_fence: { bottom: () => strip("bottom", 34, fence(W, 34)) },
  gd_flowers: { bottom: () => strip("bottom", 34, path(W, 34)) },
  gd_greenhouse: { top: () => strip("top", 44, roof(W, 44)), bottom: () => strip("bottom", 16, sill(W, 16)) },
};

/** 텃밭 장식 띠 {top, bottom}(HTML 글자, 없으면 ""). id가 null·모르는 값이면 둘 다 "" */
export function gardenDeco(id) {
  const g = GARDEN[id];
  return { top: g && g.top ? g.top() : "", bottom: g && g.bottom ? g.bottom() : "" };
}

// ---- 공방 진열장 받침 ----
// 받침은 칸 폭만큼 가로로 늘어난다(preserveAspectRatio none) — 가로 줄·네모만 써서 늘여도 모양이 그대로
const STAND = {
  ws_wood: `<rect x="0" y="1" width="300" height="9" rx="2" fill="#C68D55" stroke="#7A4E25" stroke-width="1"/>`
    + `<path d="M8 4h70M110 6h90M220 4h70" stroke="#9A6534" stroke-width="1"/>`
    + `<rect x="14" y="10" width="10" height="5" fill="#9A6534"/><rect x="276" y="10" width="10" height="5" fill="#9A6534"/>`,
  ws_metal: `<rect x="0" y="1" width="300" height="9" rx="1" fill="#AEB8C6" stroke="#5E6B7D" stroke-width="1"/>`
    + `<rect x="0" y="1.5" width="300" height="2.5" fill="#E3E8EF"/>`
    + `<rect x="10" y="10" width="6" height="5" fill="#5E6B7D"/><rect x="284" y="10" width="6" height="5" fill="#5E6B7D"/>`
    + `<rect x="148" y="10" width="4" height="5" fill="#5E6B7D"/>`,
};
/** 진열장 받침(HTML 글자). 없으면 "" */
export const standHTML = (id) => (STAND[id]
  ? `<span class="ws-stand ws-stand-${id.slice(3)}" aria-hidden="true">${svg("0 0 300 15", STAND[id], ` preserveAspectRatio="none"`)}</span>` : "");

// ---- 상점 견본(44×44) ----
// 편집기 색 견본: [바탕, 낱말, 글자열, 정의] 밝게·어둡게(src/ui/editor.js ED와 같은 값)
const ED_SW = {
  ed_paper: [["#FFFBF0", "#8A2C55", "#8A4310", "#1D5A8A"], ["#241F18", "#F2A7C3", "#F0C27A", "#A9D3F5"]],
  ed_forest: [["#F3F9F1", "#1B6638", "#8A4519", "#0E5B67"], ["#14231A", "#8FE0A6", "#F0B98A", "#7FD6DE"]],
  ed_sea: [["#F1F7FC", "#0A578A", "#983A58", "#3446A8"], ["#0E2132", "#7CC8F5", "#FFB1A6", "#AAB9FF"]],
  ed_night: [["#F4F2FC", "#5527A0", "#9C2F72", "#1B5A88"], ["#11142E", "#C9B8FF", "#FFD48A", "#A7E3FF"]],
};
// 경비실 견본: [바탕, 칸, 글자, 점] 밝게·어둡게(style.css [data-deco-guard]와 같은 값)
const GU_SW = {
  gu_night: [["#E9EDF7", "#F9FAFE", "#1B2440", "#3D5BB8"], ["#0E1324", "#1A2241", "#EEF0FA", "#8FA8FF"]],
  gu_control: [["#E6F2EE", "#F8FCFA", "#15332E", "#12756D"], ["#0B1A19", "#152B2A", "#E4F6F0", "#5FE0C8"]],
};
const tile = (bg) => `<rect x="1" y="1" width="22" height="22" rx="6" fill="${bg}" stroke="currentColor" stroke-opacity=".3"/>`;
const edSw = ([bg, a, b, c], cls) => `<g class="${cls}">${tile(bg)}<rect x="4.5" y="6" width="7" height="2.6" rx="1.3" fill="${a}"/><rect x="13" y="6" width="6" height="2.6" rx="1.3" fill="${c}"/>`
  + `<rect x="7.5" y="10.7" width="11" height="2.6" rx="1.3" fill="${b}"/><rect x="7.5" y="15.4" width="5" height="2.6" rx="1.3" fill="${a}"/><rect x="14" y="15.4" width="4.5" height="2.6" rx="1.3" fill="${c}"/></g>`;
const guSw = ([bg, card, ink, dot], cls) => `<g class="${cls}">${tile(bg)}<rect x="4" y="5" width="16" height="7" rx="2" fill="${card}"/><rect x="6" y="7.5" width="8" height="2" rx="1" fill="${ink}"/>`
  + `<circle cx="17" cy="8.5" r="1.5" fill="${dot}"/><rect x="4" y="14" width="16" height="5" rx="2" fill="${card}"/><rect x="6" y="15.5" width="11" height="2" rx="1" fill="${ink}"/></g>`;
const SPACE_SW = {
  gd_fence: `${tile("#EAF5E4")}<g fill="#C68D55" stroke="#7A4E25" stroke-width=".7"><rect x="3" y="11" width="18" height="2"/><rect x="3" y="15.5" width="18" height="2"/>`
    + `<path d="M5 20V9l2-2.5L9 9v11zM11 20V9l2-2.5L15 9v11zM17 20V9l2-2.5L21 9v11z"/></g>`,
  gd_flowers: `${tile("#EAF5E4")}<rect x="3" y="17" width="18" height="4" rx="2" fill="#E2C996"/>${flower(7.5, 10, "#E86A92", 1.9)}${flower(16.5, 8.5, "#F2C23A", 1.9)}`,
  gd_greenhouse: `${tile("#EAF5E4")}<path d="M4 20V12Q12 2 20 12V20z" fill="#CDEFF2" stroke="#3F8A74" stroke-width="1.2"/><path d="M12 5.5V20M4 14h16" stroke="#3F8A74" stroke-width=".9"/>`,
  ws_wood: `${tile("#F6EEDC")}<rect x="8" y="7" width="8" height="8" rx="1.5" fill="#F2C23A" stroke="#8A6A10" stroke-width=".8"/>${svgInner("ws_wood")}`,
  ws_metal: `${tile("#EDF0F4")}<rect x="8" y="7" width="8" height="8" rx="1.5" fill="#7FC8C0" stroke="#2F6F68" stroke-width=".8"/>${svgInner("ws_metal")}`,
};
// 견본 속 받침: 진열장 받침 그림을 견본 칸 크기로
function svgInner(id) {
  return id === "ws_wood"
    ? `<rect x="3" y="15" width="18" height="3.2" rx=".8" fill="#C68D55" stroke="#7A4E25" stroke-width=".6"/><rect x="5" y="18.2" width="2" height="2.3" fill="#9A6534"/><rect x="17" y="18.2" width="2" height="2.3" fill="#9A6534"/>`
    : `<rect x="3" y="15" width="18" height="3.2" rx=".4" fill="#AEB8C6" stroke="#5E6B7D" stroke-width=".6"/><rect x="3" y="15.2" width="18" height=".9" fill="#E3E8EF"/><rect x="5" y="18.2" width="1.6" height="2.3" fill="#5E6B7D"/><rect x="17.4" y="18.2" width="1.6" height="2.3" fill="#5E6B7D"/>`;
}

/** 상점 견본 그림(svg 글자, 44×44). 장식이라 읽기 프로그램은 건너뛴다 */
export function decoSwatch(id) {
  const body = ED_SW[id] ? edSw(ED_SW[id][0], "sw-l") + edSw(ED_SW[id][1], "sw-d")
    : GU_SW[id] ? guSw(GU_SW[id][0], "sw-l") + guSw(GU_SW[id][1], "sw-d")
      : SPACE_SW[id] || tile("#DDD");
  return svg("0 0 24 24", body, ` class="si-svg" width="44" height="44"`);
}
